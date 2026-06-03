'use strict';

/**
 * Google Health API response checker.
 *
 * Usage from repository root:
 *   node scripts/check_google_health.js --start 2026-06-01 --end 2026-06-02
 *   node scripts/check_google_health.js --user-id 1 --start 2026-06-01T00:00:00+09:00 --end 2026-06-02T23:59:59+09:00
 *   node scripts/check_google_health.js --user-id 1 --recent-minutes 60
 *   node scripts/check_google_health.js --user-id 1 --start 2026-06-03 --end 2026-06-03 --raw-probe
 *   node scripts/check_google_health.js --user-id 1 --start 2026-06-03 --end 2026-06-03 --raw-probe --raw-probe-pages 10
 *
 * This does not save collected data. It only prints API response counts and one sample per data type.
 */

const {
  fetchHeartRateDataPoints,
  fetchStepsDataPoints,
  fetchSleepDataPoints,
  fetchTotalCaloriesRollup,
  googleHealthApi
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

function toKstIso(date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19) + '+09:00';
}

function defaultRange() {
  const today = kstDateString();
  const yesterday = previousDateString(today);

  return {
    startIso: `${yesterday}T00:00:00+09:00`,
    endIso: `${today}T23:59:59+09:00`
  };
}

function recentRange(minutes) {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);

  return {
    startIso: toKstIso(start),
    endIso: toKstIso(end)
  };
}

function rollupPoints(payload) {
  return payload?.rollupDataPoints || payload?.rollup_data_points || payload?.dataPoints || [];
}

