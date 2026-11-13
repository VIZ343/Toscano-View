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
import * as THREE from 'three';

/* ---------------------------------------------------------------
   1. REGLAS POR DEFECTO
   keywords   → se buscan en el nombre del material (es/en, sin acentos)
   categories → se buscan en la categoría (Revit/IFC) del objeto
   library    → etiquetas para elegir textura de la biblioteca
   scale      → metros que cubre una repetición de la textura
   pbr        → material procedural si no hay textura
---------------------------------------------------------------- */
export const DEFAULT_RULES = [
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
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
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
// Nombres de material genéricos que no sirven para identificar el acabado
const GENERIC_MAT = /^(|material|default|mat|lambert|phong|standard|none|sin nombre|generic|untitled)([\s_.-]*\d*)?$/i;

/* Categorías de Revit que Datasmith/Twinmotion/UE insertan en el nombre:
   <Material>_<Categoría>_<Familia>_<Tipo>_<n>  */
export const REVIT_CATEGORIES = [
  'Structural_Framing','Structural_Columns','Structural_Foundations','Structural_Connections','Structural_Rebar',
  'Curtain_Wall_Mullions','Curtain_Panels','Furniture_Systems','Furniture','Generic_Models','Specialty_Equipment',
  'Plumbing_Fixtures','Mechanical_Equipment','Electrical_Fixtures','Lighting_Fixtures','Casework','Walls','Floors',
  'Ceilings','Roofs','Doors','Windows','Railings','Top_Rails','Handrails','Runs','Landings','Stairs','Gutters',
  'Wall_Sweeps','Slab_Edges','Fascias','Columns','Plates','Bolts','Ramps','Topography','Toposolid','Site','Planting',
  'Entourage','Parking','Pipes','Ducts','Cable_Trays','Conduits',
];
const CAT_ORDER = [...REVIT_CATEGORIES].sort((a, b) => b.length - a.length);

export function parseName(raw) {
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
export function inventory(root) {
  const byName = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const meta = readMeta(o, true);                    // metadatos del objeto y sus padres (para la categoría)
    const own = readMeta(o, false);                    // metadatos solo del propio objeto
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const slotNames = Array.isArray(o.userData?.materials) ? o.userData.materials : null;
    // Objeto lógico: un elemento con varias piezas (primitivas glTF) o un mesh con varios materiales
    const sib = o.parent ? o.parent.children.filter(c => c.isMesh) : [];
    const owner = mats.length > 1 ? o : sib.length > 1 ? o.parent : o;
    mats.forEach((m, slot) => {
      const mMeta = readMeta(m || {}, false);          // extras del material glTF
      const matName = m?.name && !GENERIC_MAT.test(m.name.trim()) ? m.name : null;
      // Prioridad: material de la cara/primitiva > metadato del propio objeto > metadato heredado del padre
      const raw = pick(mMeta, META_MATERIAL)
        || (slotNames && slotNames[slot])
        || (mats.length === 1 && pick(own, META_MATERIAL))
        || matName
        || (mats.length === 1 && pick(meta, META_MATERIAL))
        || m?.name || 'Sin nombre';
      const parsed = parseName(raw);
      const name = parsed.key;
      let e = byName.get(name);
      if (!e) byName.set(name, e = {
        name, material: parsed.material, uses: [], categories: new Set(), hints: new Set(), families: new Set(),
        color: m?.color ? '#' + m.color.getHexString() : null,
      });
      e.uses.push({ mesh: o, slot, original: m, family: parsed.family, owner });
      const cat = pick(mMeta, META_CATEGORY) || pick(meta, META_CATEGORY) || parsed.category;
      if (cat) e.categories.add(cat);
      if (parsed.family && e.families.size < 30) e.families.add(parsed.family);
      if (e.hints.size < 30) {
        if (m?.name && m.name !== name) e.hints.add(m.name);
        if (o.name) e.hints.add(o.name);
        if (o.parent?.name) e.hints.add(o.parent.name);
      }
    });
  });
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

export function matchRule(entry, rules, minScore = 3) {
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
export function familyRule(family, rules) {
  if (!family) return null;
  const t = { name: words(family), first: '', family: ' ', hints: ' ', cats: '' };
  let best = null;
  for (const r of rules) {
    const s = scoreRule(r, t);
    if (s && s.score >= 10 && (!best || s.score > best.score)) best = { rule: r, score: s.score };
  }
  return best?.rule || null;
}

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

export function parseTextureList(files) {
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

export function libraryFromFiles(fileList) {
  return parseTextureList([...fileList].map(file => ({
    path: file.webkitRelativePath || file.name, url: URL.createObjectURL(file),
  })));
}

/* Manifest con rutas relativas para usar la misma biblioteca en producción */
export function exportManifest(library) {
  return { version: 1, materials: library.map(t => ({
    id: t.id, tags: t.tags, scale: t.scale, normalDX: t.normalDX,
    maps: Object.fromEntries(Object.entries(t.maps).map(([k, v]) => [k, v.path])),
  })) };
}
export function libraryFromManifest(json, baseUrl = '') {
  return (json.materials || []).map(m => ({
    ...m, label: m.id.split('/').pop(),
    maps: Object.fromEntries(Object.entries(m.maps).map(([k, p]) => [k, { path: p, url: baseUrl + p }])),
  }));
}

export function resolveTexture(rule, library) {
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

/* ---------------------------------------------------------------
   6. MATERIALES PBR Y UV
---------------------------------------------------------------- */
const texLoader = new THREE.TextureLoader();
const texCache = new Map();
function loadTex(url, srgb, rep) {
  const key = `${url}|${rep}|${srgb}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = texLoader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep, rep);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

export function createMaterial(rule, tex, tint) {
  const p = { ...(rule?.pbr || {}) };
  const physical = (p.transmission || 0) > 0 || (p.clearcoat || 0) > 0;
  const M = physical ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
  M.name = `${rule?.id || 'auto'}${tex ? ' · ' + tex.label : ''}`;
  M.color.set(p.color ?? '#cccccc');
  M.roughness = p.roughness ?? .8;
  M.metalness = p.metalness ?? 0;
  if (physical) {
    M.transmission = p.transmission ?? 0; M.ior = p.ior ?? 1.5;
    M.thickness = p.thickness ?? 0; M.clearcoat = p.clearcoat ?? 0;
  }
  if (p.opacity != null && p.opacity < 1) { M.transparent = true; M.opacity = p.opacity; }
  if (p.emissive) { M.emissive.set(p.emissive); M.emissiveIntensity = p.emissiveIntensity ?? 1; }
  if (p.doubleSided) M.side = THREE.DoubleSide;

  if (tex) {
    const rep = 1 / (tex.scale ?? rule?.scale ?? 1);
    const L = (slot, srgb = false) => tex.maps[slot] ? loadTex(tex.maps[slot].url, srgb, rep) : null;
    if ((M.map = L('map', true))) M.color.set(tint || p.tint || '#ffffff');
    if (tex.maps.arm && !tex.maps.roughnessMap) {          // ARM empaquetado: R=AO, G=rugosidad, B=metal
      const arm = L('arm'); M.roughnessMap = arm; M.metalnessMap = arm; M.aoMap = arm;
      M.roughness = 1; M.metalness = 1;
    }
    if ((M.normalMap = L('normalMap')) && tex.normalDX) M.normalScale.set(1, -1);
    if (tex.maps.roughnessMap) { M.roughnessMap = L('roughnessMap'); M.roughness = 1; }
    if (tex.maps.metalnessMap) { M.metalnessMap = L('metalnessMap'); M.metalness = 1; }
    if (tex.maps.aoMap) M.aoMap = L('aoMap');
    if ((M.alphaMap = L('alphaMap'))) M.transparent = true;
  }
  return M;
}

/* UV tipo caja en metros: proyecta cada cara sobre el eje dominante de su normal */
export function boxUV(geometry, s = new THREE.Vector3(1, 1, 1)) {
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
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

function prepareUV(mesh, mode) {
  const g = mesh.geometry, ud = g.userData;
  const needBox = mode === 'box' || (!g.attributes.uv && !ud.__boxed);
  if (needBox && !ud.__boxed) {
    if (g.attributes.uv && !ud.__uvOrig) ud.__uvOrig = g.attributes.uv;
    const s = new THREE.Vector3(); mesh.updateWorldMatrix(true, false); mesh.getWorldScale(s);
    boxUV(g, s); ud.__boxed = true;
  } else if (!needBox && ud.__boxed && ud.__uvOrig) {
    g.setAttribute('uv', ud.__uvOrig); ud.__boxed = false;
  }
}
const setMat = (mesh, slot, mat) => {
  if (Array.isArray(mesh.material)) mesh.material[slot] = mat; else mesh.material = mat;
};

/* ---------------------------------------------------------------
   7. CLASE PRINCIPAL
---------------------------------------------------------------- */
export class MaterialMapper {
  constructor({ rules = DEFAULT_RULES, library = [], uvMode = 'box', minScore = 3 } = {}) {
    Object.assign(this, { rules, library, uvMode, minScore });
    this.overrides = {};      // { [nombreMaterial]: { rule?: id|'__none', texture?: id|'__none' } }
    this.ruleTex = {};        // { [ruleId]: textura elegida (web) | null = procedural }
    this.ruleTint = {};       // { [ruleId]: '#rrggbb' } tono por perfil
    this.entries = [];
    this.cache = new Map();
  }

  analyze(root) {
    this.root = root;
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
        out.push(sub);
      }
    }
    this.entries = out.sort((a, b) => b.uses.length - a.uses.length);
    return this.entries;
  }

  setLibrary(library) { this.library = library; this.clearCache(); }
  setRules(rules) { this.rules = rules; this.clearCache(); if (this.root) this.analyze(this.root); }
  clearCache() { this.cache.forEach(m => m.dispose()); this.cache.clear(); }

  resolve(e) {
    const o = this.overrides[e.name] || {};
    const rule = o.rule === '__none' ? null : o.rule ? this.rules.find(r => r.id === o.rule) || null : e.match.rule;
    const tex = o.texture === '__none' ? null
      : o.texture ? this.library.find(t => t.id === o.texture) || null
      : rule && rule.id in this.ruleTex ? this.ruleTex[rule.id]
      : resolveTexture(rule, this.library);
    const source = (o.rule || o.texture) ? 'manual' : rule ? 'auto' : 'none';
    return { rule, tex, source };
  }

  apply() {
    for (const e of this.entries) {
      const r = e.result = this.resolve(e);
      if (!r.rule && !r.tex) { e.uses.forEach(u => setMat(u.mesh, u.slot, u.original)); continue; }
      const tint = r.rule ? this.ruleTint[r.rule.id] : null;
      const key = `${r.rule?.id || '-'}|${r.tex?.id || '-'}|${tint || ''}`;
      let mat = this.cache.get(key);
      if (!mat) this.cache.set(key, mat = createMaterial(r.rule, r.tex, tint));
      for (const u of e.uses) {
        if (r.tex) prepareUV(u.mesh, this.uvMode);
        setMat(u.mesh, u.slot, mat);
      }
    }
    return this.report();
  }

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
    // Elementos con más de un material (p. ej. ventana = marco metálico + vidrio)
    const perOwner = new Map();
    for (const e of this.entries) for (const u of e.uses) {
      if (!perOwner.has(u.owner)) perOwner.set(u.owner, new Set());
      perOwner.get(u.owner).add(e.name);
    }
    c.multiMaterial = [...perOwner.values()].filter(s => s.size > 1).length;
    return c;
  }

  exportMapping(model = '') {
    return { version: 1, model, uvMode: this.uvMode, assignments: Object.fromEntries(this.entries.map(e => [e.name, {
      rule: e.result?.rule?.id ?? null, texture: e.result?.tex?.id ?? null, source: e.result?.source ?? 'none',
      override: this.overrides[e.name] || null,
    }])) };
  }

  importMapping(json) {
    if (json.uvMode) this.uvMode = json.uvMode;
    this.overrides = {};
    for (const [name, a] of Object.entries(json.assignments || {})) {
      if (a.override) this.overrides[name] = { ...a.override };   // solo lo manual; lo automático se recalcula
    }
  }
}

/* ---------------------------------------------------------------
   8. PERFILES DE EDIFICIO (referencias de materiales y tonos)
   q      → términos de búsqueda en orden de preferencia (inglés, como el catálogo)
   avoid  → términos a evitar para esa tipología
   paint  → color por tono para acabados pintados (multiplica la textura)
---------------------------------------------------------------- */
export const TONES = {
  neutro: { label: 'Neutro', natural: '#ffffff' },
  calido: { label: 'Cálido', natural: '#fff2e2' },
  frio:   { label: 'Frío',   natural: '#eef3fa' },
};
const WORN = ['rust', 'rusty', 'damaged', 'dirty', 'old', 'worn', 'cracked', 'broken', 'abandoned', 'grunge', 'peeling', 'moss', 'mossy'];

export const PROFILES = {
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

export function profileTint(profileId, ruleId, tone = 'neutro') {
  const spec = PROFILES[profileId]?.rules?.[ruleId];
  if (spec?.paint) return spec.paint[tone] || spec.paint.neutro;
  return TONES[tone]?.natural || '#ffffff';
}

/* ---------------------------------------------------------------
   9. TEXTURAS WEB — Poly Haven (CC0). Requiere crédito "Powered by Poly Haven".
---------------------------------------------------------------- */
const PH_API = 'https://api.polyhaven.com';
let phCatalog = null;
const phFilesCache = new Map();

export async function loadPolyHavenCatalog() {
  if (phCatalog) return phCatalog;
  let res = await fetch(`${PH_API}/assets?type=textures`);
  if (!res.ok) throw new Error(`Poly Haven respondió ${res.status}`);
  let json = await res.json();
  if (!Object.keys(json).length) json = await (await fetch(`${PH_API}/assets?t=textures`)).json();
  phCatalog = Object.entries(json).map(([id, a]) => ({ id, ...a }));
  return phCatalog;
}

function assetText(a) {
  const cats = Array.isArray(a.categories) ? a.categories : [];
  const tags = Array.isArray(a.tags) ? a.tags : [];
  return ' ' + [a.name, id2words(a.id), ...cats, ...tags, a.category || ''].map(x => tokenize(x).join(' ')).join(' ') + ' ';
}
const id2words = id => String(id).replace(/[_-]+/g, ' ');

/* Busca en el catálogo según el perfil: términos por preferencia, términos a evitar, limpieza y popularidad */
export function searchTextures(catalog, profileId, ruleId, limit = 6) {
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

/* Descarga la lista de archivos y arma una entrada de biblioteca con escala real */
export async function polyHavenTexture(asset, res = '1k') {
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
