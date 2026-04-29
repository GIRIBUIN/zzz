const db = require("../../storage/db/db");

const RECENT_N_DAYS = 7;
let schemaReady = false;

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function ensurePatternProfileSchema() {
  if (schemaReady) return;

  const columns = await dbAll(`PRAGMA table_info(pattern_profile)`, []);
  const names = new Set(columns.map((column) => column.name));

  if (!names.has("sleep_date")) {
    await dbRun(`ALTER TABLE pattern_profile ADD COLUMN sleep_date TEXT`, []);
  }

  if (!names.has("stage")) {
    await dbRun(`ALTER TABLE pattern_profile ADD COLUMN stage TEXT`, []);
  }

  await dbRun(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_pattern_profile_sleep_date_stage
     ON pattern_profile(sleep_date, stage)`,
    []
  );

  schemaReady = true;
}

async function replacePatternRow(sleepDate, stage, insertSql, params) {
  await ensurePatternProfileSchema();
  await dbRun(`DELETE FROM pattern_profile WHERE sleep_date = ? AND stage = ?`, [sleepDate, stage]);
  return dbRun(insertSql, params);
}

// Stage 1: called after objective sleep data (Fitbit) is available for sleepDate
async function updatePatternStage1(sleepDate) {
  await ensurePatternProfileSchema();
  const now = new Date().toISOString();

  // Average sleep minutes over recent N days (main sleep only)
  const sleepAvgRow = await dbGet(
    `SELECT AVG(minutes_asleep) AS avg_sleep_minutes
     FROM (
       SELECT minutes_asleep FROM fitbit_sleep
       WHERE sleep_date <= ? AND is_main_sleep = 1
       ORDER BY sleep_date DESC LIMIT ?
     )`,
    [sleepDate, RECENT_N_DAYS]
  );

  // Sliding-window avg_presleep_hr: average avg_hr_1h from last N days of prediction snapshots
  const predRows = await dbAll(
    `SELECT feature_snapshot_json FROM prediction_result
     WHERE target_sleep_date <= ?
     GROUP BY target_sleep_date
     ORDER BY target_sleep_date DESC LIMIT ?`,
    [sleepDate, RECENT_N_DAYS]
  );

  let avgPresleepHr = null;
  const hrValues = [];
  for (const row of predRows) {
    if (row.feature_snapshot_json) {
      try {
        const snap = JSON.parse(row.feature_snapshot_json);
        if (snap.avg_hr_1h != null) hrValues.push(Number(snap.avg_hr_1h));
      } catch (_) {}
    }
  }
  if (hrValues.length > 0) {
    avgPresleepHr = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
  }

  // Fallback: prediction 기록 없으면 fitbit_heart 21~23시 구간 N일 평균
  if (avgPresleepHr === null) {
    const hrRow = await dbGet(
      `SELECT AVG(bpm) AS avg_hr FROM fitbit_heart
       WHERE substr(ts, 12, 8) BETWEEN '21:00:00' AND '23:59:59'
         AND substr(ts, 1, 10) <= ?
         AND substr(ts, 1, 10) > date(?, '-' || ? || ' days')`,
      [sleepDate, sleepDate, RECENT_N_DAYS]
    );
    avgPresleepHr = hrRow?.avg_hr ?? null;
  }

  // Carry forward existing avg_satisfaction, score_gap_trend, and computed fields from last pattern
  const lastPattern = await dbGet(
    `SELECT avg_satisfaction, score_gap_trend, env_sensitivity_json, pattern_snapshot_json
     FROM pattern_profile ORDER BY updated_at DESC LIMIT 1`,
    []
  );

  await replacePatternRow(
    sleepDate,
    "stage1",
    `INSERT INTO pattern_profile
       (sleep_date, stage, updated_at, avg_sleep_minutes, avg_presleep_hr, avg_satisfaction, score_gap_trend, env_sensitivity_json, pattern_snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sleepDate,
      "stage1",
      now,
      sleepAvgRow?.avg_sleep_minutes ?? null,
      avgPresleepHr,
      lastPattern?.avg_satisfaction ?? null,
      lastPattern?.score_gap_trend ?? null,
      lastPattern?.env_sensitivity_json ?? null,
      lastPattern?.pattern_snapshot_json ?? null
    ]
  );

  return {
    updated_at: now,
    avg_sleep_minutes: sleepAvgRow?.avg_sleep_minutes ?? null,
    avg_presleep_hr: avgPresleepHr
  };
}

