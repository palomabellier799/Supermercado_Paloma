// AUTH/authController.js
const db = require('../db');
const bcrypt = require('bcrypt');

exports.login = (req, res) => {
  const { usuario, contraseña } = req.body;

  const query = `SELECT * FROM empleados WHERE usuario = ?`;
  db.get(query, [usuario], (err, usuarioDB) => {
    if (err) {
      console.error("Error en login:", err.message);
      return res.status(500).send("Error interno del servidor");
    }

    if (!usuarioDB) {
      return res.status(401).send("Usuario no encontrado");
    }

    // Comparar contraseña hasheada
    bcrypt.compare(contraseña, usuarioDB.contraseña, (err, result) => {
      if (err) {
        console.error("Error al comparar contraseña:", err.message);
        return res.status(500).send("Error interno del servidor");
      }

      if (!result) {
        return res.status(401).send("Contraseña incorrecta");
      }

      req.session.usuario = usuarioDB.usuario;
      req.session.rol = usuarioDB.rol;
      req.session.genero = usuarioDB.genero || 'm';

      res.redirect('/dashboard');
    });
  });
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/login');
};