if (!Object.fromEntries) {
  Object.fromEntries = function (iterable) {
    return Array.prototype.slice.call(iterable).reduce(function (obj, pair) {
      obj[pair[0]] = pair[1];
      return obj;
    }, {});
  };
}

const originalWarn = console.warn;
console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Image') && args[0].includes('could not be loaded')) {
        return; 
    }

    // Allow other warnings through
    originalWarn(...args);
};

import { LayerControl } from 'https://unpkg.com/maplibre-gl-layer-control@0.17.4/dist/index.mjs';
let map;

async function fetchGeoJsonFiles(files) {
  try {
    const requestPromises = files.map(file => fetch(`/data/${file}.geojson`));
    const responses = await Promise.all(requestPromises);

    const data = await Promise.all(responses.map(async (res, index) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const featureJson = await res.json();
      if (featureJson && featureJson.features) {
        featureJson.features.forEach(f => {
          if (!f.properties) f.properties = {};
          let primaryTag = '';
          if (f.properties.tags) {
            primaryTag = f.properties.tags.split(',')[0].trim().toLowerCase();
          } else if (f.properties.class) {
            primaryTag = f.properties.class.toLowerCase();
          } else if (files[index] === 'parking') {
            primaryTag = 'parking';
          } else {
            primaryTag = files[index];
          }
          f.properties.primary_tag = primaryTag;
        });
      }
      return {[files[index]]: featureJson};
    }));

    return Object.fromEntries(data.map(obj => Object.entries(obj)[0]));
  } catch (error) {
    console.error("One or more requests failed:", error);
  }
}
let collections;
(async () => {
  const geojsonfiles = ['parking', 'establishments', 'recreation'];
  collections = await fetchGeoJsonFiles(geojsonfiles);

function waitForElement(selector) {
  return new Promise(resolve => {
    // Check if it already exists
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }

    // Otherwise, watch for it to be added
    const observer = new MutationObserver(mutations => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

function isMobileDevice() {
  // Check for modern UA-CH API first
  if (navigator.userAgentData) {
    return navigator.userAgentData.mobile ? true : false;
  }
  
  // Fallback 1: Media Queries for pointer type (Reliable for UI intent)
  if (window.matchMedia("(pointer: coarse)").matches) {
    return true;
  }

  // Fallback 2: Legacy UA string check (Use as a last resort)
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone/i.test(ua)) {
    return true;
  }

  return false;
}

const params = new URLSearchParams(window.location.search);
const showParams = params.get('show') ? params.get('show').toLowerCase().split(',') : [];
const hideParams = params.get('hide') ? params.get('hide').toLowerCase().split(',') : [];
let imageryProvider = (params.get('imagery') || 'njgin').toLowerCase();
if (imageryProvider !== 'esri' && imageryProvider !== 'njgin') {
    imageryProvider = 'njgin';
}
//console.log(hideParams);

// Interaction gate for initial clean boot load (WCAG / UX quality)
let hasInteracted = false;

// Tour feature state
let activeTourName = null;
let tourActive = false;
let tourFeatures = [];
let tourIndex = 0;
let tourIntervalId = null;

let updateUrlParams = () => {};
let syncMapStyleState = () => {};
let setImageryProvider = () => {};

// Quick Views state
let activeQuickView = null;

function sanitizeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  let clean = str.replace(/<\/?(script|iframe|object|embed|applet|link|form|svg|math|meta|base)[^>]*>/gi, '');
  clean = clean.replace(/\s+on\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '');
  clean = clean.replace(/(href|src)\s*=\s*(['"])\s*(javascript|vbscript|data):/gi, '$1=$2about:invalid#');
  return clean;
}

const DEFAULT_MAP_TAXONOMIES = {
  categories: {
    'safety': { tags: ['safety', 'police station', 'fire station', 'police'] },
    'nightlife': { tags: ['brewery', 'bar', 'pub', 'nightlife', 'craft beer', 'liquor store', 'wine', 'beer', 'spirits'] },
    'food': { tags: ['restaurant', 'dining', 'food', 'cafe', 'banquet hall', 'event space', 'diner', 'bakery', 'sweets', 'take out', 'takeout', 'bbq', 'dessert', 'cookie cakes', 'cookies', 'pizza', 'italian', 'mexican', 'puerto rican', 'shakes', 'bowls', 'coffee', 'breakfast', 'lunch', 'dinner', 'deli', 'hoagies', 'sandwiches', 'seafood', 'juice bar', 'smoothies'] },
    'wellness': { tags: ['wellness', 'fitness', 'yoga', 'tai chi', 'health', 'umaa', 'salon', 'hair styling', 'barber', 'barbershop', 'kickboxing', 'karate', 'jujitsu', 'doctor', 'gym', 'gymnastics', 'personal training'] },
    'shop': { tags: ['convenience store', 'retail', 'groceries', 'shop', 'appliances', 'smoke shop', 'tobacco', 'supermarket', 'collectibles', 'bait', 'provisions', 'lottery'] },
    'services': { tags: ['laundry', 'service', 'services', 'laundromat', 'locksmith', 'key duplication', 'tax prep', 'bookkeeping', 'it management', 'cloud services', 'bail bonds', 'bank', 'atm', 'home insurance', 'professional', 'photography', 'real estate', 'property management', 'hospitality', 'consulting', 'business services', 'financial', 'funeral home', 'human services', 'union', 'cleaning', 'disaster restoration', 'telecommunications'] },
    'public': { tags: ['borough offices', 'public resource', 'government', 'library', 'community', 'post office', 'education', 'public elementary school', 'pre-kindergarten school', 'pk-6', 'mail', 'packages', 'po boxes', 'senior center', 'public', 'daycare', 'child care'] },
    'autos': { tags: ['auto repair', 'dealership', 'mechanic', 'mechanic service', 'auto service', 'oil change', 'used cars', 'new cars', 'car wash', 'detailing', 'performance tuning', 'car insurance', 'automotive'] },
    'recreation': { tags: ['park', 'recreation', 'walking path', 'walkingpath', 'entertainment'] },
    'parking': { tags: ['parking', 'free'] },
    'home-business': { tags: ['home-business', 'web design', 'software', 'bookkeeping', 'finance', 'crafts', 'candles', 'tutoring', 'education', 'gardening', 'landscaping', 'music', 'piano', 'voice lessons', 'pet sitting', 'dog walking'] },
    'industrial': { tags: ['industrial', 'manufacturing', 'machining', 'metal fab', 'logistics', 'warehousing', 'distribution', 'building materials', 'wholesale', 'auto body', 'collision repair', 'commercial printing', 'publishing', 'hvac', 'packaging', 'shipping boxes', 'contractors', 'carpentry', 'flooring', 'plumbing', 'fence', 'machinery', 'environmental', 'pest control', 'lawn care', 'outdoor', 'textiles', 'apparel', 'upholstery', 'medical supplies', 'custom framing'] },
    'boating': { tags: ['marine', 'boating', 'boat sales', 'marina', 'boat club', 'yacht club', 'power boat', 'boating & marine'] }
  },
  views: {
    'all': { title: 'All Listings', categories: ['safety', 'nightlife', 'food', 'wellness', 'shop', 'services', 'public', 'autos', 'recreation', 'parking', 'home-business', 'industrial', 'boating'] },
    'walkup': { title: 'Walk-Up & Retail', categories: ['food', 'nightlife', 'shop'] },
    'industrial': { title: 'Industrial & Trade', categories: ['industrial'] },
    'services': { title: 'Services & Pro', categories: ['services', 'home-business', 'wellness'] },
    'public': { title: 'Parks & Public', categories: ['public', 'safety', 'recreation'] },
    'automarine': { title: 'Auto & Marine', categories: ['autos', 'boating'] },
    'parking': { title: 'Parking', categories: ['parking'] }
  }
};

let DIRECTORY_VIEWS = DEFAULT_MAP_TAXONOMIES.views;
let TAG_TO_CATEGORY_MAP = {};

function initMapTaxonomies(data) {
  if (!data || !data.categories) return;
  if (data.views) DIRECTORY_VIEWS = data.views;
  TAG_TO_CATEGORY_MAP = {};
  Object.entries(data.categories).forEach(([catKey, cat]) => {
    if (cat && Array.isArray(cat.tags)) {
      cat.tags.forEach(tag => {
        TAG_TO_CATEGORY_MAP[tag.toLowerCase().trim()] = catKey;
      });
    }
  });
}

// Initialize with defaults
initMapTaxonomies(DEFAULT_MAP_TAXONOMIES);

// Asynchronously load external taxonomies if available
if (typeof fetch === 'function') {
  fetch('/data/taxonomies.json')
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data && data.categories) {
        initMapTaxonomies(data);
      }
    })
    .catch(() => {});
}


function getFeatureCategory(f) {
  if (!f || !f.properties) return null;
  let primTag = '';
  if (f.properties.primary_tag) {
    primTag = f.properties.primary_tag.toLowerCase();
  } else if (f.properties.tags) {
    primTag = f.properties.tags.split(',')[0].trim().toLowerCase();
  } else if (f.properties.class) {
    primTag = f.properties.class.toLowerCase();
  } else if (f._source) {
    primTag = f._source.toLowerCase();
  }

  if (TAG_TO_CATEGORY_MAP[primTag]) return TAG_TO_CATEGORY_MAP[primTag];
  if (f._source && TAG_TO_CATEGORY_MAP[f._source]) return TAG_TO_CATEGORY_MAP[f._source];
  return f._source || null;
}

let applyQuickView = () => {};

const LAYER_ID_MAP = {
  'parking': 'custom-parking-fill',
  'establishments': 'custom-markers',
  'recreation': 'park-layer-fill',
  'satellite': 'satellite-layer',
  'map': 'Background',
  'labels': 'map-labels'
};

const FOCUS_PRESETS = {
  'parking': {
    visible: ['parking', 'map', 'satellite', 'labels'],
    hidden: ['establishments', 'recreation'],
    label: 'Parking'
  },
  'establishments': {
    visible: ['establishments', 'map', 'satellite', 'labels'],
    hidden: ['parking', 'recreation'],
    label: 'Establishments'
  },
  'recreation': {
    visible: ['recreation', 'map', 'satellite', 'labels'],
    hidden: ['parking', 'establishments'],
    label: 'Recreation'
  }
};

const layerStates = {
  'custom-parking-fill': { visible: true, opacity: 0.3, name: 'Parking' },
  'custom-markers': { visible: true, opacity: 1, name: 'Establishments' },
  'park-layer-fill': { visible: true, opacity: 0.3, name: 'Recreation' },
  'satellite-layer': { visible: true, opacity: 0.3, name: 'Satellite' },
  'Background': { visible: true, opacity: 1, name: 'Map' },
  'map-labels': { visible: true, opacity: 1, name: 'Labels' }
};

// Apply URL overrides
const focusParam = params.get('focus') ? params.get('focus').toLowerCase().trim() : null;

// 1. Apply focus preset if specified
if (focusParam && FOCUS_PRESETS[focusParam]) {
  const preset = FOCUS_PRESETS[focusParam];
  preset.visible.forEach(friendly => {
    const layerId = LAYER_ID_MAP[friendly];
    if (layerId && layerStates[layerId]) layerStates[layerId].visible = true;
  });
  preset.hidden.forEach(friendly => {
    const layerId = LAYER_ID_MAP[friendly];
    if (layerId && layerStates[layerId]) layerStates[layerId].visible = false;
  });
}

// 2. Apply explicit hide deltas
if (hideParams.includes('all')) {
  ['parking', 'establishments', 'recreation'].forEach(friendly => {
    const layerId = LAYER_ID_MAP[friendly];
    if (layerId && layerStates[layerId]) layerStates[layerId].visible = false;
  });
}
hideParams.forEach(friendly => {
  if (friendly === 'all') return;
  const layerId = LAYER_ID_MAP[friendly];
  if (layerId && layerStates[layerId]) {
    layerStates[layerId].visible = false;
  }
});

// 3. Apply explicit show deltas (strictly additive)
showParams.forEach(friendly => {
  const layerId = LAYER_ID_MAP[friendly];
  if (layerId && layerStates[layerId]) {
    layerStates[layerId].visible = true;
  }
});

// 4. Enforce at least one background layer is visible initially
if (!layerStates['Background'].visible && !layerStates['satellite-layer'].visible) {
  layerStates['Background'].visible = true;
}

// Track user category overlay preferences so toggling Labels off/on never destroys user selections
const userOverlayPreferences = {
  'custom-parking-fill': layerStates['custom-parking-fill'].visible,
  'custom-markers': layerStates['custom-markers'].visible,
  'park-layer-fill': layerStates['park-layer-fill'].visible
};


const bounds = [-75.25794564779246, 39.75364908034561, -75.00289227019784, 39.98850386620689];


try {
  const styleResponse = await fetch('welcome_to_westville.json');
  const style = await styleResponse.json();

  const labelLayers = [
      'waterway_line_label', 'water_name_point_label', 'water_name_line_label',
      'highway-name-path', 'highway-name-minor', 'highway-name-major',
      'highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us',
      'airport', 'label_other', 'label_village', 'label_town',
      'label_state', 'label_city', 'label_city_capital',
      'label_country_3', 'label_country_2', 'label_country_1'
  ];

  // If booting directly into Satellite-only view, apply high-contrast white labels with black halos
  const initialMapVisible = layerStates['Background'].visible;
  const initialSatelliteVisible = layerStates['satellite-layer'].visible;
  const initialUseSatelliteContrastLabels = initialSatelliteVisible && !initialMapVisible;

  if (initialUseSatelliteContrastLabels && style.layers) {
      const labelContrastConfigs = {
          'highway-name-major': { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 2.0 },
          'highway-name-minor': { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 2.0 },
          'highway-name-path': { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 }
      };
      style.layers.forEach(layer => {
          if (labelContrastConfigs[layer.id]) {
              if (!layer.paint) layer.paint = {};
              Object.assign(layer.paint, labelContrastConfigs[layer.id]);
          }
      });
  }

  // If the 'Background' (basemap) is supposed to be hidden initially,
  // we apply 'visibility: none' to all layers in the base style JSON (except labels if they are enabled)
  // BEFORE initializing the map. This prevents any flickering!
  if (!layerStates['Background'].visible && style.layers) {
      style.layers.forEach(layer => {
          if (!layer.layout) layer.layout = {};
          if (labelLayers.includes(layer.id)) {
              layer.layout.visibility = layerStates['map-labels'].visible ? 'visible' : 'none';
          } else {
              layer.layout.visibility = 'none';
          }
      });
  }

  let nav = new maplibregl.NavigationControl();
  map = new maplibregl.Map({
      container: 'map',
      style: style,
      center: [-75.1316, 39.8679],
      zoom: isMobileDevice() ? 12 : 14.25,
      maxBounds: bounds,
      attributionControl: false,
      preserveDrawingBuffer: true
  });

  // Bind to setLayoutProperty in order to toggle fill and symbols simultaneously in layer control widget
  const originalSetLayoutProperty = map.setLayoutProperty.bind(map);
  // Override the method to watch for changes
  map.setLayoutProperty = function (layerId, name, value) {
      const labelLayers = [
          'waterway_line_label', 'water_name_point_label', 'water_name_line_label',
          'highway-name-path', 'highway-name-minor', 'highway-name-major',
          'highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us',
          'airport', 'label_other', 'label_village', 'label_town',
          'label_state', 'label_city', 'label_city_capital',
          'label_country_3', 'label_country_2', 'label_country_1'
      ];

      // Dynamically read standard Map (Background), Satellite, and Labels checked state from the DOM if available
      const mapCheckbox = document.querySelector('span.layer-control-name[title="Background"], span.layer-control-name[title="Map"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
      const satelliteCheckbox = document.querySelector('span.layer-control-name[title="Satellite"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
      const labelsCheckbox = document.querySelector('span.layer-control-name[title="Labels"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
      
      const mapVisible = mapCheckbox ? mapCheckbox.checked : layerStates['Background'].visible;
      const satelliteVisible = satelliteCheckbox ? satelliteCheckbox.checked : layerStates['satellite-layer'].visible;
      const labelsVisible = (layerId === 'map-labels' && value !== undefined) ? (value === 'visible') : (labelsCheckbox ? labelsCheckbox.checked : layerStates['map-labels'].visible);

      const shouldBasemapBeVisible = mapVisible;

      if (layerId === 'map-labels') {
          if (name === 'visibility') {
              const isLabelsOn = (value === 'visible');
              layerStates['map-labels'].visible = isLabelsOn;

              // Update base style text labels
              labelLayers.forEach(lId => {
                  if (map.getLayer(lId)) {
                      originalSetLayoutProperty(lId, 'visibility', isLabelsOn ? 'visible' : 'none');
                  }
              });

              // Synchronize custom parking overlay according to user overlay preference
              const parkingTarget = (userOverlayPreferences['custom-parking-fill'] && isLabelsOn) ? 'visible' : 'none';
              if (map.getLayer('custom-parking-fill')) originalSetLayoutProperty('custom-parking-fill', 'visibility', parkingTarget);
              if (map.getLayer('parking-layer-symbols')) originalSetLayoutProperty('parking-layer-symbols', 'visibility', parkingTarget);

              // Synchronize custom establishments overlay according to user overlay preference
              const estTarget = (userOverlayPreferences['custom-markers'] && isLabelsOn) ? 'visible' : 'none';
              if (map.getLayer('custom-markers')) originalSetLayoutProperty('custom-markers', 'visibility', estTarget);
              if (map.getLayer('custom-labels')) originalSetLayoutProperty('custom-labels', 'visibility', estTarget);

              // Synchronize custom recreation overlay according to user overlay preference
              const recTarget = (userOverlayPreferences['park-layer-fill'] && isLabelsOn) ? 'visible' : 'none';
              if (map.getLayer('park-layer-fill')) originalSetLayoutProperty('park-layer-fill', 'visibility', recTarget);
              if (map.getLayer('custom-park-outline')) originalSetLayoutProperty('custom-park-outline', 'visibility', recTarget);
              if (map.getLayer('walkingpath-outline')) originalSetLayoutProperty('walkingpath-outline', 'visibility', recTarget);
              if (map.getLayer('park-layer-symbols')) originalSetLayoutProperty('park-layer-symbols', 'visibility', recTarget);
              if (map.getLayer('walkingpath-layer-symbol')) originalSetLayoutProperty('walkingpath-layer-symbol', 'visibility', recTarget);
          }
          return; // Intercept completely
      }

      if (labelLayers.includes(layerId) && name === 'visibility') {
          // Force individual style label layers to obey map-labels state
          const targetValue = labelsVisible ? 'visible' : 'none';
          originalSetLayoutProperty(layerId, name, targetValue);
          return;
      }

      // Check if thematic layers are being toggled
      if (layerId === 'custom-parking-fill' && name === 'visibility') {
          const isRequestedVisible = (value === 'visible');
          userOverlayPreferences['custom-parking-fill'] = isRequestedVisible;
          layerStates['custom-parking-fill'].visible = isRequestedVisible;
          const effectiveVal = (isRequestedVisible && labelsVisible) ? 'visible' : 'none';
          originalSetLayoutProperty('custom-parking-fill', 'visibility', effectiveVal);
          originalSetLayoutProperty('parking-layer-symbols', 'visibility', effectiveVal);
          syncMapStyleState();
          return;
      }
      if (layerId === 'custom-markers' && name === 'visibility') {
          const isRequestedVisible = (value === 'visible');
          userOverlayPreferences['custom-markers'] = isRequestedVisible;
          layerStates['custom-markers'].visible = isRequestedVisible;
          const effectiveVal = (isRequestedVisible && labelsVisible) ? 'visible' : 'none';
          originalSetLayoutProperty('custom-markers', 'visibility', effectiveVal);
          originalSetLayoutProperty('custom-labels', 'visibility', effectiveVal);
          syncMapStyleState();
          return;
      }
      if (layerId === 'park-layer-fill' && name === 'visibility') {
          const isRequestedVisible = (value === 'visible');
          userOverlayPreferences['park-layer-fill'] = isRequestedVisible;
          layerStates['park-layer-fill'].visible = isRequestedVisible;
          const effectiveVal = (isRequestedVisible && labelsVisible) ? 'visible' : 'none';
          originalSetLayoutProperty('park-layer-fill', 'visibility', effectiveVal);
          originalSetLayoutProperty('custom-park-outline', 'visibility', effectiveVal);
          originalSetLayoutProperty('walkingpath-outline', 'visibility', effectiveVal);
          originalSetLayoutProperty('park-layer-symbols', 'visibility', effectiveVal);
          originalSetLayoutProperty('walkingpath-layer-symbol', 'visibility', effectiveVal);
          syncMapStyleState();
          return;
      }

      // Check if Background (basemap) is being toggled - virtual layer, not in MapLibre style
      if (layerId === 'Background') {
          if (name === 'visibility') {
              layerStates['Background'].visible = (value === 'visible');
              syncMapStyleState();
          }
          return;
      }

      // Check if satellite layer is being toggled
      if (layerId === 'satellite-layer') {
          originalSetLayoutProperty(layerId, name, value);
          if (name === 'visibility') {
              const isSatOn = (value === 'visible');
              layerStates['satellite-layer'].visible = isSatOn;
              // If satellite is turned off and labels are hidden, automatically restore labels
              if (!isSatOn && !layerStates['map-labels'].visible) {
                  map.setLayoutProperty('map-labels', 'visibility', 'visible');
                  const labelsSpan = document.querySelector('span.layer-control-name[title="map-labels"], span.layer-control-name[title="Labels"]');
                  if (labelsSpan) {
                      const labelsCb = labelsSpan.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
                      if (labelsCb) labelsCb.checked = true;
                  }
              }
              syncMapStyleState();
          }
          return;
      }

      // Call original function for other layers
      originalSetLayoutProperty(layerId, name, value);

      if (name === 'visibility') {
          syncMapStyleState();
      }
  };

  syncMapStyleState = function() {
      if (!map) return;

      // Dynamically read checked states from the DOM if available, falling back to layerStates
      const mapCheckbox = document.querySelector('span.layer-control-name[title="Background"], span.layer-control-name[title="Map"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
      const satelliteCheckbox = document.querySelector('span.layer-control-name[title="Satellite"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
      const labelsCheckbox = document.querySelector('span.layer-control-name[title="Labels"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');

      const mapVisible = mapCheckbox ? mapCheckbox.checked : layerStates['Background'].visible;
      const satelliteVisible = satelliteCheckbox ? satelliteCheckbox.checked : layerStates['satellite-layer'].visible;
      const labelsVisible = labelsCheckbox ? labelsCheckbox.checked : layerStates['map-labels'].visible;

      // 1. Determine if the basemap style layers (non-labels) should be visible
      const shouldBasemapBeVisible = mapVisible;

      const layers = (style && style.layers) ? style.layers : (map.getStyle() ? map.getStyle().layers : []);
      if (layers && layers.length > 0) {
          layers.forEach(layer => {
              if (labelLayers.includes(layer.id)) {
                  // Obey labelsVisible strictly: if labels are off, no text labels should show
                  const targetVisibility = labelsVisible ? 'visible' : 'none';
                  if (map.getLayer(layer.id)) {
                      const currentVis = map.getLayoutProperty(layer.id, 'visibility');
                      if (currentVis !== targetVisibility) {
                          originalSetLayoutProperty(layer.id, 'visibility', targetVisibility);
                      }
                  }
              } else {
                  // For other base style layers, visibility is controlled by shouldBasemapBeVisible
                  const customLayers = [
                      'satellite-layer', 'custom-parking-fill', 'parking-layer-symbols',
                      'park-layer-fill', 'custom-park-outline', 'walkingpath-outline', 'walkingpath-layer-symbol',
                      'park-layer-symbols', 'custom-markers', 'custom-labels', 'highlight-point-layer', 'highlight-poly-layer'
                  ];
                  if (!customLayers.includes(layer.id)) {
                      const targetVisibility = shouldBasemapBeVisible ? 'visible' : 'none';
                      if (map.getLayer(layer.id)) {
                          const currentVis = map.getLayoutProperty(layer.id, 'visibility');
                          if (currentVis !== targetVisibility) {
                              originalSetLayoutProperty(layer.id, 'visibility', targetVisibility);
                          }
                      }
                  }
              }
          });
      }

      // 2. Synchronize satellite layer visibility
      if (map.getLayer('satellite-layer')) {
          const targetVis = satelliteVisible ? 'visible' : 'none';
          if (map.getLayoutProperty('satellite-layer', 'visibility') !== targetVis) {
              originalSetLayoutProperty('satellite-layer', 'visibility', targetVis);
          }
      }

      // 3. Synchronize thematic overlay layers with userOverlayPreferences and labelsVisible state
      const parkingTarget = (userOverlayPreferences['custom-parking-fill'] && labelsVisible) ? 'visible' : 'none';
      if (map.getLayer('custom-parking-fill') && map.getLayoutProperty('custom-parking-fill', 'visibility') !== parkingTarget) {
          originalSetLayoutProperty('custom-parking-fill', 'visibility', parkingTarget);
      }
      if (map.getLayer('parking-layer-symbols') && map.getLayoutProperty('parking-layer-symbols', 'visibility') !== parkingTarget) {
          originalSetLayoutProperty('parking-layer-symbols', 'visibility', parkingTarget);
      }

      const estTarget = (userOverlayPreferences['custom-markers'] && labelsVisible) ? 'visible' : 'none';
      if (map.getLayer('custom-markers') && map.getLayoutProperty('custom-markers', 'visibility') !== estTarget) {
          originalSetLayoutProperty('custom-markers', 'visibility', estTarget);
      }
      if (map.getLayer('custom-labels') && map.getLayoutProperty('custom-labels', 'visibility') !== estTarget) {
          originalSetLayoutProperty('custom-labels', 'visibility', estTarget);
      }

      const recTarget = (userOverlayPreferences['park-layer-fill'] && labelsVisible) ? 'visible' : 'none';
      if (map.getLayer('park-layer-fill') && map.getLayoutProperty('park-layer-fill', 'visibility') !== recTarget) {
          originalSetLayoutProperty('park-layer-fill', 'visibility', recTarget);
      }
      if (map.getLayer('custom-park-outline') && map.getLayoutProperty('custom-park-outline', 'visibility') !== recTarget) {
          originalSetLayoutProperty('custom-park-outline', 'visibility', recTarget);
      }
      if (map.getLayer('walkingpath-outline') && map.getLayoutProperty('walkingpath-outline', 'visibility') !== recTarget) {
          originalSetLayoutProperty('walkingpath-outline', 'visibility', recTarget);
      }
      if (map.getLayer('park-layer-symbols') && map.getLayoutProperty('park-layer-symbols', 'visibility') !== recTarget) {
          originalSetLayoutProperty('park-layer-symbols', 'visibility', recTarget);
      }
      if (map.getLayer('walkingpath-layer-symbol') && map.getLayoutProperty('walkingpath-layer-symbol', 'visibility') !== recTarget) {
          originalSetLayoutProperty('walkingpath-layer-symbol', 'visibility', recTarget);
      }

      // 2. Apply contrast paint overrides for labels in satellite mode
      const shouldUseSatelliteContrastLabels = satelliteVisible && !mapVisible;

      const labelContrastConfigs = {
          'highway-name-major': {
              satellite: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 2.0 },
              standard: { 'text-color': '#666666', 'text-halo-color': 'rgba(255,255,255,0)', 'text-halo-width': 1.0 }
          },
          'highway-name-minor': {
              satellite: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 2.0 },
              standard: { 'text-color': '#666666', 'text-halo-color': 'rgba(255,255,255,0)', 'text-halo-width': 1.0 }
          },
          'highway-name-path': {
              satellite: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 },
              standard: { 'text-color': 'hsl(30,23%,62%)', 'text-halo-color': '#f8f4f0', 'text-halo-width': 0.5 }
          }
      };

      Object.keys(labelContrastConfigs).forEach(layerId => {
          if (map.getLayer(layerId)) {
              const config = shouldUseSatelliteContrastLabels ? labelContrastConfigs[layerId].satellite : labelContrastConfigs[layerId].standard;
              Object.keys(config).forEach(prop => {
                  const currentVal = map.getPaintProperty(layerId, prop);
                  if (currentVal !== config[prop]) {
                      map.setPaintProperty(layerId, prop, config[prop]);
                  }
              });
          }
      });
  }

  if(!isMobileDevice() && window.self === window.top) map.addControl(new maplibregl.FullscreenControl(), 'top-left');
  map.addControl(nav, 'top-left');

  let geolocate = new maplibregl.GeolocateControl({
      positionOptions: {
          enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserLocation: true
  });
  map.addControl(geolocate, 'top-left');
  
  map.on('load', async () => {
      const existingImages = {};
      map.on('styleimagemissing', async (e) => {
          if (existingImages[e.id]) return;
          existingImages[e.id] = true;
          //console.log(e.id);
          const response = await fetch(e.id);
          const svgText = await response.text();
          const svg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
          const image = new Image();
          const promise = new Promise((resolve) => {
              image.onload = resolve;
          });
          image.src = svg;
          await promise; // Wait for the image to load
          let sdf = false;
          sdf = e.id == 'images/person-walking-icon.svg'? true:false;
          map.addImage(e.id, image, { sdf: sdf });
      });

      const parkingicon_image = await map.loadImage('images/parking.png');
      map.addImage('parking-icon', parkingicon_image.data);

      const IMAGERY_CONFIGS = {
          'njgin': {
              tiles: ['https://maps.nj.gov/arcgis/rest/services/Basemap/Orthos_Natural_2020_NJ_WM/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
              maxzoom: 20,
              attribution: '<a href="https://njogis-newjersey.opendata.arcgis.com/" target="_blank" rel="noopener">NJ Office of GIS</a> &mdash; NJGIN (Spring 2020 Leaf-Off, 1ft)'
          },
          'esri': {
              tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
              tileSize: 256,
              maxzoom: 18,
              attribution: '<a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Vantor (Aug 2025 WorldView-2, 0.5m), USDA FSA, USGS, GIS User Community'
          }
      };

      const initialImageryConfig = IMAGERY_CONFIGS[imageryProvider] || IMAGERY_CONFIGS['njgin'];

      map.addSource('satellite-source', {
          type: 'raster',
          tiles: initialImageryConfig.tiles,
          tileSize: initialImageryConfig.tileSize,
          maxzoom: initialImageryConfig.maxzoom,
          attribution: initialImageryConfig.attribution
      });
      
      map.addSource('establishments', {
          type: 'geojson',
          data: collections.establishments
      });
      
      map.addSource('parking', {
          type: 'geojson',
          data: collections.parking
      });

      map.addSource('recreation', {
          type: 'geojson',
          data: collections.recreation
      });

      const initialSatVisible = layerStates['satellite-layer'].visible;
      const initialOpacity = layerStates['Background'].visible ? 0.3 : 1.0;

      // Add Satellite Map below waterway line label layer
      map.addLayer({
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite-source',
          layout: {
              'visibility': initialSatVisible ? 'visible' : 'none'
          },
          paint: {
              'raster-opacity': initialOpacity
          }
      }, 'waterway_line_label');

      setImageryProvider = function(provider) {
          const prov = (provider || '').toLowerCase();
          if (!IMAGERY_CONFIGS[prov]) return;
          imageryProvider = prov;

          if (map) {
              const currentOpacity = (map.getLayer('satellite-layer') && map.getPaintProperty('satellite-layer', 'raster-opacity') !== undefined)
                  ? map.getPaintProperty('satellite-layer', 'raster-opacity')
                  : (layerStates['Background'].visible ? 0.3 : 1.0);
              const isVisible = layerStates['satellite-layer'].visible;

              if (map.getLayer('satellite-layer')) {
                  map.removeLayer('satellite-layer');
              }
              if (map.getSource('satellite-source')) {
                  map.removeSource('satellite-source');
              }

              const config = IMAGERY_CONFIGS[prov];
              map.addSource('satellite-source', {
                  type: 'raster',
                  tiles: config.tiles,
                  tileSize: config.tileSize,
                  maxzoom: config.maxzoom,
                  attribution: config.attribution
              });

              const beforeLayer = map.getLayer('waterway_line_label') ? 'waterway_line_label' : (map.getLayer('custom-parking-fill') ? 'custom-parking-fill' : undefined);
              map.addLayer({
                  id: 'satellite-layer',
                  type: 'raster',
                  source: 'satellite-source',
                  layout: {
                      'visibility': isVisible ? 'visible' : 'none'
                  },
                  paint: {
                      'raster-opacity': currentOpacity
                  }
              }, beforeLayer);
          }

          // Update UI buttons in LayerControl if present
          const subControl = document.querySelector('.imagery-sub-control');
          if (subControl) {
              subControl.querySelectorAll('.imagery-sub-btn').forEach(b => {
                  b.classList.toggle('active', b.getAttribute('data-imagery') === imageryProvider);
              });
          }

          syncMapStyleState();
          updateUrlParams();
      }; 
      
      map.addLayer({
          id: 'custom-parking-fill',
          type: 'fill',
          source: 'parking',
          minzoom: 12.0,
          filter: ['in', 'Parking', ['coalesce', ['get', 'tags'], '']], // Only apply to parking features
          layout: {
              'visibility': (layerStates['custom-parking-fill'].visible && layerStates['map-labels'].visible) ? 'visible' : 'none'
          },
          paint: {
              'fill-color': '#3b82f6', // Translucent blue
              'fill-opacity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 0.25,
                  15.0, 0.4,
                  18.0, 0.55
              ]
          }
      });

      map.addLayer({
          id: 'parking-layer-symbols',
          type: 'symbol',
          source: 'parking',
          minzoom: 12.0,
          filter: ['in', 'Parking', ['coalesce', ['get', 'tags'], '']],
          layout: {
              'visibility': (layerStates['custom-parking-fill'].visible && layerStates['map-labels'].visible) ? 'visible' : 'none',
              'icon-image': 'images/parking.svg',
              'icon-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 0.08,
                  15.0, 0.13,
                  18.0, 0.18
              ],
              'icon-allow-overlap': false,
              'icon-overlap': 'cooperative',
              'text-overlap': 'cooperative'
          }
      });


      map.addLayer({
          id: 'park-layer-fill',
          type: 'fill',
          source: 'recreation',
          filter: ['in', 'Park', ['coalesce', ['get', 'tags'], '']],
          minzoom: 12.0,
          layout: {
              'visibility': (layerStates['park-layer-fill'].visible && layerStates['map-labels'].visible) ? 'visible' : 'none'
          },
          paint: {
              'fill-color': '#32a852', // Translucent green
              'fill-opacity': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 0.25,
                  15.0, 0.4,
                  18.0, 0.55
              ]
          }
      });

      // Add an outline for the park area
      map.addLayer({
          id: 'custom-park-outline',
          type: 'line',
          source: 'recreation',
          minzoom: 12.0,
          filter: ['in', 'Park', ['coalesce', ['get', 'tags'], '']],
          layout: {
              'visibility': (layerStates['park-layer-fill'].visible && layerStates['map-labels'].visible) ? 'visible' : 'none'
          },
          paint: {
              'line-color': '#1f6e34',
              'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 0.5,
                  15.0, 1.0,
                  18.0, 2.0
              ]
          }
      });
      
      map.addLayer({
          id: 'walkingpath-outline',
          type: 'line',
          source: 'recreation',
          minzoom: 12.0,
          filter: ['in', 'Walking Path', ['coalesce', ['get', 'tags'], '']],
          layout: {
              'visibility': (layerStates['park-layer-fill'].visible && layerStates['map-labels'].visible) ? 'visible' : 'none'
          },
          paint: {
              'line-color': '#1f6e34',
              'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 1.5,
                  15.0, 3.0,
                  18.0, 4.5
              ]
          }
      });
      
      map.addLayer({
          id: 'walkingpath-layer-symbol',
          type: 'symbol',
          source: 'recreation',
          minzoom: 12.0,
          filter: ['in', 'Walking Path', ['coalesce', ['get', 'tags'], '']],
          layout: {
              'visibility': (layerStates['park-layer-fill'].visible && layerStates['map-labels'].visible) ? 'visible' : 'none',
              'icon-image': 'images/person-walking-icon.svg',
              'symbol-placement': 'line-center',
              'icon-keep-upright': true,
              'icon-rotation-alignment': 'map',
              'icon-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 0.03,
                  15.0, 0.05,
                  18.0, 0.075
              ],
              'icon-allow-overlap': false,
              'icon-overlap': 'cooperative',
              'text-overlap': 'cooperative'
          },
          paint: {
            'icon-color': "#32ad86",
            'icon-translate': [20, 0],
          }
      });

      
      map.addLayer({
          id: 'park-layer-symbols',
          type: 'symbol',
          source: 'recreation',
          minzoom: 12.0,
          filter: ['in', 'Park', ['coalesce', ['get', 'tags'], '']],
          layout: {
              'visibility': (layerStates['park-layer-fill'].visible && layerStates['map-labels'].visible) ? 'visible' : 'none',
              'icon-image': 'images/park.svg',
              'icon-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 0.035,
                  15.0, 0.055,
                  18.0, 0.08
              ],
              'icon-allow-overlap': true,
              'icon-overlap': 'always',
              'text-overlap': 'always',
              'text-field': ['get', 'name'],
              "text-font": ["Noto Sans Regular"],
              'text-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 10.0,
                  15.0, 11.5,
                  18.0, 13.0
              ],
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              "text-variable-anchor": ["top", "bottom", "left", "right"],
              'text-optional': true
          },
          paint: {
              'text-color':'#000000',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2
          }
      });


      // B) Render Shop & Restaurant Markers
      map.addLayer({
          id: 'custom-markers',
          type: 'circle',
          source: 'establishments',
          minzoom: 12.0,
          filter: ['all', 
              ['!', ['in', 'Parking', ['coalesce', ['get', 'tags'], '']]],
              ['!', ['in', 'Park', ['coalesce', ['get', 'tags'], '']]],
              ['!', ['in', 'Walking Path', ['coalesce', ['get', 'tags'], '']]]
          ], // Exclude parking polygons
          layout: {
              'visibility': (layerStates['custom-markers'].visible && layerStates['map-labels'].visible) ? 'visible' : 'none'
          },
          paint: {
              'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 2.0,
                  14.0, 3.5,
                  15.5, 5.5,
                  17.5, 8.0,
                  19.0, 11.0
              ],
              'circle-color': [
                  'match',
                  ['coalesce', ['get', 'primary_tag'], ''],
                  ['safety', 'police station', 'fire station', 'police'], '#dc2626',
                  ['brewery', 'bar', 'pub', 'nightlife', 'craft beer', 'liquor store', 'wine', 'beer', 'spirits'], '#d97706',
                  ['restaurant', 'dining', 'food', 'cafe', 'banquet hall', 'event space', 'diner', 'bakery', 'sweets', 'take out', 'takeout', 'bbq', 'dessert', 'cookie cakes', 'cookies', 'pizza', 'italian', 'mexican', 'puerto rican', 'shakes', 'bowls', 'coffee', 'breakfast', 'lunch', 'dinner', 'deli', 'hoagies', 'sandwiches', 'seafood', 'juice bar', 'smoothies'], '#db2777',
                  ['wellness', 'fitness', 'yoga', 'tai chi', 'health', 'umaa', 'salon', 'hair styling', 'barber', 'barbershop', 'kickboxing', 'karate', 'jujitsu', 'doctor', 'gym', 'gymnastics', 'personal training'], '#0d9488',
                  ['convenience store', 'retail', 'groceries', 'shop', 'appliances', 'smoke shop', 'tobacco', 'supermarket', 'collectibles', 'bait', 'provisions', 'lottery'], '#059669',
                  ['laundry', 'service', 'services', 'laundromat', 'locksmith', 'key duplication', 'tax prep', 'bookkeeping', 'it management', 'cloud services', 'bail bonds', 'bank', 'atm', 'home insurance', 'professional', 'photography', 'real estate', 'property management', 'hospitality', 'consulting', 'business services', 'financial', 'funeral home', 'human services', 'union', 'cleaning', 'disaster restoration', 'telecommunications'], '#81007F',
                  ['borough offices', 'public resource', 'government', 'library', 'community', 'post office', 'education', 'public elementary school', 'pre-kindergarten school', 'pk-6', 'mail', 'packages', 'po boxes', 'senior center', 'public', 'daycare', 'child care'], '#2563eb',
                  ['auto repair', 'dealership', 'mechanic', 'mechanic service', 'auto service', 'oil change', 'used cars', 'new cars', 'car wash', 'detailing', 'performance tuning', 'car insurance', 'automotive'], '#ffd700',
                  ['park', 'recreation', 'walking path', 'walkingpath', 'entertainment'], '#16a34a',
                  ['parking', 'free'], '#2563eb',
                  ['home-business', 'web design', 'software', 'crafts', 'candles', 'tutoring', 'gardening', 'landscaping', 'music', 'piano', 'voice lessons', 'pet sitting', 'dog walking'], '#C2593F',
                  ['industrial', 'manufacturing', 'machining', 'metal fab', 'logistics', 'warehousing', 'distribution', 'building materials', 'wholesale', 'auto body', 'collision repair', 'commercial printing', 'publishing', 'hvac', 'packaging', 'shipping boxes', 'contractors', 'carpentry', 'custom framing', 'flooring', 'plumbing', 'fence', 'machinery', 'environmental', 'pest control', 'lawn care', 'outdoor', 'textiles', 'apparel', 'upholstery', 'medical supplies'], '#5E6D75',
                  ['marine', 'boating', 'boat sales', 'marina', 'boat club', 'yacht club', 'power boat', 'boating & marine'], '#0284c7',
                  '#888888' // Default Gray
              ],
              'circle-stroke-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 0.5,
                  15.0, 1.0,
                  18.0, 1.5
              ],
              'circle-stroke-color': '#ffffff'
          }
      });


      map.addLayer({
          id: 'custom-labels',
          type: 'symbol',
          source: 'establishments',
          minzoom: 14.0,
          filter: ['all',
              ['!', ['in', 'Parking', ['coalesce', ['get', 'tags'], '']]],
              ['!', ['in', 'Park', ['coalesce', ['get', 'tags'], '']]],
              ['!', ['in', 'Walking Path', ['coalesce', ['get', 'tags'], '']]]
          ],
          layout: {
              'visibility': (layerStates['custom-markers'].visible && layerStates['map-labels'].visible) ? 'visible' : 'none',
              'text-field': ['get', 'name'],
              "text-font": ["Noto Sans Regular"],
              'text-size': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  14.0, 10.0,
                  16.5, 12.0,
                  18.5, 14.0
              ],
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              "text-variable-anchor": ["top", "bottom", "left", "right"],
              'text-allow-overlap': false,
              'text-optional': true,
              'symbol-sort-key': 5
          },
          paint: {
              'text-color':'#000000',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2
          }
      });



      
      // 8. Interactivity: Popups on click
      map.on('click', (e) => {
          stopTour();
          const features = map.queryRenderedFeatures(e.point, {
              layers: ['custom-markers', 'custom-labels', 'custom-parking-fill', 'park-layer-symbols', 'park-layer-fill', 'walkingpath-outline', 'walkingpath-layer-symbol']
          });

          if (!features.length) return;

          hasInteracted = true;
          const feature = features[0];
          const props = feature.properties;
          
          // Pin the popup to the marker point, or the mouse location for polygons
          const coordinates = feature.geometry.type === 'Point' 
              ? feature.geometry.coordinates.slice() 
              : e.lngLat;
              
          selectedFeatureName = props.name;
          searchInput.value = props.name;
          searchResults.classList.remove('active');
          
          if (feature.geometry.type === 'Point') {
               setHighlights(feature, []);
               // Auto-pan point so popup fits beautifully above feature
               const verticalOffset = isMobileDevice() ? 90 : 130;
               const offsetCenter = getOffsetCenter(coordinates, verticalOffset);
               map.flyTo({ center: offsetCenter });
          } else {
              setHighlights([], feature);
              // Auto-pan bounding box with asymmetric padding (leaves space at top)
              const bounds = getFeaturesBounds([feature]);
              if (bounds) {
                  map.fitBounds(bounds, {
                      padding: { top: 180, bottom: 60, left: 60, right: 60 },
                      maxZoom: map.getZoom() > 16 ? map.getZoom() : 16
                  });
              }
          }

          showPopup(feature, coordinates);
          updateUrlParams();
      });

      // UI enhancement: change cursor to pointer on hover
      const hoverLayers = ['custom-markers', 'custom-labels', 'custom-parking-fill', 'park-layer-symbols', 'park-layer-fill', 'walkingpath-outline', 'walkingpath-layer-symbol'];
      hoverLayers.forEach(layer => {
          map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer');
          map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '');
      });

      // ==========================================
      // SEARCH & HIGHLIGHT UI 
      // ==========================================
      const searchContainer = document.createElement('div');
      searchContainer.className = 'wv-search-control';
      searchContainer.innerHTML = `
        <div class="search-and-filter">
          <input type="search" id="wv-search-input" placeholder="Search..." aria-label="Search map facilities" />
          <div class="wv-multiselect" id="wv-search-filter-container">
            <div class="wv-multiselect-trigger" id="wv-search-filter-trigger" tabindex="0" role="button" aria-haspopup="listbox" aria-expanded="false" aria-label="Filter map by categories and tags">
              <span class="wv-trigger-text">All Categories & Tags</span>
              <span class="wv-trigger-arrow">▼</span>
            </div>
            <div class="wv-multiselect-dropdown" id="wv-search-filter-dropdown">
              <!-- Populated dynamically -->
            </div>
          </div>
        </div>
        <div id="wv-search-results" class="wv-search-results"></div>
      `;
      // Inject search container into the layer control panel
      waitForElement('.layer-control-panel').then(panel => {
          const title = panel.querySelector('.layer-control-panel-title');
          if (title && title.parentNode) {
              if (title.nextSibling) {
                  title.parentNode.insertBefore(searchContainer, title.nextSibling);
              } else {
                  title.parentNode.appendChild(searchContainer);
              }
          } else {
              panel.insertBefore(searchContainer, panel.firstChild);
          }
      });

      const searchInput = searchContainer.querySelector('#wv-search-input');
      const searchFilterContainer = searchContainer.querySelector('#wv-search-filter-container');
      const searchFilterTrigger = searchContainer.querySelector('#wv-search-filter-trigger');
      const searchFilterDropdown = searchContainer.querySelector('#wv-search-filter-dropdown');
      const searchResults = searchContainer.querySelector('#wv-search-results');
      let selectedFeatureName = null;
      let selectedFilters = new Set(['all']);

      // Toggle Multiselect dropdown
      function toggleMapDropdown(e) {
          if (e) e.stopPropagation();
          const isActive = searchFilterContainer.classList.toggle('active');
          searchFilterTrigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      }

      searchFilterTrigger.addEventListener('click', (e) => {
          toggleMapDropdown(e);
      });

      searchFilterTrigger.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleMapDropdown(e);
          } else if (e.key === 'ArrowDown' || e.key === 'Down') {
              e.preventDefault();
              if (!searchFilterContainer.classList.contains('active')) {
                  toggleMapDropdown(e);
              }
              const firstInput = searchFilterDropdown.querySelector('input');
              if (firstInput) firstInput.focus();
          } else if (e.key === 'Escape' || e.key === 'Esc') {
              if (searchFilterContainer.classList.contains('active')) {
                  e.preventDefault();
                  searchFilterContainer.classList.remove('active');
                  searchFilterTrigger.setAttribute('aria-expanded', 'false');
                  searchFilterTrigger.focus();
              }
          }
      });

      document.addEventListener('click', () => {
          searchFilterContainer.classList.remove('active');
          searchFilterTrigger.setAttribute('aria-expanded', 'false');
      });

      searchFilterDropdown.addEventListener('click', (e) => {
          e.stopPropagation();
      });

      searchFilterDropdown.addEventListener('keydown', (e) => {
          const inputs = Array.from(searchFilterDropdown.querySelectorAll('input'));
          const currentIndex = inputs.indexOf(document.activeElement);

          if (e.key === 'ArrowDown' || e.key === 'Down') {
              e.preventDefault();
              const nextIndex = (currentIndex + 1) % inputs.length;
              inputs[nextIndex]?.focus();
          } else if (e.key === 'ArrowUp' || e.key === 'Up') {
              e.preventDefault();
              const prevIndex = (currentIndex - 1 + inputs.length) % inputs.length;
              inputs[prevIndex]?.focus();
          } else if (e.key === 'Home') {
              e.preventDefault();
              inputs[0]?.focus();
          } else if (e.key === 'End') {
              e.preventDefault();
              inputs[inputs.length - 1]?.focus();
          } else if (e.key === 'Escape' || e.key === 'Esc') {
              e.preventDefault();
              searchFilterContainer.classList.remove('active');
              searchFilterTrigger.setAttribute('aria-expanded', 'false');
              searchFilterTrigger.focus();
          }
      });

      // Global Escape handler to dismiss active map popups (WCAG 2.1.1)
      window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' || e.key === 'Esc') {
              if (activePopup) {
                  e.preventDefault();
                  dismissActivePopup();
              }
          }
      });

      function updateFilterTriggerText() {
          const triggerText = searchFilterTrigger.querySelector('.wv-trigger-text');
          if (selectedFilters.has('all') || selectedFilters.size === 0) {
              triggerText.innerText = 'All Categories & Tags';
          } else {
              const labels = [];
              selectedFilters.forEach(val => {
                  if (val === 'all') return;
                  if (val.startsWith('cat:')) {
                      const catName = val.slice(4);
                      labels.push(catName.charAt(0).toUpperCase() + catName.slice(1));
                  } else if (val.startsWith('tag:')) {
                      labels.push(val.slice(4));
                  }
              });
              if (labels.length === 1) {
                  triggerText.innerText = labels[0];
              } else {
                  triggerText.innerText = `Filtered (${labels.length})`;
              }
          }
      }

      // Highlight source & layers
      map.addSource('highlight-point-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('highlight-poly-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      map.addLayer({
          id: 'highlight-poly-layer',
          type: 'line',
          source: 'highlight-poly-source',
          paint: {
              'line-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 2.0,
                  15.0, 4.0,
                  18.0, 6.0
              ],
              'line-color': '#ffcc00'
          }
      });

      map.addLayer({
          id: 'highlight-point-layer',
          type: 'circle',
          source: 'highlight-point-source',
          minzoom: 12.0,
          paint: {
              'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 3.0,
                  14.0, 4.75,
                  15.5, 6.75,
                  17.5, 9.5,
                  19.0, 12.5
              ],
              'circle-color': 'transparent',
              'circle-stroke-width': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  12.0, 1.25,
                  15.0, 1.75,
                  18.0, 2.25
              ],
              'circle-stroke-color': '#ffcc00'
          }
      });

      function setHighlightDimming(dim, highlightedFeatures = []) {
          if (!map) return;
          try {
              const highlightedNames = (highlightedFeatures || [])
                  .map(f => f.properties && f.properties.name)
                  .filter(Boolean);

              if (dim && highlightedNames.length > 0) {
                  if (map.getLayer('custom-markers')) {
                      map.setPaintProperty('custom-markers', 'circle-opacity', [
                          'case',
                          ['in', ['get', 'name'], ['literal', highlightedNames]],
                          1.0,
                          0.35
                      ]);
                      map.setPaintProperty('custom-markers', 'circle-stroke-opacity', [
                          'case',
                          ['in', ['get', 'name'], ['literal', highlightedNames]],
                          1.0,
                          0.35
                      ]);
                  }
                  if (map.getLayer('custom-labels')) {
                      map.setPaintProperty('custom-labels', 'text-opacity', [
                          'case',
                          ['in', ['get', 'name'], ['literal', highlightedNames]],
                          1.0,
                          0.2
                      ]);
                      map.setLayoutProperty('custom-labels', 'symbol-sort-key', [
                          'case',
                          ['in', ['get', 'name'], ['literal', highlightedNames]],
                          0,
                          10
                      ]);
                  }
                  if (map.getLayer('park-layer-symbols')) {
                      map.setPaintProperty('park-layer-symbols', 'icon-opacity', [
                          'case',
                          ['in', ['get', 'name'], ['literal', highlightedNames]],
                          1.0,
                          0.25
                      ]);
                      map.setPaintProperty('park-layer-symbols', 'text-opacity', [
                          'case',
                          ['in', ['get', 'name'], ['literal', highlightedNames]],
                          1.0,
                          0.25
                      ]);
                  }
              } else if (dim) {
                  if (map.getLayer('custom-markers')) {
                      map.setPaintProperty('custom-markers', 'circle-opacity', 0.35);
                      map.setPaintProperty('custom-markers', 'circle-stroke-opacity', 0.35);
                  }
                  if (map.getLayer('custom-labels')) {
                      map.setPaintProperty('custom-labels', 'text-opacity', 0.2);
                  }
                  if (map.getLayer('park-layer-symbols')) {
                      map.setPaintProperty('park-layer-symbols', 'icon-opacity', 0.25);
                      map.setPaintProperty('park-layer-symbols', 'text-opacity', 0.25);
                  }
              } else {
                  if (map.getLayer('custom-markers')) {
                      map.setPaintProperty('custom-markers', 'circle-opacity', 1.0);
                      map.setPaintProperty('custom-markers', 'circle-stroke-opacity', 1.0);
                  }
                  if (map.getLayer('custom-labels')) {
                      map.setPaintProperty('custom-labels', 'text-opacity', 1.0);
                      map.setLayoutProperty('custom-labels', 'symbol-sort-key', 5);
                  }
                  if (map.getLayer('park-layer-symbols')) {
                      map.setPaintProperty('park-layer-symbols', 'icon-opacity', 1.0);
                      map.setPaintProperty('park-layer-symbols', 'text-opacity', 1.0);
                  }
              }

              const hasParkingHighlighted = dim && (highlightedFeatures || []).some(f => f._source === 'parking');
              const hasRecHighlighted = dim && (highlightedFeatures || []).some(f => f._source === 'recreation');

              if (map.getLayer('custom-parking-fill')) {
                  map.setPaintProperty('custom-parking-fill', 'fill-opacity', (dim && !hasParkingHighlighted) ? 0.15 : [
                      'interpolate', ['linear'], ['zoom'],
                      12.0, 0.25,
                      15.0, 0.4,
                      18.0, 0.55
                  ]);
              }
              if (map.getLayer('park-layer-fill')) {
                  map.setPaintProperty('park-layer-fill', 'fill-opacity', (dim && !hasRecHighlighted) ? 0.15 : [
                      'interpolate', ['linear'], ['zoom'],
                      12.0, 0.25,
                      15.0, 0.4,
                      18.0, 0.55
                  ]);
              }
              if (map.getLayer('parking-layer-symbols')) {
                  map.setPaintProperty('parking-layer-symbols', 'icon-opacity', (dim && !hasParkingHighlighted) ? 0.25 : 1.0);
              }
              if (map.getLayer('walkingpath-layer-symbol')) {
                  map.setPaintProperty('walkingpath-layer-symbol', 'icon-opacity', (dim && !hasRecHighlighted) ? 0.25 : 1.0);
              }
              if (map.getLayer('walkingpath-outline')) {
                  map.setPaintProperty('walkingpath-outline', 'line-opacity', (dim && !hasRecHighlighted) ? 0.25 : 1.0);
              }
              if (map.getLayer('custom-park-outline')) {
                  map.setPaintProperty('custom-park-outline', 'line-opacity', (dim && !hasRecHighlighted) ? 0.25 : 1.0);
              }
          } catch (e) {
              console.warn('Could not update layer dimming', e);
          }
      }

      function clearHighlights() {
          const ptSource = map.getSource('highlight-point-source');
          const polySource = map.getSource('highlight-poly-source');
          if (ptSource) ptSource.setData({ type: 'FeatureCollection', features: [] });
          if (polySource) polySource.setData({ type: 'FeatureCollection', features: [] });
          setHighlightDimming(false, []);
      }

      function setHighlights(pointFeatures, polyFeatures) {
          const pts = Array.isArray(pointFeatures) ? pointFeatures : (pointFeatures ? [pointFeatures] : []);
          const polys = Array.isArray(polyFeatures) ? polyFeatures : (polyFeatures ? [polyFeatures] : []);
          
          const ptSource = map.getSource('highlight-point-source');
          const polySource = map.getSource('highlight-poly-source');
          if (ptSource) ptSource.setData({ type: 'FeatureCollection', features: pts });
          if (polySource) polySource.setData({ type: 'FeatureCollection', features: polys });
          
          const allHighlighted = [...pts, ...polys];
          setHighlightDimming(allHighlighted.length > 0, allHighlighted);
      }
      const layerControl = new LayerControl({
          collapsed: (isMobileDevice() || window.self !== window.top), //true,
          showStyleEditor: false,
          showOpacitySlider: true,
          layerStates: layerStates,
          layers: ['satellite-layer', 'custom-parking-fill', 'custom-markers', 'park-layer-fill', 'map-labels'],
          basemapStyleUrl: '/welcome_to_westville.json',
          panelWidth: 320,
          panelMinWidth: 320,
          panelMaxWidth: 320
      });
      map.addControl(layerControl, 'top-right');

      map.addControl(new maplibregl.AttributionControl({compact: true}), 'bottom-left');
      document.querySelector("details.maplibregl-ctrl-attrib").classList.remove('maplibregl-compact-show');
      const portalDomain = window.location.hostname.includes('testing')
        ? `${window.location.protocol}//testing.westville.app/`
        : 'https://westville.app/';
      document.querySelector("span.layer-control-panel-title").innerHTML = `<a href="${portalDomain}" target="_blank">Welcome to Westville</a>`;
      
      // Build a flat list of features for searching
      const allFeatures = [];
      if (collections.parking) collections.parking.features.forEach(f => allFeatures.push({ ...f, _source: 'parking' }));
      if (collections.establishments) collections.establishments.features.forEach(f => allFeatures.push({ ...f, _source: 'establishment' }));
      if (collections.recreation) collections.recreation.features.forEach(f => allFeatures.push({ ...f, _source: 'recreation' }));

      // Extract unique individual tags and dynamically populate filter select
      const uniqueTags = new Set();
      allFeatures.forEach(f => {
          if (f.properties.tags) {
              f.properties.tags.split(',').forEach(tag => {
                  uniqueTags.add(tag.trim());
              });
          }
      });
      const sortedTags = Array.from(uniqueTags).sort();

      function populateFilterDropdown() {
          let dropdownHtml = `
            <div class="wv-multiselect-option" data-value="all">
              <input type="checkbox" id="wv-cb-all" ${selectedFilters.has('all') ? 'checked' : ''} />
              <label class="wv-multiselect-option-label" for="wv-cb-all">All Categories & Tags</label>
            </div>
            <div class="wv-multiselect-group-title">Categories</div>
            <div class="wv-multiselect-option" data-value="cat:parking">
              <input type="checkbox" id="wv-cb-cat-parking" ${selectedFilters.has('cat:parking') ? 'checked' : ''} />
              <label class="wv-multiselect-option-label" for="wv-cb-cat-parking">Parking</label>
            </div>
            <div class="wv-multiselect-option" data-value="cat:establishment">
              <input type="checkbox" id="wv-cb-cat-est" ${selectedFilters.has('cat:establishment') ? 'checked' : ''} />
              <label class="wv-multiselect-option-label" for="wv-cb-cat-est">Establishments</label>
            </div>
            <div class="wv-multiselect-option" data-value="cat:recreation">
              <input type="checkbox" id="wv-cb-cat-rec" ${selectedFilters.has('cat:recreation') ? 'checked' : ''} />
              <label class="wv-multiselect-option-label" for="wv-cb-cat-rec">Recreation</label>
            </div>
            <div class="wv-multiselect-group-title">Filter by Tag</div>
          `;

          sortedTags.forEach((tag, idx) => {
              const isChecked = selectedFilters.has(`tag:${tag}`);
              dropdownHtml += `
                <div class="wv-multiselect-option" data-value="tag:${tag}">
                  <input type="checkbox" id="wv-cb-tag-${idx}" ${isChecked ? 'checked' : ''} />
                  <label class="wv-multiselect-option-label" for="wv-cb-tag-${idx}">${tag}</label>
                </div>
              `;
          });

          searchFilterDropdown.innerHTML = dropdownHtml;

          // Attach listeners to custom dropdown checkboxes
          searchFilterDropdown.querySelectorAll('.wv-multiselect-option').forEach(option => {
              const cb = option.querySelector('input[type="checkbox"]');
              
              const handleToggle = () => {
                  hasInteracted = true;
                  const val = option.getAttribute('data-value');
                  if (val === 'all') {
                      if (cb.checked) {
                          selectedFilters.clear();
                          selectedFilters.add('all');
                          searchFilterDropdown.querySelectorAll('input[type="checkbox"]').forEach(otherCb => {
                              if (otherCb !== cb) otherCb.checked = false;
                          });
                      } else {
                          selectedFilters.delete('all');
                      }
                  } else {
                      if (cb.checked) {
                          selectedFilters.delete('all');
                          const allCb = document.getElementById('wv-cb-all');
                          if (allCb) allCb.checked = false;
                          selectedFilters.add(val);
                      } else {
                          selectedFilters.delete(val);
                      }
                  }

                  if (selectedFilters.size === 0) {
                      selectedFilters.add('all');
                      const allCb = document.getElementById('wv-cb-all');
                      if (allCb) allCb.checked = true;
                  }

                  updateFilterTriggerText();
                  performSearch();
              };

              option.addEventListener('click', (e) => {
                  if (e.target !== cb && e.target.tagName !== 'LABEL') {
                      cb.checked = !cb.checked;
                      handleToggle();
                  }
              });
              cb.addEventListener('change', handleToggle);
          });
          updateFilterTriggerText();
      }

      populateFilterDropdown();

      function performSearch() {
          hasInteracted = true;
          const term = searchInput.value.toLowerCase();
          
          if (selectedFeatureName && term !== selectedFeatureName.toLowerCase()) {
              selectedFeatureName = null;
          }

          searchResults.innerHTML = '';
          const hasFilter = !selectedFilters.has('all') && selectedFilters.size > 0;

          if (term.length === 0 && !hasFilter) {
              searchResults.classList.remove('active');
              clearHighlights();
              dismissActivePopup();
              updateUrlParams();
              return;
          }

          let results = allFeatures.filter(f => {
              // Custom Multi-select OR logic
              if (hasFilter) {
                  const categories = [];
                  const tags = [];
                  selectedFilters.forEach(val => {
                      if (val.startsWith('cat:')) categories.push(val.slice(4));
                      else if (val.startsWith('tag:')) tags.push(val.slice(4).toLowerCase());
                  });

                  const categoryMatch = categories.includes(f._source);
                  const featureTags = (f.properties.tags || '').toLowerCase().split(',').map(t => t.trim());
                  const tagMatch = featureTags.some(t => tags.includes(t));

                  // Match category OR tag
                  if (!categoryMatch && !tagMatch) return false;
              }

              if (term.length > 0) {
                  const nameMatch = (f.properties.name || '').toLowerCase().includes(term);
                  const descMatch = (f.properties.description || '').toLowerCase().includes(term);
                  const tagsMatch = (f.properties.tags || '').toLowerCase().includes(term);
                  return nameMatch || descMatch || tagsMatch;
              }
              return true;
          });

          if (results.length > 0 && term.length > 0) {
              searchResults.classList.add('active');
              results.forEach(f => {
                  const div = document.createElement('div');
                  div.className = 'wv-search-result-item';
                  div.innerHTML = `<div class="wv-search-result-title">${f.properties.name}</div>
                                   <div class="wv-search-result-type">${f.properties.tags || f._source}</div>`;
                  div.onclick = () => selectFeature(f);
                  searchResults.appendChild(div);
              });
          } else {
              searchResults.classList.remove('active');
          }

          if (term.length === 0 && hasFilter) {
              // Highlight all matching features in the filter
              const pointFeatures = results.filter(f => f.geometry.type === 'Point');
              const polyFeatures = results.filter(f => f.geometry.type !== 'Point');
              
              setHighlights(pointFeatures, polyFeatures);
              dismissActivePopup();
              
              const bounds = getFeaturesBounds(results);
              if (bounds) {
                  if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
                      map.flyTo({ center: bounds[0], zoom: 18 });
                  } else {
                      map.fitBounds(bounds, { padding: 60, maxZoom: 18 });
                  }
              }
          } else if (!selectedFeatureName) {
              // Clear highlights if no specific feature is selected
              clearHighlights();
          }

          updateUrlParams();
      }

      function getFeaturesBounds(features) {
          if (!features || features.length === 0) return null;
          let minLng = Infinity, minLat = Infinity;
          let maxLng = -Infinity, maxLat = -Infinity;

          features.forEach(f => {
              let coordsList = [];
              if (f.geometry.type === 'Point') {
                  coordsList = [f.geometry.coordinates];
              } else if (f.geometry.type === 'Polygon') {
                  coordsList = f.geometry.coordinates[0];
              } else if (f.geometry.type === 'MultiPolygon') {
                  f.geometry.coordinates.forEach(poly => {
                      coordsList.push(...poly[0]);
                  });
              } else if (f.geometry.type === 'LineString') {
                  coordsList = f.geometry.coordinates;
              }
              
              coordsList.forEach(coord => {
                  if (coord[0] < minLng) minLng = coord[0];
                  if (coord[0] > maxLng) maxLng = coord[0];
                  if (coord[1] < minLat) minLat = coord[1];
                  if (coord[1] > maxLat) maxLat = coord[1];
              });
          });

          if (minLng === Infinity) return null;
          return [[minLng, minLat], [maxLng, maxLat]];
      }

      applyQuickView = function(viewKey, smoothFit = true) {
          const cleanView = (viewKey || 'all').toLowerCase().trim();
          activeQuickView = (cleanView === 'all') ? null : cleanView;

          if (cleanView === 'all') {
              clearHighlights();
              dismissActivePopup();

              if (smoothFit) {
                  map.fitBounds([
                      [-75.145165, 39.856238],
                      [-75.112685, 39.887555]
                  ], { padding: 10, duration: 800 });
              }
              return;
          }

          if (cleanView === 'parking') {
              dismissActivePopup();
              const parkingFeatures = allFeatures.filter(f => f._source === 'parking');
              const ptFeatures = parkingFeatures.filter(f => f.geometry && f.geometry.type === 'Point');
              const polyFeatures = parkingFeatures.filter(f => f.geometry && f.geometry.type !== 'Point');

              setHighlights(ptFeatures, polyFeatures);

              if (parkingFeatures.length > 0 && smoothFit) {
                  const bounds = getFeaturesBounds(parkingFeatures);
                  if (bounds) {
                      map.fitBounds(bounds, { padding: 40, maxZoom: 18, duration: 800 });
                  }
              }
              return;
          }

          const viewObj = DIRECTORY_VIEWS[cleanView];
          const allowedCategories = viewObj ? viewObj.categories : [];

          const matched = allFeatures.filter(f => {
              const cat = getFeatureCategory(f);
              return cat && allowedCategories.includes(cat);
          });

          const ptFeatures = matched.filter(f => f.geometry && f.geometry.type === 'Point');
          const polyFeatures = matched.filter(f => f.geometry && f.geometry.type !== 'Point');

          setHighlights(ptFeatures, polyFeatures);

          dismissActivePopup();

          if (matched.length > 0 && smoothFit) {
              const bounds = getFeaturesBounds(matched);
              if (bounds) {
                  map.fitBounds(bounds, { padding: 50, maxZoom: 18, duration: 800 });
              }
          }
      };

      // Helper to compute a geographic coordinate offset by pixels in screen space
      function getOffsetCenter(coordinates, yOffsetPixels, targetZoom) {
          const zoom = targetZoom !== undefined ? targetZoom : (map ? map.getZoom() : 14.25);
          const lat = coordinates[1];
          const cosLat = Math.cos(lat * Math.PI / 180);
          const latOffset = (yOffsetPixels * cosLat * 1.40625) / Math.pow(2, zoom);
          return [coordinates[0], lat + latOffset];
      }

      // Helper to dynamically pan the map if a popup goes partially off-screen
      function ensurePopupInView(popup) {
          const popupEl = popup.getElement();
          if (!popupEl) return;

          const rect = popupEl.getBoundingClientRect();
          const mapRect = map.getContainer().getBoundingClientRect();

          const H = mapRect.bottom - mapRect.top;
          const h = rect.bottom - rect.top;

          let dx = 0;
          let dy = 0;

          // 1. Detect left/right overflow with 15px padding
          if (rect.left < mapRect.left) {
              dx = mapRect.left - rect.left + 15;
          } else if (rect.right > mapRect.right) {
              dx = mapRect.right - rect.right - 15;
          }

          // 2. Detect top/bottom overflow
          if (h + 40 > H) {
              // If the popup is too tall to fit in the viewport with padding,
              // align the top of the popup with the top of the map (plus 10px padding)
              // so that it can be read, as requested by the user.
              dy = mapRect.top - rect.top + 10;
          } else {
              // If it fits, make sure both popup and marker tip are onscreen
              if (rect.top < mapRect.top) {
                  dy = mapRect.top - rect.top + 15;
                  // Cap dy to prevent pushing the marker tip off-screen at the bottom
                  const markerPixel = map.project(popup.getLngLat());
                  const maxDy = mapRect.bottom - 20 - markerPixel.y;
                  if (dy > maxDy) {
                      dy = Math.max(0, maxDy);
                  }
              } else if (rect.bottom > mapRect.bottom) {
                  dy = mapRect.bottom - rect.bottom - 15;
                  // Cap dy to prevent pushing the marker tip off-screen at the top
                  const markerPixel = map.project(popup.getLngLat());
                  const minDy = mapRect.top + 20 - markerPixel.y;
                  if (dy < minDy) {
                      dy = Math.min(0, minDy);
                  }
              }
          }

          if (dx !== 0 || dy !== 0) {
              const mapCenterPixel = map.project(map.getCenter());
              const newCenterPixel = [mapCenterPixel.x - dx, mapCenterPixel.y - dy];
              const newCenterCoords = map.unproject(newCenterPixel);
              map.easeTo({ center: newCenterCoords, duration: 300 });
          }
      }

      function selectFeature(f, isTour = false) {
          if (!isTour) {
              stopTour();
          }
          selectedFeatureName = f.properties.name;
          searchInput.value = f.properties.name;
          searchResults.classList.remove('active');
          
          // Clear any active popup with a smooth fade-out before starting transitions
          dismissActivePopup();
          
          if (f.geometry.type === 'Point') {
               setHighlights(f, []);
               // Shift center upward in screen space to fit popup above feature (responsive zoom/offset)
               const targetZoom = isMobileDevice() ? 17 : 18;
               const verticalOffset = isMobileDevice() ? 90 : 130;
               const offsetCenter = getOffsetCenter(f.geometry.coordinates, verticalOffset, targetZoom);
               
               // Use highly polished, smooth, cinematic camera transitions for the tours
               const flightDuration = isTour ? 3200 : 1200;
               map.flyTo({
                   center: offsetCenter,
                   zoom: targetZoom,
                   duration: flightDuration,
                   essential: true
               });
               
               // Delay popup opening until the flight completes to ensure perfect alignment and high polish
               map.once('moveend', () => {
                   if (selectedFeatureName === f.properties.name) {
                       showPopup(f, f.geometry.coordinates);
                   }
               });
          } else {
              setHighlights([], f);
              const bounds = getFeaturesBounds([f]);
              if (bounds) {
                  // Asymmetric bounds padding leaves ample space on top for popups
                  const flightDuration = isTour ? 3200 : 1200;
                  map.fitBounds(bounds, {
                      padding: { top: 180, bottom: 60, left: 60, right: 60 },
                      maxZoom: 18,
                      duration: flightDuration,
                      essential: true
                  });
                  
                  const center = [(bounds[0][0]+bounds[1][0])/2, (bounds[0][1]+bounds[1][1])/2];
                  // Delay popup opening until the bounds transition completes
                  map.once('moveend', () => {
                      if (selectedFeatureName === f.properties.name) {
                          showPopup(f, center);
                      }
                  });
              }
          }
          hasInteracted = true;
          updateUrlParams();
      }

      let activePopup = null;
      let activePopupData = null;

      map.on('resize', () => {
          if (activePopup) {
              ensurePopupInView(activePopup);
          }
      });

      function dismissActivePopup() {
          activePopupData = null;
          if (!activePopup) return Promise.resolve();
          const popup = activePopup;
          activePopup = null; // Clear instantly so other flows know it's being removed
          
          const popupEl = popup.getElement();
          if (popupEl) {
              const contentEl = popupEl.querySelector('.maplibregl-popup-content');
              const tipEl = popupEl.querySelector('.maplibregl-popup-tip');
              if (contentEl) {
                  const animStyle = 'popupContentFadeOut 0.5s cubic-bezier(0.16, 1, 0.3, 1) both';
                  contentEl.style.animation = animStyle;
                  if (tipEl) {
                      tipEl.style.animation = animStyle;
                  }
                  return new Promise(resolve => {
                      setTimeout(() => {
                          popup.remove();
                          resolve();
                      }, 480);
                  });
              }
          }
          popup.remove();
          return Promise.resolve();
      }

      function showPopup(feature, coordinates) {
          if (activePopup) activePopup.remove();
          //console.log(coordinates);
          const props = feature.properties;
          const cleanName = sanitizeHtml(props.name || 'Unnamed');
          const cleanDesc = sanitizeHtml(props.description || '');
          const cleanAddress = sanitizeHtml(props.address || '');
          const cleanTags = sanitizeHtml(props.tags || '');

          activePopupData = {
              feature: feature,
              coordinates: coordinates,
              props: props
          };

          const linkedName = props.url != null ? `
              <a class="wv-popup-title-link" target="_blank" href="${encodeURI(props.url)}">
                  <span>${cleanName}</span>
                  <svg class="wv-title-link-icon" viewBox="0 0 24 24"><path d="M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3H14Z"/></svg>
              </a>` : `${cleanName}`;
          
          // Accessible phone & address markup with SVG icons
          const phone = props.phone != null ? `
              <p class="wv-opensans wv-popup-detail">
                  <svg class="wv-popup-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.79 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  <a href="tel:${props.phone.replace(/\D/g, '')}" title="Call ${cleanName}">${sanitizeHtml(props.phone)}</a>
              </p>` : '';
              
          const address = cleanAddress ? `
              <p class="wv-opensans wv-popup-detail">
                  <svg class="wv-popup-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <span>${cleanAddress}, Westville, NJ 08093</span>
              </p>` : '';
              
          let lat, lng;
          if (!Array.isArray(coordinates)){
            lng = coordinates['lng'];
            lat = coordinates['lat'];
          } else {
            lng = coordinates[0];
            lat = coordinates[1];
          }
          const placeId = (props.id && typeof props.id === 'string' && !/^(mock|vendor)-/i.test(props.id.trim())) ? props.id.trim() : '';
          const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${placeId ? `&destination_place_id=${encodeURIComponent(placeId)}` : ''}`;
          // Set focusAfterOpen to false so that the browser does not scroll/jump the page or iframe to focus the popup close button
          activePopup = new maplibregl.Popup({ focusAfterOpen: false, anchor: 'bottom' })
              .setLngLat(coordinates)
              .setHTML(`<div class="wv-map-popup">
                  <h3 class="wv-opensans">${linkedName}</h3>
                  ${cleanTags ? `
                  <p class="wv-opensans wv-popup-detail">
                      <svg class="wv-popup-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                      <span><strong>Tags:</strong> ${cleanTags}</span>
                  </p>` : ''}
                  <p class="wv-opensans" style="margin-top: 8px;">${cleanDesc}</p>
                  <hr>
                  ${phone}
                  ${address}
                  <a class="wv-directions-btn" target="_blank" href="${directionsUrl}" title="Google Maps Directions to ${cleanName}">
                      <svg class="wv-btn-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                      <span>Directions</span>
                  </a>
              </div>`)
              .addTo(map);

          activePopup.on('open', () => {
              // Run immediately for instant loads or static openings
              requestAnimationFrame(() => ensurePopupInView(activePopup));
              // Fallback with a short timeout to handle layout/rendering delay or race conditions
              setTimeout(() => {
                  if (activePopup) {
                      ensurePopupInView(activePopup);
                  }
              }, 150);
              // Run again when any active camera flight completes to ensure perfect alignment
              map.once('moveend', () => ensurePopupInView(activePopup));
          });

          activePopup.on('close', () => {
              activePopupData = null;
              if (selectedFeatureName === props.name) {
                  selectedFeatureName = '';
                  searchInput.value = '';
                  clearHighlights();
                  updateUrlParams();
              }
          });
      }

      searchInput.addEventListener('input', performSearch);
      let lastMapVisible = null;

      updateUrlParams = function() {
          const newParams = new URLSearchParams();
          
          // Synchronize layerStates from layer control checkboxes if rendered
          const layerCheckboxes = document.querySelectorAll('.layer-control-item input[type="checkbox"]');
          if (layerCheckboxes.length > 0) {
              layerCheckboxes.forEach(cb => {
                  const item = cb.closest('.layer-control-item');
                  if (item) {
                      const labelEl = item.querySelector('.layer-control-name');
                      const title = labelEl ? labelEl.getAttribute('title') : '';
                      const layerId = Object.keys(layerStates).find(id => id === title || layerStates[id].name === title);
                      if (layerId) {
                          layerStates[layerId].visible = cb.checked;
                      }
                  }
              });
          }

          // Check if current layer states match any FOCUS_PRESETS exactly
          let matchedPreset = null;
          for (const [presetKey, preset] of Object.entries(FOCUS_PRESETS)) {
              const matchesVisible = preset.visible.every(f => layerStates[LAYER_ID_MAP[f]]?.visible);
              const matchesHidden = preset.hidden.every(f => !layerStates[LAYER_ID_MAP[f]]?.visible);
              if (matchesVisible && matchesHidden) {
                  matchedPreset = presetKey;
                  break;
              }
          }

          if (matchedPreset) {
              newParams.set('focus', matchedPreset);
          } else {
              const defaultLayers = ['parking', 'establishments', 'recreation', 'satellite', 'map', 'labels'];
              const isDefaultAll = defaultLayers.every(f => layerStates[LAYER_ID_MAP[f]]?.visible);
              if (!isDefaultAll) {
                  const hidden = defaultLayers.filter(f => !layerStates[LAYER_ID_MAP[f]]?.visible);
                  const thematic = ['parking', 'establishments', 'recreation'];
                  const allThematicHidden = thematic.every(f => hidden.includes(f));
                  if (allThematicHidden && hidden.length === 3) {
                      newParams.set('hide', 'all');
                  } else if (hidden.length > 0) {
                      newParams.set('hide', hidden.join(','));
                  }
              }
          }

          if (imageryProvider === 'esri') {
              newParams.set('imagery', 'esri');
          }

          // Dynamically adjust satellite opacity based on Map (Background) layer checkbox state changes
          let mapVisible = layerStates['Background'].visible;
          if (lastMapVisible === null) {
              lastMapVisible = mapVisible;
          } else if (mapVisible !== lastMapVisible) {
              if (map.getLayer('satellite-layer') || map.getLayer('satellite-esri-layer')) {
                  const newOpacity = mapVisible ? 0.3 : 1.0;
                  if (map.getLayer('satellite-layer')) map.setPaintProperty('satellite-layer', 'raster-opacity', newOpacity);
                  if (map.getLayer('satellite-esri-layer')) map.setPaintProperty('satellite-esri-layer', 'raster-opacity', newOpacity);
                  layerStates['satellite-layer'].opacity = newOpacity;
                  
                  // Keep UI range slider element in sync
                  const labelSpan = document.querySelector('.layer-control-name[title="Satellite"]');
                  if (labelSpan) {
                      const item = labelSpan.closest('.layer-control-item');
                      if (item) {
                          const slider = item.querySelector('input[type="range"]');
                          if (slider) {
                              slider.value = newOpacity;
                          }
                      }
                  }
              }
              lastMapVisible = mapVisible;
          }

          const term = searchInput.value.trim();
          if (selectedFeatureName) {
              newParams.set('feature', selectedFeatureName);
              newParams.delete('view');
          } else if (term) {
              newParams.set('search', term);
              newParams.delete('view');
          } else if (activeTourName) {
              newParams.set('tour', activeTourName);
              newParams.delete('view');
          } else if (!selectedFilters.has('all') && selectedFilters.size > 0) {
              const filterValues = [];
              selectedFilters.forEach(val => {
                  if (val === 'all') return;
                  const cleanVal = val.startsWith('tag:') || val.startsWith('cat:') ? val.split(':')[1] : val;
                  if (!filterValues.some(v => v.toLowerCase() === cleanVal.toLowerCase())) {
                      filterValues.push(cleanVal);
                  }
              });
              if (filterValues.length > 0) {
                  newParams.set('filter', filterValues.join(','));
              }
              newParams.delete('view');
          } else if (activeQuickView) {
              newParams.set('view', activeQuickView);
          }
          
          if (hasInteracted) {
              const newUrl = window.location.pathname + '?' + newParams.toString();
              window.history.replaceState(null, '', newUrl);

              // Post state change to parent window
              if (window.parent && window.parent !== window) {
                  window.parent.postMessage({
                      type: 'westville-map-state-change',
                      url: window.location.origin + window.location.pathname + '?' + newParams.toString()
                  }, '*');
              }
          }
          syncMapStyleState();
      }

      // Update background text and enforce initial checkbox state
      waitForElement('span.layer-control-name[title="Background"]').then(bkgrndtxt => {
          bkgrndtxt.innerText = 'Map';
          // Fix for maplibre-gl-layer-control checkbox sync issue
          const container = bkgrndtxt.closest('label') || bkgrndtxt.parentElement;
          if (container) {
              const checkbox = container.querySelector('input[type="checkbox"]');
              if (checkbox && layerStates['Background'] && !layerStates['Background'].visible) {
                  checkbox.checked = false;
              }
          }
      });

      waitForElement('span.layer-control-name[title="Labels"]').then(labelstxt => {
          const container = labelstxt.closest('label') || labelstxt.parentElement;
          if (container) {
              const checkbox = container.querySelector('input[type="checkbox"]');
              if (checkbox && layerStates['map-labels'] && !layerStates['map-labels'].visible) {
                  checkbox.checked = false;
              }
          }
      });
      
      // Listen for layer control checkbox changes to sync URL and set interaction state
      waitForElement('.layer-control-panel').then(panel => {
          panel.addEventListener('change', (e) => {
              hasInteracted = true;

              // Enforce that at least one of Map (Background) and Satellite is checked
              const mapCheckbox = document.querySelector('span.layer-control-name[title="Background"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
              const satelliteCheckbox = document.querySelector('span.layer-control-name[title="Satellite"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
              
              if (mapCheckbox && satelliteCheckbox) {
                  if (!mapCheckbox.checked && !satelliteCheckbox.checked) {
                      if (e.target === mapCheckbox) {
                          satelliteCheckbox.click();
                      } else if (e.target === satelliteCheckbox) {
                          mapCheckbox.click();
                      }
                  }
              }

              // Update userOverlayPreferences for any changed layer control checkboxes
              const targetItem = e.target.closest('.layer-control-item');
              if (targetItem) {
                  const labelEl = targetItem.querySelector('.layer-control-name');
                  const title = labelEl ? labelEl.getAttribute('title') : '';
                  const layerId = Object.keys(layerStates).find(id => id === title || layerStates[id].name === title);
                  if (layerId && userOverlayPreferences[layerId] !== undefined) {
                      userOverlayPreferences[layerId] = e.target.checked;
                  }
              }

              updateUrlParams();
              syncMapStyleState();
          });

          // Forward range slider changes for Satellite opacity to both raster layers
          panel.addEventListener('input', (e) => {
              if (e.target && e.target.type === 'range') {
                  const item = e.target.closest('.layer-control-item');
                  const labelSpan = item?.querySelector('.layer-control-name[title="Satellite"]');
                  if (labelSpan) {
                      const newOpacity = parseFloat(e.target.value);
                      if (map.getLayer('satellite-esri-layer')) {
                          map.setPaintProperty('satellite-esri-layer', 'raster-opacity', newOpacity);
                      }
                      if (map.getLayer('satellite-layer')) {
                          map.setPaintProperty('satellite-layer', 'raster-opacity', newOpacity);
                      }
                      layerStates['satellite-layer'].opacity = newOpacity;
                  }
              }
          });
      });

      // Inject imagery sub-selector under Satellite in layer control panel
      waitForElement('span.layer-control-name[title="Satellite"]').then(satSpan => {
          const item = satSpan.closest('.layer-control-item');
          if (item && !item.querySelector('.imagery-sub-control')) {
              const subControl = document.createElement('div');
              subControl.className = 'imagery-sub-control';
              subControl.innerHTML = `
                  <button type="button" class="imagery-sub-btn ${imageryProvider === 'njgin' ? 'active' : ''}" data-imagery="njgin" title="NJGIN Aerial Orthophotography (Spring 2020, 1ft resolution)">NJ 2020 (1ft)</button>
                  <button type="button" class="imagery-sub-btn ${imageryProvider === 'esri' ? 'active' : ''}" data-imagery="esri" title="Esri World Imagery (Aug 2025, 0.5m resolution)">Esri 2025</button>
              `;
              subControl.addEventListener('click', (e) => {
                  const btn = e.target.closest('.imagery-sub-btn');
                  if (!btn) return;
                  const newProvider = btn.getAttribute('data-imagery');
                  if (newProvider && newProvider !== imageryProvider) {
                      hasInteracted = true;
                      setImageryProvider(newProvider);
                      
                      const satCb = item.querySelector('input[type="checkbox"]');
                      if (satCb && !satCb.checked) {
                          satCb.click();
                      }
                  }
              });
              item.appendChild(subControl);
          }
      });
      
      // Hide highlight layers from the layer control UI
      waitForElement('.layer-control-name[title="highlight-point-layer"]').then(el => {
          const item = el.closest('.layer-control-item');
          if (item) item.style.display = 'none';
      });
      waitForElement('.layer-control-name[title="highlight-poly-layer"]').then(el => {
          const item = el.closest('.layer-control-item');
          if (item) item.style.display = 'none';
      });

      function shuffleArray(array) {
          const arr = [...array];
          for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
      }

      function playTourStep() {
          if (!tourActive || tourFeatures.length === 0) return;
          const f = tourFeatures[tourIndex];
          selectFeature(f, true); // Pass true to indicate it's a tour selection
          
          tourIntervalId = setTimeout(() => {
              if (!tourActive) return;
              
              let nextIndex = tourIndex + 1;
              if (nextIndex >= tourFeatures.length) {
                  tourFeatures = shuffleArray(tourFeatures);
                  nextIndex = 0;
              }
              
              tourIndex = nextIndex;
              dismissActivePopup().then(() => {
                  if (tourActive) {
                      playTourStep();
                  }
              });
          }, 8000); // 8 seconds per feature
      }

      function stopTour() {
          if (!tourActive) return;
          tourActive = false;
          if (tourIntervalId) {
              clearTimeout(tourIntervalId);
              tourIntervalId = null;
          }
          activeTourName = null;
          updateUrlParams();
      }

      // Initialize Search UI from URL params
      const initUrl = new URLSearchParams(window.location.search);
      const urlFilter = initUrl.get('filter');
      if (urlFilter) {
          selectedFilters.clear();
          const filterParts = urlFilter.split(',').map(s => s.trim().toLowerCase());
          
          filterParts.forEach(part => {
              const matchingCat = ['parking', 'establishment', 'recreation'].find(c => c.toLowerCase() === part);
              if (matchingCat) {
                  selectedFilters.add('cat:' + matchingCat);
              } else {
                  const matchingTag = sortedTags.find(t => t.toLowerCase() === part);
                  if (matchingTag) {
                      selectedFilters.add('tag:' + matchingTag);
                  } else {
                      const exactTag = sortedTags.find(t => t === part);
                      if (exactTag) {
                          selectedFilters.add('tag:' + exactTag);
                      }
                  }
              }
          });
          
          if (selectedFilters.size === 0) {
              selectedFilters.add('all');
          }
          
          populateFilterDropdown();
      }
      // Defer deep-link zooms and default camera bounds until map layout is fully stable
      map.once('idle', () => {
          const initFeature = initUrl.get('feature');
          const initSearchStr = initUrl.get('search');
          const gpsParam = initUrl.get('gps');
          
          // Initialize Tour feature if 'tour' URL parameter is present
          const tourParam = initUrl.get('tour');
          let isTourStarted = false;
          if (tourParam) {
              const cleanTour = tourParam.toLowerCase().trim();
              let matchedFeatures = [];
              let tourType = '';
              
              if (cleanTour === 'businesses' || cleanTour === 'business') {
                  matchedFeatures = allFeatures.filter(f => f._source === 'establishment' && f.properties.class !== 'Public Resource');
                  tourType = 'businesses';
              } else if (['parks-and-rec', 'parks', 'parking', 'recreation', 'parks_and_rec', 'parks and rec + parking'].includes(cleanTour)) {
                  matchedFeatures = allFeatures.filter(f => f._source === 'recreation' || f._source === 'parking');
                  tourType = 'parks';
              } else if (['public-resources', 'public', 'public_resources', 'public resources'].includes(cleanTour)) {
                  matchedFeatures = allFeatures.filter(f => f._source === 'establishment' && f.properties.class === 'Public Resource');
                  tourType = 'public-resources';
              } else if (cleanTour === 'borough') {
                  // Combined public parks, recreation, parking, and public resources
                  matchedFeatures = allFeatures.filter(f => 
                      f._source === 'recreation' || 
                      f._source === 'parking' || 
                      (f._source === 'establishment' && f.properties.class === 'Public Resource')
                  );
                  tourType = 'borough';
              }
              
              if (matchedFeatures.length > 0) {
                  activeTourName = tourType;
                  tourActive = true;
                  
                  // Randomize features list on page load
                  let finalFeatures = [];
                  if (initFeature) {
                      const matchIdx = matchedFeatures.findIndex(f => (f.properties.name || '').toLowerCase() === initFeature.toLowerCase());
                      if (matchIdx !== -1) {
                          // Keep deep-linked feature first, randomize the rest
                          const firstFeature = matchedFeatures[matchIdx];
                          const otherFeatures = matchedFeatures.filter((_, idx) => idx !== matchIdx);
                          finalFeatures = [firstFeature, ...shuffleArray(otherFeatures)];
                      } else {
                          finalFeatures = shuffleArray(matchedFeatures);
                      }
                  } else {
                      finalFeatures = shuffleArray(matchedFeatures);
                  }
                  
                  tourFeatures = finalFeatures;
                  tourIndex = 0;
                  isTourStarted = true;
                  
                  playTourStep();
                  
                  // Register interaction hooks to automatically stop tour when user interacts
                  const canvas = map.getCanvas();
                  canvas.addEventListener('mousedown', stopTour, { passive: true });
                  canvas.addEventListener('touchstart', stopTour, { passive: true });
                  canvas.addEventListener('wheel', stopTour, { passive: true });
                  
                  if (searchInput) {
                      searchInput.addEventListener('focus', stopTour);
                  }
                  
                  waitForElement('.layer-control-panel').then(panel => {
                      panel.addEventListener('change', stopTour);
                  });
              }
          }
          
          if (!isTourStarted) {
              if (gpsParam) {
                  const coords = gpsParam.split(',').map(Number);
                  if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                      const lat = coords[0];
                      const lng = coords[1];
                      
                      const popup = new maplibregl.Popup({ offset: 25, focusAfterOpen: false })
                          .setHTML(`<div class="wv-map-popup">
                              <h3 class="wv-opensans" style="font-weight: bold;">Shared location</h3>
                              <p class="wv-opensans wv-popup-detail" style="margin: 0;">
                                  <svg class="wv-popup-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                  <span>Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
                              </p>
                              <hr>
                              <a class="wv-directions-btn" target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" title="Google Maps Directions to Shared Location">
                                  <svg class="wv-btn-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                                  <span>Directions</span>
                              </a>
                          </div>`);
                      
                      const marker = new maplibregl.Marker({ color: '#ef4444' })
                          .setLngLat([lng, lat])
                          .setPopup(popup)
                          .addTo(map);
                      
                      activePopup = popup;
                      marker.togglePopup();
                      map.flyTo({ center: [lng, lat], zoom: 16 });
                  }
              } else if (initFeature) {
                  const match = allFeatures.find(f => (f.properties.name||'').toLowerCase() === initFeature.toLowerCase());
                  if (match) {
                      selectFeature(match);
                  }
              } else if (initUrl.get('view')) {
                  applyQuickView(initUrl.get('view'), false);
              } else if (initSearchStr || initUrl.get('filter')) {
                  if (initSearchStr) searchInput.value = initSearchStr;
                  performSearch();
              } else {
                  map.fitBounds([
                      [-75.145165, 39.856238],
                      [-75.112685, 39.887555]
                  ], {
                      padding: 10,
                      duration: 1000
                  });
              }
              hasInteracted = false; // Prevent initial programmatic setup from broadcasting state changes
              updateUrlParams();
          }
      });

      // Sync map state with parent directory searching/filtering
      window.addEventListener('message', (event) => {
          // Security check: Accept messages from parent host window or same window
          if (event.source !== window.parent && event.source !== window) return;

          if (event.data && event.data.type === 'apply-quick-view') {
              stopTour();
              applyQuickView(event.data.view, true);
              hasInteracted = true;
              updateUrlParams();
              return;
          }

          if (event.data && event.data.type === 'clear-highlight') {
              clearHighlights();
              dismissActivePopup();
              
              selectedFeatureName = null;
              if (searchInput) searchInput.value = '';
              if (searchResults) {
                  searchResults.innerHTML = '';
                  searchResults.classList.remove('active');
              }
              hasInteracted = true;
              updateUrlParams();
              return;
          }

          if (event.data && event.data.type === 'stop-tour') {
              stopTour();
              return;
          }

          if (event.data && event.data.type === 'directory-results-update') {
              const results = event.data.features || [];
              const isUnfiltered = event.data.isUnfiltered;

              // Clear map's own search and filter inputs to avoid UI confusion
              if (searchInput) searchInput.value = '';
              if (searchResults) {
                  searchResults.innerHTML = '';
                  searchResults.classList.remove('active');
              }
              selectedFeatureName = null;
              if (selectedFilters) {
                  selectedFilters.clear();
                  selectedFilters.add('all');
                  updateFilterTriggerText();
                  const allCb = document.getElementById('wv-cb-all');
                  if (allCb) {
                      allCb.checked = true;
                  }
                  document.querySelectorAll('#wv-search-filter-dropdown input[type="checkbox"]').forEach(cb => {
                      if (cb !== allCb) cb.checked = false;
                  });
              }

              if (isUnfiltered) {
                  clearHighlights();
                  dismissActivePopup();
                  map.fitBounds([
                      [-75.145165, 39.856238],
                      [-75.112685, 39.887555]
                  ], {
                      padding: 10,
                      duration: 1000
                  });
              } else {
                  const pointFeatures = results.filter(f => f.geometry && f.geometry.type === 'Point');
                  const polyFeatures = results.filter(f => f.geometry && f.geometry.type !== 'Point');

                  setHighlights(pointFeatures, polyFeatures);

                  dismissActivePopup();

                  if (results.length > 0) {
                      const bounds = getFeaturesBounds(results);
                      if (bounds) {
                          if (bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1]) {
                              map.flyTo({ center: bounds[0], zoom: 18 });
                          } else {
                              map.fitBounds(bounds, { padding: 60, maxZoom: 18 });
                          }
                      }
                  } else {
                      clearHighlights();
                  }
              }
          }
      });
  });
} catch (error) {
  console.error('Error loading map:', error);
  if (window.showMapError) {
    window.showMapError(error.message || error);
  }
}

// Handle parent window requests
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'parent-change-imagery') {
        const provider = (event.data.imagery || '').toLowerCase();
        if (provider === 'njgin' || provider === 'esri') {
            hasInteracted = true;
            setImageryProvider(provider);
        }
    }

    if (event.data && event.data.type === 'parent-toggle-layer') {
        const friendlyName = event.data.layer;
        const visible = event.data.visible;
        const layerId = LAYER_ID_MAP[friendlyName];
        if (layerId) {
            hasInteracted = true;
            layerStates[layerId].visible = visible;
            if (userOverlayPreferences[layerId] !== undefined) {
                userOverlayPreferences[layerId] = visible;
            }

            // Directly invoke setLayoutProperty on the map
            if (map) {
                map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
            }

            // If satellite is being toggled off and labels are hidden, automatically restore labels
            if (friendlyName === 'satellite' && !visible && !layerStates['map-labels'].visible) {
                layerStates['map-labels'].visible = true;
                if (map) {
                    map.setLayoutProperty('map-labels', 'visibility', 'visible');
                }
                const labelsSpan = document.querySelector('span.layer-control-name[title="map-labels"], span.layer-control-name[title="Labels"]');
                if (labelsSpan) {
                    const labelsCb = labelsSpan.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
                    if (labelsCb) labelsCb.checked = true;
                }
            }

            // Synchronize the layer control widget checkbox if present
            let labelSpan = document.querySelector(`span.layer-control-name[title="${layerId}"], span.layer-control-name[title="${layerStates[layerId].name}"]`);
            if (!labelSpan && layerId === 'Background') {
                labelSpan = document.querySelector(`span.layer-control-name[title="Map"]`);
            }
            if (labelSpan) {
                const container = labelSpan.closest('.layer-control-item') || labelSpan.closest('label') || labelSpan.parentElement;
                if (container) {
                    const checkbox = container.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = visible;
                    }
                }
            }

            updateUrlParams();
        }
    }

    function captureCompositeMap(mapInstance) {
        const webglCanvas = mapInstance.getCanvas();
        const mapContainer = mapInstance.getContainer();

        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = webglCanvas.width;
        compositeCanvas.height = webglCanvas.height;
        const ctx = compositeCanvas.getContext('2d');

        // 1. Draw base WebGL map layer
        ctx.drawImage(webglCanvas, 0, 0);

        // 2. Determine if a popup or feature is active
        try {
            let targetFeature = null;
            let targetCoords = null;

            if (activePopupData && activePopupData.coordinates) {
                targetFeature = activePopupData.feature;
                targetCoords = activePopupData.coordinates;
            } else if (selectedFeatureName) {
                const found = allFeatures.find(f => (f.properties?.name || '').toLowerCase() === selectedFeatureName.toLowerCase());
                if (found) {
                    targetFeature = found;
                    if (found.geometry?.type === 'Point') {
                        targetCoords = found.geometry.coordinates;
                    } else {
                        const b = getFeaturesBounds([found]);
                        if (b) targetCoords = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
                    }
                }
            }

            if (targetFeature && targetCoords) {
                const rawLng = Array.isArray(targetCoords) ? targetCoords[0] : targetCoords.lng;
                const rawLat = Array.isArray(targetCoords) ? targetCoords[1] : targetCoords.lat;

                // Project geographic coordinates into container screen pixels
                const screenPt = mapInstance.project([rawLng, rawLat]);
                const containerW = mapContainer.clientWidth || mapContainer.offsetWidth || 1;
                const containerH = mapContainer.clientHeight || mapContainer.offsetHeight || 1;
                const scaleX = compositeCanvas.width / containerW;
                const scaleY = compositeCanvas.height / containerH;
                const scale = (scaleX + scaleY) / 2;

                const tipX = screenPt.x * scaleX;
                const tipY = screenPt.y * scaleY;

                // Extract feature details
                const props = targetFeature.properties || {};
                const name = props.name || 'Unnamed';
                const desc = props.description || '';
                const addr = props.address ? `${props.address}, Westville, NJ 08093` : '';
                const phone = props.phone || '';
                const tags = props.tags || '';

                // Calculate bubble layout dimensions
                const popupW = Math.min(300 * scale, compositeCanvas.width - 40 * scale);
                const paddingX = 18 * scale;
                const innerW = popupW - (paddingX * 2);

                // Pre-calculate line wrapping and height
                ctx.font = `${Math.round(13 * scale)}px "Open Sans", -apple-system, sans-serif`;
                const descWords = desc.trim().split(/\s+/).filter(Boolean);
                const descLines = [];
                let curLine = '';
                for (let w of descWords) {
                    const test = curLine ? `${curLine} ${w}` : w;
                    if (ctx.measureText(test).width > innerW && curLine) {
                        descLines.push(curLine);
                        curLine = w;
                    } else {
                        curLine = test;
                    }
                }
                if (curLine) descLines.push(curLine);

                // Compute total dynamic height
                let contentH = 24 * scale; // top padding
                contentH += 22 * scale; // title
                if (tags) contentH += 18 * scale;
                if (descLines.length > 0) contentH += descLines.length * (16 * scale) + 4 * scale;
                if (addr || phone) contentH += 16 * scale; // divider
                if (phone) contentH += 18 * scale;
                if (addr) contentH += 18 * scale;
                contentH += 36 * scale; // directions button
                contentH += 14 * scale; // bottom padding

                const popupH = contentH;
                let bubbleX = tipX - (popupW / 2);
                let bubbleY = tipY - popupH - (12 * scale);
                let pointDown = true;

                // Clamp to screen bounds
                bubbleX = Math.max(16 * scale, Math.min(compositeCanvas.width - popupW - 16 * scale, bubbleX));
                if (bubbleY < 16 * scale) {
                    // Position below point if near top edge
                    bubbleY = tipY + 12 * scale;
                    pointDown = false;
                }

                // Draw Drop Shadow & Bubble Card
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
                ctx.shadowBlur = 16 * scale;
                ctx.shadowOffsetY = 6 * scale;

                ctx.fillStyle = 'rgba(74, 115, 172, 0.96)';
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = Math.max(1, 1 * scale);
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(bubbleX, bubbleY, popupW, popupH, 12 * scale);
                } else {
                    ctx.rect(bubbleX, bubbleY, popupW, popupH);
                }
                ctx.fill();
                ctx.stroke();

                // Draw Tip Pointer Triangle
                ctx.beginPath();
                const tipBaseW = 10 * scale;
                if (pointDown) {
                    ctx.moveTo(tipX - tipBaseW, bubbleY + popupH);
                    ctx.lineTo(tipX + tipBaseW, bubbleY + popupH);
                    ctx.lineTo(tipX, tipY);
                } else {
                    ctx.moveTo(tipX - tipBaseW, bubbleY);
                    ctx.lineTo(tipX + tipBaseW, bubbleY);
                    ctx.lineTo(tipX, tipY);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // Render Text & Details
                let textY = bubbleY + 24 * scale;

                // Title
                ctx.fillStyle = '#FFFFFF';
                ctx.font = `bold ${Math.round(16 * scale)}px "Open Sans", -apple-system, sans-serif`;
                ctx.fillText(name, bubbleX + paddingX, textY);
                textY += 20 * scale;

                // Tags
                if (tags) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.font = `${Math.round(12 * scale)}px "Open Sans", -apple-system, sans-serif`;
                    ctx.fillText(`Tags: ${tags}`, bubbleX + paddingX, textY);
                    textY += 18 * scale;
                }

                // Description
                if (descLines.length > 0) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.font = `${Math.round(13 * scale)}px "Open Sans", -apple-system, sans-serif`;
                    for (let line of descLines) {
                        ctx.fillText(line, bubbleX + paddingX, textY);
                        textY += 16 * scale;
                    }
                    textY += 4 * scale;
                }

                // Divider (hr)
                if (addr || phone) {
                    ctx.strokeStyle = 'rgba(229, 193, 88, 0.75)';
                    ctx.lineWidth = Math.max(1, 1 * scale);
                    ctx.beginPath();
                    ctx.moveTo(bubbleX + paddingX, textY);
                    ctx.lineTo(bubbleX + popupW - paddingX, textY);
                    ctx.stroke();
                    textY += 16 * scale;
                }

                // Phone
                if (phone) {
                    ctx.fillStyle = '#E5C158';
                    ctx.beginPath();
                    ctx.arc(bubbleX + paddingX + 4 * scale, textY - 4 * scale, 3 * scale, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    ctx.font = `${Math.round(12.5 * scale)}px "Open Sans", -apple-system, sans-serif`;
                    ctx.fillText(phone, bubbleX + paddingX + 14 * scale, textY);
                    textY += 18 * scale;
                }

                // Address
                if (addr) {
                    ctx.fillStyle = '#E5C158';
                    ctx.beginPath();
                    ctx.arc(bubbleX + paddingX + 4 * scale, textY - 4 * scale, 3 * scale, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    ctx.font = `${Math.round(12.5 * scale)}px "Open Sans", -apple-system, sans-serif`;
                    ctx.fillText(addr, bubbleX + paddingX + 14 * scale, textY);
                    textY += 18 * scale;
                }

                // Directions Button
                textY += 4 * scale;
                const btnH = 28 * scale;
                ctx.fillStyle = '#E5C158';
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(bubbleX + paddingX, textY, innerW, btnH, 14 * scale);
                } else {
                    ctx.rect(bubbleX + paddingX, textY, innerW, btnH);
                }
                ctx.fill();

                ctx.fillStyle = '#1E3D60';
                ctx.font = `bold ${Math.round(12 * scale)}px "Open Sans", -apple-system, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText('Directions', bubbleX + paddingX + innerW / 2, textY + btnH / 2 + 4 * scale);
                ctx.textAlign = 'left';
            }
        } catch (popupErr) {
            console.warn('Non-fatal projected popup compositing error:', popupErr);
        }

        return compositeCanvas.toDataURL('image/png');
    }

    if (event.data && event.data.type === 'request-map-capture') {
        try {
            if (!map) {
                throw new Error('Map is not initialized or ready yet.');
            }
            
            // Force map boundary and WebGL viewport synchronization
            map.resize();
            
            // Allow layout and repaint to settle cleanly across animation frames
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    try {
                        const mapImage = captureCompositeMap(map);
                        window.parent.postMessage({
                            type: 'map-capture-response',
                            dataUrl: mapImage
                        }, '*');
                    } catch (err) {
                        console.error('Error in captureCompositeMap, attempting raw canvas fallback:', err);
                        try {
                            const rawUrl = map.getCanvas().toDataURL('image/png');
                            window.parent.postMessage({
                                type: 'map-capture-response',
                                dataUrl: rawUrl
                            }, '*');
                        } catch (fallbackErr) {
                            window.parent.postMessage({
                                type: 'map-capture-error',
                                error: err.message
                            }, '*');
                        }
                    }
                });
            });
        } catch (err) {
            console.error('Error initiating map capture:', err);
            window.parent.postMessage({
                type: 'map-capture-error',
                error: err.message
            }, '*');
        }
    }
});
})();