@echo off
setlocal
set "CC_VARIANT=%~1"
if "%CC_VARIANT%"=="" set "CC_VARIANT=customer"
if not "%CC_VARIANT%"=="customer" if not "%CC_VARIANT%"=="professional" (
  echo Usage: run-device.cmd customer ^| professional
  exit /b 2
)
set "CC_NODE_DIR=%~dp0..\.local-tools\node-v24.21.0-win-x64"
if exist "%CC_NODE_DIR%\node.exe" (
  set "CC_NODE=%CC_NODE_DIR%\node.exe"
  set "PATH=%CC_NODE_DIR%;%PATH%"
) else (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js was not found. Restore the project's portable Node or install Node.js.
    exit /b 1
  )
  set "CC_NODE=node"
)
set "CC_PORT=8081"
if "%CC_VARIANT%"=="professional" set "CC_PORT=8082"
echo Open the installed Circle %CC_VARIANT% development app on your phone.
echo This server targets a development build. Expo Go cannot load the native map or payment SDK.
pushd "%~dp0"
"%CC_NODE%" scripts\app.cjs "%CC_VARIANT%" start --dev-client --host lan --port %CC_PORT% --clear
set "CC_RESULT=%ERRORLEVEL%"
popd
exit /b %CC_RESULT%
