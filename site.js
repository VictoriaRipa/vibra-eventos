const WHATSAPP_NUMBER = '5492326434718';
const app = document.getElementById('app');
document.getElementById('year').textContent = new Date().getFullYear();

let events = [];
const dateFmt = new Intl.DateTimeFormat('es-AR', { day:'numeric', month:'long', year:'numeric', timeZone:'America/Argentina/Buenos_Aires' });
const weekdayFmt = new Intl.DateTimeFormat('es-AR', { weekday:'long', timeZone:'America/Argentina/Buenos_Aires' });
const monthFmt = new Intl.DateTimeFormat('es-AR', { month:'short', timeZone:'America/Argentina/Buenos_Aires' });
const dayFmt = new Intl.DateTimeFormat('es-AR', { day:'2-digit', timeZone:'America/Argentina/Buenos_Aires' });
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon = name => `<svg aria-hidden="true"><use href="#icon-${name}"/></svg>`;
const dateValue = occurrence => new Date(`${occurrence.date}T12:00:00-03:00`);
const prettyDate = occurrence => `${weekdayFmt.format(dateValue(occurrence))} ${dateFmt.format(dateValue(occurrence))}`;
const totalStock = occurrence => occurrence.sectors.reduce((sum, sector) => sum + sector.quantity, 0);
const firstDate = event => [...event.occurrences].sort((a,b) => a.date.localeCompare(b.date))[0];
const whatsappUrl = message => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

