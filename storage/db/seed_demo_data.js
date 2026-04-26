const path = require("path");
const dotenv = require("dotenv");
const sqlite3 = require("sqlite3").verbose();

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const db = require("./db");
const sourceDbPath = path.join(__dirname, "zzz-seed.db");
const sensorCsvPath = path.join(__dirname, "sensor_sequence_1hour_5sec.csv");
const DEMO_FITBIT_CREATED_AT = "demo-seed-fitbit";
const DEMO_SENSOR_CREATED_AT = "demo-seed-sensor";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function allFromSource(sourceDb, query, params = []) {
  return new Promise((resolve, reject) => {
    sourceDb.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function buildRecentDates(days) {
  const dates = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    dates.push(date);
  }

  return dates;
}

async function seedSleepScores(dates) {
  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    const sleepDate = date.toISOString().slice(0, 10);
    const createdAt = new Date(date);
    createdAt.setUTCHours(22, 15, 0, 0);

    const timeAsleepScore = 31 + index * 2.4;
    const deepRemScore = 14 + (index % 4) * 2.2;
    const restorationScore = 12 + ((index + 2) % 3) * 3.3;
    const totalScore = Number(
      Math.min(timeAsleepScore + deepRemScore + restorationScore, 95).toFixed(1)
    );

    await run(`DELETE FROM sleep_score_result WHERE sleep_date = ?`, [sleepDate]);
    await run(
      `INSERT INTO sleep_score_result (
        sleep_date,
        time_asleep_score,
        deep_rem_score,
        restoration_score,
        total_score,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sleepDate,
        Number(timeAsleepScore.toFixed(1)),
        Number(deepRemScore.toFixed(1)),
        Number(restorationScore.toFixed(1)),
        totalScore,
        createdAt.toISOString()
      ]
    );
  }
}

function readSensorCsvRows() {
  const fs = require("fs");
  const content = fs.readFileSync(sensorCsvPath, "utf-8").trim();
  const [, ...lines] = content.split(/\r?\n/);

  return lines
    .map((line) => {
      const [sourceTs, temperature, humidity, mq5Raw, mq5Index] = line.split(",");
      return {
        sourceTs,
        temperature: Number(temperature),
        humidity: Number(humidity),
        mq5_raw: Number(mq5Raw),
        mq5_index: Number(mq5Index)
      };
    })
    .filter((row) => row.sourceTs && Number.isFinite(row.temperature));
}

function buildRecentSequenceTimestamps(sourceRows) {
  const firstSourceTs = new Date(sourceRows[0].sourceTs).getTime();
  const lastSourceTs = new Date(sourceRows[sourceRows.length - 1].sourceTs).getTime();
  const latest = new Date(Date.now() + KST_OFFSET_MS);
  latest.setUTCMilliseconds(0);
  const start = latest.getTime() - (lastSourceTs - firstSourceTs);

  return sourceRows.map((row) => {
    const offset = new Date(row.sourceTs).getTime() - firstSourceTs;
    return new Date(start + offset).toISOString().replace("Z", "");
  });
}

async function seedSensorRaw() {
  const sensorRows = readSensorCsvRows();
  if (sensorRows.length === 0) {
    throw new Error("sensor_sequence_1hour_5sec.csv에 센서 데이터가 없습니다.");
  }

  await run(`DELETE FROM sensor_raw WHERE created_at = ?`, [DEMO_SENSOR_CREATED_AT]);

  const timestamps = buildRecentSequenceTimestamps(sensorRows);

  for (let index = 0; index < sensorRows.length; index += 1) {
    const row = sensorRows[index];
    await run(
      `INSERT INTO sensor_raw (
        ts,
        temperature,
        humidity,
        mq5_raw,
        mq5_index,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        timestamps[index],
        row.temperature,
        row.humidity,
        row.mq5_raw,
        row.mq5_index,
        DEMO_SENSOR_CREATED_AT
      ]
    );
  }

  const oneHourAgo = new Date(Date.now() + KST_OFFSET_MS - 60 * 60 * 1000)
    .toISOString()
    .replace("Z", "");
  const [sensorSummary] = await all(
    `SELECT AVG(temperature) AS avg_temp_1h,
            AVG(humidity) AS avg_humidity_1h,
            AVG(mq5_index) AS avg_mq5_index_1h
     FROM sensor_raw
     WHERE ts >= ?`,
    [oneHourAgo]
  );

  return {
    avg_temp_1h: sensorSummary?.avg_temp_1h ?? null,
    avg_humidity_1h: sensorSummary?.avg_humidity_1h ?? null,
    avg_mq5_index_1h: sensorSummary?.avg_mq5_index_1h ?? null
  };
}

function buildRecentMinuteTimestamps(count) {
  const latest = new Date(Date.now() + KST_OFFSET_MS);
  latest.setUTCSeconds(0, 0);

  return Array.from({ length: count }, (_, index) => {
    const ts = new Date(latest);
    ts.setUTCMinutes(latest.getUTCMinutes() - (count - 1 - index));
    return ts.toISOString().replace("Z", "");
  });
}

async function seedFitbitFromSeedDb() {
  const sourceDb = new sqlite3.Database(sourceDbPath);

  try {
    const [caloriesTable] = await allFromSource(
      sourceDb,
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fitbit_calories'`
    );
    const [heartRows, stepsRows] = await Promise.all([
      allFromSource(sourceDb, `SELECT bpm FROM fitbit_heart ORDER BY ts`),
      allFromSource(sourceDb, `SELECT steps FROM fitbit_steps ORDER BY ts`)
    ]);
    const caloriesRows = caloriesTable
      ? await allFromSource(sourceDb, `SELECT calories FROM fitbit_calories ORDER BY ts`)
      : [];

    if (heartRows.length === 0 || stepsRows.length === 0) {
      throw new Error("zzz-seed.db에 fitbit_heart 또는 fitbit_steps 데이터가 없습니다.");
    }

    await run(`DELETE FROM fitbit_heart WHERE created_at = ?`, [DEMO_FITBIT_CREATED_AT]);
    await run(`DELETE FROM fitbit_steps WHERE created_at = ?`, [DEMO_FITBIT_CREATED_AT]);
    await run(`DELETE FROM fitbit_calories WHERE created_at = ?`, [DEMO_FITBIT_CREATED_AT]);

    const heartTimestamps = buildRecentMinuteTimestamps(heartRows.length);
    const stepsTimestamps = buildRecentMinuteTimestamps(stepsRows.length);
    const caloriesTimestamps = buildRecentMinuteTimestamps(caloriesRows.length);

    for (let index = 0; index < heartRows.length; index += 1) {
      await run(
        `INSERT OR IGNORE INTO fitbit_heart (ts, bpm, created_at)
         VALUES (?, ?, ?)`,
        [heartTimestamps[index], heartRows[index].bpm, DEMO_FITBIT_CREATED_AT]
      );
    }

    for (let index = 0; index < stepsRows.length; index += 1) {
      await run(
        `INSERT OR IGNORE INTO fitbit_steps (ts, steps, created_at)
         VALUES (?, ?, ?)`,
        [stepsTimestamps[index], stepsRows[index].steps, DEMO_FITBIT_CREATED_AT]
      );
    }

    for (let index = 0; index < caloriesRows.length; index += 1) {
      await run(
        `INSERT OR IGNORE INTO fitbit_calories (ts, calories, created_at)
         VALUES (?, ?, ?)`,
        [caloriesTimestamps[index], caloriesRows[index].calories, DEMO_FITBIT_CREATED_AT]
      );
    }

    const oneHourAgo = new Date(Date.now() + KST_OFFSET_MS - 60 * 60 * 1000)
      .toISOString()
      .replace("Z", "");
    const [heartSummary] = await all(
      `SELECT AVG(bpm) AS avg_hr_1h
       FROM fitbit_heart
       WHERE ts >= ?`,
      [oneHourAgo]
    );
    const [stepsSummary] = await all(
      `SELECT SUM(steps) AS steps_sum_1h
       FROM fitbit_steps
       WHERE ts >= ?`,
      [oneHourAgo]
    );
    const [caloriesSummary] = await all(
      `SELECT SUM(calories) AS calories_sum_1h
       FROM fitbit_calories
       WHERE ts >= ?`,
      [oneHourAgo]
    );

    return {
      avg_hr_1h: heartSummary?.avg_hr_1h ?? null,
      steps_sum_1h: stepsSummary?.steps_sum_1h ?? null,
      calories_sum_1h: caloriesSummary?.calories_sum_1h ?? null
    };
  } finally {
    sourceDb.close();
  }
}

async function seedPostAnalysis(dates) {
  const latestDate = dates[dates.length - 1];
  const sleepDate = latestDate.toISOString().slice(0, 10);
  const causes = [
    "깊은 수면 비율은 안정적이었지만 전체 수면 시간이 약간 부족했습니다.",
    "실내 습도는 무난했지만 취침 전 활동량이 약간 남아 있었습니다."
  ];
  const analysisText =
    "전반적인 회복감은 양호하지만, 취침 직전 활동을 조금 더 낮추면 다음 날 컨디션이 더 안정적으로 유지될 가능성이 있습니다.";
  const createdAt = new Date(latestDate);
  createdAt.setUTCHours(23, 0, 0, 0);

  await run(`DELETE FROM post_analysis_result WHERE sleep_date = ?`, [sleepDate]);
  await run(
    `INSERT INTO post_analysis_result (
      sleep_date,
      causes_json,
      analysis_text,
      created_at
    )
    VALUES (?, ?, ?, ?)`,
    [
      sleepDate,
      JSON.stringify(causes),
      analysisText,
      createdAt.toISOString()
    ]
  );
}

async function seedPredictionResult(dates, fitbitSummary, sensorSummary) {
  const latestDate = dates[dates.length - 1];
  const targetSleepDate = latestDate.toISOString().slice(0, 10);
  const predictionTs = new Date(latestDate);
  predictionTs.setUTCHours(21, 30, 0, 0);

  const snapshot = {
    user_id: "user-01",
    avg_hr_1h: fitbitSummary.avg_hr_1h,
    steps_sum_1h: fitbitSummary.steps_sum_1h,
    calories_sum_1h: fitbitSummary.calories_sum_1h,
    avg_temp_1h: sensorSummary.avg_temp_1h,
    avg_humidity_1h: sensorSummary.avg_humidity_1h,
    avg_mq5_index_1h: sensorSummary.avg_mq5_index_1h,
    recent_avg_sleep_minutes: 402,
    target_sleep_date: targetSleepDate
  };

  await run(`DELETE FROM prediction_result`);
  await run(
    `INSERT INTO prediction_result (
      prediction_ts,
      target_sleep_date,
      risk_level,
      risk_score,
      reasons_json,
      action_text,
      feature_snapshot_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      predictionTs.toISOString(),
      targetSleepDate,
      "LOW",
      35,
      JSON.stringify([]),
      "현재 상태를 유지해도 괜찮습니다.",
      JSON.stringify(snapshot),
      predictionTs.toISOString()
    ]
  );
}

async function main() {
  try {
    const dates = buildRecentDates(7);
    const fitbitSummary = await seedFitbitFromSeedDb();
    await seedSleepScores(dates);
    const sensorSummary = await seedSensorRaw();
    await seedPredictionResult(dates, fitbitSummary, sensorSummary);
    await seedPostAnalysis(dates);
    console.log("Seeded demo data for Fitbit, prediction_result, sleep_score_result, sensor_raw, and post_analysis_result.");
  } catch (error) {
    console.error("Failed to seed demo data:", error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
