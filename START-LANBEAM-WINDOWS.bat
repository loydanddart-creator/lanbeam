@echo off
cd /d "%~dp0"
title LanBeam

where node >nul 2>nul
if errorlevel 1 goto no_node
where pnpm >nul 2>nul
if not errorlevel 1 goto deps
call npm install -g pnpm
if errorlevel 1 goto install_error

:deps
if exist node_modules goto build
echo Installing dependencies...
call pnpm install
if errorlevel 1 goto install_error

:build
echo Building LanBeam...
call pnpm build
if errorlevel 1 goto build_error

echo.
echo LanBeam is running at http://localhost:3000
echo Find the PC IPv4 address below and open http://PC_IP:3000 on your phone.
echo.
ipconfig | findstr "IPv4"
echo.
start "" http://localhost:3000
set LANBEAM_PRODUCTION=1
node dist/index.js
pause
exit /b 0

:no_node
echo Node.js is not installed.
echo Download it from https://nodejs.org and run this file again.
pause
exit /b 1

:install_error
echo Could not install dependencies.
echo Check your internet connection and run this file again.
pause
exit /b 1

:build_error
echo Could not build LanBeam.
echo Close other LanBeam windows and run this file again.
pause
exit /b 1