async function loadEvents() {
  try {
    const response = await fetch('/api/events', { cache:'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar la agenda.');
    events = await response.json();
    route();
  } catch {
    app.innerHTML = `<section class="wrap not-found"><h1>La agenda necesita el servidor.</h1><p>Iniciá la web con <code>node server.js</code> y abrí <code>http://127.0.0.1:3000</code>.</p></section>`;
  }
}

function eventCard(event) {
  const first = firstDate(event);
  const stock = event.occurrences.reduce((sum, occurrence) => sum + totalStock(occurrence), 0);
  return `<a class="event-card" href="#/evento/${encodeURIComponent(event.id)}" aria-label="Ver ${esc(event.title)}">
    <div class="card-image">${event.image ? `<img src="${esc(event.image)}" alt="Gráfica de ${esc(event.title)}" loading="lazy"/>` : `<div class="card-placeholder">${esc(event.title)}</div>`}<span class="card-category">${esc(event.category)}</span><span class="card-date">${dayFmt.format(dateValue(first))}<span>${monthFmt.format(dateValue(first)).replace('.','').toUpperCase()}</span></span></div>
    <div class="card-body"><h3>${esc(event.title)}</h3><div class="card-meta">${icon('pin')} ${esc(event.venue)} · ${esc(event.city)}</div><p class="card-summary">${esc(event.description.split(/[.!?]/)[0])}.</p><div class="card-footer"><span>${event.occurrences.length} ${event.occurrences.length===1?'fecha':'fechas'} · ${stock ? `${stock} disponibles` : 'Sin stock'}</span><span class="round-arrow">${icon('arrow-up')}</span></div></div>
  </a>`;
}

function renderHome() {
  document.title = 'Vibra — Eventos que se sienten';
  app.innerHTML = `<section class="hero"><div class="wrap hero-grid"><div class="hero-copy"><span class="hero-kicker"><span>✳</span> Donde empiezan los buenos planes</span><h1>Hay noches que <em>vibran</em> distinto.</h1><p>Encontrá tu próximo evento, explorá el lugar y elegí cómo querés vivirlo. Así de simple.</p><div class="hero-actions"><a class="button button-lime" href="#/eventos">Explorar eventos ${icon('arrow')}</a></div></div><div class="hero-visual"><img src="https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1600&q=90" alt="Público disfrutando de un recital"/><div class="hero-sticker"><strong>100%</strong> ganas de estar ahí</div><div class="hero-visual-caption"><span>✳</span> Tu próxima historia empieza acá</div></div></div></section>
  <div class="ticker wrap" aria-hidden="true"><span>Música en vivo</span><span>✳</span><span>Experiencias</span><span>✳</span><span>Momentos únicos</span><span>✳</span><span>Buenos planes</span></div>
  <section class="section" id="eventos"><div class="wrap"><div class="section-head"><div><span class="eyebrow">La agenda</span><h2>Encontrá tu próximo plan.</h2></div><p>Elegí una fecha y consultá únicamente los sectores disponibles para esa función.</p></div><div class="browse-tools"><div class="chips" id="category-chips" aria-label="Filtrar por categoría"></div><label class="search-box">${icon('search')}<input id="event-search" type="search" placeholder="Buscar eventos o lugares..." aria-label="Buscar eventos o lugares" /></label></div><div class="event-grid" id="event-grid"></div></div></section>
  <div class="promise-band"><div class="wrap promise-inner"><span><b>✳</b> Elegí tu fecha</span><span><b>✳</b> Mirá sectores y ubicación</span><span><b>✳</b> Consultá por WhatsApp</span></div></div>
  <section class="how-section" id="como-funciona"><div class="wrap"><div class="section-head"><div><span class="eyebrow">Sin vueltas</span><h2>Tu entrada, en tres pasos.</h2></div><p>Una forma clara de encontrar tu lugar y consultar la compra.</p></div><div class="steps"><article class="step"><span class="step-number">01</span><h3>Elegí fecha</h3><p>Entrá al evento y seleccioná la función que te interesa.</p></article><article class="step"><span class="step-number">02</span><h3>Encontrá tu sector</h3><p>El plano muestra los sectores cargados para esa fecha y el stock de cada uno.</p></article><article class="step"><span class="step-number">03</span><h3>Escribinos</h3><p>WhatsApp prepara tu consulta con evento, fecha, sector y cantidad.</p></article></div></div></section>
  <div class="wrap cta-block"><div><span class="eyebrow">Estamos cerca</span><h2>¿Tenés una pregunta?</h2></div><a class="button button-lime" href="${whatsappUrl('Hola, quiero consultar por entradas y próximos eventos.')}" target="_blank" rel="noopener noreferrer">${icon('whatsapp')} Hablemos por WhatsApp</a></div>`;
  const chips = document.getElementById('category-chips');
  const categories = ['Todos', ...new Set(events.map(event => event.category))];
  chips.innerHTML = categories.map((category,index) => `<button class="chip${index===0?' active':''}" type="button" data-category="${esc(category)}" aria-pressed="${index===0}">${esc(category)}</button>`).join('');
  let category = 'Todos';
  const search = document.getElementById('event-search');
  const grid = document.getElementById('event-grid');
  function updateGrid() {
    const query = search.value.trim().toLocaleLowerCase('es');
    const matching = events.filter(event => (category==='Todos'||category===event.category) && `${event.title} ${event.venue} ${event.city}`.toLocaleLowerCase('es').includes(query));
    grid.classList.toggle('single',matching.length===1);
    grid.innerHTML = matching.length ? matching.map(eventCard).join('') : '<div class="empty-state"><h3>No encontramos ese plan</h3><p>Probá con otra búsqueda o elegí otra categoría.</p></div>';
  }
  chips.addEventListener('click', e => { const button=e.target.closest('[data-category]'); if(!button)return; category=button.dataset.category; chips.querySelectorAll('button').forEach(chip=>{const active=chip===button;chip.classList.toggle('active',active);chip.setAttribute('aria-pressed',active)}); updateGrid(); });
  search.addEventListener('input',updateGrid);
  updateGrid();
}

function venueMap(event) {
  if (!event.coordinates || event.coordinates.length!==2) return '';
  const [lat,lon] = event.coordinates;
  const bbox = [lon-.006,lat-.004,lon+.006,lat+.004].join(',');
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.mapQuery || `${lat},${lon}`)}`;
  return `<section class="detail-section"><span class="eyebrow">Ubicación</span><h2>Cómo llegar.</h2><p class="map-intro">Encontrá el lugar y abrí la ruta desde donde estés.</p><div class="location-card"><iframe title="Mapa de ${esc(event.venue)}" src="${embed}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><div class="location-details"><div><strong>${esc(event.venue)}</strong><span>${esc(event.address)}</span></div><a class="button button-outline" href="${directions}" target="_blank" rel="noopener noreferrer">Cómo llegar ${icon('arrow-up')}</a></div></div></section>`;
}

