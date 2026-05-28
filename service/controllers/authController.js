const {
  registerUser,
  loginUser,
  listUsers
} = require("../services/authService");

async function postRegister(req, res) {
  try {
    const user = await registerUser(req.body);

    return res.status(201).json({
      status: "ok",
      endpoint: "POST /auth/register",
      data: user
    });
  } catch (error) {
    const statusCode = error.message === "login_id already exists" ? 409 : 400;

    return res.status(statusCode).json({
      status: "error",
      message: error.message
    });
  }
}

async function postLogin(req, res) {
  try {
    const user = await loginUser(req.body);

    return res.status(200).json({
      status: "ok",
      endpoint: "POST /auth/login",
      data: user
    });
  } catch (error) {
    const statusCode = error.message === "invalid login_id or password" ? 401 : 400;

    return res.status(statusCode).json({
      status: "error",
      message: error.message
    });
  }
}

async function getUsers(req, res) {
  try {
    const users = await listUsers();

    return res.status(200).json({
      status: "ok",
      endpoint: "GET /auth/users",
      data: {
        users
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
}

module.exports = {
  postRegister,
  postLogin,
  getUsers
};
