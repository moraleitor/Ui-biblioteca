// Cliente mínimo para hablar con el gateway.
const TOKEN_KEY = "biblioteca_token";

const Api = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  set token(v) { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); },

  async request(method, path, body, isForm = false) {
    const headers = {};
    if (this.token) headers.Authorization = "Bearer " + this.token;
    if (body && !isForm) headers["Content-Type"] = "application/json";
    let res;
    try {
      res = await fetch(window.API_URL + path, {
        method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      });
    } catch (e) {
      throw new Error("No se pudo conectar con el servidor. ¿Está encendido el backend?");
    }
    if (res.status === 401 && this.token) { this.token = null; location.hash = "#/login"; }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const d = data.detail;
      const msg = Array.isArray(d) ? d.map((x) => x.msg).join(". ") : d || "Algo salió mal";
      throw new Error(msg);
    }
    return data;
  },
  get: (p) => Api.request("GET", p),
  post: (p, b) => Api.request("POST", p, b),
  put: (p, b) => Api.request("PUT", p, b),
  patch: (p, b) => Api.request("PATCH", p, b),
  del: (p) => Api.request("DELETE", p),
  form: (p, fd) => Api.request("POST", p, fd, true),
};