// Stage 2: called after user submits satisfaction score
// sleepScoreTotal: objective auto score (0~100)
// satisfactionScore: subjective user score (0~100)
async function updatePatternStage2(sleepDate, satisfactionScore, sleepScoreTotal) {
  await ensurePatternProfileSchema();
  const now = new Date().toISOString();

  // Pull all satisfaction scores from recent N days to compute rolling average
  const feedbackRow = await dbGet(
    `SELECT AVG(satisfaction_score) AS avg_satisfaction
     FROM (
       SELECT satisfaction_score FROM user_feedback
       WHERE sleep_date <= ?
       ORDER BY sleep_date DESC LIMIT ?
     )`,
    [sleepDate, RECENT_N_DAYS]
  );

  // score_gap_trend: rolling average of (auto_score - satisfaction_score)
  const gapTrendRow = await dbGet(
    `SELECT AVG(auto_score - uf.satisfaction_score) AS gap_trend
     FROM (
       SELECT ssr.total_score AS auto_score, uf.sleep_date
       FROM sleep_score_result ssr
       JOIN user_feedback uf ON ssr.sleep_date = uf.sleep_date
       WHERE ssr.sleep_date <= ?
       ORDER BY ssr.sleep_date DESC LIMIT ?
     ) joined
     JOIN user_feedback uf ON uf.sleep_date = joined.sleep_date`,
    [sleepDate, RECENT_N_DAYS]
  );

  // Fallback: compute from this record alone if join yields nothing
  const gapTrend =
    gapTrendRow?.gap_trend != null
      ? gapTrendRow.gap_trend
      : Number(sleepScoreTotal) - Number(satisfactionScore);

  // Carry forward stage-1 fields from latest pattern
  const lastPattern = await dbGet(
    `SELECT avg_sleep_minutes, avg_presleep_hr
     FROM pattern_profile ORDER BY updated_at DESC LIMIT 1`,
    []
  );

  // env_sensitivity_json: P(factor | low satisfaction) over last N days
  // Uses prediction feature snapshots joined with user satisfaction scores
  const envRows = await dbAll(
    `SELECT pr.feature_snapshot_json, uf.satisfaction_score
     FROM prediction_result pr
     JOIN user_feedback uf ON pr.target_sleep_date = uf.sleep_date
     WHERE pr.target_sleep_date <= ?
     GROUP BY pr.target_sleep_date
     ORDER BY pr.target_sleep_date DESC LIMIT ?`,
    [sleepDate, RECENT_N_DAYS]
  );

  const factorHits = { gas: 0, temp: 0, humidity: 0, hr: 0, activity: 0 };
  let lowSatTotal = 0;
  for (const row of envRows) {
    if (Number(row.satisfaction_score) >= 50) continue;
    lowSatTotal++;
    try {
      const snap = JSON.parse(row.feature_snapshot_json || '{}');
      if (Number(snap.avg_mq5_index_1h) >= 0.5) factorHits.gas++;
      if (Number(snap.avg_temp_1h)      >= 25.5) factorHits.temp++;
      if (Number(snap.avg_humidity_1h)  >= 65)   factorHits.humidity++;
      if (Number(snap.avg_hr_1h)        >= 80)   factorHits.hr++;
      if (Number(snap.steps_sum_1h)     >= 300)  factorHits.activity++;
    } catch (_) {}
  }
  const sensitivity = {};
  for (const [k, cnt] of Object.entries(factorHits)) {
    sensitivity[k] = lowSatTotal > 0 ? Math.round((cnt / lowSatTotal) * 100) / 100 : 0;
  }
  const env_sensitivity_json = JSON.stringify(sensitivity);

  // pred_accuracy_rate: fraction of days where predicted risk matched actual outcome
  // Hit = (MEDIUM/HIGH predicted AND outcome bad) OR (LOW predicted AND outcome good)
  const accRows = await dbAll(
    `SELECT pr.risk_level, ssr.total_score AS sleep_score, uf.satisfaction_score
     FROM prediction_result pr
     LEFT JOIN sleep_score_result ssr ON pr.target_sleep_date = ssr.sleep_date
     LEFT JOIN user_feedback uf ON pr.target_sleep_date = uf.sleep_date
     WHERE pr.target_sleep_date <= ?
       AND (ssr.total_score IS NOT NULL OR uf.satisfaction_score IS NOT NULL)
     GROUP BY pr.target_sleep_date
     ORDER BY pr.target_sleep_date DESC LIMIT ?`,
    [sleepDate, RECENT_N_DAYS]
  );

  let totalValid = 0;
  let hits = 0;
  for (const row of accRows) {
    if (!row.risk_level) continue;
    const actuallyBad = (row.sleep_score != null && row.sleep_score < 60) ||
                        (row.satisfaction_score != null && row.satisfaction_score < 50);
    const predictedBad = row.risk_level === 'HIGH' || row.risk_level === 'MEDIUM';
    if (predictedBad === actuallyBad) hits++;
    totalValid++;
  }
  const pred_accuracy_rate = totalValid > 0
    ? Math.round((hits / totalValid) * 100) / 100
    : null;
  const pattern_snapshot_json = JSON.stringify({ pred_accuracy_rate, computed_at: sleepDate });

  await replacePatternRow(
    sleepDate,
    "stage2",
    `INSERT INTO pattern_profile
       (sleep_date, stage, updated_at, avg_sleep_minutes, avg_presleep_hr, avg_satisfaction, score_gap_trend, env_sensitivity_json, pattern_snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sleepDate,
      "stage2",
      now,
      lastPattern?.avg_sleep_minutes ?? null,
      lastPattern?.avg_presleep_hr ?? null,
      feedbackRow?.avg_satisfaction ?? satisfactionScore,
      gapTrend,
      env_sensitivity_json,
      pattern_snapshot_json
    ]
  );

  return {
    updated_at: now,
    avg_satisfaction: feedbackRow?.avg_satisfaction ?? satisfactionScore,
    score_gap_trend: gapTrend,
    env_sensitivity: sensitivity,
    pred_accuracy_rate
  };
}

module.exports = { updatePatternStage1, updatePatternStage2 };
