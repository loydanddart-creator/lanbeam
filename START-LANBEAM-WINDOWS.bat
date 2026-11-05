@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js не установлен. Скачайте его с https://nodejs.org и запустите этот файл снова.& pause & exit /b 1)
where pnpm >nul 2>nul || (echo Устанавливаю pnpm... & call npm install -g pnpm)
if not exist node_modules (echo Первый запуск: устанавливаю зависимости... & call pnpm install)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set IP=%%a
set IP=%IP: =%
echo.
echo LanBeam запущен.
echo На этом компьютере: http://localhost:3000
echo На телефоне в той же Wi-Fi сети: http://%IP%:3000
echo Чтобы остановить программу, закройте это окно.
echo.
start "LanBeam" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
call pnpm dev
pause
