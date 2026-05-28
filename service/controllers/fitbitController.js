const {
  buildFitbitAuthorizeUrl,
  handleFitbitCallback,
  getFitbitStatus,
  disconnectFitbit
} = require("../services/fitbitAuthService");

async function getConnect(req, res) {
  try {
    const authorizeUrl = await buildFitbitAuthorizeUrl(req.query.user_id);
    return res.redirect(authorizeUrl);
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message
    });
  }
}

async function getCallback(req, res) {
  try {
    const status = await handleFitbitCallback(req.query);
    const redirectUrl = new URL("/", `${req.protocol}://${req.get("host")}`);

    redirectUrl.searchParams.set("fitbit_connected", "1");
    redirectUrl.searchParams.set("user_id", status.user_id);

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message
    });
  }
}

async function getStatus(req, res) {
  try {
    const status = await getFitbitStatus(req.query.user_id);

    return res.status(200).json({
      status: "ok",
      endpoint: "GET /fitbit/status",
      data: status
    });
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message
    });
  }
}

async function postDisconnect(req, res) {
  try {
    const result = await disconnectFitbit(req.body?.user_id);

    return res.status(200).json({
      status: "ok",
      endpoint: "POST /fitbit/disconnect",
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message
    });
  }
}

module.exports = {
  getConnect,
  getCallback,
  getStatus,
  postDisconnect
};
