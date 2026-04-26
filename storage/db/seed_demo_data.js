const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const db = require("./db");

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
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

async function seedSensorRaw() {
  const sensorTs = new Date();
  sensorTs.setUTCMinutes(0, 0, 0);
  sensorTs.setUTCHours(sensorTs.getUTCHours() - 1);
  const ts = sensorTs.toISOString();

  await run(`DELETE FROM sensor_raw WHERE ts = ?`, [ts]);
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
      ts,
      23.8,
      52.4,
      182,
      0.27,
      new Date().toISOString()
    ]
  );
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

async function seedPredictionResult(dates) {
  const latestDate = dates[dates.length - 1];
  const targetSleepDate = latestDate.toISOString().slice(0, 10);
  const predictionTs = new Date(latestDate);
  predictionTs.setUTCHours(21, 30, 0, 0);

  const snapshot = {
    user_id: "user-01",
    avg_hr_1h: 84,
    steps_sum_1h: 260,
    calories_sum_1h: 148,
    avg_temp_1h: 24.2,
    avg_humidity_1h: 58.1,
    avg_mq5_index_1h: 0.22,
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
    await seedSleepScores(dates);
    await seedSensorRaw();
    await seedPredictionResult(dates);
    await seedPostAnalysis(dates);
    console.log("Seeded demo data for prediction_result, sleep_score_result, sensor_raw, and post_analysis_result.");
  } catch (error) {
    console.error("Failed to seed demo data:", error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
