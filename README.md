# Toscano-View

Proyecto web estatico Three.js / WebGL de Corporativo Toscano, con modelo FRIOX y configuracion de materiales.

## Estructura

- `index.html`: pagina principal. No usa Node ni requiere compilacion.
- `FRIOX_ligero.glb`: modelo 3D de aproximadamente 40 MB.
- `FRIOX_ligero.materials.json`: mapeo asociado automaticamente a `FRIOX_ligero.glb`.
- `friox_optimizado_max.materials.json`: mapeo original conservado como referencia.
- `netlify.toml`: publicacion de la raiz (`.`) sin build command.
- `publicar_github.bat`: inicializa Git, confirma archivos y hace push a `VIZ343/Toscano-View` desde CMD, sin usar PowerShell.
- `.gitignore`: excluye archivos temporales y secretos locales.

## Publicar en GitHub (cuenta VIZ343)

1. Entra con la cuenta **VIZ343** a <https://github.com/new>.
2. Nombre exacto: **Toscano-View**. Recomendacion inicial: **Private**.
3. NO marques 'Add a README', `.gitignore` ni licencia (el paquete ya contiene lo necesario).
4. Crea el repositorio vacio.
5. Descomprime este ZIP en una carpeta local NUEVA, por ejemplo `C:\Proyectos\Toscano-View`. No ejecutes el .bat desde dentro del ZIP.
6. Ejecuta `publicar_github.bat` (doble clic o terminal **CMD** de VS Code: `publicar_github.bat`). El script verifica Git y archivos antes de subir.
7. Si Git solicita iniciar sesion, autentica la cuenta **VIZ343**.
8. Comprueba que aparezcan los archivos en <https://github.com/VIZ343/Toscano-View>.

Git for Windows: <https://git-scm.com/downloads/win>. No es necesario habilitar PowerShell. La subida por navegador de GitHub tiene limite de 25 MiB por archivo, por eso el modelo GLB debe subirse con Git.

## Conectar Netlify

1. Abre <https://app.netlify.com/start> o en tu equipo elige **Add new project > Import an existing project**.
2. Selecciona **GitHub**; autoriza a Netlify para acceder al repositorio **VIZ343/Toscano-View**.
3. **Branch to deploy**: `main`.
4. **Build command**: dejar vacio.
5. **Publish directory**: `.` (raiz, ya fijado en `netlify.toml`).
6. Publica el sitio y comprueba que carga el HTML, `FRIOX_ligero.glb` y `FRIOX_ligero.materials.json` sin errores 404.

Los cambios posteriores publicados a `main` podran desplegarse automaticamente en Netlify.

## Advertencias / validacion

- El archivo `index.html` y el GLB se mantienen exactamente como en el paquete anterior `Toscano-View_GitHub_Ready.zip`. No se ha alterado el render 3D.
- Se requiere conexion a Internet: la pagina obtiene Three.js r128, loaders/decodificadores y Google Fonts desde CDN, y contiene funciones de Poly Haven (modo de desarrollo deshabilitado por defecto).
- El GLB requiere una carga de unos 40 MB por visitante antes de quedar disponible en cache.
- La estructura y coherencia de nombres se verificaron; **el render WebGL en Netlify y la integracion del repositorio no han sido verificados remotamente**.
