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

const params = new URLSearchParams(window.location.search);
const showParams = params.get('show') ? params.get('show').toLowerCase().split(',') : [];
const hideParams = params.get('hide') ? params.get('hide').toLowerCase().split(',') : [];
//console.log(showParams);
//console.log(hideParams);

// Interaction gate for initial clean boot load (WCAG / UX quality)
let hasInteracted = false;
if (params.has('show') || params.has('hide') || params.has('filter') || params.has('search') || params.has('feature')) {
    hasInteracted = true;
}

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
      center: [-75.1316, 39.8679],
      zoom: isMobileDevice() ? 12 : 14.25,
      attributionControl: false,
      preserveDrawingBuffer: true
  });

  map.on('zoom', () => {
      const currentZoom = map.getZoom();
      console.log(`The map zoom is changing: ${currentZoom}`);
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
          originalSetLayoutProperty('walkingpath-layer-symbol', 'visibility', value);
      }
  };

 
  if(!isMobileDevice() && window.self === window.top) map.addControl(new maplibregl.FullscreenControl(), 'top-left');
  map.addControl(nav, 'top-left');
  
  map.on('load', async () => {
      const existingImages = {};
      map.on('styleimagemissing', async (e) => {
          if (existingImages[e.id]) return;
          existingImages[e.id] = true;
          console.log(e.id);
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
          maxzoom: 18.5,
          layout: {
              'visibility': layerStates['satellite-layer'].visible ? 'visible' : 'none'
          },
          paint: {
              'raster-opacity': layerStates['Background'].visible ? 0.3 : 1.0
          }
      }); 
      
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

                13, 0.4,
                14,  0.5,  // At zoom level 5 or below, scale factor is 0.5
                15, 0.6,  // At zoom level 10, scale factor is 1.0
                18, 1   // At zoom level 15 or above, scale factor is 2.0
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
              //'icon-size': 0.09, // Scale as needed
              'icon-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12,  0.1,  // At zoom level 5 or below, scale factor is 0.5
                15, 0.5,  // At zoom level 10, scale factor is 1.0
                18, 1   // At zoom level 15 or above, scale factor is 2.0
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
                  'case',
                  // Safety - Red
                  ['any',
                      ['in', 'Safety', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Police Station', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Fire Station', ['coalesce', ['get', 'tags'], '']]
                  ], '#dc2626',
                  // Nightlife & Drinks - Amber
                  ['any',
                      ['in', 'Brewery', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Bar', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Craft Beer', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Nightlife', ['coalesce', ['get', 'tags'], '']]
                  ], '#d97706',
                  // Food & Dining - Rose
                  ['any',
                      ['in', 'Restaurant', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Dining', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Food', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Cafe', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Banquet Hall', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Event Space', ['coalesce', ['get', 'tags'], '']],                      
                      ['in', 'Diner', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Bakery', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Sweets', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Take Out', ['coalesce', ['get', 'tags'], '']]
                  ], '#e11d48',
                  // Wellness & Fitness - Teal
                  ['any',
                      ['in', 'Wellness', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Fitness', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Yoga', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Tai Chi', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Health', ['coalesce', ['get', 'tags'], '']]
                  ], '#0d9488',
                  // Shop & Retail & Services - Emerald
                  ['any',
                      ['in', 'Shop', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Retail', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Groceries', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Convenience Store', ['coalesce', ['get', 'tags'], '']]
                  ], '#059669',
                  // Public/Gov Resources - Royal Blue
                  ['any',
                      ['in', 'Borough Offices', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Public Resource', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Government', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Library', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Community', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Post Office', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Education', ['coalesce', ['get', 'tags'], '']]
                  ], '#2563eb',
                  // Autos  - Gold
                  ['any',
                      ['in', 'Auto repair', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Auto Repair', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Dealership', ['coalesce', ['get', 'tags'], '']],
                      ['in', 'Mechanic', ['coalesce', ['get', 'tags'], '']]
                  ], '#ffd700',
                  // Default Gray
                  '#888888'
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
          showPopup(feature, coordinates);
//           const linkedName = props.url != null ? `<a target="_blank" href="${props.url}">${props.name}</a>` : `${props.name}`;
//           new maplibregl.Popup()
//               .setLngLat(coordinates)
//               .setHTML(`<div class="wv-map-popup">
//                   <h3 class="wv-opensans">${linkedName}</h3>
//                   <p class="wv-opensans"><strong>Type:</strong> ${props.type.charAt(0).toUpperCase() + props.type.slice(1)}</p>
//                   <p class="wv-opensans">${props.description || ''}</p>
//                   <hr>
//                   <p class="wv-opensans">Address: ${props.address}, Westville, NJ 08093</p>
//                   <p class="wv-opensans"><a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${coordinates[1]},${coordinates[0]}" title="Google Maps Directions to ${props.name}">Directions</a></p>
//               </div>`)
//               .addTo(map);
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
          layers: ['satellite-layer', 'custom-parking-fill', 'custom-markers', 'park-layer-fill'],
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
              if (activePopup) activePopup.remove();
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
              if (activePopup) activePopup.remove();
              
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

      function selectFeature(f) {
          selectedFeatureName = f.properties.name;
          searchInput.value = f.properties.name;
          searchResults.classList.remove('active');
          
          // Clear previous highlights
          map.getSource('highlight-point-source').setData({ type: 'FeatureCollection', features: [] });
          map.getSource('highlight-poly-source').setData({ type: 'FeatureCollection', features: [] });

          if (f.geometry.type === 'Point') {
              map.getSource('highlight-point-source').setData(f);
              map.flyTo({ center: f.geometry.coordinates, zoom: 18 });
              showPopup(f, f.geometry.coordinates);
          } else {
              map.getSource('highlight-poly-source').setData(f);
              const bounds = getFeaturesBounds([f]);
              if (bounds) {
                  map.fitBounds(bounds, { padding: 60, maxZoom: 18 });
                  const center = [(bounds[0][0]+bounds[1][0])/2, (bounds[0][1]+bounds[1][1])/2];
                  showPopup(f, center);
              }
          }
          hasInteracted = true;
          updateUrlParams();
      }

      let activePopup = null;
      function showPopup(feature, coordinates) {
          if (activePopup) activePopup.remove();
          console.log(coordinates);
          const props = feature.properties;
          const linkedName = props.url != null ? `<a target="_blank" href="${props.url}">${props.name}</a>` : `${props.name}`;
          const phone = props.phone != null ? `<p>${props.phone}</p>`: '';
          const address =  props.address != null ? `<p>${props.address}, Westville, NJ 08093</p>`: '';
          let lat, lng;
          if (!Array.isArray(coordinates)){
            lng = coordinates['lng'];
            lat = coordinates['lat'];
          } else {
            lng = coordinates[1];
            lat = coordinates[0];
          }
          activePopup = new maplibregl.Popup()
              .setLngLat(coordinates)
              .setHTML(`<div class="wv-map-popup">
                  <h3 class="wv-opensans">${linkedName}</h3>
                  <p class="wv-opensans"><strong>Tags:</strong> ${props.tags || ''}</p>
                  <p class="wv-opensans">${props.description || ''}</p>
                  <hr>
                  ${phone}
                  ${address}
                  <p class="wv-opensans"><a target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" title="Google Maps Directions to ${props.name}">Directions</a></p>
              </div>`)
              .addTo(map);
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
          panel.addEventListener('change', () => {
              hasInteracted = true;
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
      const initFeature = initUrl.get('feature');
      const initSearchStr = initUrl.get('search');

      if (initFeature) {
          const match = allFeatures.find(f => (f.properties.name||'').toLowerCase() === initFeature.toLowerCase());
          if (match) {
              selectFeature(match);
          }
      } else if (initSearchStr || initUrl.get('filter')) {
          if (initSearchStr) searchInput.value = initSearchStr;
          performSearch();
      } else {
        map.fitBounds([
          [-75.145165, 39.856238],
          [-75.112685, 39.887555]
        ], {
        padding: 10,      // Padding in pixels on all sides
        //maxZoom: 15,      // Prevents extreme zooming on single-point features
        duration: 1000    // Animation duration in milliseconds
    });
      }
      updateUrlParams();
  });
} catch (error) {
  console.error('Error loading map:', error);
}

// Handle parent window requests to capture the map canvas for printing or PDF exports
window.addEventListener('message', (event) => {
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