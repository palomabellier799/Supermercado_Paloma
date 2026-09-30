const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const db = require('../db');

const router = express.Router();
let products = [];

//Cargar productos desde base de datos
function loadProducts() {
  products = [];
  
  const query = `SELECT codigo, nombre as descripcion, stock FROM productos ORDER BY codigo`;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error al cargar productos desde BD:", err.message);
      // Cargar desde CSV como respaldo
      loadProductsFromCSV();
      return;
    }
    
    if (rows && rows.length > 0) {
      products = rows;
      console.log(`Productos cargados desde BD: ${products.length}`);
    } else {
      console.log('No hay productos en BD, cargando desde CSV...');
      loadProductsFromCSV();
    }
  });
}

//Cargar productos desde CSV como respaldo
function loadProductsFromCSV() {
  products = [];
  let isFirstRow = true;
  
  try {
    const csvPath = path.join(__dirname, '../productos.csv');
    console.log(`Intentando cargar productos desde: ${csvPath}`);
    
    if (!fs.existsSync(csvPath)) {
      console.error(`Error: El archivo ${csvPath} no existe`);
      addSampleProducts();
      return;
    }
    
    fs.createReadStream(csvPath)
      .pipe(csv({ separator: ';' }))
      .on('data', (row) => {
        if (isFirstRow) { // saltear encabezado
          isFirstRow = false;
          return;
        }
        
        // Verificar que los campos necesarios existan
        if (!row.codigo || !row.descripcion) {
          console.warn(`Fila ignorada por falta de datos: ${JSON.stringify(row)}`);
          return;
        }
        
        const s0 = parseInt((row['stock inicial'] || row['stock_inicial'] || row.stock), 10) || 0;
        const p0 = row.precio ? parseFloat(String(row.precio).replace(',', '.')) : 0;
        products.push({
          codigo: row.codigo,
          descripcion: row.descripcion,
          stock: s0,
          stockInicial: s0,
          precio: p0
        });
      })
      .on('error', (error) => {
        console.error(`Error al leer el CSV: ${error.message}`);
        addSampleProducts();
      })
      .on('end', () => {
        console.log(`Productos cargados desde CSV: ${products.length}`);
        if (products.length === 0) {
          console.warn('No se cargaron productos. Agregando productos de ejemplo.');
          addSampleProducts();
        }
        // Sincronizar con la base de datos
        syncProductsToDB();
      });
  } catch (error) {
    console.error(`Error al cargar productos: ${error.message}`);
    addSampleProducts();
  }
}

//Sincronizar productos con la base de datos
function syncProductsToDB() {
  if (products.length === 0) return;

  // UPSERT: actualizar nombre/stock preservando precio existente si el nuevo es 0/null
  const insertQuery = `INSERT INTO productos (codigo, nombre, stock, stock_inicial, precio)
                       VALUES (?, ?, ?, ?, ?)
                       ON CONFLICT(codigo) DO UPDATE SET
                         nombre=excluded.nombre,
                         stock=excluded.stock,
                         stock_inicial=COALESCE(NULLIF(excluded.stock_inicial, 0), productos.stock_inicial, excluded.stock_inicial),
                         precio = COALESCE(NULLIF(excluded.precio, 0), productos.precio)`;
  const stmt = db.prepare(insertQuery);
  let processed = 0;
  products.forEach((producto, index) => {
    const s = parseInt(producto.stock, 10) || 0;
    const sIni = parseInt(producto.stockInicial, 10) || s;
    const pr = (!isNaN(producto.precio) && Number(producto.precio) > 0)
    ? Number(producto.precio)
    : null;
    stmt.run([producto.codigo, producto.descripcion, s, sIni, pr], (err) => {
      if (err) {
        console.error(`Error al upsert producto ${producto.codigo}:`, err.message);
      }
      processed++;
      if (processed === products.length) {
        stmt.finalize();
        console.log(`Productos sincronizados (UPSERT): ${processed}`);
      }
    });
  });
}

// Función para agregar productos de ejemplo si hay problemas con el CSV
function addSampleProducts() {
  products = [
    { codigo: '001', descripcion: 'Leche entera', stock: 50, precio: '120.00' },
    { codigo: '002', descripcion: 'Yerba mate 1kg', stock: 30, precio: '350.00' },
    { codigo: '003', descripcion: 'Azúcar', stock: 25, precio: '180.00' },
    { codigo: '004', descripcion: 'Café molido', stock: 15, precio: '450.00' },
    { codigo: '005', descripcion: 'Arroz', stock: 40, precio: '200.00' }
  ];
  console.log(`Productos de ejemplo cargados: ${products.length}`);
}

loadProducts();

//API JSON por nombre con autocompletado
router.get('/buscar', (req, res) => {
  const nombre = (req.query.nombre || '').toLowerCase();
  const limit = parseInt(req.query.limit) || 10;
  
  console.log('Búsqueda por nombre:', nombre);
  
  if (nombre.length < 2) {
    return res.json([]);
  }
  
  // Buscar en la base de datos
  const query = `SELECT codigo,
                         nombre as descripcion,
                         stock,
                         COALESCE(stock_inicial, stock) as stock_inicial,
                         COALESCE(precio, 0) as precio 
                 FROM productos p
                 WHERE LOWER(nombre) LIKE ? 
                 ORDER BY nombre 
                 LIMIT ?`;
  
  db.all(query, [`%${nombre}%`, limit], (err, rows) => {
    if (err) {
      console.error("Error en búsqueda:", err.message);
      return res.status(500).json({ error: "Error en la base de datos" });
    }
    
    const resultados = rows.map(p => ({
      codigo: p.codigo,
      descripcion: p.descripcion,
      stock: p.stock,
      stock_inicial: p.stock_inicial,
      precio: Number(p.precio || 0).toFixed(2)
    }));
    
    console.log('Resultados encontrados:', resultados.length);
    res.json(resultados);
  });
});

//API JSON por código
router.get('/producto', (req, res) => {
  const codigo = (req.query.codigo || '').toUpperCase();
  console.log('Búsqueda por código:', codigo);
  
  if (!codigo) {
    return res.status(400).json({ error: "Debe enviar un código" });
  }
  
  const query = `SELECT codigo,
                        nombre as descripcion,
                        stock,
                        COALESCE(stock_inicial, stock) as stock_inicial,
                        COALESCE(precio, 0) as precio
                 FROM productos p WHERE UPPER(codigo) = ?`;
  
  db.get(query, [codigo], (err, row) => {
    if (err) {
      console.error("Error en búsqueda por código:", err.message);
      return res.status(500).json({ error: "Error en la base de datos" });
    }
    
    if (row) {
      res.json({
        codigo: row.codigo,
        descripcion: row.descripcion,
        stock: row.stock,
        stock_inicial: row.stock_inicial,
        precio: Number(row.precio || 0).toFixed(2)
      });
    } else {
      res.status(404).json({});
    }
  });
});

module.exports = router;