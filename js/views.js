// Vistas de la aplicación. Cada una devuelve una promesa y pinta en #view.
const $ = (s, el = document) => el.querySelector(s);
const view = () => $("#view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso) => new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (isError ? " err" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add("hidden"), 3500);
}
async function safe(fn) {
  try { return await fn(); } catch (e) { toast(e.message, true); }
}

/* ---------------- Inicio de sesión / registro ---------------- */
async function loginView() {
  let mode = "login";
  const draw = () => {
    view().innerHTML = `
      <section class="auth">
        <div class="hero"><div class="logo">📖</div><h1>Tu biblioteca física en digital</h1>
          <p class="muted">Fotografía una página, conviértela en texto editable y llévala contigo.</p></div>
        <div class="card">
          <div class="tabs"><button data-m="login" class="${mode === "login" ? "on" : ""}">Iniciar sesión</button>
            <button data-m="register" class="${mode === "register" ? "on" : ""}">Crear cuenta</button></div>
          <form id="authForm">
            ${mode === "register" ? `<label>Nombre</label><input name="name" required maxlength="80" autocomplete="name">` : ""}
            <label>Correo</label><input name="email" type="email" required autocomplete="email">
            <label>Contraseña</label><input name="password" type="password" required minlength="8" autocomplete="${mode === "login" ? "current-password" : "new-password"}">
            ${mode === "register" ? `<p class="muted" style="font-size:.85rem;margin:6px 0 0">Mínimo 8 caracteres.</p>` : ""}
            <div id="authError" class="error hidden"></div>
            <button class="btn navy" style="width:100%;margin-top:18px" id="authBtn">${mode === "login" ? "Entrar" : "Crear mi cuenta"}</button>
          </form>
        </div>
      </section>`;
    view().querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => { mode = b.dataset.m; draw(); }));
    $("#authForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const err = $("#authError"); err.classList.add("hidden");
      $("#authBtn").disabled = true;
      try {
        if (mode === "register") await Api.post("/api/auth/register", f);
        const t = await Api.post("/api/auth/login", { email: f.email, password: f.password });
        Api.token = t.access_token;
        await App.loadUser();
        location.hash = "#/library";
      } catch (ex) {
        err.textContent = ex.message; err.classList.remove("hidden");
      } finally { $("#authBtn") && ($("#authBtn").disabled = false); }
    };
  };
  draw();
}

/* ---------------- Mi biblioteca ---------------- */
async function libraryView() {
  view().innerHTML = `<div class="page-head"><div><h1>Mi biblioteca</h1><p class="muted" style="margin:0">Tus libros digitalizados, en cualquier dispositivo.</p></div>
    <button class="btn" id="newBook">+ Nuevo libro</button></div>
    <div class="card" style="margin-bottom:18px"><div class="row"><input class="grow" id="q" placeholder="Buscar una frase en todos tus libros…" aria-label="Buscar"><button class="btn ghost" id="searchBtn">Buscar</button></div>
    <div id="results"></div></div><div id="books" class="grid"></div>`;
  const load = async () => {
    const books = (await safe(() => Api.get("/api/library/books"))) || [];
    $("#books").innerHTML = books.length
      ? books.map((b) => `<a class="card book" href="#/book/${b.id}"><div class="cover">${esc(b.title)}</div>
          <div><b>${esc(b.title)}</b></div><div class="meta">${esc(b.author) || "Sin autor"} · <span class="badge">${b.page_count} pág.</span></div></a>`).join("")
      : `<div class="card empty" style="grid-column:1/-1"><div class="big">📚</div><h3>Aún no tienes libros</h3><p>Crea tu primer libro y empieza a escanear sus páginas.</p></div>`;
  };
  $("#newBook").onclick = async () => {
    const title = prompt("Título del libro:"); if (!title || !title.trim()) return;
    const author = prompt("Autor (opcional):") || "";
    await safe(async () => { await Api.post("/api/library/books", { title, author }); toast("Libro creado"); await load(); });
  };
  const search = async () => {
    const q = $("#q").value.trim(); const box = $("#results");
    if (q.length < 2) { box.innerHTML = ""; return; }
    const hits = (await safe(() => Api.get("/api/library/search?q=" + encodeURIComponent(q)))) || [];
    box.innerHTML = hits.length
      ? `<div class="pages" style="margin-top:14px">${hits.map((h) => `<a class="page-item" href="#/page/${h.page_id}"><div class="num">${h.page_number}</div>
          <div><b>${esc(h.title)}</b><p>…${esc(h.snippet)}…</p></div></a>`).join("")}</div>`
      : `<p class="muted" style="margin:14px 0 0">Sin resultados para «${esc(q)}».</p>`;
  };
  $("#searchBtn").onclick = search;
  $("#q").onkeydown = (e) => e.key === "Enter" && search();
  await load();
}

