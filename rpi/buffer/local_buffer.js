const fs = require("fs/promises");
const path = require("path");

const DEFAULT_BUFFER_FILE = path.join(
  __dirname,
  "..",
  "..",
  "storage",
  "raw",
  "sensor_raw",
  "rpi_failed_publish.jsonl"
);

function bufferFilePath() {
  return path.resolve(process.env.RPI_SENSOR_BUFFER_FILE || DEFAULT_BUFFER_FILE);
}

async function ensureBufferDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function serializeRecord(payload, error) {
  return JSON.stringify({
    buffered_at: new Date().toISOString(),
    error: error?.message || String(error || "publish failed"),
    payload,
  });
}

async function enqueueSensorPayload(payload, error) {
  const filePath = bufferFilePath();
  await ensureBufferDir(filePath);
  await fs.appendFile(filePath, `${serializeRecord(payload, error)}\n`, "utf8");

  return { filePath, payload };
}

async function readBufferedRecords() {
  const filePath = bufferFilePath();

  try {
    const text = await fs.readFile(filePath, "utf8");
    const records = [];

    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      try {
        const record = JSON.parse(line);
        if (record && record.payload) {
          records.push(record);
        }
      } catch (err) {
        console.warn(`Skipping malformed sensor buffer line: ${err.message}`);
      }
    }

    return records;
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeBufferedRecords(records) {
  const filePath = bufferFilePath();
  await ensureBufferDir(filePath);

  const text = records.length > 0
    ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
    : "";

  await fs.writeFile(filePath, text, "utf8");
  return { filePath, count: records.length };
}

async function flushSensorBuffer(publishFn, options = {}) {
  const records = await readBufferedRecords();
  const maxRecords = Number(options.maxRecords || process.env.RPI_BUFFER_FLUSH_LIMIT || 50);
  const selected = records.slice(0, maxRecords);
  const untouched = records.slice(maxRecords);
  const remaining = [];
  let sent = 0;

  for (const record of selected) {
    try {
      await publishFn(record.payload);
      sent += 1;
    } catch (err) {
      remaining.push({
        ...record,
        last_error: err.message || String(err),
        last_attempt_at: new Date().toISOString(),
      });
    }
  }

  await writeBufferedRecords([...remaining, ...untouched]);

  return {
    attempted: selected.length,
    sent,
    remaining: remaining.length + untouched.length,
    filePath: bufferFilePath(),
  };
}

module.exports = {
  enqueueSensorPayload,
  flushSensorBuffer,
  readBufferedRecords,
};
