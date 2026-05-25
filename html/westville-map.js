//
import { LayerControl } from 'https://unpkg.com/maplibre-gl-layer-control/dist/index.mjs';
let map;

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


    // 1. Fetch a base OpenMapTiles-compatible style
    // (Vector tiles provide raw data; the style JSON provides the visual instructions to render it.)
    const bounds = [ -75.1390197418999, 39.85893228827481, -75.11407050609648, 39.87873000870905];        
    fetch ("data/map.geojson").then(response => response.json()) //Main Data Set
    .then(customData => {
      fetch('welcome_to_westville.json')//Map Style 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
        .then(response => response.json())
        .then(style => {
            //attribution: '&copy; OpenStreetMap contributors'
            // 2. Override the tile source to point exactly to your OSM US vector tiles
            // MapLibre uses the TileJSON from this URL to figure out the tile paths automatically.
//             if (style.sources && style.sources.openmaptiles) {
//                 style.sources.openmaptiles = {
//                     type: 'vector',
//                     url: 'https://vector.openstreetmap.org/shortbread_v1/tilejson.json',
//                     bounds: bounds
//                     
//                 };
//             }

            // 3. Initialize the MapLibre Map
            
            let nav = new maplibregl.NavigationControl();
            map = new maplibregl.Map({
                container: 'map',
                style: style,//style,
                center: [-75.12647, 39.870731], // Set to your requested coordinates
                zoom: 17,
                attributionControl: false
            });
            
//             map.on('zoomend', () => {
//                 console.log('Zoom ended at:', map.getZoom());
//             });
            
          // 1. Store the original method
          const originalSetLayoutProperty = map.setLayoutProperty.bind(map);
          
          // 2. Override the method to watch for changes
          map.setLayoutProperty = function (layerId, name, value) {
              
              // Call the original function first so the master layer updates
              originalSetLayoutProperty(layerId, name, value);
          
              // Check if the master layer's visibility is being changed
              
              //Tie Labels and Areas as needed (e.g. parking fill and parking symbols)
              if (layerId === 'custom-parking-fill' && name === 'visibility') {
                  
                  // Force the dependent layer to match the new value
                  originalSetLayoutProperty('parking-layer-symbols', 'visibility', value);
              }
              
              
              // Repeat if clause above here for additional paired sets 
              
          };
            
            
            
            map.addControl(nav, 'top-left');
            if(!isMobileDevice()) map.addControl(new maplibregl.FullscreenControl(), 'top-right');
            map.on('load', async () => {
              const existingImages = {};
              map.on('styleimagemissing', async (e) => {
                  if (existingImages[e.id]) {
                      return;
                  }
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

                const parkingicon_image =  await map.loadImage('images/parking.png');
                map.addImage('parking-icon', parkingicon_image.data);

                // 4. Disable standard OSM Points of Interest (POIs)
                // We iterate over all layers and hide those associated with native amenities/places.
//                 const layers = map.getStyle().layers;
//                 layers.forEach(layer => {
//                     // OpenMapTiles schemas typically use these layer names for POIs and generic labels
//                     if (layer.id.includes('poi') || layer.id.includes('place_') || layer.id.includes('housenumber')) {
//                         map.setLayoutProperty(layer.id, 'visibility', 'none');
//                     }
//                 });
                
              map.addSource('raster-source', {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                attribution: '&copy; ArcGIS'
              });
        
//               map.addLayer({
//                 id: 'raster-layer',
//                 type: 'raster',
//                 source: 'raster-source',
//                 paint: {
//                   'raster-opacity': 0.3
//                 }
//               }); // Insert below fill layer
// 

                // 6. Add Custom GeoJSON Data Source
                map.addSource('downtown-features', {
                    type: 'geojson',
                    data: customData
                });

                // 7. Map Rendering Layers
                
                // A) Render Parking Polygons
                map.addLayer({
                    id: 'custom-parking-fill',
                    type: 'fill',
                    source: 'downtown-features',
                    filter: ['==', ['get', 'type'], 'parking'], // Only apply to parking features
                    paint: {
                        'fill-color': '#3b82f6', // Translucent blue
                        'fill-opacity': 0.4
                    }
                });
              map.addLayer({
                id: 'raster-layer',
                type: 'raster',
                source: 'raster-source',
                "maxzoom": 18.5,
                paint: {
                  'raster-opacity': 0.3
                }
              }, 'custom-parking-fill'); // Insert below fill layer

//                 // Add an outline for the parking area
//                 map.addLayer({
//                     id: 'custom-parking-outline',
//                     type: 'line',
//                     source: 'downtown-features',
//                     filter: ['==', ['get', 'type'], 'parking'],
//                     paint: {
//                         'line-color': '#1d4ed8',
//                         'line-width': 1
//                     }
//                 });

                // B) Render Shop & Restaurant Markers
                map.addLayer({
                    id: 'custom-markers',
                    type: 'circle',
                    source: 'downtown-features',
                    minzoom: 17,
                    filter: ['all', 
                      ['!=', ['get', 'type'], 'parking'],
                      ['!=', ['get', 'type'], 'park'],
                      ['!=', ['get', 'type'], 'walkingpath']
                    ], // Exclude parking polygons
                    paint: {
                        'circle-radius': 8,
                        'circle-color': [
                            'match',
                            ['get', 'type'],
                            //'restaurant', 'rgba(74, 115, 172, 0.95)', // Red 
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


                // D) Icon Labels for parking
                map.addLayer({
                    id: 'parking-layer-symbols',
                    type: 'symbol',
                    source: 'downtown-features',
                    filter: ['all',
                      ['==', ['get', 'type'], 'parking',]
                    ],
                    layout: {
                      'icon-image': 'images/parking.svg',
                      'icon-size': 0.15, // Scale as needed
                      'icon-allow-overlap': true,
                      'icon-overlap': 'always',
                      'text-overlap': 'always'
                    }//,
//                     paint: {
//                         'text-color': 'red',
//                         'text-halo-color': '#ffffff',
//                         'text-halo-width': 2
//                     }
                });
                map.addLayer({
                    id: 'park-layer-fill',
                    type: 'fill',
                    source: 'downtown-features',
                    filter: ['==', ['get', 'type'], 'park',],
                    paint: {
                        'fill-color': '#32a852', // Translucent blue
                        'fill-opacity': 0.4
                    }
//                     paint: {
//                         'text-color': 'red',
//                         'text-halo-color': '#ffffff',
//                         'text-halo-width': 2
//                     }
                });

                // Add an outline for the parking area
                map.addLayer({
                    id: 'custom-park-outline',
                    type: 'line',
                    source: 'downtown-features',
                    filter: ['==', ['get', 'type'], 'park'],
                    paint: {
                        'line-color': '#1f6e34',
                        'line-width': 1
                    }
                });
                
                map.addLayer({
                    id: 'custom-walkingpath-outline',
                    type: 'line',
                    source: 'downtown-features',
                    filter: ['==', ['get', 'type'], 'walkingpath'],
                    paint: {
                        'line-color': '#cc99ff',
                        'line-width': 3
                    }
                });
                
                map.addLayer({
                    id: 'park-layer-symbols',
                    type: 'symbol',
                    source: 'downtown-features',
                    filter: ['all',
                      ['==', ['get', 'type'], 'park',]
                    ],
                    layout: {
                      'icon-image': 'images/park.svg',
                      'icon-size': 0.09, // Scale as needed
                      'icon-allow-overlap': true,
                      'icon-overlap': 'always',
                      'text-overlap': 'always'
                    }//,
//                     paint: {
//                         'text-color': 'red',
//                         'text-halo-color': '#ffffff',
//                         'text-halo-width': 2
//                     }
                });
                // C) Text Labels for markers
                map.addLayer({
                    id: 'custom-labels',
                    type: 'symbol',
                    source: 'downtown-features',
                    filter: ['!=', ['get', 'type'], 'parking'],
                    layout: {
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
        layerStates: {
          'custom-parking-fill': {
             visible: true,
             opacity: 1,
             name: 'Parking'
          },
          'raster-layer': {
             visible: true,
             opacity: 0.3,
             name: 'Satellite'
          },
          'Background': {
             visible: false,
             opacity: 0.3,
             name: 'Map'
          }
        },
        layers: ['raster-layer','custom-parking-fill', 'custom-markers', 'custom-labels'],
        basemapStyleUrl: '/welcome_to_westville.json',
        panelWidth: 320,
        panelMinWidth: 320,
        panelMaxWidth: 320
      });
       map.addControl(layerControl, 'bottom-right');

  // Option 4: Manually specify layer states (for full control over names)
  // const layerControl = new LayerControl({
  //   collapsed: false,
  //   layerStates: {
  //     'my-layer': {
  //       visible: true,
  //       opacity: 0.5,
  //       name: 'My Custom Layer Name'
  //     }
  //   }
  // });
      map.addControl(new maplibregl.AttributionControl({compact: true}), 'bottom-left');
      document.querySelector("details.maplibregl-ctrl-attrib").classList.remove('maplibregl-compact-show');
     
      document.querySelector("span.layer-control-panel-title").innerText = 'Welcome to Westville';
      
      
                // 8. Interactivity: Popups on click
                map.on('click', (e) => {
                    const features = map.queryRenderedFeatures(e.point, {
                        layers: ['custom-markers', 'custom-parking-fill', 'park-layer-symbols', 'park-layer-fill']
                    });

                    if (!features.length) return;

                    const feature = features[0];
                    const props = feature.properties;
                    //TODO: check for url and format name below appropriately if it exists
                    
                    // Pin the popup to the marker point, or the mouse location for polygons
                    const coordinates = feature.geometry.type === 'Point' 
                        ? feature.geometry.coordinates.slice() 
                        : e.lngLat;
                    const linkedName = props.url!=null ? `<a target="_blank" href="${props.url}">${props.name}</a>`:`${props.name}`
                    new maplibregl.Popup()
                        .setLngLat(coordinates)
                        .setHTML(`
                            <h3 class="wv-opensans">${linkedName}</a></h3>
                            <p class="wv-opensans"><strong>Type:</strong> ${props.type.charAt(0).toUpperCase() + props.type.slice(1)}</p>
                            <p class="wv-opensans">${props.description || ''}</p>
                        `)
                        .addTo(map);
                });

                // UI enhancement: change cursor to pointer on hover
                const hoverLayers = ['custom-markers', 'custom-parking-fill', 'park-layer-symbols', 'park-layer-fill'];
                hoverLayers.forEach(layer => {
                    map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer');
                    map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '');
                });
               
            });
        })
        .then(()=> {
          (async function () {
            const bkgrndtxt = await waitForElement('span.layer-control-name[title="Background"]');
            bkgrndtxt.innerText = 'Map';
          })();
        });
    })