const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function syncInventario(callback) {
  const mainDbPath = path.join(__dirname, 'db', 'database.db');
  const invDbPath = path.join(__dirname, 'db', 'inventario.db');

  const main = new sqlite3.Database(mainDbPath);
  const inv = new sqlite3.Database(invDbPath);

  inv.serialize(() => {
    // Asegurar tabla inventario con columnas necesarias
    inv.run(`CREATE TABLE IF NOT EXISTS inventario (
      codigo TEXT PRIMARY KEY,
      nombre TEXT,
      stock INTEGER DEFAULT 0,
      stock_inicial INTEGER DEFAULT 0,
      precio REAL DEFAULT 0
    )`);

    // Leer todos los productos de la BD principal
    main.all(`SELECT codigo, nombre, stock, COALESCE(stock_inicial, stock) AS stock_inicial, COALESCE(precio, 0) AS precio FROM productos`, [], (err, rows) => {
      if (err) {
        console.error('Error leyendo productos:', err.message);
        main.close();
        inv.close();
        return callback && callback(err);
      }

      if (!rows || rows.length === 0) {
        main.close();
        inv.close();
        return callback && callback(null, { actualizados: 0 });
      }

      const upsert = inv.prepare(`INSERT INTO inventario (codigo, nombre, stock, stock_inicial, precio)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(codigo) DO UPDATE SET
          nombre = excluded.nombre,
          stock = excluded.stock,
          stock_inicial = excluded.stock_inicial,
          precio = excluded.precio`);

      let processed = 0;
      rows.forEach((p) => {
        upsert.run([p.codigo, p.nombre, p.stock, p.stock_inicial, p.precio], () => {
          processed++;
          if (processed === rows.length) {
            upsert.finalize(() => {
              main.close();
              inv.close();
              callback && callback(null, { actualizados: rows.length });
            });
          }
        });
      });
    });
  });
}

module.exports = syncInventario;





