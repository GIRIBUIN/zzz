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

function ok(body) {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://ciotzzz.duckdns.org" },
    body: JSON.stringify(body),
  };
}

function err(statusCode, message) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://ciotzzz.duckdns.org" },
    body: JSON.stringify({ status: "error", message }),
  };
}

function parseUserId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("user_id must be a positive integer");
  return id;
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function handleLatest(userId) {
  const [
    [fbRows], [predRows], [scoreRows], [analysisRows], [envRows]
  ] = await Promise.all([
    pool.query(`SELECT id, user_id, sleep_date, satisfaction_score, created_at FROM user_feedback WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [userId]),
    pool.query(`SELECT id, user_id, prediction_ts, target_sleep_date, risk_level, risk_score, reasons_json, action_text, feature_snapshot_json, created_at FROM prediction_result WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [userId]),
    pool.query(`SELECT id, user_id, sleep_date, time_asleep_score, deep_rem_score, restoration_score, total_score, created_at FROM sleep_score_result WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [userId]),
    pool.query(`SELECT id, user_id, sleep_date, causes_json, analysis_text, created_at FROM post_analysis_result WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [userId]),
    pool.query(`SELECT id, user_id, device_id, ts, temperature, humidity, mq5_index, created_at FROM sensor_raw WHERE user_id = ? ORDER BY ts DESC LIMIT 1`, [userId]),
  ]);

  const pred = predRows[0] || null;
  const analysis = analysisRows[0] || null;

  return ok({
    status: "ok",
    endpoint: "GET /result/latest",
    data: {
      message: "latest result fetched",
      latest_feedback: fbRows[0] || null,
      latest_prediction: pred ? { ...pred, reasons: parseJsonArray(pred.reasons_json) } : null,
      latest_sleep_score: scoreRows[0] || null,
      latest_analysis: analysis ? { ...analysis, causes: parseJsonArray(analysis.causes_json) } : null,
      latest_environment: envRows[0] || null,
    },
  });
}

async function handleSleepScoreHistory(userId, limitParam) {
  const limit = Number.isFinite(Number(limitParam))
    ? Math.min(Math.max(Math.trunc(Number(limitParam)), 1), 30)
    : 7;

  const [rows] = await pool.query(
    `SELECT sleep_date, total_score FROM sleep_score_result WHERE user_id = ? ORDER BY sleep_date DESC LIMIT ?`,
    [userId, limit]
  );
  const history = (rows || []).slice().reverse();

  return ok({
    status: "ok",
    endpoint: "GET /result/sleep-score-history",
    data: { message: "sleep score history fetched", history },
  });
}

exports.handler = async (event) => {
  const path = event.rawPath || event.path || "";
  const qs = event.queryStringParameters || {};

  let userId;
  try {
    userId = parseUserId(qs.user_id);
  } catch (e) {
    return err(400, e.message);
  }

  try {
    const [[user]] = await pool.query(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (!user) return err(400, "user not found");

    if (path.includes("sleep-score-history")) {
      return await handleSleepScoreHistory(userId, qs.limit);
    }
    return await handleLatest(userId);
  } catch (e) {
    console.error("[zzz-result-handler] error:", e);
    return err(500, e.message);
  }
};
