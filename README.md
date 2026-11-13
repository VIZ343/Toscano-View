# Toscano-View

Proyecto web estatico Three.js / WebGL de Corporativo Toscano, con modelo FRIOX y configuracion de materiales.

## Estructura

- `index.html`: pagina principal. No usa Node ni requiere compilacion. Carga `material-mapper.js` y, en desarrollo, `material-lab.js` (deben publicarse junto a ella).
- `FRIOX_ligero.glb`: modelo 3D de aproximadamente 40 MB.
- `FRIOX_ligero.materials.json`: mapeo asociado automaticamente a `FRIOX_ligero.glb`.
- `friox_optimizado_max.materials.json`: mapeo original conservado como referencia.
- `netlify.toml`: publicacion de la raiz (`.`) sin build command.
- `publicar_github.bat`: inicializa Git, confirma archivos y hace push a `VIZ343/Toscano-View` desde CMD, sin usar PowerShell.
- `.gitignore`: excluye archivos temporales y secretos locales.

## Material Lab v5

- `material-mapper.js`: lógica de materiales (sin DOM, three.js r128 global). Expone `window.MM`; la instancia del visor queda en `window.materialMapper`.
- `material-lab.js`: panel de desarrollo. Solo se inicia con `DEV_MODE = true` en `index.html`.
- Cada grupo de materiales es un **slot** con variantes (`v1` = automática). Cada variante puede cambiar regla, textura, tinte, escala (0.25×–4×), UV aleatorias y muestra (como textura o como referencia de color; vidrio, espejo, agua y luz solo como color).
- Sin muestra, textura ni referencia, el slot toma el color de su rol en la paleta neutra (principal, secundario, variación).
- **Mapeo `version: 2`** (`<modelo>.materials.json`): slots, variantes, conjuntos (`sets`), paleta, tonos y texturas. Si hay muestras, «Exportar mapeo» genera un `.zip` con el JSON y la carpeta `samples/`; descomprímelo junto a `index.html`. Los mapeos `version: 1` se siguen leyendo (sus anulaciones manuales pasan a variantes).
- En la versión para compartir, un mapeo v2 aplica el estado completo del laboratorio; uno v1 solo aplica lo manual, como antes.

API de variantes (también con `DEV_MODE = false`):

```js
materialMapper.getSlots();                         // [{ slotId, label, role, active, variants }]
materialMapper.addVariant(slotId, { name, rule, texture, tint, scale, randomUV, costRef });
materialMapper.setVariant(slotId, variantId);      // en vivo, sin recargar
materialMapper.saveSet('Insignia'); materialMapper.applySet('Insignia');
window.addEventListener('materialvariantchange', e => console.log(e.detail)); // { slotId, variantId, set, costRef, changes? }
```

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
