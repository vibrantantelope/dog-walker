// Initialize map and basemap layers
const map = L.map('map').setView([41.9, -87.7], 13);
const baseLayers = {
  street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }),
  satellite: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles © Esri' }
  ),
  hybrid: L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/toner-hybrid/{z}/{x}/{y}.png', {
    attribution: '© Stamen'
  }),
  terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap (CC-BY-SA)'
  })
};
let currentBaseLayer = baseLayers.street.addTo(map);

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
let trackingIndicator = null;
let dogMarker = null;
const distanceOverlay = document.getElementById('distanceOverlay');
let walkPreference = 'scenic';
let autoRoutes = [];
let autoRouteIndex = -1;
// Screen wake lock to keep tracking active
let wakeLock = null;

async function acquireWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.error('Wake Lock error:', err);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (wakeLock && document.visibilityState === 'visible') {
    acquireWakeLock();
  }
});

if (typeof ORS_API_KEY === 'undefined' || !ORS_API_KEY) {
  alert('Missing OpenRouteService API key. Set ORS_API_KEY in config.js');
}

function setBasemap(name) {
  if (currentBaseLayer) {
    map.removeLayer(currentBaseLayer);
  }
  currentBaseLayer = baseLayers[name] || baseLayers.street;
  currentBaseLayer.addTo(map);
}

document.getElementById('basemapSelect').addEventListener('change', e => {
  setBasemap(e.target.value);
});

document.getElementById('walkPreference').addEventListener('change', e => {
  walkPreference = e.target.value;
});

function convertToMeters(distance, unit) {
  switch (unit) {
    case 'kilometers':
      return distance * 1000;
    case 'miles':
      return distance * 1609.34;
    case 'feet':
      return distance * 0.3048;
    case 'yards':
      return distance * 0.9144;
    default:
      return distance;
  }
}

function convertFromMeters(distance, unit) {
  switch (unit) {
    case 'kilometers':
      return distance / 1000;
    case 'miles':
      return distance / 1609.34;
    case 'feet':
      return distance / 0.3048;
    case 'yards':
      return distance / 0.9144;
    default:
      return distance;
  }
}

function displayAutoRoute(index) {
  if (index < 0 || index >= autoRoutes.length) return;
  const { feature, length } = autoRoutes[index];
  if (plannedRoute) drawnItems.removeLayer(plannedRoute);
  plannedRoute = L.geoJSON(feature).addTo(drawnItems);
  plannedDistance = length;
  autoRouteIndex = index;
  updateStats();
  map.fitBounds(plannedRoute.getBounds());
  updateNavButtons();
}

function updateNavButtons() {
  document.getElementById('prevRouteBtn').disabled = autoRouteIndex <= 0;
  document.getElementById('nextRouteBtn').disabled = autoRouteIndex >= autoRoutes.length - 1;
}

// Automatically center map on user's current location if permission granted
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    const coords = [pos.coords.latitude, pos.coords.longitude];
    map.setView(coords, 15);
    startCoords = coords;
    if (!dogMarker) {
      dogMarker = L.marker(coords, {
        icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png', iconSize: [32,32] })
      }).addTo(map);
    } else {
      dogMarker.setLatLng(coords);
    }
  }, err => console.log('Geolocation error:', err));
}

