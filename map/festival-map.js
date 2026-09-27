// Westville Fall Festival Map Module

const originalWarn = console.warn;
console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Image') && args[0].includes('could not be loaded')) {
        return; 
    }
    originalWarn(...args);
};

let map;
let activePopup = null;
const markersMap = {}; // mapping of vendor ID to MapLibre marker objects

// Bounds for Westville, NJ
const bounds = [-75.25794564779246, 39.75364908034561, -75.00289227019784, 39.98850386620689];

(async () => {
try {
  // 1. Fetch style config (reusing the same vector tile style from the main map!)
  const styleResponse = await fetch('welcome_to_westville.json');
  const style = await styleResponse.json();

  // 2. Initialize MapLibre GL Map
  map = new maplibregl.Map({
    container: 'map',
    style: style,
    center: [-75.129, 39.867], // Centered along Broadway festival section
    zoom: 15.5,
    maxBounds: bounds,
    attributionControl: false,
    preserveDrawingBuffer: true
  });

  // Add standard navigation controls (zoom, compass)
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true
  }), 'top-right');

  map.on('load', async () => {
    // Add attribution at bottom left
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    // 3. Fetch fall-festival.geojson dataset
    try {
      const geojsonResponse = await fetch('/data/fall-festival.geojson');
      const festivalData = await geojsonResponse.json();

      // Render vendor spaces as beautiful numbered circle markers
      festivalData.features.forEach(f => {
        if (!f.geometry || f.geometry.type !== 'Point') return;
        const coords = f.geometry.coordinates;
        const props = f.properties;
        const id = props.id;

        // Extract the number from name, e.g. "Vendor Space 4" -> "4"
        const spaceMatch = props.name.match(/Space\s+(\d+)/i);
        const spaceNumber = spaceMatch ? spaceMatch[1] : '★';

        // Choose warm autumn colors based on subclass/class of vendor
        let bgColor = '#d97706'; // default warm amber/orange
        if (props.class === 'event-zone') {
          bgColor = '#dc2626'; // Deep crimson for event zones/stage
        } else if (props.class === 'borough-booth') {
          bgColor = '#16a34a'; // Forest green for Borough booth
        }

        // Create Custom HTML element for the marker
        const el = document.createElement('div');
        el.className = 'festival-marker-container';

        const innerEl = document.createElement('div');
        innerEl.className = 'festival-marker-inner';
        innerEl.style.backgroundColor = bgColor;
        innerEl.innerText = spaceNumber;
        el.appendChild(innerEl);

        const placeId = (props.id && typeof props.id === 'string' && !/^(mock|vendor)-/i.test(props.id.trim())) ? props.id.trim() : '';
        // Setup Popup HTML content
        let directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}${placeId ? `&destination_place_id=${encodeURIComponent(placeId)}` : ''}`;
        
        let badgeColor = '#b45309'; // Darker amber for contrast
        if (props.class === 'event-zone') {
          badgeColor = '#b91c1c'; // Darker crimson
        } else if (props.class === 'borough-booth') {
          badgeColor = '#15803d'; // Darker green
        }

        const popupContent = `
          <div style="font-family: 'Open Sans', sans-serif; max-width: 250px;">
            <div style="color: ${badgeColor}; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.05em;">
              ${props.class ? props.class.replace('-', ' ') : 'Vendor Space'}
            </div>
            <h4 style="margin: 0 0 6px 0; color: #451a03; font-size: 1.05rem; font-weight: 700; line-height: 1.3; padding-right: 20px;">
              ${props.name}
            </h4>
            <p style="margin: 0 0 8px 0; font-size: 0.85rem; color: #453b36; line-height: 1.4;">
              ${props.description || ''}
            </p>
            <div style="font-size: 0.8rem; font-style: italic; color: #574742; margin-bottom: 8px;">
              📍 Location: ${props.address || 'Broadway'}
            </div>
            <div style="display: flex; gap: 8px; border-top: 1px solid #e7e0da; padding-top: 8px;">
              <a href="${directionsUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; color: #c2410c; text-decoration: underline; font-size: 0.8rem; font-weight: 600;">
                <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3L21 12L12 21L3 12ZM10 16v-4.5a2.5 2.5 0 0 1 2.5-2.5h3.5M14 6l3 3-3 3"/></svg>
                <span>Directions</span>
              </a>
            </div>
          </div>
        `;

        // Create MapLibre GL Marker
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(coords)
          .addTo(map);

        // Save reference in map
        markersMap[id] = {
          marker: marker,
          element: el,
          coords: coords,
          popupContent: popupContent,
          name: props.name
        };

        // Click handler
        innerEl.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent MapLibre from closing the popup immediately
          selectVendorMarker(id);
          // Post message to parent to select the corresponding card
          if (window.parent) {
            window.parent.postMessage({
              type: 'vendor-selected-on-map',
              vendorId: id
            }, '*');
          }
        });
      });

    } catch (err) {
      console.error('Error fetching or processing fall festival GeoJSON:', err);
    }
  });

} catch (error) {
  console.error('Error initializing fall festival map:', error);
  if (window.showMapError) {
    window.showMapError(error.message || error);
  }
}

// Function to select and highlight a vendor marker
function selectVendorMarker(id) {
  const data = markersMap[id];
  if (!data) return;

  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }

  // Auto-pan point so popup fits beautifully above feature
  const verticalOffset = isMobileDevice() ? 90 : 130;
  const targetZoom = 16.2;
  const offsetCenter = getOffsetCenter(data.coords, verticalOffset, targetZoom);

  map.easeTo({
    center: offsetCenter,
    zoom: targetZoom,
    duration: 800
  });

  // Open Popup with focusAfterOpen disabled to prevent iframe focus scroll hijacking
  activePopup = new maplibregl.Popup({ offset: 15, focusAfterOpen: false })
    .setLngLat(data.coords)
    .setHTML(data.popupContent)
    .addTo(map);

  activePopup.on('open', () => {
    requestAnimationFrame(() => ensurePopupInView(activePopup));
    map.once('moveend', () => ensurePopupInView(activePopup));
  });

  // Focus effect: brief flash animation on the inner circle element
  const el = data.element;
  const innerEl = el.querySelector('.festival-marker-inner');
  if (innerEl) {
    innerEl.style.transform = 'scale(1.25)';
    setTimeout(() => {
      innerEl.style.transform = '';
    }, 300);
  }
}

// Handle message events from parent directory window
window.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'select-vendor') {
    selectVendorMarker(event.data.vendorId);
  }

  if (event.data.type === 'clear-selection') {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
    map.easeTo({
      center: [-75.129, 39.867],
      zoom: 15.5,
      duration: 800
    });
  }

  async function captureCompositeMap(mapInstance) {
    const webglCanvas = mapInstance.getCanvas();
    const mapContainer = mapInstance.getContainer();
    const containerRect = mapContainer.getBoundingClientRect();

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = webglCanvas.width;
    compositeCanvas.height = webglCanvas.height;
    const ctx = compositeCanvas.getContext('2d');

    // 1. Draw base WebGL map layer
    ctx.drawImage(webglCanvas, 0, 0);

    // 2. Check for active popup overlay
    const popupEl = mapContainer.querySelector('.maplibregl-popup');
    if (popupEl && popupEl.style.display !== 'none' && popupEl.offsetHeight > 0) {
      const popupRect = popupEl.getBoundingClientRect();
      const scaleX = compositeCanvas.width / containerRect.width;
      const scaleY = compositeCanvas.height / containerRect.height;

      const x = (popupRect.left - containerRect.left) * scaleX;
      const y = (popupRect.top - containerRect.top) * scaleY;
      const w = popupRect.width * scaleX;
      const h = popupRect.height * scaleY;

      const clone = popupEl.cloneNode(true);
      clone.style.transform = 'none';
      clone.style.position = 'static';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.margin = '0';
      clone.style.maxWidth = 'none';

      // Remove interactive close button for clean print rendering
      const closeBtn = clone.querySelector('.maplibregl-popup-close-button');
      if (closeBtn) closeBtn.remove();

      const cssStyles = `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .maplibregl-popup {
          font-family: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          position: relative;
          display: flex;
        }
        .maplibregl-popup-anchor-top, .maplibregl-popup-anchor-top-left, .maplibregl-popup-anchor-top-right { flex-direction: column; }
        .maplibregl-popup-anchor-bottom, .maplibregl-popup-anchor-bottom-left, .maplibregl-popup-anchor-bottom-right { flex-direction: column-reverse; }
        .maplibregl-popup-anchor-left { flex-direction: row; }
        .maplibregl-popup-anchor-right { flex-direction: row-reverse; }
        .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip { align-self: flex-start; }
        .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip { align-self: flex-end; }
        .maplibregl-popup-anchor-top-left .maplibregl-popup-tip { align-self: flex-start; }
        .maplibregl-popup-anchor-top-right .maplibregl-popup-tip { align-self: flex-end; }
        .maplibregl-popup-content {
          background-color: #fdfaf7 !important;
          border: 2px solid #d97706 !important;
          border-radius: 12px !important;
          padding: 16px 20px !important;
          box-shadow: 0 10px 25px rgba(120, 53, 4, 0.15), 0 4px 10px rgba(0, 0, 0, 0.08) !important;
          color: #2d1b10 !important;
          animation: none !important;
          transform: none !important;
          opacity: 1 !important;
        }
        .maplibregl-popup-tip {
          width: 0; height: 0;
          border: 10px solid transparent;
          z-index: 1;
          animation: none !important;
          transform: none !important;
          opacity: 1 !important;
        }
        .maplibregl-popup-anchor-top-right .maplibregl-popup-tip,
        .maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
        .maplibregl-popup-anchor-top .maplibregl-popup-tip { border-bottom-color: #fdfaf7 !important; margin: 0 auto; }
        .maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
        .maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip,
        .maplibregl-popup-anchor-bottom .maplibregl-popup-tip { border-top-color: #fdfaf7 !important; margin: 0 auto; }
        .maplibregl-popup-anchor-left .maplibregl-popup-tip { border-right-color: #fdfaf7 !important; align-self: center; }
        .maplibregl-popup-anchor-right .maplibregl-popup-tip { border-left-color: #fdfaf7 !important; align-self: center; }
        h4 { margin: 0 0 6px 0; color: #451a03; font-size: 1.05rem; font-weight: 700; line-height: 1.3; }
        p { margin: 0 0 8px 0; font-size: 0.85rem; color: #453b36; line-height: 1.4; }
        a { color: #c2410c; text-decoration: underline; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
        svg { width: 14px; height: 14px; stroke: currentColor; fill: none; }
      `;

      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${popupRect.width}" height="${popupRect.height}">` +
        `<foreignObject width="100%" height="100%">` +
        `<div xmlns="http://www.w3.org/1999/xhtml">` +
        `<style>${cssStyles}</style>` +
        clone.outerHTML +
        `</div>` +
        `</foreignObject>` +
        `</svg>`;

      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, x, y, w, h);
          resolve();
        };
        img.onerror = (err) => {
          console.warn('Could not composite festival popup SVG into canvas:', err);
          resolve();
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      });
    }

    return compositeCanvas.toDataURL('image/png');
  }

  if (event.data.type === 'request-map-capture') {
    try {
      if (!map) {
        throw new Error('Map is not initialized or ready yet.');
      }
      
      // Force map boundary and WebGL viewport synchronization
      map.resize();
      
      // Register a one-time render handler to capture WebGL synchronously
      map.once('render', async () => {
        try {
          const mapImage = await captureCompositeMap(map);
          window.parent.postMessage({
            type: 'map-capture-response',
            dataUrl: mapImage
          }, '*');
        } catch (err) {
          console.error('Error capturing composite festival map canvas:', err);
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

// Helper to detect mobile device widths
function isMobileDevice() {
  return window.innerWidth <= 768;
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
    const markerPixel = map.project(popup.getLngLat());
    const maxDy = mapRect.bottom - 40 - markerPixel.y;
    if (dy > maxDy) {
      dy = Math.max(0, maxDy);
    }
  } else if (rect.bottom > mapRect.bottom) {
    dy = mapRect.bottom - rect.bottom - 20;
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
})();
