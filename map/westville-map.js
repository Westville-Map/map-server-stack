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

import { LayerControl } from 'https://unpkg.com/maplibre-gl-layer-control/dist/index.mjs';
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
//console.log(showParams);
//console.log(hideParams);

// Interaction gate for initial clean boot load (WCAG / UX quality)
let hasInteracted = false;

// Tour feature state
let activeTourName = null;
let tourActive = false;
let tourFeatures = [];
let tourIndex = 0;
let tourIntervalId = null;

const LAYER_ID_MAP = {
  'parking': 'custom-parking-fill',
  'establishments': 'custom-markers',
  'recreation': 'park-layer-fill',
  'satellite': 'satellite-layer',
  'map': 'Background',
  'labels': 'map-labels'
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
const allLayerNames = Object.keys(LAYER_ID_MAP);

if (params.get('show')) {
  if (showParams.includes('all')) {
    allLayerNames.forEach(name => {
      layerStates[LAYER_ID_MAP[name]].visible = true;
    });
  } else {
    // 1. Hide thematic layers not explicitly listed in show
    const thematicLayers = ['parking', 'establishments', 'recreation'];
    thematicLayers.forEach(friendlyName => {
      const layerId = LAYER_ID_MAP[friendlyName];
      if (showParams.includes(friendlyName)) {
        layerStates[layerId].visible = true;
      } else {
        layerStates[layerId].visible = false;
      }
    });

    // 2. Map & Satellite exclusivity / visibility rules
    if (showParams.includes('satellite')) {
      layerStates['satellite-layer'].visible = true;
    } else {
      layerStates['satellite-layer'].visible = false;
    }

    if (showParams.includes('map')) {
      layerStates['Background'].visible = true;
    } else if (showParams.includes('satellite') && !showParams.includes('map')) {
      layerStates['Background'].visible = false;
    }


  }
}

// 3. Handle magic 'all' hide
if (hideParams.includes('all')) {
  allLayerNames.forEach(name => {
    layerStates[LAYER_ID_MAP[name]].visible = false;
  });
} else {
  // Apply specific hides
  hideParams.forEach(friendlyName => {
    const layerId = LAYER_ID_MAP[friendlyName];
    if (layerId) {
      layerStates[layerId].visible = false;
    }
  });
}

// 4. Double check any specific show parameters are explicitly respected (if hide didn't block them)
showParams.forEach(friendlyName => {
  const layerId = LAYER_ID_MAP[friendlyName];
  if (layerId && friendlyName !== 'all') {
    layerStates[layerId].visible = true;
  }
});

// 5. Enforce at least one background layer is visible initially
if (!layerStates['Background'].visible && !layerStates['satellite-layer'].visible) {
  layerStates['Background'].visible = true;
}


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
  const initialZoom = isMobileDevice() ? 12 : 14.25;
  const initialMapVisible = layerStates['Background'].visible;
  const initialSatelliteVisible = layerStates['satellite-layer'].visible;
  const initialUseSatelliteContrastLabels = initialSatelliteVisible && !initialMapVisible && initialZoom < 18.5;

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

  let lastZoomIsGreaterOrEqual = null;
  map.on('zoom', () => {
      const currentZoom = map.getZoom();
      const isGreaterOrEqual = (currentZoom >= 18.5);
      if (lastZoomIsGreaterOrEqual === null || isGreaterOrEqual !== lastZoomIsGreaterOrEqual) {
          lastZoomIsGreaterOrEqual = isGreaterOrEqual;
          syncMapStyleState();
      }
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
      const labelsVisible = labelsCheckbox ? labelsCheckbox.checked : layerStates['map-labels'].visible;

      const currentZoom = map ? map.getZoom() : 14.25;
      const shouldBasemapBeVisible = mapVisible || (satelliteVisible && currentZoom >= 18.5);

      if (layerId === 'map-labels') {
          if (name === 'visibility') {
              const targetValue = (shouldBasemapBeVisible || value === 'visible') ? 'visible' : 'none';
              labelLayers.forEach(lId => {
                  if (map.getLayer(lId)) {
                      originalSetLayoutProperty(lId, 'visibility', targetValue);
                  }
              });
              layerStates['map-labels'].visible = (value === 'visible');
          }
          return; // Intercept completely
      }

      if (labelLayers.includes(layerId) && name === 'visibility') {
          // Force individual style label layers to obey the map-labels checkbox state,
          // but ensure they are always visible if the standard map is active.
          const targetValue = (shouldBasemapBeVisible || labelsVisible) ? 'visible' : 'none';
          originalSetLayoutProperty(layerId, name, targetValue);
          return;
      }

      // Call the original function first so the master layer updates
      originalSetLayoutProperty(layerId, name, value);
  
      // Check if the master layer's visibility is being changed
      if (layerId === 'custom-parking-fill' && name === 'visibility') {
          // Force the dependent layer to match the new value
          originalSetLayoutProperty('parking-layer-symbols', 'visibility', value);
      }
      if (layerId === 'custom-markers' && name === 'visibility') {
          // Force the dependent layer to match the new value
          originalSetLayoutProperty('custom-labels', 'visibility', value);
      }
      if (layerId === 'park-layer-fill' && name === 'visibility') {
          // Force the dependent layer to match the new value
          originalSetLayoutProperty('custom-park-outline', 'visibility', value);
          originalSetLayoutProperty('walkingpath-outline', 'visibility', value);
          originalSetLayoutProperty('park-layer-symbols', 'visibility', value);
          originalSetLayoutProperty('walkingpath-layer-symbol', 'visibility', value);
      }

      if (name === 'visibility') {
          syncMapStyleState();
      }
  };

  function syncMapStyleState() {
      if (!map) return;
      const currentZoom = map.getZoom();

      // Dynamically read checked states from the DOM if available, falling back to layerStates
      const mapCheckbox = document.querySelector('span.layer-control-name[title="Background"], span.layer-control-name[title="Map"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
      const satelliteCheckbox = document.querySelector('span.layer-control-name[title="Satellite"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');
      const labelsCheckbox = document.querySelector('span.layer-control-name[title="Labels"]')?.closest('.layer-control-item')?.querySelector('input[type="checkbox"]');

      const mapVisible = mapCheckbox ? mapCheckbox.checked : layerStates['Background'].visible;
      const satelliteVisible = satelliteCheckbox ? satelliteCheckbox.checked : layerStates['satellite-layer'].visible;
      const labelsVisible = labelsCheckbox ? labelsCheckbox.checked : layerStates['map-labels'].visible;

      // 1. Determine if the basemap style layers (non-labels) should be visible
      const shouldBasemapBeVisible = mapVisible || (satelliteVisible && currentZoom >= 18.5);

      const layers = (style && style.layers) ? style.layers : (map.getStyle() ? map.getStyle().layers : []);
      if (layers && layers.length > 0) {
          layers.forEach(layer => {
              if (labelLayers.includes(layer.id)) {
                  // For label layers, visibility is controlled by labelsVisible in satellite-only mode,
                  // and always visible if standard map is shown.
                  const targetVisibility = (shouldBasemapBeVisible || labelsVisible) ? 'visible' : 'none';
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

      // 2. Apply contrast paint overrides for labels in satellite mode
      const shouldUseSatelliteContrastLabels = satelliteVisible && !mapVisible && currentZoom < 18.5;

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

      // Synchronize lastZoomIsGreaterOrEqual to current zoom state
      lastZoomIsGreaterOrEqual = (currentZoom >= 18.5);
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

      map.addSource('satellite-source', {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, Aerogrid, IGN, IGP, and the GIS User Community'
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

      // add Satellite Map below waterway line label layer (to allow labels to render on top of it)
      map.addLayer({
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite-source',
          maxzoom: 18.5,
          layout: {
              'visibility': layerStates['satellite-layer'].visible ? 'visible' : 'none'
          },
          paint: {
              'raster-opacity': layerStates['Background'].visible ? 0.3 : 1.0
          }
      }, 'waterway_line_label'); 
      
      map.addLayer({
          id: 'custom-parking-fill',
          type: 'fill',
          source: 'parking',
          minzoom: 13.0,
          filter: ['in', 'Parking', ['coalesce', ['get', 'tags'], '']], // Only apply to parking features
          layout: {
              'visibility': layerStates['custom-parking-fill'].visible ? 'visible' : 'none'
          },
          paint: {
              'fill-color': '#3b82f6', // Translucent blue
              'fill-opacity': 0.4
          }
      });

      map.addLayer({
          id: 'parking-layer-symbols',
          type: 'symbol',
          source: 'parking',
          minzoom: 13.0,
          filter: ['in', 'Parking', ['coalesce', ['get', 'tags'], '']],
          layout: {
              'visibility': layerStates['custom-parking-fill'].visible ? 'visible' : 'none',
              'icon-image': 'images/parking.svg',
              'icon-size': 0.15, // Scale as needed
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
          minzoom: 13.0,
          layout: {
              'visibility': layerStates['park-layer-fill'].visible ? 'visible' : 'none'
          },
          paint: {
              'fill-color': '#32a852', // Translucent blue
              'fill-opacity': 0.4
          }
      });

      // Add an outline for the park area
      map.addLayer({
          id: 'custom-park-outline',
          type: 'line',
          source: 'recreation',
          minzoom: 13.0,
          filter: ['in', 'Park', ['coalesce', ['get', 'tags'], '']],
          layout: {
              'visibility': layerStates['park-layer-fill'].visible ? 'visible' : 'none'
          },
          paint: {
              'line-color': '#1f6e34',
              'line-width': 1
          }
      });
      
      map.addLayer({
          id: 'walkingpath-outline',
          type: 'line',
          source: 'recreation',
          minzoom: 13.0,
          filter: ['in', 'Walking Path', ['coalesce', ['get', 'tags'], '']],
          layout: {
              'visibility': layerStates['park-layer-fill'].visible ? 'visible' : 'none'
          },
          paint: {
              'line-color': '#1f6e34',
              'line-width': 3
          }
      });
      
      map.addLayer({
          id: 'walkingpath-layer-symbol',
          type: 'symbol',
          source: 'recreation',
          minzoom: 13.0,
          filter: ['in', 'Walking Path', ['coalesce', ['get', 'tags'], '']],
          layout: {
              'visibility': layerStates['park-layer-fill'].visible ? 'visible' : 'none',
              'icon-image': 'images/person-walking-icon.svg',
              'symbol-placement': 'line-center',
              // 'icon-rotate': 180,
              'icon-keep-upright': true,
              'icon-rotation-alignment': 'map',
              'icon-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                13,  0.1125, // Cut in half (from 0.225)
                15,  0.2625, // Cut in half (from 0.525)
                18,  0.375  // Cut in half (from 0.75)
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
          minzoom: 13.0,
          filter: ['in', 'Park', ['coalesce', ['get', 'tags'], '']],
          layout: {
              'visibility': layerStates['park-layer-fill'].visible ? 'visible' : 'none',
              'icon-image': 'images/park.svg',
              'icon-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12,  0.0225,  // Increased by 25% (from 0.018)
                15,  0.0525,  // Increased by 25% (from 0.042)
                18,  0.075   // Increased by 25% (from 0.06)
              ],
              'icon-allow-overlap': true,
              'icon-overlap': 'always',
              'text-overlap': 'always',
              'text-field': ['get', 'name'],
              "text-font": ["Noto Sans Regular"],
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              "text-variable-anchor": ["top", "bottom", "left", "right"],
              'text-optional': true
          },
          paint: {
              'text-color':'#000000', //'#1f2937',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2
          }
      });


      // B) Render Shop & Restaurant Markers
      map.addLayer({
          id: 'custom-markers',
          type: 'circle',
          source: 'establishments',
          minzoom: 15,
          filter: ['all', 
              ['!', ['in', 'Parking', ['coalesce', ['get', 'tags'], '']]],
              ['!', ['in', 'Park', ['coalesce', ['get', 'tags'], '']]],
              ['!', ['in', 'Walking Path', ['coalesce', ['get', 'tags'], '']]]
          ], // Exclude parking polygons
          layout: {
              'visibility': layerStates['custom-markers'].visible ? 'visible' : 'none'
          },
          paint: {
              'circle-radius': 8,
              'circle-color': [
                  'match',
                  ['coalesce', ['get', 'primary_tag'], ''],
                  ['safety', 'police station', 'fire station', 'police'], '#dc2626',
                  ['brewery', 'bar', 'pub', 'nightlife', 'craft beer', 'liquor store', 'wine', 'beer', 'spirits'], '#d97706',
                  ['restaurant', 'dining', 'food', 'cafe', 'banquet hall', 'event space', 'diner', 'bakery', 'sweets', 'take out', 'takeout', 'bbq', 'dessert', 'cookie cakes', 'cookies', 'pizza'], '#db2777',
                  ['wellness', 'fitness', 'yoga', 'tai chi', 'health', 'umaa', 'salon', 'hair styling', 'barber', 'barbershop', 'kickboxing', 'karate', 'jujitsu', 'doctor'], '#0d9488',
                  ['convenience store', 'retail', 'groceries', 'shop', 'appliances', 'smoke shop', 'tobacco'], '#059669',
                  ['laundry', 'service', 'laundromat', 'locksmith', 'key duplication', 'tax prep', 'bookkeeping', 'it management', 'bail bonds', 'bank'], '#81007F',
                  ['borough offices', 'public resource', 'government', 'library', 'community', 'post office', 'education', 'public elementary school', 'pre-kindergarten school', 'pk-6', 'mail', 'packages', 'po boxes', 'senior center', 'public'], '#2563eb',
                  ['auto repair', 'dealership', 'mechanic', 'mechanic service', 'auto service', 'oil change', 'used cars', 'new cars', 'car wash', 'detailing', 'performance tuning'], '#ffd700',
                  ['park', 'recreation', 'walking path', 'walkingpath'], '#16a34a',
                  ['parking', 'free'], '#2563eb',
                  '#888888' // Default Gray
              ],
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ffffff'
          }
      });


      map.addLayer({
          id: 'custom-labels',
          type: 'symbol',
          source: 'establishments',
          filter: ['all',
              ['!', ['in', 'Parking', ['coalesce', ['get', 'tags'], '']]],
              ['!', ['in', 'Park', ['coalesce', ['get', 'tags'], '']]],
              ['!', ['in', 'Walking Path', ['coalesce', ['get', 'tags'], '']]]
          ],
          layout: {
              'visibility': layerStates['custom-markers'].visible ? 'visible' : 'none',
              'text-field': ['get', 'name'],
              "text-font": ["Noto Sans Regular"],
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top',
              "text-variable-anchor": ["top", "bottom", "left", "right"],
              'text-optional': true
          },
          paint: {
              'text-color':'#000000', //'#1f2937',
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
          
          // Clear previous highlights
          map.getSource('highlight-point-source').setData({ type: 'FeatureCollection', features: [] });
          map.getSource('highlight-poly-source').setData({ type: 'FeatureCollection', features: [] });

           if (feature.geometry.type === 'Point') {
               map.getSource('highlight-point-source').setData(feature);
               // Auto-pan point so popup fits beautifully above feature
               const verticalOffset = isMobileDevice() ? 90 : 130;
               const offsetCenter = getOffsetCenter(coordinates, verticalOffset);
               map.flyTo({ center: offsetCenter });
          } else {
              map.getSource('highlight-poly-source').setData(feature);
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
          }
      });

      document.addEventListener('click', () => {
          searchFilterContainer.classList.remove('active');
          searchFilterTrigger.setAttribute('aria-expanded', 'false');
      });

      searchFilterDropdown.addEventListener('click', (e) => {
          e.stopPropagation();
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
          id: 'highlight-point-layer',
          type: 'circle',
          source: 'highlight-point-source',
          paint: {
              'circle-radius': 12,
              'circle-color': 'transparent',
              'circle-stroke-width': 4,
              'circle-stroke-color': '#ffcc00'
          }
      });
      map.addLayer({
          id: 'highlight-poly-layer',
          type: 'line',
          source: 'highlight-poly-source',
          paint: {
              'line-width': 4,
              'line-color': '#ffcc00'
          }
      });
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
      document.querySelector("span.layer-control-panel-title").innerHTML = '<a href="https://westville.app/" target="_blank">Welcome to Westville</a>';
      
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
              map.getSource('highlight-point-source').setData({ type: 'FeatureCollection', features: [] });
              map.getSource('highlight-poly-source').setData({ type: 'FeatureCollection', features: [] });
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
              
              map.getSource('highlight-point-source').setData({ type: 'FeatureCollection', features: pointFeatures });
              map.getSource('highlight-poly-source').setData({ type: 'FeatureCollection', features: polyFeatures });
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
              map.getSource('highlight-point-source').setData({ type: 'FeatureCollection', features: [] });
              map.getSource('highlight-poly-source').setData({ type: 'FeatureCollection', features: [] });
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

          let dx = 0;
          let dy = 0;

           // Detect top/bottom overflow with 20px padding
           if (rect.top < mapRect.top) {
               dy = mapRect.top - rect.top + 20;
               // Cap dy to prevent pushing the marker tip off-screen at the bottom
               const markerPixel = map.project(popup.getLngLat());
               const maxDy = mapRect.bottom - 40 - markerPixel.y;
               if (dy > maxDy) {
                   dy = Math.max(0, maxDy);
               }
           } else if (rect.bottom > mapRect.bottom) {
               dy = mapRect.bottom - rect.bottom - 20;
               // Cap dy to prevent pushing the marker tip off-screen at the top
               const markerPixel = map.project(popup.getLngLat());
               const minDy = mapRect.top + 40 - markerPixel.y;
               if (dy < minDy) {
                   dy = Math.min(0, minDy);
               }
           }

          // Detect left/right overflow with 20px padding
          if (rect.left < mapRect.left) {
              dx = mapRect.left - rect.left + 20;
          } else if (rect.right > mapRect.right) {
              dx = mapRect.right - rect.right - 20;
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
          
          // Clear previous highlights
          map.getSource('highlight-point-source').setData({ type: 'FeatureCollection', features: [] });
          map.getSource('highlight-poly-source').setData({ type: 'FeatureCollection', features: [] });

          if (f.geometry.type === 'Point') {
               map.getSource('highlight-point-source').setData(f);
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
              map.getSource('highlight-poly-source').setData(f);
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

      function dismissActivePopup() {
          console.log('[Tour debug] dismissActivePopup() triggered. activePopup exists:', !!activePopup);
          if (!activePopup) return Promise.resolve();
          const popup = activePopup;
          activePopup = null; // Clear instantly so other flows know it's being removed
          
          const popupEl = popup.getElement();
          console.log('[Tour debug] popupEl retrieved:', !!popupEl);
          if (popupEl) {
              const contentEl = popupEl.querySelector('.maplibregl-popup-content');
              const tipEl = popupEl.querySelector('.maplibregl-popup-tip');
              console.log('[Tour debug] contentEl found:', !!contentEl, 'tipEl found:', !!tipEl);
              if (contentEl) {
                  console.log('[Tour debug] Applying popupContentFadeOut animation dynamically to content and tip');
                  const animStyle = 'popupContentFadeOut 0.5s cubic-bezier(0.16, 1, 0.3, 1) both';
                  contentEl.style.animation = animStyle;
                  if (tipEl) {
                      tipEl.style.animation = animStyle;
                  }
                  return new Promise(resolve => {
                      setTimeout(() => {
                          console.log('[Tour debug] Animation duration completed. Removing popup from map');
                          popup.remove();
                          resolve();
                      }, 480);
                  });
              }
          }
          console.log('[Tour debug] Fallback: removing popup immediately');
          popup.remove();
          return Promise.resolve();
      }

      function showPopup(feature, coordinates) {
          if (activePopup) activePopup.remove();
          //console.log(coordinates);
          const props = feature.properties;
          const linkedName = props.url != null ? `
              <a class="wv-popup-title-link" target="_blank" href="${props.url}">
                  <span>${props.name}</span>
                  <svg class="wv-title-link-icon" viewBox="0 0 24 24"><path d="M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3H14Z"/></svg>
              </a>` : `${props.name}`;
          
          // Accessible phone & address markup with SVG icons
          const phone = props.phone != null ? `
              <p class="wv-opensans wv-popup-detail">
                  <svg class="wv-popup-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.79 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  <a href="tel:${props.phone.replace(/\D/g, '')}" title="Call ${props.name}">${props.phone}</a>
              </p>` : '';
              
          const address = props.address != null ? `
              <p class="wv-opensans wv-popup-detail">
                  <svg class="wv-popup-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <span>${props.address}, Westville, NJ 08093</span>
              </p>` : '';
              
          let lat, lng;
          if (!Array.isArray(coordinates)){
            lng = coordinates['lng'];
            lat = coordinates['lat'];
          } else {
            lng = coordinates[0];
            lat = coordinates[1];
          }
          // Set focusAfterOpen to false so that the browser does not scroll/jump the page or iframe to focus the popup close button
          activePopup = new maplibregl.Popup({ focusAfterOpen: false })
              .setLngLat(coordinates)
              .setHTML(`<div class="wv-map-popup">
                  <h3 class="wv-opensans">${linkedName}</h3>
                  ${props.tags ? `
                  <p class="wv-opensans wv-popup-detail">
                      <svg class="wv-popup-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                      <span><strong>Tags:</strong> ${props.tags}</span>
                  </p>` : ''}
                  <p class="wv-opensans" style="margin-top: 8px;">${props.description || ''}</p>
                  <hr>
                  ${phone}
                  ${address}
                  <a class="wv-directions-btn" target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" title="Google Maps Directions to ${props.name}">
                      <svg class="wv-btn-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; vertical-align: middle;"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                      <span>Directions</span>
                  </a>
              </div>`)
              .addTo(map);

          activePopup.on('open', () => {
              // Run immediately for instant loads or static openings
              requestAnimationFrame(() => ensurePopupInView(activePopup));
              // Run again when any active camera flight completes to ensure perfect alignment
              map.once('moveend', () => ensurePopupInView(activePopup));
          });

          activePopup.on('close', () => {
              if (selectedFeatureName === props.name) {
                  selectedFeatureName = '';
                  searchInput.value = '';
                  map.getSource('highlight-point-source').setData({ type: 'FeatureCollection', features: [] });
                  map.getSource('highlight-poly-source').setData({ type: 'FeatureCollection', features: [] });
                  updateUrlParams();
              }
          });
      }

      searchInput.addEventListener('input', performSearch);
      let lastMapVisible = null;

      function updateUrlParams() {
          const newParams = new URLSearchParams();
          
           // Compute show/hide based on checkboxes if rendered, otherwise fall back to layerStates
           const currentShows = [];
           const currentHides = [];
           const layerCheckboxes = document.querySelectorAll('.layer-control-item input[type="checkbox"]');
           if (layerCheckboxes.length > 0) {
               layerCheckboxes.forEach(cb => {
                   const item = cb.closest('.layer-control-item');
                   if (item) {
                       const labelEl = item.querySelector('.layer-control-name');
                       const title = labelEl ? labelEl.getAttribute('title') : '';
                       const layerId = Object.keys(layerStates).find(id => id === title || layerStates[id].name === title);
                       if (layerId) {
                           layerStates[layerId].visible = cb.checked; // Synchronize layerStates!
                           const friendly = Object.keys(LAYER_ID_MAP).find(k => LAYER_ID_MAP[k] === layerId);
                           if (friendly) {
                               if (cb.checked) currentShows.push(friendly);
                               else currentHides.push(friendly);
                           }
                       }
                   }
               });
           } else {
               // Fallback to layerStates before checkboxes are rendered
               Object.keys(LAYER_ID_MAP).forEach(friendly => {
                   const layerId = LAYER_ID_MAP[friendly];
                   if (layerStates[layerId]) {
                       if (layerStates[layerId].visible) {
                           currentShows.push(friendly);
                       } else {
                           currentHides.push(friendly);
                       }
                   }
               });
           }

          if (currentShows.length > 0) newParams.set('show', currentShows.join(','));
          if (currentHides.length > 0) newParams.set('hide', currentHides.join(','));

          // Dynamically adjust satellite opacity based on Map (Background) layer checkbox state changes
          let mapVisible = layerStates['Background'].visible;
          if (layerCheckboxes.length > 0) {
              mapVisible = currentShows.includes('map');
          }
          if (lastMapVisible === null) {
              lastMapVisible = mapVisible;
          } else if (mapVisible !== lastMapVisible) {
              if (map.getLayer('satellite-layer')) {
                  const newOpacity = mapVisible ? 0.3 : 1.0;
                  map.setPaintProperty('satellite-layer', 'raster-opacity', newOpacity);
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
          } else if (term) {
              newParams.set('search', term);
          }
          
          if (activeTourName) {
              newParams.set('tour', activeTourName);
          }
          
          if (!selectedFilters.has('all') && selectedFilters.size > 0) {
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

              updateUrlParams();
          });
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
          console.log('[Tour debug] playTourStep called. tourActive:', tourActive, 'tourIndex:', tourIndex, 'total features:', tourFeatures.length);
          if (!tourActive || tourFeatures.length === 0) return;
          const f = tourFeatures[tourIndex];
          console.log('[Tour debug] Selecting feature:', f.properties.name);
          selectFeature(f, true); // Pass true to indicate it's a tour selection
          
          tourIntervalId = setTimeout(() => {
              if (!tourActive) return;
              
              let nextIndex = tourIndex + 1;
              if (nextIndex >= tourFeatures.length) {
                  console.log('[Tour debug] Reached end of tour features list. Reshuffling for next round.');
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
          console.log('[Tour debug] stopTour called. tourActive was:', tourActive);
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
          console.log('[Tour debug] map once idle called. tourParam:', tourParam, 'allFeatures length:', allFeatures.length);
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
              
              console.log('[Tour debug] cleanTour:', cleanTour, 'matchedFeatures count:', matchedFeatures.length);
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
                  
                  console.log('[Tour debug] Starting tour:', tourType, 'with randomized order:', tourFeatures.map(f => f.properties.name));
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
                  if (initFeature.toLowerCase() === 'parking') {
                      selectedFeatureName = 'Parking';
                      if (searchInput) searchInput.value = 'Parking';
                      if (searchResults) searchResults.classList.remove('active');

                      map.getSource('highlight-point-source').setData({ type: 'FeatureCollection', features: [] });

                      const parkingFeatures = collections.parking ? collections.parking.features : [];
                      map.getSource('highlight-poly-source').setData({
                          type: 'FeatureCollection',
                          features: parkingFeatures
                      });

                      const bounds = getFeaturesBounds(parkingFeatures);
                      if (bounds) {
                          map.fitBounds(bounds, {
                              padding: { top: 120, bottom: 60, left: 60, right: 60 },
                              maxZoom: 16
                          });
                      }
                  } else {
                      const match = allFeatures.find(f => (f.properties.name||'').toLowerCase() === initFeature.toLowerCase());
                      if (match) {
                          selectFeature(match);
                      }
                  }
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
          if (event.data && event.data.type === 'clear-highlight') {
              const ptSource = map.getSource('highlight-point-source');
              const polySource = map.getSource('highlight-poly-source');
              if (ptSource) ptSource.setData({ type: 'FeatureCollection', features: [] });
              if (polySource) polySource.setData({ type: 'FeatureCollection', features: [] });
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

          if (event.data && event.data.type === 'directory-results-update') {
              const results = event.data.features || [];
              const isUnfiltered = event.data.isUnfiltered;

              const ptSource = map.getSource('highlight-point-source');
              const polySource = map.getSource('highlight-poly-source');

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
                  if (ptSource) ptSource.setData({ type: 'FeatureCollection', features: [] });
                  if (polySource) polySource.setData({ type: 'FeatureCollection', features: [] });
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

                  if (ptSource) ptSource.setData({ type: 'FeatureCollection', features: pointFeatures });
                  if (polySource) polySource.setData({ type: 'FeatureCollection', features: polyFeatures });

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
                      if (ptSource) ptSource.setData({ type: 'FeatureCollection', features: [] });
                      if (polySource) polySource.setData({ type: 'FeatureCollection', features: [] });
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
    if (event.data && event.data.type === 'parent-toggle-layer') {
        const friendlyName = event.data.layer;
        const visible = event.data.visible;
        const layerId = LAYER_ID_MAP[friendlyName];
        if (layerId) {
            const title = (layerId === 'Background') ? 'Background' : layerStates[layerId].name;
            let labelSpan = document.querySelector(`span.layer-control-name[title="${title}"]`);
            if (!labelSpan && layerId === 'Background') {
                labelSpan = document.querySelector(`span.layer-control-name[title="Map"]`);
            }
            if (labelSpan) {
                const container = labelSpan.closest('label') || labelSpan.parentElement;
                if (container) {
                    const checkbox = container.querySelector('input[type="checkbox"]');
                    if (checkbox && checkbox.checked !== visible) {
                        checkbox.click();
                    }
                }
            } else {
                // Fallback if layer control is not yet rendered
                layerStates[layerId].visible = visible;
                if (map) {
                    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
                }
                updateUrlParams();
            }
        }
    }

    if (event.data && event.data.type === 'request-map-capture') {
        try {
            if (!map) {
                throw new Error('Map is not initialized or ready yet.');
            }
            
            // Force map boundary and WebGL viewport synchronization
            map.resize();
            
            // Register a one-time render handler to capture WebGL synchronously
            map.once('render', () => {
                try {
                    const mapImage = map.getCanvas().toDataURL('image/png');
                    window.parent.postMessage({
                        type: 'map-capture-response',
                        dataUrl: mapImage
                    }, '*');
                } catch (err) {
                    console.error('Error capturing map canvas:', err);
                    window.parent.postMessage({
                        type: 'map-capture-error',
                        error: err.message
                    }, '*');
                }
            });
            
            // Trigger an immediate redraw
            map.triggerRepaint();
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