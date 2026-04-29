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

function todayStr() {
  return kstDateString(); // YYYY-MM-DD, KST
}

function nowIso() {
  return new Date().toISOString();
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
function saveHeartRaw(heartJson, minutes = null) {
  let series = heartJson?.['activities-heart-intraday']?.dataset ?? [];
  if (series.length === 0) {
    console.warn('[collect_fitbit] 심박 데이터 없음');
    return;
  }
  if (minutes) series = sliceLastMinutes(series, minutes);

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO fitbit_heart (ts, bpm, created_at)
    VALUES (?, ?, ?)
  `);

  const now = nowIso();

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    for (const point of series) {
      stmt.run(toIsoTs(point.time), point.value, now);
    }
    db.run('COMMIT');
  });

  stmt.finalize();
  console.log(`[collect_fitbit] 심박 ${series.length}건 저장`);
}

function saveStepsRaw(stepsJson, minutes = null) {
  let series = stepsJson?.['activities-steps-intraday']?.dataset ?? [];
  if (series.length === 0) {
    console.warn('[collect_fitbit] 걸음수 데이터 없음');
    return;
  }
  if (minutes) series = sliceLastMinutes(series, minutes);

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO fitbit_steps (ts, steps, created_at)
    VALUES (?, ?, ?)
  `);

  const now = nowIso();

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    for (const point of series) {
      stmt.run(toIsoTs(point.time), point.value, now);
    }
    db.run('COMMIT');
  });

  stmt.finalize();
  console.log(`[collect_fitbit] 걸음수 ${series.length}건 저장`);
}

function saveCaloriesRaw(caloriesJson, minutes = null) {
  let series = caloriesJson?.['activities-calories-intraday']?.dataset ?? [];
  if (series.length === 0) {
    console.warn('[collect_fitbit] 칼로리 데이터 없음');
    return;
  }
  if (minutes) series = sliceLastMinutes(series, minutes);

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO fitbit_calories (ts, calories, created_at)
    VALUES (?, ?, ?)
  `);

  const now = nowIso();

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    for (const point of series) {
      stmt.run(toIsoTs(point.time), point.value, now);
    }
    db.run('COMMIT');
  });

  stmt.finalize();
  console.log(`[collect_fitbit] 칼로리 ${series.length}건 저장`);
}

function saveSleepRaw(sleepJson) {
  const mainSleep = (sleepJson?.sleep ?? []).find(s => s.isMainSleep);
  if (!mainSleep) {
    console.warn('[collect_fitbit] 대표 수면(main sleep) 없음 — 아직 수면 전이거나 동기화 안 됨');
    return;
  }

  const levels = mainSleep.levels?.summary ?? {};

  db.run(`
    INSERT OR IGNORE INTO fitbit_sleep (
      sleep_date, start_time, end_time,
      minutes_asleep, minutes_awake,
      deep_minutes, light_minutes, rem_minutes,
      is_main_sleep, raw_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `, [
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
  ], (err) => {
    if (err) console.error('[collect_fitbit] 수면 저장 오류:', err.message);
    else     console.log('[collect_fitbit] 수면 데이터 저장 완료');
  });
}

/**
 * 취침 전 수집
 * - 심박 시계열 (최근 60분)
 * - 걸음수 시계열 (최근 60분)
 */
async function collectPresleep() {
  console.log('[collect_fitbit] 취침 전 수집 시작');

  const [heartJson, stepsJson, caloriesJson] = await Promise.all([
    fetchHeartIntraday(),
    fetchStepsIntraday(),
    fetchCaloriesIntraday(),
  ]);

  saveHeartRaw(heartJson, 60);
  saveStepsRaw(stepsJson, 60);
  saveCaloriesRaw(caloriesJson, 60);

  console.log('[collect_fitbit] 취침 전 수집 완료');
}

/**
 * 기상 후 수집
 * - 수면 요약 + 수면 단계
 * - 심박 전체 (수면 중 포함)
 * - 걸음수 전체
 */
async function collectPostsleep() {
  console.log('[collect_fitbit] 기상 후 수집 시작');

  const [heartJson, stepsJson, caloriesJson, sleepJson] = await Promise.all([
    fetchHeartIntraday(),
    fetchStepsIntraday(),
    fetchCaloriesIntraday(),
    fetchSleep(),
  ]);

  saveHeartRaw(heartJson);
  saveStepsRaw(stepsJson);
  saveCaloriesRaw(caloriesJson);
  saveSleepRaw(sleepJson);

  console.log('[collect_fitbit] 기상 후 수집 완료');
}

module.exports = {
  collectPresleep,
  collectPostsleep,
};

// run(터미널에서)
if (require.main === module) {
  const args    = process.argv.slice(2);
  const modeIdx = args.indexOf('--mode');
  const mode    = modeIdx !== -1 ? args[modeIdx + 1] : 'presleep';
 
  if (!['presleep', 'postsleep'].includes(mode)) {
    console.error('--mode는 presleep 또는 postsleep 이어야 합니다.');
    process.exit(1);
  }
 
  (async () => {
    try {
      if (mode === 'presleep') {
        await collectPresleep();
      } else {
        await collectPostsleep();
      }
    } catch (err) {
      console.error('[collect_fitbit] 오류:', err.message);
      process.exit(1);
    } finally {
      db.close();
    }
  })();
}
