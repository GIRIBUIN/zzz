/**
 * 실행: node storage/db/seed_demo_data.js
 * 시연용 7일 데이터 시딩
 *
 * D-6 ~ D-1: 과거 수면 결과, 만족도, 사후 분석, 패턴 학습 데이터 포함
 * D0: 오늘 취침 전 예측 시연용 최근 1시간 Fitbit/RPi 데이터만 포함
 */

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const db = require("./db");
const { computePresleepRisk } = require("../../processing/prediction/prediction");
const { updatePatternStage1, updatePatternStage2 } = require("../../processing/pattern/pattern_update");
const { analyzePostSleep } = require("../../processing/analysis/post_analysis");

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DEMO_TAG = "demo-seed";

const SCENARIOS = [
  { dayOffset: -6, hr: 74, steps: 180, calories: 95, temp: 24.5, humidity: 18, mq5: 0.31,
    sleepMin: 430, deepMin: 85, remMin: 95, lightMin: 250, awakeMin: 15,
    satisfaction: 78, sleepScore: 82 },
  { dayOffset: -5, hr: 76, steps: 250, calories: 120, temp: 24.8, humidity: 19, mq5: 0.35,
    sleepMin: 415, deepMin: 80, remMin: 90, lightMin: 245, awakeMin: 18,
    satisfaction: 72, sleepScore: 79 },
  { dayOffset: -4, hr: 83, steps: 450, calories: 230, temp: 26.3, humidity: 20, mq5: 0.58,
    sleepMin: 350, deepMin: 45, remMin: 55, lightMin: 250, awakeMin: 40,
    satisfaction: 38, sleepScore: 52 },
  { dayOffset: -3, hr: 86, steps: 520, calories: 260, temp: 26.8, humidity: 21, mq5: 0.63,
    sleepMin: 310, deepMin: 35, remMin: 45, lightMin: 230, awakeMin: 50,
    satisfaction: 32, sleepScore: 45 },
  { dayOffset: -2, hr: 79, steps: 320, calories: 185, temp: 25.6, humidity: 19, mq5: 0.50,
    sleepMin: 385, deepMin: 65, remMin: 75, lightMin: 245, awakeMin: 28,
    satisfaction: 58, sleepScore: 70 },
  { dayOffset: -1, hr: 75, steps: 190, calories: 105, temp: 24.9, humidity: 18, mq5: 0.38,
    sleepMin: 405, deepMin: 78, remMin: 88, lightMin: 239, awakeMin: 20,
    satisfaction: 68, sleepScore: 76 },
  { dayOffset: 0, hr: 78.8, steps: 818, calories: 240, temp: 25.9, humidity: 19, mq5: 0.552,
    sleepMin: null }
];

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dateStr(dayOffset) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

function utcTs(dayOffset, utcHour, utcMinute = 0, utcSecond = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(utcHour, utcMinute, utcSecond, 0);
  return d.toISOString().replace("Z", "");
}

function recentMinuteTs(index, count = 60) {
  const latest = new Date(Date.now() + KST_OFFSET_MS);
  latest.setUTCSeconds(0, 0);
  latest.setUTCMinutes(latest.getUTCMinutes() - (count - 1 - index));
  return latest.toISOString().replace("Z", "");
}

function recentFiveSecondTs(index, count = 720) {
  const latest = new Date(Date.now() + KST_OFFSET_MS);
  latest.setUTCMilliseconds(0);
  latest.setUTCSeconds(latest.getUTCSeconds() - (count - 1 - index) * 5);
  return latest.toISOString().replace("Z", "");
}

function presleepMinuteTs(dayOffset, index) {
  if (dayOffset === 0) return recentMinuteTs(index);
  return utcTs(dayOffset, 12, index);
}

function predictionTs(dayOffset) {
  if (dayOffset === 0) return recentMinuteTs(59);
  return utcTs(dayOffset, 13);
}

function buildBpmArray(avg, count = 60) {
  return Array.from({ length: count }, (_, i) =>
    Math.min(150, Math.max(40, Math.round(avg + 6 * Math.sin(i * 0.7) + (i % 3 - 1) * 1.5)))
  );
}

function buildStepsArray(total, count = 60) {
  const arr = new Array(count).fill(0);
  if (total <= 0) return arr;
  const active = 25;
  const base = Math.floor(total / active);
  const rem = total - base * active;
  for (let i = 0; i < active; i += 1) {
    arr[count - active + i] = base + (i === 0 ? rem : 0);
  }
  return arr;
}

