const express = require('express');
const db = require('../db');
const verificarRol = require('../middleware/verificarRol');
const path = require('path');

const router = express.Router();

// GET /dashboard - Página principal del dashboard (HTML)
router.get('/', verificarRol(['supervisor', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// GET /dashboard/api/estadisticas - Obtener todas las estadísticas para el dashboard
router.get('/api/estadisticas', verificarRol(['cajero', 'supervisor', 'admin']), (req, res) => {
  const estadisticas = {
    ventasHoy: { total: 0, cantidad: 0 },
    ventasMes: { total: 0, cantidad: 0 },
    productosStockBajo: [],
    topProductos: [],
    clientesTop: [],
    ventasPorDia: [],
    alertas: []
  };

  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  db.serialize(() => {
    // 1. Ventas de hoy
    db.get(`
      SELECT COUNT(*) as cantidad, COALESCE(SUM(importe), 0) as total
      FROM compras
      WHERE fecha = ?
    `, [hoy], (err, row) => {
      if (!err && row) {
        estadisticas.ventasHoy = { total: row.total || 0, cantidad: row.cantidad || 0 };
      }
    });

    // 2. Ventas del mes
    db.get(`
      SELECT COUNT(*) as cantidad, COALESCE(SUM(importe), 0) as total
      FROM compras
      WHERE fecha >= ?
    `, [inicioMes], (err, row) => {
      if (!err && row) {
        estadisticas.ventasMes = { total: row.total || 0, cantidad: row.cantidad || 0 };
      }
    });

    // 3. Productos con stock bajo (menos del 20% del stock inicial)
    db.all(`
      SELECT codigo, nombre, stock, stock_inicial, precio,
             ROUND((stock * 100.0 / NULLIF(stock_inicial, 0)), 1) as porcentaje
      FROM productos
      WHERE stock_inicial > 0 
        AND stock < (stock_inicial * 0.2)
      ORDER BY porcentaje ASC
      LIMIT 10
    `, [], (err, rows) => {
      if (!err) {
        estadisticas.productosStockBajo = rows || [];
        // Agregar alertas
        rows.forEach(p => {
          estadisticas.alertas.push({
            tipo: 'stock_bajo',
            mensaje: `${p.nombre} tiene stock bajo (${p.stock} unidades, ${p.porcentaje}%)`,
            prioridad: p.porcentaje < 10 ? 'alta' : 'media',
            producto: p
          });
        });
      }
    });

    // 4. Top 10 productos más vendidos (del mes)
    db.all(`
      SELECT p.codigo, p.nombre, p.precio, p.stock,
             SUM(c.cantidad) as total_vendido,
             SUM(c.importe) as ingresos
      FROM compras c
      JOIN productos p ON c.producto_id = p.id
      WHERE c.fecha >= ?
      GROUP BY p.id
      ORDER BY total_vendido DESC
      LIMIT 10
    `, [inicioMes], (err, rows) => {
      if (!err) {
        estadisticas.topProductos = rows || [];
      }
    });

    // 5. Top clientes del mes
    db.all(`
      SELECT cl.nombre, cl.dni, cl.puntos,
             COUNT(c.id) as compras,
             COALESCE(SUM(c.importe), 0) as total_gastado
      FROM clientes cl
      LEFT JOIN compras c ON cl.id = c.cliente_id AND c.fecha >= ?
      GROUP BY cl.id
      HAVING compras > 0
      ORDER BY total_gastado DESC
      LIMIT 5
    `, [inicioMes], (err, rows) => {
      if (!err) {
        estadisticas.clientesTop = rows || [];
      }
    });

    // 6. Ventas por día (últimos 7 días)
    db.all(`
      SELECT fecha, 
             COUNT(*) as cantidad,
             COALESCE(SUM(importe), 0) as total
      FROM compras
      WHERE fecha >= date('now', '-7 days')
      GROUP BY fecha
      ORDER BY fecha ASC
    `, [], (err, rows) => {
      if (!err) {
        estadisticas.ventasPorDia = rows || [];
      }
      
      // Enviar respuesta después de la última consulta
      res.json(estadisticas);
    });
  });
});

// GET /dashboard/api/alertas - Obtener solo alertas
router.get('/api/alertas', verificarRol(['cajero', 'supervisor', 'admin']), (req, res) => {
  const alertas = [];

  // Productos con stock bajo
  db.all(`
    SELECT codigo, nombre, stock, stock_inicial,
           ROUND((stock * 100.0 / NULLIF(stock_inicial, 0)), 1) as porcentaje
    FROM productos
    WHERE stock_inicial > 0 
      AND stock < (stock_inicial * 0.2)
    ORDER BY porcentaje ASC
  `, [], (err, rows) => {
    if (!err && rows) {
      rows.forEach(p => {
        alertas.push({
          tipo: 'stock_bajo',
          mensaje: `${p.nombre} (${p.codigo}) - Stock: ${p.stock} (${p.porcentaje}%)`,
          prioridad: p.porcentaje < 10 ? 'alta' : 'media',
          producto: p
        });
      });
    }

    // Productos sin precio
    db.all(`
      SELECT codigo, nombre, stock
      FROM productos
      WHERE IFNULL(precio, 0) = 0
      LIMIT 5
    `, [], (err2, rows2) => {
      if (!err2 && rows2) {
        rows2.forEach(p => {
          alertas.push({
            tipo: 'sin_precio',
            mensaje: `${p.nombre} (${p.codigo}) no tiene precio asignado`,
            prioridad: 'media',
            producto: p
          });
        });
      }

      res.json(alertas);
    });
  });
});

module.exports = router;
