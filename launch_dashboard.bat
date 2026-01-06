@echo off
setlocal

set "URL=http://localhost:3003"
set "PORT=3003"
set "FIREFOX_PATH=C:\Program Files\Mozilla Firefox\firefox.exe"
set "ROOT=%~dp0"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "WSL_ROOT="

if not exist "%FIREFOX_PATH%" (
  echo Firefox not found at "%FIREFOX_PATH%".
  pause
  exit /b 1
)

if not exist "%ROOT%server.js" (
  echo server.js not found in "%ROOT%".
  pause
  exit /b 1
)

if not exist "%NODE_EXE%" (
  set "NODE_EXE="
)

if "%NODE_EXE%"=="" (
  for /f "delims=" %%A in ('where node 2^>nul') do set "NODE_EXE=%%A"
)

if "%NODE_EXE%"=="" (
  if exist "%SystemRoot%\System32\wsl.exe" (
    for /f "delims=" %%P in ('wsl wslpath -a "%ROOT%" 2^>nul') do set "WSL_ROOT=%%P"
  )
)

call :check_port
if "%PORT_IN_USE%"=="1" (
  echo Port %PORT% already in use. Checking server...
) else (
  if not "%NODE_EXE%"=="" (
    start "Health Dashboard Server" /min "%NODE_EXE%" "%ROOT%server.js"
  ) else if not "%WSL_ROOT%"=="" (
    start "Health Dashboard Server" /min wsl.exe bash -lc "cd '%WSL_ROOT%'; node server.js"
  ) else (
    echo Node.js not found on Windows and WSL is unavailable.
    pause
    exit /b 1
  )
)

call :wait_for_server
if errorlevel 1 (
  echo Server did not start or is not responding at %URL%.
  pause
  exit /b 1
)

start "Health Dashboard" "%FIREFOX_PATH%" --kiosk "%URL%"
endlocal
exit /b 0

:check_port
set "PORT_IN_USE="
for /f "tokens=1" %%A in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr /C:"LISTENING"') do set "PORT_IN_USE=1"
exit /b 0

:wait_for_server
set "ATTEMPTS=0"
:wait_loop
set /a ATTEMPTS+=1
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 -Uri '%URL%/api/state'; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>nul
if %errorlevel%==0 exit /b 0
if %ATTEMPTS% GEQ 15 exit /b 1
timeout /t 1 >nul
goto :wait_loop
