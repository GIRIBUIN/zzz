const express = require("express");
const router = express.Router();
const resultController = require("../controllers/resultController");

router.get("/latest", resultController.getLatestResult);
router.get("/sleep-score-history", resultController.getSleepScoreHistory);

module.exports = router;