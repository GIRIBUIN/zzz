const db = require("../../storage/db/db");

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function parseUserId(value) {
  const userId = Number(value);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("user_id must be a positive integer");
  }

  return userId;
}

async function requireUserId(rawUserId) {
  const userId = parseUserId(rawUserId);
  const user = await dbGet(`SELECT id FROM users WHERE id = ? LIMIT 1`, [userId]);

  if (!user) {
    throw new Error("user not found");
  }

  return userId;
}

async function requireUserIdFromRequest(req) {
  return requireUserId(req.body?.user_id ?? req.query?.user_id);
}

module.exports = {
  requireUserId,
  requireUserIdFromRequest
};