function renderDetail(event) {
  document.title = `${event.title} — Vibra`;
  const first = firstDate(event);
  app.innerHTML = `
    <section class="detail-hero detail-hero-new">
      ${event.image ? `<img src="${esc(event.image)}" alt="Gráfica de ${esc(event.title)}"/>` : ''}
      <div class="wrap detail-hero-content">
        <a class="back-link" href="#/eventos">${icon('arrow')} Todos los eventos</a>
        <span class="detail-tag">${esc(event.category)}</span>
        <h1>${esc(event.title)}</h1>
        <div class="detail-hero-meta">
          <span>${icon('calendar')} ${event.occurrences.length} ${event.occurrences.length===1?'fecha':'fechas'} disponibles</span>
          <span>${icon('pin')} ${esc(event.venue)}, ${esc(event.city)}</span>
        </div>
      </div>
    </section>
    <div class="wrap event-shell">
      <div class="journey-intro">
        <div><span class="eyebrow">Entradas disponibles</span><h2>Elegí tu lugar en 3 pasos.</h2></div>
        <p>Primero la fecha, después el sector. Te llevamos a WhatsApp con tu selección lista para consultar.</p>
      </div>
      <div class="journey-panel">
        <section class="journey-step" id="step-date">
          <header class="journey-step-head"><span class="journey-number">01</span><div><h3>Elegí la fecha</h3><p>El stock cambia según la función.</p></div></header>
          <div class="date-tabs" id="date-tabs"></div>
        </section>
        <section class="journey-step" id="step-sector">
          <header class="journey-step-head"><span class="journey-number">02</span><div><h3>Elegí el sector</h3><p>El plano y la lista corresponden a la fecha seleccionada.</p></div></header>
          <div class="seat-choice-grid"><div id="sector-map"></div><div class="sector-picker"><span class="field-label">Sectores con stock</span><div class="sector-options" id="sector-options"></div><p>Marcamos en el plano únicamente los sectores cargados para esta función.</p></div></div>
        </section>
        <section class="journey-step" id="step-consult">
          <header class="journey-step-head"><span class="journey-number">03</span><div><h3>Revisá y consultá</h3><p>La disponibilidad final se confirma por WhatsApp.</p></div></header>
          <div class="checkout-grid"><div class="choice-summary"><small>Tu selección</small><strong id="selected-date"></strong><span id="selected-sector-label"></span></div><div class="checkout-actions"><div class="quantity-row"><span class="field-label">Cantidad de entradas</span><div class="quantity-control"><button type="button" id="qty-minus" aria-label="Restar una entrada">−</button><span id="quantity" aria-live="polite">1</span><button type="button" id="qty-plus" aria-label="Sumar una entrada">+</button></div></div><a class="button button-purple" id="book-link" target="_blank" rel="noopener noreferrer">${icon('whatsapp')} Consultar por WhatsApp</a><p>La consulta no reserva entradas ni descuenta stock.</p></div></div>
        </section>
      </div>
      <div class="more-grid"><section class="detail-section about-event"><span class="eyebrow">Sobre el evento</span><h2>Una noche para recordar.</h2><div class="detail-description">${esc(event.description).split(/\n+/).map(p=>`<p>${p}</p>`).join('')}</div><div class="info-strip"><span class="info-pill">${icon('pin')} ${esc(event.venue)}</span><span class="info-pill">${icon('calendar')} Desde ${dateFmt.format(dateValue(first))}</span></div></section>${venueMap(event)}</div>
    </div>`;

  let selectedOccurrence = [...event.occurrences].sort((a,b)=>a.date.localeCompare(b.date))[0];
  let selectedSectorId = selectedOccurrence.sectors.find(sector=>sector.quantity>0)?.id || null;
  let quantity = 1;
  const dateTabs = document.getElementById('date-tabs');
  const mapContainer = document.getElementById('sector-map');
  const options = document.getElementById('sector-options');
  const qtyEl = document.getElementById('quantity');
  const bookingLink = document.getElementById('book-link');

  function renderSelection() {
    dateTabs.innerHTML = [...event.occurrences].sort((a,b)=>a.date.localeCompare(b.date)).map(occurrence=>`<button type="button" class="date-tab${occurrence.id===selectedOccurrence.id?' active':''}" data-date-id="${esc(occurrence.id)}" aria-pressed="${occurrence.id===selectedOccurrence.id}"><span>${dayFmt.format(dateValue(occurrence))} ${monthFmt.format(dateValue(occurrence)).replace('.','').toUpperCase()}</span><small>${totalStock(occurrence)} disponibles</small></button>`).join('');
    const mapImage = selectedOccurrence.mapImage;
    mapContainer.innerHTML = mapImage ? `<div class="seat-map real-map"><div class="real-map-canvas"><img src="${esc(mapImage)}" alt="Plano de sectores para ${esc(event.title)} el ${esc(prettyDate(selectedOccurrence))}"/>${selectedOccurrence.sectors.filter(sector=>sector.x!=null&&sector.y!=null).map(sector=>`<button class="map-marker${sector.id===selectedSectorId?' active':''}" type="button" style="left:${Number(sector.x)}%;top:${Number(sector.y)}%" data-sector-id="${esc(sector.id)}" aria-label="${esc(sector.name)}: ${sector.quantity} disponibles" ${sector.quantity===0?'disabled':''}>${sector.quantity}</button>`).join('')}</div><p class="map-note">Los números sobre el plano muestran nuestro stock por sector. La ubicación exacta se confirma al consultar.</p></div>` : '<div class="no-map">El plano para esta fecha todavía no fue cargado. Podés elegir un sector desde la lista.</div>';
    options.innerHTML = selectedOccurrence.sectors.length ? selectedOccurrence.sectors.map(sector=>`<button type="button" class="sector-option${sector.id===selectedSectorId?' active':''}" data-sector-id="${esc(sector.id)}" aria-pressed="${sector.id===selectedSectorId}" ${sector.quantity===0?'disabled':''}><span class="sector-left"><span class="radio-circle"></span>${esc(sector.name)}</span><small>${sector.quantity===0?'Agotado':`${sector.quantity} disponibles`}</small></button>`).join('') : '<p class="no-stock">No hay sectores cargados para esta fecha.</p>';
    document.getElementById('selected-date').textContent = `${prettyDate(selectedOccurrence)}${selectedOccurrence.time ? ` · ${selectedOccurrence.time} hs` : ''}`;
    const sector = selectedOccurrence.sectors.find(item=>item.id===selectedSectorId && item.quantity>0);
    document.getElementById('selected-sector-label').textContent = sector ? `${sector.name} · ${event.venue}` : 'Sin sectores disponibles';
    const max = sector?.quantity || 0;
    quantity = max ? Math.min(Math.max(quantity,1),max) : 1;
    qtyEl.textContent = quantity;
    document.getElementById('qty-minus').disabled = !sector || quantity<=1;
    document.getElementById('qty-plus').disabled = !sector || quantity>=max;
    if (sector) {
      bookingLink.href = whatsappUrl(`Hola, quiero consultar por ${quantity} ${quantity===1?'entrada':'entradas'} para ${event.title} el ${dateFmt.format(dateValue(selectedOccurrence))}${selectedOccurrence.time?` a las ${selectedOccurrence.time}`:''} en ${event.venue}, sector ${sector.name}. ¿Hay disponibilidad y cuáles son las formas de pago?`);
      bookingLink.removeAttribute('aria-disabled');
      bookingLink.removeAttribute('tabindex');
    } else {
      bookingLink.removeAttribute('href');
      bookingLink.setAttribute('aria-disabled','true');
      bookingLink.setAttribute('tabindex','-1');
    }
  }
  dateTabs.addEventListener('click', e => { const button=e.target.closest('[data-date-id]'); if(!button)return; selectedOccurrence=event.occurrences.find(item=>item.id===button.dataset.dateId); selectedSectorId=selectedOccurrence.sectors.find(sector=>sector.quantity>0)?.id||null; quantity=1; renderSelection(); });
  app.querySelector('.journey-panel').addEventListener('click',e=>{ const button=e.target.closest('[data-sector-id]'); if(!button||button.disabled)return; selectedSectorId=button.dataset.sectorId; quantity=1; renderSelection(); });
  document.getElementById('qty-minus').addEventListener('click',()=>{quantity=Math.max(1,quantity-1);renderSelection();});
  document.getElementById('qty-plus').addEventListener('click',()=>{const sector=selectedOccurrence.sectors.find(item=>item.id===selectedSectorId);quantity=Math.min(sector?.quantity||1,quantity+1);renderSelection();});
  renderSelection();
}

function route() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/evento/')) {
    const id = decodeURIComponent(hash.slice('#/evento/'.length));
    const event = events.find(item=>item.id===id);
    if (event) renderDetail(event); else renderNotFound();
  } else renderHome();
  if (hash==='#/eventos') document.getElementById('eventos')?.scrollIntoView();
  else if (hash==='#/como-funciona') document.getElementById('como-funciona')?.scrollIntoView();
  else window.scrollTo(0,0);
  document.getElementById('mobile-nav').hidden = true;
  document.getElementById('menu-toggle').setAttribute('aria-expanded','false');
}
function renderNotFound(){ document.title='Evento no encontrado — Vibra';app.innerHTML=`<div class="wrap not-found"><h1>Este evento no aparece.</h1><p>Volvé a la agenda para encontrar tu próximo plan.</p><a class="button button-purple" href="#/eventos">Ver eventos ${icon('arrow')}</a></div>`; }
document.getElementById('menu-toggle').addEventListener('click',()=>{const nav=document.getElementById('mobile-nav');nav.hidden=!nav.hidden;document.getElementById('menu-toggle').setAttribute('aria-expanded',String(!nav.hidden));});
window.addEventListener('hashchange',route);
loadEvents();
