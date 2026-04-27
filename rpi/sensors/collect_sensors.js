const path = require("path");

try {
  require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
} catch (err) {
  // Allow sensor mock mode to run before npm dependencies are installed.
}

const { readDht11 } = require("./dht11_reader");
const { readMq5 } = require("./mq5_reader");

const SENSOR_INTERVAL_SECONDS = Number(process.env.SENSOR_INTERVAL_SECONDS || 60);

async function collectSensors() {
  const collectedAt = new Date().toISOString();

  const [dhtResult, mq5Result] = await Promise.allSettled([
    readDht11(),
    readMq5(),
  ]);

  const data = {
    ts: collectedAt,
    temperature: null,
    humidity: null,
    mq5_raw: null,
    mq5_index: null,
    source: null,
    sources: {},
    errors: [],
  };

  if (dhtResult.status === "fulfilled") {
    data.temperature = dhtResult.value.temperature;
    data.humidity = dhtResult.value.humidity;
    data.sources.dht11 = dhtResult.value.source;
  } else {
    data.errors.push({
      sensor: "dht11",
      message: dhtResult.reason.message || String(dhtResult.reason),
    });
  }

  if (mq5Result.status === "fulfilled") {
    data.mq5_raw = mq5Result.value.mq5_raw;
    data.mq5_index = mq5Result.value.mq5_index;
    data.sources.mq5 = mq5Result.value.source;
  } else {
    data.errors.push({
      sensor: "mq5",
      message: mq5Result.reason.message || String(mq5Result.reason),
    });
  }

  const sourceValues = Object.values(data.sources).filter(Boolean);
  data.source = sourceValues.length > 0 ? sourceValues.join("+") : "unknown";

  return data;
}

function saveSensorRaw(data) {
  return new Promise((resolve, reject) => {
    const db = require("../../storage/db/db");

    const sql = `
      INSERT INTO sensor_raw (
        ts,
        temperature,
        humidity,
        mq5_raw,
        mq5_index
      )
      VALUES (?, ?, ?, ?, ?)
    `;

    const params = [
      data.ts,
      data.temperature,
      data.humidity,
      data.mq5_raw,
      data.mq5_index,
    ];

    db.run(sql, params, function onInsert(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        id: this.lastID,
        ...data,
      });
    });
  });
}

async function runOnce({ save = false } = {}) {
  const data = await collectSensors();

  console.log("Sensor collected");
  console.log(JSON.stringify(data, null, 2));

  if (save) {
    const saved = await saveSensorRaw(data);
    console.log("Sensor data saved to DB");
    console.log(JSON.stringify(saved, null, 2));
  }

  return data;
}

async function runWatch({ save = false } = {}) {
  console.log(`Sensor collector started. interval=${SENSOR_INTERVAL_SECONDS}s save=${save}`);

  await runOnce({ save });

  setInterval(() => {
    runOnce({ save }).catch((err) => {
      console.error("Sensor collection failed");
      console.error(err.message || err);
    });
  }, SENSOR_INTERVAL_SECONDS * 1000);
}

module.exports = {
  collectSensors,
  saveSensorRaw,
  runOnce,
  runWatch,
};

if (require.main === module) {
  const args = process.argv.slice(2);

  const save = args.includes("--save");
  const watch = args.includes("--watch");

  if (watch) {
    runWatch({ save }).catch((err) => {
      console.error(err.message || err);
      process.exit(1);
    });
  } else {
    runOnce({ save })
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err.message || err);
        process.exit(1);
      });
  }
}
