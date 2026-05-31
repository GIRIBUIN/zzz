import mysql from "mysql2/promise";

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 2,
      queueLimit: 0,
      connectTimeout: 10000,
    });
  }

  return pool;
}

function requiredNumber(value, fieldName) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    throw new Error(`${fieldName} must be a number`);
  }

  return n;
}

function requiredPositiveInt(value, fieldName) {
  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return n;
}

function toMysqlDatetime(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
  }

  const raw = String(value);

  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

export const handler = async (event) => {
  console.log("ZZZ IoT event:", JSON.stringify(event));

  const userId = requiredPositiveInt(event.user_id, "user_id");
  const deviceId = requiredPositiveInt(event.device_id, "device_id");

  const temperature = requiredNumber(event.temperature, "temperature");
  const humidity = requiredNumber(event.humidity, "humidity");
  const mq5Raw = requiredNumber(event.mq5_raw, "mq5_raw");
  const mq5Index = requiredNumber(event.mq5_index, "mq5_index");

  const ts = toMysqlDatetime(event.timestamp ?? event.ts);

  console.log("normalized sensor payload:", {
    userId,
    deviceId,
    ts,
    temperature,
    humidity,
    mq5Raw,
    mq5Index,
  });

  try {
    const [result] = await getPool().execute(
      `
      INSERT INTO sensor_raw
        (user_id, device_id, ts, temperature, humidity, mq5_raw, mq5_index, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [userId, deviceId, ts, temperature, humidity, mq5Raw, mq5Index]
    );

    console.log("sensor_raw inserted:", {
      insertId: result.insertId,
      user_id: userId,
      device_id: deviceId,
      ts,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        insertId: result.insertId,
        received: event,
      }),
    };
  } catch (error) {
    console.error("RDS insert failed:", {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
    });

    throw error;
  }
};
