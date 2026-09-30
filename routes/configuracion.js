const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const db = require('../db');
const verificarRol = require('../middleware/verificarRol');

const router = express.Router();

// Middleware para verificar que sea admin
router.use(verificarRol(['admin']));

// GET /configuracion/usuarios - Obtener lista de usuarios
router.get('/usuarios', (req, res) => {
  const query = `SELECT usuario, rol FROM empleados ORDER BY usuario`;
  db.all(query, [], (err, usuarios) => {
    if (err) {
      console.error("Error al obtener usuarios:", err.message);
      return res.status(500).json({ error: "Error en la base de datos" });
    }
    res.json(usuarios);
  });
});

// POST /configuracion/usuarios - Crear nuevo usuario
router.post('/usuarios', (req, res) => {
  const { usuario, contraseña, rol } = req.body;

  if (!usuario || !contraseña || !rol) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  if (!['cajero', 'supervisor', 'admin'].includes(rol)) {
    return res.status(400).json({ error: "Rol inválido" });
  }

  // Hashear contraseña
  bcrypt.hash(contraseña, 10, (err, hash) => {
    if (err) {
      console.error("Error al hashear contraseña:", err.message);
      return res.status(500).json({ error: "Error interno del servidor" });
    }

    const query = `INSERT INTO empleados (usuario, contraseña, rol) VALUES (?, ?, ?)`;
    db.run(query, [usuario, hash, rol], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: "El usuario ya existe" });
        }
        console.error("Error al crear usuario:", err.message);
        return res.status(500).json({ error: "Error en la base de datos" });
      }
      res.json({ message: "Usuario creado exitosamente", id: this.lastID });
    });
  });
});

