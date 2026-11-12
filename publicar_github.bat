@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

echo ==========================================================
echo   TOSCANO-VIEW - Publicar en GitHub VIZ343
echo ==========================================================
echo.
echo Repositorio: https://github.com/VIZ343/Toscano-View
 echo.

if not exist "index.html" (
  echo ERROR: Falta index.html. Extrae todos los archivos del ZIP.
  exit /b 1
)
if not exist "FRIOX_ligero.glb" (
  echo ERROR: Falta FRIOX_ligero.glb. Extrae todos los archivos del ZIP.
  exit /b 1
)
if not exist "FRIOX_ligero.materials.json" (
  echo ERROR: Falta el mapeo de materiales FRIOX_ligero.materials.json.
  exit /b 1
)
where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git no esta instalado o no esta disponible en PATH.
  echo Instala Git for Windows: https://git-scm.com/downloads/win
  exit /b 1
)

if not exist ".git" (
  git rev-parse --is-inside-work-tree >nul 2>&1
  if not errorlevel 1 (
    echo ERROR: Esta carpeta esta dentro de otro repositorio Git.
    echo Extrae el ZIP a una carpeta nueva antes de continuar.
    exit /b 1
  )
  git init
  if errorlevel 1 goto ERROR_GIT
)

set "DESTINO=https://github.com/VIZ343/Toscano-View.git"
set "ORIGEN="
for /f "delims=" %%G in ('git remote get-url origin 2^>nul') do set "ORIGEN=%%G"
if defined ORIGEN (
  if /I not "%ORIGEN%"=="%DESTINO%" if /I not "%ORIGEN%"=="git@github.com:VIZ343/Toscano-View.git" if /I not "%ORIGEN%"=="https://github.com/VIZ343/Toscano-View" (
    echo ERROR: El remote 'origin' corresponde a otro repositorio:
    echo %ORIGEN%
    echo No se cambiara automaticamente para evitar publicar en otro proyecto.
    exit /b 1
  )
) else (
  git remote add origin "%DESTINO%"
  if errorlevel 1 goto ERROR_GIT
)

git branch -M main
if errorlevel 1 goto ERROR_GIT

git add -A
if errorlevel 1 goto ERROR_GIT

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Initial publish: Toscano-View"
  if errorlevel 1 (
    echo.
    echo Si Git pide identidad, ejecuta:
    echo git config --global user.name "TU NOMBRE"
    echo git config --global user.email "TU CORREO DE GITHUB"
    echo Luego vuelve a ejecutar este archivo.
    exit /b 1
  )
) else (
  echo No hay archivos nuevos para confirmar.
)

echo.
echo Enviando proyecto a GitHub ...
echo (Git Credential Manager puede pedir iniciar sesion).
git push -u origin main
if errorlevel 1 (
  echo.
  echo NO se pudo publicar en GitHub.
  echo Asegurate de haber creado el repositorio VACIO 'Toscano-View'
  echo en la cuenta VIZ343 y de autenticarte en GitHub.
  echo https://github.com/new
  exit /b 1
)

echo.
echo OK - Publicacion completada: https://github.com/VIZ343/Toscano-View
echo Ahora importa ese repositorio desde https://app.netlify.com/start
exit /b 0

:ERROR_GIT
echo ERROR: Git no pudo completar la operacion. Revisa los mensajes anteriores.
exit /b 1
