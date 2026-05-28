const express = require("express");
const {
  postRegister,
  postLogin,
  getUsers
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", postRegister);
router.post("/login", postLogin);
router.get("/users", getUsers);

module.exports = router;