function buildCaloriesArray(total, count = 60) {
  const arr = new Array(count).fill(0);
  if (total <= 0) return arr;
  const active = 30;
  const base = Number((total / active).toFixed(2));
  for (let i = 0; i < active; i += 1) {
    arr[count - active + i] = base;
  }
  const diff = Number((total - arr.reduce((sum, value) => sum + value, 0)).toFixed(2));
  arr[count - 1] = Number((arr[count - 1] + diff).toFixed(2));
  return arr;
}

function buildSensorRows(dayOffset, temp, humidity, mq5) {
  return Array.from({ length: 720 }, (_, i) => {
    const totalSec = i * 5;
    const ts = dayOffset === 0
      ? recentFiveSecondTs(i)
      : utcTs(dayOffset, 12, Math.floor(totalSec / 60), totalSec % 60);
    return {
      ts,
      temperature: Number((temp + 0.2 * Math.sin(i * 0.3)).toFixed(1)),
      humidity: Math.round(humidity + 0.5 * Math.cos(i * 0.5)),
      mq5_raw: Math.round(130 + (mq5 - 0.5) * 200 + 2 * Math.sin(i)),
      mq5_index: Number((mq5 + 0.01 * Math.cos(i * 0.4)).toFixed(3))
    };
  });
}

async function clearDemoData() {
  await dbRun(`DELETE FROM fitbit_heart WHERE created_at = ?`, [DEMO_TAG]);
  await dbRun(`DELETE FROM fitbit_steps WHERE created_at = ?`, [DEMO_TAG]);
  await dbRun(`DELETE FROM fitbit_calories WHERE created_at = ?`, [DEMO_TAG]);
  await dbRun(`DELETE FROM sensor_raw WHERE created_at = ?`, [DEMO_TAG]);
  await dbRun(`DELETE FROM pattern_profile`);

  for (const sc of SCENARIOS) {
    const date = dateStr(sc.dayOffset);
    await dbRun(`DELETE FROM prediction_result WHERE target_sleep_date = ?`, [date]);
    await dbRun(`DELETE FROM fitbit_sleep WHERE sleep_date = ?`, [date]);
    await dbRun(`DELETE FROM sleep_score_result WHERE sleep_date = ?`, [date]);
    await dbRun(`DELETE FROM user_feedback WHERE sleep_date = ?`, [date]);
    await dbRun(`DELETE FROM post_analysis_result WHERE sleep_date = ?`, [date]);
  }
}