/* ---------------- Un libro ---------------- */
async function bookView(id) {
  const [book, pages] = await Promise.all([Api.get(`/api/library/books/${id}`), Api.get(`/api/library/books/${id}/pages`)]);
  view().innerHTML = `<div class="crumbs"><a href="#/library">← Mi biblioteca</a></div>
    <div class="page-head"><div><h1>${esc(book.title)}</h1><p class="muted" style="margin:0">${esc(book.author) || "Sin autor"} · ${pages.length} páginas</p></div>
      <div class="row"><a class="btn" href="#/scan?book=${book.id}">📷 Escanear página</a><button class="btn danger" id="delBook">Eliminar libro</button></div></div>
    <div class="pages">${pages.length ? pages.map((p) => `<a class="card page-item" href="#/page/${p.id}"><div class="num">${p.page_number}</div>
      <div><b>Página ${p.page_number}</b> <span class="badge">${p.source === "ocr" ? "escaneada" : p.source === "restore" ? "restaurada" : "manual"}</span><p>${esc(p.text)}</p></div></a>`).join("")
      : `<div class="card empty"><div class="big">📷</div><h3>Este libro no tiene páginas</h3><p>Toma una foto de una página para convertirla en texto.</p></div>`}</div>`;
  $("#delBook").onclick = async () => {
    if (!confirm("¿Eliminar este libro y todas sus páginas?")) return;
    await safe(async () => { await Api.del(`/api/library/books/${id}`); toast("Libro eliminado"); location.hash = "#/library"; });
  };
}

