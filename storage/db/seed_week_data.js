/**
 * 실행: node storage/db/seed_week_data.js
 * 실제 측정 데이터(2026-04-26 세션) 분포 기반 7일치 검증 시나리오 시딩
 *
 * 기존 seed-demo 데이터와 독립적 (fitbit에는 created_at = "seed-week" 태그)
 * prediction, sleep, feedback은 sleep_date 기준으로 기존 행 교체
 * pattern_profile은 날짜 순서대로 실제 updatePattern 함수 호출하여 생성
 */

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const db = require("./db");
const { computePresleepRisk }              = require("../../processing/prediction/prediction");
const { updatePatternStage1, updatePatternStage2 } = require("../../processing/pattern/pattern_update");

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const SEED_TAG = "seed-week";

// ─────────────────────────────────────────────────────────────
// 7일 시나리오 — 실제 측정값 분포 기반
//
// D-4, D-3: 가스 + 온도 + HR 높음 + 낮은 만족도
//   → env_sensitivity(gas, temp, hr, activity) 학습 기반
// D-2: MEDIUM 예측이지만 실제 수면은 양호 → 예측 miss 1건 포함
// D0:  오늘 (실제 데이터, 수면 결과 없음)
// ─────────────────────────────────────────────────────────────
const SCENARIOS = [
  { dayOffset: -6, hr: 74,   steps: 180, temp: 24.5, humidity: 18, mq5: 0.31,
    sleepMin: 430, deepMin: 85, remMin: 95,  lightMin: 250, awakeMin: 15,
    satisfaction: 78, sleepScore: 82 },

  { dayOffset: -5, hr: 76,   steps: 250, temp: 24.8, humidity: 19, mq5: 0.35,
    sleepMin: 415, deepMin: 80, remMin: 90,  lightMin: 245, awakeMin: 18,
    satisfaction: 72, sleepScore: 79 },

  { dayOffset: -4, hr: 83,   steps: 450, temp: 26.3, humidity: 20, mq5: 0.58,
    sleepMin: 350, deepMin: 45, remMin: 55,  lightMin: 250, awakeMin: 40,
    satisfaction: 38, sleepScore: 52 },

  { dayOffset: -3, hr: 86,   steps: 520, temp: 26.8, humidity: 21, mq5: 0.63,
    sleepMin: 310, deepMin: 35, remMin: 45,  lightMin: 230, awakeMin: 50,
    satisfaction: 32, sleepScore: 45 },

  { dayOffset: -2, hr: 79,   steps: 320, temp: 25.6, humidity: 19, mq5: 0.50,
    sleepMin: 385, deepMin: 65, remMin: 75,  lightMin: 245, awakeMin: 28,
    satisfaction: 58, sleepScore: 70 },

  { dayOffset: -1, hr: 75,   steps: 190, temp: 24.9, humidity: 18, mq5: 0.38,
    sleepMin: 405, deepMin: 78, remMin: 88,  lightMin: 239, awakeMin: 20,
    satisfaction: 68, sleepScore: 76 },

  // 오늘 — 수면 결과 없음 (sleepMin: null)
  { dayOffset: 0,  hr: 78.8, steps: 818, temp: 25.9, humidity: 19, mq5: 0.552,
    sleepMin: null },
];

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// UTC 기준 ISO string (Z 없음) — dayOffset, UTC 시/분/초 지정
function utcTs(dayOffset, utcHour, utcMinute = 0, utcSecond = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(utcHour, utcMinute, utcSecond, 0);
  return d.toISOString().replace("Z", "");
}

// YYYY-MM-DD (UTC 날짜 기준)
function dateStr(dayOffset) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

// 60분치 bpm 배열: avg ± 사인파 노이즈, 클램프 [40, 150]
function buildBpmArray(avg, count = 60) {
  return Array.from({ length: count }, (_, i) =>
    Math.min(150, Math.max(40,
      Math.round(avg + 6 * Math.sin(i * 0.7) + (i % 3 - 1) * 1.5)
    ))
  );
}

