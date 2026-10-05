@echo off
REM Windows: build the app and start the team server (Node.js >= 22.5)
cd /d "%~dp0"
node scripts\build.mjs || goto :err
node --experimental-sqlite --no-warnings server\server.js %*
goto :eof
:err
echo Build failed.
pause
