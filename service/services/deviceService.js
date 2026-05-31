const db = require("../../storage/db/db");

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function requireUserId(value) {
  const userId = Number(value);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("user_id must be a positive integer");
  }
  return userId;
}

function normalizeThingName(value) {
  const name = String(value || "").trim();
  if (!name) throw new Error("device name is required");
  if (name.length > 80) throw new Error("device name is too long");
  return name;
}

function toDeviceResponse(row) {
  if (!row) return null;
  return {
    device_id: row.id,
    user_id: row.user_id,
    iot_thing_name: row.iot_thing_name,
    topic: `zzz/${row.user_id}/${row.id}/sensor`,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function getMyDevice(userIdValue) {
  const userId = requireUserId(userIdValue);
  const row = await dbGet(
    `SELECT id, user_id, iot_thing_name, created_at, updated_at
     FROM devices
     WHERE user_id = ?
     ORDER BY id ASC
     LIMIT 1`,
    [userId]
  );

  return toDeviceResponse(row);
}

async function registerDevice(payload) {
  const userId = requireUserId(payload?.user_id);
  const existingDevice = await getMyDevice(userId);

  if (existingDevice) {
    return {
      action: "exists",
      device: existingDevice
    };
  }

  const thingName = normalizeThingName(payload?.iot_thing_name ?? payload?.device_name);
  const now = new Date().toISOString();
  const insertResult = await dbRun(
    `INSERT INTO devices (user_id, iot_thing_name, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [userId, thingName, now, now]
  );

  return {
    action: "created",
    device: {
      device_id: insertResult.lastID,
      user_id: userId,
      iot_thing_name: thingName,
      topic: `zzz/${userId}/${insertResult.lastID}/sensor`,
      created_at: now,
      updated_at: now
    }
  };
}

module.exports = {
  getMyDevice,
  registerDevice
};
