function verificarRol(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.session || !req.session.usuario) {
      return res.redirect('/login'); // Si no está logueado
    }

    if (!rolesPermitidos.includes(req.session.rol)) {
      return res.status(403).send('Acceso denegado');
    }

    next(); 
  };
}

module.exports = verificarRol;