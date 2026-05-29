const crypto = require("crypto");
const https = require("https");
const db = require("../../storage/db/db");
const { requireUserId } = require("../utils/userContext");

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_HOST = "oauth2.googleapis.com";
const GOOGLE_TOKEN_PATH = "/token";
const STATE_TTL_MS = 10 * 60 * 1000;

const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  "https://www.googleapis.com/auth/googlehealth.profile.readonly"
];

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

function requireGoogleHealthConfig() {
  const clientId = String(process.env.GOOGLE_HEALTH_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GOOGLE_HEALTH_CLIENT_SECRET || "").trim();
  const redirectUri = String(process.env.GOOGLE_HEALTH_REDIRECT_URI || "").trim();
  const scopesText = String(process.env.GOOGLE_HEALTH_SCOPES || "").trim();
  const scopes = scopesText ? scopesText.split(/\s+/).filter(Boolean) : DEFAULT_SCOPES;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GOOGLE_HEALTH_CLIENT_ID / GOOGLE_HEALTH_CLIENT_SECRET / GOOGLE_HEALTH_REDIRECT_URI are required"
    );
  }

  if (clientId.length > 256 || clientSecret.length > 512 || redirectUri.length > 2048) {
    throw new Error("Google Health OAuth config is too long");
  }

  if (scopes.length === 0) {
    throw new Error("GOOGLE_HEALTH_SCOPES must include at least one scope");
  }

  let parsedRedirectUri;
  try {
    parsedRedirectUri = new URL(redirectUri);
  } catch (error) {
    throw new Error("GOOGLE_HEALTH_REDIRECT_URI must be a valid URL");
  }

  if (!["http:", "https:"].includes(parsedRedirectUri.protocol)) {
    throw new Error("GOOGLE_HEALTH_REDIRECT_URI must use http or https");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes
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
  const stateValue = String(state || "");

  if (stateValue.length > 2048) {
    throw new Error("invalid Google Health OAuth state");
  }

  const [payload, signature] = stateValue.split(".");

  if (!payload || !signature) {
    throw new Error("invalid Google Health OAuth state");
  }

  const expectedSignature = signState(payload, clientSecret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("invalid Google Health OAuth state");
  }

  const parsed = JSON.parse(base64UrlDecode(payload));

  if (!parsed.user_id || !parsed.expires_at || Number(parsed.expires_at) < Date.now()) {
    throw new Error("expired Google Health OAuth state");
  }

  return Number(parsed.user_id);
}

async function buildGoogleHealthAuthorizeUrl(userId) {
  const normalizedUserId = await requireUserId(userId);
  const { clientId, clientSecret, redirectUri, scopes } = requireGoogleHealthConfig();
  const state = createState(normalizedUserId, clientSecret);
  const url = new URL(GOOGLE_AUTHORIZE_URL);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");

  return url.toString();
}

function postGoogleToken(params) {
  const { clientId, clientSecret } = requireGoogleHealthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    ...params
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: GOOGLE_TOKEN_HOST,
        path: GOOGLE_TOKEN_PATH,
        method: "POST",
        headers: {
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
            return reject(new Error(`Google Health token response parse failed: ${error.message}`));
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Google Health token request failed [${res.statusCode}]`));
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

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("Google Health token response has invalid expires_in");
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function saveGoogleHealthAccount(userId, tokenJson) {
  if (!tokenJson?.access_token) {
    throw new Error("Google Health token response is missing access_token");
  }

  if (
    String(tokenJson.access_token).length > 8192 ||
    String(tokenJson.refresh_token || "").length > 8192 ||
    String(tokenJson.scope || "").length > 4096
  ) {
    throw new Error("Google Health token response field is too long");
  }

  const now = new Date().toISOString();
  const expiresAt = tokenExpiresAt(tokenJson.expires_in);
  const refreshToken = tokenJson.refresh_token || null;
  const scopes = tokenJson.scope || null;

  await dbRun(
    `INSERT INTO google_health_accounts
       (user_id, access_token, refresh_token, token_expires_at, scopes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id)
     DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, google_health_accounts.refresh_token),
       token_expires_at = excluded.token_expires_at,
       scopes = COALESCE(excluded.scopes, google_health_accounts.scopes),
       updated_at = excluded.updated_at`,
    [
      userId,
      tokenJson.access_token,
      refreshToken,
      expiresAt,
      scopes,
      now,
      now
    ]
  );

  return getGoogleHealthStatus(userId);
}

async function handleGoogleHealthCallback(query) {
  if (query?.error) {
    const errorCode = String(query.error).slice(0, 120);
    throw new Error(`Google Health authorization failed: ${errorCode}`);
  }

  const code = String(query?.code || "");

  if (!code) {
    throw new Error("Google Health authorization code is required");
  }

  if (code.length > 4096) {
    throw new Error("Google Health authorization code is too long");
  }

  const { clientSecret, redirectUri } = requireGoogleHealthConfig();
  const userId = verifyState(query.state, clientSecret);
  await requireUserId(userId);

  const tokenJson = await postGoogleToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri
  });

  return saveGoogleHealthAccount(userId, tokenJson);
}

async function refreshGoogleHealthAccount(account) {
  if (!account?.refresh_token) {
    throw new Error("Google Health refresh_token is missing");
  }

  const tokenJson = await postGoogleToken({
    grant_type: "refresh_token",
    refresh_token: account.refresh_token
  });

  return saveGoogleHealthAccount(account.user_id, {
    ...tokenJson,
    refresh_token: account.refresh_token
  });
}

async function getGoogleHealthStatus(userId) {
  const normalizedUserId = await requireUserId(userId);
  const account = await dbGet(
    `SELECT id, user_id, refresh_token, token_expires_at, scopes, created_at, updated_at
     FROM google_health_accounts
     WHERE user_id = ?
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
    google_health_account_id: account.id,
    refresh_available: Boolean(account.refresh_token),
    token_expires_at: account.token_expires_at,
    token_expired: account.token_expires_at ? Date.parse(account.token_expires_at) <= Date.now() : null,
    scopes: account.scopes ? account.scopes.split(/\s+/).filter(Boolean) : [],
    created_at: account.created_at,
    updated_at: account.updated_at
  };
}

async function disconnectGoogleHealth(userId) {
  const normalizedUserId = await requireUserId(userId);
  const result = await dbRun(
    `DELETE FROM google_health_accounts WHERE user_id = ?`,
    [normalizedUserId]
  );

  return {
    user_id: normalizedUserId,
    disconnected: result.changes > 0
  };
}

module.exports = {
  buildGoogleHealthAuthorizeUrl,
  handleGoogleHealthCallback,
  getGoogleHealthStatus,
  disconnectGoogleHealth,
  refreshGoogleHealthAccount
};
