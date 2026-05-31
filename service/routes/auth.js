const express = require("express");
const {
  postRegister,
  postLogin,
  getUsers
} = require("../controllers/authController");
const { proxyOrFallback } = require("../utils/gatewayProxy");

const router = express.Router();

router.post("/register", (req, res) =>
  proxyOrFallback(req, res, "/auth/register", postRegister)
);

router.post("/login", (req, res) =>
  proxyOrFallback(req, res, "/auth/login", postLogin)
);

router.get("/users", (req, res) =>
  proxyOrFallback(req, res, "/auth/users", getUsers)
);

module.exports = router;
