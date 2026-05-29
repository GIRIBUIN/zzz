const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const DB_ENGINE = String(process.env.DB_ENGINE || "sqlite").trim().toLowerCase();

function normalizeMysqlDateString(value) {
  if (typeof value !== "string") return value;

  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d{1,3})?(?:Z)?$/
  );

  if (!match) return value;
  return `${match[1]} ${match[2]}`;
}

function normalizeMysqlParams(params = []) {
  return params.map(normalizeMysqlDateString);
}

function createMysqlDb() {
  const mysql = require("mysql2/promise");
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "zzz",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
    namedPlaceholders: false,
    dateStrings: true
  });

  console.log(`Connected to database: mysql://${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || "zzz"}`);

  return {
    engine: "mysql",
    get(sql, params = [], callback) {
      pool.execute(sql, normalizeMysqlParams(params))
        .then(([rows]) => callback(null, rows?.[0] || null))
        .catch((err) => callback(err));
    },
    all(sql, params = [], callback) {
      pool.execute(sql, normalizeMysqlParams(params))
        .then(([rows]) => callback(null, rows || []))
        .catch((err) => callback(err));
    },
    run(sql, params = [], callback) {
      pool.execute(sql, normalizeMysqlParams(params))
        .then(([result]) => {
          const context = {
            lastID: result.insertId || 0,
            changes: result.affectedRows || 0
          };
          if (callback) callback.call(context, null);
        })
        .catch((err) => {
          if (callback) callback.call({ lastID: 0, changes: 0 }, err);
        });
    },
    close(callback) {
      pool.end()
        .then(() => {
          if (callback) callback(null);
        })
        .catch((err) => {
          if (callback) callback(err);
        });
    }
  };
}

function createSqliteDb() {
  const sqlite3 = require("sqlite3").verbose();
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

  db.engine = "sqlite";
  return db;
}

if (DB_ENGINE === "mysql" || DB_ENGINE === "mariadb") {
  module.exports = createMysqlDb();
} else {
  module.exports = createSqliteDb();
}
