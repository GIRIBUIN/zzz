const USE_MOCK_SENSOR = String(process.env.USE_MOCK_SENSOR).toLowerCase() === "true";

const I2C_BUS_NUMBER = Number(process.env.I2C_BUS_NUMBER || 1);
const MQ5_ADC_ADDRESS = Number(process.env.MQ5_ADC_ADDRESS || "0x48"); // PCF8591 default
const MQ5_ADC_CHANNEL = Number(process.env.MQ5_ADC_CHANNEL || 0); // AIN0

let i2cModule = null;

function getI2cModule() {
  if (!i2cModule) {
    try {
      i2cModule = require("i2c-bus");
    } catch (err) {
      throw new Error(
        "i2c-bus is required for real MQ-5 reads. Set USE_MOCK_SENSOR=true for simulation mode."
      );
    }
  }

  return i2cModule;
}

function readMockMq5() {
  const raw = Math.floor(80 + Math.random() * 80);

  return {
    mq5_raw: raw,
    mq5_index: Number((raw / 255).toFixed(3)),
    ts: new Date().toISOString(),
    source: "mock-mq5",
  };
}

function readPcf8591Channel(channel = 0) {
  if (channel < 0 || channel > 3) {
    throw new Error("PCF8591 channel must be between 0 and 3");
  }

  const i2c = getI2cModule();
  const bus = i2c.openSync(I2C_BUS_NUMBER);

  try {
    const command = 0x40 | channel;

    bus.i2cWriteSync(MQ5_ADC_ADDRESS, 1, Buffer.from([command]));

    const buffer = Buffer.alloc(2);

    // 첫 번째 바이트는 이전 변환값일 수 있어서 dummy read로 보고,
    // 두 번째 바이트를 실제 현재 채널 값으로 사용한다.
    bus.i2cReadSync(MQ5_ADC_ADDRESS, 2, buffer);

    return buffer[1];
  } finally {
    bus.closeSync();
  }
}

function readMq5() {
  if (USE_MOCK_SENSOR) {
    return Promise.resolve(readMockMq5());
  }

  return new Promise((resolve, reject) => {
    try {
      const raw = readPcf8591Channel(MQ5_ADC_CHANNEL);

      resolve({
        mq5_raw: raw,
        mq5_index: Number((raw / 255).toFixed(3)),
        ts: new Date().toISOString(),
        source: "mq5-pcf8591",
      });
    } catch (err) {
      reject(new Error(`MQ-5 read failed: ${err.message || err}`));
    }
  });
}

module.exports = {
  readMq5,
};

if (require.main === module) {
  readMq5()
    .then((data) => {
      console.log("MQ-5 read success");
      console.log(data);
    })
    .catch((err) => {
      console.error("MQ-5 read failed");
      console.error(err.message);
      process.exit(1);
    });
}
