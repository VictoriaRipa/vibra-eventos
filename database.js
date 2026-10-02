const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const DATA_DIR = path.join(process.env.STORAGE_DIR || ROOT, '.data');
const DB_FILE = path.join(DATA_DIR, 'vibra.sqlite');
const LEGACY_FILE = path.join(ROOT, 'data', 'events.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE, { timeout: 5000 });
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
db.exec(`
  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    venue TEXT NOT NULL,
    address TEXT NOT NULL,
    map_query TEXT NOT NULL DEFAULT '',
    latitude REAL,
    longitude REAL,
    image TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS occurrences (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    time TEXT NOT NULL DEFAULT '',
    doors TEXT NOT NULL DEFAULT '',
    map_image TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sectors (
    id TEXT PRIMARY KEY,
    occurrence_id TEXT NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
    x REAL,
    y REAL,
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS occurrences_event_idx ON occurrences(event_id, position);
  CREATE INDEX IF NOT EXISTS sectors_occurrence_idx ON sectors(occurrence_id, position);
`);

const eventRows = db.prepare('SELECT * FROM events ORDER BY position, title');
const publicEventRows = db.prepare('SELECT * FROM events WHERE published = 1 ORDER BY position, title');
const occurrenceRows = db.prepare('SELECT * FROM occurrences ORDER BY position, date');
const sectorRows = db.prepare('SELECT * FROM sectors ORDER BY position, name');
const findEvent = db.prepare('SELECT id, position FROM events WHERE id = ?');
const nextPosition = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS value FROM events');
const putEvent = db.prepare(`INSERT INTO events (id,title,category,city,venue,address,map_query,latitude,longitude,image,description,published,position,updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,city=excluded.city,venue=excluded.venue,
  address=excluded.address,map_query=excluded.map_query,latitude=excluded.latitude,longitude=excluded.longitude,
  image=excluded.image,description=excluded.description,published=excluded.published,updated_at=CURRENT_TIMESTAMP`);
const deleteOccurrences = db.prepare('DELETE FROM occurrences WHERE event_id = ?');
const putOccurrence = db.prepare('INSERT INTO occurrences (id,event_id,date,time,doors,map_image,position) VALUES (?,?,?,?,?,?,?)');
const putSector = db.prepare('INSERT INTO sectors (id,occurrence_id,name,quantity,x,y,position) VALUES (?,?,?,?,?,?,?)');
const deleteEventRow = db.prepare('DELETE FROM events WHERE id = ?');

function readEvents(publicOnly = false) {
  const events = (publicOnly ? publicEventRows : eventRows).all().map(row => ({
    id: row.id,
    title: row.title,
    category: row.category,
    city: row.city,
    venue: row.venue,
    address: row.address,
    mapQuery: row.map_query,
    coordinates: row.latitude == null || row.longitude == null ? null : [row.latitude, row.longitude],
    image: row.image,
    description: row.description,
    published: Boolean(row.published),
    occurrences: []
  }));
  const byEvent = new Map(events.map(event => [event.id, event]));
  const byOccurrence = new Map();
  for (const row of occurrenceRows.all()) {
    const event = byEvent.get(row.event_id);
    if (!event) continue;
    const occurrence = { id:row.id, date:row.date, time:row.time, doors:row.doors, mapImage:row.map_image, sectors:[] };
    event.occurrences.push(occurrence);
    byOccurrence.set(row.id, occurrence);
  }
  for (const row of sectorRows.all()) {
    const occurrence = byOccurrence.get(row.occurrence_id);
    if (occurrence) occurrence.sectors.push({ id:row.id, name:row.name, quantity:row.quantity, x:row.x, y:row.y });
  }
  return events;
}

function saveEvent(event) {
  const previous = findEvent.get(event.id);
  const position = previous?.position ?? nextPosition.get().value;
  db.exec('BEGIN IMMEDIATE');
  try {
    putEvent.run(event.id,event.title,event.category,event.city,event.venue,event.address,event.mapQuery,
      event.coordinates?.[0] ?? null,event.coordinates?.[1] ?? null,event.image,event.description,event.published ? 1 : 0,position);
    deleteOccurrences.run(event.id);
    event.occurrences.forEach((occurrence, occurrencePosition) => {
      putOccurrence.run(occurrence.id,event.id,occurrence.date,occurrence.time,occurrence.doors,occurrence.mapImage,occurrencePosition);
      occurrence.sectors.forEach((sector, sectorPosition) => {
        putSector.run(sector.id,occurrence.id,sector.name,sector.quantity,sector.x,sector.y,sectorPosition);
      });
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return event;
}

function removeEvent(id) {
  const result = deleteEventRow.run(id);
  return result.changes > 0;
}

const migrationFlag = db.prepare("SELECT value FROM metadata WHERE key = 'legacy_imported'").get();
if (!migrationFlag) {
  if (fs.existsSync(LEGACY_FILE)) {
    const legacyEvents = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
    if (eventRows.all().length === 0) legacyEvents.forEach(saveEvent);
  }
  db.prepare("INSERT INTO metadata (key,value) VALUES ('legacy_imported','1')").run();
}

module.exports = { readEvents, saveEvent, removeEvent, DB_FILE };
