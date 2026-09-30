const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'database.db');
const db = new sqlite3.Database(dbPath);

console.log('=== LIMPIANDO VENTAS Y RESETEANDO TOTALES ===\n');

db.serialize(() => {
  // 1. Contar ventas actuales
  db.get(`SELECT COUNT(*) as total FROM compras`, [], (err, row) => {
    if (err) {
      console.error('Error:', err.message);
      db.close();
      return;
    }
    
    console.log(`Ventas registradas actualmente: ${row.total}\n`);
    
    // 2. Eliminar todas las ventas
    db.run(`DELETE FROM compras`, function(err2) {
      if (err2) {
        console.error('Error al eliminar ventas:', err2.message);
        db.close();
        return;
      }
      
      console.log(`✓ ${this.changes} ventas eliminadas`);
      
      // 3. Resetear puntos de clientes a 0
      db.run(`UPDATE clientes SET puntos = 0`, function(err3) {
        if (err3) {
          console.error('Error al resetear puntos:', err3.message);
        } else {
          console.log(`✓ Puntos de ${this.changes} clientes reseteados a 0`);
        }
        
        // 4. Verificar
        db.get(`SELECT COUNT(*) as total FROM compras`, [], (err4, row2) => {
          if (!err4) {
            console.log(`\nVentas después de limpiar: ${row2.total}`);
          }
          
          db.get(`SELECT SUM(puntos) as total_puntos FROM clientes`, [], (err5, row3) => {
            if (!err5) {
              console.log(`Puntos totales en sistema: ${row3.total_puntos || 0}`);
            }
            
            console.log('\n=== LIMPIEZA COMPLETADA ===');
            console.log('✓ Todas las ventas eliminadas');
            console.log('✓ Puntos de clientes reseteados');
            console.log('✓ Los precios de productos NO fueron modificados');
            console.log('\nAhora puedes volver a vender con los precios correctos del CSV.');
            
            db.close();
          });
        });
      });
    });
  });
});
