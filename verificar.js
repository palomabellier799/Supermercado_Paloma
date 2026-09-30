const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('inventario.db');

db.all("SELECT * FROM productos", (err, rows) => {
  if (err) {
    console.error('Error al consultar la base:', err.message);
  } else {
    console.log('✅ Productos encontrados:');
    console.table(rows);
  }
});