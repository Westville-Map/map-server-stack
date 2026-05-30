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
      return {[files[index]]: featureJson};
    }));

    return Object.fromEntries(data.map(obj => Object.entries(obj)[0]));
  } catch (error) {
    console.error("One or more requests failed:", error);
  }
}
const geojsonfiles = ['parking', 'establishments', 'recreation'];
const collections = await fetchGeoJsonFiles(geojsonfiles);

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

// Parse URL parameters for layer visibility
const params = new URLSearchParams(window.location.search);
const showParams = params.get('show') ? params.get('show').toLowerCase().split(',') : [];
const hideParams = params.get('hide') ? params.get('hide').toLowerCase().split(',') : [];
console.log(showParams);
console.log(hideParams);

const LAYER_ID_MAP = {
  'parking': 'custom-parking-fill',
  'establishments': 'custom-markers',
  'recreation': 'park-layer-fill',
  'satellite': 'satellite-layer',
  'map': 'Background'
};

const layerStates = {
  'custom-parking-fill': { visible: true, opacity: 0.3, name: 'Parking' },
  'custom-markers': { visible: true, opacity: 1, name: 'Establishments' },
  'park-layer-fill': { visible: true, opacity: 0.3, name: 'Recreation' },
  'satellite-layer': { visible: true, opacity: 0.3, name: 'Satellite' },
  'Background': { visible: true, opacity: 1, name: 'Map' }
};

// Apply URL overrides
const allLayerNames = Object.keys(LAYER_ID_MAP);

// 1. Handle magic 'all' keyword
if (hideParams.includes('all')) {
  allLayerNames.forEach(name => {
    layerStates[LAYER_ID_MAP[name]].visible = false;
  });
} else if (showParams.includes('all')) {
  allLayerNames.forEach(name => {
    layerStates[LAYER_ID_MAP[name]].visible = true;
  });
}

// 2. Apply specific overrides
allLayerNames.forEach(friendlyName => {
  const layerId = LAYER_ID_MAP[friendlyName];
  if (showParams.includes(friendlyName)) {
    layerStates[layerId].visible = true;
  }
  if (hideParams.includes(friendlyName)) {
    layerStates[layerId].visible = false;
  }
});

const bounds = [-75.1390197418999, 39.85893228827481, -75.11407050609648, 39.87873000870905];

