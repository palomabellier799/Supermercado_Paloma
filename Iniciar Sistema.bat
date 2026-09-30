@echo off
title Sistema de Stock Paloma - Iniciando...

echo ========================================
echo   SISTEMA DE STOCK PALOMA
echo ========================================
echo.
echo Iniciando el servidor...
echo.

:: Verificar si Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no está instalado o no está en el PATH.
    echo Por favor, instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)

:: Iniciar el servidor
echo Iniciando el sistema...
start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000/auth/login --window-size=1200,800 --window-position=center

:: Mostrar información de conexión
echo.
echo ========================================
echo   INFORMACIÓN DE CONEXIÓN
echo ========================================
echo.
echo Acceso local:
start http://localhost:3000/auth/login
echo.

:: Obtener IP local
for /f "tokens=2 delift==" %%a in ('ipconfig ^| findstr "IPv4"') do (
    set LOCAL_IP=%%a
    goto :ip_found
)
:ip_found

if defined LOCAL_IP (
    echo Acceso desde la red local:
    echo http://%LOCAL_IP%:3000/auth/login
    echo.
    echo Comparte esta dirección con otros en tu red local.
) else (
    echo No se pudo detectar la dirección IP local.
)

echo.
echo ========================================
echo   INSTRUCCIONES
echo ========================================
echo 1. Mantén esta ventana abierta mientras uses el sistema.
echo 2. Para cerrar el sistema, presiona Ctrl+C en esta ventana.
echo 3. Cierra todas las ventanas del navegador para salir.
echo.
echo Presiona cualquier tecla para ver los mensajes del servidor...
pause >nul

:: Iniciar el servidor
echo.
echo Iniciando el servidor (puede tomar unos segundos)...
echo.
node app.js

:: Si hay un error
echo.
echo [ERROR] El servidor se ha detenido inesperadamente.
echo Verifica que no haya otra instancia del servidor en ejecución.
echo.
pause