// Handle manual route drawing with route matching
map.on(L.Draw.Event.CREATED, async e => {
  if (plannedRoute) drawnItems.removeLayer(plannedRoute);
  const freehand = e.layer;
  drawnItems.addLayer(freehand);

  // Collect [lng, lat] coordinates
  let coords = freehand.getLatLngs().map(ll => [ll.lng, ll.lat]);

  // Down-sample if over ~50 points
  if (coords.length > 50) {
    const step = Math.ceil(coords.length / 50);
    const sampled = [];
    for (let i = 0; i < coords.length; i += step) sampled.push(coords[i]);
    const last = coords[coords.length - 1];
    const lastSample = sampled[sampled.length - 1];
    if (last[0] !== lastSample[0] || last[1] !== lastSample[1]) sampled.push(last);
    coords = sampled;
  }

  try {
    const res = await fetch(
      'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ORS_API_KEY
        },
        body: JSON.stringify({ coordinates: coords })
      }
    );
    if (!res.ok) throw new Error('routing failed');
    const data = await res.json();
    const feature = data.features && data.features[0];
    if (!feature) throw new Error('no route');

    drawnItems.removeLayer(freehand);
    plannedRoute = L.geoJSON(feature).addTo(drawnItems);
    plannedDistance = turf.length(feature, { units: 'meters' });
    updateStats();
    map.fitBounds(plannedRoute.getBounds());
  } catch (err) {
    console.error('Route matching error:', err);
    plannedRoute = freehand;
    plannedDistance = turf.length(plannedRoute.toGeoJSON(), { units: 'meters' });
    updateStats();
    alert('Could not match route; using drawn line.');
  }
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
  if (!dogMarker) {
    dogMarker = L.marker(coords, {
      icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616408.png', iconSize: [32,32] })
    }).addTo(map);
  } else {
    dogMarker.setLatLng(coords);
  }
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
  autoRoutes = [];
  autoRouteIndex = -1;
  updateNavButtons();
  walkPreference = document.getElementById('walkPreference').value;
  // Start a new drawing session using Leaflet Draw
  new L.Draw.Polyline(map).enable();
});

// Auto-plan route using OpenRouteService
document.getElementById('autoPlanBtn').addEventListener('click', async () => {
  const distInput = parseFloat(document.getElementById('walkDistance').value);
  const unit = document.getElementById('distanceUnit').value;
  walkPreference = document.getElementById('walkPreference').value;
  if (!startCoords) { alert('Set start location first'); return; }
  if (!distInput) { alert('Enter desired distance'); return; }
  const distMeters = convertToMeters(distInput, unit);
  const result = await autoPlanRoute(startCoords, distMeters, walkPreference);
  if (result) {
    autoRoutes.push(result);
    displayAutoRoute(autoRoutes.length - 1);
  }
});

document.getElementById('prevRouteBtn').addEventListener('click', () => {
  if (autoRouteIndex > 0) displayAutoRoute(autoRouteIndex - 1);
});

document.getElementById('nextRouteBtn').addEventListener('click', () => {
  if (autoRouteIndex < autoRoutes.length - 1) displayAutoRoute(autoRouteIndex + 1);
});

// Start tracking actual walk
document.getElementById('startTrackBtn').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocation not supported.');
  acquireWakeLock();
  trackDistance = 0;
  trackLatLngs = [];
  if (trackLine) map.removeLayer(trackLine);
  trackLine = L.polyline([], { color: '#A0522D' }).addTo(map);
  if (trackingIndicator) {
    map.removeLayer(trackingIndicator);
    trackingIndicator = null;
  }
  if (distanceOverlay) {
    distanceOverlay.classList.remove('hidden');
    distanceOverlay.textContent = '';
  }
  document.getElementById('stopTrackBtn').disabled = false;
  document.getElementById('pauseTrackBtn').disabled = false;
  document.getElementById('resumeTrackBtn').disabled = true;
  document.getElementById('saveWalkBtn').disabled = true;
  watchId = navigator.geolocation.watchPosition(onPosition, err => console.error(err), {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 10000
  });
});

// Stop tracking
document.getElementById('stopTrackBtn').addEventListener('click', () => {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  releaseWakeLock();
  if (trackingIndicator) {
    map.removeLayer(trackingIndicator);
    trackingIndicator = null;
  }
  if (distanceOverlay) distanceOverlay.classList.add('hidden');
  document.getElementById('stopTrackBtn').disabled = true;
  document.getElementById('pauseTrackBtn').disabled = true;
  document.getElementById('resumeTrackBtn').disabled = true;
  document.getElementById('saveWalkBtn').disabled = false;
});

// Pause tracking without clearing the line
document.getElementById('pauseTrackBtn').addEventListener('click', () => {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    document.getElementById('pauseTrackBtn').disabled = true;
    document.getElementById('resumeTrackBtn').disabled = false;
  }
});

// Resume tracking after a pause
document.getElementById('resumeTrackBtn').addEventListener('click', () => {
  if (!navigator.geolocation || watchId) return;
  watchId = navigator.geolocation.watchPosition(onPosition, err => console.error(err), {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 10000
  });
  document.getElementById('pauseTrackBtn').disabled = false;
  document.getElementById('resumeTrackBtn').disabled = true;
});

