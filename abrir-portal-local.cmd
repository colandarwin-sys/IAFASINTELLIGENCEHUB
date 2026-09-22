@echo off
setlocal
cd /d "%~dp0"
set PORT=8090

echo ================================================
echo   IAFAS INTELLIGENCE HUB - LOCALHOST
echo ================================================
echo.
echo Abriendo portal en http://localhost:%PORT%
echo Centro de Fuentes habilitado para LISTAS AB.
echo Para cerrar el servidor, vuelve a esta ventana y presiona Ctrl+C.
echo.

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%"
  py hub_local_server.py
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:%PORT%"
  python hub_local_server.py
  goto :end
)

echo No se encontro Python instalado en este equipo.
echo Instala Python o usa el equipo donde ya abrias el Hub por localhost.
pause
:end
endlocal
