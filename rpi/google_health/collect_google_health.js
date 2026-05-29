'use strict';

/**
 * Google Health API 데이터를 수집해 local SQLite 원천 테이블에 저장한다.
 *
 * 사용법:
 *   node rpi/google_health/collect_google_health.js --mode presleep
 *   node rpi/google_health/collect_google_health.js --mode postsleep
 */

const db = require('../../storage/db/db');
const { kstDateString } = require('../../utils/time');
const { getGoogleHealthAccount } = require('../../service/services/googleHealthAuthService');
const {
  fetchHeartRateDataPoints,
  fetchStepsDataPoints,
  fetchSleepDataPoints,
  fetchTotalCaloriesRollup
} = require('./google_health_client');

const args = process.argv.slice(2);
const modeIdx = args.indexOf('--mode');
const mode = modeIdx !== -1 ? args[modeIdx + 1] : 'presleep';

function argValue(name) {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : null;
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function normalizePositiveInteger(value, fieldName, defaultValue = null) {
  const rawValue = value ?? defaultValue;
  const numberValue = Number(rawValue);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return numberValue;
}

async function resolveGoogleHealthContext(options = {}) {
  const userId = normalizePositiveInteger(options.user_id, 'user_id', 1);
  const googleHealthAccountId = options.google_health_account_id == null
    ? null
    : normalizePositiveInteger(options.google_health_account_id, 'google_health_account_id');
  const account = await getGoogleHealthAccount({
    user_id: userId,
    google_health_account_id: googleHealthAccountId
  });

  if (account.user_id !== userId) {
    throw new Error('google_health_account_id does not belong to user_id');
  }

  return {
    user_id: userId,
    google_health_account_id: account.id,
    googleHealthAccount: account
  };
}

function nowIso() {
  return new Date().toISOString();
}

function toKstIsoLocal(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '');
}

