'use strict';

const https = require('https');
const {
  getGoogleHealthAccount,
  refreshGoogleHealthAccount
} = require('../../service/services/googleHealthAuthService');

const GOOGLE_HEALTH_HOST = 'health.googleapis.com';
const API_PREFIX = '/v4';
const refreshPromises = new Map();

function isTokenExpired(account) {
  if (!account?.token_expires_at) {
    return false;
  }

  return Date.parse(account.token_expires_at) <= Date.now() + 60 * 1000;
}

async function refreshAccessTokenOnce(account) {
  const key = account.id;

  if (!refreshPromises.has(key)) {
    refreshPromises.set(
      key,
      refreshGoogleHealthAccount(account).finally(() => {
        refreshPromises.delete(key);
      })
    );
  }

  const status = await refreshPromises.get(key);
  return getGoogleHealthAccount({
    user_id: status.user_id,
    google_health_account_id: status.google_health_account_id
  });
}

function googleHealthRequest(method, apiPath, account, body = null) {
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: GOOGLE_HEALTH_HOST,
        path: `${API_PREFIX}${apiPath}`,
        method,
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
              }
            : {})
        }
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          let parsed = {};
          if (responseBody) {
            try {
              parsed = JSON.parse(responseBody);
            } catch (error) {
              return reject(new Error(`Google Health response parse failed: ${error.message}`));
            }
          }

          return resolve({
            statusCode: res.statusCode,
            body: parsed
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function googleHealthApi(method, apiPath, context = {}, body = null, retry = true) {
  let account = await getGoogleHealthAccount(context);

  if (retry && isTokenExpired(account)) {
    account = await refreshAccessTokenOnce(account);
  }

  const response = await googleHealthRequest(method, apiPath, account, body);

  if (response.statusCode === 401 && retry) {
    const refreshedAccount = await refreshAccessTokenOnce(account);
    return googleHealthApi(method, apiPath, refreshedAccount, body, false);
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Google Health API error [${response.statusCode}]: ${JSON.stringify(response.body)}`);
  }

  return response.body;
}

function quoteFilterValue(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

async function listDataPoints(dataType, filter, context = {}, pageSize = 1000) {
  const points = [];
  let pageToken = null;

  do {
    const url = new URL(`/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints`, 'https://placeholder.local');
    url.searchParams.set('filter', filter);
    url.searchParams.set('pageSize', String(pageSize));
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const payload = await googleHealthApi('GET', `${url.pathname}${url.search}`, context);
    points.push(...(payload.dataPoints || []));
    pageToken = payload.nextPageToken || payload.next_page_token || null;
  } while (pageToken);

  return points;
}

function physicalIntervalFilter(dataTypeField, startIso, endIso) {
  return [
    `${dataTypeField}.interval.start_time >= ${quoteFilterValue(startIso)}`,
    `${dataTypeField}.interval.start_time < ${quoteFilterValue(endIso)}`
  ].join(' AND ');
}

function physicalSampleFilter(dataTypeField, startIso, endIso) {
  return [
    `${dataTypeField}.sample_time.physical_time >= ${quoteFilterValue(startIso)}`,
    `${dataTypeField}.sample_time.physical_time < ${quoteFilterValue(endIso)}`
  ].join(' AND ');
}

function sleepEndFilter(startIso, endIso) {
  return [
    `sleep.interval.end_time >= ${quoteFilterValue(startIso)}`,
    `sleep.interval.end_time < ${quoteFilterValue(endIso)}`
  ].join(' AND ');
}

async function fetchHeartRateDataPoints(context = {}, startIso, endIso) {
  return listDataPoints('heart-rate', physicalSampleFilter('heart_rate', startIso, endIso), context);
}

async function fetchStepsDataPoints(context = {}, startIso, endIso) {
  return listDataPoints('steps', physicalIntervalFilter('steps', startIso, endIso), context);
}

async function fetchSleepDataPoints(context = {}, startIso, endIso) {
  return listDataPoints('sleep', sleepEndFilter(startIso, endIso), context, 25);
}

async function fetchTotalCaloriesRollup(context = {}, startIso, endIso, windowSize = '3600s') {
  return googleHealthApi(
    'POST',
    '/users/me/dataTypes/total-calories/dataPoints:rollUp',
    context,
    {
      range: {
        startTime: startIso,
        endTime: endIso
      },
      windowSize
    }
  );
}

module.exports = {
  fetchHeartRateDataPoints,
  fetchStepsDataPoints,
  fetchSleepDataPoints,
  fetchTotalCaloriesRollup,
  googleHealthApi
};
