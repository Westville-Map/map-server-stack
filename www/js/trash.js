// Westville Trash & Recycling Schedule Script

document.addEventListener('DOMContentLoaded', async () => {
  let geojsonData = null;
  let allStreets = [];
  let map = null;
  let activePopup = null;
  let activeDayFilter = 'all';

  const searchInput = document.getElementById('trash-search');
  const streetGridEl = document.getElementById('street-directory');
  const countBadgeEl = document.getElementById('results-count');
  
  const dayTrigger = document.getElementById('day-category-trigger');
  const dayDropdown = document.getElementById('day-category-dropdown');
  const dayTriggerText = document.getElementById('day-trigger-text');

  const printBtn = document.getElementById('print-btn');
  const shareBtn = document.getElementById('share-btn');

  // Multi-select dropdown setup
  if (dayTrigger && dayDropdown) {
    if (typeof setupDropdownTrigger === 'function') {
      setupDropdownTrigger(dayTrigger, dayDropdown);
    } else {
      dayTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dayDropdown.classList.toggle('active');
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#day-category-container')) {
        if (typeof closeDropdown === 'function') {
          closeDropdown(dayTrigger, dayDropdown);
        } else {
          dayDropdown.classList.remove('active');
        }
      }
    });

    dayDropdown.querySelectorAll('.multiselect-option').forEach(item => {
      item.addEventListener('click', () => {
        dayDropdown.querySelectorAll('.multiselect-option').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        activeDayFilter = item.getAttribute('data-day');
        
        if (dayTriggerText) {
          const label = item.querySelector('span:last-child')?.textContent || 'All Collection Days';
          dayTriggerText.textContent = label;
        }

        if (typeof closeDropdown === 'function') {
          closeDropdown(dayTrigger, dayDropdown);
        } else {
          dayDropdown.classList.remove('active');
        }

        filterAndRender();
      });
    });
  }

  // Zone Pills Click Event
  document.querySelectorAll('.zone-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const targetDay = pill.getAttribute('data-day');
      const matchingOpt = dayDropdown?.querySelector(`.multiselect-option[data-day="${targetDay}"]`);
      if (matchingOpt) {
        matchingOpt.click();
        document.querySelector('.trash-controls')?.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  function getTrashShareTitle() {
    const searchVal = streetSearch?.value?.trim();
    if (searchVal) return `Street: "${searchVal}"`;
    if (activeDayFilter && activeDayFilter !== 'all') {
      const dayNames = { mon: 'Monday Zone', tue: 'Tuesday Zone', wed: 'Wednesday Zone', thu: 'Thursday Zone', fri: 'Friday Zone' };
      return dayNames[activeDayFilter] || activeDayFilter;
    }
    return 'Municipal Collection Schedule & Guidelines';
  }

  // Print & Share
  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.WestvilleQR && window.WestvilleQR.openShareModal) {
        window.WestvilleQR.openShareModal({
          featureName: getTrashShareTitle(),
          subtitle: 'Borough of Westville Public Works Department',
          url: window.location.href,
          colorDark: '#1a4d7c',
          colorLight: '#ffffff',
          pinFill: '#4e73ac',
          pinStroke: '#e5c158'
        });
      }
    });
  }

  // Load GeoJSON data from single reference file in data folder
  try {
    let response = await fetch('/data/trash-schedule.geojson');
    if (!response.ok) {
      response = await fetch('../data/trash-schedule.geojson');
    }
    if (!response.ok) {
      response = await fetch('../../data/trash-schedule.geojson');
    }
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    geojsonData = await response.json();

    // Flatten street database
    geojsonData.features.forEach(feature => {
      const props = feature.properties;
      if (Array.isArray(props.streets)) {
        props.streets.forEach(streetName => {
          allStreets.push({
            name: streetName,
            day: props.day,
            zoneId: props.zone_id,
            color: props.color,
            title: props.title,
            description: props.description
          });
        });
      }
    });

    allStreets.sort((a, b) => a.name.localeCompare(b.name));

    renderStreetList(allStreets);
    initTrashMap();

  } catch (err) {
    console.error('Failed to load trash schedule data:', err);
    if (streetGridEl) {
      streetGridEl.innerHTML = `<p class="loading-text" style="color:#ef4444;">Failed to load schedule data. Please refresh.</p>`;
    }
  }

  // Render street cards list
  function renderStreetList(streets) {
    if (!streetGridEl) return;
    streetGridEl.innerHTML = '';

    if (streets.length === 0) {
      streetGridEl.innerHTML = `<p class="loading-text">No matching streets found.</p>`;
      if (countBadgeEl) countBadgeEl.textContent = '0 streets found';
      return;
    }

    if (countBadgeEl) {
      countBadgeEl.textContent = `Showing ${streets.length} street${streets.length === 1 ? '' : 's'}`;
    }

    streets.forEach(item => {
      const card = document.createElement('div');
      card.className = 'trash-street-card';
      const dayClass = item.day.toLowerCase();

      card.innerHTML = `
        <div class="street-info">
          <svg class="pw-svg-icon" viewBox="0 0 24 24" width="16" height="16" stroke="var(--primary-navy)" stroke-width="2" fill="none"><path d="M4 19L9 3M15 21L20 5M12 4v4M12 12v4"></path></svg>
          <span class="street-name">${item.name}</span>
        </div>
        <span class="day-badge ${dayClass}">${item.day}</span>
      `;

      card.addEventListener('click', () => {
        highlightZoneOnMap(item.zoneId, item.name);
      });

      streetGridEl.appendChild(card);
    });
  }

  // Filter both cards and map zones
  function filterAndRender() {
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const filtered = allStreets.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(query);
      const matchesDay = activeDayFilter === 'all' || item.day.toLowerCase() === activeDayFilter.toLowerCase();
      return matchesSearch && matchesDay;
    });

    renderStreetList(filtered);
    updateMapZoneFilters();
  }

  if (searchInput) {
    searchInput.addEventListener('input', filterAndRender);
  }

  // Initialize MapLibre GL Map with Native Westville Popups
  function initTrashMap() {
    const mapContainer = document.getElementById('trash-map');
    if (!mapContainer || typeof maplibregl === 'undefined') return;

    map = new maplibregl.Map({
      container: 'trash-map',
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: [-75.126, 39.868],
      zoom: 13.6
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource('trash-zones-source', {
        type: 'geojson',
        data: geojsonData
      });

      map.addLayer({
        id: 'trash-zones-fill',
        type: 'fill',
        source: 'trash-zones-source',
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': 0.35
        }
      });

      map.addLayer({
        id: 'trash-zones-line',
        type: 'line',
        source: 'trash-zones-source',
        paint: {
          'line-color': ['get', 'borderColor'],
          'line-width': 2.5,
          'line-opacity': 0.85
        }
      });

      // Zone Click Event -> Native Westville Popup
      map.on('click', 'trash-zones-fill', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        showZonePopup(feature, e.lngLat);
      });

      map.on('mouseenter', 'trash-zones-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'trash-zones-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    });
  }

  // Helper to dynamically pan map if popup is near viewport edge (Matches westville-map.js)
  function ensurePopupInView(popup) {
    if (!popup || !map) return;
    const popupEl = popup.getElement();
    if (!popupEl) return;

    const rect = popupEl.getBoundingClientRect();
    const mapRect = map.getContainer().getBoundingClientRect();

    let dx = 0, dy = 0;
    if (rect.left < mapRect.left) dx = mapRect.left - rect.left + 15;
    else if (rect.right > mapRect.right) dx = mapRect.right - rect.right - 15;

    if (rect.top < mapRect.top) dy = mapRect.top - rect.top + 15;
    else if (rect.bottom > mapRect.bottom) dy = mapRect.bottom - rect.bottom - 15;

    if (dx !== 0 || dy !== 0) {
      const mapCenterPixel = map.project(map.getCenter());
      const newCenterPixel = [mapCenterPixel.x - dx, mapCenterPixel.y - dy];
      const newCenterCoords = map.unproject(newCenterPixel);
      map.easeTo({ center: newCenterCoords, duration: 300 });
    }
  }

  // Show Native Westville Map Popup
  function showZonePopup(feature, lngLat, customStreet = null) {
    if (activePopup) activePopup.remove();

    const props = feature.properties;
    const title = customStreet ? `${customStreet} (${props.day})` : props.title;

    activePopup = new maplibregl.Popup({ focusAfterOpen: false, anchor: 'bottom' })
      .setLngLat(lngLat)
      .setHTML(`
        <div class="wv-map-popup">
          <h3 style="color: ${props.color};">${title}</h3>
          <p class="wv-popup-detail">
            <svg class="wv-popup-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span><strong>Pickup Day:</strong> ${props.day} Morning</span>
          </p>
          <p style="margin-top: 8px; font-size: 0.85rem; color: #334155;">${props.description}</p>
          <hr>
          <a class="wv-directions-btn" target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${lngLat.lat || lngLat[1]},${lngLat.lng || lngLat[0]}" title="Directions">
            <svg class="wv-btn-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" style="margin-right: 6px; vertical-align: middle;"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            <span>Google Maps Directions</span>
          </a>
        </div>
      `)
      .addTo(map);

    activePopup.on('open', () => {
      requestAnimationFrame(() => ensurePopupInView(activePopup));
    });
  }

  // Highlight specific zone when clicking a street card
  function highlightZoneOnMap(zoneId, streetName) {
    if (!map || !geojsonData) return;

    const feature = geojsonData.features.find(f => f.properties.zone_id === zoneId);
    if (feature) {
      const coords = feature.geometry.coordinates[0];
      let sumLng = 0, sumLat = 0;
      coords.forEach(pt => { sumLng += pt[0]; sumLat += pt[1]; });
      const center = [sumLng / coords.length, sumLat / coords.length];

      map.flyTo({ center, zoom: 14.3, duration: 1000 });

      map.once('moveend', () => {
        showZonePopup(feature, center, streetName);
      });
    }
  }

  // Update map layer filters
  function updateMapZoneFilters() {
    if (!map || !map.getLayer('trash-zones-fill')) return;

    if (activeDayFilter === 'all') {
      map.setFilter('trash-zones-fill', null);
      map.setFilter('trash-zones-line', null);
    } else {
      const filterExpr = ['==', ['downcase', ['get', 'day']], activeDayFilter.toLowerCase()];
      map.setFilter('trash-zones-fill', filterExpr);
      map.setFilter('trash-zones-line', filterExpr);
    }
  }
});
