@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

echo ================================================================
echo   TOSCANO-VIEW - Actualizacion del index.html
 echo   Cuenta: VIZ343  -  Rama: main
 echo   NO se reemplaza ni se sube el GLB
 echo ================================================================
echo.
if not exist "index.html" (
  echo ERROR: No se encontro index.html junto a este BAT.
  exit /b 1
)
where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git for Windows no esta instalado o no esta en PATH.
  exit /b 1
)
set "REPO=https://github.com/VIZ343/Toscano-View.git"
set "DIR=%TEMP%\Toscano-View-Update-%RANDOM%-%RANDOM%"

echo Clonando la version actual de GitHub para proteger los demas archivos...
git clone --depth 1 --branch main "%REPO%" "%DIR%"
if errorlevel 1 goto :ERROR
if not exist "%DIR%\FRIOX_ligero.glb" (
  echo ERROR: El repositorio no contiene FRIOX_ligero.glb. No se publicara.
  exit /b 1
)
if not exist "%DIR%\FRIOX_ligero.materials.json" (
  echo ERROR: El repositorio no contiene FRIOX_ligero.materials.json. No se publicara.
  exit /b 1
)
copy /y "index.html" "%DIR%\index.html" >nul
if errorlevel 1 goto :ERROR

git -C "%DIR%" add -- index.html
if errorlevel 1 goto :ERROR
git -C "%DIR%" diff --cached --quiet -- index.html
if not errorlevel 1 goto :SIN_CAMBIOS

echo.
echo Comprobando que solo cambia index.html ...
git -C "%DIR%" diff --cached --name-only

echo.
echo Confirmando los cambios ...
git -C "%DIR%" commit -m "Fix: keep base visible, preload FRIOX, restore Material Lab tab"
if errorlevel 1 (
  echo ERROR: Git no pudo hacer commit. Revisa user.name y user.email.
  exit /b 1
)
echo.
echo Subiendo UNICAMENTE la actualizacion del index.html a main...
git -C "%DIR%" push origin main
if errorlevel 1 (
  echo ERROR: El push fallo. No se hizo ningun cambio remoto.
  echo Copia de trabajo para revisar: %DIR%
  exit /b 1
)
echo.
echo OK: https://github.com/VIZ343/Toscano-View
echo Netlify deberia desplegar automaticamente el nuevo commit de main.
echo Tu GLB y sus materiales no fueron modificados por este script.
exit /b 0

:SIN_CAMBIOS
echo El index.html remoto ya coincide con este archivo. No hay cambios.
exit /b 0

:ERROR
echo ERROR: No fue posible completar la actualizacion.
echo Copia temporal: %DIR%
exit /b 1
