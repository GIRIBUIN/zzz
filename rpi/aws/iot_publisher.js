const fs = require("fs");
const path = require("path");

try {
  require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
} catch (err) {
  // The collector can still run in parse/test mode before dependencies are installed.
}

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const DEFAULT_TOPIC = "zzz/rpi/sensor";

let awsIotSdk = null;

function requireAwsIotSdk() {
  if (!awsIotSdk) {
    try {
      awsIotSdk = require("aws-iot-device-sdk-v2");
    } catch (err) {
      throw new Error(
        "aws-iot-device-sdk-v2 is required for AWS IoT publish. Run npm install first."
      );
    }
  }

  return awsIotSdk;
}

function requiredEnv(name, value = process.env[name]) {
  if (!value) {
    throw new Error(`${name} is required for AWS IoT publish`);
  }

  return value;
}

function resolveProjectPath(value, fieldName) {
  const resolved = path.isAbsolute(value)
    ? value
    : path.resolve(PROJECT_ROOT, value);

  if (!fs.existsSync(resolved)) {
    throw new Error(`${fieldName} file not found: ${resolved}`);
  }

  return resolved;
}

function normalizePositiveInteger(value, fieldName) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return numberValue;
}

function requiredFiniteNumber(value, fieldName) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`${fieldName} must be a finite number before publish`);
  }

  return numberValue;
}

function getAwsIotConfig(overrides = {}) {
  const endpoint = requiredEnv("AWS_IOT_ENDPOINT", overrides.endpoint || process.env.AWS_IOT_ENDPOINT);
  const certPath = resolveProjectPath(
    requiredEnv("AWS_IOT_CERT_PATH", overrides.certPath || process.env.AWS_IOT_CERT_PATH),
    "AWS_IOT_CERT_PATH"
  );
  const keyPath = resolveProjectPath(
    requiredEnv("AWS_IOT_KEY_PATH", overrides.keyPath || process.env.AWS_IOT_KEY_PATH),
    "AWS_IOT_KEY_PATH"
  );
  const caPath = resolveProjectPath(
    requiredEnv("AWS_IOT_CA_PATH", overrides.caPath || process.env.AWS_IOT_CA_PATH),
    "AWS_IOT_CA_PATH"
  );

  return {
    endpoint,
    certPath,
    keyPath,
    caPath,
    clientId: overrides.clientId || process.env.AWS_IOT_CLIENT_ID || `zzz-rpi-${Date.now()}`,
    topic: overrides.topic || process.env.AWS_IOT_SENSOR_TOPIC || DEFAULT_TOPIC,
    qos: Number(overrides.qos ?? process.env.AWS_IOT_QOS ?? 1),
    keepAliveSeconds: Number(overrides.keepAliveSeconds ?? process.env.AWS_IOT_KEEP_ALIVE_SECONDS ?? 30),
  };
}

function buildSensorPayload(sensorData, context = {}) {
  const userId = normalizePositiveInteger(
    context.user_id ?? process.env.RPI_USER_ID ?? 1,
    "user_id"
  );
  const deviceId = normalizePositiveInteger(
    context.device_id ?? process.env.RPI_DEVICE_ID,
    "device_id"
  );

  return {
    user_id: userId,
    device_id: deviceId,
    timestamp: sensorData.ts,
    temperature: requiredFiniteNumber(sensorData.temperature, "temperature"),
    humidity: requiredFiniteNumber(sensorData.humidity, "humidity"),
    mq5_raw: requiredFiniteNumber(sensorData.mq5_raw, "mq5_raw"),
    mq5_index: requiredFiniteNumber(sensorData.mq5_index, "mq5_index"),
    source: sensorData.source || "rpi",
  };
}

function createConnection(config) {
  const { mqtt, iot } = requireAwsIotSdk();
  const builder = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(
    config.certPath,
    config.keyPath
  );

  builder.with_certificate_authority_from_path(undefined, config.caPath);
  builder.with_clean_session(true);
  builder.with_client_id(config.clientId);
  builder.with_endpoint(config.endpoint);
  builder.with_keep_alive_seconds(config.keepAliveSeconds);

  const client = new mqtt.MqttClient();
  return client.new_connection(builder.build());
}

async function publishSensorPayload(payload, options = {}) {
  const { mqtt } = requireAwsIotSdk();
  const config = getAwsIotConfig(options);
  const connection = createConnection(config);
  const message = JSON.stringify(payload);

  await connection.connect();

  try {
    await connection.publish(
      config.topic,
      message,
      config.qos === 0 ? mqtt.QoS.AtMostOnce : mqtt.QoS.AtLeastOnce
    );

    return {
      topic: config.topic,
      qos: config.qos,
      payload,
    };
  } finally {
    await connection.disconnect().catch(() => {});
  }
}

module.exports = {
  buildSensorPayload,
  getAwsIotConfig,
  publishSensorPayload,
};
