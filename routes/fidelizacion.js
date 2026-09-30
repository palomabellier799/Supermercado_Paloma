// routes/fidelizacion.js
const express = require('express');
const path = require('path');
const db = require('../db'); // usamos la base unificada
const verificarRol = require('../middleware/verificarRol');

const router = express.Router();

//Vista HTML para buscar clientes (solo supervisor y admin)
router.get('/', verificarRol(['supervisor', 'admin']), (req, res) => {
  res.sendFile(path.join(__dirname, '../public/fidelizacion.html'));
});

//API: buscar cliente por DNI
router.get('/api/cliente', verificarRol(['supervisor', 'admin']), (req, res) => {
  const dni = req.query.dni;

  if (!dni) {
    return res.status(400).json({ error: "Debe enviar un DNI" });
  }

  db.get(`SELECT * FROM clientes WHERE dni = ?`, [dni], (err, cliente) => {
    if (err) {
      console.error("Error en consulta:", err.message);
      return res.status(500).json({ error: "Error en la base de datos" });
    }

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    // Calcular gasto del mes actual e incluir puntos
    const inicioMes = new Date();
    inicioMes.setDate(1);
    const inicio = inicioMes.toISOString().slice(0,10);

    const queryGasto = `SELECT COALESCE(SUM(importe),0) as totalMes
                        FROM compras
                        WHERE cliente_id = ? AND fecha >= ?`;
    db.get(queryGasto, [cliente.id, inicio], (e2, row2) => {
      if (e2) {
        console.error("Error en gasto mensual:", e2.message);
        return res.status(500).json({ error: "Error en la base de datos" });
      }
      res.json({ ...cliente, gasto_mensual: row2.totalMes });
    });
  });
});

//API: buscar clientes por nombre o DNI con autocompletado
router.get('/api/buscar', verificarRol(['supervisor', 'admin']), (req, res) => {
  const nombre = req.query.nombre;
  const dni = req.query.dni;
  const limit = parseInt(req.query.limit) || 10;

  let query, params;

  if (nombre) {
    query = `SELECT * FROM clientes WHERE nombre LIKE ? ORDER BY nombre LIMIT ?`;
    params = [`%${nombre}%`, limit];
  } else if (dni) {
    query = `SELECT * FROM clientes WHERE dni LIKE ? ORDER BY dni LIMIT ?`;
    params = [`%${dni}%`, limit];
  } else {
    return res.status(400).json({ error: "Debe enviar un nombre o DNI" });
  }

  db.all(query, params, (err, clientes) => {
    if (err) {
      console.error("Error en consulta:", err.message);
      return res.status(500).json({ error: "Error en la base de datos" });
    }
    if (!clientes || clientes.length === 0) return res.json([]);

    // Adjuntar gasto mensual por cliente (simplificado: sincrónico por cada uno)
    const inicioMes = new Date();
    inicioMes.setDate(1);
    const inicio = inicioMes.toISOString().slice(0,10);

    let processed = 0;
    const out = [];
    clientes.forEach(c => {
      db.get(`SELECT COALESCE(SUM(importe),0) as totalMes FROM compras WHERE cliente_id = ? AND fecha >= ?`, [c.id, inicio], (e2, row2) => {
        processed++;
        out.push({ ...c, gasto_mensual: row2 ? row2.totalMes : 0 });
        if (processed === clientes.length) {
          res.json(out);
        }
      });
    });
  });
});

module.exports = router;