/* ---------------- Una página: leer, subrayar, editar, IA ---------------- */
async function pageView(id) {
  const page = await Api.get(`/api/library/pages/${id}`);
  const book = await Api.get(`/api/library/books/${page.book_id}`);
  let highlights = await Api.get(`/api/notes/pages/${id}/highlights`);
  let editing = false, color = "yellow", selection = null;

  const renderText = () => {
    let html = "", pos = 0;
    for (const h of [...highlights].sort((a, b) => a.start - b.start)) {
      if (h.start < pos || h.end > page.text.length) continue;
      html += esc(page.text.slice(pos, h.start)) + `<mark class="${h.color}" title="${esc(h.note)}">${esc(page.text.slice(h.start, h.end))}</mark>`;
      pos = h.end;
    }
    return html + esc(page.text.slice(pos));
  };
  const draw = () => {
    view().innerHTML = `<div class="crumbs"><a href="#/library">Mi biblioteca</a> / <a href="#/book/${book.id}">${esc(book.title)}</a></div>
      <div class="page-head"><h1>Página ${page.page_number}</h1>
        <div class="row"><button class="btn ghost" id="toggleEdit">${editing ? "Ver y subrayar" : "✏️ Editar texto"}</button><button class="btn danger" id="delPage">Eliminar</button></div></div>
      <div class="layout"><div class="card">
        ${editing ? `<textarea class="editor" id="editor">${esc(page.text)}</textarea>
          <div class="row" style="margin-top:12px"><button class="btn" id="save">Guardar cambios</button><span class="muted">Corrige lo que el OCR haya leído mal.</span></div>`
        : `<div class="toolbar"><span>Subrayar:</span>${["yellow", "green", "blue", "pink"].map((c) => `<button class="swatch ${c}" data-c="${c}" title="${c}" aria-label="Color ${c}"></button>`).join("")}
            <input id="note" placeholder="Nota (opcional)" maxlength="1000"></div>
           <div class="reader" id="reader">${renderText()}</div>
           <p class="muted" style="font-size:.85rem">Selecciona un fragmento y pulsa un color para subrayarlo.</p>`}
      </div>
      <aside>
        <div class="card"><h3>Subrayados y notas</h3><div id="hlList">${hlList()}</div></div>
        <div class="card" style="margin-top:16px"><h3>Herramientas de IA</h3>
          <div class="row"><button class="btn small" id="aiSum">Resumen</button><button class="btn small" id="aiMap">Mapa de conceptos</button><button class="btn small" id="aiRead">🔊 Leer en voz alta</button></div>
          <div id="aiOut"></div></div></aside></div>`;
    bind();
  };
  const hlList = () => highlights.length ? highlights.map((h) => `<div class="hl ${h.color}"><div>«${esc(h.snippet)}»</div>${h.note ? `<div class="note">${esc(h.note)}</div>` : ""}
      <div class="actions"><button class="linkbtn" data-note="${h.id}">Editar nota</button><button class="linkbtn" data-del="${h.id}">Quitar</button></div></div>`).join("")
    : `<p class="muted" style="margin:0">Todavía no has subrayado nada.</p>`;
  const refreshHl = async () => { highlights = await Api.get(`/api/notes/pages/${id}/highlights`); draw(); };

  const bind = () => {
    $("#toggleEdit").onclick = () => { editing = !editing; draw(); };
    $("#delPage").onclick = async () => {
      if (!confirm("¿Eliminar esta página?")) return;
      await safe(async () => { await Api.del(`/api/library/pages/${id}`); location.hash = `#/book/${book.id}`; });
    };
    if (editing) {
      $("#save").onclick = () => safe(async () => {
        const upd = await Api.put(`/api/library/pages/${id}`, { text: $("#editor").value });
        page.text = upd.text; toast("Texto guardado"); editing = false; draw();
      });
    } else {
      const reader = $("#reader");
      reader.onmouseup = reader.onkeyup = () => {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed || !reader.contains(sel.anchorNode) || !reader.contains(sel.focusNode)) { selection = null; return; }
        const r = sel.getRangeAt(0), pre = document.createRange();
        pre.selectNodeContents(reader); pre.setEnd(r.startContainer, r.startOffset);
        const start = pre.toString().length;
        selection = { start, end: start + r.toString().length };
      };
      view().querySelectorAll(".swatch").forEach((b) => {
        b.onmousedown = (e) => e.preventDefault();
        b.onclick = () => {
          color = b.dataset.c;
          if (!selection || selection.end <= selection.start) return toast("Primero selecciona un fragmento del texto", true);
          safe(async () => {
            await Api.post(`/api/notes/pages/${id}/highlights`, { ...selection, color, note: $("#note").value });
            selection = null; window.getSelection().removeAllRanges(); toast("Subrayado guardado"); await refreshHl();
          });
        };
      });
    }
    view().querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => safe(async () => { await Api.del(`/api/notes/highlights/${b.dataset.del}`); await refreshHl(); })));
    view().querySelectorAll("[data-note]").forEach((b) => (b.onclick = () => {
      const h = highlights.find((x) => x.id == b.dataset.note); const n = prompt("Nota:", h.note); if (n === null) return;
      safe(async () => { await Api.patch(`/api/notes/highlights/${h.id}`, { note: n }); await refreshHl(); });
    }));
    $("#aiSum").onclick = () => safe(async () => {
      const r = await Api.post("/api/ai/summary", { text: page.text, sentences: 3 });
      $("#aiOut").innerHTML = `<div class="panel"><b>Resumen</b><p style="margin:6px 0 0">${esc(r.summary)}</p></div>`;
    });
    $("#aiMap").onclick = () => safe(async () => {
      const m = await Api.post("/api/ai/concepts", { text: page.text, top: 8 });
      $("#aiOut").innerHTML = `<div class="panel map"><b>Mapa de conceptos</b>${conceptSvg(m)}</div>`;
    });
    $("#aiRead").onclick = () => safe(async () => {
      if (!("speechSynthesis" in window)) return toast("Tu navegador no soporta lectura en voz alta", true);
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); $("#aiRead").textContent = "🔊 Leer en voz alta"; return; }
      const r = await Api.post("/api/ai/read-aloud", { text: page.text, max_chars: 220 });
      r.chunks.forEach((c) => { const u = new SpeechSynthesisUtterance(c); u.lang = "es-CO"; speechSynthesis.speak(u); });
      $("#aiRead").textContent = "⏹ Detener lectura";
    });
  };
  draw();
}

