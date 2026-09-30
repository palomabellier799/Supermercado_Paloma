const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

//Ruta absoluta a la base de datos en la carpeta /db
const dbPath = path.join(__dirname, '..', 'db', 'empleados.db');
console.log("Usando base de datos en:", dbPath);

// Crear conexión
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error al abrir la base de datos:", err.message);
    process.exit(1);
  }
  console.log("Conexión a la base de datos abierta.");
});

// Crear tabla y cargar empleados
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS empleados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    contraseña TEXT NOT NULL,
    rol TEXT CHECK(rol IN ('cajero', 'supervisor', 'admin')) NOT NULL
  )`);

  const insertar = db.prepare('INSERT OR IGNORE INTO empleados (usuario, contraseña, rol) VALUES (?, ?, ?)');

  //Hashear contraseña por defecto
  bcrypt.hash('clave123', 10, (err, hash) => {
    if (err) throw err;

    insertar.run('juan', hash, 'cajero');
    insertar.run('laura', hash, 'supervisor');
    insertar.run('admin', hash, 'admin');

    insertar.finalize();
    db.close(() => {
      console.log('Base de datos creada con usuarios de prueba');
      console.log('Usuarios: juan / laura / admin (clave: clave123)');
    });
  });
});