function recentRange(minutes) {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function todayRangeUtc() {
  const date = kstDateString();
  return {
    startIso: `${date}T00:00:00+09:00`,
    endIso: `${date}T23:59:59+09:00`
  };
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

function pointEndTime(point, dataKey) {
  return (
    point?.[dataKey]?.interval?.endTime ||
    point?.[dataKey]?.interval?.end_time ||
    point?.endTime ||
    point?.end_time ||
    null
  );
}

function durationMinutes(startTime, endTime) {
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }

  return Math.round((end - start) / 60000);
}

function sleepDateFromEndTime(endTime) {
  if (!endTime) return kstDateString();
  const date = new Date(endTime);
  if (Number.isNaN(date.getTime())) return String(endTime).slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
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

function extractRollupPoints(payload) {
  return payload?.rollupDataPoints || payload?.rollup_data_points || payload?.dataPoints || [];
}

function normalizeStageName(stage) {
  return String(stage || '').toLowerCase().replace(/[^a-z]/g, '');
}

function collectStageMinutes(sleepPoint) {
  const summary = {
    deep: 0,
    light: 0,
    rem: 0,
    awake: 0
  };
  const stages =
    sleepPoint?.sleep?.stages ||
    sleepPoint?.sleep?.sleepStages ||
    sleepPoint?.sleep?.levels ||
    sleepPoint?.sleep?.stageData ||
    [];

  if (!Array.isArray(stages)) {
    return summary;
  }

  for (const stage of stages) {
    const stageName = normalizeStageName(stage.stage || stage.type || stage.sleepStageType || stage.level);
    const minutes = Number(stage.minutes) || durationMinutes(
      stage?.interval?.startTime || stage?.interval?.start_time || stage.startTime || stage.start_time,
      stage?.interval?.endTime || stage?.interval?.end_time || stage.endTime || stage.end_time
    );

    if (stageName.includes('deep')) summary.deep += minutes;
    else if (stageName.includes('rem')) summary.rem += minutes;
    else if (stageName.includes('awake') || stageName.includes('wake')) summary.awake += minutes;
    else if (stageName.includes('light')) summary.light += minutes;
  }

  return summary;
}

async function saveHeartRaw(context, points) {
  const now = nowIso();
  let saved = 0;

  for (const point of points || []) {
    const ts = pointStartTime(point, 'heartRate');
    const bpm = extractHeartBpm(point);

    if (!ts || !Number.isFinite(bpm)) continue;

    await dbRun(
      `INSERT OR IGNORE INTO google_health_heart
         (user_id, google_health_account_id, ts, bpm, raw_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [context.user_id, context.google_health_account_id, toKstIsoLocal(ts), Math.round(bpm), JSON.stringify(point), now]
    );
    saved += 1;
  }

  console.log(`[collect_google_health] 심박 ${saved}건 저장`);
}

async function saveStepsRaw(context, points) {
  const now = nowIso();
  let saved = 0;

  for (const point of points || []) {
    const ts = pointStartTime(point, 'steps');
    const steps = extractSteps(point);

    if (!ts || !Number.isFinite(steps)) continue;

    await dbRun(
      `INSERT OR IGNORE INTO google_health_steps
         (user_id, google_health_account_id, ts, steps, raw_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [context.user_id, context.google_health_account_id, toKstIsoLocal(ts), Math.round(steps), JSON.stringify(point), now]
    );
    saved += 1;
  }

  console.log(`[collect_google_health] 걸음수 ${saved}건 저장`);
}

async function saveCaloriesRaw(context, payload) {
  const now = nowIso();
  let saved = 0;

  for (const point of extractRollupPoints(payload)) {
    const ts = pointStartTime(point, 'totalCalories') || point.startTime || point.start_time;
    const calories = extractCalories(point);

    if (!ts || !Number.isFinite(calories)) continue;

    await dbRun(
      `INSERT OR IGNORE INTO google_health_calories
         (user_id, google_health_account_id, ts, calories, raw_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [context.user_id, context.google_health_account_id, toKstIsoLocal(ts), calories, JSON.stringify(point), now]
    );
    saved += 1;
  }

  console.log(`[collect_google_health] 칼로리 rollup ${saved}건 저장`);
}

async function saveSleepRaw(context, points) {
  const now = nowIso();
  let saved = 0;

  for (const point of points || []) {
    const startTime = pointStartTime(point, 'sleep');
    const endTime = pointEndTime(point, 'sleep');
    if (!startTime || !endTime) continue;

    const stageMinutes = collectStageMinutes(point);
    const totalMinutes = durationMinutes(startTime, endTime);
    const awakeMinutes = stageMinutes.awake;
    const asleepMinutes = Math.max(0, totalMinutes - awakeMinutes);
    const sleepDate = sleepDateFromEndTime(endTime);

    await dbRun(
      `INSERT OR REPLACE INTO google_health_sleep (
         user_id, google_health_account_id, sleep_date, start_time, end_time,
         minutes_asleep, minutes_awake, deep_minutes, light_minutes, rem_minutes,
         is_main_sleep, raw_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        context.user_id,
        context.google_health_account_id,
        sleepDate,
        toKstIsoLocal(startTime),
        toKstIsoLocal(endTime),
        asleepMinutes,
        awakeMinutes,
        stageMinutes.deep,
        stageMinutes.light,
        stageMinutes.rem,
        JSON.stringify(point),
        now
      ]
    );
    saved += 1;
  }

  console.log(`[collect_google_health] 수면 ${saved}건 저장`);
}

async function collectPresleep(options = {}) {
  console.log('[collect_google_health] 취침 전 수집 시작');
  const context = await resolveGoogleHealthContext(options);
  const { startIso, endIso } = recentRange(60);

  const [heartPoints, stepPoints, caloriesPayload] = await Promise.all([
    fetchHeartRateDataPoints(context.googleHealthAccount, startIso, endIso),
    fetchStepsDataPoints(context.googleHealthAccount, startIso, endIso),
    fetchTotalCaloriesRollup(context.googleHealthAccount, startIso, endIso, '3600s')
  ]);

  await saveHeartRaw(context, heartPoints);
  await saveStepsRaw(context, stepPoints);
  await saveCaloriesRaw(context, caloriesPayload);

  console.log('[collect_google_health] 취침 전 수집 완료');
}

async function collectPostsleep(options = {}) {
  console.log('[collect_google_health] 기상 후 수집 시작');
  const context = await resolveGoogleHealthContext(options);
  const { startIso, endIso } = todayRangeUtc();

  const [heartPoints, stepPoints, caloriesPayload, sleepPoints] = await Promise.all([
    fetchHeartRateDataPoints(context.googleHealthAccount, startIso, endIso),
    fetchStepsDataPoints(context.googleHealthAccount, startIso, endIso),
    fetchTotalCaloriesRollup(context.googleHealthAccount, startIso, endIso, '3600s'),
    fetchSleepDataPoints(context.googleHealthAccount, startIso, endIso)
  ]);

  await saveHeartRaw(context, heartPoints);
  await saveStepsRaw(context, stepPoints);
  await saveCaloriesRaw(context, caloriesPayload);
  await saveSleepRaw(context, sleepPoints);

  console.log('[collect_google_health] 기상 후 수집 완료');
}

module.exports = {
  collectPresleep,
  collectPostsleep,
  resolveGoogleHealthContext,
  saveHeartRaw,
  saveStepsRaw,
  saveCaloriesRaw,
  saveSleepRaw
};

if (require.main === module) {
  const userId = argValue('--user-id') || argValue('--user_id') || 1;
  const googleHealthAccountId = argValue('--google-health-account-id') || argValue('--google_health_account_id');

  if (!['presleep', 'postsleep'].includes(mode)) {
    console.error('--mode는 presleep 또는 postsleep 이어야 합니다.');
    process.exit(1);
  }

  (async () => {
    try {
      if (mode === 'presleep') {
        await collectPresleep({ user_id: userId, google_health_account_id: googleHealthAccountId });
      } else {
        await collectPostsleep({ user_id: userId, google_health_account_id: googleHealthAccountId });
      }
    } catch (error) {
      console.error('[collect_google_health] 오류:', error.message);
      process.exit(1);
    } finally {
      db.close();
    }
  })();
}
