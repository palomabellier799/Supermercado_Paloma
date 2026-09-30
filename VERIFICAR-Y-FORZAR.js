const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('=== VERIFICACIÓN Y CORRECCIÓN DE PRECIO 000B ===\n');

// 1. Ver estado actual
db.get(`SELECT * FROM productos WHERE codigo = '000B'`, [], (err, row) => {
  if (err) {
    console.error('Error:', err.message);
    db.close();
    return;
  }
  
  if (!row) {
    console.log('✗ Producto 000B no encontrado');
    db.close();
    return;
  }
  
  console.log('Estado ANTES:');
  console.log(`  Código: ${row.codigo}`);
  console.log(`  Nombre: ${row.nombre}`);
  console.log(`  Precio: ${row.precio}`);
  console.log(`  Stock: ${row.stock}`);
  console.log(`  Stock inicial: ${row.stock_inicial}`);
  
  // 2. Ver si hay compras que puedan estar afectando
  db.all(`SELECT * FROM compras WHERE producto_id = ?`, [row.id], (err2, compras) => {
    if (err2) {
      console.error('Error consultando compras:', err2.message);
    } else {
      console.log(`\nCompras registradas: ${compras.length}`);
      if (compras.length > 0) {
        console.log('Últimas 3 compras:');
        compras.slice(-3).forEach(c => {
          console.log(`  - Cantidad: ${c.cantidad}, Precio unitario: ${c.precio_unitario}, Importe: ${c.importe}, Fecha: ${c.fecha}`);
        });
      }
    }
    
    // 3. FORZAR precio correcto
    console.log('\n=== FORZANDO PRECIO CORRECTO ===');
    db.run(`UPDATE productos SET precio = 1300 WHERE codigo = '000B'`, function(err3) {
      if (err3) {
        console.error('✗ Error al actualizar:', err3.message);
      } else {
        console.log(`✓ Precio actualizado (${this.changes} fila)`);
        
        // 4. Verificar después
        db.get(`SELECT codigo, nombre, precio FROM productos WHERE codigo = '000B'`, [], (err4, row2) => {
          if (!err4 && row2) {
            console.log('\nEstado DESPUÉS:');
            console.log(`  Código: ${row2.codigo}`);
            console.log(`  Nombre: ${row2.nombre}`);
            console.log(`  Precio: ${row2.precio}`);
            console.log(`  ${row2.precio == 1300 ? '✓ CORRECTO' : '✗ SIGUE INCORRECTO'}`);
          }
          
          // 5. Verificar esquema de la tabla
          db.all(`PRAGMA table_info(productos)`, [], (err5, columns) => {
            console.log('\nColumnas de la tabla productos:');
            columns.forEach(col => {
              console.log(`  - ${col.name} (${col.type})`);
            });
            
            db.close();
            console.log('\n=== FIN ===');
          });
        });
      }
    });
  });
});