// Mapa de conceptos: nodos en círculo y líneas según co-ocurrencia.
function conceptSvg(m) {
  if (!m.nodes.length) return `<p class="muted">No hay suficiente texto para armar el mapa.</p>`;
  const W = 420, H = 300, cx = W / 2, cy = H / 2, R = 105, maxW = Math.max(...m.nodes.map((n) => n.weight));
  const pos = {};
  m.nodes.forEach((n, i) => { const a = (2 * Math.PI * i) / m.nodes.length - Math.PI / 2; pos[n.id] = [cx + R * Math.cos(a) * 1.25, cy + R * Math.sin(a)]; });
  const edges = m.edges.map((e) => `<line x1="${pos[e.source][0]}" y1="${pos[e.source][1]}" x2="${pos[e.target][0]}" y2="${pos[e.target][1]}" stroke="#B4C6E7" stroke-width="${1 + e.weight}"/>`).join("");
  const nodes = m.nodes.map((n) => `<g><circle cx="${pos[n.id][0]}" cy="${pos[n.id][1]}" r="${9 + (11 * n.weight) / maxW}" fill="#0070C0" opacity=".9"/>
    <text x="${pos[n.id][0]}" y="${pos[n.id][1] + 30}" text-anchor="middle" font-size="11" fill="#002060">${esc(n.id)}</text></g>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa de conceptos">${edges}${nodes}</svg>`;
}

/* ---------------- Escanear ---------------- */
async function scanView(params) {
  const books = await Api.get("/api/library/books");
  view().innerHTML = `<div class="page-head"><div><h1>Escanear una página</h1><p class="muted" style="margin:0">De la foto al texto editable en segundos.</p></div></div>
    <div class="steps"><div class="step"><b>1. Elige el libro</b>Dónde se guardará la página</div><div class="step"><b>2. Toma la foto</b>Con buena luz y de frente</div>
      <div class="step"><b>3. Revisa el texto</b>Corrige lo que haga falta</div></div>
    ${books.length ? `<div class="card"><label style="margin-top:0">Libro</label>
      <select id="book">${books.map((b) => `<option value="${b.id}" ${params.get("book") == b.id ? "selected" : ""}>${esc(b.title)}</option>`).join("")}</select>
      <label>Número de página (opcional)</label><input id="pnum" type="number" min="1" placeholder="Se asigna automáticamente">
      <label>Foto de la página</label>
      <div class="drop" id="drop"><div id="preview"><div style="font-size:2.4rem">📷</div><b>Toca para tomar o elegir una foto</b><p class="muted" style="margin:4px 0 0">PNG o JPG, hasta 10 MB</p></div></div>
      <input type="file" id="file" accept="image/*" capture="environment" class="hidden">
      <button class="btn navy" id="go" style="margin-top:16px" disabled>Convertir a texto</button></div><div id="result"></div>`
    : `<div class="card empty"><div class="big">📚</div><h3>Primero crea un libro</h3><p>Necesitas un libro donde guardar la página.</p><a class="btn" href="#/library">Ir a Mi biblioteca</a></div>`}`;
  if (!books.length) return;
  let file = null;
  $("#drop").onclick = () => $("#file").click();
  $("#file").onchange = (e) => {
    file = e.target.files[0]; if (!file) return;
    $("#preview").innerHTML = `<img alt="Vista previa" src="${URL.createObjectURL(file)}"><p class="muted" style="margin:8px 0 0">${esc(file.name)}</p>`;
    $("#go").disabled = false;
  };
  $("#go").onclick = async () => {
    const btn = $("#go"); btn.disabled = true; btn.innerHTML = `<span class="spinner"></span>Leyendo la página…`;
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("book_id", $("#book").value);
      if ($("#pnum").value) fd.append("page_number", $("#pnum").value);
      const r = await Api.form("/api/scan", fd);
      $("#result").innerHTML = `<div class="card result" style="margin-top:18px"><h2>Texto reconocido</h2>
        <p><span class="badge">Confianza ${Math.round(r.ocr.confidence)} %</span> <span class="badge">Idioma ${esc(r.ocr.language)}</span></p>
        <pre>${esc(r.page.text)}</pre><div class="row"><a class="btn" href="#/page/${r.page.id}">Revisar y editar</a><a class="btn ghost" href="#/book/${r.page.book_id}">Ver el libro</a></div></div>`;
      toast("Página guardada en tu biblioteca");
    } catch (e) { toast(e.message, true); }
    finally { btn.disabled = false; btn.textContent = "Convertir a texto"; }
  };
}

