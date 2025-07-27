// Initialize map
const map = L.map('map').setView([41.9, -87.7], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Feature group for drawing
const drawnItems = new L.FeatureGroup().addTo(map);
const drawControl = new L.Control.Draw({
  draw: { polyline: true, polygon: false, circle: false, rectangle: false, marker: false },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

// State variables
let plannedRoute = null;
let plannedDistance = 0;
let trackLine = null;
let trackDistance = 0;
let trackLatLngs = [];
let watchId = null;

// Handle manual route drawing
map.on(L.Draw.Event.CREATED, e => {
  if (plannedRoute) drawnItems.removeLayer(plannedRoute);
  plannedRoute = e.layer;
  drawnItems.addLayer(plannedRoute);
  // Measure in meters
  plannedDistance = turf.length(plannedRoute.toGeoJSON(), { units: 'meters' });
  updateStats();
});

// Geocoding (Nominatim)
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data && data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  return null;
}

// Set start location
document.getElementById('locateBtn').addEventListener('click', async () => {
  const q = document.getElementById('startLocation').value;
  let coords;
  if (q.includes(',')) coords = q.split(',').map(Number);
  else coords = await geocode(q);
  if (!coords) { alert('Location not found'); return; }
  map.setView(coords, 15);
  L.marker(coords, {
    icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png', iconSize: [32,32] })
  }).addTo(map);
});

// Start tracking actual walk
document.getElementById('startTrackBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  trackDistance = 0;
  trackLatLngs = [];
  if (trackLine) map.removeLayer(trackLine);
  trackLine = L.polyline([], { color: '#A0522D' }).addTo(map);
  document.getElementById('stopTrackBtn').disabled = false;
  watchId = navigator.geolocation.watchPosition(onPosition, err => console.error(err), {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 10000
  });
});

// Stop tracking
document.getElementById('stopTrackBtn').addEventListener('click', () => {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  document.getElementById('stopTrackBtn').disabled = true;
});

// Called on each GPS update
function onPosition(pos) {
  const latlng = [pos.coords.latitude, pos.coords.longitude];
  trackLatLngs.push(latlng);
  trackLine.setLatLngs(trackLatLngs);
  if (trackLatLngs.length > 1) {
    const prev = trackLatLngs[trackLatLngs.length - 2];
    // measure each segment in meters
    const seg = turf.lineString([prev, latlng]);
    trackDistance += turf.length(seg, { units: 'meters' });
  }
  updateStats();
}

// Update stats display
function updateStats() {
  let txt = `Tracked: ${trackDistance.toFixed(1)} m`;
  if (plannedDistance) {
    const pct = (trackDistance / plannedDistance * 100).toFixed(1);
    txt += ` / Planned: ${plannedDistance.toFixed(1)} m (${pct}% done)`;
  }
  document.getElementById('stats').textContent = txt;
}

// TODO: Auto‑generate route by distance requires server‑side logic or routing API - implement later