'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// .env 로드
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env 파일이 없어요~~');
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

/**
 * Refresh Token으로 새 Access Token 발급
 * 성공하면 .env 파일도 자동으로 업데이트
 */
function refreshAccessToken() {
  return new Promise((resolve, reject) => {
    const clientId     = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    const refreshToken = process.env.FITBIT_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return reject(new Error('FITBIT_CLIENT_ID / FITBIT_CLIENT_SECRET / FITBIT_REFRESH_TOKEN가 .env에 없습니다.'));
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body        = `grant_type=refresh_token&refresh_token=${refreshToken}`;

    const options = {
      hostname: 'api.fitbit.com',
      path:     '/oauth2/token',
      method:   'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.errors) {
            return reject(new Error(`토큰 갱신 실패: ${JSON.stringify(json.errors)}`));
          }
          // .env 업데이트
          updateEnvTokens(json.access_token, json.refresh_token);
          process.env.FITBIT_ACCESS_TOKEN  = json.access_token;
          process.env.FITBIT_REFRESH_TOKEN = json.refresh_token;
          console.log('[fitbit_client] Access Token 갱신 완료');
          resolve(json.access_token);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * .env 파일에서 토큰 두 줄만 교체
 */
function updateEnvTokens(newAccessToken, newRefreshToken) {
  const envPath = path.resolve(__dirname, '../../.env');
  let content = fs.readFileSync(envPath, 'utf-8');
  content = content.replace(/^FITBIT_ACCESS_TOKEN=.*/m,  `FITBIT_ACCESS_TOKEN=${newAccessToken}`);
  content = content.replace(/^FITBIT_REFRESH_TOKEN=.*/m, `FITBIT_REFRESH_TOKEN=${newRefreshToken}`);
  fs.writeFileSync(envPath, content, 'utf-8');
}

/**
 * Fitbit API GET 요청
 * 401(토큰 만료) 시 자동으로 한 번 갱신 후 재시도
 */
async function fitbitGet(apiPath, retry = true) {
  const accessToken = process.env.FITBIT_ACCESS_TOKEN;

  const data = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.fitbit.com',
      path:     apiPath,
      method:   'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept-Language': 'en_US',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', reject);
    req.end();
  });

  // 401: 토큰 만료 → 갱신 후 재시도 (1회만)
  if (data.statusCode === 401 && retry) {
    console.log('[fitbit_client] 401 감지 → 토큰 갱신 시도');
    await refreshAccessToken();
    return fitbitGet(apiPath, false);
  }

  if (data.statusCode !== 200) {
    throw new Error(`Fitbit API 오류 [${data.statusCode}]: ${data.body}`);
  }

  return JSON.parse(data.body);
}

// 데이터수집 함수

const USER_ID = process.env.FITBIT_USER_ID || '-';

/**
 * 심박 시계열 (1분 단위, 오늘)
 */
function fetchHeartIntraday() {
  return fitbitGet(`/1/user/${USER_ID}/activities/heart/date/today/1d/1min.json`);
}

/**
 * 걸음수 시계열 (1분 단위, 오늘)
 */
function fetchStepsIntraday() {
  return fitbitGet(`/1/user/${USER_ID}/activities/steps/date/today/1d/1min.json`);
}

/**
 * 수면 요약 + 수면 단계 (오늘)
 */
function fetchSleep() {
  const today = new Date().toISOString().slice(0, 10);
  return fitbitGet(`/1.2/user/${USER_ID}/sleep/date/${today}.json`);
}

/**
 * 일별 활동 요약 (걸음수, 칼로리 등)
 */
function fetchActivitySummary() {
  return fitbitGet(`/1/user/${USER_ID}/activities/date/today.json`);
}

// exports

module.exports = {
  fetchHeartIntraday,
  fetchStepsIntraday,
  fetchSleep,
  fetchActivitySummary,
  refreshAccessToken,
};