/* ---------------- Respaldo ---------------- */
async function backupView() {
  const snaps = await Api.get("/api/backup/snapshots");
  const last = snaps[0];
  view().innerHTML = `<div class="page-head"><div><h1>Respaldo automático</h1><p class="muted" style="margin:0">Guarda una copia de tus libros, páginas y subrayados.</p></div>
    <button class="btn" id="mk">Crear respaldo ahora</button></div>
    <div class="status ${last ? "" : "warn"}">${last ? `✅ Último respaldo: ${fmtDate(last.created_at)}` : "⚠️ Todavía no tienes respaldos"}</div>
    <div class="card">${snaps.length ? snaps.map((s) => `<div class="snap"><div class="info"><b>Respaldo #${s.id}</b><div class="muted">${fmtDate(s.created_at)} · ${s.books} libros · ${s.pages} páginas · ${s.highlights} subrayados</div></div>
      <button class="btn ghost small" data-dl="${s.id}">Descargar</button><button class="btn small" data-rs="${s.id}">Restaurar</button><button class="btn danger small" data-rm="${s.id}">Borrar</button></div>`).join("")
      : `<div class="empty"><div class="big">☁️</div><p>Cuando crees un respaldo aparecerá aquí.</p></div>`}</div>`;
  $("#mk").onclick = () => safe(async () => { await Api.post("/api/backup/snapshots"); toast("Respaldo creado"); await backupView(); });
  view().querySelectorAll("[data-dl]").forEach((b) => (b.onclick = () => safe(async () => {
    const data = await Api.get(`/api/backup/snapshots/${b.dataset.dl}/download`);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `respaldo-biblioteca-${b.dataset.dl}.json`; a.click();
  })));
  view().querySelectorAll("[data-rs]").forEach((b) => (b.onclick = () => {
    if (!confirm("Se añadirán copias de los libros del respaldo (no se borra nada). ¿Continuar?")) return;
    safe(async () => { const r = await Api.post(`/api/backup/snapshots/${b.dataset.rs}/restore`); toast(`Restaurado: ${r.books} libros, ${r.pages} páginas, ${r.highlights} subrayados`); });
  }));
  view().querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => {
    if (!confirm("¿Borrar este respaldo?")) return;
    safe(async () => { await Api.del(`/api/backup/snapshots/${b.dataset.rm}`); await backupView(); });
  }));
}
