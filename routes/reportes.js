const express = require('express');
const path = require('path');
const db = require('../db');
const verificarRol = require('../middleware/verificarRol');

const router = express.Router();

// Vista de reportes (supervisor y admin)
router.get('/', verificarRol(['supervisor', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../public/reportes.html'));
});

// Ventas por día (últimos 30 días)
router.get('/api/ventas-diarias', verificarRol(['supervisor', 'admin']), (req, res) => {
  const sql = `
    SELECT fecha, ROUND(SUM(importe),2) as total, COUNT(*) as operaciones, SUM(cantidad) as unidades
    FROM compras
    WHERE fecha >= date('now','-30 day')
    GROUP BY fecha
    ORDER BY fecha
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

// Top productos por importe (últimos 30 días)
router.get('/api/top-productos', verificarRol(['supervisor', 'admin']), (req, res) => {
  const sql = `
    SELECT p.codigo, p.nombre, SUM(c.cantidad) as unidades, ROUND(SUM(c.importe),2) as total
    FROM compras c
    JOIN productos p ON p.id = c.producto_id
    WHERE c.fecha >= date('now','-30 day')
      AND c.cantidad > 0
    GROUP BY c.producto_id
    ORDER BY total DESC
    LIMIT 10
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

// Top productos por unidades (últimos 30 días)
router.get('/api/top-unidades', verificarRol(['supervisor', 'admin']), (req, res) => {
  const sql = `
    SELECT p.codigo, p.nombre, SUM(c.cantidad) as unidades
    FROM compras c
    JOIN productos p ON p.id = c.producto_id
    WHERE c.fecha >= date('now','-30 day')
      AND c.cantidad > 0
    GROUP BY c.producto_id
    ORDER BY unidades DESC
    LIMIT 10
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

module.exports = router;


