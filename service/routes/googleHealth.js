const express = require("express");
const {
  getConnect,
  getCallback,
  getStatus,
  postDisconnect
} = require("../controllers/googleHealthController");

const router = express.Router();

router.get("/connect", getConnect);
router.get("/callback", getCallback);
router.get("/status", getStatus);
router.post("/disconnect", postDisconnect);

module.exports = router;
