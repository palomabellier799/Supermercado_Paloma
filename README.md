# Sistema de Stock y Fidelización - Paloma

Sistema web para gestión de inventario y programa de fidelización de clientes.

## Características

- **Autenticación segura** con bcrypt
- **Control de acceso por roles**: Cajero, Supervisor, Administrador
- **Gestión de stock** con búsqueda por nombre y código
- **Autocompletado inteligente** en búsquedas
- **Panel de fidelización** para clientes
- **Módulo de configuración** para administradores
- **Base de datos SQLite** integrada

## Roles y Permisos

### Cajero
- Control de stock (búsqueda de productos)

### Supervisor
- Control de stock
- Panel de fidelización (búsqueda de clientes)

### Administrador
- Control de stock
- Panel de fidelización
- Configuración del sistema (gestión de usuarios, productos, clientes)

## Instalación

1. **Clonar o descargar el proyecto**
2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Inicializar la base de datos:**
   ```bash
   npm run init
   ```

4. **Iniciar el servidor:**
   ```bash
   npm start
   ```

5. **Acceder al sistema:**
   - Abrir navegador en: `http://localhost:3000`

## Usuarios por Defecto

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| juan | clave123 | Cajero |
| laura | clave123 | Supervisor |
| admin | clave123 | Administrador |

## Estructura del Proyecto

```
sistema-stock-paloma/
├── .vscode/                # Configuración del editor
├── AUTH/                   # Módulo de autenticación
│   ├── auth.js
│   ├── authController.js
│   └── crearEmpleados.js
├── db/                     # Bases de datos SQLite
│   ├── backup_2025-10-07...db
│   ├── database.db
│   ├── empleados.db
│   └── inventario.db
├── middleware/             # Lógica de permisos
│   └── verificarRol.js
├── node_modules/           # Librerías de Node.js (instaladas)
├── public/                 # Archivos estáticos y herramientas
│   ├── buscar.html
│   ├── caja.html
│   ├── dashboard.html
│   ├── fidelizacion.html
│   ├── index.html
│   ├── reportes.html
│   ├── restaurar-precios.html
│   ├── Super.lnk
│   └── SuperPaloma.url
├── routes/                 # Definición de rutas del servidor
├── stock/
│   └── stock.js
├── views/                  # Vistas principales
│   ├── configuracion.html
│   ├── dashboard.html
│   └── login.html
├── app-backup.js           # Respaldo del servidor
├── app-FIXED.js            # Versión corregida del servidor
├── app.js                  # ARCHIVO PRINCIPAL (Servidor)
├── checkDb.js              # Utilidad de verificación
├── COMO_COMPARTIR.txt      # Instrucciones de uso
├── createDatabase.js       # Script de creación inicial
├── db.js                   # Conexión a la base de datos
├── desktop.ini
├── diagnostico-completo.js  # Herramienta de soporte
├── DIAGNOSTICO.bat         # Script de Windows para soporte
├── FUNCIONALIDADES.md      # Documentación
├── GUIA-PRECIOS.md         # Documentación
├── importar.js             # Script de carga de datos
├── Iniciar Sistema.bat     # Lanzador automático
├── initDatabase.js         # Inicialización de tablas
├── LIMPIAR-VENTAS.js       # Script de mantenimiento
├── package-lock.json       # Control de versiones de librerías
├── package.json            # Configuración y dependencias
├── productos.csv           # Base de datos en Excel/Texto
├── README.md               # Información del proyecto
├── RESTAURAR-PRECIOS.js    # Script de emergencia
├── restaurarPrecios.js
├── syncInventario.js
├── test-api.html
├── test-precio.js
├── verificar - copia.js
├── VERIFICAR-Y-FORZAR.js
├── verificar.js
└── verificarPrecios.js

## Funcionalidades

### Búsqueda de Productos
- **Por nombre**: Autocompletado con sugerencias
- **Por código**: Búsqueda exacta con autocompletado
- **Información mostrada**: Código, descripción, precio, stock

### Búsqueda de Clientes
- **Por nombre**: Autocompletado con sugerencias
- **Por DNI**: Búsqueda exacta con autocompletado
- **Información mostrada**: Nombre, DNI, teléfono, email, domicilio, puntos

### Configuración (Solo Admin)
- **Gestión de usuarios**: Crear, eliminar usuarios
- **Gestión de productos**: Agregar productos, actualizar desde CSV
- **Gestión de clientes**: Agregar nuevos clientes
- **Herramientas del sistema**: Respaldo, limpieza de logs, reinicio

## API Endpoints

### Autenticación
- `POST /auth/login` - Iniciar sesión
- `GET /auth/logout` - Cerrar sesión

### Stock
- `GET /stock/buscar?nombre=...` - Buscar productos por nombre
- `GET /stock/producto?codigo=...` - Buscar producto por código

### Fidelización
- `GET /fidelizacion/api/cliente?dni=...` - Buscar cliente por DNI
- `GET /fidelizacion/api/buscar?nombre=...` - Buscar clientes por nombre
- `GET /fidelizacion/api/buscar?dni=...` - Buscar clientes por DNI

### Configuración (Admin)
- `GET /configuracion/usuarios` - Listar usuarios
- `POST /configuracion/usuarios` - Crear usuario
- `DELETE /configuracion/usuarios/:usuario` - Eliminar usuario
- `POST /configuracion/productos` - Crear producto
- `POST /configuracion/actualizar-stock` - Actualizar stock desde CSV
- `POST /configuracion/clientes` - Crear cliente

## Desarrollo

Para desarrollo con recarga automática:
```bash
npm run dev
```

## Tecnologías Utilizadas

- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **SQLite3** - Base de datos
- **bcrypt** - Encriptación de contraseñas
- **express-session** - Gestión de sesiones
- **csv-parser** - Procesamiento de archivos CSV

## Notas Importantes

- El sistema carga productos automáticamente desde `productos.csv` al inicializar
- Las contraseñas se almacenan hasheadas con bcrypt
- Las sesiones se mantienen durante la navegación
- El sistema es responsive y funciona en dispositivos móviles
- La base de datos se crea automáticamente en la primera ejecución






