const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readEvents, saveEvent, removeEvent } = require('./database');

const ROOT = __dirname;
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || ROOT);
const PRIVATE_DIR = path.join(STORAGE_DIR, '.data');
const AUTH_FILE = path.join(PRIVATE_DIR, 'auth.json');
const UPLOAD_DIR = path.join(STORAGE_DIR, 'uploads');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const sessions = new Map();
const loginAttempts = new Map();

fs.mkdirSync(PRIVATE_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function makeHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

let localAuth;
if (!process.env.ADMIN_PASSWORD) {
  if (fs.existsSync(AUTH_FILE)) localAuth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  else {
    const password = crypto.randomBytes(18).toString('base64url');
    localAuth = makeHash(password);
    fs.writeFileSync(AUTH_FILE, JSON.stringify(localAuth), { mode: 0o600 });
    console.log('\nCLAVE INICIAL DEL ADMINISTRADOR:', password);
    console.log('Guardala ahora. No vuelve a mostrarse. También podés definir ADMIN_PASSWORD antes de iniciar el servidor.\n');
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function validPassword(password) {
  if (typeof password !== 'string') return false;
  if (process.env.ADMIN_PASSWORD) return safeEqual(password, process.env.ADMIN_PASSWORD);
  return safeEqual(makeHash(password, localAuth.salt).hash, localAuth.hash);
}
function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function fail(res, status, message) { send(res, status, { error: message }); }
function getCookie(req, name) {
  const entry = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : '';
}
function authenticated(req) {
  const token = getCookie(req, 'vibra_session');
  const expires = sessions.get(token);
  if (!expires) return false;
  if (expires < Date.now()) { sessions.delete(token); return false; }
  return true;
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
async function readBody(req, maxBytes = 6 * 1024 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('El archivo o formulario supera el tamaño permitido.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('El formulario enviado no es JSON válido.'); }
}
function text(value, label, max = 300, required = false) {
  const result = String(value ?? '').trim();
  if (required && !result) throw new Error(`Falta ${label}.`);
  if (result.length > max) throw new Error(`${label} es demasiado largo.`);
  return result;
}
function imageUrl(value) {
  const result = text(value, 'la imagen', 500);
  if (result && !/^https:\/\//i.test(result) && !/^\/(assets|uploads)\/[a-zA-Z0-9._/-]+$/.test(result)) throw new Error('La imagen debe ser una URL HTTPS o un archivo subido.');
  return result;
}
function validateEvent(input, existingId) {
  if (!input || typeof input !== 'object') throw new Error('Faltan los datos del evento.');
  const occurrences = Array.isArray(input.occurrences) ? input.occurrences : [];
  if (!occurrences.length || occurrences.length > 30) throw new Error('Cargá entre 1 y 30 fechas por evento.');
  const normalized = {
    id: existingId || crypto.randomUUID(),
    title: text(input.title, 'el nombre', 120, true),
    category: text(input.category, 'la categoría', 50, true),
    city: text(input.city, 'la ciudad', 100, true),
    venue: text(input.venue, 'el recinto', 120, true),
    address: text(input.address, 'la dirección', 200, true),
    mapQuery: text(input.mapQuery, 'la búsqueda del mapa', 250),
    image: imageUrl(input.image),
    description: text(input.description, 'la descripción', 3000, true),
    published: Boolean(input.published),
    coordinates: null,
    occurrences: occurrences.map(item => {
      const date = text(item.date, 'la fecha', 10, true);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) throw new Error('Una fecha no tiene formato válido.');
      const time = text(item.time, 'la hora', 5);
      const doors = text(item.doors, 'la apertura', 5);
      if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('La hora debe tener formato HH:MM.');
      if (doors && !/^([01]\d|2[0-3]):[0-5]\d$/.test(doors)) throw new Error('La apertura debe tener formato HH:MM.');
      const sectors = Array.isArray(item.sectors) ? item.sectors : [];
      if (sectors.length > 100) throw new Error('Hay demasiados sectores en una fecha.');
      const normalizedSectors = sectors.map(sector => {
        const name = text(sector.name, 'el sector', 80, true);
        const quantity = Number(sector.quantity);
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000) throw new Error(`La cantidad de ${name} debe ser un entero entre 0 y 100000.`);
        const x = sector.x === '' || sector.x == null ? null : Number(sector.x);
        const y = sector.y === '' || sector.y == null ? null : Number(sector.y);
        if ((x !== null && (!Number.isFinite(x) || x < 0 || x > 100)) || (y !== null && (!Number.isFinite(y) || y < 0 || y > 100))) throw new Error(`La posición de ${name} debe estar entre 0 y 100.`);
        return { id: existingId && typeof sector.id === 'string' && sector.id.length < 80 ? sector.id : crypto.randomUUID(), name, quantity, x, y };
      });
      if (new Set(normalizedSectors.map(sector => sector.name.toLocaleLowerCase('es'))).size !== normalizedSectors.length) throw new Error(`Hay sectores repetidos en la fecha ${date}.`);
      return { id: existingId && typeof item.id === 'string' && item.id.length < 80 ? item.id : crypto.randomUUID(), date, time, doors, mapImage: imageUrl(item.mapImage), sectors: normalizedSectors };
    })
  };
  if (input.coordinates && input.coordinates.length === 2) {
    const lat = Number(input.coordinates[0]);
    const lon = Number(input.coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error('Las coordenadas del lugar no son válidas.');
    normalized.coordinates = [lat, lon];
  }
  return normalized;
}

const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp' };
function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return fail(res, 404, 'Archivo no encontrado.');
  const ext = path.extname(filePath).toLowerCase();
  if (!contentTypes[ext]) return fail(res, 404, 'Archivo no encontrado.');
  res.writeHead(200, { 'Content-Type':contentTypes[ext], 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache' });
  fs.createReadStream(filePath).pipe(res);
}
function serveStatic(res, pathname) {
  const exact = { '/':'index.html', '/index.html':'index.html', '/admin':'admin.html', '/admin.html':'admin.html', '/site.js':'site.js', '/admin.js':'admin.js', '/styles.css':'styles.css', '/polish.css':'polish.css', '/experience.css':'experience.css', '/admin.css':'admin.css', '/admin-experience.css':'admin-experience.css' };
  if (exact[pathname]) return serveFile(res, path.join(ROOT, exact[pathname]));
  const allowedDir = pathname.startsWith('/assets/') ? 'assets' : pathname.startsWith('/uploads/') ? 'uploads' : null;
  if (!allowedDir) return fail(res, 404, 'Página no encontrada.');
  let relative;
  try { relative = decodeURIComponent(pathname.slice(allowedDir.length + 2)); } catch { return fail(res, 400, 'Ruta no válida.'); }
  const base = allowedDir === 'uploads' ? UPLOAD_DIR : path.join(ROOT, allowedDir);
  const file = path.resolve(base, relative);
  if (!file.startsWith(`${base}${path.sep}`)) return fail(res, 403, 'Ruta no permitida.');
  return serveFile(res, file);
}
function saveUpload(data) {
  if (!data || typeof data.dataUrl !== 'string') throw new Error('Seleccioná una imagen.');
  const match = data.dataUrl.match(/^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Usá una imagen PNG, JPG o WebP.');
  const buffer = Buffer.from(match[3], 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 5 MB.');
  const png = buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const webp = buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP';
  if (!(match[2]==='png'&&png || match[2]==='jpeg'&&jpeg || match[2]==='webp'&&webp)) throw new Error('El contenido de la imagen no coincide con su formato.');
  const extension = match[2]==='jpeg' ? 'jpg' : match[2];
  const name = `${crypto.randomUUID()}.${extension}`;
  fs.writeFileSync(path.join(UPLOAD_DIR,name),buffer);
  return `/uploads/${name}`;
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  try {
    if (pathname === '/health' && req.method === 'GET') return send(res, 200, { ok:true });
    if (pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && !sameOrigin(req)) return fail(res, 403, 'Origen no permitido.');
      if (pathname === '/api/events' && req.method === 'GET') return send(res, 200, readEvents(true));
      if (pathname === '/api/admin/session' && req.method === 'GET') return send(res, 200, { authenticated:authenticated(req) });
      if (pathname === '/api/admin/login' && req.method === 'POST') {
        const ip = req.socket.remoteAddress || 'unknown';
        const attempt = loginAttempts.get(ip) || { count:0, until:0 };
        if (attempt.count >= 6 && attempt.until > Date.now()) return fail(res, 429, 'Demasiados intentos. Probá nuevamente en 15 minutos.');
        const body = await readBody(req, 2048);
        if (!validPassword(body.password)) {
          loginAttempts.set(ip, { count:attempt.count+1, until:Date.now()+15*60*1000 });
          return fail(res, 401, 'Clave incorrecta.');
        }
        loginAttempts.delete(ip);
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, Date.now()+12*60*60*1000);
        const secure = req.socket.encrypted || req.headers['x-forwarded-proto']==='https' ? '; Secure' : '';
        return send(res, 200, { authenticated:true }, { 'Set-Cookie':`vibra_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}` });
      }
      if (!authenticated(req)) return fail(res, 401, 'Iniciá sesión como administrador.');
      if (pathname === '/api/admin/logout' && req.method === 'POST') {
        sessions.delete(getCookie(req,'vibra_session'));
        return send(res,200,{ok:true},{'Set-Cookie':'vibra_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
      }
      if (pathname === '/api/admin/events' && req.method === 'GET') return send(res, 200, readEvents());
      if (pathname === '/api/admin/upload' && req.method === 'POST') return send(res, 201, { path:saveUpload(await readBody(req)) });
      if (pathname === '/api/admin/events' && req.method === 'POST') {
        const event = validateEvent(await readBody(req));
        saveEvent(event);
        return send(res, 201, event);
      }
      const match = pathname.match(/^\/api\/admin\/events\/([a-zA-Z0-9-]+)$/);
      if (match && (req.method === 'PUT' || req.method === 'DELETE')) {
        const existing = readEvents().find(event => event.id === match[1]);
        if (!existing) return fail(res,404,'Evento no encontrado.');
        if (req.method === 'DELETE') { removeEvent(match[1]); return send(res,200,{ok:true}); }
        const event = validateEvent(await readBody(req), match[1]);
        saveEvent(event);
        return send(res,200,event);
      }
      return fail(res,404,'Recurso no encontrado.');
    }
    if (req.method !== 'GET') return fail(res,405,'Método no permitido.');
    return serveStatic(res,pathname);
  } catch (error) {
    const isInput = /Falta |demasiado|formato|válid|permitid|Cargá|Hay |cantidad|posición|Seleccioná|Usá |imagen|sector|fecha|hora|coordenadas|entero/i.test(error.message);
    if (!isInput) console.error(error);
    return fail(res,isInput ? 400 : 500,isInput ? error.message : 'Ocurrió un error al guardar.');
  }
});

if (process.argv.includes('--reset-password')) {
  const password = crypto.randomBytes(18).toString('base64url');
  fs.writeFileSync(AUTH_FILE, JSON.stringify(makeHash(password)), { mode:0o600 });
  console.log('NUEVA CLAVE DEL ADMINISTRADOR:', password);
  process.exit(0);
}
server.listen(PORT, HOST, () => console.log(`Vibra: http://${HOST}:${PORT}  |  Administrador: http://${HOST}:${PORT}/admin`));
