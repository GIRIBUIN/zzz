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

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};

  let userId;
  try {
    userId = parseUserId(qs.user_id);
  } catch (e) {
    return err(400, e.message);
  }

  const limit = Number.isFinite(Number(qs.limit))
    ? Math.min(Math.max(Math.trunc(Number(qs.limit)), 1), 30)
    : 7;

  try {
    const [[user]] = await pool.query(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId]);
    if (!user) return err(400, "user not found");

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
  } catch (e) {
    console.error("[zzz-sleep-score-history-handler] error:", e);
    return err(500, e.message);
  }
};
