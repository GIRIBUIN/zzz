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

function kstIsoLocal(date = new Date()) {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().replace("Z", "");
}

function kstDateDaysAgo(days) {
  return kstDateString(new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000));
}

function parseDebugRange(qs = {}, body = {}) {
  const start = qs.debug_start ?? qs.start ?? body.debug_start ?? body.start;
  const end = qs.debug_end ?? qs.end ?? body.debug_end ?? body.end;

  if (start == null && end == null) return null;
  if (start == null || end == null) throw new Error("debug_start and debug_end must be provided together");

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
    throw new Error("invalid debug prediction range");
  }

  return {
    startLocalIso: kstIsoLocal(startDate),
    endLocalIso: kstIsoLocal(endDate),
  };
}

function rangeWhere(column = "ts") {
  return `${column} >= ? AND (? IS NULL OR ${column} < ?)`;
}

function rangeParams(startIso, endIso) {
  return [startIso, endIso, endIso];
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

// ─── Groq (EC2 프록시 경유) ───────────────────────────────────────────────────

async function callSlm(prompt) {
  const proxyUrl = process.env.GROQ_PROXY_URL;
  if (!proxyUrl || !prompt) return null;

  try {
    const res = await fetch(`${proxyUrl}/groq-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = (json?.text ?? "").trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

// ─── Presleep Feature Builder ─────────────────────────────────────────────────

const RECENT_N_DAYS = 7;

async function buildPresleepFeatures(userId, sinceIso, endIso = null) {
  const [heartRow, stepsRow, sensorRow, sleepRows, latestPattern, lowSatRow, caloriesRow] = await Promise.all([
    dbGet(`SELECT AVG(bpm) AS avg_hr_1h, MAX(bpm) AS max_hr_1h FROM google_health_heart WHERE user_id = ? AND ${rangeWhere("ts")}`, [userId, ...rangeParams(sinceIso, endIso)]),
    dbGet(`SELECT COALESCE(SUM(steps), 0) AS steps_sum_1h FROM google_health_steps WHERE user_id = ? AND ${rangeWhere("ts")}`, [userId, ...rangeParams(sinceIso, endIso)]),
    dbGet(`SELECT AVG(temperature) AS avg_temp_1h, AVG(humidity) AS avg_humidity_1h, AVG(mq5_index) AS avg_mq5_index_1h, MAX(mq5_raw) AS max_mq5_raw_1h FROM sensor_raw WHERE user_id = ? AND ${rangeWhere("ts")}`, [userId, ...rangeParams(sinceIso, endIso)]),
    dbAll(`SELECT minutes_asleep FROM google_health_sleep WHERE user_id = ? AND is_main_sleep = 1 ORDER BY sleep_date DESC LIMIT ?`, [userId, RECENT_N_DAYS]),
    dbGet(`SELECT avg_presleep_hr, avg_sleep_minutes, avg_satisfaction, score_gap_trend FROM pattern_profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`, [userId]),
    dbGet(
      `SELECT COUNT(DISTINCT pr.target_sleep_date) AS cnt FROM prediction_result pr JOIN user_feedback uf ON pr.user_id = uf.user_id AND pr.target_sleep_date = uf.sleep_date WHERE pr.user_id = ? AND pr.target_sleep_date >= ? AND uf.satisfaction_score < 50 AND pr.risk_level IN ('MEDIUM', 'HIGH')`,
      [userId, kstDateDaysAgo(RECENT_N_DAYS)]
    ),
    dbGet(`SELECT COALESCE(SUM(calories), 0) AS calories_sum_1h FROM google_health_calories WHERE user_id = ? AND ${rangeWhere("ts")}`, [userId, ...rangeParams(sinceIso, endIso)]).catch(() => null),
  ]);

  const sleepMinutes = sleepRows.map((r) => Number(r.minutes_asleep) || 0);
  const recentSleepAvg = sleepMinutes.length > 0
    ? sleepMinutes.reduce((a, b) => a + b, 0) / sleepMinutes.length
    : null;

  let sleepIrregularity = null;
  if (sleepMinutes.length >= 3) {
    const mean = recentSleepAvg;
    const variance = sleepMinutes.reduce((a, b) => a + (b - mean) ** 2, 0) / sleepMinutes.length;
    sleepIrregularity = Math.sqrt(variance);
  }

  return {
    user_id: userId,
    target_sleep_date: kstDateString(),
    avg_hr_1h: heartRow?.avg_hr_1h ?? null,
    max_hr_1h: heartRow?.max_hr_1h ?? null,
    steps_sum_1h: stepsRow?.steps_sum_1h ?? 0,
    calories_sum_1h: caloriesRow?.calories_sum_1h ?? null,
    avg_temp_1h: sensorRow?.avg_temp_1h ?? null,
    avg_humidity_1h: sensorRow?.avg_humidity_1h ?? null,
    avg_mq5_index_1h: sensorRow?.avg_mq5_index_1h ?? null,
    max_mq5_raw_1h: sensorRow?.max_mq5_raw_1h ?? null,
    recent_n_sleep_avg: recentSleepAvg,
    recent_avg_sleep_minutes: recentSleepAvg,
    sleep_irregularity: sleepIrregularity,
    recent_low_sat_high_risk: lowSatRow?.cnt ?? 0,
    pattern: latestPattern ?? null,
  };
}

// ─── 예측 (규칙 기반) ─────────────────────────────────────────────────────────

const DEFAULT_BASE_HR = 72;

function computePresleepRisk(features, patternProfile) {
  const avgHr = Number(features?.avg_hr_1h ?? 0);
  const steps = Number(features?.steps_sum_1h ?? 0);
  const calories = features?.calories_sum_1h != null ? Number(features.calories_sum_1h) : null;
  const temp = Number(features?.avg_temp_1h ?? 0);
  const humidity = Number(features?.avg_humidity_1h ?? 0);
  const mq5 = Number(features?.avg_mq5_index_1h ?? 0);
  const recentLowSat = Number(features?.recent_low_sat_high_risk ?? 0);
  const sleepIrregularity = features?.sleep_irregularity ?? null;

  const baseHr = Number(patternProfile?.avg_presleep_hr ?? DEFAULT_BASE_HR);
  const hrThreshold = baseHr + 8;

  const reasons = [];
  if (avgHr >= hrThreshold)                                         reasons.push("취침 전 심박이 평소보다 높은 편입니다.");
  if (steps >= 300)                                                  reasons.push("취침 전 활동량이 다소 높은 편입니다.");
  if (calories !== null && calories >= 200)                         reasons.push("취침 전 칼로리 소모가 높은 편입니다.");
  if (temp >= 25.5)                                                  reasons.push("실내 온도가 약간 높은 편입니다.");
  if (humidity >= 65)                                               reasons.push("실내 습도가 높은 편입니다.");
  if (mq5 >= 0.5)                                                   reasons.push("실내 공기 상태가 불리할 수 있습니다.");
  if (patternProfile && recentLowSat >= 2)                          reasons.push("최근 비슷한 환경에서 수면 만족도가 낮은 날이 반복되었습니다.");
  if (patternProfile && sleepIrregularity !== null && sleepIrregularity >= 60) reasons.push("최근 수면 시간이 불규칙한 편입니다.");

  let risk_score = 35;
  if (avgHr >= hrThreshold)                                         risk_score += 15;
  if (steps >= 300)                                                  risk_score += 10;
  if (calories !== null && calories >= 200)                         risk_score += 10;
  if (temp >= 25.5)                                                  risk_score += 10;
  if (humidity >= 65)                                               risk_score += 10;
  if (mq5 >= 0.5)                                                   risk_score += 10;
  if (patternProfile && recentLowSat >= 2)                          risk_score += 15;
  if (patternProfile && sleepIrregularity !== null && sleepIrregularity >= 60) risk_score += 5;
  if (risk_score > 100) risk_score = 100;

  let risk_level = "LOW";
  if (risk_score >= 70) risk_level = "HIGH";
  else if (risk_score >= 50) risk_level = "MEDIUM";

  let action_text = "현재 상태를 유지해도 괜찮습니다.";
  if (risk_level === "MEDIUM") action_text = "취침 전 활동을 조금 줄이고 실내 환경을 점검해보세요.";
  else if (risk_level === "HIGH") action_text = "취침 전에 심박을 안정시키고, 환기나 온습도 조절을 먼저 해보는 것이 좋겠습니다.";

  return { risk_level, risk_score, reasons, action_text, hr_baseline: baseHr };
}

// ─── 예측 결과 저장 ───────────────────────────────────────────────────────────

async function savePredictionResult(snapshot, predictionResult) {
  const predictionTs = kstIsoLocal();
  const createdAt = new Date().toISOString();
  const targetSleepDate = snapshot?.target_sleep_date || kstDateString();
  const userId = Number(snapshot?.user_id);
  const reasonsJson = JSON.stringify(predictionResult.reasons || []);
  const snapshotJson = JSON.stringify(snapshot || {});

  if (!Number.isInteger(userId) || userId <= 0) throw new Error("user_id must be a positive integer");

  const ins = await dbRun(
    `INSERT INTO prediction_result (user_id, prediction_ts, target_sleep_date, risk_level, risk_score, reasons_json, action_text, feature_snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, predictionTs, targetSleepDate, predictionResult.risk_level, predictionResult.risk_score, reasonsJson, predictionResult.action_text, snapshotJson, createdAt]
  );

  return {
    id: ins.lastID,
    user_id: userId,
    prediction_ts: predictionTs,
    target_sleep_date: targetSleepDate,
    risk_level: predictionResult.risk_level,
    risk_score: predictionResult.risk_score,
    reasons: predictionResult.reasons || [],
    reasons_json: reasonsJson,
    action_text: predictionResult.action_text,
    feature_snapshot_json: snapshotJson,
    created_at: createdAt,
    message: predictionResult.message,
    received: snapshot || {},
  };
}

// ─── 핸들러 ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const body = typeof event.body === "string" ? (() => { try { return JSON.parse(event.body); } catch { return {}; } })() : (event.body || {});

  const userId = Number(qs.user_id ?? body.user_id);
  if (!Number.isInteger(userId) || userId <= 0) return errRes(400, "user_id must be a positive integer");

  try {
    const user = await dbGet(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (!user) return errRes(400, "user not found");

    // skip_collect=true 고정: Lambda에서는 Google Health 실시간 수집 불가
    const debugRange = parseDebugRange(qs, body);
    const sinceIso = debugRange?.startLocalIso ?? kstIsoLocal(new Date(Date.now() - 60 * 60 * 1000));
    const snapshot = await buildPresleepFeatures(userId, sinceIso, debugRange?.endLocalIso ?? null);
    console.log("[zzz-prediction-handler] feature snapshot:", {
      user_id: snapshot.user_id,
      avg_hr_1h: snapshot.avg_hr_1h,
      steps_sum_1h: snapshot.steps_sum_1h,
    });

    const hasData =
      snapshot?.avg_hr_1h !== null ||
      snapshot?.max_hr_1h !== null ||
      snapshot?.calories_sum_1h !== null ||
      Number(snapshot?.steps_sum_1h || 0) > 0;

    if (!hasData) {
      return errRes(400, "최근 1시간 wearable 데이터가 없습니다. seed-demo를 다시 실행하거나 Google Health 동기화를 먼저 확인하세요.");
    }

    const predictionResult = computePresleepRisk(snapshot, snapshot?.pattern ?? null);

    const groqPrompt = [
      "아래 취침 전 센서 데이터를 바탕으로 오늘 밤 수면에 대해 한국어로 두 문장 이내로 조언해주세요. 서론 없이 핵심 내용만 바로 작성하세요.",
      `위험 수준: ${predictionResult.risk_level} (${predictionResult.risk_score}점)`,
      `심박수: ${snapshot.avg_hr_1h != null ? Number(snapshot.avg_hr_1h).toFixed(1) + " bpm" : "없음"}`,
      `활동량(걸음): ${snapshot.steps_sum_1h ?? 0}`,
      `실내온도: ${snapshot.avg_temp_1h != null ? Number(snapshot.avg_temp_1h).toFixed(1) + "°C" : "없음"}`,
      `실내습도: ${snapshot.avg_humidity_1h != null ? Number(snapshot.avg_humidity_1h).toFixed(1) + "%" : "없음"}`,
      `공기질(MQ5): ${snapshot.avg_mq5_index_1h != null ? Number(snapshot.avg_mq5_index_1h).toFixed(2) : "없음"}`,
      `주요 원인: ${predictionResult.reasons.join(", ") || "없음"}`,
    ].join("\n");
    const slmText = await callSlm(groqPrompt);
    predictionResult.action_text = slmText
      ? `[slm] ${slmText}`
      : `[rule] ${predictionResult.action_text}`;

    const result = await savePredictionResult(snapshot, predictionResult);

    console.log("[zzz-prediction-handler] prediction result:", {
      id: result.id,
      target_sleep_date: result.target_sleep_date,
      risk_level: result.risk_level,
      risk_score: result.risk_score,
      action_source: result.action_text?.startsWith("[slm]") ? "slm" : "rule",
    });

    return ok({
      status: "ok",
      endpoint: "POST /predict/presleep",
      warning: "Google Health live sync skipped in Lambda (skip_collect=true)",
      data: result,
    });
  } catch (e) {
    console.error("[zzz-prediction-handler] error:", e);
    const statusCode = e.message === "user not found" || e.message.includes("user_id") ? 400 : 500;
    return errRes(statusCode, e.message);
  }
};
