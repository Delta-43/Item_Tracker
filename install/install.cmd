@echo off
rem Item Tracker installer for Windows with Docker Desktop.
rem Double-click to install, and again later to update; the desk's data is kept.
setlocal
title Item Tracker
set "IMAGE=ghcr.io/delta-43/item_tracker:latest"
set "HOME_DIR=%LOCALAPPDATA%\ItemTracker"
echo.
echo  Item Tracker - install or update
echo.

docker info >nul 2>&1
if errorlevel 1 (
  echo  Docker Desktop is not running. Start it, wait until it says "Engine running",
  echo  then double-click install.cmd again.
  echo  No Docker Desktop yet? Get it from https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

rem Keep the Docker setup in a fixed folder, so the desk is found again on updates.
if not exist "%HOME_DIR%" mkdir "%HOME_DIR%"
> "%HOME_DIR%\compose.yaml" (
  echo # Written by install.cmd. Run install.cmd again to update.
  echo name: itemtracker
  echo services:
  echo   item-tracker:
  echo     image: %IMAGE%
  echo     container_name: item-tracker
  echo     restart: always
  echo     ports:
  echo       - "127.0.0.1:4242:4242"
  echo     volumes:
  echo       - item-tracker-data:/data
  echo volumes:
  echo   item-tracker-data:
)
cd /d "%HOME_DIR%"

echo  Downloading the latest version...
docker compose pull
if errorlevel 1 (
  docker image inspect %IMAGE% >nul 2>&1
  if errorlevel 1 (
    echo  The download failed. Check the internet connection and try again.
    pause
    exit /b 1
  )
  echo  No internet connection - starting the version already on this computer.
)

docker compose up -d
if errorlevel 1 (
  echo  Starting the desk failed. If port 4242 is in use, another copy may be running:
  echo  check the Containers list in Docker Desktop.
  pause
  exit /b 1
)

echo  Waiting for the desk to start...
for /l %%i in (1,1,30) do (
  curl.exe -s -f http://localhost:4242/api/health >nul 2>&1 && goto ready
  timeout /t 2 /nobreak >nul
)
echo  The desk did not answer. Open Docker Desktop and check the item-tracker container.
pause
exit /b 1

:ready
echo.
echo  Item Tracker is running at http://localhost:4242
echo  It starts by itself whenever Docker Desktop runs. Stop or start it from
echo  Docker Desktop's Containers list.
start "" http://localhost:4242
echo.
pause
