const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const dbPath = path.resolve(__dirname, "..", "..", process.env.DB_PATH || "storage/db/zzz.db");
const schemaPath = path.join(__dirname, "schema.sql");

// DB 폴더 없으면 생성
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

if (!fs.existsSync(schemaPath)) {
  console.error("schema.sql not found:", schemaPath);
  process.exit(1);
}

const schema = fs.readFileSync(schemaPath, "utf8");
const db = new sqlite3.Database(dbPath);

db.exec(schema, (err) => {
  if (err) {
    console.error("Failed to initialize DB:", err.message);
    process.exit(1);
  }

  console.log("Database initialized:", dbPath);
  db.close();
});