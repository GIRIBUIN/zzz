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

// ─── 유틸 ────────────────────────────────────────────────────────────────────

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateString(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function previousDateString(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString))) return null;
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function kstDateDaysAgo(days) {
  return kstDateString(new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000));
}

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
  return { lastID: result.insertId || 0, changes: result.affectedRows || 0 };
}

function ok(body) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://ciotzzz.duckdns.org" },
    body: JSON.stringify(body),
  };
}

function errRes(statusCode, message) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://ciotzzz.duckdns.org" },
    body: JSON.stringify({ status: "error", message }),
  };
}

// ─── SLM (Lambda에서는 SLM_ENDPOINT 미설정 → null 반환) ──────────────────────

async function callSlm(prompt) {
  const endpoint = process.env.SLM_ENDPOINT;
  const model = process.env.SLM_MODEL;
  if (!endpoint || !model) return null;

  try {
    const res = await fetch(`${endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = (json?.response ?? "").trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

// ─── Sleep Score 계산 (순수 함수) ────────────────────────────────────────────

const GAP_DAMPING = 0.5;
const MAX_CORRECTION = 15;

function calcSleepScore(sleepRow, patternProfile) {
  const minutesAsleep = Number(sleepRow.minutes_asleep) || 0;
  const minutesAwake = Number(sleepRow.minutes_awake) || 0;
  const deepMinutes = Number(sleepRow.deep_minutes) || 0;
  const remMinutes = Number(sleepRow.rem_minutes) || 0;

  let timeAsleepScore;
  if (minutesAsleep >= 420) timeAsleepScore = 50;
  else if (minutesAsleep <= 180) timeAsleepScore = 0;
  else timeAsleepScore = ((minutesAsleep - 180) / (420 - 180)) * 50;

  const stageBase = minutesAsleep || 1;
  const deepRemRatio = (deepMinutes + remMinutes) / stageBase;
  let deepRemScore;
  if (deepRemRatio >= 0.25) deepRemScore = 25;
  else if (deepRemRatio <= 0.10) deepRemScore = 5;
  else deepRemScore = 5 + ((deepRemRatio - 0.10) / (0.25 - 0.10)) * 20;

  const sessionTotal = minutesAsleep + minutesAwake || 1;
  const awakeRatio = minutesAwake / sessionTotal;
  let restorationScore;
  if (awakeRatio <= 0) restorationScore = 25;
  else if (awakeRatio >= 0.20) restorationScore = 5;
  else restorationScore = 5 + ((0.20 - awakeRatio) / 0.20) * 20;

  const round1 = (v) => Math.round(v * 10) / 10;
  const rawTotal = timeAsleepScore + deepRemScore + restorationScore;
  const gapTrend = Number(patternProfile?.score_gap_trend ?? 0);
  const correction = Math.max(-MAX_CORRECTION, Math.min(MAX_CORRECTION, gapTrend * GAP_DAMPING));
  const adjustedTotal = Math.max(0, Math.min(100, rawTotal - correction));

  return {
    time_asleep_score: round1(timeAsleepScore),
    deep_rem_score: round1(deepRemScore),
    restoration_score: round1(restorationScore),
    raw_total_score: round1(rawTotal),
    total_score: round1(adjustedTotal),
  };
}

// ─── Post Analysis (순수 함수) ───────────────────────────────────────────────

const CAUSE_LABELS = {
  gas: "실내 가스(공기질) 불량",
  temp: "실내 온도 높음",
  humidity: "실내 습도 높음",
  hr: "취침 전 심박 상승",
  activity: "취침 전 과도한 활동",
  low_satisfaction: "주관적 수면 만족도 낮음",
  score_gap: "객관 점수와 체감 만족도 차이",
  short_sleep: "총 수면 시간 부족",
  awake: "중간 각성 시간 증가",
  low_deep_rem: "깊은 수면/REM 수면 부족",
};

function analyzePostSleep({ sleepRow, scoreResult, featureSnapshot, satisfactionScore, patternProfile }) {
  const f = featureSnapshot || {};
  const baseHr = Number(patternProfile?.avg_presleep_hr ?? 70);
  const minutesAsleep = Number(sleepRow?.minutes_asleep ?? 0);
  const minutesAwake = Number(sleepRow?.minutes_awake ?? 0);
  const deepMinutes = Number(sleepRow?.deep_minutes ?? 0);
  const remMinutes = Number(sleepRow?.rem_minutes ?? 0);
  const totalScore = Number(scoreResult?.total_score ?? 0);
  const satisfaction = satisfactionScore == null ? null : Number(satisfactionScore);
  const scoreGap = satisfaction == null ? null : totalScore - satisfaction;
  const deepRemRatio = minutesAsleep > 0 ? (deepMinutes + remMinutes) / minutesAsleep : null;

  const hits = [];
  if (Number(f.avg_mq5_index_1h) >= 0.5)           hits.push({ key: "gas",              weight: 3 });
  if (Number(f.avg_hr_1h) >= baseHr + 8)            hits.push({ key: "hr",               weight: 3 });
  if (Number(f.avg_temp_1h) >= 25.5)                hits.push({ key: "temp",             weight: 2 });
  if (Number(f.avg_humidity_1h) >= 65)              hits.push({ key: "humidity",         weight: 2 });
  if (Number(f.steps_sum_1h) >= 300)                hits.push({ key: "activity",         weight: 1 });
  if (satisfaction != null && satisfaction < 50)     hits.push({ key: "low_satisfaction", weight: 3 });
  if (scoreGap != null && Math.abs(scoreGap) >= 10) hits.push({ key: "score_gap",        weight: 2 });
  if (minutesAsleep > 0 && minutesAsleep < 360)      hits.push({ key: "short_sleep",      weight: 2 });
  if (minutesAwake >= 30)                            hits.push({ key: "awake",            weight: 2 });
  if (deepRemRatio != null && deepRemRatio < 0.25)  hits.push({ key: "low_deep_rem",     weight: 2 });
  hits.sort((a, b) => b.weight - a.weight);

  const noSensorData = !featureSnapshot;
  const mainCause = hits[0] ? CAUSE_LABELS[hits[0].key] : null;
  const subCause  = hits[1] ? CAUSE_LABELS[hits[1].key] : null;
  const causesList = hits.map((c) => ({ key: c.key, label: CAUSE_LABELS[c.key] }));

  let analysis_text;
  if (noSensorData) {
    analysis_text = "취침 전 센서 데이터가 없어 원인 분석을 수행할 수 없습니다.";
  } else if (causesList.length === 0) {
    analysis_text = "특별한 수면 방해 요인이 감지되지 않았습니다. 전반적으로 양호한 수면 환경이었습니다.";
  } else {
    const parts = [`주요 원인: ${mainCause}.`];
    if (subCause) parts.push(`보조 원인: ${subCause}.`);
    parts.push("취침 전 환경 및 신체 상태를 점검해 보세요.");
    analysis_text = parts.join(" ");
  }

  const gap = scoreResult?.total_score != null && satisfaction != null
    ? Math.round((Number(scoreResult.total_score) - satisfaction) * 10) / 10
    : null;
  const score_gap_note = gap == null ? null
    : Math.abs(gap) < 5 ? "객관 수면 점수와 주관적 만족도가 대체로 일치합니다."
    : gap > 0
      ? `객관 점수(${scoreResult.total_score})가 주관 만족도(${satisfaction})보다 ${gap}점 높습니다. 수면 구조는 양호했으나 컨디션이 좋지 않으셨을 수 있습니다.`
      : `주관 만족도(${satisfaction})가 객관 점수(${scoreResult.total_score})보다 ${Math.abs(gap)}점 높습니다. 수면의 질 지표 대비 체감 컨디션이 더 좋으셨던 것 같습니다.`;

  return { causes_json: JSON.stringify(causesList), analysis_text, score_gap_note };
}

// ─── DB 작업 ─────────────────────────────────────────────────────────────────

async function saveFeedbackRecord(userId, wakeDate, satisfactionScore) {
  const score = Number(satisfactionScore);
  if (score < 0 || score > 100) throw new Error("satisfaction_score must be between 0 and 100");

  const sleepDate = previousDateString(wakeDate);
  if (!sleepDate) throw new Error("wake_date must be YYYY-MM-DD");

  const today = kstDateString();
  if (wakeDate > today) throw new Error("future wake_date is not allowed");

  const now = new Date().toISOString();
  const existing = await dbGet(
    `SELECT id, satisfaction_score FROM user_feedback WHERE user_id = ? AND sleep_date = ? LIMIT 1`,
    [userId, sleepDate]
  );

  if (existing) {
    if (Number(existing.satisfaction_score) === score) {
      return { message: "feedback unchanged", action: "no_change", id: existing.id, user_id: userId, wake_date: wakeDate, sleep_date: sleepDate, satisfaction_score: score };
    }
    await dbRun(`UPDATE user_feedback SET satisfaction_score = ?, created_at = ? WHERE id = ?`, [score, now, existing.id]);
    return { message: "feedback updated", action: "update", id: existing.id, user_id: userId, wake_date: wakeDate, sleep_date: sleepDate, satisfaction_score: score, created_at: now };
  }

  const inserted = await dbRun(
    `INSERT INTO user_feedback (user_id, sleep_date, satisfaction_score, created_at) VALUES (?, ?, ?, ?)`,
    [userId, sleepDate, score, now]
  );
  return { message: "feedback saved", action: "insert", id: inserted.lastID, user_id: userId, wake_date: wakeDate, sleep_date: sleepDate, satisfaction_score: score, created_at: now };
}

async function ensureSleepScore(userId, sleepDate) {
  const existing = await dbGet(
    `SELECT id, user_id, sleep_date, time_asleep_score, deep_rem_score, restoration_score, total_score, created_at FROM sleep_score_result WHERE user_id = ? AND sleep_date = ? ORDER BY created_at DESC LIMIT 1`,
    [userId, sleepDate]
  );
  if (existing) return { action: "exists", sleep_date: sleepDate, score: existing };

  const sleepRow = await dbGet(
    `SELECT sleep_date, start_time, end_time, minutes_asleep, minutes_awake, deep_minutes, light_minutes, rem_minutes, is_main_sleep FROM google_health_sleep WHERE user_id = ? AND sleep_date = ? ORDER BY created_at DESC LIMIT 1`,
    [userId, sleepDate]
  );
  if (!sleepRow) return { action: "skipped", sleep_date: sleepDate, reason: "sleep source data missing" };

  const patternProfile = await dbGet(
    `SELECT avg_presleep_hr, avg_sleep_minutes, avg_satisfaction, score_gap_trend FROM pattern_profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
  const scoreResult = calcSleepScore(sleepRow, patternProfile);
  const createdAt = new Date().toISOString();

  await dbRun(`DELETE FROM sleep_score_result WHERE user_id = ? AND sleep_date = ?`, [userId, sleepDate]);
  const ins = await dbRun(
    `INSERT INTO sleep_score_result (user_id, sleep_date, time_asleep_score, deep_rem_score, restoration_score, total_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, sleepDate, scoreResult.time_asleep_score, scoreResult.deep_rem_score, scoreResult.restoration_score, scoreResult.total_score, createdAt]
  );

  const saved = { id: ins.lastID, user_id: userId, sleep_date: sleepDate, ...scoreResult, created_at: createdAt };
  return { action: "created", sleep_date: sleepDate, score: saved };
}

async function updatePattern(userId, sleepDate, satisfactionScore, sleepScoreTotal) {
  const RECENT_N = 7;
  const now = new Date().toISOString();

  // Stage 1
  const sleepAvgRow = await dbGet(
    `SELECT AVG(minutes_asleep) AS avg_sleep_minutes FROM (SELECT sleep_date, minutes_asleep FROM google_health_sleep WHERE user_id = ? AND sleep_date <= ? AND is_main_sleep = 1 ORDER BY sleep_date DESC LIMIT ?) t`,
    [userId, sleepDate, RECENT_N]
  );
  const predRows = await dbAll(
    `SELECT feature_snapshot_json FROM prediction_result WHERE user_id = ? AND target_sleep_date <= ? ORDER BY target_sleep_date DESC LIMIT ?`,
    [userId, sleepDate, RECENT_N]
  );

  let avgPresleepHr = null;
  const hrValues = [];
  for (const row of predRows) {
    try {
      const snap = JSON.parse(row.feature_snapshot_json || "{}");
      if (snap.avg_hr_1h != null) hrValues.push(Number(snap.avg_hr_1h));
    } catch { }
  }
  if (hrValues.length > 0) avgPresleepHr = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;

  if (avgPresleepHr === null) {
    const hrRow = await dbGet(
      `SELECT AVG(bpm) AS avg_hr FROM google_health_heart WHERE user_id = ? AND TIME(ts) BETWEEN '21:00:00' AND '23:59:59' AND DATE(ts) <= ? AND DATE(ts) > DATE_SUB(?, INTERVAL ? DAY)`,
      [userId, sleepDate, sleepDate, RECENT_N]
    );
    avgPresleepHr = hrRow?.avg_hr ?? null;
  }

  const lastPattern = await dbGet(
    `SELECT avg_satisfaction, score_gap_trend, env_sensitivity_json, pattern_snapshot_json FROM pattern_profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );

  await dbRun(`DELETE FROM pattern_profile WHERE user_id = ? AND sleep_date = ? AND stage = ?`, [userId, sleepDate, "stage1"]);
  await dbRun(
    `INSERT INTO pattern_profile (user_id, sleep_date, stage, updated_at, avg_sleep_minutes, avg_presleep_hr, avg_satisfaction, score_gap_trend, env_sensitivity_json, pattern_snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, sleepDate, "stage1", now, sleepAvgRow?.avg_sleep_minutes ?? null, avgPresleepHr, lastPattern?.avg_satisfaction ?? null, lastPattern?.score_gap_trend ?? null, lastPattern?.env_sensitivity_json ?? null, lastPattern?.pattern_snapshot_json ?? null]
  );

  const stage1 = { updated_at: now, avg_sleep_minutes: sleepAvgRow?.avg_sleep_minutes ?? null, avg_presleep_hr: avgPresleepHr };

  // Stage 2
  const feedbackAvgRow = await dbGet(
    `SELECT AVG(satisfaction_score) AS avg_satisfaction FROM (SELECT satisfaction_score FROM user_feedback WHERE user_id = ? AND sleep_date <= ? ORDER BY sleep_date DESC LIMIT ?) t`,
    [userId, sleepDate, RECENT_N]
  );
  const gapTrendRow = await dbGet(
    `SELECT AVG(auto_score - uf.satisfaction_score) AS gap_trend FROM (SELECT ssr.total_score AS auto_score, uf.sleep_date FROM sleep_score_result ssr JOIN user_feedback uf ON ssr.user_id = uf.user_id AND ssr.sleep_date = uf.sleep_date WHERE ssr.user_id = ? AND ssr.sleep_date <= ? ORDER BY ssr.sleep_date DESC LIMIT ?) joined JOIN user_feedback uf ON uf.user_id = ? AND uf.sleep_date = joined.sleep_date`,
    [userId, sleepDate, RECENT_N, userId]
  );
  const gapTrend = gapTrendRow?.gap_trend != null ? gapTrendRow.gap_trend : Number(sleepScoreTotal) - Number(satisfactionScore);

  const lastPattern2 = await dbGet(`SELECT avg_sleep_minutes, avg_presleep_hr FROM pattern_profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`, [userId]);

  const envRows = await dbAll(
    `SELECT pr.feature_snapshot_json, uf.satisfaction_score FROM prediction_result pr JOIN user_feedback uf ON pr.user_id = uf.user_id AND pr.target_sleep_date = uf.sleep_date WHERE pr.user_id = ? AND pr.target_sleep_date <= ? ORDER BY pr.target_sleep_date DESC LIMIT ?`,
    [userId, sleepDate, RECENT_N]
  );
  const factorHits = { gas: 0, temp: 0, humidity: 0, hr: 0, activity: 0 };
  let lowSatTotal = 0;
  for (const row of envRows) {
    if (Number(row.satisfaction_score) >= 50) continue;
    lowSatTotal++;
    try {
      const snap = JSON.parse(row.feature_snapshot_json || "{}");
      if (Number(snap.avg_mq5_index_1h) >= 0.5) factorHits.gas++;
      if (Number(snap.avg_temp_1h)      >= 25.5) factorHits.temp++;
      if (Number(snap.avg_humidity_1h)  >= 65)   factorHits.humidity++;
      if (Number(snap.avg_hr_1h)        >= 80)   factorHits.hr++;
      if (Number(snap.steps_sum_1h)     >= 300)  factorHits.activity++;
    } catch { }
  }
  const sensitivity = {};
  for (const [k, cnt] of Object.entries(factorHits)) {
    sensitivity[k] = lowSatTotal > 0 ? Math.round((cnt / lowSatTotal) * 100) / 100 : 0;
  }

  const accRows = await dbAll(
    `SELECT pr.risk_level, ssr.total_score AS sleep_score, uf.satisfaction_score FROM prediction_result pr LEFT JOIN sleep_score_result ssr ON pr.user_id = ssr.user_id AND pr.target_sleep_date = ssr.sleep_date LEFT JOIN user_feedback uf ON pr.user_id = uf.user_id AND pr.target_sleep_date = uf.sleep_date WHERE pr.user_id = ? AND pr.target_sleep_date <= ? AND (ssr.total_score IS NOT NULL OR uf.satisfaction_score IS NOT NULL) ORDER BY pr.target_sleep_date DESC LIMIT ?`,
    [userId, sleepDate, RECENT_N]
  );
  let totalValid = 0, hits2 = 0;
  for (const row of accRows) {
    if (!row.risk_level) continue;
    const bad = (row.sleep_score != null && row.sleep_score < 60) || (row.satisfaction_score != null && row.satisfaction_score < 50);
    if ((row.risk_level === "HIGH" || row.risk_level === "MEDIUM") === bad) hits2++;
    totalValid++;
  }
  const pred_accuracy_rate = totalValid > 0 ? Math.round((hits2 / totalValid) * 100) / 100 : null;

  await dbRun(`DELETE FROM pattern_profile WHERE user_id = ? AND sleep_date = ? AND stage = ?`, [userId, sleepDate, "stage2"]);
  await dbRun(
    `INSERT INTO pattern_profile (user_id, sleep_date, stage, updated_at, avg_sleep_minutes, avg_presleep_hr, avg_satisfaction, score_gap_trend, env_sensitivity_json, pattern_snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, sleepDate, "stage2", now, lastPattern2?.avg_sleep_minutes ?? null, lastPattern2?.avg_presleep_hr ?? null, feedbackAvgRow?.avg_satisfaction ?? satisfactionScore, gapTrend, JSON.stringify(sensitivity), JSON.stringify({ pred_accuracy_rate, computed_at: sleepDate })]
  );

  return {
    stage1,
    stage2: { updated_at: now, avg_satisfaction: feedbackAvgRow?.avg_satisfaction ?? satisfactionScore, score_gap_trend: gapTrend, env_sensitivity: sensitivity, pred_accuracy_rate },
  };
}

async function generatePostAnalysis(userId, sleepDate, satisfactionScore) {
  const [sleepRow, scoreResult, predictionRow, patternProfile] = await Promise.all([
    dbGet(`SELECT sleep_date, start_time, end_time, minutes_asleep, minutes_awake, deep_minutes, light_minutes, rem_minutes, is_main_sleep FROM google_health_sleep WHERE user_id = ? AND sleep_date = ? ORDER BY created_at DESC LIMIT 1`, [userId, sleepDate]),
    dbGet(`SELECT id, user_id, sleep_date, time_asleep_score, deep_rem_score, restoration_score, total_score FROM sleep_score_result WHERE user_id = ? AND sleep_date = ? ORDER BY created_at DESC LIMIT 1`, [userId, sleepDate]),
    dbGet(`SELECT feature_snapshot_json FROM prediction_result WHERE user_id = ? AND target_sleep_date = ? ORDER BY prediction_ts DESC LIMIT 1`, [userId, sleepDate]),
    dbGet(`SELECT avg_presleep_hr, avg_sleep_minutes, avg_satisfaction, score_gap_trend FROM pattern_profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`, [userId]),
  ]);

  if (!sleepRow || !scoreResult) {
    return { action: "skipped", reason: "sleep source data or sleep_score_result missing", sleep_date: sleepDate };
  }

  let featureSnapshot = null;
  try { featureSnapshot = predictionRow?.feature_snapshot_json ? JSON.parse(predictionRow.feature_snapshot_json) : null; } catch { }

  const analysis = analyzePostSleep({ sleepRow, scoreResult, featureSnapshot, satisfactionScore, patternProfile });
  const slmText = await callSlm(`${analysis.analysis_text}\n${analysis.score_gap_note || ""}`);
  const analysisText = slmText ? `[slm] ${slmText}` : `[rule] ${analysis.analysis_text}${analysis.score_gap_note ? " " + analysis.score_gap_note : ""}`;
  const createdAt = new Date().toISOString();

  await dbRun(`DELETE FROM post_analysis_result WHERE user_id = ? AND sleep_date = ?`, [userId, sleepDate]);
  const ins = await dbRun(
    `INSERT INTO post_analysis_result (user_id, sleep_score_result_id, sleep_date, causes_json, analysis_text, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, scoreResult.id, sleepDate, analysis.causes_json, analysisText, createdAt]
  );

  let causes = [];
  try { causes = JSON.parse(analysis.causes_json) || []; } catch { }

  return { action: "upsert", id: ins.lastID, user_id: userId, sleep_date: sleepDate, causes, analysis_text: analysisText, source: slmText ? "slm" : "rule", created_at: createdAt };
}

// ─── 핸들러 ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : (event.body || {});
  } catch {
    return errRes(400, "invalid JSON body");
  }

  const rawUserId = body.user_id ?? (event.queryStringParameters || {}).user_id;
  const userId = Number(rawUserId);
  if (!Number.isInteger(userId) || userId <= 0) return errRes(400, "user_id must be a positive integer");

  const { sleep_date: wakeDate, satisfaction_score } = body;
  if (!wakeDate) return errRes(400, "wake_date is required");
  if (satisfaction_score === undefined || satisfaction_score === null || Number.isNaN(Number(satisfaction_score))) {
    return errRes(400, "satisfaction_score must be a number");
  }

  try {
    const user = await dbGet(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (!user) return errRes(400, "user not found");

    const feedbackResult = await saveFeedbackRecord(userId, wakeDate, satisfaction_score);

    let sleepScore = null;
    try {
      sleepScore = await ensureSleepScore(userId, feedbackResult.sleep_date);
    } catch (e) {
      console.error("[zzz-feedback-handler] sleep score failed:", e.message);
      sleepScore = { action: "failed", sleep_date: feedbackResult.sleep_date, reason: e.message };
    }

    const scoreTotal = sleepScore?.score?.total_score;
    let pattern = null;
    const shouldUpdatePattern = scoreTotal != null && (feedbackResult.action === "insert" || feedbackResult.action === "update" || sleepScore.action === "created");

    if (shouldUpdatePattern) {
      try {
        const p = await updatePattern(userId, feedbackResult.sleep_date, feedbackResult.satisfaction_score, scoreTotal);
        pattern = { action: "upsert", sleep_date: feedbackResult.sleep_date, ...p, pred_accuracy_rate: p.stage2.pred_accuracy_rate, score_gap_trend: p.stage2.score_gap_trend };
      } catch (e) {
        console.error("[zzz-feedback-handler] pattern update failed:", e.message);
        pattern = { action: "failed", sleep_date: feedbackResult.sleep_date, reason: e.message };
      }
    } else {
      pattern = { action: "skipped", sleep_date: feedbackResult.sleep_date };
    }

    const hasAnalysis = await dbGet(`SELECT id FROM post_analysis_result WHERE user_id = ? AND sleep_date = ? LIMIT 1`, [userId, feedbackResult.sleep_date]);
    const shouldAnalyze = feedbackResult.action === "insert" || feedbackResult.action === "update" || !hasAnalysis;

    let postAnalysis;
    if (!shouldAnalyze) {
      postAnalysis = { action: "unchanged", sleep_date: feedbackResult.sleep_date };
    } else {
      try {
        postAnalysis = await generatePostAnalysis(userId, feedbackResult.sleep_date, feedbackResult.satisfaction_score);
      } catch (e) {
        console.error("[zzz-feedback-handler] post analysis failed:", e.message);
        postAnalysis = { action: "failed", sleep_date: feedbackResult.sleep_date, reason: e.message };
      }
    }

    const result = { ...feedbackResult, sleep_score: sleepScore, pattern, post_analysis: postAnalysis };
    console.log("[zzz-feedback-handler] result:", { id: result.id, sleep_date: result.sleep_date, action: result.action });

    return ok({ status: "ok", endpoint: "POST /feedback", data: result });
  } catch (e) {
    console.error("[zzz-feedback-handler] error:", e);
    return errRes(400, e.message);
  }
};
