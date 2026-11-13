/* material-mapper.js — Material Lab v5 · lógica de asignación de materiales (sin DOM).
   Script clásico para three.js r128 (usa el THREE global). Expone window.MM.
   Lo usan la página publicada y el laboratorio de desarrollo (material-lab.js). */
(function (root) {
'use strict';
const THREE = root.THREE;
if (!THREE) throw new Error('material-mapper.js necesita three.js cargado antes');

// =====================================================================
//  material-mapper.js — Asignación automática de materiales (three.js)
//  Analiza un modelo (GLB o geometría generada por código), identifica
//  sus materiales por nombre/metadatos y asigna materiales PBR desde
//  una biblioteca de texturas local o, si no hay, valores procedurales.
//
//  Convención de metadatos (glTF "extras" → userData en three.js):
//    mesh.userData = { material: "Concreto - Losa", category: "Pisos" }
//  Si no hay metadatos se usa material.name y el nombre del objeto.
// =====================================================================

/* ---------------------------------------------------------------
   1. REGLAS POR DEFECTO
   keywords   → se buscan en el nombre del material (es/en, sin acentos)
   categories → se buscan en la categoría (Revit/IFC) del objeto
   library    → etiquetas para elegir textura de la biblioteca
   scale      → metros que cubre una repetición de la textura
   pbr        → material procedural si no hay textura
---------------------------------------------------------------- */
const DEFAULT_RULES = [
  { id:'vidrio', label:'Vidrio', priority:2,
    keywords:['vidrio','glass','cristal','glazing','acristal','policarbonato','laminated glass'],
    categories:['ventanas','windows','muro cortina','curtain panels','paneles de muro cortina'],
    library:[], pbr:{ color:'#d6e6ec', roughness:.04, metalness:0, transmission:.92, ior:1.5, thickness:.012, doubleSided:true } },
  { id:'espejo', label:'Espejo', priority:2,
    keywords:['espejo','mirror'], categories:[], library:[],
    pbr:{ color:'#ffffff', roughness:.02, metalness:1 } },
  { id:'metal', label:'Metal / acero', priority:1,
    keywords:['acero','steel','metal','aluminio','aluminum','aluminium','hierro','iron','inox','stainless','galvaniz',
      'lamina','herreria','cancel','corten','chrome','cromo','brass','laton','silver','diamond plate','dorma','marco metalico'],
    categories:['armazon estructural','structural framing','structural connections','plates','bolts','barandales','railings',
      'top rails','curtain wall mullions','mullions','gutters','runs','landings'],
    library:['metal','steel','aluminum','aluminium','corrugated','iron'], scale:1,
    pbr:{ color:'#a9adb3', roughness:.35, metalness:1 } },
  { id:'concreto', label:'Concreto', priority:0,
    keywords:['concreto','concrete','hormigon','cemento','cement','colado','firme','precolado','plantilla','zapata','trabe concreto'],
    categories:['losas','floors','pisos','columnas estructurales','cimentacion','structural foundations','foundation'],
    library:['concrete','cement','concreto'], scale:2,
    pbr:{ color:'#9e9c96', roughness:.9, metalness:0 } },
  { id:'aplanado', label:'Aplanado / pintura', priority:0,
    keywords:['pintura','paint','aplanado','yeso','plaster','gypsum','tablaroca','drywall','estuco','stucco',
      'repellado','durock','tablacemento','plafon','lambrin'],
    categories:['muros','walls','plafones','ceilings','wall sweeps'],
    library:['plaster','painted','paint','stucco'], scale:2,
    pbr:{ color:'#e9e6df', roughness:.85, metalness:0 } },
  { id:'madera', label:'Madera', priority:1,
    keywords:['madera','wood','roble','oak','nogal','walnut','pino','pine','triplay','plywood','mdf','chapa','parota','duela',
      'ash','birch','cherry','maple','cedar','redcedar','veneer','encino'],
    categories:['puertas','doors','mobiliario','furniture','casework'],
    library:['wood','planks','oak','walnut','plywood','timber'], scale:1.5,
    pbr:{ color:'#9c6b3e', roughness:.6, metalness:0 } },
  { id:'ceramico', label:'Cerámico / porcelanato', priority:1,
    keywords:['porcelanato','ceramica','ceramico','ceramic','azulejo','tile','loseta','mosaico','vitreous','porcelain'],
    categories:['plumbing fixtures','muebles sanitarios'], library:['tiles','tile','ceramic','porcelain'], scale:1.2,
    pbr:{ color:'#d8d4cc', roughness:.3, metalness:0 } },
  { id:'ladrillo', label:'Ladrillo / block', priority:1,
    keywords:['ladrillo','tabique','brick','block','bloque','tabicon','mamposteria','masonry'],
    categories:[], library:['brick','bricks','block','masonry'], scale:1.5,
    pbr:{ color:'#9a5b42', roughness:.85, metalness:0 } },
  { id:'piedra', label:'Piedra / mármol', priority:1,
    keywords:['piedra','stone','marmol','marble','granito','granite','cantera','travertino','laja'],
    categories:[], library:['stone','marble','granite','rock','travertine'], scale:1.5,
    pbr:{ color:'#b8b2a7', roughness:.5, metalness:0 } },
  { id:'asfalto', label:'Asfalto / pavimento', priority:1,
    keywords:['asfalto','asphalt','pavimento','pavement','vialidad','road'],
    categories:['vialidades','roads','paving'], library:['asphalt','road'], scale:4,
    pbr:{ color:'#3b3b3d', roughness:.95, metalness:0 } },
  { id:'pasto', label:'Pasto / vegetación', priority:1,
    keywords:['pasto','grass','cesped','vegetacion','jardin','planting','lawn'],
    categories:['vegetacion','planting'], library:['grass','lawn'], scale:3,
    pbr:{ color:'#5a7d3a', roughness:1, metalness:0 } },
  { id:'terreno', label:'Terreno / grava', priority:0,
    keywords:['tierra','soil','terreno','dirt','grava','gravel','crushed','toposolid','topography','topografia'],
    categories:['topografia','topography','toposolid','site'], library:['ground','soil','dirt','gravel'], scale:4,
    pbr:{ color:'#7a6a55', roughness:1, metalness:0 } },
  { id:'agua', label:'Agua', priority:2,
    keywords:['agua','water','alberca','pool'],
    categories:[], library:[], pbr:{ color:'#2f6a86', roughness:.05, metalness:0, transmission:.4, ior:1.33, thickness:.5 } },
  { id:'tela', label:'Tela / alfombra', priority:1,
    keywords:['tela','fabric','textil','textile','alfombra','carpet','tapiz','upholstery','foam','leather','piel','cuero'],
    categories:[], library:['fabric','carpet','leather'], scale:.8,
    pbr:{ color:'#7d7f86', roughness:.95, metalness:0 } },
  { id:'plastico', label:'Plástico / vinil', priority:0,
    keywords:['plastico','plastic','pvc','vinil','vinyl','acrilico','acrylic','hdpe','laminate','laminado','resin','acetal',
      'rubber','goma','hule','linoleum','flooring','undercoating'],
    categories:[], library:['plastic','vinyl','rubber'], scale:1,
    pbr:{ color:'#d9d9d9', roughness:.4, metalness:0 } },
  { id:'cubierta', label:'Impermeabilizante / cubierta', priority:1,
    keywords:['impermeabiliz','membrana','roofing','multytecho','multitecho','teja'],
    categories:['cubiertas','roofs'], library:['roofing','roof'], scale:2,
    pbr:{ color:'#6d6d6d', roughness:.9, metalness:0 } },
  { id:'emisivo', label:'Luz / LED', priority:2,
    keywords:['led','luminaria','emissive','emisivo'], categories:['lighting fixtures','luminarias'], library:[],
    pbr:{ color:'#ffffff', roughness:.5, metalness:0, emissive:'#ffffff', emissiveIntensity:2 } },
];

/* ---------------------------------------------------------------
   2. UTILIDADES
---------------------------------------------------------------- */
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const splitCamel = s => String(s ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');
const tokenize = s => norm(splitCamel(s)).split(/[^a-z0-9]+/).filter(Boolean);
const normKey = k => norm(k).replace(/[^a-z0-9_]/g, '');

const META_MATERIAL = ['material', 'materialname', 'material_name', 'mat', 'nombrematerial'];
const META_CATEGORY = ['category', 'categoria', 'revitcategory', 'ifcclass', 'ifctype', 'tipo', 'type'];

function readMeta(obj, walkParents) {
  const meta = {};
  for (let p = obj; p; p = walkParents ? p.parent : null) {
    for (const [k, v] of Object.entries(p.userData || {})) {
      const nk = normKey(k);
      if (!(nk in meta) && (typeof v === 'string' || typeof v === 'number')) meta[nk] = String(v);
    }
  }
  return meta;
}
const pick = (meta, keys) => { for (const k of keys) if (meta[k]) return meta[k]; return null; };

/* Categorías de Revit que Datasmith/Twinmotion/UE insertan en el nombre:
   <Material>_<Categoría>_<Familia>_<Tipo>_<n>  */
const REVIT_CATEGORIES = [
  'Structural_Framing','Structural_Columns','Structural_Foundations','Structural_Connections','Structural_Rebar',
  'Curtain_Wall_Mullions','Curtain_Panels','Furniture_Systems','Furniture','Generic_Models','Specialty_Equipment',
  'Plumbing_Fixtures','Mechanical_Equipment','Electrical_Fixtures','Lighting_Fixtures','Casework','Walls','Floors',
  'Ceilings','Roofs','Doors','Windows','Railings','Top_Rails','Handrails','Runs','Landings','Stairs','Gutters',
  'Wall_Sweeps','Slab_Edges','Fascias','Columns','Plates','Bolts','Ramps','Topography','Toposolid','Site','Planting',
  'Entourage','Parking','Pipes','Ducts','Cable_Trays','Conduits',
];
const CAT_ORDER = [...REVIT_CATEGORIES].sort((a, b) => b.length - a.length);

function parseName(raw) {
  const clean = String(raw ?? '').replace(/(_\d+)+$/, '').replace(/\.\d{3}$/, '').replace(/_+$/, '');
  let best = null;
  for (const cat of CAT_ORDER) {
    const i = ('_' + clean + '_').indexOf('_' + cat + '_');
    if (i > 0 && (!best || i < best.i)) best = { i, cat };      // i>0: debe haber material antes
  }
  if (!best) return { material: clean, category: null, family: '', key: clean };
  const material = clean.slice(0, best.i - 1).replace(/_+$/, '');
  const family = clean.slice(best.i - 1 + best.cat.length + 1).replace(/^_+/, '');
  return { material, category: best.cat.replace(/_/g, ' '), family, key: `${material} · ${best.cat.replace(/_/g, ' ')}` };
}

/* ---------------------------------------------------------------
   3. INVENTARIO: agrupa por material de origen
---------------------------------------------------------------- */
function inventory(root) {
  const byName = new Map();
  [].concat(root).forEach(r0 => r0.traverse(o => {
    if (!o.isMesh) return;
    const meta = readMeta(o, true);                    // metadatos del objeto y sus padres
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, slot) => {
      const mMeta = readMeta(m || {}, false);          // extras del material glTF
      const raw = pick(mMeta, META_MATERIAL)
        || (mats.length === 1 && pick(meta, META_MATERIAL))
        || m?.name || 'Sin nombre';
      const parsed = parseName(raw);
      const name = parsed.key;
      let e = byName.get(name);
      if (!e) byName.set(name, e = {
        name, material: parsed.material, uses: [], categories: new Set(), hints: new Set(), families: new Set(),
        color: m?.color ? '#' + m.color.getHexString() : null,
      });
      e.uses.push({ mesh: o, slot, original: m, family: parsed.family });
      const cat = pick(mMeta, META_CATEGORY) || pick(meta, META_CATEGORY) || parsed.category;
      if (cat) e.categories.add(cat);
      if (parsed.family && e.families.size < 30) e.families.add(parsed.family);
      if (e.hints.size < 30) {
        if (m?.name && m.name !== name) e.hints.add(m.name);
        if (o.name) e.hints.add(o.name);
        if (o.parent?.name) e.hints.add(o.parent.name);
      }
    });
  }));
  return [...byName.values()].sort((a, b) => b.uses.length - a.uses.length);
}

/* ---------------------------------------------------------------
   4. COINCIDENCIA material → regla
---------------------------------------------------------------- */
const words = s => ' ' + tokenize(s).join(' ') + ' ';
// La palabra clave debe empezar en un límite de palabra ("led" no coincide con "polished")
// Palabras cortas (≤3 letras: led, ash, pvc) deben coincidir completas
const hasWord = (text, kw) => { const k = words(kw).trim(); return text.includes(' ' + k + (k.length <= 3 ? ' ' : '')); };

function scoreRule(r, t) {
  const kw = []; const why = [];
  for (const k of r.keywords || []) {
    const kk = words(k).trim();
    if (hasWord(t.name, k)) {
      const exactFirst = t.first === kk || t.first === kk + 's' || t.first === kk + 'es';
      kw.push(10 + (exactFirst ? 4 : 0)); why.push(`material «${k}»`);
    } else if (hasWord(t.family, k)) { kw.push(5); why.push(`familia «${k}»`); }
    else if (hasWord(t.hints, k)) { kw.push(4); why.push(`objeto «${k}»`); }
  }
  let cat = 0;
  for (const c of r.categories || []) if (t.cats.includes(words(c))) { cat = 3; why.push(`categoría «${c}»`); break; }
  if (!kw.length && !cat) return null;
  return { score: (kw.length ? Math.max(...kw) + (kw.length - 1) * .5 : 0) + cat + (r.priority || 0), why };
}

function matchRule(entry, rules, minScore = 3) {
  const t = {
    name: words(entry.material ?? entry.name),
    first: tokenize(entry.material ?? entry.name)[0] || '',
    family: words([...(entry.families || [])].join(' ')),
    hints: words([...entry.hints].join(' ')),
    cats: [...entry.categories].map(words).join('|'),
  };
  let best = { rule: null, score: 0, why: [] };
  for (const r of rules) {
    const s = scoreRule(r, t);
    if (s && s.score > best.score) best = { rule: r, ...s };
  }
  if (best.score < minScore) return { rule: null, score: best.score, why: best.why };
  return best;
}

/* ¿Qué material sugiere solo el nombre de familia/tipo de Revit? (p. ej. "EST_TRABE_CONCRETO") */
function familyRule(family, rules) {
  if (!family) return null;
  const t = { name: words(family), first: '', family: ' ', hints: ' ', cats: '' };
  let best = null;
  for (const r of rules) {
    const s = scoreRule(r, t);
    if (s && s.score >= 10 && (!best || s.score > best.score)) best = { rule: r, score: s.score };
  }
  return best?.rule || null;
}

/* DEV:START — biblioteca de texturas local (carpeta / manifest) */
/* ---------------------------------------------------------------
   5. BIBLIOTECA DE TEXTURAS
   Lee una lista de archivos { path, url } (p. ej. de una carpeta) y
   agrupa los mapas de cada material por sufijo:
     Concrete034_2K_Color.jpg / _NormalGL / _Roughness / _AO ...
     oak_planks_diff_2k.jpg  / _nor_gl / _rough / _ao ...
---------------------------------------------------------------- */
const SUFFIXES = {
  map: ['basecolor', 'base_color', 'albedo', 'diffuse', 'diff', 'color', 'colour', 'col'],
  normalMap: ['normalgl', 'normal_gl', 'nor_gl', 'norgl', 'normal', 'nrm', 'nor', 'normaldx', 'normal_dx', 'nor_dx', 'nordx'],
  roughnessMap: ['roughness', 'rough', 'rgh'],
  metalnessMap: ['metalness', 'metallic', 'metal', 'mtl'],
  aoMap: ['ambientocclusion', 'ambient_occlusion', 'occlusion', 'ao'],
  displacementMap: ['displacement', 'disp', 'height', 'bump'],
  alphaMap: ['opacity', 'alpha'],
};
const SUFFIX_LOOKUP = Object.fromEntries(Object.entries(SUFFIXES).flatMap(([slot, arr]) => arr.map(s => [s, slot])));
const IMG_EXT = /\.(jpe?g|png|webp)$/i;
const NOISE = t => /^\d+k$/.test(t) || ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'exr'].includes(t);