// 60분치 steps 배열: 마지막 25분에 total 집중, 합계 = total
function buildStepsArray(total, count = 60) {
  const arr = new Array(count).fill(0);
  if (total <= 0) return arr;
  const active = 25;
  const base = Math.floor(total / active);
  const rem  = total - base * active;
  for (let i = 0; i < active; i++) {
    arr[count - active + i] = base + (i === 0 ? rem : 0);
  }
  return arr;
}

// 5초 간격 720개 센서 행: 값 ± 소량 노이즈
function buildSensorRows(dayOffset, temp, humidity, mq5) {
  // 취침 전 1시간: KST 21:00~22:00 = UTC 12:00~13:00
  const SENSOR_UTC_START_HOUR = 12;
  return Array.from({ length: 720 }, (_, i) => {
    const totalSec = i * 5;
    const ts  = utcTs(dayOffset, SENSOR_UTC_START_HOUR, Math.floor(totalSec / 60), totalSec % 60);
    const t   = Number((temp     + 0.2 * Math.sin(i * 0.3)).toFixed(1));
    const h   = Math.round(humidity + 0.5 * Math.cos(i * 0.5));
    const raw = Math.round(130 + (mq5 - 0.5) * 200 + 2 * Math.sin(i));
    const idx = Number((mq5 + 0.01 * Math.cos(i * 0.4)).toFixed(3));
    return { ts, t, h, raw, idx };
  });
}

// ─────────────────────────────────────────────────────────────
// 시나리오별 시딩
// ─────────────────────────────────────────────────────────────

// 취침 전 피트빗/센서: KST 21:00~22:00 = UTC 12:00~13:00
const PRESLEEP_UTC = 12;

