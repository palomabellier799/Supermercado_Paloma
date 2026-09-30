const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'db', 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('=== RESTAURANDO PRECIOS DESDE CSV ===\n');

const productos = [];

fs.createReadStream(path.join(__dirname, 'productos.csv'))
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    if (!row.codigo || !row.descripcion) return;
    
    const precio = row.precio ? parseFloat(String(row.precio).replace(',', '.')) : null;
    
    if (precio && precio > 0) {
      productos.push({
        codigo: row.codigo,
        nombre: row.descripcion,
        precio: precio
      });
    }
  })
  .on('end', () => {
    console.log(`Productos con precio encontrados en CSV: ${productos.length}\n`);
    
    if (productos.length === 0) {
      console.log('No se encontraron productos con precios válidos en el CSV.');
      db.close();
      return;
    }
    
    db.serialize(() => {
      const stmt = db.prepare(`UPDATE productos SET precio = ? WHERE codigo = ?`);
      
      let actualizados = 0;
      let procesados = 0;
      
      productos.forEach((producto) => {
        stmt.run([producto.precio, producto.codigo], function(err) {
          if (err) {
            console.error(`❌ Error al actualizar ${producto.codigo}:`, err.message);
          } else if (this.changes > 0) {
            console.log(`✓ ${producto.codigo} - ${producto.nombre}: $${producto.precio}`);
            actualizados++;
          } else {
            console.log(`⚠ ${producto.codigo} no encontrado en BD`);
          }
          
          procesados++;
          
          if (procesados === productos.length) {
            stmt.finalize();
            console.log(`\n=== RESUMEN ===`);
            console.log(`Total procesados: ${procesados}`);
            console.log(`Actualizados exitosamente: ${actualizados}`);
            console.log(`\n✓ Precios restaurados desde CSV`);
            db.close();
          }
        });
      });
    });
  })
  .on('error', (error) => {
    console.error('Error al leer CSV:', error.message);
    db.close();
  });
