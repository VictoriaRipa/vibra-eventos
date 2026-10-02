const { neon } = require('@neondatabase/serverless');
const seedEvents = require('./data/events.json');

if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL para la base de eventos.');
const sql = neon(process.env.DATABASE_URL);
let initialization;

async function ensureReady() {
  if (!initialization) initialization = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS vibra_events (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      published BOOLEAN NOT NULL DEFAULT false,
      position INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS vibra_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    const seeded = await sql`SELECT value FROM vibra_metadata WHERE key = 'seeded'`;
    if (seeded.length) return;
    for (let index = 0; index < seedEvents.length; index++) {
      const event = seedEvents[index];
      await sql`INSERT INTO vibra_events (id, payload, published, position)
        VALUES (${event.id}, ${JSON.stringify(event)}::jsonb, ${Boolean(event.published)}, ${index})
        ON CONFLICT (id) DO NOTHING`;
    }
    await sql`INSERT INTO vibra_metadata (key, value) VALUES ('seeded', '1') ON CONFLICT (key) DO NOTHING`;
  })().catch(error => { initialization = null; throw error; });
  return initialization;
}

async function readEvents(publicOnly = false) {
  await ensureReady();
  const rows = publicOnly
    ? await sql`SELECT payload FROM vibra_events WHERE published = true ORDER BY position, id`
    : await sql`SELECT payload FROM vibra_events ORDER BY position, id`;
  return rows.map(row => row.payload);
}

async function saveEvent(event) {
  await ensureReady();
  const positionRows = await sql`SELECT COALESCE(MAX(position), -1) + 1 AS value FROM vibra_events`;
  await sql`INSERT INTO vibra_events (id, payload, published, position)
    VALUES (${event.id}, ${JSON.stringify(event)}::jsonb, ${Boolean(event.published)}, ${positionRows[0].value})
    ON CONFLICT (id) DO UPDATE SET payload = excluded.payload,
      published = excluded.published, updated_at = now()`;
  return event;
}

async function removeEvent(id) {
  await ensureReady();
  const rows = await sql`DELETE FROM vibra_events WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

module.exports = { readEvents, saveEvent, removeEvent };
