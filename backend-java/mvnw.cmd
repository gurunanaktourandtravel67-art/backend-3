@echo off
setlocal

set MAVEN_VERSION=3.9.9
set WRAPPER_DIR=%~dp0.mvn\wrapper
set DIST_DIR=%WRAPPER_DIR%\dists\apache-maven-%MAVEN_VERSION%
set MVN_CMD=%DIST_DIR%\apache-maven-%MAVEN_VERSION%\bin\mvn.cmd
set ZIP_PATH=%WRAPPER_DIR%\dists\apache-maven-%MAVEN_VERSION%-bin.zip

if not exist "%MVN_CMD%" (
  echo Maven not found locally - downloading Apache Maven %MAVEN_VERSION% ^(one-time, about 9 MB^)...
  if not exist "%WRAPPER_DIR%\dists" mkdir "%WRAPPER_DIR%\dists"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip' -OutFile '%ZIP_PATH%'"
  if errorlevel 1 (
    echo Download failed. Check your internet connection, or install Maven manually.
    exit /b 1
  )
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%DIST_DIR%' -Force"
  del "%ZIP_PATH%"
)

"%MVN_CMD%" %*
exit /b %ERRORLEVEL%

endlocal
