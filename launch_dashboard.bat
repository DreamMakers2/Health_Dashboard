@echo off
setlocal

set "URL=http://localhost:3003"
set "PORT=3003"
set "ROOT=%~dp0"
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "WSL_ROOT="
set "DEFAULT_PROGID="
set "BROWSER_EXE="
set "BROWSER_ARGS="
set "BROWSER_PATH="

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

call :detect_default_browser
if not "%BROWSER_EXE%"=="" (
  start "Health Dashboard" "%BROWSER_EXE%" %BROWSER_ARGS%
  endlocal
  exit /b 0
)

start "Health Dashboard" "%URL%"
endlocal
exit /b 0

:detect_default_browser
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice').ProgId" 2^>nul`) do set "DEFAULT_PROGID=%%A"

if /I "%DEFAULT_PROGID%"=="ChromeHTML" (
  set "BROWSER_EXE=chrome.exe"
  set "BROWSER_ARGS=--new-window --app=%URL%"
) else if /I "%DEFAULT_PROGID%"=="MSEdgeHTM" (
  set "BROWSER_EXE=msedge.exe"
  set "BROWSER_ARGS=--new-window --app=%URL%"
) else if /I "%DEFAULT_PROGID%"=="FirefoxURL" (
  set "BROWSER_EXE=firefox.exe"
  set "BROWSER_ARGS=--new-window %URL%"
) else if /I "%DEFAULT_PROGID%"=="BraveHTML" (
  set "BROWSER_EXE=brave.exe"
  set "BROWSER_ARGS=--new-window --app=%URL%"
)

if "%BROWSER_EXE%"=="" exit /b 0

call :resolve_browser_path
if not exist "%BROWSER_EXE%" set "BROWSER_EXE="
exit /b 0

:resolve_browser_path
for /f "delims=" %%A in ('where %BROWSER_EXE% 2^>nul') do if not defined BROWSER_PATH set "BROWSER_PATH=%%A"
if not "%BROWSER_PATH%"=="" (
  set "BROWSER_EXE=%BROWSER_PATH%"
  exit /b 0
)

if /I "%BROWSER_EXE%"=="chrome.exe" (
  if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if /I "%BROWSER_EXE%"=="msedge.exe" (
  if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if /I "%BROWSER_EXE%"=="firefox.exe" (
  if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" set "BROWSER_EXE=%ProgramFiles%\Mozilla Firefox\firefox.exe"
  if exist "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe"
) else if /I "%BROWSER_EXE%"=="brave.exe" (
  if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BROWSER_EXE=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
  if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
)
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
