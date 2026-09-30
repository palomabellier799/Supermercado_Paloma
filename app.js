const express = require('express');
const session = require('express-session');
const path = require('path');
const os = require('os');
const app = express();

// Función para obtener la IP local
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Ignorar direcciones internas (loopback) y no IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

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
      <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
      <style>
        :root {
          --primary-color:rgb(70, 131, 229);
          --primary-hover:rgb(88, 74, 239);
          --secondary-color: #10b981;
          --secondary-hover: #059669;
          --danger-color:rgb(234, 19, 19);
          --text-dark:rgb(0, 1, 1);
          --text-light:rgb(152, 159, 173);
          --bg-light: #f9fafb;
          --card-bg: #ffffff;
          --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Poppins', sans-serif;
          background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
          color: var(--text-dark);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        
        .dashboard {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          min-height: 100vh;
        }
        
        .welcome-card {
          background-color: var(--card-bg);
          border-radius: 1rem;
          box-shadow: var(--shadow);
          padding: 2.5rem;
          width: 100%;
          max-width: 800px;
          text-align: center;
          margin-bottom: 2rem;
          animation: slideDown 0.5s ease-out;
        }
        
        .welcome-card h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--primary-color);
          margin-bottom: 1rem;
        }
        
        .welcome-card p {
          font-size: 1.25rem;
          color: var(--text-light);
          margin-bottom: 2rem;
        }
        
        .modules-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          width: 100%;
          max-width: 800px;
          animation: fadeIn 0.8s ease-out;
        }
        
        .module-card {
          background-color: var(--card-bg);
          border-radius: 1rem;
          box-shadow: var(--shadow);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .module-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        
        .module-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          color: var(--primary-color);
        }
        
        .module-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: var(--text-dark);
        }
        
        .module-description {
          font-size: 0.875rem;
          color: var(--text-light);
          margin-bottom: 1.5rem;
        }
        
        .module-button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background-color: var(--primary-color);
          color: white;
          border-radius: 0.5rem;
          font-weight: 500;
          text-decoration: none;
          transition: background-color 0.3s ease;
          width: 100%;
        }
        
        .module-button:hover {
          background-color: var(--primary-hover);
        }
        
        .logout-button {
          margin-top: 2rem;
          padding: 0.75rem 1.5rem;
          background-color: var(--danger-color);
          color: white;
          border-radius: 0.5rem;
          font-weight: 500;
          text-decoration: none;
          transition: background-color 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .logout-button:hover {
          background-color: #dc2626;
        }
        
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @media (max-width: 768px) {
          .modules-grid {
            grid-template-columns: 1fr;
          }
          
          .welcome-card {
            padding: 1.5rem;
          }
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
              <div class="module-icon">
                ${op.icono === '📦' ? '<i class="fas fa-box"></i>' : 
                  op.icono === '🎯' ? '<i class="fas fa-bullseye"></i>' : 
                  op.icono === '⚙️' ? '<i class="fas fa-cog"></i>' : 
                  '<i class="fas fa-star"></i>'}
              </div>
              <h3 class="module-title">${op.texto}</h3>
              <p class="module-description">Accede al módulo de ${op.texto.toLowerCase()} para gestionar tu sistema.</p>
              <a href="${op.link}" class="module-button">Acceder</a>
            </div>
          `).join('')}
        </div>
        
        <a href="/auth/logout" class="logout-button">
          <i class="fas fa-sign-out-alt"></i> Cerrar sesión
        </a>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// Inicio del servidor
console.log('Iniciando el servidor...');
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Escuchar en todas las interfaces de red

try {
  console.log('Configurando el servidor...');
  const server = app.listen(PORT, HOST, () => {
    console.log('El servidor se ha iniciado correctamente.');
    const localIP = getLocalIP();
    console.log('=== SISTEMA DE STOCK PALOMA ===');
    console.log(`Servidor activo en tu computadora: http://localhost:${PORT}`);
    console.log(`Para acceder desde otros dispositivos en la red local:`);
    console.log(`http://${localIP}:${PORT}`);
    console.log('\nMantén esta ventana abierta mientras uses el sistema.');
    console.log('Presiona Ctrl + C para detener el servidor.');
    console.log('================================');
  });

  // Manejador de errores del servidor
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Error: El puerto ${PORT} ya está en uso.`);
      console.log('Intenta detener otros servidores o usa un puerto diferente.');
    } else {
      console.error('Error al iniciar el servidor:', error);
    }
    process.exit(1);
  });
} catch (error) {
  console.error('Error crítico al iniciar el servidor:', error);
  process.exit(1);
}