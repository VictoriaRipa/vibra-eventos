const { test } = require('node:test');
const assert = require('node:assert/strict');
const { todayInBuenosAires, upcomingEvents } = require('../public-events');

test('la fecha cambia a medianoche de Buenos Aires', () => {
  assert.equal(todayInBuenosAires(new Date('2026-12-01T02:59:59Z')), '2026-11-30');
  assert.equal(todayInBuenosAires(new Date('2026-12-01T03:00:00Z')), '2026-12-01');
});

test('la agenda conserva hoy y futuras funciones, sin modificar los datos del administrador', () => {
  const events = [
    { id:'varias-fechas', occurrences:[{ date:'2026-11-29' },{ date:'2026-11-30' },{ date:'2026-12-02' }] },
    { id:'vencido', occurrences:[{ date:'2026-11-29' }] }
  ];
  const visible = upcomingEvents(events, new Date('2026-11-30T15:00:00Z'));
  assert.deepEqual(visible.map(event => event.id), ['varias-fechas']);
  assert.deepEqual(visible[0].occurrences.map(occurrence => occurrence.date), ['2026-11-30','2026-12-02']);
  assert.equal(events[0].occurrences.length, 3);
});