function quoteFilterValue(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
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

function pointStartTime(point, dataKey) {
  return (
    point?.[dataKey]?.sampleTime?.physicalTime ||
    point?.[dataKey]?.sample_time?.physical_time ||
    point?.[dataKey]?.interval?.startTime ||
    point?.[dataKey]?.interval?.start_time ||
    point?.startTime ||
    point?.start_time ||
    null
  );
}

function extractHeartBpm(point) {
  return Number(
    point?.heartRate?.beatsPerMinute ??
    point?.heartRate?.bpm ??
    point?.heart_rate?.beats_per_minute ??
    point?.value?.bpm
  );
}

function extractSteps(point) {
  return Number(
    point?.steps?.count ??
    point?.steps?.countSum ??
    point?.steps?.steps ??
    point?.value?.steps
  );
}

function extractCalories(point) {
  return Number(
    point?.totalCalories?.kcalSum ??
    point?.total_calories?.kcal_sum ??
    point?.calories ??
    point?.value?.calories
  );
}

function summarizeValues(points, extractValue) {
  const values = (points || [])
    .map(extractValue)
    .filter(Number.isFinite);

  const sum = values.reduce((total, value) => total + value, 0);

  return {
    parsed_count: values.length,
    sum: values.length > 0 ? sum : null,
    avg: values.length > 0 ? sum / values.length : null,
    min: values.length > 0 ? Math.min(...values) : null,
    max: values.length > 0 ? Math.max(...values) : null
  };
}

function printCoverage(label, points, dataKey) {
  const starts = (points || [])
    .map((point) => pointStartTime(point, dataKey))
    .filter(Boolean)
    .sort();

  console.log(`${label}:`, {
    first_ts: starts[0] || null,
    last_ts: starts[starts.length - 1] || null
  });
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
      endIso: toKstIso(next)
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

function dataPointsPath(dataType, options = {}) {
  const url = new URL(`/users/me/dataTypes/${encodeURIComponent(dataType)}/dataPoints`, 'https://placeholder.local');
  url.searchParams.set('pageSize', String(options.pageSize || 5));
  if (options.filter) url.searchParams.set('filter', options.filter);
  return `${url.pathname}${url.search}`;
}

function setPageToken(apiPath, pageToken) {
  const url = new URL(apiPath, 'https://placeholder.local');
  url.searchParams.set('pageToken', pageToken);
  return `${url.pathname}${url.search}`;
}

async function printRawApiProbe(label, context, apiPath, maxPages = 1) {
  console.log(`\n[raw-probe] ${label}`);
  console.log(apiPath);

  let currentPath = apiPath;
  let pagesRead = 0;
  let totalDataPoints = 0;

  try {
    do {
      pagesRead += 1;
      const payload = await googleHealthApi('GET', currentPath, context);
      const dataPoints = payload?.dataPoints || payload?.data_points || [];
      const nextPageToken = payload?.nextPageToken || payload?.next_page_token || null;
      const pageCount = Array.isArray(dataPoints) ? dataPoints.length : 0;
      totalDataPoints += pageCount;

      console.log({
        ok: true,
        page: pagesRead,
        keys: Object.keys(payload || {}),
        dataPoints_count: pageCount,
        total_dataPoints_count: totalDataPoints,
        nextPageToken
      });
      console.dir(payload, { depth: 12 });

      if (!nextPageToken || pagesRead >= maxPages) break;
      currentPath = setPageToken(apiPath, nextPageToken);
    } while (true);
  } catch (error) {
    console.log({ ok: false, error: error.message });
  }
}

async function runRawProbe(context, startIso, endIso, maxPages) {
  console.log('\n[check_google_health] raw API probe');

  await printRawApiProbe('dataTypes list', context, '/users/me/dataTypes?pageSize=100', 1);

  const probes = [
    {
      label: 'heart-rate current filter',
      dataType: 'heart-rate',
      filter: physicalSampleFilter('heart_rate', startIso, endIso)
    },
    {
      label: 'heart-rate without filter',
      dataType: 'heart-rate'
    },
    {
      label: 'heart_rate candidate without filter',
      dataType: 'heart_rate'
    },
    {
      label: 'steps current filter',
      dataType: 'steps',
      filter: physicalIntervalFilter('steps', startIso, endIso)
    },
    {
      label: 'steps without filter',
      dataType: 'steps'
    },
    {
      label: 'step candidate without filter',
      dataType: 'step'
    },
    {
      label: 'step-count candidate without filter',
      dataType: 'step-count'
    },
    {
      label: 'sleep current filter',
      dataType: 'sleep',
      filter: sleepEndFilter(startIso, endIso)
    },
    {
      label: 'sleep without filter',
      dataType: 'sleep'
    }
  ];

  for (const probe of probes) {
    await printRawApiProbe(
      probe.label,
      context,
      dataPointsPath(probe.dataType, { filter: probe.filter, pageSize: 5 }),
      maxPages
    );
  }
}

async function main() {
  const userId = Number(argValue('--user-id', argValue('--user_id', '1')));
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('--user-id must be a positive integer');
  }

  const recentMinutesArg = argValue('--recent-minutes', argValue('--recent_minutes'));
  const recentMinutes = recentMinutesArg == null ? null : Number(recentMinutesArg);
  if (recentMinutes != null && (!Number.isFinite(recentMinutes) || recentMinutes <= 0)) {
    throw new Error('--recent-minutes must be a positive number');
  }

  const rawProbePagesArg = argValue('--raw-probe-pages', argValue('--raw_probe_pages', '1'));
  const rawProbePages = Number(rawProbePagesArg);
  if (!Number.isInteger(rawProbePages) || rawProbePages <= 0) {
    throw new Error('--raw-probe-pages must be a positive integer');
  }

  const range = recentMinutes == null
    ? defaultRange()
    : recentRange(recentMinutes);
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

  if (process.argv.includes('--raw-probe')) {
    await runRawProbe(context, startIso, endIso, rawProbePages);
  }

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

  console.log('\n[check_google_health] parsed metrics for query range');
  console.table({
    heart_bpm: summarizeValues(heart, extractHeartBpm),
    steps: summarizeValues(steps, extractSteps),
    calories_kcal: summarizeValues(caloriesPoints, extractCalories)
  });

  console.log('\n[check_google_health] timestamp coverage');
  printCoverage('heart', heart, 'heartRate');
  printCoverage('steps', steps, 'steps');
  printCoverage('calories', caloriesPoints, 'totalCalories');

  printSample('heart', heart[0], 6);
  printSample('steps', steps[0], 6);
  printSample('sleep', sleep[0], 10);
  printSample('calories', caloriesPoints[0], 6);
}

main().catch((error) => {
  console.error('\n[check_google_health] error:', error.message);
  process.exitCode = 1;
});
