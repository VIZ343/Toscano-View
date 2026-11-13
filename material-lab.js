/* DEV:START */
/* material-lab.js — Material Lab v5 · interfaz de desarrollo (cargar GLB, Poly Haven, revisión, slots y variantes).
   Solo se usa con DEV_MODE = true. Toda la lógica de materiales vive en material-mapper.js (window.MM).
   index.html llama MaterialLab.init(ctx) y recibe { aviso, refrescar, alCargar }. */
(function (root) {
'use strict';

function init(ctx) {
  const { MM, mapa, stage, THREE } = ctx;
  const Q = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = MM.norm;
  let vista2 = 'all';
  const web = { profile: 'oficinas', tone: 'neutro', res: '1k', candidates: {}, searched: false };
  const aviso = m => { const t = Q('#dvToast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200); };
  const bajarBlob = (blob, n) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = n; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  const bajar = (obj, n) => bajarBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), n);

  /* ---- FRIOX: se descarga y decodifica en segundo plano sin agregarlo a la escena ---- */
  const FRIOX = 'FRIOX_ligero.glb';
  let escenaFriox = null, mapeoFriox = null, promesaFriox = null, versionSeleccion = 0;
  function precargarFriox() {
    if (promesaFriox) return promesaFriox;
    Q('#dvDemo').title = 'Preparando FRIOX en segundo plano';
    promesaFriox = (async () => {
      const r = await fetch(FRIOX, { cache: 'default' });
      if (!r.ok) throw new Error('No se pudo descargar ' + FRIOX + ' (HTTP ' + r.status + ')');
      const buf = await r.arrayBuffer();
      const [obj, json] = await Promise.all([ctx.parsearGLB(buf), ctx.mapeoExterno('FRIOX_ligero')]);
      escenaFriox = obj; mapeoFriox = json;
      Q('#dvDemo').dataset.ready = 'true';
      Q('#dvDemo').title = 'FRIOX cargado: pulsa para cambiar desde Modelo base';
      return obj;
    })().catch(err => {
      promesaFriox = null;
      Q('#dvDemo').dataset.ready = 'false';
      Q('#dvDemo').title = 'No se pudo preparar FRIOX: pulsa para reintentar';
      throw err;
    });
    return promesaFriox;
  }
  async function cargarFriox() {
    const token = ++versionSeleccion;
    if (escenaFriox && ctx.modeloExt && ctx.nivel === escenaFriox) { aviso('FRIOX ya está activo'); return; }
    if (!escenaFriox) aviso('Preparando FRIOX. El Modelo base permanece visible…');
    try {
      await precargarFriox();
      if (token !== versionSeleccion) return;            // el usuario ya eligió Modelo base u otro GLB
      ctx.ponerModelo(escenaFriox, FRIOX, mapeoFriox);
      aviso('Escena de prueba FRIOX activa');
    } catch (err) {
      console.error('FRIOX:', err);
      aviso('No se pudo cargar FRIOX desde esta página: ' + (err.message || err));
    }
  }
  async function cargarArchivos(lista) {
    ++versionSeleccion;                                  // cancela una selección pendiente de FRIOX
    const arr = [].slice.call(lista), glb = arr.find(f => /\.glb$/i.test(f.name)), js = arr.find(f => /\.json$/i.test(f.name));
    if (!glb) {
      if (js) { try { importarJson(JSON.parse(await js.text())); aviso('Mapeo importado'); } catch (e) { aviso('El JSON no es válido'); } }
      else aviso('Arrastra un archivo .glb');
      return;
    }
    aviso('Cargando ' + glb.name + '…');
    try {
      const buf = await glb.arrayBuffer();
      let json = null;
      if (js) { try { json = JSON.parse(await js.text()); } catch (e) { aviso('El .materials.json no es válido; se ignora'); } }
      else json = await ctx.mapeoExterno(glb.name.replace(/\.glb$/i, ''));
      await ctx.abrirGLB(buf, glb.name, json);
    } catch (err) { console.error(err); aviso('No se pudo cargar el modelo (' + (err.message || err) + '). Se mantiene el modelo base.'); }
  }
  Q('#dvGlb').addEventListener('change', e => { if (e.target.files.length) cargarArchivos(e.target.files); e.target.value = ''; });
  stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('dragging'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('dragging'));
  stage.addEventListener('drop', e => { e.preventDefault(); stage.classList.remove('dragging'); cargarArchivos(e.dataTransfer.files); });
  Q('#dvBase').addEventListener('click', () => { ++versionSeleccion; if (ctx.modeloExt) ctx.ponerBase(); else aviso('Ya estás en el modelo base'); });
  Q('#dvDemo').addEventListener('click', cargarFriox);
  Q('#dvAnti').addEventListener('change', e => { MM.setAntiTile(e.target.value); if (e.target.value === 'inf' && !MM.CFG.webgl2) aviso('Este dispositivo no admite el modo infinito (requiere WebGL2)'); ejecutar(); });

  function escenaPrueba() {
    const g = new THREE.Group(); g.name = 'Demo';
    const gris = n => new THREE.MeshStandardMaterial({ name: n, color: '#9a9a9a' });
    const caja = (w, h, d, x, y, z, meta, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), gris(mat || meta.material)); m.position.set(x, y, z); Object.assign(m.userData, meta); g.add(m); return m; };
    caja(40, .2, 40, 0, -.1, 0, { material: 'Pasto natural', category: 'Topografía' });
    caja(6, .05, 18, -13, .03, 0, { material: 'Asfalto - Estacionamiento', category: 'Vialidades' });
    caja(14, .3, 10, 0, .15, 0, { material: 'Concreto - Firme', category: 'Pisos' });
    caja(14, .3, 10, 0, 3.65, 0, { material: 'Concreto - Losa de azotea', category: 'Losas' });
    for (const x of [-6.8, 6.8]) for (const z of [-4.8, 4.8]) caja(.4, 3.2, .4, x, 1.9, z, { material: 'Concreto - Columnas', category: 'Columnas estructurales' });
    caja(14, .35, .25, 0, 3.32, 4.85, { material: 'Acero estructural A36', category: 'Armazón estructural' });
    caja(14, 3.2, .2, 0, 1.9, -4.9, { material: 'Muro tabique aplanado blanco', category: 'Muros' });
    caja(.2, 3.2, 9.6, -6.9, 1.9, 0, { material: 'Ladrillo aparente', category: 'Muros' });
    for (let i = 0; i < 4; i++) { const x = -5.1 + i * 3.4; caja(3.2, 3, .03, x, 1.8, 4.9, { material: 'Vidrio claro 6mm', category: 'Muro cortina' }); caja(.08, 3.2, .1, x - 1.65, 1.9, 4.9, { material: 'Aluminio anodizado', category: 'Muro cortina' }); }
    caja(13.4, .02, 9.4, 0, .31, 0, { material: 'Porcelanato 60x60', category: 'Pisos' });
    caja(14, .12, 4, 0, .06, 7.2, { material: 'Madera - Deck exterior', category: 'Pisos' });
    caja(3, 1.1, 1, 2, .86, -2, { category: 'Mobiliario' }, 'Mat_0047');
    caja(2, .9, .8, -3, .76, -2.5, { material: 'Material genérico XYZ' });
    caja(4, .05, 2.5, 9, .05, -12, { material: 'Agua - Espejo', category: 'Sitio' });
    return g;
  }

  /* ---- panel ---- */
  const estado2 = e => e.result.source === 'manual' ? 'manual' : (!e.result.rule && !e.result.tex) ? 'none' : e.match.conflict ? 'review' : 'auto';
  function refrescarPanel() { Q('#dvModelo').textContent = ctx.nombre + (ctx.modeloExt ? '' : ' · los materiales ligados al presupuesto están protegidos'); render(); renderPaleta(); }
  function render() {
    const rep = mapa.report(), cuenta = { all: rep.total, auto: 0, manual: 0, review: 0, none: 0 };
    mapa.entries.forEach(e => { if (e.result) cuenta[estado2(e)]++; });
    Q('#dvStats').innerHTML = [['all', 'Grupos'], ['auto', 'Auto'], ['manual', 'Manual'], ['review', 'Revisar'], ['none', 'Sin asignar']].map(p => '<div class="dv-stat ' + p[0] + ' ' + (vista2 === p[0] ? 'on' : '') + '" data-v="' + p[0] + '"><b>' + cuenta[p[0]] + '</b><span>' + p[1] + '</span></div>').join('');
    Q('#dvResumen').textContent = rep.objects.toLocaleString() + ' objetos · ' + rep.sourceMaterials.toLocaleString() + ' materiales originales → ' + rep.builtMaterials + ' materiales';
    const q = norm(Q('#dvQ').value);
    const lista = mapa.entries.map((e, i) => ({ e, i })).filter(x => x.e.result && (!q || norm(x.e.name).indexOf(q) >= 0) && (vista2 === 'all' || estado2(x.e) === vista2));
    if (!lista.length) { Q('#dvLista').innerHTML = '<li class="dv-empty">' + (mapa.entries.length ? 'Sin coincidencias' : 'El modelo no tiene materiales') + '</li>'; return; }
    Q('#dvLista').innerHTML = lista.map(x => {
      const e = x.e, r = e.result, o = mapa.activeVariant(e.name), st = estado2(e), lock = ctx.ligado(e), autoR = e.match.rule ? e.match.rule.label : 'sin regla', autoT = MM.resolveTexture(r.rule, mapa.library);
      const cats = [...e.categories].slice(0, 2).join(', '), fam = [...(e.families || [])][0], dis = lock ? ' disabled' : '';
      return '<li class="dv-row" data-i="' + x.i + '"><span class="dv-dot ' + (lock ? 'lock' : st) + '"></span><div>' +
        '<div class="dv-name">' + (e.color ? '<span class="dv-sw" style="background:' + e.color + '"></span>' : '') + esc(e.name) + '</div>' +
        '<div class="dv-meta">' + e.uses.length + ' objeto' + (e.uses.length > 1 ? 's' : '') + (cats ? ' · ' + esc(cats) : '') + (fam ? ' · ' + esc(fam.slice(0, 48)) : '') + '</div>' +
        '<div class="dv-why">' + (lock ? 'Ligado a la tabla de presupuesto: no se modifica' : r.source === 'manual' ? 'Asignación manual' : e.match.rule ? 'Coincide por ' + esc(e.match.why.slice(0, 2).join(', ')) : 'Ninguna regla coincide') + '</div>' +
        (st === 'review' && !lock ? '<div class="dv-warn">⚠ La familia sugiere ' + esc(e.match.conflict.label) + '<button type="button" data-accept="' + e.match.conflict.id + '">Usar</button><button type="button" data-keep>Mantener</button></div>' : '') +
        '</div><div class="dv-ctrl"><select data-k="rule" aria-label="Regla"' + dis + '><option value="">Auto · ' + esc(autoR) + '</option>' +
        mapa.rules.map(rl => '<option value="' + rl.id + '"' + (o.rule === rl.id ? ' selected' : '') + '>' + esc(rl.label) + '</option>').join('') + '<option value="__none"' + (o.rule === '__none' ? ' selected' : '') + '>Mantener original</option></select>' +
        '<select data-k="texture" aria-label="Textura"' + dis + '><option value="">Auto · ' + (autoT ? esc(autoT.label) : 'procedural') + '</option>' +
        mapa.library.map(t => '<option value="' + esc(t.id) + '"' + (o.texture === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>').join('') + '<option value="__none"' + (o.texture === '__none' ? ' selected' : '') + '>Procedural (sin textura)</option></select></div></li>';
    }).join('');
  }
  function ejecutar() { ctx.aplicarMapa(); render(); renderPaleta(); }
  /* Los cambios del panel editan la variante activa del slot */
  const editar = (e, patch) => { const s = mapa.slots[e.name]; mapa.updateVariant(e.name, s.active, patch); ejecutar(); };
  Q('#dvStats').addEventListener('click', ev => { const s = ev.target.closest('.dv-stat'); if (!s) return; vista2 = s.dataset.v; render(); });
  Q('#dvLista').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return; const e = mapa.entries[+b.closest('.dv-row').dataset.i];
    editar(e, { rule: b.dataset.accept || (e.match.rule ? e.match.rule.id : '__none') });
  });
  Q('#dvLista').addEventListener('change', ev => {
    const sel = ev.target.closest('select'); if (!sel) return; const e = mapa.entries[+sel.closest('.dv-row').dataset.i];
    editar(e, { [sel.dataset.k]: sel.value || null });
  });
  Q('#dvQ').addEventListener('input', render);
  document.querySelectorAll('.dv-tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.dv-tab').forEach(x => x.classList.toggle('on', x === t));
    document.querySelectorAll('.dv-pane').forEach(p => p.classList.toggle('on', p.id === t.dataset.tab));
  }));
  function dvEstado(m, g) { const p = Q('#dvPanel'); p.classList.toggle('min', m); Q('.dv-body').inert = m; Q('#dvMin').setAttribute('aria-expanded', String(!m)); if (g) { try { localStorage.setItem('devPanel', m ? 'closed' : 'open'); } catch (e) {} } }
  Q('#dvMin').addEventListener('click', () => dvEstado(!Q('#dvPanel').classList.contains('min'), true));
  Q('#dvMinIn').addEventListener('click', () => dvEstado(true, true));
  (function () { let m = true; try { m = localStorage.getItem('devPanel') !== 'open'; } catch (e) {} dvEstado(m, false); })();

  /* ---- opciones, exportación, carpeta local ---- */
  Q('#dvUV').addEventListener('change', e => { mapa.uvMode = e.target.value; ejecutar(); });
  Q('#dvTex').addEventListener('change', e => {
    const f = e.target.files; if (!f.length) return; const lib = MM.libraryFromFiles(f); mapa.setLibrary(lib); mapa.ruleTex = {};
    Q('#dvWebEstado').textContent = 'Carpeta local: ' + lib.length + ' texturas · ' + ((f[0].webkitRelativePath || '').split('/')[0] || 'carpeta');
    aviso(lib.length ? 'Biblioteca: ' + lib.length + ' materiales con texturas (las rutas locales no sirven para compartir; exporta el manifest)' : 'No se encontraron mapas reconocibles'); ejecutar();
  });
  function importarJson(j) {
    ctx.aplicarJsonMapeo(j);
    Q('#dvUV').value = mapa.uvMode; Q('#dvAnti').value = MM.CFG.mode;
    ejecutar();
  }
  const nombreArchivo = () => (ctx.nombre.replace(/\.glb$/i, '') || 'modelo').replace(/\s+/g, '-').toLowerCase();
  Q('#dvExportar').addEventListener('click', () => bajar(mapa.exportMapping(ctx.nombre), nombreArchivo() + '.materials.json'));
  Q('#dvMapa').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { importarJson(JSON.parse(await f.text())); aviso('Mapeo importado'); } catch (err) { console.error(err); aviso('El archivo no es un mapeo válido'); }
  });
  Q('#dvManifest').addEventListener('click', () => { if (!mapa.library.length) return aviso('Primero elige una carpeta de texturas'); bajar(MM.exportManifest(mapa.library), 'textures.manifest.json'); });
  Q('#dvOrig').addEventListener('click', () => { ctx.original = !ctx.original; if (ctx.original) mapa.restore(); else mapa.apply(); ctx.redibujar(); Q('#dvOrig').textContent = ctx.original ? 'Ver asignados' : 'Ver originales'; });

  /* ---- texturas web (Poly Haven, CC0) ---- */
  Q('#dvPerfil').innerHTML = Object.keys(MM.PROFILES).map(k => '<option value="' + k + '">' + MM.PROFILES[k].label + '</option>').join('');
  Q('#dvTono').innerHTML = Object.keys(MM.TONES).map(k => '<option value="' + k + '">' + MM.TONES[k].label + '</option>').join('');
  function aplicarTonos() { mapa.usedRules().forEach(u => { mapa.ruleTint[u.rule.id] = MM.profileTint(web.profile, u.rule.id, web.tone); }); }
  function ponerTex(id, t) { mapa.ruleTex[id] = t; if (t && !mapa.library.some(x => x.id === t.id)) mapa.library.push(t); }
  async function buscarWeb() {
    const btn = Q('#dvWeb'), est = Q('#dvWebEstado'); btn.disabled = true;
    try {
      est.textContent = 'Consultando catálogo de Poly Haven…';
      const cat = await MM.loadPolyHavenCatalog(), usadas = mapa.usedRules(); aplicarTonos(); let i = 0;
      for (const u of usadas) {
        const c = MM.searchTextures(cat, web.profile, u.rule.id, 6); web.candidates[u.rule.id] = c; i++; if (!c.length) continue;
        est.textContent = 'Descargando ' + i + '/' + usadas.length + ' · ' + u.rule.label;
        try { ponerTex(u.rule.id, await MM.polyHavenTexture(c[0], web.res)); } catch (err) { console.warn(err); }
      }
      web.searched = true; ejecutar(); est.textContent = MM.PROFILES[web.profile].label + ' · ' + cat.length + ' texturas en catálogo'; aviso('Texturas asignadas');
    } catch (err) { console.error(err); est.textContent = 'Sin conexión con Poly Haven'; aviso('No se pudo consultar Poly Haven (' + (err.message || err) + ').'); }
    finally { btn.disabled = false; }
  }
  Q('#dvWeb').addEventListener('click', buscarWeb);
  Q('#dvPerfil').addEventListener('change', e => { web.profile = e.target.value; if (web.searched) buscarWeb(); else { aplicarTonos(); ejecutar(); } });
  Q('#dvTono').addEventListener('change', e => { web.tone = e.target.value; aplicarTonos(); ejecutar(); });
  Q('#dvRes').addEventListener('change', e => { web.res = e.target.value; if (web.searched) buscarWeb(); });
  function renderPaleta() {
    const ul = Q('#dvPaleta'), usadas = mapa.usedRules();
    if (!usadas.length) { ul.innerHTML = '<li class="dv-empty">Ningún material del modelo tiene regla asignada.</li>'; return; }
    ul.innerHTML = usadas.map(u => {
      const rule = u.rule, tex = rule.id in mapa.ruleTex ? mapa.ruleTex[rule.id] : MM.resolveTexture(rule, mapa.library),
        tint = mapa.ruleTint[rule.id] || (rule.pbr && rule.pbr.color) || '#ccc', cands = web.candidates[rule.id] || [], proc = !(rule.library && rule.library.length), esc2 = tex ? (tex.scale || rule.scale || 1) : null;
      return '<li class="dv-prow"><div class="dv-phead"><span class="dv-sw" style="background:' + (tex ? tint : (rule.pbr && rule.pbr.color) || '#ccc') + '"></span><b>' + esc(rule.label) + '</b><small>' + u.objects.toLocaleString() + ' objetos · ' + u.groups + ' grupo' + (u.groups > 1 ? 's' : '') + '</small></div>' +
        '<div class="dv-pcur">' + (tex && tex.thumb ? '<img src="' + esc(tex.thumb) + '" alt="">' : '<div class="proc">' + (proc ? 'PBR' : '—') + '</div>') +
        '<div><span>' + (tex ? esc(tex.label) : proc ? 'Material procedural' : 'Procedural (sin textura)') + '</span><small>' + (tex ? esc2.toFixed(2) + ' m por repetición' : proc ? 'Vidrio, espejo, agua y luz no usan textura' : web.searched ? 'Sin coincidencias en el catálogo' : 'Pulsa «Buscar texturas en web»') + '</small></div></div>' +
        (cands.length ? '<div class="dv-alts">' + cands.map(a => '<button type="button" class="dv-alt ' + ((tex && tex.id === 'ph:' + a.id) ? 'on' : '') + '" data-rule="' + rule.id + '" data-asset="' + esc(a.id) + '" title="' + esc(a.name || a.id) + '"><img src="' + esc(a.thumbnail_url || 'https://cdn.polyhaven.com/asset_img/thumbs/' + a.id + '.png?width=128&height=128') + '" alt="" loading="lazy"></button>').join('') + '<button type="button" class="dv-alt txt ' + (tex ? '' : 'on') + '" data-rule="' + rule.id + '" data-asset="">Sin textura</button></div>' : '') + '</li>';
    }).join('');
  }
  Q('#dvPaleta').addEventListener('click', async ev => {
    const b = ev.target.closest('.dv-alt'); if (!b) return; const id = b.dataset.rule;
    if (!b.dataset.asset) { mapa.ruleTex[id] = null; ejecutar(); return; }
    const asset = (web.candidates[id] || []).find(a => a.id === b.dataset.asset); b.style.opacity = .5;
    try { ponerTex(id, await MM.polyHavenTexture(asset, web.res)); ejecutar(); } catch (err) { aviso('No se pudo descargar ' + asset.id); b.style.opacity = 1; }
  });

  mapa.analyze(ctx.raicesBase); refrescarPanel();
  root.__dev = { mapa, MM, ponerModelo: ctx.ponerModelo, escenaPrueba, ejecutar, ponerBase: ctx.ponerBase, cargarArchivos, aviso };
  /* Deja que se pinte primero el Modelo base; precarga FRIOX sin mostrarlo */
  if (ctx.precargarFriox) requestAnimationFrame(() => setTimeout(() => precargarFriox().catch(err => console.warn('FRIOX no disponible para precarga:', err)), 100));

  return { aviso, refrescar: refrescarPanel, alCargar: () => { web.candidates = {}; web.searched = false; } };
}

root.MaterialLab = { init };
})(window);
/* DEV:END */
