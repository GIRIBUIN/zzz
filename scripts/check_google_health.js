'use strict';

/**
 * Google Health API response checker.
 *
 * Usage from repository root:
 *   node scripts/check_google_health.js --start 2026-06-01 --end 2026-06-02
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

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function normalizeStart(value) {
  if (!value) return value;
  return isDateOnly(value) ? `${value}T00:00:00+09:00` : value;
}

function normalizeEnd(value) {
  if (!value) return value;
  return isDateOnly(value) ? `${value}T23:59:59+09:00` : value;
}

function toDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid date/time: ${value}`);
  }
  return date;
}

function toKstIso(date, endOfDay = false) {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  const time = endOfDay ? '23:59:59' : `${formatted.hour}:${formatted.minute}:${formatted.second}`;
  return `${formatted.year}-${formatted.month}-${formatted.day}T${time}+09:00`;
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

function splitRange(startIso, endIso, maxDays) {
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (start >= end) throw new Error('--start must be before --end');

  const ranges = [];
  let cursor = start;
  const maxMs = maxDays * 24 * 60 * 60 * 1000;

  while (cursor < end) {
    const next = new Date(Math.min(cursor.getTime() + maxMs - 1000, end.getTime()));
    ranges.push({
      startIso: toKstIso(cursor),
      endIso: toKstIso(next, next.getTime() === end.getTime() && isDateOnly(argValue('--end')))
    });
    cursor = new Date(next.getTime() + 1000);
  }

  return ranges;
}

async function fetchCaloriesRollupChunked(context, startIso, endIso) {
  const ranges = splitRange(startIso, endIso, 14);
  const chunks = [];

  for (const range of ranges) {
    const payload = await fetchTotalCaloriesRollup(context, range.startIso, range.endIso, '3600s');
    chunks.push(...rollupPoints(payload));
  }

  return chunks;
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
  const startIso = normalizeStart(argValue('--start', range.startIso));
  const endIso = normalizeEnd(argValue('--end', range.endIso));
  const context = { user_id: userId };

  console.log('[check_google_health] status');
  const status = await getGoogleHealthStatus(userId);
  console.dir(status, { depth: 4 });

  if (!status.connected) {
    throw new Error(`Google Health account is not connected for user_id=${userId}`);
  }

  console.log('\n[check_google_health] query range');
  console.dir({ user_id: userId, startIso, endIso });

  const [heart, steps, sleep, caloriesPoints] = await Promise.all([
    fetchHeartRateDataPoints(context, startIso, endIso),
    fetchStepsDataPoints(context, startIso, endIso),
    fetchSleepDataPoints(context, startIso, endIso),
    fetchCaloriesRollupChunked(context, startIso, endIso)
  ]);

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
