const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'vibra-hosting-test-'));
const port = String(38000 + Math.floor(Math.random() * 10000));
const base = `http://127.0.0.1:${port}`;
let child;

async function start() {
  child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, STORAGE_DIR:storage, HOST:'127.0.0.1', PORT:port, ADMIN_PASSWORD:'hosting-test-password' },
    stdio:'ignore'
  });
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {}
    if (child.exitCode !== null) throw new Error(`El servidor terminó con código ${child.exitCode}`);
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('El servidor no respondió al control de salud.');
}

async function stop() {
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
}

(async () => {
  try {
    await start();
    const events = await (await fetch(`${base}/api/events`)).json();
    assert(events.some(event => event.title === 'Omar Courtz'));
    assert(events.some(event => event.title === 'ARGENTINA VS BENIN'));
    const image = await fetch(`${base}${events.find(event => event.title === 'Omar Courtz').image}`);
    assert.equal(image.status, 200);
    const login = await fetch(`${base}/api/admin/login`, {
      method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ password:'hosting-test-password' })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const admin = await fetch(`${base}/api/admin/events`, { headers:{ cookie } });
    assert.equal(admin.status, 200);
    await stop();
    await start();
    assert.equal((await (await fetch(`${base}/api/events`)).json()).length, events.length);
    console.log('OK: base, carga inicial, imagen, administrador y reinicio.');
  } finally {
    await stop();
    const tempRoot = path.resolve(os.tmpdir());
    if (storage.startsWith(`${tempRoot}${path.sep}`) && path.basename(storage).startsWith('vibra-hosting-test-')) {
      fs.rmSync(storage, { recursive:true, force:true });
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
