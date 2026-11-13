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
    const arr = [].slice.call(lista), glb = arr.find(f => /\.glb$/i.test(f.name)), js = arr.find(f => /\.json$/i.test(f.name)), zp = arr.find(f => /\.zip$/i.test(f.name));
    if (!glb && zp) { try { await importarZip(zp); aviso('Mapeo importado'); } catch (e) { console.error(e); aviso('El .zip no es un mapeo válido'); } return; }
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

  /* ---- editor por clic: el panel muestra el inicio hasta que se elige un elemento en el visor ---- */
  const ui = { sel: null, elem: null };
  const entrada = id => mapa.byName && mapa.byName.get(id);
  const hex = c => '#' + c.getHexString();
  const url = s => "url('" + esc(String(s).replace(/'/g, '%27')) + "')";
  const nombreCorto = e => String(e.material || e.name).replace(/_+/g, ' ').trim();
  const ROL_TXT = { principal: 'Principal', secundario: 'Secundario', variacion: 'Variación' };
  const ROL_DESC = { principal: 'Muros, plafones y el material de mayor área', secundario: 'Estructura, carpinterías, metales y pisos', variacion: 'Mobiliario, detalles y elementos menores' };
  const m2 = a => (a >= 100 ? Math.round(a).toLocaleString() : (a || 0).toFixed(1)) + ' m²';
  /* Aspecto de un slot con una variante (la activa por defecto): muestra › textura › color */
  function aspecto(e, v) {
    const vv = v || mapa.activeVariant(e.name), r = v ? mapa.resolve(e, v) : (e.result || mapa.resolve(e));
    const img = vv.sample ? mapa.sampleUrl(vv.sample) : r.tex ? (r.tex.thumb || (r.tex.maps.map && r.tex.maps.map.url)) : null;
    const col = r.tint || r.color || (!v && e.mat ? hex(e.mat.color) : null) || (r.rule && r.rule.pbr && r.rule.pbr.color) || e.color || '#58585c';
    return img ? 'background-color:' + col + ';background-image:' + url(img) : 'background:' + col;
  }
  /* Nombre de cada material dentro de un elemento: «Marco | Vidrio» */
  const PARTE = { vidrio: 'Vidrio', espejo: 'Espejo', metal: 'Marco', madera: 'Madera', agua: 'Agua', emisivo: 'Luz' };
  const parteBase = e => {
    const r = e && e.result && e.result.rule; if (!r) return nombreCorto(e);
    if (MM.isColorOnly(r)) return PARTE[r.id] || r.label;                          // vidrio, espejo, agua, luz
    if (r.id === 'metal' && /Puertas|Ventanas/.test(e.group)) return 'Marco';
    return nombreCorto(e);
  };
  function etiquetaParte(id, todos) {
    const e = entrada(id), base = parteBase(e);
    return todos.filter(x => parteBase(entrada(x)) === base).length > 1 ? base + ' · ' + nombreCorto(e) : base;
  }

  function refrescarPanel() {
    Q('#dvModelo').textContent = ctx.nombre + (ctx.modeloExt ? '' : ' · los materiales ligados al presupuesto están protegidos');
    const rep = mapa.report();
    Q('#dvResumen').textContent = rep.objects.toLocaleString() + ' piezas · ' + rep.total + ' materiales del modelo → ' + rep.builtMaterials + ' materiales asignados';
    renderPaleta(); renderPal(); renderEditor();
  }
  const render = refrescarPanel;

  function seleccionar(id, opts) {
    opts = opts || {};
    const e = entrada(id); if (!e) return;
    ui.sel = id; ui.elem = opts.elem || null;
    Q('#dvVistas').classList.add('editando'); Q('#dvEditor').inert = false; Q('#dvInicio').inert = true;
    if (Q('#dvPanel').classList.contains('min')) dvEstado(false, false);
    resaltar(); renderEditor();
    Q('#dvDBody').scrollTop = 0;
  }
  const abrirDetalle = seleccionar;               // nombre anterior (pruebas)
  function cerrarEditor() {
    if (!ui.sel) return;
    ui.sel = null; ui.elem = null;
    Q('#dvVistas').classList.remove('editando'); Q('#dvEditor').inert = true; Q('#dvInicio').inert = false;
    resaltar(); renderPaleta();
  }

  function renderEditor() {
    const e = ui.sel && entrada(ui.sel);
    if (!e) { if (ui.sel) cerrarEditor(); return; }
    const s = mapa.slots[e.name], v = s.variants[s.active], r = e.result || mapa.resolve(e), lock = ctx.ligado(e), dis = lock ? ' disabled' : '';
    const elementos = new Set(e.uses.map(u => u.mesh.parent)).size;
    Q('#dvDThumb').setAttribute('style', aspecto(e));
    Q('#dvDNombre').textContent = nombreCorto(e);
    Q('#dvDMeta').innerHTML = '<i>Iluminado en ' + e.uses.length.toLocaleString() + ' pieza' + (e.uses.length > 1 ? 's' : '') + '</i> · ' + elementos.toLocaleString() + ' elemento' + (elementos > 1 ? 's' : '') + ' · ' + m2(e.area) + '<br>' +
      esc([...(e.categories || [])][0] || 'Sin categoría') + ' · ' + (r.rule ? esc(r.rule.label) : 'sin regla') + (r.source === 'manual' ? ' · modificado' : '');
    const pw = Q('#dvPartesW');
    if (ui.elem && ui.elem.slots.length > 1) {
      pw.hidden = false;
      Q('#dvPartes').innerHTML = ui.elem.slots.map(id => '<button type="button" class="dv-part' + (id === e.name ? ' on' : '') + '" data-slot="' + esc(id) + '" title="' + esc(id) + '"><i style="' + aspecto(entrada(id)) + '"></i>' + esc(etiquetaParte(id, ui.elem.slots)) + '</button>').join('');
    } else pw.hidden = true;

    let h = lock ? '<p class="dv-note" style="color:#ffb340">Este material está ligado a la tabla de presupuesto: no se modifica desde aquí.</p>' : '';
    if (e.match.conflict && !lock && r.source !== 'manual') h += '<div class="dv-warn" style="margin-bottom:10px">⚠ La familia sugiere ' + esc(e.match.conflict.label) + '<button type="button" data-accion="usar" data-rule="' + e.match.conflict.id + '">Usar</button><button type="button" data-accion="usar" data-rule="' + (e.match.rule ? e.match.rule.id : '__none') + '">Mantener</button></div>';

    /* 1. Variantes */
    const ids = Object.keys(s.variants);
    h += '<section class="dv-sec"><h4>Variantes<small>la marcada es la que se ve</small></h4><div class="dv-vars">' +
      ids.map(id => '<button type="button" class="dv-var' + (id === s.active ? ' on' : '') + '" data-accion="activar" data-v="' + id + '"' + dis + ' title="' + esc(s.variants[id].name || id) + '"><i style="' + aspecto(e, s.variants[id]) + '"></i><span>' + esc(s.variants[id].name || id) + '</span></button>').join('') +
      '<button type="button" class="dv-var nueva" data-accion="duplicar"' + dis + ' title="Nueva variante a partir de la actual"><i>+</i><span>Nueva</span></button></div>' +
      '<div class="dv-vedit"><input type="text" data-vf="name" value="' + esc(v.name || s.active) + '" aria-label="Nombre de la variante"' + dis + '><input type="text" class="cost" data-vf="costRef" value="' + esc(v.costRef || '') + '" placeholder="Partida" title="Partida del presupuesto (costRef)"' + dis + '>' +
      '<button type="button" class="dv-del" data-accion="borrar" title="Eliminar esta variante" aria-label="Eliminar variante"' + (ids.length < 2 || lock ? ' disabled' : '') + '>×</button></div></section>';

    /* 2. Cambiar a… */
    const soloColor = MM.isColorOnly(r.rule), urlM = v.sample && mapa.sampleUrl(v.sample);
    const modo = v.sample ? (soloColor ? 'color' : (v.sampleMode || 'texture')) : null;
    h += '<section class="dv-sec"><h4>Cambiar a…<small>material deseado</small></h4>' +
      '<div class="dv-field"><div class="dv-lbl">Referencia (foto del material)' + (v.sample ? '<button type="button" data-accion="quitar-muestra"' + dis + '>Quitar</button>' : '') + '</div>' +
      '<label class="dv-muestra' + (v.sample ? ' llena' : '') + '"' + (lock ? ' aria-disabled="true"' : '') + '>' + (urlM ? '<img src="' + esc(urlM) + '" alt="Referencia">' : '<span>Arrastra aquí una foto o haz clic para elegirla<br><small>JPG, PNG o WebP</small></span>') +
      '<input type="file" data-f="sample" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden' + dis + '></label>';
    if (v.sample) h += '<div class="dv-seg dos" role="tablist" style="margin-top:8px"><span class="pill" aria-hidden="true" style="transform:translateX(' + (modo === 'color' ? 100 : 0) + '%)"></span>' +
      '<button type="button" role="tab" data-modo="texture" aria-selected="' + (modo === 'texture') + '"' + (soloColor || lock ? ' disabled' : '') + '>Usar como textura</button>' +
      '<button type="button" role="tab" data-modo="color" aria-selected="' + (modo === 'color') + '"' + dis + '>Solo su color</button></div>';
    if (soloColor) h += '<p class="dv-note" style="margin:6px 0 0">' + esc(r.rule.label) + ': la referencia solo aporta color, para no perder ' + (r.rule.id === 'vidrio' ? 'la transparencia (tiñe la transmisión).' : r.rule.id === 'emisivo' ? 'la emisión.' : 'la reflexión.') + '</p>';
    h += '</div>';
    if (!soloColor && !(v.sample && modo === 'texture')) {
      const rule = r.rule, cands = rule ? (web.candidates[rule.id] || []) : [];
      const lib = mapa.library.filter(t => t.source !== 'sample');
      const auto = rule && rule.id in mapa.ruleTex ? mapa.ruleTex[rule.id] : MM.resolveTexture(rule, mapa.library);
      h += '<div class="dv-field"><div class="dv-lbl">Textura <b>' + (r.tex ? esc(r.tex.label) : 'sin textura') + '</b></div><div class="dv-texgrid">' +
        '<button type="button" class="dv-tx' + (!v.texture ? ' on' : '') + '" data-tex=""' + dis + ' title="Automática (según el material)">' + (auto && auto.thumb ? '<img src="' + esc(auto.thumb) + '" alt="">' : 'Auto') + '</button>' +
        '<button type="button" class="dv-tx' + (v.texture === '__none' ? ' on' : '') + '" data-tex="__none"' + dis + ' title="Color liso">Sin<br>textura</button>' +
        lib.map(t => '<button type="button" class="dv-tx' + (v.texture === t.id ? ' on' : '') + '" data-tex="' + esc(t.id) + '" title="' + esc(t.label) + '"' + dis + '>' + ((t.thumb || (t.maps.map && t.maps.map.url)) ? '<img src="' + esc(t.thumb || t.maps.map.url) + '" alt="" loading="lazy">' : esc(t.label.slice(0, 14))) + '</button>').join('') +
        cands.filter(a => !lib.some(t => t.id === 'ph:' + a.id)).map(a => '<button type="button" class="dv-tx" data-ph="' + esc(a.id) + '" data-rule="' + rule.id + '" title="' + esc(a.name || a.id) + ' (Poly Haven)"' + dis + '><img src="' + esc(a.thumbnail_url || 'https://cdn.polyhaven.com/asset_img/thumbs/' + a.id + '.png?width=128&height=128') + '" alt="" loading="lazy"></button>').join('') +
        '</div>' + (rule && rule.library && rule.library.length ? '<div class="dv-row-actions"><button type="button" class="dv-btn" data-accion="buscar-rule"' + dis + '>' + (cands.length ? 'Más opciones de ' : 'Buscar texturas de ') + esc(rule.label.toLowerCase()) + '</button></div>' : '') + '</div>';
    }
    h += '<div class="dv-field"><div class="dv-lbl">Tipo de material</div><select data-f="rule"' + dis + '><option value="">Automático · ' + esc(e.match.rule ? e.match.rule.label : 'sin regla') + '</option>' +
      mapa.rules.map(rl => '<option value="' + rl.id + '"' + (v.rule === rl.id ? ' selected' : '') + '>' + esc(rl.label) + '</option>').join('') +
      '<option value="__none"' + (v.rule === '__none' ? ' selected' : '') + '>Material original del modelo</option></select></div></section>';

    /* 3. Personalización */
    const conTex = !!r.tex, t = escalaASlider(r.scale || 1), rot = r.rotation || 0;
    const rough = r.roughness != null ? r.roughness : (e.mat ? e.mat.roughness : (r.rule && r.rule.pbr && r.rule.pbr.roughness) ?? .8);
    const col = v.tint || (e.mat ? hex(e.mat.color) : '#cccccc');
    h += '<section class="dv-sec"><h4>Personalización</h4>';
    if (conTex) {
      h += '<div class="dv-field"><div class="dv-lbl">Escala <b id="dvEscM">' + metros(r) + '</b></div>' +
        '<div class="dv-range" style="' + rangoVars(t, -1000, 1000) + '"><input type="range" data-f="scale" min="-1000" max="1000" step="1" value="' + t + '" aria-label="Escala de textura"' + dis + '>' +
        '<div class="marcas" aria-hidden="true"><i>0.25×</i><i>1×</i><i>4×</i></div><div class="dv-bubble" id="dvEscB">' + escTxt(r.scale || 1) + '</div></div></div>';
      h += '<div class="dv-field"><div class="dv-lbl">Rotación de la textura <b id="dvRotB">' + rot + '°</b></div>' +
        '<div class="dv-range sinb" style="' + rangoVars(rot, 0, 360) + '"><input type="range" data-f="rotation" min="0" max="360" step="1" value="' + rot + '" aria-label="Rotación de la textura"' + dis + '>' +
        '<div class="marcas" aria-hidden="true"><i>0°</i><i>90°</i><i>180°</i><i>270°</i><i>360°</i></div></div></div>';
      h += '<div class="dv-field"><div class="dv-swrow"><div><div class="dv-lbl" style="margin:0 0 2px">Variación por pieza</div><p class="dv-note" style="margin:0">Desplaza y gira la textura en cada pieza para que las repetidas no se vean idénticas.</p></div>' +
        '<button type="button" class="dv-switch" role="switch" data-f="randomUV" aria-checked="' + !!v.randomUV + '" aria-label="Variación por pieza (UV aleatorias)"' + dis + '></button></div></div>';
    } else h += '<p class="dv-note">Escala, rotación y variación por pieza aparecen cuando el material tiene una textura o una foto usada como textura.</p>';
    if (!soloColor) h += '<div class="dv-field"><div class="dv-lbl">Acabado <b id="dvRouB">' + acabadoTxt(rough) + '</b>' + (v.roughness != null ? '<button type="button" data-accion="sin-acabado"' + dis + '>Original</button>' : '') + '</div>' +
      '<div class="dv-range sinb" style="' + rangoVars(Math.round((1 - rough) * 100), 0, 100) + '"><input type="range" data-f="roughness" min="0" max="100" step="1" value="' + Math.round((1 - rough) * 100) + '" aria-label="Acabado: mate a brillante"' + dis + '>' +
      '<div class="marcas" aria-hidden="true"><i>Mate</i><i>Satinado</i><i>Brillante</i></div></div></div>';
    h += '<div class="dv-field"><div class="dv-lbl">Color' + (v.tint ? '<button type="button" data-accion="sin-tinte"' + dis + '>Quitar</button>' : ' <b>heredado</b>') + '</div><div class="dv-color"><input type="color" data-f="tint" value="' + esc(col) + '"' + dis + '><code>' + esc(col.toUpperCase()) + '</code></div></div>';
    const rol = mapa.roleOf(e.name), ri = MM.ROLES.indexOf(rol);
    h += '<div class="dv-field"><div class="dv-lbl">Rol en la paleta neutra ' + (s.role ? '<button type="button" data-accion="rol-auto"' + dis + '>Automático (' + ROL_TXT[e.autoRole] + ')</button>' : '<b>automático</b>') + '</div>' +
      '<div class="dv-seg tres" role="tablist"><span class="pill" aria-hidden="true" style="transform:translateX(' + (ri * 100) + '%)"></span>' +
      MM.ROLES.map(k => '<button type="button" role="tab" data-rol="' + k + '" aria-selected="' + (k === rol) + '"' + dis + ' title="' + ROL_DESC[k] + '">' + ROL_TXT[k] + '</button>').join('') + '</div>' +
      '<p class="dv-note" style="margin:6px 0 0">' + (r.color ? 'Sin referencia ni textura, se ve con el color ' + ROL_TXT[rol].toLowerCase() + ' de la paleta.' : 'Solo se usa cuando el material no tiene referencia ni textura.') + '</p></div>';
    h += '<button type="button" class="dv-btn dv-reset" data-accion="restablecer"' + (r.source !== 'manual' || lock ? ' disabled' : '') + '>Restablecer esta variante a automático</button></section>';
    Q('#dvDBody').innerHTML = h;
  }

  /* ---- paleta neutra (inicio) ---- */
  function renderPal() {
    const tot = { principal: [0, 0], secundario: [0, 0], variacion: [0, 0] };
    mapa.entries.forEach(e => { if (e.result && e.result.color) { const t = tot[mapa.roleOf(e.name)]; t[0]++; t[1] += e.area || 0; } });
    Q('#dvPal').innerHTML = MM.ROLES.map(k => '<label class="dv-palrol" title="' + ROL_DESC[k] + '"><input type="color" data-rol="' + k + '" value="' + esc(mapa.palette[k].toLowerCase()) + '" aria-label="Color ' + ROL_TXT[k] + '">' +
      '<i style="background:' + esc(mapa.palette[k]) + '"></i><b>' + ROL_TXT[k] + '</b><small>' + tot[k][0] + ' material' + (tot[k][0] === 1 ? '' : 'es') + ' · ' + m2(tot[k][1]) + '</small></label>').join('') +
      '<p class="dv-pal-nota">Color de los materiales que aún no tienen referencia ni textura.</p>';
  }
  Q('#dvPal').addEventListener('input', ev => { const t = ev.target; if (!t.dataset.rol) return; mapa.previewPalette(t.dataset.rol, t.value); t.nextElementSibling.style.background = t.value; ctx.redibujar(); });
  Q('#dvPal').addEventListener('change', ev => { const t = ev.target; if (!t.dataset.rol) return; mapa.setPalette({ [t.dataset.rol]: t.value }); ctx.redibujar(); refrescarPanel(); });

  /* ---- sliders en vivo (escala logarítmica, rotación, acabado) ---- */
  const sliderAEscala = t => Math.pow(4, t / 1000);
  const escalaASlider = s => Math.round(Math.log(s) / Math.log(4) * 1000);
  const escTxt = s => (s >= 1 ? s.toFixed(2) : s.toFixed(3).replace(/0$/, '')) + '×';
  const metros = r => r.meters.toFixed(2) + ' m por repetición';
  const acabadoTxt = rg => rg > .75 ? 'mate' : rg > .4 ? 'satinado' : rg > .15 ? 'semibrillante' : 'brillante';
  const rangoVars = (t, min, max) => { const f = (t - min) / (max - min); return '--p:' + (f * 100).toFixed(2) + '%;--pn:' + f.toFixed(4); };
  function sliderEnVivo(input, soltar) {
    const e = entrada(ui.sel); if (!e) return;
    const f = input.dataset.f; let t = +input.value, patch;
    if (f === 'scale') { if (Math.abs(t) < 18) { t = 0; input.value = 0; } patch = { scale: sliderAEscala(t) }; input.parentNode.setAttribute('style', rangoVars(t, -1000, 1000)); }
    else if (f === 'rotation') { const im = [0, 90, 180, 270, 360].find(k => Math.abs(t - k) < 6); if (im != null) { t = im; input.value = t; } patch = { rotation: t % 360 }; input.parentNode.setAttribute('style', rangoVars(t, 0, 360)); }
    else { patch = { roughness: 1 - t / 100 }; input.parentNode.setAttribute('style', rangoVars(t, 0, 100)); }
    mapa.previewVariant(e.name, patch);
    if (soltar) mapa.commitPreview(e.name);
    const r = e.result;
    if (f === 'scale') { Q('#dvEscB').textContent = escTxt(patch.scale); Q('#dvEscM').textContent = metros(r); }
    else if (f === 'rotation') Q('#dvRotB').textContent = (t % 360) + '°';
    else Q('#dvRouB').textContent = acabadoTxt(patch.roughness);
    ctx.redibujar();
    if (soltar) actualizado();
  }

  /* edición: todo cambia la variante activa del slot */
  const editar = patch => { const e = entrada(ui.sel); if (!e) return; mapa.updateVariant(e.name, mapa.slots[e.name].active, patch); actualizado(); };
  function actualizado() { ctx.redibujar(); refrescarPanel(); }
  function ejecutar() { ctx.aplicarMapa(); refrescarPanel(); }

  Q('#dvVolver').addEventListener('click', cerrarEditor);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && ui.sel && !/input|select|textarea/i.test(ev.target.tagName)) cerrarEditor(); });
  Q('#dvPartes').addEventListener('click', ev => { const b = ev.target.closest('.dv-part'); if (b) seleccionar(b.dataset.slot, { elem: ui.elem }); });
  Q('#dvMasBtn').addEventListener('click', () => { const m = Q('#dvMas'), abierto = m.hidden; m.hidden = !abierto; Q('#dvMasBtn').setAttribute('aria-expanded', String(abierto)); });
  Q('#dvDBody').addEventListener('change', ev => {
    const t = ev.target, e = entrada(ui.sel); if (!e) return;
    if (t.dataset.f === 'sample') { const f = t.files && t.files[0]; t.value = ''; if (f) ponerMuestra(f); return; }
    if (['scale', 'rotation', 'roughness'].includes(t.dataset.f)) return sliderEnVivo(t, true);
    if (t.dataset.f === 'rule') editar({ rule: t.value || null });
    else if (t.dataset.f === 'tint') editar({ tint: t.value });
    else if (t.dataset.vf) { mapa.updateVariant(e.name, mapa.slots[e.name].active, { [t.dataset.vf]: t.value.trim() || null }); renderEditor(); }
  });
  Q('#dvDBody').addEventListener('input', ev => {
    const t = ev.target; if (['scale', 'rotation', 'roughness'].includes(t.dataset.f)) return sliderEnVivo(t, false);
    if (t.dataset.f !== 'tint') return; const e = entrada(ui.sel); if (!e) return;
    mapa.updateVariant(e.name, mapa.slots[e.name].active, { tint: t.value }); ctx.redibujar();
    const c = t.parentNode.querySelector('code'); if (c) c.textContent = t.value.toUpperCase();
  });
  Q('#dvDBody').addEventListener('dblclick', ev => { const t = ev.target; if (t.dataset && ['scale', 'rotation'].includes(t.dataset.f) && !t.disabled) { t.value = 0; sliderEnVivo(t, true); } });
  /* soltar una imagen sobre el editor: referencia del material (no llega al visor) */
  const det = Q('#dvEditor'), esImagen = ev => [...(ev.dataTransfer && ev.dataTransfer.items || [])].some(i => i.kind === 'file' && /^image\//.test(i.type));
  det.addEventListener('dragover', ev => { if (!esImagen(ev)) return; ev.preventDefault(); ev.stopPropagation(); det.classList.add('soltar'); });
  det.addEventListener('dragleave', () => det.classList.remove('soltar'));
  det.addEventListener('drop', ev => {
    const f = ev.dataTransfer && [...ev.dataTransfer.files].find(x => /^image\/(jpeg|png|webp)$/.test(x.type)); det.classList.remove('soltar');
    if (!f) return; ev.preventDefault(); ev.stopPropagation(); ponerMuestra(f);
  });
  Q('#dvDBody').addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b || b.disabled) return; const e = entrada(ui.sel); if (!e) return; const s = mapa.slots[e.name];
    if (b.dataset.tex !== undefined) return editar({ texture: b.dataset.tex || null });
    if (b.dataset.modo) return modoMuestra(b.dataset.modo);
    if (b.dataset.rol) { mapa.setRole(e.name, b.dataset.rol === e.autoRole ? null : b.dataset.rol); return actualizado(); }
    if (b.dataset.f === 'randomUV') return editar({ randomUV: b.getAttribute('aria-checked') === 'true' ? null : true });
    if (b.dataset.ph) {
      const asset = (web.candidates[b.dataset.rule] || []).find(a => a.id === b.dataset.ph); b.classList.add('cargando');
      try { const t = await MM.polyHavenTexture(asset, web.res); if (!mapa.findTexture(t.id)) mapa.library.push(t); editar({ texture: t.id }); }
      catch (err) { aviso('No se pudo descargar ' + asset.id); b.classList.remove('cargando'); }
      return;
    }
    const acc = b.dataset.accion;
    if (acc === 'usar') editar({ rule: b.dataset.rule });
    else if (acc === 'quitar-muestra') { const v = s.variants[s.active]; editar({ sample: null, sampleMode: null, tint: v.sampleMode === 'color' || MM.isColorOnly(e.result.rule) ? null : v.tint }); }
    else if (acc === 'sin-tinte') editar({ tint: null });
    else if (acc === 'sin-acabado') editar({ roughness: null });
    else if (acc === 'rol-auto') { mapa.setRole(e.name, null); actualizado(); }
    else if (acc === 'activar') { mapa.setVariant(e.name, b.dataset.v); actualizado(); }
    else if (acc === 'borrar') { mapa.removeVariant(e.name, s.active); actualizado(); }
    else if (acc === 'duplicar') { const v = s.variants[s.active], n = Object.keys(s.variants).length + 1; const id = mapa.addVariant(e.name, Object.assign({}, v, { name: 'Variante ' + n })); mapa.setVariant(e.name, id); actualizado(); }
    else if (acc === 'restablecer') { const v = s.variants[s.active]; mapa.updateVariant(e.name, s.active, { rule: null, texture: null, tint: null, scale: null, rotation: null, roughness: null, randomUV: null, sample: null, sampleMode: null }); actualizado(); aviso('Variante «' + (v.name || s.active) + '» en automático'); }
    else if (acc === 'buscar-rule') buscarParaRegla(e.result.rule, b);
  });
  /* Busca en Poly Haven solo las texturas del material que se está editando */
  async function buscarParaRegla(rule, btn) {
    if (!rule) return; btn.disabled = true; btn.textContent = 'Buscando…';
    try { const cat = await MM.loadPolyHavenCatalog(); web.candidates[rule.id] = MM.searchTextures(cat, web.profile, rule.id, 12); if (!web.candidates[rule.id].length) aviso('Sin coincidencias para ' + rule.label.toLowerCase()); }
    catch (err) { console.error(err); aviso('No se pudo consultar Poly Haven'); }
    renderEditor();
  }

  /* ---- clic en el visor: raycaster → pieza → elemento → material ---- */
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
  const visibleReal = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const matDe = m => Array.isArray(m.material) ? m.material[0] : m.material;
  const transparente = m => { const t = matDe(m); return !!t && ((t.transmission || 0) > .3 || (t.transparent && t.opacity < .6)); };
  let diagModelo = { root: null, d: 1 };
  function enorme(mesh) {
    const root = raicesVisibles()[0];
    if (diagModelo.root !== root) { const bx = new THREE.Box3(); raicesVisibles().forEach(o => bx.expandByObject(o)); diagModelo = { root, d: bx.getSize(new THREE.Vector3()).length() || 1 }; }
    return new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).length() > diagModelo.d * .25;
  }
  /* Elige la superficie que realmente se ve: la primera pieza opaca. Un vidrio solo se elige si es parte de un
     elemento con piezas opacas (ventana, puerta, cancel) y no es un volumen de contexto enorme. */
  function elegirImpacto(hits) {
    for (const h of hits) {
      const o = h.object;
      if (!mapa.meshSlots.has(o) || o.userData.__dvHl || !visibleReal(o)) continue;
      if (!transparente(o)) return h;
      const el = elemento(o);
      if (el.meshes.length > 1 && el.meshes.some(m => !transparente(m)) && !enorme(o)) return h;
    }
    return null;
  }
  function elegirEnVisor(x, y) {
    const rc = ctx.canvas.getBoundingClientRect();
    ndc.set((x - rc.left) / rc.width * 2 - 1, -((y - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ndc, ctx.camera);
    const h = elegirImpacto(ray.intersectObjects(raicesVisibles(), true));
    if (!h) { cerrarEditor(); return null; }                     // clic en el vacío: deselecciona
    const slots = mapa.meshSlots.get(h.object);
    seleccionar(slots[0], { elem: elemento(h.object) });
    return slots[0];
  }
  /* El elemento es el nodo padre de la pieza (instancia de Revit). Si el padre agrupa demasiado, la pieza sola. */
  function elemento(mesh) {
    const p = mesh.parent, roots = new Set(raicesVisibles());
    let meshes = [mesh];
    if (p && !roots.has(p) && !roots.has(mesh) && !p.isScene) {
      const m = []; p.traverse(o => { if (o.isMesh && mapa.meshSlots.has(o)) m.push(o); });
      if (m.length <= 60) meshes = m;
    }
    const slots = [];
    meshes.forEach(o => mapa.meshSlots.get(o).forEach(id => slots.includes(id) || slots.push(id)));
    return { mesh, meshes, slots };
  }
  /* Ilumina todas las piezas con el material elegido; las del elemento clicado, más intensas */
  const hlTodo = new THREE.MeshBasicMaterial({ color: 0x4f8cff, transparent: true, opacity: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const hlElem = new THREE.MeshBasicMaterial({ color: 0xb4d0ff, transparent: true, opacity: .8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const hl = new THREE.Group(); hl.name = 'dv-resaltado'; ctx.scene.add(hl);
  const MAX_HL = 4000;
  function capa(m, mat) {
    if (m.isInstancedMesh) return;
    m.updateWorldMatrix(true, false);
    const o = new THREE.Mesh(m.geometry, mat); o.matrixAutoUpdate = false; o.matrix.copy(m.matrixWorld); o.userData.__dvHl = true; o.renderOrder = 5; o.raycast = () => {};
    hl.add(o);
  }
  function resaltar() {
    while (hl.children.length) hl.remove(hl.children[0]);
    const e = ui.sel && entrada(ui.sel);
    if (e) {
      const enElem = new Set(ui.elem ? ui.elem.meshes.filter(m => (mapa.meshSlots.get(m) || []).includes(e.name)) : []);
      [...new Set(e.uses.map(u => u.mesh))].slice(0, MAX_HL).forEach(m => capa(m, enElem.has(m) ? hlElem : hlTodo));
      pulso();
    }
    ctx.redibujar();
  }
  /* pulso breve al seleccionar para ubicar las piezas iluminadas */
  let pulsoId = 0;
  function pulso() {
    const id = ++pulsoId, t0 = performance.now();
    (function paso(t) {
      if (id !== pulsoId) return;
      const k = Math.min(1, (t - t0) / 1400), w = .5 + .5 * Math.cos(k * Math.PI * 4);   // dos destellos
      hlTodo.opacity = .5 + .35 * w * (1 - k); hlElem.opacity = .8 + .2 * w * (1 - k);
      ctx.redibujar();
      if (k < 1) requestAnimationFrame(paso);
    })(t0);
  }
  function dvEstado(m, g) { const p = Q('#dvPanel'); p.classList.toggle('min', m); Q('.dv-body').inert = m; Q('#dvMin').setAttribute('aria-expanded', String(!m)); if (!m && !ui.sel) { /* nada */ } if (m) cerrarEditor(); if (g) { try { localStorage.setItem('devPanel', m ? 'closed' : 'open'); } catch (e) {} } }
  Q('#dvMin').addEventListener('click', () => dvEstado(!Q('#dvPanel').classList.contains('min'), true));
  Q('#dvMinIn').addEventListener('click', () => dvEstado(true, true));
  (function () { let m = true; try { m = localStorage.getItem('devPanel') !== 'open'; } catch (e) {} dvEstado(m, false); })();

  /* ---- muestras: IndexedDB (desarrollo) + .zip con samples/ al exportar ---- */
  const idb = {
    db: null,
    abrir() {
      if (this.db) return this.db;
      return (this.db = new Promise((ok, ko) => {
        try { const r = indexedDB.open('toscano-material-lab', 1); r.onupgradeneeded = () => r.result.createObjectStore('samples'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }
        catch (e) { ko(e); }
      }));
    },
    async tx(modo, fn) { const d = await this.abrir(); return new Promise((ok, ko) => { const t = d.transaction('samples', modo), q = fn(t.objectStore('samples')); t.oncomplete = () => ok(q && q.result); t.onerror = () => ko(t.error); }); },
    async guardar(k, blob) { try { await this.tx('readwrite', s => s.put(blob, k)); } catch (e) { console.warn('IndexedDB:', e); } },
    async todas() {
      try {
        const d = await this.abrir();
        return await new Promise((ok, ko) => { const out = [], c = d.transaction('samples').objectStore('samples').openCursor(); c.onsuccess = () => { const x = c.result; if (x) { out.push([x.key, x.value]); x.continue(); } else ok(out); }; c.onerror = () => ko(c.error); });
      } catch (e) { console.warn('IndexedDB:', e); return []; }
    },
  };
  const blobs = new Map();                         // 'samples/x.jpg' → Blob (para empaquetar al exportar)
  function registrarMuestra(ref, blob) {
    blobs.set(ref, blob);
    if (mapa.sampleUrls[ref]) URL.revokeObjectURL(mapa.sampleUrls[ref]);
    mapa.sampleUrls[ref] = URL.createObjectURL(blob);
  }
  /* Al abrir el laboratorio se recuperan las muestras guardadas en este navegador */
  idb.todas().then(lista => {
    if (!lista.length) return;
    lista.forEach(([k, b]) => registrarMuestra(k, b));
    if (mapa.sampleRefs().some(r => blobs.has(r))) { mapa.clearCache(); ctx.aplicarMapa(); render(); }
  });
  const slug = s => norm(s).replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'muestra';
  async function huella(blob) {
    try { const d = await crypto.subtle.digest('SHA-1', await blob.arrayBuffer()); return [...new Uint8Array(d)].slice(0, 3).map(b => b.toString(16).padStart(2, '0')).join(''); }
    catch (e) { return (blob.size >>> 0).toString(16).slice(-6); }
  }
  /* Color dominante: se dibuja reducida en un canvas y el promedio robusto lo calcula material-mapper.js */
  function colorDeImagen(url) {
    return new Promise((ok, ko) => {
      const img = new Image(); img.onload = () => {
        const k = Math.min(1, 96 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, w, h); ok(MM.dominantColor(g.getImageData(0, 0, w, h).data));
      }; img.onerror = () => ko(new Error('No se pudo leer la imagen')); img.src = url;
    });
  }
  async function ponerMuestra(file) {
    const e = entrada(ui.sel); if (!e || ctx.ligado(e)) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) { aviso('Usa una imagen JPG, PNG o WebP'); return; }
    const ext = (file.name.match(/\.(jpe?g|png|webp)$/i) || ['', 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg');
    const ref = 'samples/' + slug(file.name) + '-' + await huella(file) + '.' + ext;
    registrarMuestra(ref, file); idb.guardar(ref, file);
    const rule = e.result && e.result.rule, soloColor = MM.isColorOnly(rule);
    const v = mapa.activeVariant(e.name), modo = soloColor ? 'color' : (v.sampleMode || 'texture');
    const patch = { sample: ref, sampleMode: modo, tint: null };
    if (modo === 'color') patch.tint = await colorDeImagen(mapa.sampleUrl(ref));
    editar(patch);
    aviso(soloColor ? 'Muestra aplicada como referencia de color' : 'Muestra aplicada');
  }
  async function modoMuestra(modo) {
    const e = entrada(ui.sel); if (!e) return; const v = mapa.activeVariant(e.name); if (!v.sample) return;
    if (modo === 'texture' && MM.isColorOnly(e.result.rule)) return aviso('Vidrio, espejo, agua y luz solo aceptan referencia de color');
    editar({ sampleMode: modo, tint: modo === 'color' ? await colorDeImagen(mapa.sampleUrl(v.sample)) : null });
  }

  /* ---- .zip mínimo (sin compresión al escribir; lee «store» y «deflate») ---- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  async function zip(files) {                      // files: [{ name, data: Uint8Array }]
    const enc = new TextEncoder(), partes = [], central = []; let off = 0;
    for (const f of files) {
      const nb = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nb.length, true);
      partes.push(new Uint8Array(h.buffer), nb, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nb);
      off += 30 + nb.length + f.data.length;
    }
    const tam = central.reduce((n, p) => n + p.length, 0), fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, files.length, true); fin.setUint16(10, files.length, true); fin.setUint32(12, tam, true); fin.setUint32(16, off, true);
    return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: 'application/zip' });
  }
  async function unzip(buf) {                      // → Map(nombre → Uint8Array)
    const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder(), out = new Map();
    let e = buf.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('No es un .zip válido');
    let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
    for (let i = 0; i < n; i++) {
      const met = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), ln = dv.getUint16(p + 28, true), lx = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const nombre = dec.decode(u8.subarray(p + 46, p + 46 + ln)); p += 46 + ln + lx + lc;
      if (nombre.endsWith('/')) continue;
      const ini = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), datos = u8.slice(ini, ini + csz);
      if (met === 0) out.set(nombre, datos);
      else if (met === 8 && typeof DecompressionStream === 'function') out.set(nombre, new Uint8Array(await new Response(new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
      else console.warn('zip: método no soportado en', nombre);
    }
    return out;
  }
  const tipoImg = n => /\.png$/i.test(n) ? 'image/png' : /\.webp$/i.test(n) ? 'image/webp' : 'image/jpeg';
  async function exportarMapeo() {
    const j = mapa.exportMapping(ctx.nombre), base = nombreArchivo(), refs = mapa.sampleRefs();
    if (!refs.length) return bajar(j, base + '.materials.json');
    const faltan = refs.filter(r => !blobs.has(r));
    const files = [{ name: base + '.materials.json', data: new TextEncoder().encode(JSON.stringify(j, null, 2)) }];
    for (const r of refs) if (blobs.has(r)) files.push({ name: r, data: new Uint8Array(await blobs.get(r).arrayBuffer()) });
    bajarBlob(await zip(files), base + '.materials.zip');
    aviso(faltan.length ? 'Exportado; faltan ' + faltan.length + ' muestras que no están en este navegador' : 'Mapeo exportado con ' + refs.length + ' muestra' + (refs.length > 1 ? 's' : ''));
  }
  async function importarZip(file) {
    const m = await unzip(await file.arrayBuffer());
    const nj = [...m.keys()].find(k => /\.json$/i.test(k) && !k.includes('/'));
    if (!nj) throw new Error('El .zip no trae el .materials.json');
    for (const [k, d] of m) if (/^samples\/.+\.(jpe?g|png|webp)$/i.test(k)) { const b = new Blob([d], { type: tipoImg(k) }); registrarMuestra(k, b); idb.guardar(k, b); }
    importarJson(JSON.parse(new TextDecoder().decode(m.get(nj))));
  }

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
  Q('#dvExportar').addEventListener('click', () => exportarMapeo().catch(err => { console.error(err); aviso('No se pudo exportar (' + (err.message || err) + ')'); }));
  Q('#dvMapa').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { if (/\.zip$/i.test(f.name)) await importarZip(f); else importarJson(JSON.parse(await f.text())); aviso('Mapeo importado'); } catch (err) { console.error(err); aviso('El archivo no es un mapeo válido'); }
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

  mapa.analyze(ctx.raicesBase); ctx.aplicarMapa(); refrescarPanel();   // en el modelo base solo se aplica lo manual (acepta)
  root.__dev = { mapa, MM, ponerModelo: ctx.ponerModelo, escenaPrueba, ejecutar, ponerBase: ctx.ponerBase, cargarArchivos, aviso, abrirDetalle, seleccionar, cerrarEditor, elegirEnVisor, ui, ctx, exportarMapeo, importarZip, unzip };
  /* Deja que se pinte primero el Modelo base; precarga FRIOX sin mostrarlo */
  if (ctx.precargarFriox) requestAnimationFrame(() => setTimeout(() => precargarFriox().catch(err => console.warn('FRIOX no disponible para precarga:', err)), 100));

  return { aviso, refrescar: refrescarPanel, alCargar: () => { web.candidates = {}; web.searched = false; } };
}

root.MaterialLab = { init };
})(window);
/* DEV:END */
