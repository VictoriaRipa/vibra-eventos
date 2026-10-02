const fs = require('node:fs');
const path = require('node:path');
const { readEvents } = require('../database');

const root = path.resolve(__dirname, '..');
const uploadDir = path.join(process.env.STORAGE_DIR || root, 'uploads');
const assetDir = path.join(root, 'assets');
const events = readEvents();

function includeImage(value) {
  if (!value?.startsWith('/uploads/')) return value;
  const name = path.basename(value);
  const source = path.join(uploadDir, name);
  if (!fs.existsSync(source)) throw new Error(`Falta la imagen ${source}`);
  const targetName = `seed-${name}`;
  fs.copyFileSync(source, path.join(assetDir, targetName));
  return `/assets/${targetName}`;
}

for (const event of events) {
  event.image = includeImage(event.image);
  for (const occurrence of event.occurrences) occurrence.mapImage = includeImage(occurrence.mapImage);
}

fs.writeFileSync(path.join(root, 'data', 'events.json'), `${JSON.stringify(events, null, 2)}\n`);
console.log(`Exportados ${events.length} eventos y sus imágenes locales a la carga inicial.`);
