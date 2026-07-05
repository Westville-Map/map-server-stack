// --- Map Domain & URL Synchronization ---
function getMapDomain() {
  const host = window.location.hostname;
  const protocol = window.location.protocol;
  if (host.includes('westville.app')) {
    return `${protocol}//map.westville.app`;
  } else if (host.includes('westville.app')) {
    return `${protocol}//map.westville.app`;
  } else {
    // Fallback for local development or arbitrary hosts
    return `${protocol}//map.westville.app`;
  }
}
const MAP_DOMAIN = getMapDomain();

// Dynamically rewrite all static HTML links/sources to point to the resolved map domain
function initializeMapUrls() {
  const elements = document.querySelectorAll('[href*="map.westville.app"], [src*="map.westville.app"]');
  elements.forEach(el => {
    if (el.tagName === 'IFRAME') {
      el.src = el.src.replace('https://map.westville.app', MAP_DOMAIN);
    } else if (el.hasAttribute('href')) {
      el.setAttribute('href', el.getAttribute('href').replace('https://map.westville.app', MAP_DOMAIN));
    } else if (el.hasAttribute('src')) {
      el.setAttribute('src', el.getAttribute('src').replace('https://map.westville.app', MAP_DOMAIN));
    }
  });
}

// Execute link rewriting immediately on load
initializeMapUrls();

// --- Share Button Logic ---
const shareBtn = document.getElementById('share-btn');
const shareDropdown = document.getElementById('share-dropdown');
const shareViewBtn = document.getElementById('share-view-btn');
const shareLocationBtn = document.getElementById('share-location-btn');

if (shareBtn && shareDropdown) {
  shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    shareDropdown.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!shareDropdown.contains(e.target) && !shareBtn.contains(e.target)) {
      shareDropdown.classList.remove('show');
    }
  });
}

if (shareViewBtn) {
  shareViewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const textEl = shareViewBtn.querySelector('.share-dropdown-btn-text');
    const oldText = textEl ? textEl.innerText : 'Share current view';
    if (textEl) textEl.innerText = 'Copied!';
    shareViewBtn.disabled = true;

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('gps');

    navigator.clipboard.writeText(currentUrl.toString()).then(() => {
      setTimeout(() => {
        if (textEl) textEl.innerText = oldText;
        shareViewBtn.disabled = false;
        if (shareDropdown) shareDropdown.classList.remove('show');
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      if (textEl) textEl.innerText = oldText;
      shareViewBtn.disabled = false;
    });
  });
}

if (shareLocationBtn) {
  shareLocationBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (navigator.geolocation) {
      const textEl = shareLocationBtn.querySelector('.share-dropdown-btn-text');
      const oldText = textEl ? textEl.innerText : 'Share my location';
      if (textEl) textEl.innerText = 'Locating...';
      shareLocationBtn.disabled = true;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (textEl) textEl.innerText = 'Shared!';
          const lat = position.coords.latitude.toFixed(6);
          const lng = position.coords.longitude.toFixed(6);
          
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.delete('feature');
          currentUrl.searchParams.delete('search');
          currentUrl.searchParams.set('gps', `${lat},${lng}`);
          
          navigator.clipboard.writeText(currentUrl.toString()).then(() => {
            setTimeout(() => {
              if (textEl) textEl.innerText = oldText;
              shareLocationBtn.disabled = false;
              if (shareDropdown) shareDropdown.classList.remove('show');
            }, 1500);
          }).catch(err => {
            console.error('Failed to copy GPS URL:', err);
            if (textEl) textEl.innerText = oldText;
            shareLocationBtn.disabled = false;
          });
        },
        (error) => {
          if (textEl) textEl.innerText = oldText;
          shareLocationBtn.disabled = false;
          console.warn('Geolocation failed or denied:', error);
          alert('Could not determine location. Please ensure location services are enabled.');
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  });
}

// --- Help Pop-over Dialog Logic ---
const helpButtons = document.querySelectorAll('.help-btn');
const helpPopover = document.getElementById('help-popover');
const helpCloseBtn = document.getElementById('help-popover-close-btn');
const helpOkBtn = document.getElementById('help-popover-ok-btn');

if (helpPopover) {
  const openPopover = () => {
    helpPopover.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling when open
    if (helpCloseBtn) helpCloseBtn.focus();
  };

  const closePopover = () => {
    helpPopover.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
    if (helpButtons.length > 0) helpButtons[0].focus();
  };

  helpButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openPopover();
    });
  });

  if (helpCloseBtn) {
    helpCloseBtn.addEventListener('click', closePopover);
  }

  if (helpOkBtn) {
    helpOkBtn.addEventListener('click', closePopover);
  }

  // Light dismiss: Close on overlay background click
  helpPopover.addEventListener('click', (e) => {
    if (e.target === helpPopover) {
      closePopover();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpPopover.classList.contains('active')) {
      closePopover();
    }
  });

  // Check URL parameters for automatic trigger (e.g. from static subpages)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('help') === 'true') {
    openPopover();
    // Clean up URL parameter to avoid re-triggering on manual refresh
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('help');
    window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);
  }
}

// --- Map Header Synchronization ---
function getLayerVisibilityFromUrl(urlString, friendlyName) {
  try {
    const url = new URL(urlString);
    const searchParams = url.searchParams;
    const show = searchParams.get('show');
    const hide = searchParams.get('hide');

    // Default: all thematic layers, map, and satellite are visible by default
    let visible = true;

    if (show) {
      const showParams = show.toLowerCase().split(',');
      if (showParams.includes('all')) {
        visible = true;
      } else {
        const thematicLayers = ['parking', 'establishments', 'recreation'];
        if (thematicLayers.includes(friendlyName)) {
          visible = showParams.includes(friendlyName);
        } else if (friendlyName === 'satellite') {
          visible = showParams.includes('satellite');
        } else if (friendlyName === 'map') {
          if (showParams.includes('map')) {
            visible = true;
          } else if (showParams.includes('satellite')) {
            visible = false;
          }
        }
      }
    }

    if (hide) {
      const hideParams = hide.toLowerCase().split(',');
      if (hideParams.includes('all')) {
        visible = false;
      } else if (hideParams.includes(friendlyName)) {
        visible = false;
      }
    }

    if (show) {
      const showParams = show.toLowerCase().split(',');
      const hideParams = hide ? hide.toLowerCase().split(',') : [];
      if (!hideParams.includes('all') && showParams.includes(friendlyName)) {
        visible = true;
      }
    }

    return visible;
  } catch (e) {
    return true;
  }
}

function updateMapHeaderFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const searchParams = url.searchParams;
    const transientContainer = document.getElementById('map-transient-tags');
    const fullMapLink = document.getElementById('full-map-link');

    if (fullMapLink) {
      fullMapLink.href = urlString;
    }

    const tags = [];

    // 1. GPS shared location
    const gps = searchParams.get('gps');
    if (gps) {
      tags.push(`<span class="map-tag highlight gps-highlight" style="display: inline-flex; align-items: center; gap: 4px;"><img style="width:12px; height:12px; vertical-align: middle;" src="/images/my-location.svg" alt=""> Shared location</span>`);
    }

    // 2. Highlighted feature
    const feature = searchParams.get('feature');
    if (feature && !gps) {
      tags.push(`<span class="map-tag highlight" style="display: inline-flex; align-items: center; gap: 4px;"><img style="width:12px; height:12px; vertical-align: middle;" src="/images/map-pin.svg" alt=""> Highlighted: ${feature}</span>`);
    }

    // 3. Active filters
    const filter = searchParams.get('filter');
    if (filter) {
      const filters = filter.split(',');
      filters.forEach(f => {
        if (f.trim()) {
          const label = f.trim().charAt(0).toUpperCase() + f.trim().slice(1);
          tags.push(`<span class="map-tag" style="display: inline-flex; align-items: center; gap: 4px;"><img style="width:12px; height:12px; vertical-align: middle;" src="/images/search.svg" alt=""> Filter: ${label}</span>`);
        }
      });
    }

    // 4. Search query
    const searchStr = searchParams.get('search');
    if (searchStr && !feature) {
      tags.push(`<span class="map-tag" style="display: inline-flex; align-items: center; gap: 4px;"><img style="width:12px; height:12px; vertical-align: middle;" src="/images/search.svg" alt=""> Search: "${searchStr}"</span>`);
    }

    if (transientContainer) {
      transientContainer.innerHTML = tags.join('');
    }

    // Sync checkboxes to URL state
    const layers = ['parking', 'establishments', 'recreation', 'satellite', 'map'];
    layers.forEach(layer => {
      const checkbox = document.getElementById(`layer-${layer}`);
      if (checkbox) {
        const visible = getLayerVisibilityFromUrl(urlString, layer);
        checkbox.checked = visible;
        
        const label = checkbox.closest('.interactive-tag');
        if (label) {
          if (visible) {
            label.classList.add('checked');
          } else {
            label.classList.remove('checked');
          }
        }
      }
    });
  } catch (e) {
    console.error('Error updating map header:', e);
  }
}

// Listen for postMessage from the map iframe to sync URL & update the header in real-time
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'westville-map-state-change') {
    updateMapHeaderFromUrl(event.data.url);

    // Live-update parent browser address bar with iframe params
    try {
      const mapUrl = new URL(event.data.url);
      const newSearchParams = mapUrl.searchParams;
      const currentParentSearch = window.location.search;
      const nextSearchString = newSearchParams.toString() ? '?' + newSearchParams.toString() : '';
      
      if (currentParentSearch !== nextSearchString) {
        window.history.replaceState(null, '', window.location.pathname + nextSearchString);
      }
    } catch (err) {
      console.error('Error syncing parent URL from map message:', err);
    }
  }
});

// Initialize map frame source from parent URL parameters on page boot
const parentUrlParams = new URLSearchParams(window.location.search);
const mapFrame = document.getElementById('mapFrame');
if (mapFrame) {
  if (parentUrlParams.toString()) {
    mapFrame.src = MAP_DOMAIN + '?' + parentUrlParams.toString();
  } else {
    mapFrame.src = MAP_DOMAIN;
  }
  // Update map header immediately for smooth UI transition
  updateMapHeaderFromUrl(mapFrame.src);
}

document.querySelectorAll('.scroll-trigger').forEach(link => {
  link.addEventListener('click', function(e) {
    console.log('clicked');
    const iframe = document.getElementById('mapFrame');
    
    if (iframe) {
      // update map header immediately for snappy UX
      updateMapHeaderFromUrl(link.href);

      // Update parent URL bar immediately for visual confirmation
      try {
        const url = new URL(link.href);
        const searchStr = url.search;
        if (searchStr !== window.location.search) {
          window.history.replaceState(null, '', window.location.pathname + searchStr);
        }
      } catch (err) {
        console.error('Error updating parent URL on shortcut click:', err);
      }

      iframe.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  });
});

// --- Directory Logic ---

const dirSearch = document.getElementById('dir-search');
const dirSort = document.getElementById('dir-sort');
const dirGrid = document.getElementById('directory-grid');
const dirFilterTrigger = document.getElementById('dir-filter-trigger');
const dirFilterDropdown = document.getElementById('dir-filter-dropdown');
const dirFilterContainer = document.getElementById('dir-filter-container');

let allDirFeatures = [];
let selectedFilters = new Set(['all']); // Default to all

// Toggle Multiselect dropdown
function toggleDirDropdown(e) {
  if (e) e.stopPropagation();
  const isActive = dirFilterContainer.classList.toggle('active');
  dirFilterTrigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
}

if (dirFilterTrigger) {
  dirFilterTrigger.addEventListener('click', (e) => {
    toggleDirDropdown(e);
  });

  dirFilterTrigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDirDropdown(e);
    }
  });
}

document.addEventListener('click', () => {
  if (dirFilterContainer && dirFilterTrigger) {
    dirFilterContainer.classList.remove('active');
    dirFilterTrigger.setAttribute('aria-expanded', 'false');
  }
});

