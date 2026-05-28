'use strict';

const https = require('https');
const path = require('path');
const dotenv = require('dotenv');
const db = require('../../storage/db/db');
const { kstDateString } = require('../../utils/time');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const FITBIT_TOKEN_HOST = 'api.fitbit.com';
const FITBIT_TOKEN_PATH = '/oauth2/token';
const DEFAULT_USER_ID = 1;
const refreshPromises = new Map();

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function requireFitbitConfig() {
  const clientId = String(process.env.FITBIT_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.FITBIT_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET are required');
  }

  return { clientId, clientSecret };
}

function normalizeContext(context = {}) {
  if (context.access_token && context.refresh_token && context.fitbit_user_id) {
    return context;
  }

  const userId = Number(context.user_id ?? DEFAULT_USER_ID);
  const fitbitAccountId = context.fitbit_account_id == null
    ? null
    : Number(context.fitbit_account_id);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('user_id must be a positive integer');
  }

  if (fitbitAccountId !== null && (!Number.isInteger(fitbitAccountId) || fitbitAccountId <= 0)) {
    throw new Error('fitbit_account_id must be a positive integer');
  }

  return {
    user_id: userId,
    fitbit_account_id: fitbitAccountId
  };
}

async function getFitbitAccount(context = {}) {
  const normalized = normalizeContext(context);

  if (normalized.access_token && normalized.refresh_token && normalized.fitbit_user_id) {
    return normalized;
  }

  const params = [normalized.user_id];
  let where = 'user_id = ?';

  if (normalized.fitbit_account_id !== null) {
    where += ' AND id = ?';
    params.push(normalized.fitbit_account_id);
  }

  const account = await dbGet(
    `SELECT id, user_id, fitbit_user_id, access_token, refresh_token, token_expires_at
     FROM fitbit_accounts
     WHERE ${where}
     ORDER BY updated_at DESC
     LIMIT 1`,
    params
  );

  if (!account) {
    throw new Error('Fitbit account not connected for user');
  }

  return account;
}

function postFitbitToken(params) {
  const { clientId, clientSecret } = requireFitbitConfig();
  const body = new URLSearchParams(params).toString();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: FITBIT_TOKEN_HOST,
        path: FITBIT_TOKEN_PATH,
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
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

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function tokenExpiresAt(expiresIn) {
  const seconds = Number(expiresIn || 0);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('Fitbit token response has invalid expires_in');
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function refreshAccessToken(context = {}) {
  const account = await getFitbitAccount(context);
  const tokenJson = await postFitbitToken({
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token
  });

  if (!tokenJson?.access_token || !tokenJson?.refresh_token) {
    throw new Error('Fitbit token response is missing required fields');
  }

  const now = new Date().toISOString();
  const updated = {
    ...account,
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    token_expires_at: tokenExpiresAt(tokenJson.expires_in),
    fitbit_user_id: tokenJson.user_id || account.fitbit_user_id
  };

  await dbRun(
    `UPDATE fitbit_accounts
     SET fitbit_user_id = ?, access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      updated.fitbit_user_id,
      updated.access_token,
      updated.refresh_token,
      updated.token_expires_at,
      now,
      account.id,
      account.user_id
    ]
  );

  console.log('[fitbit_client] Access Token 갱신 완료');
  return updated;
}

async function refreshAccessTokenOnce(context = {}) {
  const account = await getFitbitAccount(context);
  const key = account.id;

  if (!refreshPromises.has(key)) {
    refreshPromises.set(
      key,
      refreshAccessToken(account).finally(() => {
        refreshPromises.delete(key);
      })
    );
  }

  return refreshPromises.get(key);
}

function isTokenExpired(account) {
  if (!account?.token_expires_at) {
    return false;
  }

  return Date.parse(account.token_expires_at) <= Date.now() + 60 * 1000;
}

async function fitbitGet(apiPath, context = {}, retry = true) {
  let account = await getFitbitAccount(context);

  if (retry && isTokenExpired(account)) {
    console.log('[fitbit_client] 토큰 만료 시각 도달 -> 토큰 갱신 시도');
    account = await refreshAccessTokenOnce(account);
  }

  const data = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.fitbit.com',
      path: apiPath,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        'Accept-Language': 'en_US'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', reject);
    req.end();
  });

  if (data.statusCode === 401 && retry) {
    console.log('[fitbit_client] 401 감지 -> 토큰 갱신 시도');
    const refreshedAccount = await refreshAccessTokenOnce(account);
    return fitbitGet(apiPath, refreshedAccount, false);
  }

  if (data.statusCode !== 200) {
    throw new Error(`Fitbit API 오류 [${data.statusCode}]: ${data.body}`);
  }

  return JSON.parse(data.body);
}

async function userPath(context) {
  const account = await getFitbitAccount(context);
  return encodeURIComponent(account.fitbit_user_id || '-');
}

async function fetchHeartIntraday(context = {}) {
  const fitbitUserId = await userPath(context);
  return fitbitGet(`/1/user/${fitbitUserId}/activities/heart/date/today/1d/1min.json`, context);
}

async function fetchStepsIntraday(context = {}) {
  const fitbitUserId = await userPath(context);
  return fitbitGet(`/1/user/${fitbitUserId}/activities/steps/date/today/1d/1min.json`, context);
}

async function fetchCaloriesIntraday(context = {}) {
  const fitbitUserId = await userPath(context);
  return fitbitGet(`/1/user/${fitbitUserId}/activities/calories/date/today/1d/1min.json`, context);
}

async function fetchSleep(context = {}) {
  const today = kstDateString();
  const fitbitUserId = await userPath(context);
  return fitbitGet(`/1.2/user/${fitbitUserId}/sleep/date/${today}.json`, context);
}

async function fetchActivitySummary(context = {}) {
  const fitbitUserId = await userPath(context);
  return fitbitGet(`/1/user/${fitbitUserId}/activities/date/today.json`, context);
}

module.exports = {
  getFitbitAccount,
  fetchHeartIntraday,
  fetchStepsIntraday,
  fetchCaloriesIntraday,
  fetchSleep,
  fetchActivitySummary,
  refreshAccessToken
};
