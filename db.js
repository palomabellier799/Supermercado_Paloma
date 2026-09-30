const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error al conectar con la base:", err.message);
  } else {
    console.log("Conectado a la base de datos:", dbPath);
  }
});

module.exports = db;