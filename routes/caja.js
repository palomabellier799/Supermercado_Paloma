const express = require('express');
const path = require('path');
const db = require('../db');
const verificarRol = require('../middleware/verificarRol');

const router = express.Router();

router.get('/', verificarRol(['cajero', 'supervisor', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../public/caja.html'));
});

router.get('/api/producto', verificarRol(['cajero', 'supervisor', 'admin']), (req, res) => {
  const { codigo, nombre } = req.query;
  if (!codigo && !nombre) return res.status(400).json({ error: 'Enviar codigo o nombre' });

  let query = `SELECT p.id, p.codigo, p.nombre, p.stock,
                      COALESCE(p.stock_inicial, p.stock) as stock_inicial,
                      COALESCE(NULLIF(p.precio,0), (SELECT MAX(precio_unitario) FROM compras c WHERE c.producto_id = p.id AND c.precio_unitario > 0), 0) as precio
               FROM productos p WHERE 1=1`;
  const params = [];
  if (codigo) {
    query += ` AND UPPER(codigo) = ?`;
    params.push(String(codigo).toUpperCase());
  }
  if (nombre) {
    query += ` AND LOWER(nombre) LIKE ?`;
    params.push(`%${String(nombre).toLowerCase()}%`);
  }

  db.all(query + ' ORDER BY nombre LIMIT 10', params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const list = rows || [];
   
    const updIni = db.prepare(`UPDATE productos SET stock_inicial = stock WHERE id = ? AND IFNULL(stock_inicial,0) = 0`);
    list.forEach(r => { updIni.run([r.id]); });
    updIni.finalize();
    
    const normalized = list.map(r => ({ ...r, stock_inicial: r.stock_inicial || r.stock, precio: r.precio || 0 }));
    res.json(normalized);
  });
});

// Vender: descuenta stock, registra compra y suma puntos
router.post('/api/vender', verificarRol(['cajero', 'supervisor', 'admin']), (req, res) => {
  const { dni, items } = req.body; // items: [{productoId, cantidad, precioUnitario}]
  if (!dni || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'DNI e items requeridos' });
  }

  db.serialize(() => {
    // Prevalidar stock
    const ids = items.map(i => i.productoId);
    const placeholders = ids.map(() => '?').join(',');
    db.all(`SELECT id, stock FROM productos WHERE id IN (${placeholders})`, ids, (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      const stockMap = new Map(rows.map(r => [r.id, r.stock]));
      for (const it of items) {
        const needed = parseInt(it.cantidad, 10) || 0;
        const avail = stockMap.get(it.productoId) ?? -1;
        if (avail < needed) {
          return res.status(400).json({ error: `Stock insuficiente para producto ${it.productoId}` });
        }
      }

      db.get(`SELECT id FROM clientes WHERE dni = ?`, [dni], (err2, cliente) => {
        if (err2) return res.status(500).json({ error: 'DB error' });

        const ensureCliente = (cb) => {
          if (cliente) return cb(cliente.id);
          db.run(`INSERT INTO clientes (nombre, dni, puntos) VALUES (?, ?, 0)`, [dni, dni], function(e) {
            if (e) return res.status(500).json({ error: 'No se pudo crear cliente' });
            cb(this.lastID);
          });
        };

        ensureCliente((clienteId) => {
          let total = 0;
          const fecha = new Date().toISOString().slice(0, 10);

          db.run('BEGIN TRANSACTION');
          const updateStock = db.prepare(`UPDATE productos SET stock = stock - ? WHERE id = ?`);
          const insertCompra = db.prepare(`INSERT INTO compras (cliente_id, producto_id, cantidad, fecha, precio_unitario, importe) VALUES (?, ?, ?, ?, ?, ?)`);

          let processed = 0; let failed = false;
          items.forEach((it) => {
            const cantidad = parseInt(it.cantidad, 10) || 0;
            const precioUnit = parseFloat(it.precioUnitario || 0);
            const importe = cantidad * precioUnit;
            total += importe;

            updateStock.run([cantidad, it.productoId], function(usErr) {
              if (usErr || this.changes === 0) { failed = true; }
              insertCompra.run([clienteId, it.productoId, cantidad, fecha, precioUnit, importe], (icErr) => {
                if (icErr) { failed = true; }
                processed++;
                if (processed === items.length) {
                  updateStock.finalize();
                  insertCompra.finalize();
                  if (failed) {
                    return db.run('ROLLBACK', () => res.status(500).json({ error: 'Error al registrar la venta' }));
                  }
                  // NO actualizar precio del producto después de venta - mantener precio del CSV
                  // const updatePrecio = db.prepare(`UPDATE productos SET precio = ? WHERE id = ?`);
                  // items.forEach(it2 => updatePrecio.run([parseFloat(it2.precioUnitario||0), it2.productoId]));
                  // updatePrecio.finalize();
                  const puntos = Math.floor(total / 100);
                  db.run(`UPDATE clientes SET puntos = puntos + ? WHERE id = ?`, [puntos, clienteId], (puErr) => {
                    if (puErr) {
                      return db.run('ROLLBACK', () => res.status(500).json({ error: 'Error al sumar puntos' }));
                    }
                    db.run('COMMIT', () => res.json({ message: 'Venta registrada', total, puntosSumados: puntos }));
                  });
                }
              });
            });
          });
        });
      });
    });
  });
});

// Reponer: aumenta stock
router.post('/api/reponer', verificarRol(['cajero', 'supervisor', 'admin']), (req, res) => {
  const { productoId, cantidad } = req.body;
  const qty = parseInt(cantidad, 10) || 0;
  if (!productoId || qty <= 0) return res.status(400).json({ error: 'Datos inválidos' });

  // Aumentar stock actual; si supera el inicial, elevar stock_inicial al nuevo valor
  db.run(`UPDATE productos 
          SET stock = stock + ?,
              stock_inicial = CASE 
                WHEN COALESCE(stock_inicial, 0) < stock + ? THEN stock + ?
                ELSE stock_inicial 
              END
          WHERE id = ?`, [qty, qty, qty, productoId], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Stock repuesto', agregado: qty });
  });
});

module.exports = router;


