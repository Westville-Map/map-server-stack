// Westville Fall Festival Directory Page Script

let allVendors = [];
const selectedFilters = new Set(['all']);

let dirGrid, dirSearch, dirSort;
let filterTrigger, filterDropdown;

// Theme categories metadata
const categoryMetadata = {
  'vendor': { title: 'Food & Crafts', color: '#d97706', text: '#ffffff' },
  'event-zone': { title: 'Activities & Stage', color: '#dc2626', text: '#ffffff' },
  'borough-booth': { title: 'Borough Booths', color: '#16a34a', text: '#ffffff' }
};

document.addEventListener('DOMContentLoaded', () => {
  dirGrid = document.getElementById('directory-grid');
  dirSearch = document.getElementById('dir-search');
  dirSort = document.getElementById('dir-sort');
  filterTrigger = document.getElementById('dir-filter-trigger');
  filterDropdown = document.getElementById('dir-filter-dropdown');

  // Setup custom dropdown filter
  setupDropdownTrigger(filterTrigger, filterDropdown);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#dir-filter-container')) {
      closeDropdown(filterTrigger, filterDropdown);
    }
  });

  if (dirSearch) dirSearch.addEventListener('input', renderFestivalDirectory);
  if (dirSort) dirSort.addEventListener('change', renderFestivalDirectory);

  initResetButton();

  // Load festival data
  initFestivalDirectory();

  // Listen to messages from the embedded map iframe
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'vendor-selected-on-map') {
      highlightCard(event.data.vendorId, false);
    }
  });

  // Randomize hero floating leaves on load
  initFloatingLeaves();

  // Initialize Print Options and Sharing controls
  initPrintAndShare();
});

// Dropdown trigger and close functions are loaded globally from components.js


async function initFestivalDirectory() {
  try {
    if (dirGrid) dirGrid.innerHTML = '<p class="loading-text">Loading Fall Festival listings...</p>';
    
    const response = await fetch('/data/fall-festival.geojson');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    const data = await response.json();
    
    allVendors = data.features || [];

    // Parse unique classes for categories mapping
    const uniqueClasses = new Set();
    allVendors.forEach(v => {
      if (v.properties && v.properties.class) {
        uniqueClasses.add(v.properties.class);
      }
    });

    // Check if initial parameters are in URL on boot
    const bootUrlParams = new URLSearchParams(window.location.search);
    const initialFilters = bootUrlParams.get('filter');
    if (initialFilters) {
      selectedFilters.clear();
      const filterParts = initialFilters.split(',').map(s => s.trim().toLowerCase());
      filterParts.forEach(part => {
        const matchingClass = Array.from(uniqueClasses).find(c => c.toLowerCase() === part);
        if (matchingClass) {
          selectedFilters.add(matchingClass);
        }
      });
      if (selectedFilters.size === 0) {
        selectedFilters.add('all');
      }
    }

    const initialSearch = bootUrlParams.get('search');
    if (initialSearch && dirSearch) {
      dirSearch.value = initialSearch;
    }

    populateFilterDropdown(Array.from(uniqueClasses));
    updateDropdownLabel();
    renderFestivalDirectory();

  } catch (err) {
    console.error('Error loading festival data:', err);
    if (dirGrid) dirGrid.innerHTML = '<p class="error-text">Could not load festival listings.</p>';
  }
}

function populateFilterDropdown(classes) {
  if (!filterDropdown) return;
  filterDropdown.innerHTML = '';

  // All Categories option
  const allLabel = document.createElement('label');
  allLabel.className = 'multiselect-option';
  const isAllChecked = selectedFilters.has('all') ? 'checked' : '';
  allLabel.innerHTML = `<input type="checkbox" value="all" ${isAllChecked}> <span>All Categories</span>`;
  filterDropdown.appendChild(allLabel);

  classes.forEach(cls => {
    const meta = categoryMetadata[cls] || { title: cls.replace('-', ' ') };
    const label = document.createElement('label');
    label.className = 'multiselect-option';
    const isChecked = selectedFilters.has(cls) ? 'checked' : '';
    label.innerHTML = `<input type="checkbox" value="${cls}" ${isChecked}> <span>${meta.title}</span>`;
    filterDropdown.appendChild(label);
  });

  filterDropdown.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', () => {
      const val = input.value;
      if (val === 'all') {
        if (input.checked) {
          selectedFilters.clear();
          selectedFilters.add('all');
          filterDropdown.querySelectorAll('input').forEach(i => {
            if (i.value !== 'all') i.checked = false;
          });
        } else {
          selectedFilters.delete('all');
        }
      } else {
        if (input.checked) {
          selectedFilters.delete('all');
          const allCheckbox = filterDropdown.querySelector('input[value="all"]');
          if (allCheckbox) allCheckbox.checked = false;
          selectedFilters.add(val);
        } else {
          selectedFilters.delete(val);
          if (selectedFilters.size === 0) {
            selectedFilters.add('all');
            const allCheckbox = filterDropdown.querySelector('input[value="all"]');
            if (allCheckbox) allCheckbox.checked = true;
          }
        }
      }
      updateDropdownLabel();
      renderFestivalDirectory();
    });
  });
}

function updateDropdownLabel() {
  if (!filterTrigger) return;
  const triggerText = filterTrigger.querySelector('.trigger-text');
  if (!triggerText) return;

  if (selectedFilters.has('all') || selectedFilters.size === 0) {
    triggerText.innerText = 'All Categories';
  } else {
    const labels = [];
    selectedFilters.forEach(val => {
      if (val === 'all') return;
      const meta = categoryMetadata[val];
      labels.push(meta ? meta.title : val);
    });
    if (labels.length === 1) {
      triggerText.innerText = labels[0];
    } else {
      triggerText.innerText = `Categories (${labels.length})`;
    }
  }
}