async function seedScenario(sc) {
  const date = dateStr(sc.dayOffset);
  const tag  = sc.dayOffset >= 0 ? `+${sc.dayOffset}` : `${sc.dayOffset}`;
  console.log(`\n  [D${tag}] ${date}`);

  // ── Fitbit heart ──
  const bpms = buildBpmArray(sc.hr);
  for (let i = 0; i < 60; i++) {
    const ts = utcTs(sc.dayOffset, PRESLEEP_UTC, i);
    await dbRun(
      `INSERT OR IGNORE INTO fitbit_heart (ts, bpm, created_at) VALUES (?, ?, ?)`,
      [ts, bpms[i], SEED_TAG]
    );
  }

  // ── Fitbit steps ──
  const stepsArr = buildStepsArray(sc.steps);
  for (let i = 0; i < 60; i++) {
    const ts = utcTs(sc.dayOffset, PRESLEEP_UTC, i);
    await dbRun(
      `INSERT OR IGNORE INTO fitbit_steps (ts, steps, created_at) VALUES (?, ?, ?)`,
      [ts, stepsArr[i], SEED_TAG]
    );
  }

  // ── Sensor raw (720개, 5초 간격) ──
  const sensorRows = buildSensorRows(sc.dayOffset, sc.temp, sc.humidity, sc.mq5);
  for (const row of sensorRows) {
    await dbRun(
      `INSERT INTO sensor_raw (ts, temperature, humidity, mq5_raw, mq5_index, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [row.ts, row.t, row.h, row.raw, row.idx, SEED_TAG]
    );
  }

  // ── Prediction result ──
  const featureSnap = {
    user_id: "user-01",
    avg_hr_1h:        sc.hr,
    steps_sum_1h:     sc.steps,
    avg_temp_1h:      sc.temp,
    avg_humidity_1h:  sc.humidity,
    avg_mq5_index_1h: sc.mq5,
    target_sleep_date: date
  };
  const risk    = computePresleepRisk(featureSnap, null);
  const predTs  = utcTs(sc.dayOffset, PRESLEEP_UTC + 1); // UTC 13:00 = KST 22:00

  await dbRun(`DELETE FROM prediction_result WHERE target_sleep_date = ?`, [date]);
  await dbRun(
    `INSERT INTO prediction_result
       (prediction_ts, target_sleep_date, risk_level, risk_score, reasons_json, action_text, feature_snapshot_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [predTs, date, risk.risk_level, risk.risk_score,
     JSON.stringify(risk.reasons), risk.action_text,
     JSON.stringify(featureSnap), predTs]
  );
  console.log(`    예측: ${risk.risk_level} (${risk.risk_score}점)  이유 ${risk.reasons.length}건`);

  if (sc.sleepMin == null) {
    console.log("    수면 결과 없음 (오늘)");
    return;
  }

  // ── Fitbit sleep ──
  const sleepStartTs = utcTs(sc.dayOffset,     14,  0);  // KST 23:00
  const sleepEndTs   = utcTs(sc.dayOffset + 1,  5,  0);  // 다음날 KST 14:00

  await dbRun(`DELETE FROM fitbit_sleep WHERE sleep_date = ?`, [date]);
  await dbRun(
    `INSERT INTO fitbit_sleep
       (sleep_date, start_time, end_time, minutes_asleep, minutes_awake,
        deep_minutes, light_minutes, rem_minutes, is_main_sleep, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [date, sleepStartTs, sleepEndTs,
     sc.sleepMin, sc.awakeMin, sc.deepMin, sc.lightMin, sc.remMin, sleepStartTs]
  );

  // ── Sleep score ──
  await dbRun(`DELETE FROM sleep_score_result WHERE sleep_date = ?`, [date]);
  await dbRun(
    `INSERT INTO sleep_score_result
       (sleep_date, total_score, time_asleep_score, deep_rem_score, restoration_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [date, sc.sleepScore,
     Number((sc.sleepScore * 0.50).toFixed(1)),
     Number((sc.sleepScore * 0.30).toFixed(1)),
     Number((sc.sleepScore * 0.20).toFixed(1)),
     sleepEndTs]
  );

  // ── User feedback ──
  await dbRun(`DELETE FROM user_feedback WHERE sleep_date = ?`, [date]);
  await dbRun(
    `INSERT INTO user_feedback (sleep_date, satisfaction_score, created_at) VALUES (?, ?, ?)`,
    [date, sc.satisfaction, sleepEndTs]
  );

  // ── Pattern update ──
  await updatePatternStage1(date);
  const stage2 = await updatePatternStage2(date, sc.satisfaction, sc.sleepScore);
  const sensStr = Object.entries(stage2.env_sensitivity)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");
  console.log(`    수면 ${sc.sleepMin}분  만족도 ${sc.satisfaction}  점수 ${sc.sleepScore}`);
  console.log(`    패턴: accuracy=${stage2.pred_accuracy_rate}  gap_trend=${Number(stage2.score_gap_trend).toFixed(1)}  sensitivity=[${sensStr}]`);
}

// ─────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(56));
  console.log(" seed_week_data — 7일 검증 시나리오");
  console.log("=".repeat(56));

  // 기존 seed-week 태그 데이터 클리어
  await dbRun(`DELETE FROM fitbit_heart  WHERE created_at = ?`, [SEED_TAG]);
  await dbRun(`DELETE FROM fitbit_steps  WHERE created_at = ?`, [SEED_TAG]);
  await dbRun(`DELETE FROM sensor_raw    WHERE created_at = ?`, [SEED_TAG]);
  await dbRun(`DELETE FROM pattern_profile`);
  console.log("  기존 seed-week 데이터 클리어 완료");

  for (const sc of SCENARIOS) {
    await seedScenario(sc);
  }

  console.log("\n" + "=".repeat(56));
  console.log(" 완료");
  console.log(" 검증: node processing/validate_realdata.js");
  console.log("=".repeat(56));
}

main()
  .catch(err => { console.error("ERROR:", err.message); process.exitCode = 1; })
  .finally(() => db.close());
