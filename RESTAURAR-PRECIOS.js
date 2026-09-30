const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

console.log('=== RESTAURANDO PRECIOS DESDE CSV ===\n');

const dbPath = path.join(__dirname, 'db', 'database.db');
const csvPath = path.join(__dirname, 'productos.csv');

const db = new sqlite3.Database(dbPath);
const productos = [];

fs.createReadStream(csvPath)
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    if (row.codigo && row.precio) {
      const precio = parseFloat(String(row.precio).replace(',', '.'));
      if (precio > 0) {
        productos.push({ codigo: row.codigo, precio: precio });
      }
    }
  })
  .on('end', () => {
    console.log(`Productos con precio en CSV: ${productos.length}\n`);
    
    let actualizados = 0;
    let procesados = 0;
    
    productos.forEach((p) => {
      db.run(`UPDATE productos SET precio = ? WHERE codigo = ?`, [p.precio, p.codigo], function(err) {
        if (err) {
          console.error(`✗ Error ${p.codigo}:`, err.message);
        } else if (this.changes > 0) {
          console.log(`✓ ${p.codigo}: $${p.precio}`);
          actualizados++;
        }
        
        procesados++;
        
        if (procesados === productos.length) {
          console.log(`\n=== COMPLETADO ===`);
          console.log(`Actualizados: ${actualizados}/${productos.length}`);
          
          // Verificar 000B
          db.get(`SELECT codigo, nombre, precio FROM productos WHERE codigo = '000B'`, [], (err, row) => {
            if (row) {
              console.log(`\nProducto 000B verificado:`);
              console.log(`  ${row.codigo} - ${row.nombre}`);
              console.log(`  Precio en BD: $${row.precio}`);
              console.log(`  ${row.precio == 1300 ? '✓ CORRECTO' : '✗ INCORRECTO (esperado $1300)'}`);
            }
            db.close();
          });
        }
      });
    });
  })
  .on('error', (error) => {
    console.error('Error:', error.message);
    db.close();
  });
