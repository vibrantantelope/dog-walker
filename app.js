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
let startCoords = null;
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjhhNWZmN2ZhZWIxZTRlNjA4YjA0NmE2ZGFhMWE5ZDY5IiwiaCI6Im11cm11cjY0In0=';

// Automatically center map on user's current location if permission granted
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    const coords = [pos.coords.latitude, pos.coords.longitude];
    map.setView(coords, 15);
    startCoords = coords;
    L.marker(coords, {
      icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png', iconSize: [32,32] })
    }).addTo(map);
  }, err => console.log('Geolocation error:', err));
}

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
  startCoords = coords;
  L.marker(coords, {
    icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png', iconSize: [32,32] })
  }).addTo(map);
});

// Begin planning a walk by drawing a polyline
document.getElementById('startPlanBtn').addEventListener('click', () => {
  // Clear any existing planned route
  if (plannedRoute) {
    drawnItems.removeLayer(plannedRoute);
    plannedRoute = null;
    plannedDistance = 0;
    updateStats();
  }
  // Start a new drawing session using Leaflet Draw
  new L.Draw.Polyline(map).enable();
});

// Auto-plan route using OpenRouteService
document.getElementById('autoPlanBtn').addEventListener('click', async () => {
  const dist = parseFloat(document.getElementById('walkDistance').value);
  if (!startCoords) { alert('Set start location first'); return; }
  if (!dist) { alert('Enter desired distance'); return; }
  await autoPlanRoute(startCoords, dist);
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

// Generate a circular route automatically
async function autoPlanRoute(start, targetMeters) {
  const url = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
  const requestRoute = async len => {
    const body = {
      coordinates: [[start[1], start[0]]],
      options: { round_trip: { length: len } }
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Routing request failed');
    return res.json();
  };

  try {
    let data = await requestRoute(targetMeters);
    let feature = data.features[0];
    let len = turf.length(feature, { units: 'meters' });
    if (Math.abs(len - targetMeters) > 322) {
      const adjust = targetMeters + (targetMeters - len);
      data = await requestRoute(adjust);
      feature = data.features[0];
      len = turf.length(feature, { units: 'meters' });
    }
    if (plannedRoute) drawnItems.removeLayer(plannedRoute);
    plannedRoute = L.geoJSON(feature).addTo(drawnItems);
    plannedDistance = len;
    updateStats();
    map.fitBounds(plannedRoute.getBounds());
  } catch (err) {
    console.error(err);
    alert('Could not auto-plan route');
  }
}

// Auto-planning now available using OpenRouteService