function renderFestivalDirectory() {
  if (!dirGrid || !dirSearch || !dirSort) return;
  const term = dirSearch.value.toLowerCase();
  const sortVal = dirSort.value;

  const results = allVendors.filter(f => {
    // Filter by Categories
    if (!selectedFilters.has('all') && selectedFilters.size > 0) {
      if (!selectedFilters.has(f.properties.class)) {
        return false;
      }
    }

    if (term.length > 0) {
      const nameMatch = (f.properties.name || '').toLowerCase().includes(term);
      const descMatch = (f.properties.description || '').toLowerCase().includes(term);
      const tagsMatch = (f.properties.tags || '').toLowerCase().includes(term);
      const addrMatch = (f.properties.address || '').toLowerCase().includes(term);
      return nameMatch || descMatch || tagsMatch || addrMatch;
    }
    return true;
  });

  // Sorting results
  results.sort((a, b) => {
    if (sortVal === 'name_asc') {
      // Sort by booth number extracted from name
      const numA = parseInt((a.properties.name.match(/\d+/) || [99])[0]);
      const numB = parseInt((b.properties.name.match(/\d+/) || [99])[0]);
      return numA - numB;
    } else if (sortVal === 'name_desc') {
      const numA = parseInt((a.properties.name.match(/\d+/) || [99])[0]);
      const numB = parseInt((b.properties.name.match(/\d+/) || [99])[0]);
      return numB - numA;
    } else if (sortVal === 'alpha_asc') {
      return (a.properties.name || '').localeCompare(b.properties.name || '');
    }
    return 0;
  });

  dirGrid.innerHTML = '';
  if (results.length === 0) {
    dirGrid.innerHTML = '<p class="no-results-msg">No matching festival listings found.</p>';
    return;
  }

  results.forEach(f => {
    const props = f.properties;
    const id = props.id;
    const meta = categoryMetadata[props.class] || { color: '#888888', text: '#ffffff', title: 'Vendor Space' };

    const card = document.createElement('div');
    card.className = 'facility-card';
    card.setAttribute('id', `card-${id}`);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.style.borderLeft = `5px solid ${meta.color}`;

    // Tag badges
    const tagBadges = (props.tags || '')
      .split(',')
      .map(tag => {
        const cleanTag = tag.trim();
        if (!cleanTag) return '';
        return `<span class="facility-badge" style="background-color: var(--autumn-brown); color: var(--autumn-cream);">${cleanTag}</span>`;
      })
      .join(' ');

    const sortIndicatorHtml = `<div class="card-sort-indicator" style="color: ${meta.color}; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.05em;">${meta.title}</div>`;

    card.innerHTML = `
      <div class="facility-header">
        ${sortIndicatorHtml}
        <h4>${props.name || 'Unnamed Vendor'}</h4>
        <div class="facility-badges">${tagBadges}</div>
      </div>
      <p>${props.description || ''}</p>
      <div class="facility-address">📍 Placement: ${props.address || ''}</div>
    `;

    // Click triggers focus on map and scrolls map into view
    card.addEventListener('click', () => {
      highlightCard(id, false);
      
      // Post message to map iframe
      const iframe = document.getElementById('festivalMapFrame');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'select-vendor',
          vendorId: id
        }, '*');
      }

      // Scroll map into view smoothly and reliably with comfortable offset
      const mapContainer = document.querySelector('.festival-map-card');
      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        const targetY = rect.top + window.pageYOffset - 15;
        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
      } else if (iframe) {
        const rect = iframe.getBoundingClientRect();
        const targetY = rect.top + window.pageYOffset - 15;
        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
      }
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });

    dirGrid.appendChild(card);
  });

  if (document.activeElement === dirSearch) {
    updateUrlParams(false);
  } else {
    updateUrlParams(true);
  }
}

function highlightCard(id, scrollIntoView) {
  // Clear other active cards
  document.querySelectorAll('.festival-grid .facility-card').forEach(c => {
    c.classList.remove('active');
  });

  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.classList.add('active');
    if (scrollIntoView) {
      card.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }
}

// Randomizes start offsets, scale, delays, and leaf symbols on reload
function initFloatingLeaves() {
  const leaves = document.querySelectorAll('.floating-leaf');
  const leafEmojis = ['🍁', '🍂'];
  
  leaves.forEach((leaf) => {
    // 1. Randomly choose leaf symbol
    leaf.textContent = leafEmojis[Math.floor(Math.random() * leafEmojis.length)];
    
    // 2. Randomly shift starting position using margins (+/- 25px offset)
    leaf.style.marginTop = `${Math.random() * 50 - 25}px`;
    leaf.style.marginLeft = `${Math.random() * 50 - 25}px`;
    
    // 3. Randomly scale the size (80% to 125% of base font size)
    const baseSize = 2.4; // Average starting rem
    const randomScale = 0.8 + Math.random() * 0.45;
    leaf.style.fontSize = `${baseSize * randomScale}rem`;
    
    // 4. Randomize floating phases and durations (delays between 0s and -10s, durations between 7s and 13s)
    const randomDelay = -(Math.random() * 10);
    const randomDuration = 7 + Math.random() * 6;
    
    leaf.style.animationDelay = `${randomDelay}s`;
    leaf.style.animationDuration = `${randomDuration}s`;
  });
}

let urlSyncTimeout = null;

