const crypto = require("crypto");
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

const SCRYPT_KEY_LENGTH = 64;

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function ok(statusCode, body) {
  return {
    statusCode,
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

function parseBody(event) {
  if (!event.body) return {};
  if (typeof event.body === "object") return event.body;
  try { return JSON.parse(event.body); } catch { return {}; }
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

// ─── 인증 로직 ────────────────────────────────────────────────────────────────

function validateCredentials(loginId, password) {
  const id = String(loginId || "").trim();
  const pw = String(password || "");

  if (!id) throw new Error("login_id is required");
  if (!pw) throw new Error("password is required");
  if (id.length > 80) throw new Error("login_id is too long");
  if (pw.length < 4) throw new Error("password must be at least 4 characters");
  if (pw.length > 256) throw new Error("password is too long");

  return { loginId: id, password: pw };
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (err, key) => {
      if (err) return reject(err);
      resolve(key);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

async function verifyPassword(password, hash) {
  const [method, salt, keyHex] = String(hash || "").split(":");
  if (method !== "scrypt" || !salt || !keyHex) return false;
  const derived = await scrypt(password, salt);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

function toUserResponse(row) {
  return { user_id: row.id, login_id: row.login_id, created_at: row.created_at, updated_at: row.updated_at };
}

// ─── 핸들러 함수 ──────────────────────────────────────────────────────────────

async function register(body) {
  const { loginId, password } = validateCredentials(body?.login_id, body?.password);

  const existing = await dbGet(`SELECT id FROM users WHERE login_id = ? LIMIT 1`, [loginId]);
  if (existing) throw Object.assign(new Error("login_id already exists"), { statusCode: 409 });

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const inserted = await dbRun(
    `INSERT INTO users (login_id, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    [loginId, passwordHash, now, now]
  );

  return ok(201, {
    status: "ok",
    endpoint: "POST /auth/register",
    data: { user_id: inserted.lastID, login_id: loginId, created_at: now, updated_at: now },
  });
}

async function login(body) {
  const { loginId, password } = validateCredentials(body?.login_id, body?.password);

  const user = await dbGet(
    `SELECT id, login_id, password_hash, created_at, updated_at FROM users WHERE login_id = ? LIMIT 1`,
    [loginId]
  );
  if (!user) throw Object.assign(new Error("invalid login_id or password"), { statusCode: 401 });

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) throw Object.assign(new Error("invalid login_id or password"), { statusCode: 401 });

  return ok(200, { status: "ok", endpoint: "POST /auth/login", data: toUserResponse(user) });
}

async function listUsers() {
  const rows = await dbAll(`SELECT id, login_id, created_at, updated_at FROM users ORDER BY id ASC`, []);
  return ok(200, { status: "ok", endpoint: "GET /auth/users", data: { users: rows.map(toUserResponse) } });
}

// ─── 라우팅 ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || "";
  const path = event.rawPath || event.path || "";
  const body = parseBody(event);

  try {
    if (method === "POST" && path.endsWith("/register")) return await register(body);
    if (method === "POST" && path.endsWith("/login"))    return await login(body);
    if (method === "GET"  && path.endsWith("/users"))    return await listUsers();

    return errRes(404, "not found");
  } catch (e) {
    console.error("[zzz-auth-handler] error:", e);
    return errRes(e.statusCode || 400, e.message);
  }
};
