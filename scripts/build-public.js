const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
if (path.dirname(output) !== root) throw new Error('Directorio de salida no válido.');
fs.rmSync(output, { recursive:true, force:true });
fs.mkdirSync(output);

for (const name of ['index.html','admin.html','site.js','admin.js','styles.css','polish.css','experience.css','admin.css','admin-experience.css']) {
  fs.copyFileSync(path.join(root, name), path.join(output, name));
}
fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive:true });
console.log('Archivos públicos preparados para Vercel.');
