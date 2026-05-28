const path = require("path");

try {
  require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
} catch (err) {
  // Allow sensor mock mode to run before npm dependencies are installed.
}

const { readDht11 } = require("./dht11_reader");
const { readMq5 } = require("./mq5_reader");
const { kstIsoLocal } = require("../../utils/time");

const SENSOR_INTERVAL_SECONDS = Number(process.env.SENSOR_INTERVAL_SECONDS || 60);

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = require("../../storage/db/db");
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
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

async function resolveDeviceContext(options = {}) {
  const userId = normalizePositiveInteger(options.user_id, "user_id", 1);
  const requestedDeviceId = options.device_id == null
    ? null
    : normalizePositiveInteger(options.device_id, "device_id");
  const params = [userId];
  let where = "user_id = ?";

  if (requestedDeviceId !== null) {
    where += " AND id = ?";
    params.push(requestedDeviceId);
  }

  const device = await dbGet(
    `SELECT id, user_id, iot_thing_name
     FROM devices
     WHERE ${where}
     ORDER BY id ASC
     LIMIT 1`,
    params
  );

  if (!device) {
    throw new Error("device not found for user");
  }

  return {
    user_id: userId,
    device_id: device.id,
    iot_thing_name: device.iot_thing_name
  };
}

async function collectSensors() {
  const collectedAt = kstIsoLocal();

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

async function saveSensorRaw(data, options = {}) {
  const context = await resolveDeviceContext(options);

  return new Promise((resolve, reject) => {
    const db = require("../../storage/db/db");

    const sql = `
      INSERT INTO sensor_raw (
        user_id,
        device_id,
        ts,
        temperature,
        humidity,
        mq5_raw,
        mq5_index
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      context.user_id,
      context.device_id,
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
        user_id: context.user_id,
        device_id: context.device_id,
        ...data,
      });
    });
  });
}

async function runOnce({ save = false, user_id = 1, device_id = null } = {}) {
  const data = await collectSensors();

  console.log("Sensor collected");
  console.log(JSON.stringify(data, null, 2));

  if (save) {
    const saved = await saveSensorRaw(data, { user_id, device_id });
    console.log("Sensor data saved to DB");
    console.log(JSON.stringify(saved, null, 2));
  }

  return data;
}

async function runWatch({ save = false, user_id = 1, device_id = null } = {}) {
  console.log(`Sensor collector started. interval=${SENSOR_INTERVAL_SECONDS}s save=${save}`);

  await runOnce({ save, user_id, device_id });

  setInterval(() => {
    runOnce({ save, user_id, device_id }).catch((err) => {
      console.error("Sensor collection failed");
      console.error(err.message || err);
    });
  }, SENSOR_INTERVAL_SECONDS * 1000);
}

module.exports = {
  collectSensors,
  resolveDeviceContext,
  saveSensorRaw,
  runOnce,
  runWatch,
};

if (require.main === module) {
  const args = process.argv.slice(2);

  const save = args.includes("--save");
  const watch = args.includes("--watch");
  const userIdIndex = args.findIndex((arg) => arg === "--user-id" || arg === "--user_id");
  const deviceIdIndex = args.findIndex((arg) => arg === "--device-id" || arg === "--device_id");
  const user_id = userIdIndex !== -1 ? args[userIdIndex + 1] : 1;
  const device_id = deviceIdIndex !== -1 ? args[deviceIdIndex + 1] : null;

  if (watch) {
    runWatch({ save, user_id, device_id }).catch((err) => {
      console.error(err.message || err);
      process.exit(1);
    });
  } else {
    runOnce({ save, user_id, device_id })
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err.message || err);
        process.exit(1);
      });
  }
}