function updateUrlParams(immediate = false) {
  if (urlSyncTimeout) {
    clearTimeout(urlSyncTimeout);
    urlSyncTimeout = null;
  }

  const performUpdate = () => {
    if (!dirSearch) return;
    const newParams = new URLSearchParams(window.location.search);
    
    const term = dirSearch.value.trim();
    if (term) {
      newParams.set('search', term);
    } else {
      newParams.delete('search');
    }

    const filterValues = [];
    
    if (selectedFilters && !selectedFilters.has('all')) {
      selectedFilters.forEach(val => {
        if (val === 'all') return;
        if (!filterValues.some(v => v.toLowerCase() === val.toLowerCase())) {
          filterValues.push(val);
        }
      });
    }

    if (filterValues.length > 0) {
      newParams.set('filter', filterValues.join(','));
    } else {
      newParams.delete('filter');
    }

    const currentSearch = window.location.search;
    const nextSearchString = newParams.toString() ? '?' + newParams.toString() : '';
    
    if (currentSearch !== nextSearchString) {
      window.history.replaceState(null, '', window.location.pathname + nextSearchString);
    }
  };

  if (immediate) {
    performUpdate();
  } else {
    urlSyncTimeout = setTimeout(performUpdate, 250);
  }
}

function initResetButton() {
  const resetBtn = document.getElementById('dir-reset');
  if (!resetBtn) return;

  resetBtn.addEventListener('click', () => {
    // 1. Reset directory search
    if (dirSearch) dirSearch.value = '';

    // 2. Reset directory sort
    if (dirSort) dirSort.value = 'name_asc';

    // 3. Clear/Reset selected categories
    if (selectedFilters) {
      selectedFilters.clear();
      selectedFilters.add('all');
    }
    // Update category checkboxes UI
    if (filterDropdown) {
      const allCb = filterDropdown.querySelector('input[value="all"]');
      if (allCb) allCb.checked = true;
      filterDropdown.querySelectorAll('input').forEach(cb => {
        if (cb !== allCb) cb.checked = false;
      });
    }
    updateDropdownLabel();

    // 4. Reset parent URL
    window.history.replaceState(null, '', window.location.pathname);

    // 6. Re-render directory
    renderFestivalDirectory();
  });
}

// --- Printing & Sharing Logic for Fall Festival ---

let mapCapturePromiseCallbacks = null;

// Handle messages from map iframe (specifically for canvas capture response)
window.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'map-capture-response') {
      if (mapCapturePromiseCallbacks) {
        mapCapturePromiseCallbacks.resolve(event.data.dataUrl);
        mapCapturePromiseCallbacks = null;
      }
    } else if (event.data.type === 'map-capture-error') {
      if (mapCapturePromiseCallbacks) {
        mapCapturePromiseCallbacks.reject(new Error(event.data.error));
        mapCapturePromiseCallbacks = null;
      }
    }
  }
});

// Helper to filter directory features
function getFilteredCards(includeAll = false) {
  if (includeAll) {
    return [...allVendors].sort((a, b) => (a.properties.name || '').localeCompare(b.properties.name || ''));
  }
  
  if (!dirSearch || !dirSort) return [];
  const term = dirSearch.value.toLowerCase();
  const sortVal = dirSort.value;

  const results = allVendors.filter(f => {
    // Filter by Categories
    if (!selectedFilters.has('all') && selectedFilters.size > 0) {
      if (!selectedFilters.has(f.properties.class)) {
        return false;
      }
    }

    if (term.length > 0) {
      const nameMatch = (f.properties.name || '').toLowerCase().includes(term);
      const descMatch = (f.properties.description || '').toLowerCase().includes(term);
      const tagsMatch = (f.properties.tags || '').toLowerCase().includes(term);
      const addrMatch = (f.properties.address || '').toLowerCase().includes(term);
      return nameMatch || descMatch || tagsMatch || addrMatch;
    }
    return true;
  });

  results.sort((a, b) => {
    if (sortVal === 'name_asc') {
      const numA = parseInt((a.properties.name.match(/\d+/) || [99])[0]);
      const numB = parseInt((b.properties.name.match(/\d+/) || [99])[0]);
      return numA - numB;
    } else if (sortVal === 'name_desc') {
      const numA = parseInt((a.properties.name.match(/\d+/) || [99])[0]);
      const numB = parseInt((b.properties.name.match(/\d+/) || [99])[0]);
      return numB - numA;
    } else if (sortVal === 'alpha_asc') {
      return (a.properties.name || '').localeCompare(b.properties.name || '');
    }
    return 0;
  });

  return results;
}

// wrapText and base64ToUint8Array are loaded globally from components.js


// Compile search/filters from URL search params into clean printed document header title
function getPrintHeaderTitle() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const selections = [];
  
  const filter = searchParams.get('filter');
  if (filter) {
    filter.split(',').forEach(f => {
      const clean = f.trim().toLowerCase();
      if (categoryMetadata[clean]) {
        selections.push(categoryMetadata[clean].title);
      }
    });
  }
  
  const search = searchParams.get('search');
  if (search) selections.push(`Search: "${search}"`);
  
  if (selections.length === 0) {
    return "Westville Fall Festival";
  }
  
  return "Westville Fall Festival - " + selections.join(', ');
}

// Compile search/filters/vendor from URL search params into clean share selection name
function getShareSelectionName() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const selections = [];

  const vendor = searchParams.get('vendor');
  if (vendor) selections.push(vendor);
  
  const filter = searchParams.get('filter');
  if (filter) {
    filter.split(',').forEach(f => {
      const clean = f.trim().toLowerCase();
      if (categoryMetadata[clean]) {
        selections.push(categoryMetadata[clean].title);
      }
    });
  }
  
  const search = searchParams.get('search');
  if (search && !vendor) selections.push(`Search: "${search}"`);
  
  if (selections.length === 0) {
    return "Festival Overview";
  }
  
  return selections.join(', ');
}

