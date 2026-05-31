const {
  getMyDevice,
  registerDevice
} = require("../services/deviceService");

async function getDevice(req, res) {
  try {
    const device = await getMyDevice(req.query?.user_id);

    return res.status(200).json({
      status: "ok",
      endpoint: "GET /devices/my",
      data: {
        device
      }
    });
  } catch (error) {
    const statusCode = error.message.includes("user_id") ? 400 : 500;
    return res.status(statusCode).json({
      status: "error",
      message: error.message
    });
  }
}

async function postRegisterDevice(req, res) {
  try {
    const result = await registerDevice(req.body);

    return res.status(result.action === "created" ? 201 : 200).json({
      status: "ok",
      endpoint: "POST /devices/register",
      data: result
    });
  } catch (error) {
    const statusCode = error.message.includes("user_id") ? 400 : 422;
    return res.status(statusCode).json({
      status: "error",
      message: error.message
    });
  }
}

module.exports = {
  getDevice,
  postRegisterDevice
};
