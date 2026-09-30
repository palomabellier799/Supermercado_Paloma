// Script de prueba rápida para verificar el parseo del CSV
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

console.log('=== VERIFICANDO PARSEO DE CSV ===\n');

const productos = [];

fs.createReadStream(path.join(__dirname, 'productos.csv'))
  .pipe(csv({ separator: ';' }))
  .on('data', (row) => {
    if (row.codigo && row.precio) {
      const precioOriginal = row.precio;
      const precioParseado = parseFloat(String(row.precio).replace(',', '.'));
      
      productos.push({
        codigo: row.codigo,
        descripcion: row.descripcion,
        precioOriginal: precioOriginal,
        precioParseado: precioParseado
      });
    }
  })
  .on('end', () => {
    console.log(`Total productos con precio: ${productos.length}\n`);
    
    // Mostrar primeros 5
    console.log('Primeros 5 productos:');
    productos.slice(0, 5).forEach(p => {
      console.log(`${p.codigo} - ${p.descripcion}`);
      console.log(`  CSV: "${p.precioOriginal}" → Parseado: $${p.precioParseado}`);
      console.log('');
    });
    
    // Buscar específicamente 000B
    const leche = productos.find(p => p.codigo === '000B');
    if (leche) {
      console.log('=== PRODUCTO 000B (Leche descremada) ===');
      console.log(`CSV: "${leche.precioOriginal}"`);
      console.log(`Parseado: $${leche.precioParseado}`);
      console.log(`Esperado: $1300`);
      console.log(`¿Correcto? ${leche.precioParseado === 1300 ? '✓ SÍ' : '✗ NO'}`);
    }
  })
  .on('error', (error) => {
    console.error('Error:', error.message);
  });
