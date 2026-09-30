const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.db');
console.log("Inicializando base de datos en:", dbPath);

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

  // Agregar columna genero si no existe
  db.run(`ALTER TABLE empleados ADD COLUMN genero TEXT CHECK(genero IN ('m', 'f')) DEFAULT 'm'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error("Error al agregar columna genero:", err.message);
    }
  });

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

  // Asegurar columnas faltantes en productos
  db.run(`ALTER TABLE productos ADD COLUMN stock_inicial INTEGER DEFAULT 0`, (err) => {
    if (err && !String(err.message).includes('duplicate column name')) {
      console.error('Error al agregar stock_inicial a productos:', err.message);
    }
  });
  db.run(`ALTER TABLE productos ADD COLUMN precio REAL DEFAULT 0`, (err) => {
    if (err && !String(err.message).includes('duplicate column name')) {
      console.error('Error al agregar precio a productos:', err.message);
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS compras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    producto_id INTEGER,
    cantidad INTEGER,
    fecha TEXT,
    FOREIGN KEY(cliente_id) REFERENCES clientes(id),
    FOREIGN KEY(producto_id) REFERENCES productos(id)
  )`);

  // Asegurar columnas faltantes en compras
  db.run(`ALTER TABLE compras ADD COLUMN precio_unitario REAL DEFAULT 0`, (err) => {
    if (err && !String(err.message).includes('duplicate column name')) {
      console.error('Error al agregar precio_unitario a compras:', err.message);
    }
  });
  db.run(`ALTER TABLE compras ADD COLUMN importe REAL DEFAULT 0`, (err) => {
    if (err && !String(err.message).includes('duplicate column name')) {
      console.error('Error al agregar importe a compras:', err.message);
    }
  });

  console.log("Tablas creadas (empleados, clientes, productos, compras)");

  // Insertar empleados con contraseña hasheada
  const insertarEmpleado = db.prepare(`INSERT OR IGNORE INTO empleados (usuario, contraseña, rol, genero) VALUES (?, ?, ?, ?)`);

  bcrypt.hash('clave123', 10, (err, hash) => {
    if (err) throw err;

    insertarEmpleado.run('juan', hash, 'cajero', 'm');
    insertarEmpleado.run('laura', hash, 'supervisor', 'f');
    insertarEmpleado.run('admin', hash, 'admin', 'm');

    insertarEmpleado.finalize();

    // Insertar clientes de ejemplo
    const insertarCliente = db.prepare(`INSERT OR IGNORE INTO clientes (nombre, dni, telefono, email, domicilio, puntos) VALUES (?, ?, ?, ?, ?, ?)`);
    
    insertarCliente.run('Ana Pérez', '12345678', '351555123', 'ana@mail.com', 'Santa Fe 123', 20);
    insertarCliente.run('Carlos López', '87654321', '351555456', 'carlos@mail.com', 'Córdoba 456', 15);
    insertarCliente.run('María González', '11223344', '351555789', 'maria@mail.com', 'Buenos Aires 789', 30);
    
    insertarCliente.finalize();

    // Cargar productos desde CSV
    const csvPath = path.join(__dirname, 'productos.csv');
    
    if (fs.existsSync(csvPath)) {
      console.log("Cargando productos desde CSV...");
      
      const productos = [];
      
      fs.createReadStream(csvPath)
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.codigo && row.descripcion) {
            productos.push({
              codigo: row.codigo,
              nombre: row.descripcion,
              stock: parseInt(row.stock, 10) || 0,
              stock_inicial: parseInt((row['stock inicial'] || row['stock_inicial'] || row.stock), 10) || (parseInt(row.stock, 10) || 0),
              precio: row.precio ? parseFloat(String(row.precio).replace(',', '.')) : 0
            });
          }
        })
        .on('end', () => {
          console.log(`Productos encontrados en CSV: ${productos.length}`);
          
          if (productos.length > 0) {
            const insertarProducto = db.prepare(`INSERT OR REPLACE INTO productos (codigo, nombre, stock, stock_inicial, precio) VALUES (?, ?, ?, ?, ?)`);
            
            productos.forEach((producto, index) => {
              insertarProducto.run([producto.codigo, producto.nombre, producto.stock, producto.stock_inicial, producto.precio], (err) => {
                if (err) {
                  console.error(`Error al insertar producto ${producto.codigo}:`, err.message);
                }
                
                if (index === productos.length - 1) {
                  insertarProducto.finalize();
                  console.log(`Productos insertados: ${productos.length}`);
                  finalizarInicializacion();
                }
              });
            });
          } else {
            finalizarInicializacion();
          }
        })
        .on('error', (error) => {
          console.error("Error al leer CSV:", error.message);
          finalizarInicializacion();
        });
    } else {
      console.log("Archivo CSV no encontrado, insertando productos de ejemplo...");
      
      const productosEjemplo = [
        { codigo: '001', nombre: 'Leche entera', stock: 50 },
        { codigo: '002', nombre: 'Yerba mate 1kg', stock: 30 },
        { codigo: '003', nombre: 'Azúcar', stock: 25 },
        { codigo: '004', nombre: 'Café molido', stock: 15 },
        { codigo: '005', nombre: 'Arroz', stock: 40 }
      ];
      
      const insertarProducto = db.prepare(`INSERT OR REPLACE INTO productos (codigo, nombre, stock) VALUES (?, ?, ?)`);
      
      productosEjemplo.forEach((producto, index) => {
        insertarProducto.run([producto.codigo, producto.nombre, producto.stock], (err) => {
          if (err) {
            console.error(`Error al insertar producto ${producto.codigo}:`, err.message);
          }
          
          if (index === productosEjemplo.length - 1) {
            insertarProducto.finalize();
            console.log(`Productos de ejemplo insertados: ${productosEjemplo.length}`);
            finalizarInicializacion();
          }
        });
      });
    }
  });
});

function finalizarInicializacion() {
  // Mostrar resumen
  db.all(`SELECT COUNT(*) as count FROM empleados`, [], (err, rows) => {
    if (!err) console.log(`Empleados: ${rows[0].count}`);
  });
  
  db.all(`SELECT COUNT(*) as count FROM clientes`, [], (err, rows) => {
    if (!err) console.log(`Clientes: ${rows[0].count}`);
  });
  
  db.all(`SELECT COUNT(*) as count FROM productos`, [], (err, rows) => {
    if (!err) console.log(`Productos: ${rows[0].count}`);
  });

  // Cerrar conexión
  db.close(() => {
    console.log('\n=== BASE DE DATOS INICIALIZADA ===');
    console.log('Usuarios creados:');
    console.log('  - juan (cajero) - contraseña: clave123');
    console.log('  - laura (supervisor) - contraseña: clave123');
    console.log('  - admin (admin) - contraseña: clave123');
    console.log('\nPuedes iniciar el servidor con: npm start');
  });
}
