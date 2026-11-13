@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

echo ================================================================
echo   TOSCANO-VIEW - Actualizacion de index.html, material-mapper.js y material-lab.js
 echo   Cuenta: VIZ343  -  Rama: main
 echo   NO se reemplaza ni se sube el GLB
 echo ================================================================
echo.
for %%F in (index.html material-mapper.js material-lab.js) do (
  if not exist "%%F" (
    echo ERROR: No se encontro %%F junto a este BAT.
    exit /b 1
  )
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
for %%F in (index.html material-mapper.js material-lab.js) do (
  copy /y "%%F" "%DIR%\%%F" >nul
  if errorlevel 1 goto :ERROR
)

git -C "%DIR%" add -- index.html material-mapper.js material-lab.js
if errorlevel 1 goto :ERROR
git -C "%DIR%" diff --cached --quiet -- index.html material-mapper.js material-lab.js
if not errorlevel 1 goto :SIN_CAMBIOS

echo.
echo Comprobando que solo cambian index.html y los dos .js ...
git -C "%DIR%" diff --cached --name-only

echo.
echo Confirmando los cambios ...
git -C "%DIR%" commit -m "Material Lab v5: slots, variantes, muestras y paleta neutra"
if errorlevel 1 (
  echo ERROR: Git no pudo hacer commit. Revisa user.name y user.email.
  exit /b 1
)
echo.
echo Subiendo UNICAMENTE index.html, material-mapper.js y material-lab.js a main...
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
echo Los archivos remotos ya coinciden. No hay cambios.
exit /b 0

:ERROR
echo ERROR: No fue posible completar la actualizacion.
echo Copia temporal: %DIR%
exit /b 1