if (dirFilterDropdown) {
  dirFilterDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// Dynamic tag-to-color mapping for orientation
const tagColors = {
  // Food & Dining (Red/Rose tones)
  'restaurant': '#e11d48',
  'dining': '#e11d48',
  'food': '#e11d48',
  'diner': '#be123c',
  'take out': '#f43f5e',
  'takeout': '#f43f5e',
  'bbq': '#b91c1c',
  'bakery': '#db2777',
  'dessert': '#db2777',
  'sweets': '#f472b6',
  'cafe': '#be123c',
  'coffee': '#9a3412',
  
  // Nightlife & Drinks (Amber/Gold tones)
  'brewery': '#d97706',
  'bar': '#d97706',
  'pub': '#b45309',
  'nightlife': '#d97706',
  'craft beer': '#b45309',
  
  // Wellness (Teal)
  'wellness': '#0d9488',
  'fitness': '#0d9488',
  'yoga': '#0d9488',
  'health': '#0d9488',
  
  // Parks & Recreation (Green)
  'park': '#16a34a',
  'recreation': '#16a34a',
  'public': '#16a34a',
  'walking path': '#15803d',
  'walkingpath': '#15803d',
  
  // Public/Gov Resources (Blue)
  'borough offices': '#2563eb',
  'public resource': '#1d4ed8',
  'government': '#1d4ed8',
  'library': '#2563eb',
  'education': '#1e3a8a',
  'community': '#2563eb',
  'safety': '#dc2626',
  'police station': '#dc2626',
  'fire station': '#dc2626',
  
  // Retail & Services (Emerald / Gray)
  'convenience store': '#059669',
  'retail': '#059669',
  'groceries': '#059669',
  'laundry': '#4b5563',
  'service': '#4b5563',
  'laundromat': '#4b5563',
  
  // Autos (Gold/Yellow tones)
  'auto repair': '#ffd700',
  'dealership': '#ffd700',
  'mechanic': '#ffd700',
  'mechanic service': '#ffd700',
  'auto service': '#ffd700',
  
  // Parking (Cobalt Blue)
  'parking': '#2563eb',
  'free': '#2563eb'
};

// WCAG 2.1 Compliant Relative Luminance & Contrast Ratio calculation helper
function getContrastColor(hexcolor) {
  if (!hexcolor) return '#ffffff';
  let hex = hexcolor.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return '#ffffff';
  
  const rgb = [
    parseInt(hex.substring(0, 2), 16) / 255,
    parseInt(hex.substring(2, 4), 16) / 255,
    parseInt(hex.substring(4, 6), 16) / 255
  ].map(val => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const ratioWhite = 1.05 / (luminance + 0.05);
  const ratioDark = (luminance + 0.05) / 0.06; // #111827 relative luminance is ~0.01
  
  return ratioDark > ratioWhite ? '#111827' : '#ffffff';
}

function updateFilterTriggerText() {
  if (!dirFilterTrigger) return;
  const triggerText = dirFilterTrigger.querySelector('.trigger-text');
  if (!triggerText) return;
  
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

async function initDirectory() {
  try {
    const files = ['parking', 'establishments', 'recreation'];
    const requestPromises = files.map(file => fetch(`/data/${file}.geojson`));
    const responses = await Promise.all(requestPromises);

    const data = await Promise.all(responses.map(async (res, index) => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const featureJson = await res.json();
      return {[files[index]]: featureJson};
    }));

    const collections = Object.fromEntries(data.map(obj => Object.entries(obj)[0]));

    if (collections.parking) collections.parking.features.forEach(f => allDirFeatures.push({ ...f, _source: 'parking' }));
    if (collections.establishments) collections.establishments.features.forEach(f => allDirFeatures.push({ ...f, _source: 'establishment' }));
    if (collections.recreation) collections.recreation.features.forEach(f => allDirFeatures.push({ ...f, _source: 'recreation' }));

    // Extract unique individual tags and dynamically populate filter dropdown checkboxes
    const uniqueTags = new Set();
    allDirFeatures.forEach(f => {
      if (f.properties.tags) {
        f.properties.tags.split(',').forEach(tag => {
          uniqueTags.add(tag.trim());
        });
      }
    });
    const sortedTags = Array.from(uniqueTags).sort();

    // Check if initial filters are specified in parent URL on boot
    const initialFilters = parentUrlParams.get('filter');
    if (initialFilters) {
      selectedFilters.clear();
      const filterParts = initialFilters.split(',').map(s => s.trim().toLowerCase());
      filterParts.forEach(part => {
        // match category
        const matchingCat = ['parking', 'establishment', 'recreation'].find(c => c.toLowerCase() === part);
        if (matchingCat) {
          selectedFilters.add('cat:' + matchingCat);
        } else {
          // match tag
          const matchingTag = sortedTags.find(t => t.toLowerCase() === part);
          if (matchingTag) {
            selectedFilters.add('tag:' + matchingTag);
          }
        }
      });
      if (selectedFilters.size === 0) {
        selectedFilters.add('all');
      }
    }

    if (!dirFilterDropdown) return;

    // Populate drop down checkboxes
    let dropdownHtml = `
      <div class="multiselect-option" data-value="all">
        <input type="checkbox" id="dir-cb-all" ${selectedFilters.has('all') ? 'checked' : ''} />
        <label class="multiselect-option-label" for="dir-cb-all">All Categories & Tags</label>
      </div>
      <div class="multiselect-group-title">Categories</div>
      <div class="multiselect-option" data-value="cat:parking">
        <input type="checkbox" id="dir-cb-cat-parking" ${selectedFilters.has('cat:parking') ? 'checked' : ''} />
        <label class="multiselect-option-label" for="dir-cb-cat-parking">Parking</label>
      </div>
      <div class="multiselect-option" data-value="cat:establishment">
        <input type="checkbox" id="dir-cb-cat-est" ${selectedFilters.has('cat:establishment') ? 'checked' : ''} />
        <label class="multiselect-option-label" for="dir-cb-cat-est">Establishments</label>
      </div>
      <div class="multiselect-option" data-value="cat:recreation">
        <input type="checkbox" id="dir-cb-cat-rec" ${selectedFilters.has('cat:recreation') ? 'checked' : ''} />
        <label class="multiselect-option-label" for="dir-cb-cat-rec">Recreation</label>
      </div>
      <div class="multiselect-group-title">Filter by Tag</div>
    `;

    sortedTags.forEach((tag, idx) => {
      const isChecked = selectedFilters.has(`tag:${tag}`);
      dropdownHtml += `
        <div class="multiselect-option" data-value="tag:${tag}">
          <input type="checkbox" id="dir-cb-tag-${idx}" ${isChecked ? 'checked' : ''} />
          <label class="multiselect-option-label" for="dir-cb-tag-${idx}">${tag}</label>
        </div>
      `;
    });

    dirFilterDropdown.innerHTML = dropdownHtml;

    // Attach listeners to custom dropdown checkboxes
    dirFilterDropdown.querySelectorAll('.multiselect-option').forEach(option => {
      const cb = option.querySelector('input[type="checkbox"]');
      
      const handleToggle = () => {
        const val = option.getAttribute('data-value');
        if (val === 'all') {
          if (cb.checked) {
            selectedFilters.clear();
            selectedFilters.add('all');
            dirFilterDropdown.querySelectorAll('input[type="checkbox"]').forEach(otherCb => {
              if (otherCb !== cb) otherCb.checked = false;
            });
          } else {
            selectedFilters.delete('all');
          }
        } else {
          if (cb.checked) {
            selectedFilters.delete('all');
            const allCb = document.getElementById('dir-cb-all');
            if (allCb) allCb.checked = false;
            selectedFilters.add(val);
          } else {
            selectedFilters.delete(val);
          }
        }

        if (selectedFilters.size === 0) {
          selectedFilters.add('all');
          const allCb = document.getElementById('dir-cb-all');
          if (allCb) allCb.checked = true;
        }

        updateFilterTriggerText();
        renderDirectory();
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
    renderDirectory();
  } catch (err) {
    console.error("Failed to load directory data:", err);
    if (dirGrid) dirGrid.innerHTML = '<p>Could not load directory data.</p>';
  }
}

function renderDirectory() {
  if (!dirGrid || !dirSearch || !dirSort) return;
  const term = dirSearch.value.toLowerCase();
  const sortVal = dirSort.value;

  const results = allDirFeatures.filter(f => {
    // Custom Multi-select OR logic
    if (!selectedFilters.has('all') && selectedFilters.size > 0) {
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

  // Sort based on selected option
  results.sort((a, b) => {
    if (sortVal === 'name_asc') {
      return (a.properties.name || '').localeCompare(b.properties.name || '');
    } else if (sortVal === 'name_desc') {
      return (b.properties.name || '').localeCompare(a.properties.name || '');
    } else if (sortVal === 'tags_asc') {
      return (a.properties.tags || '').localeCompare(b.properties.tags || '');
    } else if (sortVal === 'tags_desc') {
      return (b.properties.tags || '').localeCompare(a.properties.tags || '');
    }
    return 0;
  });

  dirGrid.innerHTML = '';

  if (results.length === 0) {
    dirGrid.innerHTML = '<p>No matching facilities found.</p>';
    return;
  }

  results.forEach(f => {
    const card = document.createElement('div');
    card.className = 'facility-card';
    card.setAttribute('data-type', f._source);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    const tagsString = (f.properties.tags || f._source || '').toLowerCase().split(',').map(t => t.trim()).join(', ');
    const ariaLabel = `${f.properties.name || 'Unnamed'}. Tags: ${tagsString}. Press Enter or Space to show on map.`;
    card.setAttribute('aria-label', ariaLabel);
    
    // Determine the most used tag color for the card's left border
    const cardTags = (f.properties.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (cardTags.length > 0) {
      const colorCounts = {};
      cardTags.forEach(tag => {
        const color = tagColors[tag];
        if (color) {
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        }
      });
      
      let maxCount = 0;
      let prominentColor = '';
      cardTags.forEach(tag => {
        const color = tagColors[tag];
        if (color && colorCounts[color] > maxCount) {
          maxCount = colorCounts[color];
          prominentColor = color;
        }
      });
      
      if (prominentColor) {
        card.style.borderLeftColor = prominentColor;
      }
    }
    
    const tagBadges = (f.properties.tags || f._source)
      .split(',')
      .map(tag => {
        const cleanTag = tag.trim();
        const color = tagColors[cleanTag.toLowerCase()] || '#888888';
        const textColor = getContrastColor(color);
        return `<span class="facility-badge" style="background-color: ${color}; color: ${textColor};">${cleanTag}</span>`;
      })
      .join(' ');

    // Extract Contact & Directions
    const phone = f.properties.phone;
    const url = f.properties.url;
    
    let directionsUrl = '';
    if (f.geometry && f.geometry.type === 'Point') {
      const coords = f.geometry.coordinates; // [lng, lat]
      directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;
    } else if (f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')) {
      if (f.bbox) {
        const lat = (f.bbox[1] + f.bbox[3]) / 2;
        const lng = (f.bbox[0] + f.bbox[2]) / 2;
        directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      } else if (f.geometry.coordinates && f.geometry.coordinates[0] && f.geometry.coordinates[0][0]) {
        const coords = f.geometry.coordinates[0][0];
        directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;
      }
    }

    let phoneButton = phone ? `
      <a href="tel:${phone.replace(/[^0-9]/g, '')}" class="facility-link phone-link" title="Call ${f.properties.name}" onclick="event.stopPropagation()">
        <svg class="detail-icon" viewBox="0 0 24 24"><path d="M6.62,10.79C8.06,13.5 10.38,15.74 13.09,17.18L15.29,14.98C15.56,14.71 15.96,14.63 16.3,14.74C17.43,15.11 18.64,15.31 19.89,15.31C20.5,15.31 21,15.81 21,16.42V19.89C21,20.5 20.5,21 19.89,21C10.56,21 3,13.44 3,4.11C3,3.5 3.5,3 4.11,3H7.58C8.19,3 8.69,3.5 8.69,4.11C8.69,5.36 8.89,6.57 9.26,7.7C9.37,8.04 9.29,8.44 9.02,8.71L6.62,10.79Z"/></svg>
        <span>Call</span>
      </a>` : '';

    let webButton = url ? `
      <a href="${url}" target="_blank" class="facility-link web-link" title="Visit website" onclick="event.stopPropagation()">
        <svg class="detail-icon" viewBox="0 0 24 24"><path d="M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3H14Z"/></svg>
        <span>Website</span>
      </a>` : '';

    let dirButton = directionsUrl ? `
      <a href="${directionsUrl}" target="_blank" class="facility-link dir-link" title="Get directions on Google Maps" onclick="event.stopPropagation()">
        <svg class="detail-icon stroke-icon" viewBox="0 0 24 24"><path d="M12 3L21 12L12 21L3 12ZM10 16v-4.5a2.5 2.5 0 0 1 2.5-2.5h3.5M14 6l3 3-3 3"/></svg>
        <span>Directions</span>
      </a>` : '';

    let detailsHtml = (phoneButton || webButton || dirButton) ? `
      <div class="facility-details">
        ${phoneButton}
        ${webButton}
        ${dirButton}
      </div>` : '';
    
    card.innerHTML = `
      <div class="facility-header">
        <h4>${f.properties.name || 'Unnamed'}</h4>
        <div class="facility-badges">${tagBadges}</div>
      </div>
      <p>${f.properties.description || ''}</p>
      <div class="facility-address">${f.properties.address || ''}</div>
      ${detailsHtml}
    `;

    card.addEventListener('click', () => {
      const iframe = document.getElementById('mapFrame');
      if (iframe) {
        const nextUrl = `${MAP_DOMAIN}/?show=all&feature=${encodeURIComponent(f.properties.name)}`;
        iframe.src = nextUrl;
        if (typeof updateMapHeaderFromUrl === 'function') {
          updateMapHeaderFromUrl(nextUrl);
        }
        
        // Update parent URL bar immediately for visual confirmation
        try {
          const url = new URL(nextUrl);
          const searchStr = url.search;
          if (searchStr !== window.location.search) {
            window.history.replaceState(null, '', window.location.pathname + searchStr);
          }
        } catch (err) {
          console.error('Error updating parent URL on card click:', err);
        }

        iframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
}

if (dirSearch) dirSearch.addEventListener('input', renderDirectory);
if (dirSort) dirSort.addEventListener('change', renderDirectory);

// --- Print & PDF Generation Logic ---
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

let mapCapturePromiseCallbacks = null;

// Handle messages from map iframe (for canvas capture response)
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

// Capture map from iframe as PNG data URL
function captureMap(orientation) {
  return new Promise((resolve, reject) => {
    const iframe = document.getElementById('mapFrame');
    if (!iframe || !iframe.contentWindow) {
      reject(new Error("Map iframe not found or inaccessible"));
      return;
    }
    
    // Save original styles
    const origWidth = iframe.style.width;
    const origHeight = iframe.style.height;
    const origMaxWidth = iframe.style.maxWidth;
    const origMaxHeight = iframe.style.maxHeight;

    // Apply print-optimal sizing depending on orientation to avoid wide-screen letterbox mapping
    if (orientation === 'landscape') {
      iframe.style.width = '1024px';
      iframe.style.height = '665px'; // Aspect ratio matches printable landscape (~1.54)
    } else {
      iframe.style.width = '800px';
      iframe.style.height = '890px'; // Aspect ratio matches printable portrait (~0.9)
    }
    iframe.style.maxWidth = 'none';
    iframe.style.maxHeight = 'none';

    // Wait brief frame for layout to settle, then request iframe capture
    setTimeout(() => {
      mapCapturePromiseCallbacks = {
        resolve: (dataUrl) => {
          // Restore dimensions
          iframe.style.width = origWidth;
          iframe.style.height = origHeight;
          iframe.style.maxWidth = origMaxWidth;
          iframe.style.maxHeight = origMaxHeight;
          resolve(dataUrl);
        },
        reject: (err) => {
          // Restore dimensions
          iframe.style.width = origWidth;
          iframe.style.height = origHeight;
          iframe.style.maxWidth = origMaxWidth;
          iframe.style.maxHeight = origMaxHeight;
          reject(err);
        }
      };
      iframe.contentWindow.postMessage({ type: 'request-map-capture' }, '*');
    }, 150);
    
    // Timeout if map iframe doesn't respond in 4 seconds
    setTimeout(() => {
      if (mapCapturePromiseCallbacks) {
        // Restore dimensions
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

// Open/close modal logic
let previousActiveElement = null;

if (printBtn && printModal) {
  printBtn.addEventListener('click', () => {
    previousActiveElement = document.activeElement;
    printModal.style.display = 'flex';
    // Trigger animation frame for transition
    requestAnimationFrame(() => {
      printModal.classList.add('active');
    });
    if (printModalCloseBtn) printModalCloseBtn.focus();
  });
}

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

if (printModalCloseBtn) printModalCloseBtn.addEventListener('click', closeModal);
if (printCancelBtn) printCancelBtn.addEventListener('click', closeModal);

// Close on escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && printModal && printModal.classList.contains('active')) {
    closeModal();
  }
});

// Close on clicking backdrop
if (printModal) {
  printModal.addEventListener('click', (e) => {
    if (e.target === printModal) {
      closeModal();
    }
  });
}

// Helper to compile selections from the current URL to display on printed header
function getPrintHeaderTitle() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const selections = [];
  
  const feature = searchParams.get('feature');
  if (feature) selections.push(feature);
  
  const filter = searchParams.get('filter');
  if (filter) {
    filter.split(',').forEach(f => {
      const clean = f.trim().toLowerCase();
      if (clean && clean !== 'satellite') {
        const label = f.trim().charAt(0).toUpperCase() + f.trim().slice(1);
        selections.push(label);
      }
    });
  }
  
  const search = searchParams.get('search');
  if (search && !feature) selections.push(`Search: "${search}"`);
  
  const show = searchParams.get('show');
  if (show) {
    show.split(',').forEach(s => {
      const clean = s.trim().toLowerCase();
      if (clean === 'establishments') selections.push('Establishments');
      else if (clean === 'recreation') selections.push('Recreation');
      else if (clean === 'parking') selections.push('Parking');
    });
  }
  
  if (selections.length === 0) {
    return "Westville";
  }
  
  return "Westville - " + selections.join(', ');
}

// Helper to filter directory features
function getFilteredCards(includeAll = false) {
  if (includeAll) {
    return [...allDirFeatures].sort((a, b) => (a.properties.name || '').localeCompare(b.properties.name || ''));
  }
  
  const term = dirSearch.value.toLowerCase();
  const sortVal = dirSort.value;

  const results = allDirFeatures.filter(f => {
    if (!selectedFilters.has('all') && selectedFilters.size > 0) {
      const categories = [];
      const tags = [];
      selectedFilters.forEach(val => {
        if (val.startsWith('cat:')) categories.push(val.slice(4));
        else if (val.startsWith('tag:')) tags.push(val.slice(4).toLowerCase());
      });

      const categoryMatch = categories.includes(f._source);
      const featureTags = (f.properties.tags || '').toLowerCase().split(',').map(t => t.trim());
      const tagMatch = featureTags.some(t => tags.includes(t));

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

  results.sort((a, b) => {
    if (sortVal === 'name_asc') {
      return (a.properties.name || '').localeCompare(b.properties.name || '');
    } else if (sortVal === 'name_desc') {
      return (b.properties.name || '').localeCompare(a.properties.name || '');
    } else if (sortVal === 'category_asc') {
      return (a._source || '').localeCompare(b._source || '') || (a.properties.name || '').localeCompare(b.properties.name || '');
    } else if (sortVal === 'category_desc') {
      return (b._source || '').localeCompare(a._source || '') || (a.properties.name || '').localeCompare(b.properties.name || '');
    }
    return 0;
  });
  
  return results;
}

// Simple text word wrapper for standard character lengths
function wrapText(text, maxLength) {
  if (maxLength <= 0) return [text];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';
  
  words.forEach(word => {
    if ((currentLine + ' ' + word).length <= maxLength) {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    } else {
      if (word.length > maxLength) {
        // Handle long words (e.g. URLs) by wrapping/breaking them at delimiters
        const subWords = [];
        // Split on standard URL delimiters
        const parts = word.split(/([./?&#\-_=,:])/);
        parts.forEach(part => {
          if (!part) return;
          if (part.length <= maxLength) {
            subWords.push(part);
          } else {
            // Hard split if a single part still exceeds maxLength
            let rem = part;
            while (rem.length > maxLength) {
              subWords.push(rem.substring(0, maxLength));
              rem = rem.substring(maxLength);
            }
            if (rem) subWords.push(rem);
          }
        });

        // Append subWords greedily WITHOUT space between them, except optionally a space before the first subWord
        let isFirstSub = true;
        subWords.forEach(sub => {
          if (isFirstSub) {
            if ((currentLine + ' ' + sub).length <= maxLength) {
              currentLine = currentLine ? currentLine + ' ' + sub : sub;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = sub;
            }
            isFirstSub = false;
          } else {
            if ((currentLine + sub).length <= maxLength) {
              currentLine = currentLine + sub;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = sub;
            }
          }
        });
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Helper to construct HTML for native print layout
function generatePrintLayoutHTML(cards, mapDataUrl, orientation) {
  const container = document.getElementById('print-layout-container');
  if (!container) return;
  
  // Set orientation class for dynamic media sizing
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
  
  let cardsHtml = '';
  if (cards && cards.length > 0) {
    const cardItemsHtml = cards.map(f => {
      const cleanSource = f._source === 'parking' ? 'Parking' : f._source === 'establishment' ? 'Local Establishment' : 'Parks & Recreation';
      const tagsList = (f.properties.tags || f._source || '').split(',').map(tag => tag.trim()).filter(Boolean);
      const tagSpanList = tagsList.map(tag => `<span class="print-card-tag">${tag}</span>`).join('');
      
      const desc = f.properties.description ? `<p class="print-card-meta"><strong>About:</strong> ${f.properties.description}</p>` : '';
      const addr = f.properties.address ? `<p class="print-card-meta"><strong>Location:</strong> ${f.properties.address}</p>` : '';
      const phone = f.properties.phone ? `<p class="print-card-meta"><strong>Phone:</strong> ${f.properties.phone}</p>` : '';
      const web = f.properties.url ? `<p class="print-card-meta"><strong>Website:</strong> ${f.properties.url}</p>` : '';
      
      let borderColor = '#1a4d7c';
      if (typeof tagColors !== 'undefined') {
        const firstTag = tagsList[0] ? tagsList[0].toLowerCase() : '';
        if (tagColors[firstTag]) {
          borderColor = tagColors[firstTag];
        }
      }
      
      return `
        <div class="print-card" style="border-left-color: ${borderColor};">
          <div class="print-card-title">${f.properties.name || 'Unnamed'}</div>
          <div class="print-card-category">${cleanSource}</div>
          ${desc}
          ${addr}
          ${phone}
          ${web}
          <div class="print-card-tags">${tagSpanList}</div>
        </div>
      `;
    }).join('');
    
    cardsHtml = `
      <div class="print-section-title">Borough Directory Listings (${cards.length} items)</div>
      <div class="print-cards-grid">
        ${cardItemsHtml}
      </div>
    `;
  }
  
  container.innerHTML = `
    <div class="print-header">
      <h1>${title}</h1>
      <div class="print-meta">
        <div>Date: ${dateStr}</div>
        <div>URL: ${window.location.origin + window.location.pathname}</div>
      </div>
    </div>
    <div class="print-subheader">Westville Borough Map & Directory Portal</div>
    ${mapHtml}
    ${cardsHtml}
  `;
}

// Run Browser Native Printing
if (printExecuteBtn) {
  printExecuteBtn.addEventListener('click', async () => {
    try {
      const orientation = printOrientation.value;
      const includeMap = printIncludeMap.checked;
      const includeCardsVal = printIncludeCards.value;
      
      // Update UI loading status
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
      
      // Generate print container contents
      generatePrintLayoutHTML(cards, mapDataUrl, orientation);
      
      // Close modal configuration cleanly
      closeModal();
      
      // Set orientation in media print rules dynamically
      const printStyle = document.createElement('style');
      printStyle.id = 'dynamic-print-page-style';
      printStyle.innerHTML = `@page { size: ${orientation}; margin: 0.5in; }`;
      document.head.appendChild(printStyle);
      
      // Trigger native browser printing block
      setTimeout(() => {
        window.print();
        
        // Clean up print-layout container and style tags on finish
        printStyle.remove();
        const container = document.getElementById('print-layout-container');
        if (container) container.innerHTML = '';
        if (printLoadingMsg) printLoadingMsg.style.display = 'none';
      }, 350);
      
    } catch (err) {
      console.error("Failed to complete printing operation:", err);
      alert("Error printing portal view: " + err.message);
      if (printLoadingMsg) printLoadingMsg.style.display = 'none';
    }
  });
}

// Convert data URL to array buffer for pdf-lib standard loading
function base64ToUint8Array(base64) {
  const base64Data = base64.split(',')[1] || base64;
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to draw left border and text block inside PDF dynamically
function drawPdfCard(pdfDoc, page, helvetica, helveticaBold, x, y, width, f, tColors) {
  const name = f.properties.name || 'Unnamed';
  const cleanSource = f._source === 'parking' ? 'Parking' : f._source === 'establishment' ? 'Local Establishment' : 'Parks & Recreation';
  const desc = f.properties.description || '';
  const addr = f.properties.address || '';
  const phone = f.properties.phone || '';
  const web = f.properties.url || '';
  
  // Wrap details
  const wrapWidth = Math.floor(width / 6); // character width approximation
  const descLines = desc ? wrapText(`About: ${desc}`, wrapWidth) : [];
  const addrLines = addr ? wrapText(`Location: ${addr}`, wrapWidth) : [];
  const phoneLines = phone ? [`Phone: ${phone}`] : [];
  const webLines = web ? wrapText(`Website: ${web}`, wrapWidth) : [];
  const tagsList = (f.properties.tags || f._source || '').split(',').map(tag => tag.trim()).filter(Boolean);
  const tagsLine = tagsList.length > 0 ? `Tags: ${tagsList.join(', ')}` : '';
  const tagsLines = tagsLine ? wrapText(tagsLine, wrapWidth) : [];
  
  // Calculate heights
  let lineCount = 2 + descLines.length + addrLines.length + phoneLines.length + webLines.length + tagsLines.length;
  const cardHeight = lineCount * 12 + 15;
  
  // Get tag color or default primary blue
  let tagColorHex = '#1a4d7c';
  if (tColors && tagsList[0]) {
    const firstTag = tagsList[0].toLowerCase();
    if (tColors[firstTag]) {
      tagColorHex = tColors[firstTag];
    }
  }
  
  // Parse Hex color to RGB
  let r = 26/255, g = 77/255, b = 124/255;
  if (tagColorHex.startsWith('#')) {
    const hex = tagColorHex.replace('#', '');
    if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
    }
  }
  
  // Draw card border boundary box
  page.drawRectangle({
    x: x,
    y: y - cardHeight,
    width: width,
    height: cardHeight,
    borderColor: PDFLib.rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    color: PDFLib.rgb(1, 1, 1),
  });
  
  // Draw prominent left-hand color strip
  page.drawRectangle({
    x: x,
    y: y - cardHeight,
    width: 6,
    height: cardHeight,
    color: PDFLib.rgb(r, g, b),
  });
  
  // Draw Card Contents
  let currY = y - 16;
  
  // Draw Title
  page.drawText(name, {
    x: x + 15,
    y: currY,
    size: 11,
    font: helveticaBold,
    color: PDFLib.rgb(26/255, 77/255, 124/255),
  });
  currY -= 13;
  
  // Draw Category
  page.drawText(cleanSource, {
    x: x + 15,
    y: currY,
    size: 8.5,
    font: helveticaBold,
    color: PDFLib.rgb(0.4, 0.4, 0.4),
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
  
  // Draw Details
  if (desc) drawTextLines(descLines);
  if (addr) drawTextLines(addrLines);
  if (phone) drawTextLines(phoneLines);
  if (web) drawTextLines(webLines);
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

// Client-side multi-page PDF Compiler using pdf-lib
if (printPdfBtn) {
  printPdfBtn.addEventListener('click', async () => {
    try {
      const orientation = printOrientation.value;
      const includeMap = printIncludeMap.checked;
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
      
      // Determine page size dimensions
      const isLandscape = orientation === 'landscape';
      const pageWidth = isLandscape ? 792 : 612;
      const pageHeight = isLandscape ? 612 : 792;
      
      const title = getPrintHeaderTitle();
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      
      // --- Page 1 Header and Map ---
      const page1 = pdfDoc.addPage([pageWidth, pageHeight]);
      
      // Main Page Title
      page1.drawText(title, {
        x: 50,
        y: pageHeight - 45,
        size: 11.5,
        font: helveticaBold,
        color: rgb(43/255, 101/255, 159/255),
      });
      
      // Subtitle
      page1.drawText("Westville Borough Map & Directory Portal", {
        x: 50,
        y: pageHeight - 58,
        size: 10,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      });
      
      // Metadata (Date & Domain)
      const metaText = `Generated on: ${dateStr}  |  URL: ${window.location.origin + window.location.pathname}`;
      page1.drawText(metaText, {
        x: 50,
        y: pageHeight - 70,
        size: 8.5,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      
      // Draw border dividing header
      page1.drawLine({
        start: { x: 50, y: pageHeight - 76 },
        end: { x: pageWidth - 50, y: pageHeight - 76 },
        thickness: 1.5,
        color: rgb(0.2, 0.2, 0.2),
      });
      
      let nextY = pageHeight - 88;
      
      // Embed map if chosen
      if (mapDataUrl) {
        if (printLoadingMsg) {
          printLoadingText.innerText = "Embedding WebGL canvas layers...";
        }
        try {
          const imageBytes = base64ToUint8Array(mapDataUrl);
          const mapImgEmbed = await pdfDoc.embedPng(imageBytes);
          
          // Calculate fitted map proportions cleanly within borders
          const maxMapWidth = pageWidth - 100;
          const maxMapHeight = nextY - 60; // Leave space for page index footer
          
          let mapW = mapImgEmbed.width;
          let mapH = mapImgEmbed.height;
          
          const ratio = Math.min(maxMapWidth / mapW, maxMapHeight / mapH);
          mapW = mapW * ratio;
          mapH = mapH * ratio;
          
          const mapX = 50 + (maxMapWidth - mapW) / 2;
          const mapY = nextY - mapH;
          
          // Draw image
          page1.drawImage(mapImgEmbed, {
            x: mapX,
            y: mapY,
            width: mapW,
            height: mapH,
          });
          
          // Draw border boundary
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
        page1.drawText("Portal directory view (map excluded). See directory lists on succeeding pages.", {
          x: 50,
          y: nextY - 30,
          size: 10,
          font: helvetica,
          color: rgb(0.4, 0.4, 0.4),
        });
        nextY -= 50;
      }
      
      // Draw Page 1 Footer index
      page1.drawText("Page 1 of Directory Portal", {
        x: pageWidth - 160,
        y: 35,
        size: 8.5,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
      
      // --- Process Cards ---
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
        
        // Header on succeeding page
        currPage.drawText(`Borough Directory - Continued (${cards.length} items)`, {
          x: 50,
          y: pageHeight - 40,
          size: 12,
          font: helveticaBold,
          color: rgb(43/255, 101/255, 159/255),
        });
        
        currPage.drawLine({
          start: { x: 50, y: pageHeight - 48 },
          end: { x: pageWidth - 50, y: pageHeight - 48 },
          thickness: 1,
          color: rgb(0.7, 0.7, 0.7),
        });
        
        // Two-column layout parameters
        const leftColX = 50;
        const rightColX = isLandscape ? 410 : 315;
        const colWidth = isLandscape ? 332 : 247;
        
        let isLeftColumn = true;
        let leftColY = cardY;
        let rightColY = cardY;
        
        for (let i = 0; i < cards.length; i++) {
          const f = cards[i];
          
          // Estimate card height first to handle overflow
          const name = f.properties.name || 'Unnamed';
          const desc = f.properties.description || '';
          const addr = f.properties.address || '';
          const phone = f.properties.phone || '';
          const web = f.properties.url || '';
          const tagsList = (f.properties.tags || f._source || '').split(',').map(tag => tag.trim()).filter(Boolean);
          const tagsLine = tagsList.length > 0 ? `Tags: ${tagsList.join(', ')}` : '';
          
          const wrapWidth = Math.floor(colWidth / 6);
          const descLines = desc ? wrapText(`About: ${desc}`, wrapWidth) : [];
          const addrLines = addr ? wrapText(`Location: ${addr}`, wrapWidth) : [];
          const phoneLines = phone ? [`Phone: ${phone}`] : [];
          const webLines = web ? wrapText(`Website: ${web}`, wrapWidth) : [];
          const tagsLines = tagsLine ? wrapText(tagsLine, wrapWidth) : [];
          
          const lineCount = 2 + descLines.length + addrLines.length + phoneLines.length + webLines.length + tagsLines.length;
          const cardHeight = lineCount * 12 + 15;
          
          // Choose column and check page overflow
          let targetX = leftColX;
          let targetY = leftColY;
          
          if (!isLeftColumn) {
            targetX = rightColX;
            targetY = rightColY;
          }
          
          // Does it overflow the page?
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
                currPage.drawText(`Borough Directory - Continued (${cards.length} items)`, {
                  x: 50,
                  y: pageHeight - 40,
                  size: 12,
                  font: helveticaBold,
                  color: rgb(43/255, 101/255, 159/255),
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
              currPage.drawText(`Borough Directory - Continued (${cards.length} items)`, {
                x: 50,
                y: pageHeight - 40,
                size: 12,
                font: helveticaBold,
                color: rgb(43/255, 101/255, 159/255),
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
          
          const drawnHeight = drawPdfCard(pdfDoc, currPage, helvetica, helveticaBold, targetX, targetY, colWidth, f, typeof tagColors !== 'undefined' ? tagColors : null);
          
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
      downloadLink.download = `${cleanTitle}-portal-export.pdf`;
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

// Initialize collapsible Quick Views & Shortcuts on mobile
const shortcutsTrigger = document.getElementById('shortcuts-trigger');
const shortcutsGrid = document.getElementById('shortcuts-grid-container');

if (shortcutsTrigger && shortcutsGrid) {
  const shortcutsWrapper = shortcutsTrigger.closest('.shortcuts-wrapper-card');

  // Check if we are on mobile on load (768px is the media breakpoint)
  const checkCollapsibleInit = () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      shortcutsGrid.classList.add('collapsed');
      shortcutsTrigger.classList.add('collapsed');
      if (shortcutsWrapper) shortcutsWrapper.classList.add('collapsed');
      shortcutsTrigger.classList.remove('active');
      shortcutsTrigger.setAttribute('aria-expanded', 'false');
      shortcutsTrigger.setAttribute('role', 'button');
      shortcutsTrigger.setAttribute('tabindex', '0');
    } else {
      shortcutsGrid.classList.remove('collapsed');
      shortcutsTrigger.classList.remove('collapsed');
      if (shortcutsWrapper) shortcutsWrapper.classList.remove('collapsed');
      shortcutsTrigger.classList.add('active');
      shortcutsTrigger.setAttribute('aria-expanded', 'true');
      shortcutsTrigger.removeAttribute('role');
      shortcutsTrigger.removeAttribute('tabindex');
    }
  };

  // Initial check
  checkCollapsibleInit();

  // Re-verify on resize so it naturally matches standard screen transitions
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      shortcutsGrid.classList.remove('collapsed');
      shortcutsTrigger.classList.remove('collapsed');
      if (shortcutsWrapper) shortcutsWrapper.classList.remove('collapsed');
      shortcutsTrigger.classList.add('active');
      shortcutsTrigger.setAttribute('aria-expanded', 'true');
      shortcutsTrigger.removeAttribute('role');
      shortcutsTrigger.removeAttribute('tabindex');
    } else {
      // Initialize as mobile-collapsible on downsize if not already set
      if (!shortcutsTrigger.hasAttribute('role')) {
        checkCollapsibleInit();
      }
    }
  });

  // Toggle on click/tap
  shortcutsTrigger.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      const isCollapsed = shortcutsGrid.classList.toggle('collapsed');
      shortcutsTrigger.classList.toggle('collapsed', isCollapsed);
      shortcutsTrigger.classList.toggle('active', !isCollapsed);
      if (shortcutsWrapper) shortcutsWrapper.classList.toggle('collapsed', isCollapsed);
      shortcutsTrigger.setAttribute('aria-expanded', !isCollapsed ? 'true' : 'false');
    }
  });

  // Keyboard navigation support for accessibility
  shortcutsTrigger.addEventListener('keydown', (e) => {
    if (window.innerWidth <= 768 && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      shortcutsTrigger.click();
    }
  });
}

function initLayerCheckboxes() {
  const layers = ['parking', 'establishments', 'recreation', 'satellite', 'map'];
  layers.forEach(layer => {
    const checkbox = document.getElementById(`layer-${layer}`);
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        
        // Immediate visual update
        const label = checkbox.closest('.interactive-tag');
        if (label) {
          if (checked) label.classList.add('checked');
          else label.classList.remove('checked');
        }
        
        // Post message to map iframe to toggle layer
        const iframe = document.getElementById('mapFrame');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({
            type: 'parent-toggle-layer',
            layer: layer,
            visible: checked
          }, '*');
        }
      });
    }
  });
}

// Start fetching data
initLayerCheckboxes();
initDirectory();
