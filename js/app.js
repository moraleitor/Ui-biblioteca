// Enrutador sencillo basado en el hash de la URL.
const App = {
  user: null,
  async loadUser() { this.user = await Api.get("/api/auth/me"); $("#userName").textContent = this.user.name; },
  async route() {
    const [path, qs] = (location.hash || "#/library").slice(1).split("?");
    const params = new URLSearchParams(qs || "");
    const parts = path.split("/").filter(Boolean);
    const name = parts[0] || "library";
    const loggedIn = !!Api.token;
    $("#topbar").classList.toggle("hidden", !loggedIn);
    if (!loggedIn && name !== "login") { location.hash = "#/login"; return; }
    if (loggedIn && name === "login") { location.hash = "#/library"; return; }
    if (loggedIn && !this.user) { try { await this.loadUser(); } catch { Api.token = null; location.hash = "#/login"; return; } }
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.nav === (name === "book" || name === "page" ? "library" : name)));
    window.scrollTo(0, 0);
    if (window.speechSynthesis) speechSynthesis.cancel();
    try {
      if (name === "login") await loginView();
      else if (name === "library") await libraryView();
      else if (name === "book") await bookView(parts[1]);
      else if (name === "page") await pageView(parts[1]);
      else if (name === "scan") await scanView(params);
      else if (name === "backup") await backupView();
      else location.hash = "#/library";
    } catch (e) {
      view().innerHTML = `<div class="card empty"><div class="big">😕</div><h3>No pudimos cargar esta pantalla</h3><p>${esc(e.message)}</p><a class="btn" href="#/library">Volver al inicio</a></div>`;
    }
  },
};
$("#logout").onclick = () => { Api.token = null; App.user = null; location.hash = "#/login"; };
window.addEventListener("hashchange", () => App.route());
App.route();
