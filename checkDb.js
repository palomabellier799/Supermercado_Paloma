const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'database.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
  if (err) {
    console.error("Error:", err.message);
  } else {
    console.log("Tablas encontradas:");
    rows.forEach(row => console.log("-", row.name));
  }
  db.close();
});