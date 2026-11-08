// Tiny password gate for Caddy forward_auth (no dependencies).
// GET  /_gate/verify  -> 200 if the session cookie is valid; otherwise a redirect
//                        to the login page (HTML navigations) or 401 JSON.
// GET  /_gate/login   -> login form;  POST /_gate/login -> sets the cookie.
// GET  /_gate/logout  -> clears the cookie.
import http from "node:http";
import crypto from "node:crypto";

const PASSWORD = process.env.GATE_PASSWORD || "";
const USER = process.env.GATE_USER || "admin";
const PORT = Number(process.env.GATE_PORT || 8789);
const NAME = process.env.GATE_APP_NAME || "App";
const COOKIE = process.env.GATE_COOKIE || "railway_gate";
const MAX_AGE = 60 * 60 * 24 * 30;
if (!PASSWORD) { console.error("gate: GATE_PASSWORD is empty"); process.exit(1); }

const token = crypto.createHmac("sha256", PASSWORD).update(`${COOKIE}:${USER}:v1`).digest("hex");
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const cookies = (h) => Object.fromEntries((h || "").split(";").map(s => s.trim().split("=")).filter(p => p.length >= 2).map(([k, ...v]) => [k, v.join("=")]));
const safeNext = (n) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\")) ? n : "/";
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let failures = 0, lockedUntil = 0;

function page(res, status, next, msg) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY" });
  res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(NAME)} sign in</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f4f5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
form{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 2px 12px #0002;width:min(340px,90vw)}h1{font-size:1.2rem;margin:0 0 1rem}
label{display:block;font-size:.85rem;margin:.6rem 0 .2rem}input{width:100%;box-sizing:border-box;padding:.55rem;border:1px solid #ccc;border-radius:6px}
button{margin-top:1rem;width:100%;padding:.6rem;border:0;border-radius:6px;background:#18181b;color:#fff;font-weight:600;cursor:pointer}.e{color:#b91c1c;font-size:.85rem}</style></head>
<body><form method="post" action="/_gate/login"><h1>${esc(NAME)}</h1>${msg ? `<p class="e">${esc(msg)}</p>` : ""}
<input type="hidden" name="next" value="${esc(next)}"><label>Username</label><input name="user" value="${esc(USER)}" autocomplete="username">
<label>Password</label><input name="password" type="password" autofocus autocomplete="current-password"><button>Sign in</button></form></body></html>`);
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const secure = (req.headers["x-forwarded-proto"] || "https") === "https" ? "; Secure" : "";
  if (url.pathname === "/_gate/verify") {
    if (eq(cookies(req.headers.cookie)[COOKIE] || "", token)) { res.writeHead(200); return res.end(); }
    const uri = req.headers["x-forwarded-uri"] || "/";
    const method = req.headers["x-forwarded-method"] || "GET";
    if (method === "GET" && /text\/html/.test(req.headers.accept || "")) {
      res.writeHead(302, { Location: "/_gate/login?next=" + encodeURIComponent(safeNext(uri)), "Cache-Control": "no-store" });
      return res.end();
    }
    res.writeHead(401, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ error: "Sign in at /_gate/login first." }));
  }
  if (url.pathname === "/_gate/logout") {
    res.writeHead(302, { Location: "/_gate/login", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}` });
    return res.end();
  }
  if (url.pathname === "/_gate/login" && req.method === "GET") return page(res, 200, safeNext(url.searchParams.get("next")), "");
  if (url.pathname === "/_gate/login" && req.method === "POST") {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 8192) req.destroy(); });
    req.on("end", () => {
      const f = new URLSearchParams(body);
      const next = safeNext(f.get("next"));
      if (Date.now() < lockedUntil) return page(res, 429, next, "Too many attempts. Wait a minute and try again.");
      if (eq(f.get("user") || "", USER) && eq(f.get("password") || "", PASSWORD)) {
        failures = 0;
        res.writeHead(303, { Location: next, "Set-Cookie": `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`, "Cache-Control": "no-store" });
        return res.end();
      }
      if (++failures >= 10) { failures = 0; lockedUntil = Date.now() + 60_000; }
      setTimeout(() => page(res, 401, next, "Wrong username or password."), 500);
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORT, "127.0.0.1", () => console.log(`gate listening on 127.0.0.1:${PORT}`));
