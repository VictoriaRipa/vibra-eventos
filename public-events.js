const buenosAiresDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function todayInBuenosAires(now = new Date()) {
  const parts = Object.fromEntries(buenosAiresDate.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function upcomingEvents(events, now = new Date()) {
  const today = todayInBuenosAires(now);
  return events.map(event => ({
    ...event,
    occurrences: event.occurrences.filter(occurrence => occurrence.date >= today)
  })).filter(event => event.occurrences.length > 0);
}

module.exports = { todayInBuenosAires, upcomingEvents };
