const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const dbPath = path.resolve(
  __dirname,
  "..",
  "..",
  process.env.DB_PATH || "./storage/db/zzz.db"
);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to database:", err.message);
  } else {
    console.log("Connected to database:", dbPath);
  }
});

module.exports = db;