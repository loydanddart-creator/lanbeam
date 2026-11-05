@echo off
chcp 65001 >nul
cd /d "%~dp0"

title LanBeam - локальная передача файлов
where node >nul 2>nul
if errorlevel 1 goto no_node
where pnpm >nul 2>nul
if not errorlevel 1 goto dependencies
call npm install -g pnpm
if errorlevel 1 goto install_error

:dependencies
if exist node_modules goto build
 echo Первый запуск: устанавливаю зависимости...
call pnpm install
if errorlevel 1 goto install_error

:build
echo Подготавливаю LanBeam...
call pnpm build
if errorlevel 1 goto build_error

set "IP=localhost"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set "IP=%%a"
set "IP=%IP: =%"
echo.
echo LanBeam запущен.
echo На этом компьютере: http://localhost:3000
echo На телефоне в той же Wi-Fi сети: http://%IP%:3000
echo.
start "" http://localhost:3000
set "LANBEAM_PRODUCTION=1"
node dist/index.js
pause
exit /b 0

:no_node
echo Node.js не установлен.
echo Скачайте Node.js с https://nodejs.org и запустите этот файл снова.
pause
exit /b 1

:install_error
echo Не удалось установить зависимости.
echo Проверьте подключение к интернету и запустите файл снова.
pause
exit /b 1

:build_error
echo Не удалось собрать LanBeam.
echo Закройте другие окна LanBeam и запустите этот файл снова.
pause
exit /b 1
