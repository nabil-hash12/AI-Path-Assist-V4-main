require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("./lib/db");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "lib", "schema.sql"), "utf8");
  console.log("Applying schema to", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"));
  await pool.query(sql);
  console.log("Schema applied successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