function parseTextureList(files) {
  const groups = new Map();
  const loose = [];
  for (const f of files) {
    const path = f.path.replace(/\\/g, '/');
    if (!IMG_EXT.test(path) || /(^|\/)\./.test(path) || /preview|thumb|sphere|cube\.png/i.test(path.split('/').pop())) continue;
    const parts = path.split('/'); const file = parts.pop(); const dir = parts.join('/');
    const toks = norm(splitCamel(file.replace(IMG_EXT, ''))).split(/[^a-z0-9]+/).filter(t => t && !NOISE(t));
    let slot = null, cut = 0, suffix = '';
    for (const n of [2, 1]) {
      if (toks.length <= n) continue;
      const tail = toks.slice(-n);
      for (const cand of [tail.join('_'), tail.join('')]) {
        if (SUFFIX_LOOKUP[cand]) { slot = SUFFIX_LOOKUP[cand]; cut = n; suffix = cand; break; }
      }
      if (slot) break;
    }
    const base = toks.slice(0, toks.length - cut).join('_') || 'material';
    const key = (dir ? dir + '/' : '') + base;
    if (!slot) { loose.push({ key, f, dir, base }); continue; }
    let g = groups.get(key);
    if (!g) groups.set(key, g = { id: key, label: base, dir, maps: {}, normalDX: false });
    const isDX = slot === 'normalMap' && suffix.includes('dx');
    if (slot === 'normalMap' && g.maps.normalMap && isDX && !g.normalDX) continue;   // preferir OpenGL
    if (slot === 'normalMap') g.normalDX = isDX;
    g.maps[slot] = { url: f.url, path };
  }
  // Archivos sin sufijo: color base solo si el grupo no lo tiene (o crean grupo propio)
  for (const { key, f, dir, base } of loose) {
    let g = groups.get(key);
    if (!g) groups.set(key, g = { id: key, label: base, dir, maps: {}, normalDX: false });
    if (!g.maps.map) g.maps.map = { url: f.url, path: f.path };
  }
  return [...groups.values()].filter(g => g.maps.map || g.maps.normalMap).map(g => {
    const raw = tokenize(g.dir).concat(tokenize(g.label));
    const tags = [...new Set(raw.flatMap(t => [t, t.replace(/\d+/g, '')]).filter(t => t.length > 1 && !NOISE(t)))];
    return { ...g, tags, scale: null };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function libraryFromFiles(fileList) {
  return parseTextureList([...fileList].map(file => ({
    path: file.webkitRelativePath || file.name, url: URL.createObjectURL(file),
  })));
}

/* Manifest con rutas relativas para usar la misma biblioteca en producción */
function exportManifest(library) {
  return { version: 1, materials: library.map(t => ({
    id: t.id, tags: t.tags, scale: t.scale, normalDX: t.normalDX,
    maps: Object.fromEntries(Object.entries(t.maps).map(([k, v]) => [k, v.path])),
  })) };
}
function libraryFromManifest(json, baseUrl = '') {
  return (json.materials || []).map(m => ({
    ...m, label: m.id.split('/').pop(),
    maps: Object.fromEntries(Object.entries(m.maps).map(([k, p]) => [k, { path: p, url: baseUrl + p }])),
  }));
}

/* DEV:END */
function resolveTexture(rule, library) {
  if (!rule || (!rule.library?.length && rule.pbr?.transmission) || !library?.length) return null;
  let best = null, bestScore = 0;
  for (const t of library) {
    let s = 0;
    for (const k of rule.library) {
      const kk = norm(k);
      if (t.tags.includes(kk)) s += 3; else if (t.tags.some(tag => tag.includes(kk))) s += 1;
    }
    for (const k of rule.keywords || []) if (t.tags.includes(norm(k))) s += 2;   // carpetas con nombre en español
    if (s > bestScore || (s === bestScore && s > 0 && t.id < best.id)) { best = t; bestScore = s; }
  }
  return best;
}

/* Reglas cuya identidad depende de transparencia, reflexión o emisión: una muestra solo puede darles color */
const COLOR_ONLY = new Set(['vidrio', 'espejo', 'agua', 'emisivo']);
const isColorOnly = rule => !!rule && (COLOR_ONLY.has(rule.id) || (rule.pbr?.transmission || 0) > 0 || !!rule.pbr?.emissive);

/* ---------------------------------------------------------------
   6. MATERIALES PBR Y UV
---------------------------------------------------------------- */
let texLoader = null;
const CFG = { aniso: 4, env: .6, randUV: false, epoch: 0, noTile: false, webgl2: false, mode: 'off' };
const made = [];
/* Anti-repetición «infinita»: cada textura se muestrea dos veces con desplazamientos distintos y se mezcla según ruido de baja frecuencia (WebGL2) */
const NOTILE_GLSL = [
 'float ntHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
 'float ntNoise(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);return mix(mix(ntHash(i),ntHash(i+vec2(1.0,0.0)),f.x),mix(ntHash(i+vec2(0.0,1.0)),ntHash(i+vec2(1.0,1.0)),f.x),f.y);}',
 'vec4 noTile(sampler2D t,vec2 uv){',
 ' float l=ntNoise(uv*0.35)*8.0;float f=fract(l);float ia=floor(l);float ib=ia+1.0;',
 ' vec2 oa=sin(vec2(3.0,7.0)*ia);vec2 ob=sin(vec2(3.0,7.0)*ib);',
 ' vec2 dx=dFdx(uv),dy=dFdy(uv);',
 ' vec4 a=textureGrad(t,uv+oa,dx,dy);vec4 b=textureGrad(t,uv+ob,dx,dy);',
 ' return mix(a,b,smoothstep(0.2,0.8,f-0.1*dot(a-b,vec4(1.0))));}'].join('\n');
function patchNoTile(M) {
  M.customProgramCacheKey = () => 'nt' + (CFG.noTile ? 1 : 0);
  M.onBeforeCompile = (sh) => {
    if (!CFG.noTile) return;
    const SC = THREE.ShaderChunk, sw = (c, n) => c.replace(new RegExp('texture2D\\( ' + n + ', vUv \\)', 'g'), 'noTile( ' + n + ', vUv )');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', NOTILE_GLSL + '\nvoid main() {')
      .replace('#include <map_fragment>', sw(SC.map_fragment, 'map'))
      .replace('#include <normal_fragment_maps>', sw(SC.normal_fragment_maps, 'normalMap'))
      .replace('#include <roughnessmap_fragment>', sw(SC.roughnessmap_fragment, 'roughnessMap'))
      .replace('#include <metalnessmap_fragment>', sw(SC.metalnessmap_fragment, 'metalnessMap'));
  };
}
/* mode: 'off' | 'obj' (UV con giro y desplazamiento propios por objeto) | 'inf' (muestreo estocástico en el shader) */
function setAntiTile(mode) {
  CFG.mode = mode || 'off'; CFG.randUV = CFG.mode === 'obj'; CFG.noTile = CFG.mode === 'inf' && !!CFG.webgl2; CFG.epoch++;
  made.forEach(m => { m.needsUpdate = true; });
}
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* Texturas: cada imagen se descarga una sola vez (base); los materiales usan copias que comparten la imagen
   y solo difieren en `repeat`. Las copias creadas antes de que llegue la imagen se completan al cargar. */
const texBase = new Map(), texShared = new Map(), texPending = new Map(), baseOf = new WeakMap();
function baseTex(url, srgb) {
  const key = url + '|' + srgb;
  if (texBase.has(key)) return texBase.get(key);
  const t = (texLoader || (texLoader = new THREE.TextureLoader().setCrossOrigin('anonymous'))).load(url, () => {
    (texPending.get(t) || []).forEach(c => { c.image = t.image; c.needsUpdate = true; });
    texPending.delete(t);
    MM_HOOKS.onTexture();
  }, undefined, () => texPending.delete(t));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) { if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding; }
  texBase.set(key, t);
  return t;
}
function cloneTex(b, rep) {
  const t = b.clone(); baseOf.set(t, b);
  t.repeat.set(rep, rep); t.anisotropy = CFG.aniso;
  if (!b.image) { if (!texPending.has(b)) texPending.set(b, []); texPending.get(b).push(t); }
  return t;
}
/* Copia compartida por (url, repetición): dos materiales con la misma escala usan la misma textura en GPU */
function texFor(url, srgb, rep) {
  const key = `${url}|${srgb}|${rep}`;
  if (!texShared.has(key)) texShared.set(key, cloneTex(baseTex(url, srgb), rep));
  return texShared.get(key);
}
const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'];

/* spec = { rule, tex, tint, color, rep } — ver MaterialMapper.resolve() */
function createMaterial(spec) {
  const { rule, tex } = spec;
  const p = { ...(rule?.pbr || {}) };
  const physical = (p.transmission || 0) > 0 || (p.clearcoat || 0) > 0;
  const M = physical ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
  M.name = `${rule?.id || 'auto'}${tex ? ' · ' + tex.label : ''}`;
  M.color.set(spec.color || p.color || '#cccccc');
  M.roughness = p.roughness ?? .8;
  M.metalness = p.metalness ?? 0;
  if (physical) {
    M.transmission = p.transmission ?? 0; M.ior = p.ior ?? 1.5;
    M.thickness = p.thickness ?? 0; M.clearcoat = p.clearcoat ?? 0;
  }
  if (p.opacity != null && p.opacity < 1) { M.transparent = true; M.opacity = p.opacity; }
  if (p.emissive) { M.emissive.set(spec.tint || p.emissive); M.emissiveIntensity = p.emissiveIntensity ?? 1; }
  if (p.doubleSided) M.side = THREE.DoubleSide;
  /* referencia de color sin textura: tiñe el color base (en vidrio, la transmisión) */
  if (spec.tint && !tex) {
    M.color.set(spec.tint);
    if (M.attenuationColor) M.attenuationColor.set(spec.tint);
    if (M.attenuationTint) M.attenuationTint.set(spec.tint);
  }

  M.envMapIntensity = p.transmission ? 1 : CFG.env;
  if (tex) {
    const rep = spec.rep;
    const L = (slot, srgb = false) => tex.maps[slot] ? texFor(tex.maps[slot].url, srgb, rep) : null;
    if ((M.map = L('map', true))) M.color.set(spec.tint || p.tint || '#ffffff');
    if (tex.maps.arm && !tex.maps.roughnessMap) {          // ARM empaquetado: R=AO, G=rugosidad, B=metal
      const arm = L('arm'); M.roughnessMap = arm; M.metalnessMap = arm; M.aoMap = arm;
      M.roughness = 1; M.metalness = 1;
    }
    if ((M.normalMap = L('normalMap')) && tex.normalDX) M.normalScale.set(1, -1);
    if (tex.maps.roughnessMap) { M.roughnessMap = L('roughnessMap'); M.roughness = 1; }
    if (tex.maps.metalnessMap) { M.metalnessMap = L('metalnessMap'); M.metalness = 1; }
    if (tex.maps.aoMap) M.aoMap = L('aoMap');
    if ((M.alphaMap = L('alphaMap'))) M.transparent = true;
    made.push(M); patchNoTile(M);
  }
  return M;
}
/* Cambia la repetición de un material en vivo (sin recrearlo). La primera vez le da copias propias de sus texturas. */
function setMaterialRepeat(M, rep) {
  if (!M.userData.ownTex) {
    const seen = new Map();
    TEX_SLOTS.forEach(k => { const t = M[k]; if (!t) return; if (!seen.has(t)) seen.set(t, cloneTex(baseOf.get(t) || t, rep)); M[k] = seen.get(t); });
    M.userData.ownTex = true; M.needsUpdate = true;
  }
  TEX_SLOTS.forEach(k => { if (M[k]) M[k].repeat.set(rep, rep); });
}

/* UV tipo caja en metros: proyecta cada cara sobre el eje dominante de su normal.
   seed (opcional): giro de 0/90/180/270° y desplazamiento propios de la pieza («UV aleatorias»). */
function boxUV(geometry, s = new THREE.Vector3(1, 1, 1), seed = null) {
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const P = geometry.attributes.position, N = geometry.attributes.normal;
  const uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i) * s.x, y = P.getY(i) * s.y, z = P.getZ(i) * s.z;
    const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = z; v = y; }
    else if (ay >= az) { u = x; v = z; }
    else { u = x; v = y; }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  if (seed != null) {
    const rot = seed % 4, ox = ((seed >>> 3) % 1000) / 7.3, oy = ((seed >>> 13) % 1000) / 5.1;
    for (let i = 0; i < P.count; i++) {
      let u = uv[i * 2], v = uv[i * 2 + 1], t;
      if (rot === 1) { t = u; u = -v; v = t; }            // 90°
      else if (rot === 2) { u = -u; v = -v; }             // 180°
      else if (rot === 3) { t = u; u = v; v = -t; }       // 270°
      uv[i * 2] = u + ox; uv[i * 2 + 1] = v + oy;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('uv2', geometry.attributes.uv);
}

function prepareUV(mesh, mode, seed) {
  const g = mesh.geometry, ud = g.userData;
  if (seed == null && CFG.randUV) seed = hashStr(g.uuid);
  const hasOrig = !!ud.__uvOrig || (!ud.__boxed && !!g.attributes.uv);
  if (mode === 'box' || !hasOrig) {
    const sig = CFG.epoch + '|' + (seed ?? '-');
    if (!ud.__boxed || ud.__sig !== sig) {
      if (g.attributes.uv && !ud.__boxed && !ud.__uvOrig) ud.__uvOrig = g.attributes.uv;
      const s = new THREE.Vector3(); mesh.updateWorldMatrix(true, false); mesh.getWorldScale(s);
      boxUV(g, s, seed); ud.__boxed = true; ud.__sig = sig;
    }
  } else if (ud.__boxed && ud.__uvOrig) {
    g.setAttribute('uv', ud.__uvOrig); ud.__boxed = false; ud.__sig = null;
  }
  if (g.attributes.uv) g.setAttribute('uv2', g.attributes.uv);
}
const setMat = (mesh, slot, mat) => {
  if (Array.isArray(mesh.material)) mesh.material[slot] = mat; else mesh.material = mat;
};

/* Grupos de la lista maestra (categoría de Revit → grupo en español) */
const CATEGORY_GROUPS = [
  ['Muros', ['walls', 'muros', 'wall sweeps', 'curtain panels', 'paneles de muro cortina', 'muro cortina']],
  ['Pisos', ['floors', 'pisos', 'losas', 'slab edges', 'ramps', 'stairs', 'runs', 'landings']],
  ['Plafones', ['ceilings', 'plafones']],
  ['Cubiertas', ['roofs', 'cubiertas', 'gutters', 'fascias']],
  ['Ventanas', ['windows', 'ventanas', 'curtain wall mullions']],
  ['Puertas', ['doors', 'puertas']],
  ['Estructura', ['structural framing', 'structural columns', 'structural foundations', 'structural connections', 'structural rebar',
    'columns', 'plates', 'bolts', 'columnas estructurales', 'armazon estructural', 'cimentacion']],
  ['Barandales', ['railings', 'top rails', 'handrails', 'barandales']],
  ['Mobiliario', ['furniture', 'furniture systems', 'casework', 'mobiliario', 'specialty equipment']],
  ['Instalaciones', ['plumbing fixtures', 'mechanical equipment', 'electrical fixtures', 'lighting fixtures', 'pipes', 'ducts', 'cable trays', 'conduits', 'luminarias', 'muebles sanitarios']],
  ['Sitio', ['topography', 'toposolid', 'site', 'planting', 'entourage', 'parking', 'topografia', 'vialidades', 'sitio']],
];
const GROUP_ORDER = CATEGORY_GROUPS.map(g => g[0]).concat('Otros');
function categoryGroup(entry) {
  for (const c of entry.categories || []) {
    const n = norm(c);
    for (const [g, list] of CATEGORY_GROUPS) if (list.includes(n)) return g;
  }
  return 'Otros';
}

const deep = o => o == null ? o : JSON.parse(JSON.stringify(o));
const VARIANT_FIELDS = ['name', 'rule', 'texture', 'tint', 'scale', 'randomUV', 'sample', 'sampleMode', 'costRef'];
/* ¿La variante cambia algo respecto a la asignación automática? */
const variantIsManual = v => !!v && (v.rule != null || v.texture != null || v.tint != null || v.sample != null
  || (v.scale != null && v.scale !== 1) || !!v.randomUV);
const cleanVariant = v => { const o = {}; for (const k of VARIANT_FIELDS) if (v[k] !== undefined && v[k] !== null && v[k] !== '') o[k] = v[k]; return o; };

/* Evento global para conectar variantes con otras partes de la página (p. ej. escenarios del presupuesto) */
function emitVariantChange(detail) {
  const g = typeof globalThis !== 'undefined' ? globalThis : null;
  if (!g || typeof g.dispatchEvent !== 'function' || typeof g.CustomEvent !== 'function') return;
  g.dispatchEvent(new g.CustomEvent('materialvariantchange', { detail }));
}
/* Ganchos que la página puede reemplazar (p. ej. volver a pintar cuando termina de cargar una textura) */
const MM_HOOKS = { onTexture() {} };

/* ---------------------------------------------------------------
   7. CLASE PRINCIPAL
   Cada grupo del inventario es un SLOT (slotId = nombre del grupo).
   Un slot guarda varias variantes y una activa:
     slots[slotId] = { label, role, active: 'v1', variants: { v1: { name, rule?, texture?, tint?, scale?, randomUV?,
                       sample?, sampleMode?, costRef? } } }
   Lo que una variante no define se hereda de la regla (asignación automática).
   sets[nombre] = { [slotId]: variantId }
---------------------------------------------------------------- */
class MaterialMapper {
  constructor({ rules = DEFAULT_RULES, library = [], uvMode = 'box', minScore = 3 } = {}) {
    Object.assign(this, { rules, library, uvMode, minScore });
    this.ruleTex = {};        // { [ruleId]: textura elegida (web) | null = procedural }
    this.ruleTint = {};       // { [ruleId]: '#rrggbb' } tono por perfil
    this.slots = {};          // ver arriba
    this.sets = {};
    this.sampleBase = '';     // prefijo para resolver «samples/…» (la versión para compartir los carga junto a la página)
    this.sampleUrls = {};     // { 'samples/x.jpg': url } registradas por el laboratorio (IndexedDB)
    this.entries = [];
    this.cache = new Map();
    this.accept = null;
    this.meshSlots = new Map();
  }

  analyze(root) {
    this.root = root;
    this._roots = new Set([].concat(root));
    const out = [];
    for (const e of inventory(root)) {
      const match = matchRule(e, this.rules, this.minScore);
      // Separa los objetos cuya familia sugiere otro material (p. ej. acero corten en trabes de concreto)
      const famCache = new Map();
      const buckets = new Map();
      for (const u of e.uses) {
        if (!famCache.has(u.family)) famCache.set(u.family, familyRule(u.family, this.rules));
        const fr = famCache.get(u.family);
        const k = fr && fr !== match.rule ? fr.id : '';
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(u);
      }
      for (const [k, uses] of buckets) {
        const fams = new Set(uses.map(u => u.family).filter(Boolean));
        const conflict = k ? this.rules.find(r => r.id === k) : null;
        const sub = { ...e, uses, families: fams, name: conflict ? `${e.name} · familia ${conflict.label.toLowerCase()}` : e.name };
        sub.match = { ...matchRule(sub, this.rules, this.minScore), conflict };
        sub.group = categoryGroup(sub);
        out.push(sub);
      }
    }
    this.entries = out.sort((a, b) => b.uses.length - a.uses.length);
    this.byName = new Map(this.entries.map(e => [e.name, e]));
    this.meshSlots = new Map();
    this.geoUsers = new Map();
    for (const e of this.entries) for (const u of e.uses) {
      let list = this.meshSlots.get(u.mesh);
      if (!list) {                                     // primera vez que se ve la pieza: cuenta quién comparte su geometría
        this.meshSlots.set(u.mesh, list = []);
        const g = u.mesh.geometry; if (g) this.geoUsers.set(g, (this.geoUsers.get(g) || 0) + 1);
      }
      if (!list.includes(e.name)) list.push(e.name);
    }
    this._ensureSlots();
    return this.entries;
  }

  /* Cada grupo nace con v1 = asignación automática */
  _ensureSlots() {
    for (const e of this.entries) {
      const s = this.slots[e.name];
      if (!s) this.slots[e.name] = { label: this._label(e), role: null, active: 'v1', variants: { v1: { name: 'Automático' } } };
      else { if (!s.label) s.label = this._label(e); if (!s.variants?.[s.active]) s.active = Object.keys(s.variants || {})[0] || 'v1'; }
    }
  }
  _label(e) {
    const cat = [...(e.categories || [])][0];
    const mat = String(e.material || e.name).replace(/_+/g, ' ').trim();
    return cat ? `${mat} · ${cat}` : mat;
  }

  /* Limpia slots, conjuntos y elecciones al cambiar de modelo */
  resetState() { this.slots = {}; this.sets = {}; this.ruleTex = {}; this.ruleTint = {}; }

  setLibrary(library) { this.library = library; this.clearCache(); }
  setRules(rules) { this.rules = rules; this.clearCache(); if (this.root) this.analyze(this.root); }
  clearCache() { this.cache.forEach(m => m.dispose()); this.cache.clear(); }

  findRule(id) { return this.rules.find(r => r.id === id) || null; }
  findTexture(id) { return this.library.find(t => t.id === id) || null; }
  sampleUrl(ref) { return ref ? (this.sampleUrls[ref] || this.sampleBase + ref) : null; }
  /* Muestra usada como textura: una entrada de biblioteca con solo color base */
  sampleTexture(ref, rule) {
    return { id: 'sample:' + ref, label: String(ref).split('/').pop(), source: 'sample', tags: [],
      maps: { map: { url: this.sampleUrl(ref), path: ref } }, scale: rule?.scale ?? 1 };
  }
  isColorOnly(rule) { return isColorOnly(rule); }

  activeVariant(slotId) { const s = this.slots[slotId]; return s ? s.variants[s.active] || {} : {}; }
  isManual(slotId) { return variantIsManual(this.activeVariant(slotId)); }

  /* Resuelve qué material lleva un slot con su variante activa (o la indicada) */
  resolve(e, variant) {
    const v = variant || this.activeVariant(e.name);
    const keepOriginal = v.rule === '__none';
    const rule = keepOriginal ? null : v.rule ? this.findRule(v.rule) || e.match.rule : e.match.rule;
    const colorOnly = isColorOnly(rule);
    const sampleMode = v.sample ? (colorOnly ? 'color' : (v.sampleMode || 'texture')) : null;
    let tex = null;
    if (sampleMode === 'texture') tex = this.sampleTexture(v.sample, rule);
    else if (v.texture === '__none') tex = null;
    else if (v.texture) tex = this.findTexture(v.texture);
    else tex = rule && rule.id in this.ruleTex ? this.ruleTex[rule.id] : resolveTexture(rule, this.library);
    const scale = v.scale > 0 ? v.scale : 1;
    const baseScale = (tex && tex.scale) || rule?.scale || 1;          // metros por repetición (real)
    const tint = v.tint || (tex && rule ? this.ruleTint[rule.id] : null) || null;
    const source = variantIsManual(v) ? 'manual' : rule ? 'auto' : 'none';
    return { rule, tex, tint, color: null, scale, baseScale, meters: baseScale * scale, rep: 1 / (baseScale * scale),
      randomUV: !!v.randomUV, sampleMode, keepOriginal, colorOnly, source };
  }
  _key(r) {
    return [r.rule?.id || '-', r.tex?.id || '-', r.tint || '', r.color || '', r.tex ? +r.rep.toFixed(5) : ''].join('|');
  }
  _material(r) {
    const key = this._key(r);
    let mat = this.cache.get(key);
    if (!mat) { mat = createMaterial(r); mat.userData.mmKey = key; this.cache.set(key, mat); }
    return mat;
  }
  /* Semilla estable por pieza: ruta de nombres e índices desde la raíz del modelo (no cambia al recargar) */
  pieceSeed(mesh) {
    if (mesh.userData.__mmSeed != null) return mesh.userData.__mmSeed;
    const parts = [];
    for (let o = mesh; o && o.parent && !this._roots?.has(o); o = o.parent) parts.push((o.name || '') + '#' + o.parent.children.indexOf(o));
    return (mesh.userData.__mmSeed = hashStr(parts.join('/')));
  }

  _applyEntry(e) {
    const r = e.result = this.resolve(e);
    const original = () => { e.mat = null; e.uses.forEach(u => setMat(u.mesh, u.slot, u.original)); };
    if (this.accept && !this.accept(e)) return original();
    if (r.keepOriginal || (!r.rule && !r.tex && !r.tint && !r.color)) return original();
    const mat = e.mat = this._material(r);
    for (const u of e.uses) {
      if (r.tex) {
        let seed = null;
        if (r.randomUV) {
          seed = this.pieceSeed(u.mesh);
          // la geometría compartida entre piezas se clona para que cada una tenga su propia UV
          if ((this.geoUsers.get(u.mesh.geometry) || 0) > 1 && !u.mesh.userData.__mmOwnGeo) {
            const g0 = u.mesh.geometry; this.geoUsers.set(g0, this.geoUsers.get(g0) - 1);
            u.mesh.geometry = g0.clone(); u.mesh.userData.__mmOwnGeo = true; this.geoUsers.set(u.mesh.geometry, 1);
          }
        }
        prepareUV(u.mesh, this.uvMode, seed);
      }
      setMat(u.mesh, u.slot, mat);
    }
  }

  apply(accept) {
    if (accept !== undefined) this.accept = accept || null;
    for (const e of this.entries) this._applyEntry(e);
    return this.report();
  }
  /* Vuelve a aplicar solo algunos slots (cambios en vivo) */
  applySlots(ids) { for (const id of [].concat(ids)) { const e = this.byName?.get(id); if (e) this._applyEntry(e); } }

  /* Reglas en uso, ordenadas por número de objetos (los materiales más utilizados del modelo) */
  usedRules() {
    const m = new Map();
    for (const e of this.entries) {
      const r = e.result?.rule || this.resolve(e).rule;
      if (r) m.set(r.id, { rule: r, objects: (m.get(r.id)?.objects || 0) + e.uses.length, groups: (m.get(r.id)?.groups || 0) + 1 });
    }
    return [...m.values()].sort((a, b) => b.objects - a.objects);
  }

  restore() { for (const e of this.entries) e.uses.forEach(u => setMat(u.mesh, u.slot, u.original)); }

  report() {
    const c = { total: this.entries.length, auto: 0, manual: 0, none: 0, textured: 0, review: 0,
      objects: 0, sourceMaterials: new Set(), builtMaterials: this.cache.size };
    for (const e of this.entries) {
      c[e.result?.source || 'none']++; if (e.result?.tex) c.textured++;
      if (e.match?.conflict && e.result?.source !== 'manual') c.review++;
      c.objects += e.uses.length; e.uses.forEach(u => c.sourceMaterials.add(u.original));
    }
    c.sourceMaterials = c.sourceMaterials.size;
    return c;
  }

  /* ---------- Mapeo (version 2) ---------- */
  exportMapping(model = '') {
    const slots = {}, used = new Map();
    const take = t => { if (t && t.source !== 'sample' && !used.has(t.id)) used.set(t.id, t); };
    for (const e of this.entries) {
      const s = this.slots[e.name]; if (!s) continue;
      slots[e.name] = { label: s.label, role: s.role ?? null, active: s.active,
        variants: Object.fromEntries(Object.entries(s.variants).map(([id, v]) => [id, cleanVariant(v)])) };
      Object.values(s.variants).forEach(v => { if (v.texture && v.texture !== '__none') take(this.findTexture(v.texture)); });
      take(e.result?.tex);
    }
    Object.values(this.ruleTex).forEach(take);
    return {
      version: 2, model, uvMode: this.uvMode, antiTile: CFG.mode,
      ruleTint: { ...this.ruleTint },
      ruleTex: Object.fromEntries(Object.entries(this.ruleTex).map(([r, t]) => [r, t ? t.id : null])),
      textures: [...used.values()].map(t => ({ id: t.id, label: t.label, source: t.source || 'local', scale: t.scale ?? null,
        normalDX: !!t.normalDX, tags: t.tags, thumb: t.thumb || null, url: t.url || null, maps: t.maps })),
      slots, sets: deep(this.sets),
      // resumen informativo (no se usa al importar)
      assignments: Object.fromEntries(this.entries.map(e => [e.name, {
        rule: e.result?.rule?.id ?? null, texture: e.result?.tex?.id ?? null, source: e.result?.source ?? 'none' }])),
    };
  }

  /* Lee mapeos version 2 y version 1 (las anulaciones manuales de v1 se convierten en variantes) */
  importMapping(json) {
    json = json || {};
    if (json.uvMode) this.uvMode = json.uvMode;
    setAntiTile(json.antiTile || 'off');
    if (Array.isArray(json.textures)) this.library = json.textures.map(t => ({ ...t }));
    this.ruleTint = { ...(json.ruleTint || {}) };
    this.ruleTex = {};
    for (const [r, id] of Object.entries(json.ruleTex || {})) this.ruleTex[r] = id ? this.findTexture(id) : null;
    this.slots = {}; this.sets = {};
    if ((json.version || 1) >= 2) {
      for (const [id, s] of Object.entries(json.slots || {})) {
        if (!s || !s.variants || !Object.keys(s.variants).length) continue;
        this.slots[id] = { label: s.label || id, role: s.role ?? null, active: s.variants[s.active] ? s.active : Object.keys(s.variants)[0],
          variants: Object.fromEntries(Object.entries(s.variants).map(([vid, v]) => [vid, cleanVariant(v)])) };
      }
      this.sets = deep(json.sets || {});
    } else {
      for (const [name, a] of Object.entries(json.assignments || {})) {
        const o = a && a.override; if (!o) continue;
        const v = { name: 'Manual' };
        if (o.rule) v.rule = o.rule;
        if (o.texture) v.texture = o.texture;
        this.slots[name] = { label: name, role: null, active: 'v2', variants: { v1: { name: 'Automático' }, v2: v } };
      }
    }
    this.clearCache();
    if (this.entries.length) this._ensureSlots();
  }

  /* ---------- API de variantes ---------- */

  /** @returns {{slotId:string,label:string,role:string|null,active:string,variants:Array<{id:string}&Object>}[]} */
  getSlots() {
    return this.entries.filter(e => this.slots[e.name]).map(e => {
      const s = this.slots[e.name];
      return { slotId: e.name, label: s.label, role: s.role ?? null, active: s.active, variants: this.getVariants(e.name) };
    });
  }
  /** Variantes de un slot. @param {string} slotId @returns {Array<{id:string}&Object>} */
  getVariants(slotId) {
    const s = this.slots[slotId]; if (!s) return [];
    return Object.entries(s.variants).map(([id, v]) => ({ id, ...deep(v) }));
  }
  /**
   * Agrega una variante al slot. `data` puede usar otra regla (otro material): { name, rule, texture, tint, scale,
   * randomUV, sample, sampleMode, costRef }. No la activa.
   * @returns {string|null} variantId
   */
  addVariant(slotId, data = {}) {
    const s = this.slots[slotId]; if (!s) return null;
    let n = 1; while (s.variants['v' + n]) n++;
    const id = 'v' + n;
    s.variants[id] = cleanVariant({ name: data.name || `Variante ${n}`, ...data });
    this._ensureTexture(s.variants[id].texture);
    return id;
  }
  /** Modifica una variante (patch parcial; null borra el campo). Si es la activa, se ve en vivo. @returns {boolean} */
  updateVariant(slotId, variantId, patch = {}) {
    const s = this.slots[slotId], v = s?.variants[variantId]; if (!v) return false;
    for (const [k, val] of Object.entries(patch)) { if (val === null || val === undefined || val === '') delete v[k]; else v[k] = val; }
    s.variants[variantId] = cleanVariant(v);
    this._ensureTexture(v.texture);
    if (s.active === variantId) this.applySlots(slotId);
    return true;
  }
  /** Borra una variante. No permite borrar la última. @returns {boolean} */
  removeVariant(slotId, variantId) {
    const s = this.slots[slotId]; if (!s || !s.variants[variantId] || Object.keys(s.variants).length <= 1) return false;
    delete s.variants[variantId];
    for (const set of Object.values(this.sets)) if (set[slotId] === variantId) delete set[slotId];
    if (s.active === variantId) { s.active = Object.keys(s.variants)[0]; this.applySlots(slotId); this._emitOne(slotId); }
    return true;
  }
  /** Activa una variante en vivo (reutiliza el caché de materiales) y emite «materialvariantchange». @returns {boolean} */
  setVariant(slotId, variantId) {
    const s = this.slots[slotId]; if (!s || !s.variants[variantId]) return false;
    s.active = variantId;
    this.applySlots(slotId);
    this._emitOne(slotId);
    return true;
  }
  _emitOne(slotId) {
    const s = this.slots[slotId];
    emitVariantChange({ slotId, variantId: s.active, set: null, costRef: s.variants[s.active]?.costRef ?? null });
  }
  /** Guarda el estado actual (o un mapa slotId→variantId) como conjunto. @returns {string} nombre */
  saveSet(name, map) {
    const m = {};
    if (map) { for (const [id, vid] of Object.entries(map)) if (this.slots[id]?.variants[vid]) m[id] = vid; }
    else for (const [id, s] of Object.entries(this.slots)) m[id] = s.active;
    this.sets[name] = m;
    return name;
  }
  /** Aplica un conjunto completo. Los slots que no aparecen conservan su variante. Emite UN solo evento. @returns {boolean} */
  applySet(name) {
    const set = this.sets[name]; if (!set) return false;
    const changes = [];
    for (const [id, vid] of Object.entries(set)) {
      const s = this.slots[id]; if (!s || !s.variants[vid] || s.active === vid) continue;
      s.active = vid; changes.push({ slotId: id, variantId: vid, costRef: s.variants[vid].costRef ?? null });
    }
    this.applySlots(changes.map(c => c.slotId));
    emitVariantChange({ slotId: null, variantId: null, set: name, costRef: null, changes });
    return true;
  }
  /** @returns {string[]} nombres de los conjuntos */
  getSets() { return Object.keys(this.sets); }

  /* Texturas «ph:…» que no están en la biblioteca: se descargan y se aplican al llegar */
  _ensureTexture(id) {
    if (!id || id === '__none' || this.findTexture(id) || !/^ph:/.test(id) || typeof MM_PH.texture !== 'function') return;
    MM_PH.texture(id.slice(3)).then(t => {
      if (!t || this.findTexture(t.id)) return;
      this.library.push(t);
      const ids = Object.entries(this.slots).filter(([, s]) => s.variants[s.active]?.texture === t.id).map(([k]) => k);
      this.applySlots(ids); MM_HOOKS.onTexture();
    }).catch(() => {});
  }
}
/* Descarga de una textura de Poly Haven por id (la llena el bloque web; sin él, las texturas deben venir en el mapeo) */
const MM_PH = { texture: null };

/* DEV:START — perfiles de edificio y texturas web (Poly Haven, CC0; requiere el crédito «Powered by Poly Haven») */
/* ---------------------------------------------------------------
   8. PERFILES DE EDIFICIO (referencias de materiales y tonos)
   q      → términos de búsqueda en orden de preferencia (inglés, como el catálogo)
   avoid  → términos a evitar para esa tipología
   paint  → color por tono para acabados pintados (multiplica la textura)
---------------------------------------------------------------- */
const TONES = {
  neutro: { label: 'Neutro', natural: '#ffffff' },
  calido: { label: 'Cálido', natural: '#fff2e2' },
  frio:   { label: 'Frío',   natural: '#eef3fa' },
};
const WORN = ['rust', 'rusty', 'damaged', 'dirty', 'old', 'worn', 'cracked', 'broken', 'abandoned', 'grunge', 'peeling', 'moss', 'mossy'];

const PROFILES = {
  oficinas: { label: 'Oficinas corporativas', clean: true, rules: {
    aplanado:  { q: ['white plaster', 'plaster', 'painted plaster', 'smooth plaster', 'painted wall'], avoid: ['brick'],
                 paint: { neutro: '#ecebe7', calido: '#efe7da', frio: '#e5e9ed' } },
    concreto:  { q: ['polished concrete', 'concrete floor', 'smooth concrete', 'concrete'], avoid: ['block', 'tiles', 'wall'] },
    metal:     { q: ['brushed metal', 'painted metal', 'metal plate', 'steel', 'metal'], avoid: ['corrugated', 'diamond'] },
    madera:    { q: ['oak veneer', 'oak', 'wood floor', 'laminate floor', 'wood'], avoid: ['bark', 'log', 'planks old'] },
    ceramico:  { q: ['porcelain tiles', 'floor tiles', 'marble tiles', 'tiles'], avoid: ['roof', 'mosaic'] },
    piedra:    { q: ['marble', 'granite', 'stone floor', 'stone'], avoid: ['rock', 'cliff'] },
    ladrillo:  { q: ['painted brick', 'white brick', 'concrete block', 'brick'] },
    plastico:  { q: ['vinyl floor', 'rubber', 'plastic', 'linoleum'] },
    tela:      { q: ['carpet', 'fabric', 'office carpet'], paint: { neutro: '#8a8c90', calido: '#8f877d', frio: '#7f8794' } },
    cubierta:  { q: ['metal roof', 'corrugated metal', 'roof'] },
    asfalto:   { q: ['asphalt', 'road'] },
    terreno:   { q: ['gravel', 'pebbles', 'ground'] },
    pasto:     { q: ['grass', 'lawn'] },
  } },
  industrial: { label: 'Industrial / nave', clean: false, rules: {
    concreto:  { q: ['concrete floor', 'cast concrete', 'concrete', 'polished concrete'] },
    metal:     { q: ['galvanized', 'corrugated metal', 'painted metal', 'metal plate', 'steel', 'metal'], avoid: ['rusty'] },
    ladrillo:  { q: ['concrete block', 'cinder block', 'brick'] },
    aplanado:  { q: ['painted concrete', 'plaster', 'painted wall'], paint: { neutro: '#dcdad5', calido: '#ddd3c4', frio: '#d3d8dc' } },
    madera:    { q: ['plywood', 'osb', 'wood planks', 'wood'] },
    cubierta:  { q: ['corrugated metal', 'metal roof', 'roof'] },
    asfalto:   { q: ['asphalt', 'road'] },
    ceramico:  { q: ['floor tiles', 'tiles'] },
    plastico:  { q: ['rubber', 'plastic'] },
    terreno:   { q: ['gravel', 'dirt', 'ground'] },
    pasto:     { q: ['grass'] },
    tela:      { q: ['fabric'] },
    piedra:    { q: ['stone', 'rock'] },
  } },
  comercial: { label: 'Comercial / retail', clean: true, rules: {
    ceramico:  { q: ['marble tiles', 'porcelain tiles', 'floor tiles', 'tiles'] },
    piedra:    { q: ['marble', 'granite', 'travertine', 'stone'] },
    madera:    { q: ['walnut', 'wood floor', 'oak', 'wood'] },
    metal:     { q: ['brushed metal', 'stainless', 'chrome', 'metal'], avoid: ['corrugated', 'rusty'] },
    aplanado:  { q: ['white plaster', 'plaster', 'painted wall'], paint: { neutro: '#efeeea', calido: '#f1e9dc', frio: '#e8ecf0' } },
    concreto:  { q: ['polished concrete', 'concrete'] },
    tela:      { q: ['fabric', 'carpet'] },
    plastico:  { q: ['plastic', 'vinyl'] },
    ladrillo:  { q: ['brick'] }, cubierta: { q: ['roof', 'metal roof'] },
    asfalto:   { q: ['asphalt'] }, terreno: { q: ['gravel'] }, pasto: { q: ['grass'] },
  } },
  residencial: { label: 'Residencial', clean: true, rules: {
    madera:    { q: ['wood floor', 'oak', 'laminate floor', 'wood planks', 'wood'] },
    aplanado:  { q: ['plaster', 'stucco', 'painted wall'], paint: { neutro: '#ebe7df', calido: '#eee2cf', frio: '#e3e6e8' } },
    ladrillo:  { q: ['red brick', 'brick'] },
    piedra:    { q: ['stone wall', 'stone', 'marble'] },
    ceramico:  { q: ['floor tiles', 'ceramic tiles', 'tiles'] },
    concreto:  { q: ['concrete', 'polished concrete'] },
    cubierta:  { q: ['roof tiles', 'roof'] },
    metal:     { q: ['painted metal', 'metal'], avoid: ['rusty'] },
    tela:      { q: ['fabric', 'carpet'] }, plastico: { q: ['plastic'] },
    asfalto:   { q: ['asphalt'] }, terreno: { q: ['gravel', 'ground'] }, pasto: { q: ['grass', 'lawn'] },
  } },
  institucional: { label: 'Hospitalario / educativo', clean: true, rules: {
    plastico:  { q: ['vinyl floor', 'linoleum', 'rubber', 'plastic'] },
    ceramico:  { q: ['white tiles', 'ceramic tiles', 'floor tiles', 'tiles'] },
    aplanado:  { q: ['white plaster', 'plaster', 'painted wall'], paint: { neutro: '#f0efec', calido: '#f0eadf', frio: '#e9edf0' } },
    metal:     { q: ['stainless', 'brushed metal', 'metal'], avoid: ['rusty', 'corrugated'] },
    madera:    { q: ['oak', 'wood'] },
    concreto:  { q: ['concrete floor', 'concrete'] },
    tela:      { q: ['fabric'] }, piedra: { q: ['stone'] }, ladrillo: { q: ['brick'] },
    cubierta:  { q: ['roof'] }, asfalto: { q: ['asphalt'] }, terreno: { q: ['gravel'] }, pasto: { q: ['grass'] },
  } },
};

function profileTint(profileId, ruleId, tone = 'neutro') {
  const spec = PROFILES[profileId]?.rules?.[ruleId];
  if (spec?.paint) return spec.paint[tone] || spec.paint.neutro;
  return TONES[tone]?.natural || '#ffffff';
}

/* DEV:END */

/* ---------------------------------------------------------------
   9. TEXTURAS WEB — Poly Haven (CC0). Requiere crédito "Powered by Poly Haven".
   La descarga de una textura por id se queda fuera de DEV: la API de variantes puede pedir «ph:…».
---------------------------------------------------------------- */
const PH_API = 'https://api.polyhaven.com';
const phFilesCache = new Map();

function assetText(a) {
  const cats = Array.isArray(a.categories) ? a.categories : [];
  const tags = Array.isArray(a.tags) ? a.tags : [];
  return ' ' + [a.name, id2words(a.id), ...cats, ...tags, a.category || ''].map(x => tokenize(x).join(' ')).join(' ') + ' ';
}
const id2words = id => String(id).replace(/[_-]+/g, ' ');

/* Descarga la lista de archivos y arma una entrada de biblioteca con escala real */
async function polyHavenTexture(asset, res = '1k') {
  const key = asset.id + '|' + res;
  if (phFilesCache.has(key)) return phFilesCache.get(key);
  const r = await fetch(`${PH_API}/files/${encodeURIComponent(asset.id)}`);
  if (!r.ok) throw new Error(`No se pudieron obtener los archivos de ${asset.id}`);
  const files = await r.json();
  const pick = node => {
    if (!node || typeof node !== 'object') return null;
    const resKey = node[res] ? res : Object.keys(node).sort((a, b) => parseInt(a) - parseInt(b))[0];
    const byFmt = node[resKey]; if (!byFmt) return null;
    const f = byFmt.jpg || byFmt.png || byFmt.webp;
    return f?.url ? { url: f.url, path: f.url } : null;
  };
  const maps = {}; let normalDX = false;
  for (const [k, node] of Object.entries(files)) {
    const n = k.toLowerCase();
    if (['blend', 'gltf', 'mtlx', 'usd', 'fbx'].includes(n)) continue;
    const f = pick(node); if (!f) continue;
    if (n === 'diffuse' || n === 'diff' || n === 'color' || n === 'albedo') maps.map = f;
    else if (n === 'nor_gl') maps.normalMap = f;
    else if (n === 'nor_dx' && !maps.normalMap) { maps.normalMap = f; normalDX = true; }
    else if (n === 'rough' || n === 'roughness') maps.roughnessMap = f;
    else if (n === 'metal' || n === 'metalness') maps.metalnessMap = f;
    else if (n === 'ao') maps.aoMap = f;
    else if (n === 'arm') maps.arm = f;
  }
  if (maps.normalMap && files.nor_gl && normalDX) normalDX = false;
  const dim = Array.isArray(asset.dimensions) ? asset.dimensions[0] : null;
  const tex = {
    id: 'ph:' + asset.id, label: asset.name || asset.id, source: 'polyhaven',
    tags: tokenize(assetText(asset)), maps, normalDX,
    scale: dim ? dim / 1000 : null,                 // dimensiones reales (mm → m)
    thumb: asset.thumbnail_url || `https://cdn.polyhaven.com/asset_img/thumbs/${asset.id}.png?width=256&height=256`,
    url: `https://polyhaven.com/a/${asset.id}`,
  };
  phFilesCache.set(key, tex);
  return tex;
}
MM_PH.texture = async (id, res = '1k') => {
  const r = await fetch(`${PH_API}/info/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(`Poly Haven no tiene «${id}»`);
  return polyHavenTexture({ id, ...(await r.json()) }, res);
};

/* DEV:START — catálogo y búsqueda por perfil */
let phCatalog = null;

async function loadPolyHavenCatalog() {
  if (phCatalog) return phCatalog;
  let res = await fetch(`${PH_API}/assets?type=textures`);
  if (!res.ok) throw new Error(`Poly Haven respondió ${res.status}`);
  let json = await res.json();
  if (!Object.keys(json).length) json = await (await fetch(`${PH_API}/assets?t=textures`)).json();
  phCatalog = Object.entries(json).map(([id, a]) => ({ id, ...a }));
  return phCatalog;
}

/* Busca en el catálogo según el perfil: términos por preferencia, términos a evitar, limpieza y popularidad */
function searchTextures(catalog, profileId, ruleId, limit = 6) {
  const profile = PROFILES[profileId];
  const spec = profile?.rules?.[ruleId];
  const rule = DEFAULT_RULES.find(r => r.id === ruleId);
  const q = spec?.q || rule?.library || [];
  if (!q.length) return [];
  const avoid = [...(spec?.avoid || []), ...(profile?.clean ? WORN : [])];
  const out = [];
  for (const a of catalog) {
    const text = assetText(a);
    let score = 0;
    q.forEach((term, i) => {
      const w = tokenize(term);
      if (w.length && w.every(x => text.includes(' ' + x))) score = Math.max(score, 10 - i * 1.5 + (w.length - 1) * 2);
    });
    if (score <= 0) continue;
    for (const term of avoid) if (text.includes(' ' + tokenize(term).join(' '))) score -= 6;
    const attrs = JSON.stringify(a.attributes || {}).toLowerCase();
    if (profile?.clean && /worn|dirty|damaged|old/.test(attrs)) score -= 3;
    if (score <= 1) continue;                                          // descartado por el perfil
    score += Math.log10((a.download_count || 0) + 1) * 1.2;          // popularidad = materiales más utilizados
    out.push({ asset: a, score });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit).map(x => x.asset);
}
/* DEV:END */

const API = { MaterialMapper, DEFAULT_RULES, resolveTexture, norm, CFG, setAntiTile, HOOKS: MM_HOOKS, GROUP_ORDER,
  isColorOnly, variantIsManual, polyHavenTexture };
/* DEV:START */
Object.assign(API, { PROFILES, TONES, profileTint, libraryFromFiles, libraryFromManifest, exportManifest, loadPolyHavenCatalog, searchTextures });
/* DEV:END */
root.MM = API;
})(typeof window !== 'undefined' ? window : globalThis);
