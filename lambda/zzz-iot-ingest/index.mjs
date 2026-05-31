// zzz-iot-ingest: IoT Core → RDS sensor_raw 저장 + S3 raw JSON 백업
// IoT Rule SQL: SELECT * FROM 'zzz/+/+/sensor'
import mysql from "mysql2/promise";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-northeast-2" });
const S3_BUCKET = process.env.S3_BUCKET || "zzz-raw-data-ciot";

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "zzz",
      waitForConnections: true,
      connectionLimit: 2,
      connectTimeout: 10000,
    });
  }
  return pool;
}

function requiredNumber(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${fieldName} must be a number`);
  return n;
}

function requiredPositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${fieldName} must be a positive integer`);
  return n;
}

function toMysqlDatetime(value) {
  if (!value) return new Date().toISOString().slice(0, 19).replace("T", " ");
  const raw = String(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (match) return `${match[1]} ${match[2]}`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 19).replace("T", " ")
    : date.toISOString().slice(0, 19).replace("T", " ");
}

function buildS3Key(userId, deviceId, ts) {
  // ts: "2026-05-30 22:30:00" 형식
  const [datePart] = (ts || "").split(" ");
  const [year, month, day] = (datePart || "").split("-");
  const safeDate = year && month && day ? datePart : new Date().toISOString().slice(0, 10);
  const [y, m, d] = safeDate.split("-");
  const fileName = `user-${userId}-device-${deviceId}-${ts.replace(/[: ]/g, "-")}.json`;
  return `sensor/year=${y}/month=${m}/day=${d}/${fileName}`;
}

export const handler = async (event) => {
  console.log("[zzz-iot-ingest] event:", JSON.stringify(event));

  const userId   = requiredPositiveInt(event.user_id, "user_id");
  const deviceId = requiredPositiveInt(event.device_id, "device_id");
  const temperature = requiredNumber(event.temperature, "temperature");
  const humidity    = requiredNumber(event.humidity, "humidity");
  const mq5Raw      = requiredNumber(event.mq5_raw, "mq5_raw");
  const mq5Index    = requiredNumber(event.mq5_index, "mq5_index");
  const ts = toMysqlDatetime(event.timestamp ?? event.ts);

  // ① RDS 저장
  const [result] = await getPool().execute(
    `INSERT INTO sensor_raw
       (user_id, device_id, ts, temperature, humidity, mq5_raw, mq5_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [userId, deviceId, ts, temperature, humidity, mq5Raw, mq5Index]
  );

  console.log("[zzz-iot-ingest] RDS insert:", { insertId: result.insertId, user_id: userId, device_id: deviceId, ts });

  // ② S3 raw JSON 백업 (실패해도 RDS 저장은 유지)
  const s3Key = buildS3Key(userId, deviceId, ts);
  const payload = {
    user_id: userId, device_id: deviceId, ts,
    temperature, humidity, mq5_raw: mq5Raw, mq5_index: mq5Index,
    insert_id: result.insertId, received_at: new Date().toISOString(),
    raw_event: event,
  };

  try {
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(payload, null, 2),
      ContentType: "application/json",
    }));
    console.log("[zzz-iot-ingest] S3 저장 완료:", s3Key);
  } catch (e) {
    console.error("[zzz-iot-ingest] S3 저장 실패 (RDS는 정상):", e.message);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      insertId: result.insertId,
      s3_key: s3Key,
      received: event,
    }),
  };
};
