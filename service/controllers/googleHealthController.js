const {
  buildGoogleHealthAuthorizeUrl,
  handleGoogleHealthCallback,
  getGoogleHealthStatus,
  disconnectGoogleHealth
} = require("../services/googleHealthAuthService");

async function getConnect(req, res) {
  try {
    const authorizeUrl = await buildGoogleHealthAuthorizeUrl(req.query.user_id);
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
    const status = await handleGoogleHealthCallback(req.query);
    const redirectUrl = new URL("/", `${req.protocol}://${req.get("host")}`);

    redirectUrl.searchParams.set("google_health_connected", "1");
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
    const status = await getGoogleHealthStatus(req.query.user_id);

    return res.status(200).json({
      status: "ok",
      endpoint: "GET /google-health/status",
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
    const result = await disconnectGoogleHealth(req.body?.user_id);

    return res.status(200).json({
      status: "ok",
      endpoint: "POST /google-health/disconnect",
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
