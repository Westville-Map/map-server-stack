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
let activePopupData = null;
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
          name: props.name,
          props: props
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

  activePopupData = {
    id: id,
    coords: data.coords,
    name: data.name,
    class: (data.props && data.props.class) || '',
    description: (data.props && data.props.description) || '',
    location: (data.props && data.props.location) || ''
  };

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

  activePopup.on('close', () => {
    activePopupData = null;
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

  function captureCompositeMap(mapInstance) {
    const webglCanvas = mapInstance.getCanvas();
    const mapContainer = mapInstance.getContainer();
    const containerRect = mapContainer.getBoundingClientRect();

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = webglCanvas.width;
    compositeCanvas.height = webglCanvas.height;
    const ctx = compositeCanvas.getContext('2d');

    // 1. Draw WebGL Map layer
    ctx.drawImage(webglCanvas, 0, 0);

    // 2. Draw Active Festival Popup via geographic coordinates
    try {
      if (activePopupData && activePopupData.coords && mapInstance) {
        const projected = mapInstance.project(activePopupData.coords);
        const scaleX = compositeCanvas.width / (containerRect.width || compositeCanvas.width);
        const scaleY = compositeCanvas.height / (containerRect.height || compositeCanvas.height);
        const scale = (scaleX + scaleY) / 2;

        const tipX = projected.x * scaleX;
        const tipY = projected.y * scaleY;

        const popupW = Math.min(270 * scale, compositeCanvas.width - 32 * scale);
        const paddingX = 14 * scale;
        const innerW = popupW - (paddingX * 2);

        // Precompute line wrapping for description
        const desc = activePopupData.description || '';
        const descWords = desc.split(/\s+/).filter(Boolean);
        const descLines = [];
        ctx.font = `${Math.round(13 * scale)}px "Open Sans", -apple-system, sans-serif`;
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

        // Badge color based on class
        let badgeColor = '#b45309';
        let badgeText = (activePopupData.class || 'Vendor Space').replace('-', ' ').toUpperCase();
        if (activePopupData.class === 'event-zone') {
          badgeColor = '#b91c1c';
        } else if (activePopupData.class === 'borough-booth') {
          badgeColor = '#15803d';
        }

        // Height calculation
        let contentH = 20 * scale; // top padding
        contentH += 16 * scale; // badge
        contentH += 22 * scale; // title
        if (descLines.length > 0) contentH += descLines.length * (16 * scale) + 4 * scale;
        if (activePopupData.location) contentH += 18 * scale;
        contentH += 34 * scale; // directions button
        contentH += 12 * scale; // bottom padding

        const popupH = contentH;
        let bubbleX = tipX - (popupW / 2);
        let bubbleY = tipY - popupH - (12 * scale);
        let pointDown = true;

        bubbleX = Math.max(16 * scale, Math.min(compositeCanvas.width - popupW - 16 * scale, bubbleX));
        if (bubbleY < 16 * scale) {
          bubbleY = tipY + 12 * scale;
          pointDown = false;
        }

        // Draw Drop Shadow & Bubble Card
        ctx.save();
        ctx.shadowColor = 'rgba(120, 53, 4, 0.3)';
        ctx.shadowBlur = 14 * scale;
        ctx.shadowOffsetY = 4 * scale;

        ctx.fillStyle = '#fdfaf7';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = Math.max(1, 2 * scale);
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

        // Render Text
        let textY = bubbleY + 20 * scale;

        // Badge
        ctx.fillStyle = badgeColor;
        ctx.font = `bold ${Math.round(11 * scale)}px "Open Sans", -apple-system, sans-serif`;
        ctx.fillText(badgeText, bubbleX + paddingX, textY);
        textY += 18 * scale;

        // Title
        ctx.fillStyle = '#451a03';
        ctx.font = `bold ${Math.round(15 * scale)}px "Open Sans", -apple-system, sans-serif`;
        ctx.fillText(activePopupData.name || '', bubbleX + paddingX, textY);
        textY += 20 * scale;

        // Description
        if (descLines.length > 0) {
          ctx.fillStyle = '#453b36';
          ctx.font = `${Math.round(13 * scale)}px "Open Sans", -apple-system, sans-serif`;
          for (let line of descLines) {
            ctx.fillText(line, bubbleX + paddingX, textY);
            textY += 16 * scale;
          }
          textY += 4 * scale;
        }

        // Location Info
        if (activePopupData.location) {
          ctx.fillStyle = '#574742';
          ctx.font = `italic ${Math.round(12 * scale)}px "Open Sans", -apple-system, sans-serif`;
          ctx.fillText(`Location: ${activePopupData.location}`, bubbleX + paddingX, textY);
          textY += 18 * scale;
        }

        // Divider
        ctx.strokeStyle = '#e7e0da';
        ctx.lineWidth = Math.max(1, 1 * scale);
        ctx.beginPath();
        ctx.moveTo(bubbleX + paddingX, textY);
        ctx.lineTo(bubbleX + popupW - paddingX, textY);
        ctx.stroke();
        textY += 16 * scale;

        // Directions Button
        const btnH = 26 * scale;
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bubbleX + paddingX, textY, innerW, btnH, 13 * scale);
        } else {
          ctx.rect(bubbleX + paddingX, textY, innerW, btnH);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(12 * scale)}px "Open Sans", -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('📍 Directions', bubbleX + paddingX + innerW / 2, textY + btnH / 2 + 4 * scale);
        ctx.textAlign = 'left';
      }
    } catch (popupErr) {
      console.warn('Non-fatal festival projected popup compositing error:', popupErr);
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
            console.error('Error in festival captureCompositeMap, attempting raw canvas fallback:', err);
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