// Save the most recent track to localStorage
document.getElementById('saveWalkBtn').addEventListener('click', () => {
  if (trackLatLngs.length) {
    localStorage.setItem('lastWalk', JSON.stringify(trackLatLngs));
    alert('Walk saved');
  } else {
    alert('No walk to save');
  }
});

// Load the last saved walk from localStorage
document.getElementById('loadWalkBtn').addEventListener('click', () => {
  const data = localStorage.getItem('lastWalk');
  if (!data) return alert('No saved walk');
  const coords = JSON.parse(data);
  if (trackLine) map.removeLayer(trackLine);
  trackLine = L.polyline(coords, { color: '#A0522D' }).addTo(map);
  map.fitBounds(trackLine.getBounds());
});

// Clear current walk data and map overlays
document.getElementById('clearWalkBtn').addEventListener('click', () => {
  if (plannedRoute) {
    drawnItems.removeLayer(plannedRoute);
    plannedRoute = null;
  }
  if (trackLine) {
    map.removeLayer(trackLine);
    trackLine = null;
  }
  if (trackingIndicator) {
    map.removeLayer(trackingIndicator);
    trackingIndicator = null;
  }
  if (distanceOverlay) distanceOverlay.classList.add('hidden');
  plannedDistance = 0;
  trackDistance = 0;
  trackLatLngs = [];
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  releaseWakeLock();
  autoRoutes = [];
  autoRouteIndex = -1;
  updateNavButtons();
  document.getElementById('stopTrackBtn').disabled = true;
  document.getElementById('pauseTrackBtn').disabled = true;
  document.getElementById('resumeTrackBtn').disabled = true;
  document.getElementById('saveWalkBtn').disabled = true;
  updateStats();
});

// Called on each GPS update
function onPosition(pos) {
  const latlng = [pos.coords.latitude, pos.coords.longitude];
  if (!trackingIndicator) {
    trackingIndicator = L.marker(latlng, {
      icon: L.divIcon({ className: 'tracking-indicator' })
    }).addTo(map);
  } else {
    trackingIndicator.setLatLng(latlng);
  }
  if (dogMarker) {
    dogMarker.setLatLng(latlng);
  }
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
  const unit = document.getElementById('distanceUnit').value;
  const tracked = convertFromMeters(trackDistance, unit).toFixed(1);
  let txt = `Tracked: ${tracked} ${unit}`;
  if (plannedDistance) {
    const planned = convertFromMeters(plannedDistance, unit).toFixed(1);
    const pct = (trackDistance / plannedDistance * 100).toFixed(1);
    txt += ` / Planned: ${planned} ${unit} (${pct}% done)`;
    txt += ` | Pref: ${walkPreference}`;
  }
  document.getElementById('stats').textContent = txt;
  if (distanceOverlay && !distanceOverlay.classList.contains('hidden')) {
    distanceOverlay.textContent = `${tracked} ${unit}`;
  }
}

// Generate a circular route automatically
async function autoPlanRoute(start, targetMeters, preference) {
  const url = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
  console.log('Planning with preference:', preference);
  const requestRoute = async (len, seed) => {
    const points = preference === 'shortest' ? 3 : 5;
    const body = {
      coordinates: [[start[1], start[0]]],
      preference: preference === 'shortest' ? 'shortest' : 'recommended',
      options: {
        round_trip: {
          length: len,
          points,
          seed
        },
        avoid_features: ['steps', 'fords']
      }
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
    const seed = Math.floor(Math.random() * 1000000);
    let data = await requestRoute(targetMeters, seed);
    let feature = data.features[0];
    let len = turf.length(feature, { units: 'meters' });
    if (Math.abs(len - targetMeters) > 322) {
      const adjust = targetMeters + (targetMeters - len);
      data = await requestRoute(adjust, seed);
      feature = data.features[0];
      len = turf.length(feature, { units: 'meters' });
    }
    return { feature, length: len, seed };
  } catch (err) {
    console.error(err);
    alert('Could not auto-plan route');
    return null;
  }
}

// Auto-planning now available using OpenRouteService

// Mobile menu toggle
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('controls').classList.toggle('hidden');
});