// Capture WebGL canvas from iframe as PNG data URL
function captureMap(orientation) {
  return new Promise((resolve, reject) => {
    const iframe = document.getElementById('festivalMapFrame');
    if (!iframe || !iframe.contentWindow) {
      reject(new Error("Map iframe not found or inaccessible"));
      return;
    }
    
    const origWidth = iframe.style.width;
    const origHeight = iframe.style.height;
    const origMaxWidth = iframe.style.maxWidth;
    const origMaxHeight = iframe.style.maxHeight;

    if (orientation === 'landscape') {
      iframe.style.width = '1024px';
      iframe.style.height = '665px';
    } else {
      iframe.style.width = '800px';
      iframe.style.height = '890px';
    }
    iframe.style.maxWidth = 'none';
    iframe.style.maxHeight = 'none';

    setTimeout(() => {
      mapCapturePromiseCallbacks = {
        resolve: (dataUrl) => {
          iframe.style.width = origWidth;
          iframe.style.height = origHeight;
          iframe.style.maxWidth = origMaxWidth;
          iframe.style.maxHeight = origMaxHeight;
          resolve(dataUrl);
        },
        reject: (err) => {
          iframe.style.width = origWidth;
          iframe.style.height = origHeight;
          iframe.style.maxWidth = origMaxWidth;
          iframe.style.maxHeight = origMaxHeight;
          reject(err);
        }
      };
      iframe.contentWindow.postMessage({ type: 'request-map-capture' }, '*');
    }, 150);
    
    setTimeout(() => {
      if (mapCapturePromiseCallbacks) {
        iframe.style.width = origWidth;
        iframe.style.height = origHeight;
        iframe.style.maxWidth = origMaxWidth;
        iframe.style.maxHeight = origMaxHeight;
        
        mapCapturePromiseCallbacks.reject(new Error("Map capture timed out"));
        mapCapturePromiseCallbacks = null;
      }
    }, 4000);
  });
}

// Helper to draw left border and text block inside PDF dynamically
function drawPdfCard(pdfDoc, page, helvetica, helveticaBold, x, y, width, f) {
  const props = f.properties || {};
  const name = props.name || 'Unnamed Vendor';
  const meta = categoryMetadata[props.class] || { title: 'Vendor Space', color: '#d97706' };
  const cleanSource = meta.title;
  const desc = props.description || '';
  const addr = props.address || '';
  
  const wrapWidth = Math.floor(width / 6);
  const descLines = desc ? wrapText(desc, wrapWidth) : [];
  const addrLines = addr ? wrapText(`Placement: ${addr}`, wrapWidth) : [];
  const tagsList = (props.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
  const tagsLine = tagsList.length > 0 ? `Tags: ${tagsList.join(', ')}` : '';
  const tagsLines = tagsLine ? wrapText(tagsLine, wrapWidth) : [];
  
  let lineCount = 2 + descLines.length + addrLines.length + tagsLines.length;
  const cardHeight = lineCount * 12 + 15;
  
  let r = 217/255, g = 119/255, b = 6/255;
  const themeColor = meta.color;
  if (themeColor && themeColor.startsWith('#')) {
    const hex = themeColor.replace('#', '');
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
    }
  }
  
  page.drawRectangle({
    x: x,
    y: y - cardHeight,
    width: width,
    height: cardHeight,
    borderColor: PDFLib.rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    color: PDFLib.rgb(1, 1, 1),
  });
  
  page.drawRectangle({
    x: x,
    y: y - cardHeight,
    width: 6,
    height: cardHeight,
    color: PDFLib.rgb(r, g, b),
  });
  
  let currY = y - 16;
  
  page.drawText(name, {
    x: x + 15,
    y: currY,
    size: 11,
    font: helveticaBold,
    color: PDFLib.rgb(153/255, 27/255, 27/255),
  });
  currY -= 13;
  
  page.drawText(cleanSource, {
    x: x + 15,
    y: currY,
    size: 8.5,
    font: helveticaBold,
    color: PDFLib.rgb(r, g, b),
  });
  currY -= 13;
  
  const drawTextLines = (lines) => {
    lines.forEach(line => {
      page.drawText(line, {
        x: x + 15,
        y: currY,
        size: 9,
        font: helvetica,
        color: PDFLib.rgb(0.2, 0.2, 0.2),
      });
      currY -= 11;
    });
  };
  
  if (desc) drawTextLines(descLines);
  if (addr) drawTextLines(addrLines);
  if (tagsLine) {
    tagsLines.forEach(line => {
      page.drawText(line, {
        x: x + 15,
        y: currY,
        size: 8,
        font: helvetica,
        color: PDFLib.rgb(0.4, 0.4, 0.4),
      });
      currY -= 10;
    });
  }
  
  return cardHeight;
}

