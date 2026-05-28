const crypto = require("crypto");
const db = require("../../storage/db/db");

const SCRYPT_KEY_LENGTH = 64;

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function normalizeLoginId(loginId) {
  return String(loginId || "").trim();
}

function validateCredentials(loginId, password) {
  const normalizedLoginId = normalizeLoginId(loginId);
  const normalizedPassword = String(password || "");

  if (!normalizedLoginId) {
    throw new Error("login_id is required");
  }

  if (!normalizedPassword) {
    throw new Error("password is required");
  }

  if (normalizedLoginId.length > 80) {
    throw new Error("login_id is too long");
  }

  if (normalizedPassword.length < 4) {
    throw new Error("password must be at least 4 characters");
  }

  return {
    loginId: normalizedLoginId,
    password: normalizedPassword
  };
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, passwordHash) {
  const [method, salt, keyHex] = String(passwordHash || "").split(":");

  if (method !== "scrypt" || !salt || !keyHex) {
    return false;
  }

  const derivedKey = await scrypt(password, salt);
  const expected = Buffer.from(keyHex, "hex");

  return expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey);
}

function toUserResponse(row) {
  return {
    user_id: row.id,
    login_id: row.login_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function registerUser(payload) {
  const { loginId, password } = validateCredentials(payload?.login_id, payload?.password);
  const existingUser = await dbGet(`SELECT id FROM users WHERE login_id = ? LIMIT 1`, [loginId]);

  if (existingUser) {
    throw new Error("login_id already exists");
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const insertResult = await dbRun(
    `INSERT INTO users (login_id, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [loginId, passwordHash, now, now]
  );

  return {
    user_id: insertResult.lastID,
    login_id: loginId,
    created_at: now,
    updated_at: now
  };
}

async function loginUser(payload) {
  const { loginId, password } = validateCredentials(payload?.login_id, payload?.password);
  const user = await dbGet(
    `SELECT id, login_id, password_hash, created_at, updated_at
     FROM users
     WHERE login_id = ?
     LIMIT 1`,
    [loginId]
  );

  if (!user) {
    throw new Error("invalid login_id or password");
  }

  const passwordValid = await verifyPassword(password, user.password_hash);

  if (!passwordValid) {
    throw new Error("invalid login_id or password");
  }

  return toUserResponse(user);
}

async function listUsers() {
  const rows = await dbAll(
    `SELECT id, login_id, created_at, updated_at
     FROM users
     ORDER BY id ASC`
  );

  return rows.map(toUserResponse);
}

module.exports = {
  hashPassword,
  registerUser,
  loginUser,
  listUsers
};