async function seedIntraday(sc) {
  const bpms = buildBpmArray(sc.hr);
  const steps = buildStepsArray(sc.steps);
  const calories = buildCaloriesArray(sc.calories);

  for (let i = 0; i < 60; i += 1) {
    const ts = presleepMinuteTs(sc.dayOffset, i);
    await dbRun(`INSERT OR REPLACE INTO fitbit_heart (ts, bpm, created_at) VALUES (?, ?, ?)`, [ts, bpms[i], DEMO_TAG]);
    await dbRun(`INSERT OR REPLACE INTO fitbit_steps (ts, steps, created_at) VALUES (?, ?, ?)`, [ts, steps[i], DEMO_TAG]);
    await dbRun(`INSERT OR REPLACE INTO fitbit_calories (ts, calories, created_at) VALUES (?, ?, ?)`, [ts, calories[i], DEMO_TAG]);
  }

  for (const row of buildSensorRows(sc.dayOffset, sc.temp, sc.humidity, sc.mq5)) {
    await dbRun(
      `INSERT INTO sensor_raw (ts, temperature, humidity, mq5_raw, mq5_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.ts, row.temperature, row.humidity, row.mq5_raw, row.mq5_index, DEMO_TAG]
    );
  }
}

async function seedScenario(sc) {
  const date = dateStr(sc.dayOffset);
  const tag = sc.dayOffset >= 0 ? `+${sc.dayOffset}` : `${sc.dayOffset}`;
  console.log(`\n  [D${tag}] ${date}`);

  await seedIntraday(sc);

  const featureSnap = {
    user_id: "user-01",
    avg_hr_1h: sc.hr,
    steps_sum_1h: sc.steps,
    calories_sum_1h: sc.calories,
    avg_temp_1h: sc.temp,
    avg_humidity_1h: sc.humidity,
    avg_mq5_index_1h: sc.mq5,
    target_sleep_date: date
  };
  const risk = computePresleepRisk(featureSnap, null);
  const predTs = predictionTs(sc.dayOffset);

  await dbRun(
    `INSERT INTO prediction_result
       (prediction_ts, target_sleep_date, risk_level, risk_score, reasons_json, action_text, feature_snapshot_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [predTs, date, risk.risk_level, risk.risk_score, JSON.stringify(risk.reasons),
      risk.action_text, JSON.stringify(featureSnap), predTs]
  );
  console.log(`    예측: ${risk.risk_level} (${risk.risk_score}점)  이유 ${risk.reasons.length}건`);

  if (sc.sleepMin == null) {
    console.log("    수면 결과 없음 (오늘)");
    return;
  }

  const sleepStartTs = utcTs(sc.dayOffset, 14);
  const sleepEndTs = utcTs(sc.dayOffset + 1, 5);
  const sleepRow = {
    minutes_asleep: sc.sleepMin,
    minutes_awake: sc.awakeMin,
    deep_minutes: sc.deepMin,
    light_minutes: sc.lightMin,
    rem_minutes: sc.remMin
  };

  await dbRun(
    `INSERT INTO fitbit_sleep
       (sleep_date, start_time, end_time, minutes_asleep, minutes_awake,
        deep_minutes, light_minutes, rem_minutes, is_main_sleep, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [date, sleepStartTs, sleepEndTs, sc.sleepMin, sc.awakeMin, sc.deepMin, sc.lightMin, sc.remMin, sleepStartTs]
  );

  await dbRun(
    `INSERT INTO sleep_score_result
       (sleep_date, total_score, time_asleep_score, deep_rem_score, restoration_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [date, sc.sleepScore, Number((sc.sleepScore * 0.50).toFixed(1)),
      Number((sc.sleepScore * 0.30).toFixed(1)), Number((sc.sleepScore * 0.20).toFixed(1)), sleepEndTs]
  );

  await dbRun(
    `INSERT INTO user_feedback (sleep_date, satisfaction_score, created_at) VALUES (?, ?, ?)`,
    [date, sc.satisfaction, sleepEndTs]
  );

  await updatePatternStage1(date);
  const stage2 = await updatePatternStage2(date, sc.satisfaction, sc.sleepScore);
  const analysis = analyzePostSleep({
    sleepRow,
    scoreResult: { total_score: sc.sleepScore },
    featureSnapshot: featureSnap,
    satisfactionScore: sc.satisfaction,
    patternProfile: { score_gap_trend: stage2.score_gap_trend }
  });
  const analysisText = analysis.score_gap_note
    ? `${analysis.analysis_text} ${analysis.score_gap_note}`
    : analysis.analysis_text;

  await dbRun(
    `INSERT INTO post_analysis_result (sleep_date, causes_json, analysis_text, created_at)
     VALUES (?, ?, ?, ?)`,
    [date, analysis.causes_json, analysisText, sleepEndTs]
  );

  const sensStr = Object.entries(stage2.env_sensitivity)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key}:${value}`)
    .join(" ");
  console.log(`    수면 ${sc.sleepMin}분  만족도 ${sc.satisfaction}  점수 ${sc.sleepScore}`);
  console.log(`    패턴: accuracy=${stage2.pred_accuracy_rate}  gap_trend=${Number(stage2.score_gap_trend).toFixed(1)}  sensitivity=[${sensStr}]`);
}

async function main() {
  console.log("=".repeat(56));
  console.log(" seed_demo_data - 7일 시연 데이터");
  console.log("=".repeat(56));

  await dbRun(`BEGIN TRANSACTION`);
  try {
    await clearDemoData();
    console.log("  기존 demo seed 데이터 클리어 완료");

    for (const sc of SCENARIOS) {
      await seedScenario(sc);
    }

    await dbRun(`COMMIT`);
  } catch (error) {
    await dbRun(`ROLLBACK`);
    throw error;
  }

  console.log("\n" + "=".repeat(56));
  console.log(" 완료");
  console.log(" 검증: node processing/validate_realdata.js");
  console.log("=".repeat(56));
}

main()
  .catch((error) => {
    console.error("Failed to seed demo data:", error.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
