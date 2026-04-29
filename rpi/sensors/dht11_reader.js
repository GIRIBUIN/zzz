const DHT_SENSOR_TYPE = Number(process.env.DHT_SENSOR_TYPE || 11); // DHT11 = 11, DHT22 = 22
const DHT_GPIO_PIN = Number(process.env.DHT_GPIO_PIN || 4); // BCM GPIO4, physical pin 7
const USE_MOCK_SENSOR = String(process.env.USE_MOCK_SENSOR).toLowerCase() === "true";
const { kstIsoLocal } = require("../../utils/time");

let dhtSensorModule = null;

function getDhtSensorModule() {
  if (!dhtSensorModule) {
    try {
      dhtSensorModule = require("node-dht-sensor");
    } catch (err) {
      throw new Error(
        "node-dht-sensor is required for real DHT reads. Set USE_MOCK_SENSOR=true for simulation mode."
      );
    }
  }

  return dhtSensorModule;
}

function readMockDht11() {
  return {
    temperature: 24 + Math.random() * 2,
    humidity: 45 + Math.random() * 10,
    ts: kstIsoLocal(),
    source: "mock-dht",
  };
}

function readDht11() {
  if (USE_MOCK_SENSOR) {
    return Promise.resolve(readMockDht11());
  }

  return new Promise((resolve, reject) => {
    const sensor = getDhtSensorModule();

    sensor.read(DHT_SENSOR_TYPE, DHT_GPIO_PIN, (err, temperature, humidity) => {
      if (err) {
        reject(new Error(`DHT read failed: ${err.message || err}`));
        return;
      }

      resolve({
        temperature: Number(temperature.toFixed(1)),
        humidity: Number(humidity.toFixed(1)),
        ts: kstIsoLocal(),
        source: "dht11",
      });
    });
  });
}

module.exports = {
  readDht11,
};

if (require.main === module) {
  readDht11()
    .then((data) => {
      console.log("DHT11 read success");
      console.log(data);
    })
    .catch((err) => {
      console.error("DHT11 read failed");
      console.error(err.message);
      process.exit(1);
    });
}
