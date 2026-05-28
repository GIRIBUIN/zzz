'use strict';

/**
 * collect_fitbit.js
 *
 * Fitbit API에서 데이터를 수집하고 storage 계층(DB)으로 넘김
 *
 * 사용법:
 *   node rpi/fitbit/collect_fitbit.js --mode presleep   << 취침 전 수집
 *   node rpi/fitbit/collect_fitbit.js --mode postsleep  << 기상 후 수집
 */

const {
  getFitbitAccount,
  fetchHeartIntraday,
  fetchStepsIntraday,
  fetchCaloriesIntraday,
  fetchSleep,
} = require('./fitbit_client');

const db = require('../../storage/db/db');
const { kstDateString } = require('../../utils/time');

// 파ㅏㄹ미터 파싱
const args    = process.argv.slice(2);
const modeIdx = args.indexOf('--mode');
const mode    = modeIdx !== -1 ? args[modeIdx + 1] : 'presleep';

if (!['presleep', 'postsleep'].includes(mode)) {
  console.error('--mode는 presleep 또는 postsleep 이어야 합니다.');
  process.exit(1);
}

// Helper

function argValue(name) {
  const index = args.indexOf(name);
  return index !== -1 ? args[index + 1] : null;
}

function todayStr() {
  return kstDateString(); // YYYY-MM-DD, KST
}