// Helper to construct HTML for native print layout
function generatePrintLayoutHTML(cards, mapDataUrl, orientation) {
  const container = document.getElementById('print-layout-container');
  if (!container) return;
  
  container.className = `print-${orientation}`;
  
  const title = getPrintHeaderTitle();
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  let mapHtml = '';
  if (mapDataUrl) {
    mapHtml = `
      <div class="print-map-wrapper">
        <img src="${mapDataUrl}" class="print-map-image" alt="Captured Map View">
      </div>
    `;
  }

  let selectedVendorHtml = '';
  const activeCard = document.querySelector('.festival-grid .facility-card.active');
  const activeVendorId = activeCard ? activeCard.id.replace('card-', '') : null;
  const matchedVendor = activeVendorId ? (allVendors || []).find(v => (v.properties && v.properties.id === activeVendorId) || v.id === activeVendorId) : null;
  if (matchedVendor) {
    const props = matchedVendor.properties || {};
    const meta = categoryMetadata[props.class] || { title: 'Vendor Space', color: '#d97706' };
    const cleanSource = meta.title;
    const tagsList = (props.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
    const tagSpanList = tagsList.map(tag => `<span class="print-card-tag" style="background-color: var(--autumn-brown); color: var(--autumn-cream);">${tag}</span>`).join('');
    const desc = props.description ? `<p class="print-card-meta"><strong>About:</strong> ${props.description}</p>` : '';
    const addr = props.address ? `<p class="print-card-meta"><strong>Placement:</strong> ${props.address}</p>` : '';
    selectedVendorHtml = `
      <div class="print-selected-feature-section" style="margin-top: 14px; margin-bottom: 14px;">
        <div class="print-section-title" style="margin-bottom: 8px;">Selected Vendor Details</div>
        <div class="print-card" style="border-left-color: ${meta.color};">
          <div class="print-card-title" style="color: var(--autumn-crimson);">${props.name || 'Unnamed'}</div>
          <div class="print-card-category" style="color: ${meta.color};">${cleanSource}</div>
          ${desc}
          ${addr}
          <div class="print-card-tags">${tagSpanList}</div>
        </div>
      </div>
    `;
  }
  
  let cardsHtml = '';
  if (cards && cards.length > 0) {
    const cardItemsHtml = cards.map(f => {
      const props = f.properties || {};
      const meta = categoryMetadata[props.class] || { title: 'Vendor Space', color: '#d97706' };
      const cleanSource = meta.title;
      const tagsList = (props.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
      const tagSpanList = tagsList.map(tag => `<span class="print-card-tag" style="background-color: var(--autumn-brown); color: var(--autumn-cream);">${tag}</span>`).join('');
      
      const desc = props.description ? `<p class="print-card-meta"><strong>About:</strong> ${props.description}</p>` : '';
      const addr = props.address ? `<p class="print-card-meta"><strong>Placement:</strong> ${props.address}</p>` : '';
      
      return `
        <div class="print-card" style="border-left-color: ${meta.color};">
          <div class="print-card-title" style="color: var(--autumn-crimson);">${props.name || 'Unnamed'}</div>
          <div class="print-card-category" style="color: ${meta.color};">${cleanSource}</div>
          ${desc}
          ${addr}
          <div class="print-card-tags">${tagSpanList}</div>
        </div>
      `;
    }).join('');
    
    cardsHtml = `
      <div class="print-section-title">Fall Festival Vendors (${cards.length} items)</div>
      <div class="print-cards-grid">
        ${cardItemsHtml}
      </div>
    `;
  }
  
  let qrHtml = '';
  if (window.WestvilleQR) {
    try {
      const qr = window.WestvilleQR.createWestvilleQR(window.location.href, {
        colorDark: '#991b1b',
        colorLight: '#ffffff',
        pinFill: '#991b1b',
        pinStroke: '#e5c158'
      });
      if (qr && qr.dataUrl) {
        qrHtml = `<div class="print-header-qr"><img src="${qr.dataUrl}" alt="Westville Fall Festival QR Code" /></div>`;
      }
    } catch (qrErr) {
      console.warn("Could not generate festival print header QR code:", qrErr);
    }
  }

  container.innerHTML = `
    <div class="print-header">
      <div class="print-header-main">
        <h1 style="color: var(--autumn-crimson);">${title}</h1>
        <div class="print-subheader">Westville Fall Festival Map & Vendor Directory</div>
        <div class="print-meta">
          <div>Date: ${dateStr}</div>
          <div>URL: ${window.location.href}</div>
        </div>
      </div>
      ${qrHtml}
    </div>
    ${mapHtml}
    ${selectedVendorHtml}
    ${cardsHtml}
  `;
}

// Initialize print dialogue options and sharing controls
function initPrintAndShare() {
  const printBtn = document.getElementById('print-btn');
  const printModal = document.getElementById('print-modal');
  const printModalCloseBtn = document.getElementById('print-modal-close-btn');
  const printCancelBtn = document.getElementById('print-cancel-btn');
  const printOrientation = document.getElementById('print-orientation');
  const printIncludeMap = document.getElementById('print-include-map');
  const printIncludeCards = document.getElementById('print-include-cards');
  const printLoadingMsg = document.getElementById('print-loading-msg');
  const printLoadingText = document.getElementById('print-loading-text');
  const printPdfBtn = document.getElementById('print-pdf-btn');
  const printExecuteBtn = document.getElementById('print-execute-btn');
  const printLayoutContainer = document.getElementById('print-layout-container');

  const shareBtn = document.getElementById('share-btn');
  const shareDropdown = document.getElementById('share-dropdown');
  const shareViewBtn = document.getElementById('share-view-btn');
  const shareLocationBtn = document.getElementById('share-location-btn');
  const shareQrBtn = document.getElementById('share-qr-btn');

  let previousActiveElement = null;

  function closeModal() {
    if (printModal) {
      printModal.classList.remove('active');
      setTimeout(() => {
        printModal.style.display = 'none';
        if (previousActiveElement) {
          previousActiveElement.focus();
          previousActiveElement = null;
        }
      }, 250);
    }
  }

  // --- Print Dialogue Events ---
  if (printBtn && printModal) {
    printBtn.addEventListener('click', () => {
      previousActiveElement = document.activeElement;
      printModal.style.display = 'flex';
      requestAnimationFrame(() => {
        printModal.classList.add('active');
      });
      if (printModalCloseBtn) printModalCloseBtn.focus();
    });
  }

  if (printModalCloseBtn) printModalCloseBtn.addEventListener('click', closeModal);
  if (printCancelBtn) printCancelBtn.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      if (shareDropdown) shareDropdown.classList.remove('show');
    }
  });

  if (printModal) {
    printModal.addEventListener('click', (e) => {
      if (e.target === printModal) {
        closeModal();
      }
    });
  }

  // --- Run Browser Native Print ---
  if (printExecuteBtn) {
    printExecuteBtn.addEventListener('click', async () => {
      try {
        const orientation = printOrientation.value;
        const includeMap = printIncludeMap ? printIncludeMap.checked : false;
        const includeCardsVal = printIncludeCards.value;
        
        if (printLoadingMsg) {
          printLoadingText.innerText = "Capturing map state...";
          printLoadingMsg.style.display = 'flex';
        }
        
        let mapDataUrl = null;
        if (includeMap) {
          try {
            mapDataUrl = await captureMap(orientation);
          } catch (captureErr) {
            console.error("Failed to capture map canvas:", captureErr);
            alert("Could not capture interactive map. Printing other selections.");
          }
        }
        
        let cards = [];
        if (includeCardsVal === 'filtered') {
          cards = getFilteredCards(false);
        } else if (includeCardsVal === 'all') {
          cards = getFilteredCards(true);
        }
        
        if (printLoadingMsg) {
          printLoadingText.innerText = "Formatting print page...";
        }
        
        generatePrintLayoutHTML(cards, mapDataUrl, orientation);
        closeModal();
        
        const printStyle = document.createElement('style');
        printStyle.id = 'dynamic-print-page-style';
        printStyle.innerHTML = `@page { size: ${orientation}; margin: 0.5in; }`;
        document.head.appendChild(printStyle);
        
        setTimeout(() => {
          window.print();
          printStyle.remove();
          if (printLayoutContainer) printLayoutContainer.innerHTML = '';
          if (printLoadingMsg) printLoadingMsg.style.display = 'none';
        }, 350);
        
      } catch (err) {
        console.error("Failed to complete printing operation:", err);
        alert("Error printing portal view: " + err.message);
        if (printLoadingMsg) printLoadingMsg.style.display = 'none';
      }
    });
  }

  // --- Save PDF using pdf-lib ---
  if (printPdfBtn) {
    printPdfBtn.addEventListener('click', async () => {
      try {
        const orientation = printOrientation.value;
        const includeMap = printIncludeMap ? printIncludeMap.checked : false;
        const includeCardsVal = printIncludeCards.value;
        
        if (printLoadingMsg) {
          printLoadingText.innerText = "Preparing vector workspace...";
          printLoadingMsg.style.display = 'flex';
        }
        
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let mapDataUrl = null;
        if (includeMap) {
          if (printLoadingMsg) {
            printLoadingText.innerText = "Rendering high-contrast map...";
          }
          try {
            mapDataUrl = await captureMap(orientation);
          } catch (captureErr) {
            console.error("Failed to capture map canvas:", captureErr);
            alert("Could not capture interactive map. Compiling text directory entries.");
          }
        }
        
        const isLandscape = orientation === 'landscape';
        const pageWidth = isLandscape ? 792 : 612;
        const pageHeight = isLandscape ? 612 : 792;
        
        const title = getPrintHeaderTitle();
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        
        // --- Page 1 Header & Map ---
        const page1 = pdfDoc.addPage([pageWidth, pageHeight]);
        
        page1.drawText(title, {
          x: 50,
          y: pageHeight - 45,
          size: 11.5,
          font: helveticaBold,
          color: rgb(153/255, 27/255, 27/255), // Fall Autumn Crimson
        });
        
        page1.drawText("Westville Fall Festival Map & Vendor Directory", {
          x: 50,
          y: pageHeight - 58,
          size: 10,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3),
        });
        
        const metaText = `Generated on: ${dateStr}  |  URL: ${window.location.href}`;
        page1.drawText(metaText, {
          x: 50,
          y: pageHeight - 70,
          size: 8.5,
          font: helvetica,
          color: rgb(0.4, 0.4, 0.4),
        });

        // Draw QR Code in Top Right Header
        if (window.WestvilleQR) {
          try {
            const qr = window.WestvilleQR.createWestvilleQR(window.location.href, {
              colorDark: '#991b1b',
              colorLight: '#ffffff',
              pinFill: '#991b1b',
              pinStroke: '#e5c158'
            });
            if (qr) {
              const qrBytes = qr.getBytes();
              const qrImgEmbed = await pdfDoc.embedPng(qrBytes);
              const qrSize = 46;
              page1.drawImage(qrImgEmbed, {
                x: pageWidth - 50 - qrSize,
                y: pageHeight - 72,
                width: qrSize,
                height: qrSize,
              });
            }
          } catch (qrErr) {
            console.warn("Failed to embed QR code in PDF:", qrErr);
          }
        }
        
        page1.drawLine({
          start: { x: 50, y: pageHeight - 76 },
          end: { x: pageWidth - 50, y: pageHeight - 76 },
          thickness: 1.5,
          color: rgb(0.2, 0.2, 0.2),
        });
        
        let nextY = pageHeight - 88;
        
        if (mapDataUrl) {
          if (printLoadingMsg) {
            printLoadingText.innerText = "Embedding WebGL canvas layers...";
          }
          try {
            const imageBytes = base64ToUint8Array(mapDataUrl);
            const mapImgEmbed = await pdfDoc.embedPng(imageBytes);
            
            const activeCard = document.querySelector('.festival-grid .facility-card.active');
            const activeVendorId = activeCard ? activeCard.id.replace('card-', '') : null;
            const matchedVendor = activeVendorId ? (allVendors || []).find(v => (v.properties && v.properties.id === activeVendorId) || v.id === activeVendorId) : null;
            const reserveHeight = matchedVendor ? 130 : 60;

            const maxMapWidth = pageWidth - 100;
            const maxMapHeight = nextY - reserveHeight;
            
            let mapW = mapImgEmbed.width;
            let mapH = mapImgEmbed.height;
            
            const ratio = Math.min(maxMapWidth / mapW, maxMapHeight / mapH);
            mapW = mapW * ratio;
            mapH = mapH * ratio;
            
            const mapX = 50 + (maxMapWidth - mapW) / 2;
            const mapY = nextY - mapH;
            
            page1.drawImage(mapImgEmbed, {
              x: mapX,
              y: mapY,
              width: mapW,
              height: mapH,
            });
            
            page1.drawRectangle({
              x: mapX,
              y: mapY,
              width: mapW,
              height: mapH,
              borderColor: rgb(0.8, 0.8, 0.8),
              borderWidth: 1,
            });
            
            nextY = mapY - 20;
          } catch (embedErr) {
            console.error("Failed to embed map in PDF:", embedErr);
            page1.drawText("Error loading map image: " + embedErr.message, {
              x: 50,
              y: nextY - 30,
              size: 10,
              font: helvetica,
              color: rgb(0.8, 0.2, 0.2),
            });
            nextY -= 50;
          }
        } else {
          page1.drawText("Fall festival vendor directory (map excluded). See listings on succeeding pages.", {
            x: 50,
            y: nextY - 30,
            size: 10,
            font: helvetica,
            color: rgb(0.4, 0.4, 0.4),
          });
          nextY -= 50;
        }

        // Render Selected Vendor on Page 1 if present
        const activeCard = document.querySelector('.festival-grid .facility-card.active');
        const activeVendorId = activeCard ? activeCard.id.replace('card-', '') : null;
        const matchedVendor = activeVendorId ? (allVendors || []).find(v => (v.properties && v.properties.id === activeVendorId) || v.id === activeVendorId) : null;
        if (matchedVendor && nextY > 110) {
          page1.drawText("Selected Vendor Details", {
            x: 50,
            y: nextY,
            size: 10,
            font: helveticaBold,
            color: rgb(153/255, 27/255, 27/255),
          });
          nextY -= 14;
          const drawnH = drawPdfCard(pdfDoc, page1, helvetica, helveticaBold, 50, nextY, pageWidth - 100, matchedVendor);
          nextY -= (drawnH + 15);
        }
        
        page1.drawText("Page 1 of Fall Festival Export", {
          x: pageWidth - 180,
          y: 35,
          size: 8.5,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });
        
        // --- Process Vendor Cards ---
        let cards = [];
        if (includeCardsVal === 'filtered') {
          cards = getFilteredCards(false);
        } else if (includeCardsVal === 'all') {
          cards = getFilteredCards(true);
        }
        
        if (cards.length > 0) {
          if (printLoadingMsg) {
            printLoadingText.innerText = "Wrapping text & drawing directory cards...";
          }
          
          let currPage = pdfDoc.addPage([pageWidth, pageHeight]);
          let pageNum = 2;
          let cardY = pageHeight - 65;
          
          currPage.drawText(`Fall Festival Vendors - Continued (${cards.length} items)`, {
            x: 50,
            y: pageHeight - 40,
            size: 12,
            font: helveticaBold,
            color: rgb(153/255, 27/255, 27/255),
          });
          
          currPage.drawLine({
            start: { x: 50, y: pageHeight - 48 },
            end: { x: pageWidth - 50, y: pageHeight - 48 },
            thickness: 1,
            color: rgb(0.7, 0.7, 0.7),
          });
          
          const leftColX = 50;
          const rightColX = isLandscape ? 410 : 315;
          const colWidth = isLandscape ? 332 : 247;
          
          let isLeftColumn = true;
          let leftColY = cardY;
          let rightColY = cardY;
          
          for (let i = 0; i < cards.length; i++) {
            const f = cards[i];
            
            const name = f.properties.name || 'Unnamed Vendor';
            const desc = f.properties.description || '';
            const addr = f.properties.address || '';
            
            const wrapWidth = Math.floor(colWidth / 6);
            const descLines = desc ? wrapText(desc, wrapWidth) : [];
            const addrLines = addr ? wrapText(`Placement: ${addr}`, wrapWidth) : [];
            const tagsList = (f.properties.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
            const tagsLine = tagsList.length > 0 ? `Tags: ${tagsList.join(', ')}` : '';
            const tagsLines = tagsLine ? wrapText(tagsLine, wrapWidth) : [];
            
            const lineCount = 2 + descLines.length + addrLines.length + tagsLines.length;
            const cardHeight = lineCount * 12 + 15;
            
            let targetX = leftColX;
            let targetY = leftColY;
            
            if (!isLeftColumn) {
              targetX = rightColX;
              targetY = rightColY;
            }
            
            if (targetY - cardHeight < 60) {
              if (isLeftColumn) {
                isLeftColumn = false;
                targetX = rightColX;
                targetY = rightColY;
                
                if (targetY - cardHeight < 60) {
                  currPage.drawText(`Page ${pageNum}`, {
                    x: pageWidth - 80,
                    y: 35,
                    size: 8.5,
                    font: helvetica,
                    color: rgb(0.5, 0.5, 0.5),
                  });
                  
                  currPage = pdfDoc.addPage([pageWidth, pageHeight]);
                  pageNum++;
                  currPage.drawText(`Fall Festival Vendors - Continued (${cards.length} items)`, {
                    x: 50,
                    y: pageHeight - 40,
                    size: 12,
                    font: helveticaBold,
                    color: rgb(153/255, 27/255, 27/255),
                  });
                  currPage.drawLine({
                    start: { x: 50, y: pageHeight - 48 },
                    end: { x: pageWidth - 50, y: pageHeight - 48 },
                    thickness: 1,
                    color: rgb(0.7, 0.7, 0.7),
                  });
                  
                  isLeftColumn = true;
                  leftColY = pageHeight - 65;
                  rightColY = pageHeight - 65;
                  targetX = leftColX;
                  targetY = leftColY;
                }
              } else {
                currPage.drawText(`Page ${pageNum}`, {
                  x: pageWidth - 80,
                  y: 35,
                  size: 8.5,
                  font: helvetica,
                  color: rgb(0.5, 0.5, 0.5),
                });
                
                currPage = pdfDoc.addPage([pageWidth, pageHeight]);
                pageNum++;
                currPage.drawText(`Fall Festival Vendors - Continued (${cards.length} items)`, {
                  x: 50,
                  y: pageHeight - 40,
                  size: 12,
                  font: helveticaBold,
                  color: rgb(153/255, 27/255, 27/255),
                });
                currPage.drawLine({
                  start: { x: 50, y: pageHeight - 48 },
                  end: { x: pageWidth - 50, y: pageHeight - 48 },
                  thickness: 1,
                  color: rgb(0.7, 0.7, 0.7),
                });
                
                isLeftColumn = true;
                leftColY = pageHeight - 65;
                rightColY = pageHeight - 65;
                targetX = leftColX;
                targetY = leftColY;
              }
            }
            
            const drawnHeight = drawPdfCard(pdfDoc, currPage, helvetica, helveticaBold, targetX, targetY, colWidth, f);
            
            if (isLeftColumn) {
              leftColY = targetY - drawnHeight - 15;
            } else {
              rightColY = targetY - drawnHeight - 15;
            }
            
            isLeftColumn = !isLeftColumn;
          }
          
          currPage.drawText(`Page ${pageNum}`, {
            x: pageWidth - 80,
            y: 35,
            size: 8.5,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
        
        if (printLoadingMsg) {
          printLoadingText.innerText = "Compiling PDF document...";
        }
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const downloadLink = document.createElement("a");
        const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `${cleanTitle}-vendor-export.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        closeModal();
        if (printLoadingMsg) printLoadingMsg.style.display = 'none';
        
      } catch (err) {
        console.error("Failed to compile export PDF:", err);
        alert("Error generating PDF: " + err.message);
        if (printLoadingMsg) printLoadingMsg.style.display = 'none';
      }
    });
  }

  // --- Sharing Dropdown Actions ---
  if (shareBtn && shareDropdown) {
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      shareDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.share-wrapper')) {
        shareDropdown.classList.remove('show');
      }
    });
  }

  if (shareViewBtn) {
    shareViewBtn.addEventListener('click', () => {
      const textEl = shareViewBtn.querySelector('.share-dropdown-btn-text');
      const oldText = textEl ? textEl.innerText : 'Share current view';
      shareViewBtn.disabled = true;

      navigator.clipboard.writeText(window.location.href).then(() => {
        if (textEl) textEl.innerText = 'Copied!';
        setTimeout(() => {
          if (textEl) textEl.innerText = oldText;
          shareViewBtn.disabled = false;
          if (shareDropdown) shareDropdown.classList.remove('show');
        }, 2000);
      }, (err) => {
        alert('Could not copy link: ' + err.message);
        shareViewBtn.disabled = false;
      });
    });
  }

  if (shareLocationBtn) {
    shareLocationBtn.addEventListener('click', () => {
      const textEl = shareLocationBtn.querySelector('.share-dropdown-btn-text');
      const oldText = textEl ? textEl.innerText : 'Share my location';
      shareLocationBtn.disabled = true;

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const url = new URL(window.location.href);
          url.searchParams.set('loc', `${lat},${lng}`);
          
          navigator.clipboard.writeText(url.toString()).then(() => {
            if (textEl) textEl.innerText = 'Shared!';
            setTimeout(() => {
              if (textEl) textEl.innerText = oldText;
              shareLocationBtn.disabled = false;
              if (shareDropdown) shareDropdown.classList.remove('show');
            }, 2000);
          });
        }, (err) => {
          alert('Could not retrieve location: ' + err.message);
          shareLocationBtn.disabled = false;
        });
      } else {
        alert('Geolocation not supported by browser.');
        shareLocationBtn.disabled = false;
      }
    });
  }

  if (shareQrBtn) {
    shareQrBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (shareDropdown) shareDropdown.classList.remove('show');
      if (shareBtn) shareBtn.setAttribute('aria-expanded', 'false');
      if (window.WestvilleQR && window.WestvilleQR.openShareModal) {
        window.WestvilleQR.openShareModal({
          featureName: typeof getShareSelectionName === 'function' ? getShareSelectionName() : 'Festival Overview',
          subtitle: 'Westville Fall Festival Map & Vendor Directory',
          url: window.location.href,
          colorDark: '#991b1b',
          colorLight: '#ffffff',
          pinFill: '#991b1b',
          pinStroke: '#e5c158'
        });
      }
    });
  }
}
