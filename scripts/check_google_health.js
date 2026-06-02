'use strict';

/**
 * Google Health API response checker.
 *
 * Usage from repository root:
 *   node scripts/check_google_health.js --user-id 1 --start 2026-06-01T00:00:00+09:00 --end 2026-06-02T23:59:59+09:00
 *
 * This does not save collected data. It only prints API response counts and one sample per data type.
 */

const {
  fetchHeartRateDataPoints,
  fetchStepsDataPoints,
  fetchSleepDataPoints,
  fetchTotalCaloriesRollup
} = require('../rpi/google_health/google_health_client');
const {
  getGoogleHealthStatus
} = require('../service/services/googleHealthAuthService');

function argValue(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function kstDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function previousDateString(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function defaultRange() {
  const today = kstDateString();
  const yesterday = previousDateString(today);

  return {
    startIso: `${yesterday}T00:00:00+09:00`,
    endIso: `${today}T23:59:59+09:00`
  };
}

function rollupPoints(payload) {
  return payload?.rollupDataPoints || payload?.rollup_data_points || payload?.dataPoints || [];
}

function printSample(label, value, depth = 8) {
  console.log(`\n${label} sample:`);
  console.dir(value || null, { depth });
}

async function main() {
  const userId = Number(argValue('--user-id', argValue('--user_id', '1')));
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('--user-id must be a positive integer');
  }

  const range = defaultRange();
  const startIso = argValue('--start', range.startIso);
  const endIso = argValue('--end', range.endIso);
  const context = { user_id: userId };

  console.log('[check_google_health] status');
  const status = await getGoogleHealthStatus(userId);
  console.dir(status, { depth: 4 });

  if (!status.connected) {
    throw new Error(`Google Health account is not connected for user_id=${userId}`);
  }

  console.log('\n[check_google_health] query range');
  console.dir({ user_id: userId, startIso, endIso });

  const [heart, steps, sleep, calories] = await Promise.all([
    fetchHeartRateDataPoints(context, startIso, endIso),
    fetchStepsDataPoints(context, startIso, endIso),
    fetchSleepDataPoints(context, startIso, endIso),
    fetchTotalCaloriesRollup(context, startIso, endIso, '3600s')
  ]);

  const caloriesPoints = rollupPoints(calories);

  console.log('\n[check_google_health] counts');
  console.table({
    heart: { count: heart.length },
    steps: { count: steps.length },
    sleep: { count: sleep.length },
    calories_rollup: { count: caloriesPoints.length }
  });

  printSample('heart', heart[0], 6);
  printSample('steps', steps[0], 6);
  printSample('sleep', sleep[0], 10);
  printSample('calories', caloriesPoints[0], 6);
}

main().catch((error) => {
  console.error('\n[check_google_health] error:', error.message);
  process.exitCode = 1;
});