try {
  const styleResponse = await fetch('welcome_to_westville.json');
  const style = await styleResponse.json();

  // If the 'Background' (basemap) is supposed to be hidden initially,
  // we apply 'visibility: none' to all layers in the base style JSON 
  // BEFORE initializing the map. This prevents any flickering!
  if (!layerStates['Background'].visible && style.layers) {
      style.layers.forEach(layer => {
          if (!layer.layout) layer.layout = {};
          layer.layout.visibility = 'none';
      });
  }

  let nav = new maplibregl.NavigationControl();
  map = new maplibregl.Map({
      container: 'map',
      style: style,
      center: [-75.12647, 39.870731],
      zoom: 17,
      attributionControl: false
  });

  // Bind to setLayoutProperty in order to toggle fill and symbols simultaneously in layer control widget
  const originalSetLayoutProperty = map.setLayoutProperty.bind(map);
  // Override the method to watch for changes
  map.setLayoutProperty = function (layerId, name, value) {
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
      }
  };

  map.addControl(nav, 'top-left');
  if(!isMobileDevice()) map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');

  map.on('load', async () => {
      const existingImages = {};
      map.on('styleimagemissing', async (e) => {
          if (existingImages[e.id]) return;
          existingImages[e.id] = true;
          const response = await fetch(e.id);
          const svgText = await response.text();
          const svg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
          const image = new Image();
          const promise = new Promise((resolve) => {
              image.onload = resolve;
          });
          image.src = svg;
          await promise; // Wait for the image to load
          map.addImage(e.id, image);
      });

      const parkingicon_image = await map.loadImage('images/parking.png');
      map.addImage('parking-icon', parkingicon_image.data);

      map.addSource('satellite-source', {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: '&copy; ArcGIS'
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

      // add Satellite Map below parking fill layer
      map.addLayer({
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite-source',
          "maxzoom": 18.5,
          layout: {
              'visibility': layerStates['satellite-layer'].visible ? 'visible' : 'none'
          },
          paint: {
              'raster-opacity': 0.3
          }
      }); 
      
      map.addLayer({
          id: 'custom-parking-fill',
          type: 'fill',
          source: 'parking',
          filter: ['==', ['get', 'type'], 'parking'], // Only apply to parking features
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
          filter: ['all', ['==', ['get', 'type'], 'parking']],
          layout: {
              'visibility': layerStates['custom-parking-fill'].visible ? 'visible' : 'none',
              'icon-image': 'images/parking.svg',
              'icon-size': 0.15, // Scale as needed
              'icon-allow-overlap': true,
              'icon-overlap': 'always',
              'text-overlap': 'always'
          }
      });

      map.addLayer({
          id: 'custom-labels',
          type: 'symbol',
          source: 'establishments',
          filter: ['!=', ['get', 'type'], 'parking'],
          layout: {
              'visibility': layerStates['custom-markers'].visible ? 'visible' : 'none',
              'text-field': ['get', 'name'],
              "text-font": ["Noto Sans Regular"],
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top'
          },
          paint: {
              'text-color': '#1f2937',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2
          }
      });

      // B) Render Shop & Restaurant Markers
      map.addLayer({
          id: 'custom-markers',
          type: 'circle',
          source: 'establishments',
          minzoom: 17,
          filter: ['all', 
              ['!=', ['get', 'type'], 'parking'],
              ['!=', ['get', 'type'], 'park'],
              ['!=', ['get', 'type'], 'walkingpath']
          ], // Exclude parking polygons
          layout: {
              'visibility': layerStates['custom-markers'].visible ? 'visible' : 'none'
          },
          paint: {
              'circle-radius': 8,
              'circle-color': [
                  'match',
                  ['get', 'type'],
                  'shop', '#10b981',       // Green
                  'brewery', '#ba103471',
                  'Take Out', '#ba103471',
                  'Banquet Hall', '#ba103471',
                  '#888888'                // Default Gray
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
          }
      });


      map.addLayer({
          id: 'park-layer-fill',
          type: 'fill',
          source: 'recreation',
          filter: ['==', ['get', 'type'], 'park'],
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
          filter: ['==', ['get', 'type'], 'park'],
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
          filter: ['==', ['get', 'type'], 'walkingpath'],
          layout: {
              'visibility': layerStates['park-layer-fill'].visible ? 'visible' : 'none'
          },
          paint: {
              'line-color': '#804703',
              'line-width': 3
          }
      });
      
      map.addLayer({
          id: 'park-layer-symbols',
          type: 'symbol',
          source: 'recreation',
          filter: ['all', ['==', ['get', 'type'], 'park']],
          layout: {
              'visibility': layerStates['park-layer-fill'].visible ? 'visible' : 'none',
              'icon-image': 'images/park.svg',
              'icon-size': 0.09, // Scale as needed
              'icon-allow-overlap': true,
              'icon-overlap': 'always',
              'text-overlap': 'always',
              'text-field': ['get', 'name'],
              "text-font": ["Noto Sans Regular"],
              'text-size': 12,
              'text-offset': [0, 1.2],
              'text-anchor': 'top'
          },
          paint: {
              'text-color': '#1f2937',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2
          }
      });

      const layerControl = new LayerControl({
          collapsed: isMobileDevice(),
          showStyleEditor: true,
          showOpacitySlider: true,
          layerStates: layerStates,
          layers: ['satellite-layer', 'custom-parking-fill', 'custom-markers', 'park-layer-fill'],
          basemapStyleUrl: '/welcome_to_westville.json',
          panelWidth: 320,
          panelMinWidth: 320,
          panelMaxWidth: 320
      });
      map.addControl(layerControl, 'top-right');

      map.addControl(new maplibregl.AttributionControl({compact: true}), 'bottom-left');
      document.querySelector("details.maplibregl-ctrl-attrib").classList.remove('maplibregl-compact-show');
      document.querySelector("span.layer-control-panel-title").innerText = 'Welcome to Westville';
      
      // 8. Interactivity: Popups on click
      map.on('click', (e) => {
          const features = map.queryRenderedFeatures(e.point, {
              layers: ['custom-markers', 'custom-labels', 'custom-parking-fill', 'park-layer-symbols', 'park-layer-fill', 'walkingpath-outline']
          });

          if (!features.length) return;

          const feature = features[0];
          const props = feature.properties;
          
          // Pin the popup to the marker point, or the mouse location for polygons
          const coordinates = feature.geometry.type === 'Point' 
              ? feature.geometry.coordinates.slice() 
              : e.lngLat;
          const linkedName = props.url != null ? `<a target="_blank" href="${props.url}">${props.name}</a>` : `${props.name}`;
          new maplibregl.Popup()
              .setLngLat(coordinates)
              .setHTML(`
                  <h3 class="wv-opensans">${linkedName}</h3>
                  <p class="wv-opensans"><strong>Type:</strong> ${props.type.charAt(0).toUpperCase() + props.type.slice(1)}</p>
                  <p class="wv-opensans">${props.description || ''}</p>
              `)
              .addTo(map);
      });

      // UI enhancement: change cursor to pointer on hover
      const hoverLayers = ['custom-markers', 'custom-labels', 'custom-parking-fill', 'park-layer-symbols', 'park-layer-fill', 'walkingpath-outline'];
      hoverLayers.forEach(layer => {
          map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer');
          map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '');
      });

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
  });
} catch (error) {
  console.error('Error loading map:', error);
}