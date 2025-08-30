// --- Config (set in Netlify env for prod) ---
const MAP_DEFAULT = { lat: 42.96, lng: -85.67 }; // change to your city
const FEATURE_PRICE_CENTS = 700; // $7.00 one-time feature

// --- Elements ---
const newBtn = document.getElementById('openNew');
const sponsorBtn = document.getElementById('becomeSponsor');
const dialog = document.getElementById('newListing');
const form = document.getElementById('newListingForm');
const mapEl = document.getElementById('map');
const listEl = document.getElementById('list');
const toastEl = document.getElementById('toast');

const qEl = document.getElementById('q');
const catEl = document.getElementById('category');
const dateEl = document.getElementById('date');
const applyBtn = document.getElementById('applyFilters');
const clearBtn = document.getElementById('clearFilters');

let map, markers = [];
let allListings = [];

function toast(msg){
  toastEl.textContent = msg;
  toastEl.hidden = false;
  setTimeout(()=> toastEl.hidden = true, 2500);
}

// --- Map init (wait until Google script loads) ---
window.initMap = () => {}; // not used; API is async-loaded

function ensureMap(){
  if(map) return map;
  map = new google.maps.Map(mapEl, {
    center: MAP_DEFAULT, zoom: 12, streetViewControl:false, mapTypeControl:false
  });
  return map;
}

async function fetchListings(){
  const res = await fetch('/.netlify/functions/get-listings');
  const data = await res.json();
  allListings = data.listings || [];
  render();
}

function applyFilters(){
  const q = (qEl.value || '').toLowerCase().trim();
  const cat = catEl.value.trim();
  const date = dateEl.value;

  return allListings.filter(l => {
    if (q && !(`${l.title} ${l.description}`.toLowerCase().includes(q))) return false;
    if (cat && l.category !== cat) return false;
    if (date && l.date !== date) return false;
    return true;
  });
}

function render(){
  ensureMap();

  // Clear markers
  for(const m of markers) m.setMap(null);
  markers = [];

  listEl.innerHTML = '';

  const filtered = applyFilters();
  const bounds = new google.maps.LatLngBounds();

  filtered
    .sort((a,b)=> (b.featured === true) - (a.featured === true) || (a.date||'').localeCompare(b.date||''))
    .forEach(l => {
      // List item
      const card = document.createElement('div');
      card.className = 'item';
      card.innerHTML = `
        <img src="${l.photoUrl || 'https://picsum.photos/seed/yard/160/160'}" alt="">
        <div>
          <h3>${l.title} ${l.featured ? '<span class="badge">Featured</span>' : ''}</h3>
          <div class="date">${l.date || ''} ${(l.timeStart||'').slice(0,5)}${l.timeEnd ? '–'+(l.timeEnd||'').slice(0,5):''}</div>
          <div class="category">${l.category}</div>
          <p>${l.description || ''}</p>
          <div class="actions">
            <button class="btn small" data-go="${l.id}">View on Map</button>
            ${l.featured ? '' : `<button class="btn small outline" data-feature="${l.id}">Feature ($${(FEATURE_PRICE_CENTS/100).toFixed(2)})</button>`}
          </div>
        </div>
      `;
      listEl.appendChild(card);

      // Marker
      if (l.lat && l.lng){
        const marker = new google.maps.Marker({
          position: {lat: l.lat, lng: l.lng},
          map, title: l.title,
          icon: l.featured ? undefined : { // smaller gray pin for non-featured
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#666', fillOpacity: 0.9,
            strokeColor:'#fff', strokeWeight:2
          }
        });
        const info = new google.maps.InfoWindow({
          content: `
            <div style="max-width:240px">
              <strong>${l.title}</strong> ${l.featured ? '⭐':''}<br/>
              <small>${l.date || ''} ${(l.timeStart||'').slice(0,5)}${l.timeEnd ? '–'+(l.timeEnd||'').slice(0,5):''}</small><br/>
              <small>${l.address || ''}</small><br/>
              <p style="margin:.3rem 0">${l.description || ''}</p>
              ${l.photoUrl ? `<img src="${l.photoUrl}" style="width:100%;border-radius:8px">` : ''}
            </div>`
        });
        marker.addListener('click', ()=> info.open({map, anchor:marker}));
        markers.push(marker);
        bounds.extend(marker.getPosition());
      }
    });

  if (filtered.length && !bounds.isEmpty()) {
    map.fitBounds(bounds);
    if(map.getZoom() > 15) map.setZoom(15);
  }

  // wire buttons
  listEl.querySelectorAll('[data-go]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-go');
      const l = filtered.find(x=>x.id===id);
      if(!l || !l.lat) return;
      map.panTo({lat:l.lat,lng:l.lng});
      map.setZoom(15);
    })
  });
  listEl.querySelectorAll('[data-feature]').forEach(btn=>{
    btn.addEventListener('click', async()=>{
      const id = btn.getAttribute('data-feature');
      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ listingId:id, amountCents: FEATURE_PRICE_CENTS })
      });
      const { url, error } = await res.json();
      if(error){ toast(error); return; }
      location.href = url;
    });
  });
}

// New listing flow
newBtn.addEventListener('click', ()=> dialog.showModal());
form.addEventListener('submit', evt => evt.preventDefault());

document.getElementById('saveListing').addEventListener('click', async ()=>{
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  if(!payload.title || !payload.address || !payload.category || !payload.date){
    toast('Please complete required fields.'); return;
  }
  // Geocode
  let lat=null, lng=null;
  try{
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({ address: payload.address });
    if(results && results[0]){
      lat = results[0].geometry.location.lat();
      lng = results[0].geometry.location.lng();
    }
  }catch(_){/* ignore */}
  const res = await fetch('/.netlify/functions/create-listing', {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ ...payload, lat, lng })
  });
  const data = await res.json();
  if(data.error){ toast(data.error); return; }
  toast('Listing published!');
  dialog.close();
  form.reset();
  await fetchListings();
});

// Filters
applyBtn.addEventListener('click', render);
clearBtn.addEventListener('click', ()=>{
  qEl.value=''; catEl.value=''; dateEl.value=''; render();
});

// Sponsor subscription
sponsorBtn.addEventListener('click', async ()=>{
  const res = await fetch('/.netlify/functions/create-subscription', { method:'POST' });
  const { url, error } = await res.json();
  if(error){ toast(error); return; }
  location.href = url;
});

// Boot
window.addEventListener('load', fetchListings);
