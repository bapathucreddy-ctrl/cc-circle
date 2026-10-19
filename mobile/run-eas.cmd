@echo off
setlocal
set "CIRCLE_NODE_DIR=%~dp0..\.local-tools\node-v24.21.0-win-x64"
set "CIRCLE_EAS=%~dp0..\.local-tools\eas-client\node_modules\eas-cli\bin\run"
if not exist "%CIRCLE_NODE_DIR%\node.exe" (
  echo Portable Node is missing. Restore the workspace tools first.
  exit /b 1
)
if not exist "%CIRCLE_EAS%" (
  echo EAS CLI is missing. Install it under .local-tools\eas-client first.
  exit /b 1
)
set "PATH=%CIRCLE_NODE_DIR%;%PATH%"
set "EAS_NO_VCS=1"
set "CC_APP_VARIANT=%~1"
if not "%CC_APP_VARIANT%"=="customer" if not "%CC_APP_VARIANT%"=="professional" (
  echo Usage: run-eas.cmd customer ^| professional whoami ^| login ^| project-info ^| env-development ^| simulator
  exit /b 2
)
set "EXPO_PUBLIC_APP_VARIANT=%CC_APP_VARIANT%"
pushd "%~dp0"
"%CIRCLE_NODE_DIR%\node.exe" scripts\eas.cjs %*
set "CIRCLE_RESULT=%ERRORLEVEL%"
popd
exit /b %CIRCLE_RESULT%
