const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'database.db');
console.log("Usando base de datos en:", dbPath);

// Crear conexión
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error al abrir la base de datos:", err.message);
    process.exit(1);
  }
  console.log("Conexión a la base de datos abierta.");
});

db.serialize(() => {
  // Crear tablas
  db.run(`CREATE TABLE IF NOT EXISTS empleados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    contraseña TEXT NOT NULL,
    rol TEXT CHECK(rol IN ('cajero', 'supervisor', 'admin')) NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    dni TEXT UNIQUE NOT NULL,
    telefono TEXT,
    email TEXT,
    domicilio TEXT,
    puntos INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    stock INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    producto_id INTEGER,
    cantidad INTEGER,
    fecha TEXT,
    FOREIGN KEY(cliente_id) REFERENCES clientes(id),
    FOREIGN KEY(producto_id) REFERENCES productos(id)
  )`);

  console.log(" Tablas creadas (empleados, clientes, productos, compras)");

  // Insertar empleados con contraseña hasheada
  const insertar = db.prepare(`INSERT OR IGNORE INTO empleados (usuario, contraseña, rol) VALUES (?, ?, ?)`);

  bcrypt.hash('clave123', 10, (err, hash) => {
    if (err) throw err;

    insertar.run('juan', hash, 'cajero');
    insertar.run('laura', hash, 'supervisor');
    insertar.run('admin', hash, 'admin');

    insertar.finalize();

    // Insertar clientes
    db.run(`INSERT OR IGNORE INTO clientes (nombre, dni, telefono, email, domicilio, puntos)
            VALUES ('Ana Pérez', '12345678', '351555123', 'ana@mail.com', 'Santa Fe', 20)`);

    
    // Insertar compra
    db.run(`INSERT OR IGNORE INTO compras (cliente_id, producto_id, cantidad, fecha)
            VALUES (1, 1, 2, '2025-09-20')`);

    // Mostrar clientes en consola
    db.all(`SELECT * FROM clientes`, [], (err, rows) => {
      if (err) return console.error(" Error al consultar clientes:", err);
      console.log(" Clientes cargados:");
      console.table(rows);
    });

    // Cerrar conexión
    db.close(() => {
      console.log(' Base de datos inicializada con usuarios, clientes, productos y compras');
      console.log(' Usuarios: juan / laura / admin (clave: clave123)');
    });
  });
});