const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Usa la misma base de datos del sistema
const dbPath = path.join(__dirname, 'db', 'database.db');
const db = new sqlite3.Database(dbPath);

// No borrar la tabla; hacer UPSERT y respetar el esquema oficial (codigo UNIQUE, nombre, stock, stock_inicial, precio)
const productos = [];

fs.createReadStream(path.join(__dirname, 'productos.csv'))
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    if (!row.codigo || !row.descripcion) return;
    const stockCsv = parseInt((row['stock inicial'] || row['stock_inicial'] || row.stock), 10) || 0;
    const precioCsv = row.precio ? parseFloat(String(row.precio).replace(',', '.')) : 0;
    productos.push({
      codigo: row.codigo,
      nombre: row.descripcion,
      stock: stockCsv,
      stockInicial: stockCsv,
      precio: precioCsv
    });
  })
  .on('end', () => {
    db.serialize(() => {
      // Asegurar columnas
      db.run("ALTER TABLE productos ADD COLUMN stock_inicial INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE productos ADD COLUMN precio REAL DEFAULT 0", () => {});

      const upsert = db.prepare(`
        INSERT INTO productos (codigo, nombre, stock, stock_inicial, precio)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(codigo) DO UPDATE SET
          nombre = excluded.nombre,
          stock = excluded.stock,
          stock_inicial = excluded.stock_inicial,
          precio = excluded.precio
      `);

      let count = 0;
      productos.forEach(p => {
        upsert.run([p.codigo, p.nombre, p.stock, p.stockInicial, p.precio], (err) => {
          if (err) console.error('Error upserting', p.codigo, err.message);
          count++;
          if (count === productos.length) {
            upsert.finalize(() => {
              console.log(`Importación CSV completada. Productos procesados: ${count}`);
              db.close();
            });
          }
        });
      });
    });
  });