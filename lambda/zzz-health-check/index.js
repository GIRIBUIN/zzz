const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "zzz",
  waitForConnections: true,
  connectionLimit: 2,
  dateStrings: true,
});

function res(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://ciotzzz.duckdns.org" },
    body: JSON.stringify(body),
  };
}

exports.handler = async () => {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    return res(200, {
      status: "ok",
      service: "zzz-service",
      db: "ok",
      latency_ms: Date.now() - start,
      time: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[zzz-health-check] DB ping failed:", e.message);
    return res(503, {
      status: "error",
      service: "zzz-service",
      db: "error",
      message: e.message,
      time: new Date().toISOString(),
    });
  }
};