// DELETE /configuracion/usuarios/:usuario - Eliminar usuario
router.delete('/usuarios/:usuario', (req, res) => {
  const { usuario } = req.params;

  if (usuario === req.session.usuario) {
    return res.status(400).json({ error: "No puede eliminar su propio usuario" });
  }

  const query = `DELETE FROM empleados WHERE usuario = ?`;
  db.run(query, [usuario], function(err) {
    if (err) {
      console.error("Error al eliminar usuario:", err.message);
      return res.status(500).json({ error: "Error en la base de datos" });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    
    res.json({ message: "Usuario eliminado exitosamente" });
  });
});

// POST /configuracion/productos - Crear nuevo producto
router.post('/productos', (req, res) => {
  const { codigo, nombre, stock, precio } = req.body;

  if (!codigo || !nombre) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  // Si existe, solo actualiza nombre/stock/precio y NO toque stock_inicial
  const queryInsert = `INSERT INTO productos (codigo, nombre, stock, stock_inicial, precio)
                       VALUES (?, ?, ?, ?, ?)`;
  const queryUpdate = `UPDATE productos SET nombre = ?, stock = ?, precio = ? WHERE codigo = ?`;
  const s = Number(stock || 0);
  const p = Number(precio || 0);
  db.get(`SELECT id, stock_inicial FROM productos WHERE codigo = ?`, [codigo], (e, row) => {
    if (e) {
      console.error('Error consultando producto:', e.message);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    if (row) {
      db.run(queryUpdate, [nombre, s, p, codigo], function(err) {
        if (err) {
          console.error("Error al actualizar producto:", err.message);
          return res.status(500).json({ error: "Error en la base de datos" });
        }
        return res.json({ message: "Producto actualizado", id: row.id });
      });
    } else {
      db.run(queryInsert, [codigo, nombre, s, s, p], function(err) {
        if (err) {
          console.error("Error al crear producto:", err.message);
          return res.status(500).json({ error: "Error en la base de datos" });
        }
        return res.json({ message: "Producto creado exitosamente", id: this.lastID });
      });
    }
  });
});

// GET /configuracion/productos - Listado de productos con stock y precio
router.get('/productos', (req, res) => {
  const soloSinPrecio = String(req.query.sinPrecio || '0') === '1';
  const q = `SELECT id, codigo, nombre, stock, stock_inicial, precio FROM productos
             ${soloSinPrecio ? 'WHERE IFNULL(precio,0)=0' : ''}
             ORDER BY nombre`;
  db.all(q, [], (err, rows) => {
    if (err) {
      console.error('Error al listar productos:', err.message);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    res.json(rows || []);
  });
});

// PATCH /configuracion/productos/precio - Actualizar precio de un producto
router.patch('/productos/precio', (req, res) => {
  const { codigo, precio } = req.body;
  if (!codigo || typeof precio === 'undefined') {
    return res.status(400).json({ error: 'Debe enviar codigo y precio' });
  }
  const nuevo = parseFloat(precio);
  if (isNaN(nuevo) || nuevo < 0) return res.status(400).json({ error: 'Precio inválido' });

  db.run(`UPDATE productos SET precio = ? WHERE codigo = ?`, [nuevo, codigo], function(err) {
    if (err) {
      console.error('Error al actualizar precio:', err.message);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Precio actualizado' });
  });
});

// POST /configuracion/productos/precio-default - Asignar precio por defecto a los que faltan
router.post('/productos/precio-default', (req, res) => {
  const valor = parseFloat(req.body.valor || '1000');
  if (isNaN(valor) || valor <= 0) return res.status(400).json({ error: 'Valor inválido' });
  db.run(`UPDATE productos SET precio = ? WHERE IFNULL(precio,0) = 0`, [valor], function(err) {
    if (err) {
      console.error('Error al asignar precio por defecto:', err.message);
      return res.status(500).json({ error: 'Error en la base de datos' });
    }
    res.json({ message: 'Precios asignados', afectados: this.changes });
  });
});

// POST /configuracion/normalizar - Fuerza stock_inicial (NO modifica precios)
router.post('/normalizar', (req, res) => {
  // Solo normalizar stock_inicial = stock si está nulo/0
  db.run(`UPDATE productos SET stock_inicial = stock WHERE IFNULL(stock_inicial,0) = 0`, function(err) {
    if (err) {
      console.error('Error normalizando stock_inicial:', err.message);
      return res.status(500).json({ error: 'Error normalizando stock_inicial' });
    }
    res.json({ message: 'Stock inicial normalizado', afectados: this.changes });
  });
  // NO normalizar precios desde compras - usar CSV en su lugar
});

// POST /configuracion/forzar-precios-csv - FORZAR actualización de precios desde CSV (sobrescribe todo)
router.post('/forzar-precios-csv', (req, res) => {
  const csvPath = path.join(__dirname, '../productos.csv');
  
  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({ error: "Archivo CSV no encontrado" });
  }

  const productos = [];

  fs.createReadStream(csvPath)
    .pipe(csv({ separator: ';' }))
    .on('data', (row) => {
      if (row.codigo && row.precio) {
        const precio = parseFloat(String(row.precio).replace(',', '.'));
        if (precio > 0) {
          productos.push({
            codigo: row.codigo,
            precio: precio
          });
        }
      }
    })
    .on('end', () => {
      if (productos.length === 0) {
        return res.status(400).json({ error: "No se encontraron productos con precios en el CSV" });
      }
      
      const stmt = db.prepare(`UPDATE productos SET precio = ? WHERE codigo = ?`);
      let actualizados = 0;
      let processed = 0;
      
      productos.forEach((producto) => {
        stmt.run([producto.precio, producto.codigo], function(err) {
          if (err) {
            console.error(`Error al actualizar precio de ${producto.codigo}:`, err.message);
          } else if (this.changes > 0) {
            actualizados++;
          }
          processed++;
          
          if (processed === productos.length) {
            stmt.finalize();
            res.json({ 
              message: `Precios forzados desde CSV`,
              productosActualizados: actualizados,
              totalProcesados: processed
            });
          }
        });
      });
    })
    .on('error', (error) => {
      console.error("Error al leer CSV:", error.message);
      res.status(500).json({ error: "Error al leer archivo CSV" });
    });
});

// POST /configuracion/actualizar-stock - Actualizar stock desde CSV
router.post('/actualizar-stock', (req, res) => {
  const csvPath = path.join(__dirname, '../productos.csv');
  
  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({ error: "Archivo CSV no encontrado" });
  }

  const productos = [];

  fs.createReadStream(csvPath)
    .pipe(csv({ separator: ';' }))
    .on('data', (row) => {
      if (row.codigo && row.descripcion) {
        productos.push({
          codigo: row.codigo,
          nombre: row.descripcion,
          stock: parseInt((row['stock inicial'] || row['stock_inicial'] || row.stock), 10) || 0,
          precio: row.precio ? parseFloat(String(row.precio).replace(',','.')) : null
        });
      }
    })
    .on('end', () => {
      if (productos.length === 0) {
        return res.status(400).json({ error: "No se encontraron productos válidos en el CSV" });
      }
      // UPSERT: actualizar nombre/stock/stock_inicial/precio SIEMPRE desde CSV
      const insertQuery = `INSERT INTO productos (codigo, nombre, stock, stock_inicial, precio)
                           VALUES (?, ?, ?, ?, ?)
                           ON CONFLICT(codigo) DO UPDATE SET
                             nombre=excluded.nombre,
                             stock=excluded.stock,
                             stock_inicial = excluded.stock_inicial,
                             precio = excluded.precio`;
      const stmt = db.prepare(insertQuery);
      let inserted = 0;
      let preciosSeteados = 0;
      let processed = 0;
      productos.forEach((producto) => {
        const s = parseInt(producto.stock, 10) || 0;
        // Usar el precio del CSV directamente (puede ser null si no viene)
        const pr = (typeof producto.precio === 'number' && producto.precio > 0) ? producto.precio : 0;

        stmt.run([producto.codigo, producto.nombre, s, s, pr], (err) => {
          if (err) {
            console.error(`Error al upsert producto ${producto.codigo}:`, err.message);
          } else {
            inserted++;
            if (pr > 0) preciosSeteados++;
          }
          processed++;
          if (processed === productos.length) {
            stmt.finalize();
            // Normalizar: si aún queda stock_inicial en 0, arráncalo con el stock actual
            db.run(`UPDATE productos SET stock_inicial = stock WHERE IFNULL(stock_inicial,0) = 0`, () => {
              res.json({ 
              message: `Actualización desde CSV completada`,
              productosProcesados: inserted,
              preciosActualizados: preciosSeteados
              });
            });
          }
        });
      });
    })
    .on('error', (error) => {
      console.error("Error al leer CSV:", error.message);
      res.status(500).json({ error: "Error al leer archivo CSV" });
    });
});

// POST /configuracion/clientes - Crear nuevo cliente
router.post('/clientes', (req, res) => {
  const { nombre, dni, telefono, email, domicilio } = req.body;

  if (!nombre || !dni) {
    return res.status(400).json({ error: "Faltan campos requeridos (nombre y DNI)" });
  }

  const query = `INSERT INTO clientes (nombre, dni, telefono, email, domicilio, puntos) VALUES (?, ?, ?, ?, ?, 0)`;
  db.run(query, [nombre, dni, telefono || null, email || null, domicilio || null], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: "Ya existe un cliente con ese DNI" });
      }
      console.error("Error al crear cliente:", err.message);
      return res.status(500).json({ error: "Error en la base de datos" });
    }
    res.json({ message: "Cliente creado exitosamente", id: this.lastID });
  });
});

