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

  /* ---- panel maestro-detalle ---- */
  const ui = { filtro: 'all', sel: null, tab: 'textura', elem: null, cerrados: new Set() };
  try { JSON.parse(localStorage.getItem('dvGruposCerrados') || '[]').forEach(g => ui.cerrados.add(g)); } catch (e) {}
  const guardarCerrados = () => { try { localStorage.setItem('dvGruposCerrados', JSON.stringify([...ui.cerrados])); } catch (e) {} };
  const estado2 = e => e.result.source === 'manual' ? 'manual' : (!e.result.rule && !e.result.tex) ? 'none' : e.match.conflict ? 'review' : 'auto';
  const entrada = id => mapa.byName && mapa.byName.get(id);
  const hex = c => '#' + c.getHexString();
  /* Miniatura de un slot: muestra › textura › color del material asignado */
  function miniatura(e) {
    const v = mapa.activeVariant(e.name), r = e.result || {};
    const img = v.sample ? mapa.sampleUrl(v.sample) : r.tex ? (r.tex.thumb || (r.tex.maps.map && r.tex.maps.map.url)) : null;
    const col = e.mat ? hex(e.mat.color) : r.tint || (r.rule && r.rule.pbr && r.rule.pbr.color) || e.color || '#58585c';
    return img ? 'background-color:' + col + ";background-image:url('" + esc(String(img).replace(/'/g, '%27')) + "')" : 'background:' + col;
  }
  const nombreCorto = e => String(e.material || e.name).replace(/_+/g, ' ').trim();
  const detalleCorto = e => [...(e.categories || [])][0] + (e.match.conflict ? ' · familia ' + e.match.conflict.label.toLowerCase() : '');

  function refrescarPanel() { Q('#dvModelo').textContent = ctx.nombre + (ctx.modeloExt ? '' : ' · los materiales ligados al presupuesto están protegidos'); render(); renderPaleta(); }
  function render() { renderStats(); renderMaster(); renderDetalle(); }
  function renderStats() {
    const rep = mapa.report(), cuenta = { all: rep.total, auto: 0, manual: 0, review: 0, none: 0 };
    mapa.entries.forEach(e => { if (e.result) cuenta[estado2(e)]++; });
    Q('#dvStats').innerHTML = [['all', 'Grupos'], ['auto', 'Auto'], ['manual', 'Manual'], ['review', 'Revisar'], ['none', 'Sin asignar']].map(p => '<div class="dv-stat ' + p[0] + ' ' + (ui.filtro === p[0] ? 'on' : '') + '" data-v="' + p[0] + '" role="button" tabindex="0"><b>' + cuenta[p[0]] + '</b><span>' + p[1] + '</span></div>').join('');
    Q('#dvResumen').textContent = rep.objects.toLocaleString() + ' objetos · ' + rep.sourceMaterials.toLocaleString() + ' materiales originales → ' + rep.builtMaterials + ' materiales';
  }
  function renderMaster() {
    const q = norm(Q('#dvQ').value);
    const lista = mapa.entries.filter(e => e.result && (!q || norm(e.name).indexOf(q) >= 0 || norm(mapa.slots[e.name]?.label || '').indexOf(q) >= 0) && (ui.filtro === 'all' || estado2(e) === ui.filtro));
    if (!lista.length) { Q('#dvLista').innerHTML = '<li class="dv-empty">' + (mapa.entries.length ? 'Sin coincidencias' : 'El modelo no tiene materiales') + '</li>'; return; }
    const grupos = new Map(MM.GROUP_ORDER.map(g => [g, []]));
    lista.forEach(e => grupos.get(e.group || 'Otros').push(e));
    let html = '';
    for (const [g, es] of grupos) {
      if (!es.length) continue;
      const piezas = es.reduce((n, e) => n + e.uses.length, 0), cerrado = ui.cerrados.has(g) && !q;
      html += '<li class="dv-grp' + (cerrado ? ' cerrado' : '') + '" data-g="' + esc(g) + '"><button type="button" class="dv-ghead" aria-expanded="' + !cerrado + '"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>' + esc(g) + '<span>' + es.length + ' · ' + piezas.toLocaleString() + '</span></button><ul>' +
        es.map(e => '<li class="dv-item' + (ui.sel === e.name ? ' sel' : '') + '" data-slot="' + esc(e.name) + '" role="button" tabindex="0" title="' + esc(e.name) + '">' +
          '<span class="dv-th" style="' + miniatura(e) + '"></span>' +
          '<span class="dv-iname">' + esc(nombreCorto(e)) + '<small>' + esc(detalleCorto(e)) + '</small></span>' +
          '<span class="dv-icount">' + e.uses.length.toLocaleString() + '</span>' +
          '<span class="dv-dot ' + (ctx.ligado(e) ? 'lock' : estado2(e)) + '" title="' + ({ auto: 'Automático', manual: 'Manual', review: 'Revisar', none: 'Sin asignar' }[estado2(e)]) + '"></span></li>').join('') + '</ul></li>';
    }
    Q('#dvLista').innerHTML = html;
  }

  /* ---- detalle de un solo slot ---- */
  function abrirDetalle(id, opts) {
    opts = opts || {};
    if (!entrada(id)) return;
    ui.sel = id;
    if (!opts.elem) ui.elem = null;
    else ui.elem = opts.elem;
    if (opts.tab) ui.tab = opts.tab;
    const md = Q('#dvMD'); md.classList.add('det'); Q('#dvPanel').classList.add('det'); Q('#dvDetalle').inert = false;
    if (Q('#dvPanel').classList.contains('min')) dvEstado(false, false);
    const tabMat = document.querySelector('.dv-tab[data-tab="dvPMat"]'); if (!tabMat.classList.contains('on')) tabMat.click();
    resaltar();
    renderMaster(); renderDetalle();
  }
  function cerrarDetalle() {
    ui.sel = null; ui.elem = null; Q('#dvMD').classList.remove('det'); Q('#dvPanel').classList.remove('det'); Q('#dvDetalle').inert = true; resaltar(); renderMaster();
  }
  function renderDetalle() {
    const e = ui.sel && entrada(ui.sel);
    if (!e) { if (ui.sel) cerrarDetalle(); return; }
    const s = mapa.slots[e.name], r = e.result || {};
    Q('#dvDThumb').setAttribute('style', miniatura(e));
    Q('#dvDNombre').textContent = nombreCorto(e);
    Q('#dvDMeta').textContent = e.uses.length.toLocaleString() + ' pieza' + (e.uses.length > 1 ? 's' : '') + ' · ' + detalleCorto(e) + ' · ' + (r.rule ? r.rule.label : 'sin regla') + ' · variante «' + (s.variants[s.active].name || s.active) + '»';
    const partes = Q('#dvPartes');
    if (ui.elem && ui.elem.slots.length > 1) {
      partes.hidden = false;
      partes.innerHTML = ui.elem.slots.map(id => '<button type="button" class="dv-part' + (id === e.name ? ' on' : '') + '" data-slot="' + esc(id) + '" title="' + esc(id) + '">' + esc(etiquetaParte(id, ui.elem.slots)) + '</button>').join('');
    } else { partes.hidden = true; partes.innerHTML = ''; }
    const tabs = [...Q('#dvDTabs').querySelectorAll('button')], i = tabs.findIndex(b => b.dataset.t === ui.tab);
    tabs.forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
    Q('#dvDTabs .pill').style.transform = 'translateX(' + (i * 100) + '%)';
    const lock = ctx.ligado(e);
    Q('#dvDBody').innerHTML = (lock ? '<p class="dv-note">Ligado a la tabla de presupuesto: no se modifica desde aquí.</p>' : '') + (TABS[ui.tab] || TABS.textura)(e, s, r, lock);
  }
  /* Nombre de cada material dentro de un elemento: «Marco | Vidrio» */
  function etiquetaParte(id, todos) {
    const e = entrada(id), r = e && e.result && e.result.rule;
    const base = r ? ({ vidrio: 'Vidrio', espejo: 'Espejo', metal: 'Marco', madera: 'Madera', agua: 'Agua', emisivo: 'Luz' }[r.id] || r.label) : nombreCorto(e);
    const rep = todos.filter(x => { const o = entrada(x), rr = o && o.result && o.result.rule; return (rr ? ({ vidrio: 'Vidrio', espejo: 'Espejo', metal: 'Marco', madera: 'Madera', agua: 'Agua', emisivo: 'Luz' }[rr.id] || rr.label) : nombreCorto(o)) === base; }).length > 1;
    return rep ? base + ' · ' + nombreCorto(e) : base;
  }

  const TABS = {
    muestra: (e, s, r, lock) => '<p class="dv-note">Las muestras por slot llegan en la Parte 4.</p>',
    textura: (e, s, r, lock) => {
      const v = s.variants[s.active], dis = lock ? ' disabled' : '';
      const autoR = e.match.rule ? e.match.rule.label : 'sin regla';
      let h = '';
      if (e.match.conflict && !lock && r.source !== 'manual') h += '<div class="dv-warn" style="margin-bottom:12px">⚠ La familia sugiere ' + esc(e.match.conflict.label) + '<button type="button" data-accion="usar" data-rule="' + e.match.conflict.id + '">Usar</button><button type="button" data-accion="usar" data-rule="' + (e.match.rule ? e.match.rule.id : '__none') + '">Mantener</button></div>';
      h += '<div class="dv-field"><div class="dv-lbl">Material (regla)</div><select data-f="rule"' + dis + '><option value="">Auto · ' + esc(autoR) + '</option>' +
        mapa.rules.map(rl => '<option value="' + rl.id + '"' + (v.rule === rl.id ? ' selected' : '') + '>' + esc(rl.label) + '</option>').join('') +
        '<option value="__none"' + (v.rule === '__none' ? ' selected' : '') + '>Mantener original</option></select>' +
        '<p class="dv-note" style="margin:6px 0 0">' + (e.match.rule ? 'Coincide por ' + esc(e.match.why.slice(0, 2).join(', ')) : 'Ninguna regla coincide') + '</p></div>';
      const rule = r.rule;
      if (rule && MM.isColorOnly(rule)) return h + '<p class="dv-note">' + esc(rule.label) + ' usa un material procedural (transparencia, reflexión o emisión). Ajusta su color en Ajustes o con una muestra.</p>';
      const cands = rule ? (web.candidates[rule.id] || []) : [];
      const lib = mapa.library.filter(t => t.source !== 'sample');
      const actual = r.tex && r.tex.id;
      const auto = rule && rule.id in mapa.ruleTex ? mapa.ruleTex[rule.id] : MM.resolveTexture(rule, mapa.library);
      h += '<div class="dv-field"><div class="dv-lbl">Textura <b>' + (r.tex ? esc(r.tex.label) : 'procedural') + '</b></div><div class="dv-texgrid">' +
        '<button type="button" class="dv-tx' + (!v.texture ? ' on' : '') + '" data-tex=""' + dis + ' title="Automática">' + (auto && auto.thumb ? '<img src="' + esc(auto.thumb) + '" alt="">' : 'Auto') + '</button>' +
        '<button type="button" class="dv-tx' + (v.texture === '__none' ? ' on' : '') + '" data-tex="__none"' + dis + '>Sin<br>textura</button>' +
        lib.map(t => '<button type="button" class="dv-tx' + (v.texture === t.id ? ' on' : '') + '" data-tex="' + esc(t.id) + '" title="' + esc(t.label) + '"' + dis + '>' + ((t.thumb || (t.maps.map && t.maps.map.url)) ? '<img src="' + esc(t.thumb || t.maps.map.url) + '" alt="" loading="lazy">' : esc(t.label.slice(0, 14))) + '</button>').join('') +
        cands.filter(a => !lib.some(t => t.id === 'ph:' + a.id)).map(a => '<button type="button" class="dv-tx" data-ph="' + esc(a.id) + '" title="' + esc(a.name || a.id) + ' (Poly Haven)"' + dis + '><img src="' + esc(a.thumbnail_url || 'https://cdn.polyhaven.com/asset_img/thumbs/' + a.id + '.png?width=128&height=128') + '" alt="" loading="lazy"></button>').join('') +
        '</div>' + (!cands.length && !lib.length ? '<p class="dv-note" style="margin-top:8px">Pulsa «Buscar texturas en web» para ver opciones de Poly Haven.</p>' : '') + '</div>';
      return h + (actual ? '<p class="dv-note">' + (r.meters).toFixed(2) + ' m por repetición</p>' : '');
    },
    ajustes: (e, s, r, lock) => {
      const v = s.variants[s.active], dis = lock ? ' disabled' : '';
      const col = v.tint || (e.mat ? hex(e.mat.color) : '#cccccc');
      return '<div class="dv-field"><div class="dv-lbl">Tinte' + (v.tint ? '' : ' <b>heredado</b>') + '</div><div class="dv-color"><input type="color" data-f="tint" value="' + esc(col) + '"' + dis + '><code>' + esc(col.toUpperCase()) + '</code>' +
        (v.tint ? '<button type="button" class="dv-btn" data-accion="sin-tinte"' + dis + '>Quitar</button>' : '') + '</div></div>';
    },
    variantes: (e, s, r, lock) => {
      const ids = Object.keys(s.variants), dis = lock ? ' disabled' : '';
      return '<p class="dv-note">Cada variante guarda material, textura, ajustes y muestra. La activa es la que se ve.</p>' +
        ids.map(id => { const v = s.variants[id]; return '<div class="dv-vrow' + (id === s.active ? ' on' : '') + '" data-v="' + id + '">' +
          '<button type="button" class="dv-radio" data-accion="activar" aria-label="Usar ' + esc(v.name || id) + '"' + dis + '></button>' +
          '<input type="text" data-vf="name" value="' + esc(v.name || id) + '" aria-label="Nombre de la variante"' + dis + '>' +
          '<input type="text" class="cost" data-vf="costRef" value="' + esc(v.costRef || '') + '" placeholder="Partida" title="Partida del presupuesto (costRef)"' + dis + '>' +
          '<button type="button" class="dv-del" data-accion="borrar" aria-label="Eliminar variante"' + (ids.length < 2 || lock ? ' disabled' : '') + '>×</button></div>'; }).join('') +
        '<div class="dv-row-actions"><button type="button" class="dv-btn" data-accion="duplicar"' + dis + '>Duplicar activa</button><button type="button" class="dv-btn" data-accion="nueva"' + dis + '>Nueva automática</button></div>';
    },
  };

  /* edición: todo cambia la variante activa del slot */
  const editar = patch => { const e = entrada(ui.sel); if (!e) return; mapa.updateVariant(e.name, mapa.slots[e.name].active, patch); actualizado(); };
  function actualizado() { ctx.redibujar(); renderStats(); renderMaster(); renderDetalle(); renderPaleta(); }
  function ejecutar() { ctx.aplicarMapa(); render(); renderPaleta(); }

  Q('#dvStats').addEventListener('click', ev => { const s = ev.target.closest('.dv-stat'); if (!s) return; ui.filtro = s.dataset.v; renderStats(); renderMaster(); });
  Q('#dvLista').addEventListener('click', ev => {
    const g = ev.target.closest('.dv-ghead');
    if (g) { const n = g.parentNode.dataset.g; if (ui.cerrados.has(n)) ui.cerrados.delete(n); else ui.cerrados.add(n); guardarCerrados(); g.parentNode.classList.toggle('cerrado'); g.setAttribute('aria-expanded', String(!ui.cerrados.has(n))); return; }
    const it = ev.target.closest('.dv-item'); if (it) abrirDetalle(it.dataset.slot);
  });
  Q('#dvLista').addEventListener('keydown', ev => { const it = ev.target.closest('.dv-item'); if (it && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); abrirDetalle(it.dataset.slot); } });
  Q('#dvQ').addEventListener('input', renderMaster);
  Q('#dvVolver').addEventListener('click', cerrarDetalle);
  Q('#dvPartes').addEventListener('click', ev => { const b = ev.target.closest('.dv-part'); if (b) abrirDetalle(b.dataset.slot, { elem: ui.elem }); });
  Q('#dvDTabs').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ui.tab = b.dataset.t; renderDetalle(); });
  Q('#dvDBody').addEventListener('change', ev => {
    const t = ev.target, e = entrada(ui.sel); if (!e) return;
    if (t.dataset.f === 'rule') editar({ rule: t.value || null });
    else if (t.dataset.f === 'tint') editar({ tint: t.value });
    else if (t.dataset.vf) { const v = t.closest('.dv-vrow').dataset.v; mapa.updateVariant(e.name, v, { [t.dataset.vf]: t.value.trim() || null }); renderDetalle(); }
  });
  Q('#dvDBody').addEventListener('input', ev => {          // tinte en vivo mientras se arrastra el selector
    const t = ev.target; if (t.dataset.f !== 'tint') return; const e = entrada(ui.sel); if (!e) return;
    mapa.updateVariant(e.name, mapa.slots[e.name].active, { tint: t.value }); ctx.redibujar();
    const c = t.parentNode.querySelector('code'); if (c) c.textContent = t.value.toUpperCase();
  });
  Q('#dvDBody').addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b || b.disabled) return; const e = entrada(ui.sel); if (!e) return; const s = mapa.slots[e.name];
    if (b.dataset.tex !== undefined) return editar({ texture: b.dataset.tex || null });
    if (b.dataset.ph) {
      const rule = e.result.rule, asset = (web.candidates[rule.id] || []).find(a => a.id === b.dataset.ph); b.classList.add('cargando');
      try { const t = await MM.polyHavenTexture(asset, web.res); if (!mapa.findTexture(t.id)) mapa.library.push(t); editar({ texture: t.id }); }
      catch (err) { aviso('No se pudo descargar ' + asset.id); b.classList.remove('cargando'); }
      return;
    }
    const acc = b.dataset.accion, row = b.closest('.dv-vrow'), vid = row && row.dataset.v;
    if (acc === 'usar') editar({ rule: b.dataset.rule });
    else if (acc === 'sin-tinte') editar({ tint: null });
    else if (acc === 'activar') { mapa.setVariant(e.name, vid); actualizado(); }
    else if (acc === 'borrar') { mapa.removeVariant(e.name, vid); actualizado(); }
    else if (acc === 'duplicar') { const v = s.variants[s.active]; const id = mapa.addVariant(e.name, Object.assign({}, v, { name: (v.name || s.active) + ' (copia)' })); mapa.setVariant(e.name, id); actualizado(); }
    else if (acc === 'nueva') { const id = mapa.addVariant(e.name, {}); mapa.setVariant(e.name, id); actualizado(); }
  });
  document.querySelectorAll('.dv-tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.dv-tab').forEach(x => x.classList.toggle('on', x === t));
    document.querySelectorAll('.dv-pane').forEach(p => p.classList.toggle('on', p.id === t.dataset.tab));
  }));

  /* ---- clic en el visor: raycaster → pieza → elemento → slots ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let abajo = null;
  ctx.canvas.addEventListener('pointerdown', ev => { abajo = { x: ev.clientX, y: ev.clientY, t: performance.now(), b: ev.button }; });
  ctx.canvas.addEventListener('pointerup', ev => {
    const a = abajo; abajo = null;
    if (!a || a.b !== 0 || Q('#dvPanel').classList.contains('min')) return;
    if (Math.hypot(ev.clientX - a.x, ev.clientY - a.y) > 5 || performance.now() - a.t > 450) return;   // fue un arrastre
    elegirEnVisor(ev.clientX, ev.clientY);
  });
  function raicesVisibles() { return ctx.modeloExt && ctx.nivel ? [ctx.nivel] : ctx.raicesBase.filter(o => o.visible); }
  function elegirEnVisor(x, y) {
    const rc = ctx.canvas.getBoundingClientRect();
    ndc.set((x - rc.left) / rc.width * 2 - 1, -((y - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    const hits = ray.intersectObjects(raicesVisibles(), true);
    const h = hits.find(h => h.object.visible && mapa.meshSlots.has(h.object) && !h.object.userData.__dvHl);
    if (!h) return;
    const elem = elemento(h.object), slots = mapa.meshSlots.get(h.object);
    abrirDetalle(slots[0], { elem });
  }
  /* El elemento es el nodo padre de la pieza (instancia de Revit). Si el padre agrupa demasiado, la pieza sola. */
  function elemento(mesh) {
    const p = mesh.parent, roots = new Set(raicesVisibles());
    let meshes = [mesh];
    if (p && !roots.has(mesh) && !p.isScene) {
      const m = []; p.traverse(o => { if (o.isMesh && mapa.meshSlots.has(o)) m.push(o); });
      if (m.length <= 60) meshes = m;
    }
    const slots = [];
    mapa.meshSlots.get(mesh).forEach(id => slots.includes(id) || slots.push(id));
    meshes.forEach(o => mapa.meshSlots.get(o).forEach(id => slots.includes(id) || slots.push(id)));
    return { mesh, meshes, slots };
  }
  /* Resalta en el visor las piezas del slot activo (en el elemento elegido, o todas si se eligió en la lista) */
  const hlMat = new THREE.MeshBasicMaterial({ color: 0x5b8bd9, transparent: true, opacity: .45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const hl = new THREE.Group(); hl.name = 'dv-resaltado'; ctx.scene.add(hl);
  function resaltar() {
    while (hl.children.length) hl.remove(hl.children[0]);
    const e = ui.sel && entrada(ui.sel);
    if (e) {
      const set = ui.elem ? ui.elem.meshes.filter(m => (mapa.meshSlots.get(m) || []).includes(e.name)) : e.uses.map(u => u.mesh);
      [...new Set(set)].slice(0, 400).forEach(m => {
        if (m.isInstancedMesh) return;
        m.updateWorldMatrix(true, false);
        const o = new THREE.Mesh(m.geometry, hlMat); o.matrixAutoUpdate = false; o.matrix.copy(m.matrixWorld); o.userData.__dvHl = true; o.renderOrder = 5; o.raycast = () => {};
        hl.add(o);
      });
    }
    ctx.redibujar();
  }
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
  root.__dev = { mapa, MM, ponerModelo: ctx.ponerModelo, escenaPrueba, ejecutar, ponerBase: ctx.ponerBase, cargarArchivos, aviso, abrirDetalle, elegirEnVisor, ui, ctx };
  /* Deja que se pinte primero el Modelo base; precarga FRIOX sin mostrarlo */
  if (ctx.precargarFriox) requestAnimationFrame(() => setTimeout(() => precargarFriox().catch(err => console.warn('FRIOX no disponible para precarga:', err)), 100));

  return { aviso, refrescar: refrescarPanel, alCargar: () => { web.candidates = {}; web.searched = false; } };
}

root.MaterialLab = { init };
})(window);
/* DEV:END */