function nowIso() {
  return new Date().toISOString();
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

async function resolveFitbitContext(options = {}) {
  const userId = normalizePositiveInteger(options.user_id, 'user_id', 1);
  const fitbitAccountId = options.fitbit_account_id == null
    ? null
    : normalizePositiveInteger(options.fitbit_account_id, 'fitbit_account_id');
  const account = await getFitbitAccount({
    user_id: userId,
    fitbit_account_id: fitbitAccountId
  });

  if (account.user_id !== userId) {
    throw new Error('fitbit_account_id does not belong to user_id');
  }

  return {
    user_id: userId,
    fitbit_account_id: account.id,
    fitbitAccount: account
  };
}

/**
 * Fitbit intraday 응답의 time 문자열("HH:MM:SS")을 ISO timestamp로 변환
 * 예: "23:45:00" -> "2026-04-25T23:45:00"
 */
function toIsoTs(timeStr) {
  return `${todayStr()}T${timeStr}`;
}

/**
 * 최근 N분 데이터만 슬라이스
 */
function sliceLastMinutes(dataset, minutes) {
  if (!Array.isArray(dataset)) return [];
  return dataset.slice(-minutes);
}

// DB 저장 헬퍼
async function saveHeartRaw(context, heartJson, minutes = null) {
  let series = heartJson?.['activities-heart-intraday']?.dataset ?? [];
  if (series.length === 0) {
    console.warn('[collect_fitbit] 심박 데이터 없음');
    return;
  }
  if (minutes) series = sliceLastMinutes(series, minutes);

  const now = nowIso();

  for (const point of series) {
    await dbRun(
      `INSERT OR IGNORE INTO fitbit_heart (user_id, fitbit_account_id, ts, bpm, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [context.user_id, context.fitbit_account_id, toIsoTs(point.time), point.value, now]
    );
  }

  console.log(`[collect_fitbit] 심박 ${series.length}건 저장`);
}

async function saveStepsRaw(context, stepsJson, minutes = null) {
  let series = stepsJson?.['activities-steps-intraday']?.dataset ?? [];
  if (series.length === 0) {
    console.warn('[collect_fitbit] 걸음수 데이터 없음');
    return;
  }
  if (minutes) series = sliceLastMinutes(series, minutes);

  const now = nowIso();

  for (const point of series) {
    await dbRun(
      `INSERT OR IGNORE INTO fitbit_steps (user_id, fitbit_account_id, ts, steps, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [context.user_id, context.fitbit_account_id, toIsoTs(point.time), point.value, now]
    );
  }

  console.log(`[collect_fitbit] 걸음수 ${series.length}건 저장`);
}

async function saveCaloriesRaw(context, caloriesJson, minutes = null) {
  let series = caloriesJson?.['activities-calories-intraday']?.dataset ?? [];
  if (series.length === 0) {
    console.warn('[collect_fitbit] 칼로리 데이터 없음');
    return;
  }
  if (minutes) series = sliceLastMinutes(series, minutes);

  const now = nowIso();

  for (const point of series) {
    await dbRun(
      `INSERT OR IGNORE INTO fitbit_calories (user_id, fitbit_account_id, ts, calories, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [context.user_id, context.fitbit_account_id, toIsoTs(point.time), point.value, now]
    );
  }

  console.log(`[collect_fitbit] 칼로리 ${series.length}건 저장`);
}

async function saveSleepRaw(context, sleepJson) {
  const mainSleep = (sleepJson?.sleep ?? []).find(s => s.isMainSleep);
  if (!mainSleep) {
    console.warn('[collect_fitbit] 대표 수면(main sleep) 없음 — 아직 수면 전이거나 동기화 안 됨');
    return;
  }

  const levels = mainSleep.levels?.summary ?? {};

  await dbRun(`
    INSERT OR IGNORE INTO fitbit_sleep (
      user_id, fitbit_account_id,
      sleep_date, start_time, end_time,
      minutes_asleep, minutes_awake,
      deep_minutes, light_minutes, rem_minutes,
      is_main_sleep, raw_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `, [
    context.user_id,
    context.fitbit_account_id,
    todayStr(),
    mainSleep.startTime,
    mainSleep.endTime,
    mainSleep.minutesAsleep,
    mainSleep.minutesAwake,
    levels.deep?.minutes  ?? 0,
    levels.light?.minutes ?? 0,
    levels.rem?.minutes   ?? 0,
    JSON.stringify(mainSleep),
    nowIso(),
  ]);

  console.log('[collect_fitbit] 수면 데이터 저장 완료');
}

/**
 * 취침 전 수집
 * - 심박 시계열 (최근 60분)
 * - 걸음수 시계열 (최근 60분)
 */
async function collectPresleep(options = {}) {
  console.log('[collect_fitbit] 취침 전 수집 시작');
  const context = await resolveFitbitContext(options);

  const [heartJson, stepsJson, caloriesJson] = await Promise.all([
    fetchHeartIntraday(context.fitbitAccount),
    fetchStepsIntraday(context.fitbitAccount),
    fetchCaloriesIntraday(context.fitbitAccount),
  ]);

  await saveHeartRaw(context, heartJson, 60);
  await saveStepsRaw(context, stepsJson, 60);
  await saveCaloriesRaw(context, caloriesJson, 60);

  console.log('[collect_fitbit] 취침 전 수집 완료');
}

/**
 * 기상 후 수집
 * - 수면 요약 + 수면 단계
 * - 심박 전체 (수면 중 포함)
 * - 걸음수 전체
 */
async function collectPostsleep(options = {}) {
  console.log('[collect_fitbit] 기상 후 수집 시작');
  const context = await resolveFitbitContext(options);

  const [heartJson, stepsJson, caloriesJson, sleepJson] = await Promise.all([
    fetchHeartIntraday(context.fitbitAccount),
    fetchStepsIntraday(context.fitbitAccount),
    fetchCaloriesIntraday(context.fitbitAccount),
    fetchSleep(context.fitbitAccount),
  ]);

  await saveHeartRaw(context, heartJson);
  await saveStepsRaw(context, stepsJson);
  await saveCaloriesRaw(context, caloriesJson);
  await saveSleepRaw(context, sleepJson);

  console.log('[collect_fitbit] 기상 후 수집 완료');
}

module.exports = {
  collectPresleep,
  collectPostsleep,
  resolveFitbitContext,
  saveHeartRaw,
  saveStepsRaw,
  saveCaloriesRaw,
  saveSleepRaw,
};

// run(터미널에서)
if (require.main === module) {
  const args    = process.argv.slice(2);
  const modeIdx = args.indexOf('--mode');
  const mode    = modeIdx !== -1 ? args[modeIdx + 1] : 'presleep';
  const userId = argValue('--user-id') || argValue('--user_id') || 1;
  const fitbitAccountId = argValue('--fitbit-account-id') || argValue('--fitbit_account_id');
 
  if (!['presleep', 'postsleep'].includes(mode)) {
    console.error('--mode는 presleep 또는 postsleep 이어야 합니다.');
    process.exit(1);
  }
 
  (async () => {
    try {
      if (mode === 'presleep') {
        await collectPresleep({ user_id: userId, fitbit_account_id: fitbitAccountId });
      } else {
        await collectPostsleep({ user_id: userId, fitbit_account_id: fitbitAccountId });
      }
    } catch (err) {
      console.error('[collect_fitbit] 오류:', err.message);
      process.exit(1);
    } finally {
      db.close();
    }
  })();
}
