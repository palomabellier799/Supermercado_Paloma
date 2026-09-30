const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

console.log('=== DIAGNÓSTICO COMPLETO DE PRECIOS ===\n');

// 1. Leer CSV
console.log('1. LEYENDO CSV...\n');
const productosCSV = [];

fs.createReadStream(path.join(__dirname, 'productos.csv'))
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    console.log('Fila CSV raw:', JSON.stringify(row));
    
    if (row.codigo && row.descripcion) {
      const precioRaw = row.precio;
      const precioParseado = parseFloat(String(row.precio).replace(',', '.'));
      
      productosCSV.push({
        codigo: row.codigo,
        descripcion: row.descripcion,
        precioRaw: precioRaw,
        precioParseado: precioParseado
      });
    }
  })
  .on('end', () => {
    console.log(`\n✓ Total productos en CSV: ${productosCSV.length}\n`);
    
    // Mostrar primeros 3
    console.log('Primeros 3 productos del CSV:');
    productosCSV.slice(0, 3).forEach(p => {
      console.log(`  ${p.codigo} - ${p.descripcion}`);
      console.log(`    Precio raw: "${p.precioRaw}"`);
      console.log(`    Precio parseado: ${p.precioParseado}`);
    });
    
    // Buscar 000B específicamente
    const leche = productosCSV.find(p => p.codigo === '000B');
    if (leche) {
      console.log(`\n*** PRODUCTO 000B ***`);
      console.log(`  Descripción: ${leche.descripcion}`);
      console.log(`  Precio raw: "${leche.precioRaw}"`);
      console.log(`  Precio parseado: ${leche.precioParseado}`);
    }
    
    // 2. Verificar base de datos
    console.log('\n\n2. VERIFICANDO BASE DE DATOS...\n');
    
    const dbPath = path.join(__dirname, 'db', 'database.db');
    const db = new sqlite3.Database(dbPath);
    
    // Verificar esquema
    db.all(`PRAGMA table_info(productos)`, [], (err, columns) => {
      if (err) {
        console.error('Error al leer esquema:', err.message);
        db.close();
        return;
      }
      
      console.log('Columnas de la tabla productos:');
      columns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
      });
      
      const tienePrecio = columns.some(col => col.name === 'precio');
      const tieneStockInicial = columns.some(col => col.name === 'stock_inicial');
      
      console.log(`\n  ¿Tiene columna precio? ${tienePrecio ? '✓ SÍ' : '✗ NO'}`);
      console.log(`  ¿Tiene columna stock_inicial? ${tieneStockInicial ? '✓ SÍ' : '✗ NO'}`);
      
      // Verificar datos actuales
      console.log('\n\n3. DATOS ACTUALES EN BD...\n');
      
      db.all(`SELECT codigo, nombre, precio, stock, stock_inicial FROM productos ORDER BY codigo LIMIT 5`, [], (err2, rows) => {
        if (err2) {
          console.error('Error al leer productos:', err2.message);
          db.close();
          return;
        }
        
        console.log('Primeros 5 productos en BD:');
        rows.forEach(row => {
          console.log(`  ${row.codigo} - ${row.nombre}`);
          console.log(`    Precio: ${row.precio}`);
          console.log(`    Stock: ${row.stock} / Stock inicial: ${row.stock_inicial}`);
        });
        
        // Buscar 000B en BD
        db.get(`SELECT * FROM productos WHERE codigo = '000B'`, [], (err3, producto) => {
          console.log('\n\n*** PRODUCTO 000B EN BD ***');
          if (err3 || !producto) {
            console.log('  ✗ NO ENCONTRADO');
          } else {
            console.log(`  Código: ${producto.codigo}`);
            console.log(`  Nombre: ${producto.nombre}`);
            console.log(`  Precio: ${producto.precio}`);
            console.log(`  Stock: ${producto.stock}`);
            console.log(`  Stock inicial: ${producto.stock_inicial}`);
          }
          
          // 4. ACTUALIZAR PRECIO DE 000B
          console.log('\n\n4. ACTUALIZANDO PRECIO DE 000B...\n');
          
          if (leche) {
            db.run(`UPDATE productos SET precio = ? WHERE codigo = ?`, [leche.precioParseado, '000B'], function(err4) {
              if (err4) {
                console.error('  ✗ Error al actualizar:', err4.message);
              } else {
                console.log(`  ✓ Actualizado: ${this.changes} fila(s)`);
                console.log(`  Nuevo precio: ${leche.precioParseado}`);
                
                // Verificar actualización
                db.get(`SELECT precio FROM productos WHERE codigo = '000B'`, [], (err5, result) => {
                  if (!err5 && result) {
                    console.log(`  Precio verificado en BD: ${result.precio}`);
                    console.log(`  ¿Coincide con CSV? ${result.precio == leche.precioParseado ? '✓ SÍ' : '✗ NO'}`);
                  }
                  
                  db.close();
                  console.log('\n=== FIN DEL DIAGNÓSTICO ===');
                });
              }
            });
          } else {
            db.close();
            console.log('  ✗ No se encontró 000B en CSV');
            console.log('\n=== FIN DEL DIAGNÓSTICO ===');
          }
        });
      });
    });
  })
  .on('error', (error) => {
    console.error('Error al leer CSV:', error.message);
  });
