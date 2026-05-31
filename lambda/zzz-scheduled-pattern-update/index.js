// EventBridge 스케줄 트리거: 매일 새벽 1시(KST) 패턴 갱신
// cron(0 16 * * ? *)  → UTC 16:00 = KST 01:00
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "zzz",
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
});

const RECENT_N = 7;

async function dbGet(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function dbAll(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows || [];
}

async function dbRun(sql, params) {
  const [result] = await pool.query(sql, params);
  return { lastID: result.insertId || 0 };
}

// ─── Stage 1: 수면 통계 + 취침 전 심박 기준선 갱신 ───────────────────────────

async function updateStage1(userId, sleepDate) {
  const now = new Date().toISOString();

  const sleepAvg = await dbGet(
    `SELECT AVG(minutes_asleep) AS avg_sleep_minutes
     FROM (SELECT minutes_asleep FROM google_health_sleep
           WHERE user_id = ? AND sleep_date <= ? AND is_main_sleep = 1
           ORDER BY sleep_date DESC LIMIT ?) t`,
    [userId, sleepDate, RECENT_N]
  );

  const predRows = await dbAll(
    `SELECT feature_snapshot_json FROM prediction_result
     WHERE user_id = ? AND target_sleep_date <= ?
     ORDER BY target_sleep_date DESC LIMIT ?`,
    [userId, sleepDate, RECENT_N]
  );

  let avgPresleepHr = null;
  const hrVals = [];
  for (const row of predRows) {
    try {
      const snap = JSON.parse(row.feature_snapshot_json || "{}");
      if (snap.avg_hr_1h != null) hrVals.push(Number(snap.avg_hr_1h));
    } catch { }
  }
  if (hrVals.length > 0) avgPresleepHr = hrVals.reduce((a, b) => a + b, 0) / hrVals.length;

  if (avgPresleepHr === null) {
    const hrRow = await dbGet(
      `SELECT AVG(bpm) AS avg_hr FROM google_health_heart
       WHERE user_id = ? AND TIME(ts) BETWEEN '21:00:00' AND '23:59:59'
         AND DATE(ts) <= ? AND DATE(ts) > DATE_SUB(?, INTERVAL ? DAY)`,
      [userId, sleepDate, sleepDate, RECENT_N]
    );
    avgPresleepHr = hrRow?.avg_hr ?? null;
  }

  const last = await dbGet(
    `SELECT avg_satisfaction, score_gap_trend, env_sensitivity_json, pattern_snapshot_json
     FROM pattern_profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );

  await dbRun(`DELETE FROM pattern_profile WHERE user_id = ? AND sleep_date = ? AND stage = ?`, [userId, sleepDate, "stage1"]);
  await dbRun(
    `INSERT INTO pattern_profile
       (user_id, sleep_date, stage, updated_at, avg_sleep_minutes, avg_presleep_hr,
        avg_satisfaction, score_gap_trend, env_sensitivity_json, pattern_snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, sleepDate, "stage1", now,
     sleepAvg?.avg_sleep_minutes ?? null, avgPresleepHr,
     last?.avg_satisfaction ?? null, last?.score_gap_trend ?? null,
     last?.env_sensitivity_json ?? null, last?.pattern_snapshot_json ?? null]
  );

  return { avg_sleep_minutes: sleepAvg?.avg_sleep_minutes ?? null, avg_presleep_hr: avgPresleepHr };
}

// ─── Stage 2: 만족도 + 점수 갭 트렌드 + 예측 정확도 갱신 ─────────────────────

async function updateStage2(userId, sleepDate) {
  const now = new Date().toISOString();

  const fbAvg = await dbGet(
    `SELECT AVG(satisfaction_score) AS avg_satisfaction
     FROM (SELECT satisfaction_score FROM user_feedback
           WHERE user_id = ? AND sleep_date <= ?
           ORDER BY sleep_date DESC LIMIT ?) t`,
    [userId, sleepDate, RECENT_N]
  );

  const gapRow = await dbGet(
    `SELECT AVG(auto_score - uf.satisfaction_score) AS gap_trend
     FROM (SELECT ssr.total_score AS auto_score, uf.sleep_date
           FROM sleep_score_result ssr
           JOIN user_feedback uf ON ssr.user_id = uf.user_id AND ssr.sleep_date = uf.sleep_date
           WHERE ssr.user_id = ? AND ssr.sleep_date <= ?
           ORDER BY ssr.sleep_date DESC LIMIT ?) joined
     JOIN user_feedback uf ON uf.user_id = ? AND uf.sleep_date = joined.sleep_date`,
    [userId, sleepDate, RECENT_N, userId]
  );
  const gapTrend = gapRow?.gap_trend ?? 0;

  const last2 = await dbGet(
    `SELECT avg_sleep_minutes, avg_presleep_hr FROM pattern_profile
     WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );

  const envRows = await dbAll(
    `SELECT pr.feature_snapshot_json, uf.satisfaction_score
     FROM prediction_result pr
     JOIN user_feedback uf ON pr.user_id = uf.user_id AND pr.target_sleep_date = uf.sleep_date
     WHERE pr.user_id = ? AND pr.target_sleep_date <= ?
     ORDER BY pr.target_sleep_date DESC LIMIT ?`,
    [userId, sleepDate, RECENT_N]
  );

  const hits = { gas: 0, temp: 0, humidity: 0, hr: 0, activity: 0 };
  let lowSatTotal = 0;
  for (const row of envRows) {
    if (Number(row.satisfaction_score) >= 50) continue;
    lowSatTotal++;
    try {
      const snap = JSON.parse(row.feature_snapshot_json || "{}");
      if (Number(snap.avg_mq5_index_1h) >= 0.5) hits.gas++;
      if (Number(snap.avg_temp_1h)      >= 25.5) hits.temp++;
      if (Number(snap.avg_humidity_1h)  >= 65)   hits.humidity++;
      if (Number(snap.avg_hr_1h)        >= 80)   hits.hr++;
      if (Number(snap.steps_sum_1h)     >= 300)  hits.activity++;
    } catch { }
  }
  const sensitivity = {};
  for (const [k, cnt] of Object.entries(hits)) {
    sensitivity[k] = lowSatTotal > 0 ? Math.round((cnt / lowSatTotal) * 100) / 100 : 0;
  }

  const accRows = await dbAll(
    `SELECT pr.risk_level, ssr.total_score AS sleep_score, uf.satisfaction_score
     FROM prediction_result pr
     LEFT JOIN sleep_score_result ssr ON pr.user_id = ssr.user_id AND pr.target_sleep_date = ssr.sleep_date
     LEFT JOIN user_feedback uf ON pr.user_id = uf.user_id AND pr.target_sleep_date = uf.sleep_date
     WHERE pr.user_id = ? AND pr.target_sleep_date <= ?
       AND (ssr.total_score IS NOT NULL OR uf.satisfaction_score IS NOT NULL)
     ORDER BY pr.target_sleep_date DESC LIMIT ?`,
    [userId, sleepDate, RECENT_N]
  );

  let total = 0, correct = 0;
  for (const row of accRows) {
    if (!row.risk_level) continue;
    const bad = (row.sleep_score != null && row.sleep_score < 60) || (row.satisfaction_score != null && row.satisfaction_score < 50);
    if ((row.risk_level === "HIGH" || row.risk_level === "MEDIUM") === bad) correct++;
    total++;
  }
  const pred_accuracy_rate = total > 0 ? Math.round((correct / total) * 100) / 100 : null;

  await dbRun(`DELETE FROM pattern_profile WHERE user_id = ? AND sleep_date = ? AND stage = ?`, [userId, sleepDate, "stage2"]);
  await dbRun(
    `INSERT INTO pattern_profile
       (user_id, sleep_date, stage, updated_at, avg_sleep_minutes, avg_presleep_hr,
        avg_satisfaction, score_gap_trend, env_sensitivity_json, pattern_snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, sleepDate, "stage2", now,
     last2?.avg_sleep_minutes ?? null, last2?.avg_presleep_hr ?? null,
     fbAvg?.avg_satisfaction ?? null, gapTrend,
     JSON.stringify(sensitivity),
     JSON.stringify({ pred_accuracy_rate, computed_at: sleepDate })]
  );

  return { avg_satisfaction: fbAvg?.avg_satisfaction ?? null, score_gap_trend: gapTrend, pred_accuracy_rate };
}

// ─── 핸들러 ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  console.log("[zzz-scheduled-pattern-update] triggered:", JSON.stringify(event));

  // 최근 7일 내 피드백이 있는 유저만 대상
  const targets = await dbAll(
    `SELECT DISTINCT uf.user_id, MAX(uf.sleep_date) AS latest_sleep_date
     FROM user_feedback uf
     WHERE uf.sleep_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY uf.user_id`,
    [RECENT_N]
  );

  console.log(`[zzz-scheduled-pattern-update] 처리 대상 유저: ${targets.length}명`);

  const results = [];

  for (const target of targets) {
    const { user_id, latest_sleep_date } = target;
    try {
      const stage1 = await updateStage1(user_id, latest_sleep_date);
      const stage2 = await updateStage2(user_id, latest_sleep_date);
      results.push({ user_id, sleep_date: latest_sleep_date, action: "updated", stage1, stage2 });
      console.log(`[zzz-scheduled-pattern-update] user=${user_id} date=${latest_sleep_date} → updated`);
    } catch (e) {
      console.error(`[zzz-scheduled-pattern-update] user=${user_id} 실패:`, e.message);
      results.push({ user_id, sleep_date: latest_sleep_date, action: "failed", reason: e.message });
    }
  }

  const summary = {
    updated: results.filter(r => r.action === "updated").length,
    failed:  results.filter(r => r.action === "failed").length,
  };

  console.log("[zzz-scheduled-pattern-update] 완료:", summary);
  return { status: "ok", summary, results };
};
