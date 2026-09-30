const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('=== VERIFICANDO PRECIOS EN BASE DE DATOS ===\n');

db.all(`SELECT codigo, nombre, precio, stock, stock_inicial FROM productos ORDER BY codigo LIMIT 10`, [], (err, rows) => {
  if (err) {
    console.error('Error:', err.message);
    db.close();
    return;
  }
  
  console.log('Primeros 10 productos:\n');
  rows.forEach(row => {
    console.log(`${row.codigo} - ${row.nombre}`);
    console.log(`  Precio: $${row.precio || 0}`);
    console.log(`  Stock: ${row.stock} / Stock inicial: ${row.stock_inicial || row.stock}`);
    console.log('');
  });
  
  db.all(`SELECT COUNT(*) as total, 
                 SUM(CASE WHEN precio > 0 THEN 1 ELSE 0 END) as con_precio,
                 SUM(CASE WHEN precio = 0 OR precio IS NULL THEN 1 ELSE 0 END) as sin_precio
          FROM productos`, [], (err2, stats) => {
    if (!err2 && stats.length > 0) {
      console.log('=== ESTADÍSTICAS ===');
      console.log(`Total productos: ${stats[0].total}`);
      console.log(`Con precio: ${stats[0].con_precio}`);
      console.log(`Sin precio: ${stats[0].sin_precio}`);
    }
    db.close();
  });
});