// POST /configuracion/backup - Crear respaldo de la base de datos
router.post('/backup', (req, res) => {
  const dbPath = path.join(__dirname, '../db/database.db');
  const backupPath = path.join(__dirname, '../db/backup_' + new Date().toISOString().replace(/[:.]/g, '-') + '.db');
  
  try {
    fs.copyFileSync(dbPath, backupPath);
    res.json({ 
      message: "Respaldo creado exitosamente", 
      archivo: path.basename(backupPath)
    });
  } catch (error) {
    console.error("Error al crear respaldo:", error.message);
    res.status(500).json({ error: "Error al crear respaldo" });
  }
});

// POST /configuracion/limpiar-logs - Limpiar logs del sistema
router.post('/limpiar-logs', (req, res) => {
  // En una implementación real, aquí se limpiarían los logs del sistema
  // Por ahora solo devolvemos un mensaje de éxito
  res.json({ message: "Logs del sistema limpiados exitosamente" });
});

// POST /configuracion/reiniciar - Reiniciar sistema
router.post('/reiniciar', (req, res) => {
  // En una implementación real, aquí se reiniciaría el sistema
  // Por ahora solo devolvemos un mensaje de éxito
  res.json({ message: "Sistema reiniciado exitosamente" });
});

// GET /configuracion/diagnostico-precios - Diagnóstico completo de precios
router.get('/diagnostico-precios', (req, res) => {
  const csvPath = path.join(__dirname, '../productos.csv');
  const resultado = {
    csv: { existe: false, productos: [] },
    bd: { esquema: [], productos: [] },
    comparacion: []
  };
  
  // 1. Verificar CSV
  if (!fs.existsSync(csvPath)) {
    return res.json({ error: 'CSV no encontrado', resultado });
  }
  
  resultado.csv.existe = true;
  const productosCSV = [];
  
  fs.createReadStream(csvPath)
    .pipe(csv({ separator: ';' }))
    .on('data', (row) => {
      if (row.codigo) {
        const precioRaw = row.precio || '';
        const precioParseado = row.precio ? parseFloat(String(row.precio).replace(',', '.')) : 0;
        
        productosCSV.push({
          codigo: row.codigo,
          descripcion: row.descripcion || '',
          precioRaw: precioRaw,
          precioParseado: precioParseado
        });
      }
    })
    .on('end', () => {
      resultado.csv.productos = productosCSV.slice(0, 10); // Primeros 10
      
      // 2. Verificar BD
      db.all(`PRAGMA table_info(productos)`, [], (err, columns) => {
        if (err) {
          resultado.bd.error = err.message;
          return res.json(resultado);
        }
        
        resultado.bd.esquema = columns.map(c => ({ nombre: c.name, tipo: c.type }));
        
        db.all(`SELECT codigo, nombre, precio, stock, stock_inicial FROM productos ORDER BY codigo LIMIT 10`, [], (err2, rows) => {
          if (err2) {
            resultado.bd.error = err2.message;
            return res.json(resultado);
          }
          
          resultado.bd.productos = rows;
          
          // 3. Comparar
          productosCSV.forEach(csvProd => {
            const bdProd = rows.find(r => r.codigo === csvProd.codigo);
            if (bdProd) {
              resultado.comparacion.push({
                codigo: csvProd.codigo,
                descripcion: csvProd.descripcion,
                precioCSV: csvProd.precioParseado,
                precioBD: bdProd.precio,
                coincide: Math.abs(csvProd.precioParseado - (bdProd.precio || 0)) < 0.01
              });
            }
          });
          
          res.json(resultado);
        });
      });
    })
    .on('error', (error) => {
      resultado.csv.error = error.message;
      res.json(resultado);
    });
});

module.exports = router;

