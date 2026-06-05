const express = require("express");
const {
  getDevice,
  postRegisterDevice
} = require("../controllers/deviceController");

const router = express.Router();

router.get("/my", getDevice);
router.post("/register", postRegisterDevice);

module.exports = router;
