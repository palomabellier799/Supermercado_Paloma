const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

// Configuración básica
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sesiones
app.use(session({
  secret: 'claveSecreta',
  resave: false,
  saveUninitialized: true
}));

// Archivos estáticos y vistas
app.use(express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'views')));
app.set('views', path.join(__dirname, 'views'));

// Migraciones ligeras en arranque para columnas nuevas
const db = require('./db');

// Ejecutar migraciones
db.run("ALTER TABLE productos ADD COLUMN stock_inicial INTEGER DEFAULT 0", (err) => {
  if (err && !/duplicate column name/i.test(err.message)) {
    console.error('Error agregando stock_inicial:', err.message);
  }
});

db.run("ALTER TABLE productos ADD COLUMN precio REAL DEFAULT 0", (err) => {
  if (err && !/duplicate column name/i.test(err.message)) {
    console.error('Error agregando precio:', err.message);
  }
});

db.run("ALTER TABLE compras ADD COLUMN precio_unitario REAL DEFAULT 0", (err) => {
  if (err && !/duplicate column name/i.test(err.message)) {
    console.error('Error agregando precio_unitario:', err.message);
  }
});

db.run("ALTER TABLE compras ADD COLUMN importe REAL DEFAULT 0", (err) => {
  if (err && !/duplicate column name/i.test(err.message)) {
    console.error('Error agregando importe:', err.message);
  }
});

// NO asignar precio por defecto - usar CSV en su lugar
// db.run("UPDATE productos SET precio = 1000 WHERE IFNULL(precio,0) = 0");

// Sincronizar inventario.db con database.db en arranque
const syncInventario = require('./syncInventario');
syncInventario(() => console.log('inventario.db sincronizado con productos'));

// Montar rutas
const authRoutes = require('./AUTH/auth');
app.use('/auth', authRoutes);

const stockRoutes = require('./stock/stock');
app.use('/stock', stockRoutes);

const fidelizacionRoutes = require('./routes/fidelizacion');
app.use('/fidelizacion', fidelizacionRoutes);

const cajaRoutes = require('./routes/caja');
app.use('/caja', cajaRoutes);

const reportesRoutes = require('./routes/reportes');
app.use('/reportes', reportesRoutes);

const configuracionRoutes = require('./routes/configuracion');
app.use('/configuracion', configuracionRoutes);

// Ruta de login
app.get('/login', (req, res) => {
  res.redirect('/auth/login');
});

// Ruta de configuración (solo para admin)
app.get('/configuracion', (req, res) => {
  if (!req.session.usuario) return res.redirect('/login');
  if (req.session.rol !== 'admin') return res.status(403).send('Acceso denegado');
  
  res.sendFile(path.join(__dirname, 'views/configuracion.html'));
});

// Dashboard visual según rol
app.get('/dashboard', (req, res) => {
  if (!req.session.usuario) return res.redirect('/login');

  const rol = req.session.rol;
  const usuario = req.session.usuario;
  const genero = req.session.genero || 'm';
  const saludo = genero === 'f' ? 'Bienvenida' : 'Bienvenido';

  const opciones = [];

  if (rol === 'cajero') {
    opciones.push({ texto: 'Caja', link: '/caja', icono: '💳' });
    opciones.push({ texto: 'Control de Stock', link: '/buscar.html', icono: '📦' });
  }
  
  if (rol === 'supervisor') {
    opciones.push({ texto: 'Caja', link: '/caja', icono: '💳' });
    opciones.push({ texto: 'Control de Stock', link: '/buscar.html', icono: '📦' });
    opciones.push({ texto: 'Panel de Fidelización', link: '/fidelizacion', icono: '🎯' });
    opciones.push({ texto: 'Reportes', link: '/reportes', icono: '📊' });
  }
  
  if (rol === 'admin') {
    opciones.push({ texto: 'Caja', link: '/caja', icono: '💳' });
    opciones.push({ texto: 'Control de Stock', link: '/buscar.html', icono: '📦' });
    opciones.push({ texto: 'Panel de Fidelización', link: '/fidelizacion', icono: '🎯' });
    opciones.push({ texto: 'Reportes', link: '/reportes', icono: '📊' });
    opciones.push({ texto: 'Configuración del Sistema', link: '/configuracion', icono: '⚙️' });
  }

  if (opciones.length === 1) {
    return res.redirect(opciones[0].link);
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dashboard - Sistema Stock</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Poppins', sans-serif;
          background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .dashboard { max-width: 800px; width: 100%; }
        .welcome-card {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          padding: 2.5rem;
          text-align: center;
          margin-bottom: 2rem;
        }
        h1 { font-size: 2.5rem; color: #4f46e5; margin-bottom: 1rem; }
        p { font-size: 1.25rem; color: #6b7280; }
        .modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }
        .module-card {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          padding: 1.5rem;
          text-align: center;
          transition: transform 0.3s;
        }
        .module-card:hover { transform: translateY(-5px); }
        .module-icon { font-size: 2.5rem; margin-bottom: 1rem; }
        .module-button {
          display: block;
          padding: 0.75rem 1.5rem;
          background: #4f46e5;
          color: white;
          border-radius: 0.5rem;
          text-decoration: none;
          margin-top: 1rem;
        }
        .module-button:hover { background: #4338ca; }
        .logout-button {
          display: inline-block;
          margin-top: 2rem;
          padding: 0.75rem 1.5rem;
          background: #ef4444;
          color: white;
          border-radius: 0.5rem;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <div class="welcome-card">
          <h1>${saludo}, ${usuario} 👋</h1>
          <p>¿Qué módulo querés usar hoy?</p>
        </div>
        <div class="modules-grid">
          ${opciones.map(op => `
            <div class="module-card">
              <div class="module-icon">${op.icono}</div>
              <h3>${op.texto}</h3>
              <a href="${op.link}" class="module-button">Acceder</a>
            </div>
          `).join('')}
        </div>
        <div style="text-align: center;">
          <a href="/auth/logout" class="logout-button">Cerrar sesión</a>
        </div>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// Inicio del servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
