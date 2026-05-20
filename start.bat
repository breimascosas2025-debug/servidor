@echo off
echo Iniciando servidor backend...
start cmd /k "cd backend && npm run start"

echo Iniciando interfaz web (frontend)...
start cmd /k "cd frontend && npm run dev"

echo.
echo =======================================================
echo NUBE PERSONAL INICIADA
echo.
echo Backend ejecutandose en: http://localhost:3000
echo Frontend ejecutandose en: http://localhost:5173
echo.
echo Para ver tu IP local y conectarte desde tu celular,
echo busca la seccion "IPv4 Address" a continuacion:
echo =======================================================
ipconfig | findstr /i "ipv4"
echo =======================================================
echo Ingresa la IP de arriba seguida de :5173 en tu celular.
echo Ejemplo: http://192.168.1.5:5173
echo =======================================================
pause
