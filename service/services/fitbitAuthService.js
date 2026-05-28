const crypto = require("crypto");
const https = require("https");
const db = require("../../storage/db/db");

const FITBIT_AUTHORIZE_URL = "https://www.fitbit.com/oauth2/authorize";
const FITBIT_TOKEN_HOST = "api.fitbit.com";
const FITBIT_TOKEN_PATH = "/oauth2/token";
const DEFAULT_SCOPES = ["activity", "heartrate", "sleep", "profile"];
const STATE_TTL_MS = 10 * 60 * 1000;

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

function requireFitbitConfig() {
  const clientId = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;
  const redirectUri = process.env.FITBIT_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET / FITBIT_REDIRECT_URI are required");
  }

  return {
    clientId,
    clientSecret,
    redirectUri
  };
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function signState(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

function createState(userId, clientSecret) {
  const payload = base64UrlEncode(JSON.stringify({
    user_id: userId,
    nonce: crypto.randomBytes(12).toString("hex"),
    expires_at: Date.now() + STATE_TTL_MS
  }));
  const signature = signState(payload, clientSecret);
  return `${payload}.${signature}`;
}

function verifyState(state, clientSecret) {
  const [payload, signature] = String(state || "").split(".");

  if (!payload || !signature) {
    throw new Error("invalid Fitbit OAuth state");
  }

  const expectedSignature = signState(payload, clientSecret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("invalid Fitbit OAuth state");
  }

  const parsed = JSON.parse(base64UrlDecode(payload));

  if (!parsed.user_id || !parsed.expires_at || Number(parsed.expires_at) < Date.now()) {
    throw new Error("expired Fitbit OAuth state");
  }

  return Number(parsed.user_id);
}

async function assertUserExists(userId) {
  const user = await dbGet(`SELECT id, login_id FROM users WHERE id = ? LIMIT 1`, [userId]);

  if (!user) {
    throw new Error("user not found");
  }

  return user;
}

async function buildFitbitAuthorizeUrl(userId) {
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error("user_id must be a positive integer");
  }

  await assertUserExists(normalizedUserId);

  const { clientId, clientSecret, redirectUri } = requireFitbitConfig();
  const state = createState(normalizedUserId, clientSecret);
  const url = new URL(FITBIT_AUTHORIZE_URL);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", DEFAULT_SCOPES.join(" "));
  url.searchParams.set("state", state);

  return url.toString();
}

function postFitbitToken(params) {
  const { clientId, clientSecret } = requireFitbitConfig();
  const body = new URLSearchParams(params).toString();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: FITBIT_TOKEN_HOST,
        path: FITBIT_TOKEN_PATH,
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(responseBody);
          } catch (error) {
            return reject(new Error(`Fitbit token response parse failed: ${error.message}`));
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Fitbit token request failed [${res.statusCode}]`));
          }

          return resolve(parsed);
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function tokenExpiresAt(expiresIn) {
  const seconds = Number(expiresIn || 0);
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function saveFitbitAccount(userId, tokenJson) {
  if (!tokenJson?.access_token || !tokenJson?.refresh_token || !tokenJson?.user_id) {
    throw new Error("Fitbit token response is missing required fields");
  }

  const now = new Date().toISOString();
  const expiresAt = tokenExpiresAt(tokenJson.expires_in);

  await dbRun(
    `INSERT INTO fitbit_accounts
       (user_id, fitbit_user_id, access_token, refresh_token, token_expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, fitbit_user_id)
     DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       token_expires_at = excluded.token_expires_at,
       updated_at = excluded.updated_at`,
    [
      userId,
      tokenJson.user_id,
      tokenJson.access_token,
      tokenJson.refresh_token,
      expiresAt,
      now,
      now
    ]
  );

  return getFitbitStatus(userId);
}

async function handleFitbitCallback(query) {
  if (query?.error) {
    throw new Error(`Fitbit authorization failed: ${query.error}`);
  }

  if (!query?.code) {
    throw new Error("Fitbit authorization code is required");
  }

  const { clientSecret, redirectUri } = requireFitbitConfig();
  const userId = verifyState(query.state, clientSecret);
  await assertUserExists(userId);

  const tokenJson = await postFitbitToken({
    grant_type: "authorization_code",
    code: query.code,
    redirect_uri: redirectUri
  });

  return saveFitbitAccount(userId, tokenJson);
}

async function refreshFitbitAccount(account) {
  if (!account?.refresh_token) {
    throw new Error("Fitbit refresh_token is missing");
  }

  const tokenJson = await postFitbitToken({
    grant_type: "refresh_token",
    refresh_token: account.refresh_token
  });

  return saveFitbitAccount(account.user_id, {
    ...tokenJson,
    user_id: tokenJson.user_id || account.fitbit_user_id
  });
}

async function getFitbitStatus(userId) {
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error("user_id must be a positive integer");
  }

  await assertUserExists(normalizedUserId);

  const account = await dbGet(
    `SELECT id, user_id, fitbit_user_id, token_expires_at, created_at, updated_at
     FROM fitbit_accounts
     WHERE user_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [normalizedUserId]
  );

  if (!account) {
    return {
      connected: false,
      user_id: normalizedUserId
    };
  }

  return {
    connected: true,
    user_id: normalizedUserId,
    fitbit_account_id: account.id,
    fitbit_user_id: account.fitbit_user_id,
    token_expires_at: account.token_expires_at,
    token_expired: account.token_expires_at ? Date.parse(account.token_expires_at) <= Date.now() : null,
    created_at: account.created_at,
    updated_at: account.updated_at
  };
}

async function disconnectFitbit(userId) {
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error("user_id must be a positive integer");
  }

  await assertUserExists(normalizedUserId);
  const result = await dbRun(`DELETE FROM fitbit_accounts WHERE user_id = ?`, [normalizedUserId]);

  return {
    user_id: normalizedUserId,
    disconnected: result.changes > 0
  };
}

module.exports = {
  buildFitbitAuthorizeUrl,
  handleFitbitCallback,
  getFitbitStatus,
  disconnectFitbit,
  refreshFitbitAccount
};
