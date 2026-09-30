# 📋 Guía de Gestión de Precios

## ✅ Cómo actualizar precios correctamente

### Opción 1: Desde el CSV (RECOMENDADO)

1. Edita el archivo `productos.csv` con los nuevos precios
2. Ejecuta en la terminal:
   ```cmd
   node RESTAURAR-PRECIOS.js
   ```
3. Reinicia el servidor:
   ```cmd
   npm start
   ```

### Opción 2: Desde la interfaz web

1. Ve a: `http://localhost:3000/restaurar-precios.html`
2. Haz clic en **"FORZAR Actualización de Precios"**
3. Los precios se actualizarán desde el CSV

### Opción 3: Desde configuración

1. Edita `productos.csv` con los nuevos precios
2. Ve a la página de Configuración (admin)
3. Usa el botón **"Actualizar desde CSV"**

---

## ⚠️ Funciones PELIGROSAS - NO USAR

### ❌ "Asignar precio por defecto"
- **NO uses esta función** a menos que quieras poner el mismo precio a TODOS los productos
- Sobrescribe todos los precios con un valor fijo (ej: $1000)

### ❌ "Normalizar"
- Solo normaliza `stock_inicial`, NO modifica precios
- Es segura de usar

---

## 🔧 Scripts útiles

### Restaurar precios desde CSV
```cmd
node RESTAURAR-PRECIOS.js
```
Actualiza todos los precios desde `productos.csv`

### Limpiar ventas (resetear reportes)
```cmd
node LIMPIAR-VENTAS.js
```
- Elimina todas las ventas registradas
- Resetea puntos de clientes a 0
- **NO modifica** precios ni stock

### Verificar precio específico
```cmd
node VERIFICAR-Y-FORZAR.js
```
Verifica y corrige el precio del producto 000B

---

## 🛡️ Protecciones implementadas

✅ El servidor **NO asigna** $1000 automáticamente al arrancar  
✅ La caja **NO actualiza** precios desde la tabla `compras`  
✅ Las ventas **NO modifican** el precio del producto  
✅ El stock consulta **directamente** la tabla `productos`  
✅ Los precios del CSV se **respetan** y mantienen  

---

## 📊 Estructura del CSV

El archivo `productos.csv` debe tener este formato:

```csv
codigo;descripcion;stock;precio
000A;Leche entera;100;1200
000B;Leche descremada;100;1300
000C;Yerba 1kg;100;2500
```

**Importante:**
- Separador: `;` (punto y coma)
- Precio: usar punto `.` para decimales (ej: 1200.50)
- Si usas coma, el sistema la reemplaza automáticamente

---

## 🔍 Verificar que todo funciona

1. Abre: `http://localhost:3000/test-api.html`
2. Haz clic en **"Test Stock API"**
3. Verifica que el precio sea el correcto del CSV

O busca un producto en:
- **Caja**: `http://localhost:3000/caja`
- **Control de Stock**: `http://localhost:3000/buscar.html`

Ambos deben mostrar el mismo precio del CSV.

---

## 📝 Notas importantes

- **Siempre reinicia el servidor** después de cambios en el código
- **Usa Ctrl+Shift+R** en el navegador para forzar recarga sin caché
- Los precios se almacenan en la tabla `productos` columna `precio`
- Las ventas se registran en la tabla `compras` pero **NO afectan** el precio del producto

---

## 🆘 Solución de problemas

### Problema: Los precios siguen cambiando
**Solución:**
1. Detén el servidor: `Ctrl+C`
2. Mata todos los procesos: `taskkill /F /IM node.exe`
3. Ejecuta: `node RESTAURAR-PRECIOS.js`
4. Reinicia: `npm start`

### Problema: Precio diferente en Caja vs Stock
**Solución:**
1. Reinicia el servidor completamente
2. Limpia caché del navegador (Ctrl+Shift+Delete)
3. Verifica con: `http://localhost:3000/test-api.html`

### Problema: Quiero empezar de cero con las ventas
**Solución:**
```cmd
node LIMPIAR-VENTAS.js
```

---

## 📞 Contacto

Si encuentras algún problema con los precios, verifica:
1. ✅ Que el CSV tenga el formato correcto
2. ✅ Que el servidor esté reiniciado
3. ✅ Que no uses "Asignar precio por defecto"
4. ✅ Que ejecutes `RESTAURAR-PRECIOS.js` después de editar el CSV
