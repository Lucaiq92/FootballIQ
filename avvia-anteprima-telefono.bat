@echo off
cd /d "%~dp0"
echo.
echo Anteprima FootballIQ avviata.
echo.
echo PC:       http://localhost:4174/
echo Telefono: http://192.168.1.3:4174/
echo.
echo Tieni aperta questa finestra mentre provi l'app.
echo Per chiuderla premi CTRL+C e poi S.
echo.
set PORT=4174
"C:\Users\lucav\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" serve_app.py
pause
