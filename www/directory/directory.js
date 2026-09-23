// Westville Business Directory Script

// Color groupings and contrast utilities are now loaded globally from components.js


// Global Directory State
let allDirFeatures = [];
let selectedView = 'all';
const selectedCategories = new Set(['all']);
const selectedFilters = new Set(['all']);

// DOM Elements
let dirGrid, dirSearch, dirSort, resultsCount;
let catTrigger, catDropdown, filterTrigger, filterDropdown;

document.addEventListener('DOMContentLoaded', () => {
  // Bind UI Elements
  dirGrid = document.getElementById('directory-grid');
  dirSearch = document.getElementById('dir-search');
  dirSort = document.getElementById('dir-sort');
  resultsCount = document.getElementById('results-count');
  
  catTrigger = document.getElementById('dir-category-trigger');
  catDropdown = document.getElementById('dir-category-dropdown');
  filterTrigger = document.getElementById('dir-filter-trigger');
  filterDropdown = document.getElementById('dir-filter-dropdown');

  // Multi-select triggers
  setupDropdownTrigger(catTrigger, catDropdown);
  setupDropdownTrigger(filterTrigger, filterDropdown);

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#dir-category-container')) {
      closeDropdown(catTrigger, catDropdown);
    }
    if (!e.target.closest('#dir-filter-container')) {
      closeDropdown(filterTrigger, filterDropdown);
    }
  });

  // Listeners for input and sorting changes
  if (dirSearch) dirSearch.addEventListener('input', renderDirectory);
  if (dirSort) dirSort.addEventListener('change', renderDirectory);

  initQuickViews();
  initResetButton();

  // Boot Directory
  initDirectory();

  // Initialize Print Options and Sharing controls
  initPrintAndShare();
});

// Dropdown trigger and close functions are loaded globally from components.js


async function initDirectory() {
  try {
    if (dirGrid) dirGrid.innerHTML = '<p class="loading-text">Loading Westville directory data...</p>';
    
    const files = ['parking', 'establishments', 'recreation'];
    const requestPromises = files.map(file => fetch(`/data/${file}.geojson`));
    const responses = await Promise.all(requestPromises);

    const data = await Promise.all(responses.map(async (res, index) => {
      if (!res.ok) throw new Error(`HTTP error loading ${files[index]}: ${res.status}`);
      const json = await res.json();
      return { [files[index]]: json };
    }));

    const collections = Object.fromEntries(data.map(obj => Object.entries(obj)[0]));

    if (collections.parking) {
      collections.parking.features.forEach(f => {
        if (!f.properties) f.properties = {};
        f.properties.primary_tag = 'parking';
        allDirFeatures.push({ ...f, _source: 'parking' });
      });
    }
    if (collections.establishments) {
      collections.establishments.features.forEach(f => {
        if (!f.properties) f.properties = {};
        let primaryTag = '';
        if (f.properties.tags) {
          primaryTag = f.properties.tags.split(',')[0].trim().toLowerCase();
        } else if (f.properties.class) {
          primaryTag = f.properties.class.toLowerCase();
        } else {
          primaryTag = 'establishments';
        }
        f.properties.primary_tag = primaryTag;
        allDirFeatures.push({ ...f, _source: 'establishment' });
      });
    }
    if (collections.recreation) {
      collections.recreation.features.forEach(f => {
        if (!f.properties) f.properties = {};
        let primaryTag = '';
        if (f.properties.tags) {
          primaryTag = f.properties.tags.split(',')[0].trim().toLowerCase();
        } else if (f.properties.class) {
          primaryTag = f.properties.class.toLowerCase();
        } else {
          primaryTag = 'recreation';
        }
        f.properties.primary_tag = primaryTag;
        allDirFeatures.push({ ...f, _source: 'recreation' });
      });
    }
    if (collections['home-business']) {
      collections['home-business'].features.forEach(f => {
        if (!f.properties) f.properties = {};
        let primaryTag = 'home-business';
        if (f.properties.tags) {
          primaryTag = f.properties.tags.split(',')[0].trim().toLowerCase();
        }
        f.properties.primary_tag = primaryTag;
        allDirFeatures.push({ ...f, _source: 'home-business' });
      });
    }
    if (collections['industrial']) {
      collections['industrial'].features.forEach(f => {
        if (!f.properties) f.properties = {};
        let primaryTag = 'industrial';
        if (f.properties.tags) {
          primaryTag = f.properties.tags.split(',')[0].trim().toLowerCase();
        }
        f.properties.primary_tag = primaryTag;
        allDirFeatures.push({ ...f, _source: 'industrial' });
      });
    }

    // Parse all unique tags for filter dropdown
    const uniqueTags = new Set();
    allDirFeatures.forEach(f => {
      if (f.properties.tags) {
        f.properties.tags.split(',').forEach(tag => {
          uniqueTags.add(tag.trim());
        });
      }
    });
    const sortedTags = Array.from(uniqueTags).sort();

    // Check if initial parameters are in URL on boot
    const bootUrlParams = new URLSearchParams(window.location.search);
    const initialFilters = bootUrlParams.get('filter');
    if (initialFilters) {
      selectedFilters.clear();
      selectedCategories.clear();
      const filterParts = initialFilters.split(',').map(s => s.trim().toLowerCase());
      filterParts.forEach(part => {
        // match category source (parking, establishment, recreation, home-business, industrial)
        const matchingCat = ['parking', 'establishment', 'recreation', 'home-business', 'industrial'].find(c => c.toLowerCase() === part);
        if (matchingCat) {
          selectedFilters.add('cat:' + matchingCat);
        }
        
        // match color category key
        const matchingColorCat = Object.keys(categoryColors).find(k => k.toLowerCase() === part);
        if (matchingColorCat) {
          selectedCategories.add(matchingColorCat);
        }

        // match tag
        const matchingTag = sortedTags.find(t => t.toLowerCase() === part);
        if (matchingTag) {
          selectedFilters.add('tag:' + matchingTag);
        }
      });
      if (selectedFilters.size === 0) {
        selectedFilters.add('all');
      }
      if (selectedCategories.size === 0) {
        selectedCategories.add('all');
      }
    }

    const initialSearch = bootUrlParams.get('search');
    if (initialSearch && dirSearch) {
      dirSearch.value = initialSearch;
    }

    const initialView = bootUrlParams.get('view');
    if (initialView && window.directoryViews && window.directoryViews[initialView]) {
      selectedView = initialView;
      setActiveView(initialView, false);
    }

    // Update live counter badges for Quick Views
    updateQuickViewCounts();

    // Populate drop-downs
    populateCategoryDropdown();
    populateTagDropdown(sortedTags);

    // Update triggers based on URL parameters on boot
    updateDropdownLabel(catTrigger, selectedCategories, 'All Categories', 'Categories');
    updateDropdownLabel(filterTrigger, selectedFilters, 'All Tags', 'Tags');

    // Initial render
    renderDirectory();

  } catch (err) {
    console.error('Error loading directory files:', err);
    if (dirGrid) dirGrid.innerHTML = '<p class="error-text">Could not load directory data.</p>';
  }
}

// Quick Views Helper Functions
function getFeatureCategory(f) {
  if (!f || !f.properties) return null;
  const primTag = f.properties.primary_tag;
  if (primTag && window.tagToCategory && window.tagToCategory[primTag]) {
    return window.tagToCategory[primTag];
  }
  if (f._source && window.tagToCategory && window.tagToCategory[f._source]) {
    return window.tagToCategory[f._source];
  }
  return null;
}

function featureMatchesView(f, viewKey) {
  if (!viewKey || viewKey === 'all') return true;
  if (!window.directoryViews || !window.directoryViews[viewKey]) return true;
  const featCat = getFeatureCategory(f);
  return featCat && window.directoryViews[viewKey].categories.includes(featCat);
}

function updateQuickViewCounts() {
  if (!window.directoryViews) return;
  const counts = { all: allDirFeatures.length };
  Object.keys(window.directoryViews).forEach(vk => {
    if (vk !== 'all') counts[vk] = 0;
  });

  allDirFeatures.forEach(f => {
    const featCat = getFeatureCategory(f);
    if (!featCat) return;
    Object.keys(window.directoryViews).forEach(vk => {
      if (vk === 'all') return;
      if (window.directoryViews[vk].categories.includes(featCat)) {
        counts[vk]++;
      }
    });
  });

  Object.keys(counts).forEach(vk => {
    const countEl = document.getElementById(`count-${vk}`);
    if (countEl) countEl.innerText = counts[vk];
    const dropCountEl = document.getElementById(`dir-dropdown-count-${vk}`);
    if (dropCountEl) dropCountEl.innerText = counts[vk];
  });

  // Update mobile active dropdown badge
  const activeDropCount = document.getElementById('dir-dropdown-active-count');
  if (activeDropCount && counts[selectedView] !== undefined) {
    activeDropCount.innerText = counts[selectedView];
  }
}

/* TEMPORARY: A/B testing mobile_view param (chips vs dropdown). Will remove unchosen mode. */
function initMobileViewMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const mobileMode = urlParams.get('mobile_view'); // 'dropdown' or 'chips' (default)
  const isDropdownMode = mobileMode === 'dropdown';

  const quickViewsContainer = document.getElementById('directory-quick-views');
  if (quickViewsContainer) {
    quickViewsContainer.classList.toggle('mode-dropdown', isDropdownMode);
    quickViewsContainer.classList.toggle('mode-chips', !isDropdownMode);
  }

  const trigger = document.getElementById('dir-quick-views-dropdown-trigger');
  const menu = document.getElementById('dir-quick-views-dropdown-menu');
  if (!trigger || !menu) return;

  // Populate dropdown menu items from window.directoryViews
  menu.innerHTML = '';
  if (window.directoryViews) {
    Object.entries(window.directoryViews).forEach(([key, viewObj]) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'quick-views-dropdown-item' + (key === selectedView ? ' active' : '');
      item.setAttribute('data-view', key);
      item.innerHTML = `
        <span class="dropdown-item-title">${viewObj.title}</span>
        <span class="dropdown-item-count" id="dir-dropdown-count-${key}">0</span>
      `;
      item.addEventListener('click', () => {
        setActiveView(key, true);
        trigger.setAttribute('aria-expanded', 'false');
        menu.classList.remove('open');
      });
      menu.appendChild(item);
    });
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#dir-quick-views-dropdown-wrapper')) {
      menu.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
}

function initQuickViews() {
  initMobileViewMode();
  const pillsContainer = document.getElementById('quick-views-pills');
  if (!pillsContainer) return;
  pillsContainer.querySelectorAll('.quick-view-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewKey = btn.getAttribute('data-view') || 'all';
      setActiveView(viewKey, true);
    });
  });
}

function setActiveView(viewKey, triggerRender = true) {
  selectedView = viewKey;
  const pillsContainer = document.getElementById('quick-views-pills');
  if (pillsContainer) {
    pillsContainer.querySelectorAll('.quick-view-pill').forEach(btn => {
      const isCurrent = btn.getAttribute('data-view') === viewKey;
      btn.classList.toggle('active', isCurrent);
      btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    });
  }

  // Update mobile dropdown trigger label & count
  const triggerLabel = document.getElementById('dir-dropdown-active-label');
  const triggerCount = document.getElementById('dir-dropdown-active-count');
  if (triggerLabel && window.directoryViews && window.directoryViews[viewKey]) {
    triggerLabel.innerText = window.directoryViews[viewKey].title;
  }
  const countEl = document.getElementById(`count-${viewKey}`);
  if (triggerCount && countEl) {
    triggerCount.innerText = countEl.innerText;
  }

  // Update active state in mobile dropdown menu items
  const menu = document.getElementById('dir-quick-views-dropdown-menu');
  if (menu) {
    menu.querySelectorAll('.quick-views-dropdown-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewKey);
    });
  }

  if (triggerRender) {
    updateUrlParams(true);
    renderDirectory();
  }
}

function populateCategoryDropdown() {
  if (!catDropdown) return;
  catDropdown.innerHTML = '';

  // All Categories option
  const allLabel = document.createElement('label');
  allLabel.className = 'multiselect-option';
  const isAllChecked = selectedCategories.has('all') ? 'checked' : '';
  allLabel.innerHTML = `<input type="checkbox" value="all" ${isAllChecked}> <span>All Categories</span>`;
  catDropdown.appendChild(allLabel);

  Object.keys(categoryColors).forEach(catKey => {
    const cat = categoryColors[catKey];
    const label = document.createElement('label');
    label.className = 'multiselect-option';
    const isChecked = selectedCategories.has(catKey) ? 'checked' : '';
    label.innerHTML = `<input type="checkbox" value="${catKey}" ${isChecked}> <span>${cat.title}</span>`;
    catDropdown.appendChild(label);
  });

  // Bind checkbox changes
  catDropdown.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', () => {
      const val = input.value;
      if (val === 'all') {
        if (input.checked) {
          selectedCategories.clear();
          selectedCategories.add('all');
          catDropdown.querySelectorAll('input').forEach(i => {
            if (i.value !== 'all') i.checked = false;
          });
        } else {
          selectedCategories.delete('all');
        }
      } else {
        if (input.checked) {
          selectedCategories.delete('all');
          const allCheckbox = catDropdown.querySelector('input[value="all"]');
          if (allCheckbox) allCheckbox.checked = false;
          selectedCategories.add(val);
        } else {
          selectedCategories.delete(val);
          if (selectedCategories.size === 0) {
            selectedCategories.add('all');
            const allCheckbox = catDropdown.querySelector('input[value="all"]');
            if (allCheckbox) allCheckbox.checked = true;
          }
        }
      }
      updateDropdownLabel(catTrigger, selectedCategories, 'All Categories', 'Categories');
      renderDirectory();
    });
  });
}

function populateTagDropdown(sortedTags) {
  if (!filterDropdown) return;
  filterDropdown.innerHTML = '';

  // All Tags option
  const allLabel = document.createElement('label');
  allLabel.className = 'multiselect-option';
  const isAllChecked = selectedFilters.has('all') ? 'checked' : '';
  allLabel.innerHTML = `<input type="checkbox" value="all" ${isAllChecked}> <span>All Tags</span>`;
  filterDropdown.appendChild(allLabel);

  sortedTags.forEach(tag => {
    const label = document.createElement('label');
    label.className = 'multiselect-option';
    const tagVal = `tag:${tag.toLowerCase()}`;
    const isChecked = selectedFilters.has(tagVal) ? 'checked' : '';
    label.innerHTML = `<input type="checkbox" value="${tagVal}" ${isChecked}> <span>${tag}</span>`;
    filterDropdown.appendChild(label);
  });

  // Bind checkbox changes
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
      updateDropdownLabel(filterTrigger, selectedFilters, 'All Tags', 'Tags');
      renderDirectory();
    });
  });
}

function updateDropdownLabel(trigger, selectedSet, defaultText, namePlural) {
  if (!trigger) return;
  const triggerText = trigger.querySelector('.trigger-text');
  if (!triggerText) return;

  if (selectedSet.has('all') || selectedSet.size === 0) {
    triggerText.innerText = defaultText;
  } else {
    const labels = [];
    selectedSet.forEach(val => {
      if (val === 'all') return;
      if (val.startsWith('tag:')) {
        labels.push(val.slice(4));
      } else {
        const cat = categoryColors[val];
        if (cat) labels.push(cat.title);
      }
    });
    if (labels.length === 1) {
      // capitalize first letter for display
      const cap = labels[0].charAt(0).toUpperCase() + labels[0].slice(1);
      triggerText.innerText = cap;
    } else {
      triggerText.innerText = `${namePlural} (${labels.length})`;
    }
  }
}

function renderDirectory() {
  if (!dirGrid || !dirSearch || !dirSort) return;
  const term = dirSearch.value.toLowerCase();
  const sortVal = dirSort.value;

  const results = allDirFeatures.filter(f => {
    // Filter by Quick View
    if (!featureMatchesView(f, selectedView)) {
      return false;
    }

    // Custom Multi-select Tags filter
    if (!selectedFilters.has('all') && selectedFilters.size > 0) {
      const tags = [];
      selectedFilters.forEach(val => {
        if (val.startsWith('tag:')) tags.push(val.slice(4).toLowerCase());
      });

      const featureTags = (f.properties.tags || '').toLowerCase().split(',').map(t => t.trim());
      const tagMatch = featureTags.some(t => tags.includes(t));

      if (!tagMatch) return false;
    }

    // Filter by Color Categories (selectedCategories)
    if (!selectedCategories.has('all') && selectedCategories.size > 0) {
      const primTag = f.properties.primary_tag;
      const featCatKey = tagToCategory[primTag] || null;
      if (!featCatKey || !selectedCategories.has(featCatKey)) {
        return false;
      }
    }

    if (term.length > 0) {
      const nameMatch = (f.properties.name || '').toLowerCase().includes(term);
      const descMatch = (f.properties.description || '').toLowerCase().includes(term);
      const tagsMatch = (f.properties.tags || '').toLowerCase().includes(term);
      const addrMatch = (f.properties.address || '').toLowerCase().includes(term);
      
      // Category title match
      let categoryMatch = false;
      const primTag = f.properties.primary_tag;
      const catKey = tagToCategory[primTag];
      if (catKey && categoryColors[catKey]) {
        const cat = categoryColors[catKey];
        categoryMatch = (cat.title || '').toLowerCase().includes(term);
      }

      return nameMatch || descMatch || tagsMatch || addrMatch || categoryMatch;
    }
    return true;
  });

  // Sort results
  results.sort((a, b) => {
    if (sortVal === 'name_asc') {
      return (a.properties.name || '').localeCompare(b.properties.name || '');
    } else if (sortVal === 'name_desc') {
      return (b.properties.name || '').localeCompare(a.properties.name || '');
    } else if (sortVal === 'category_asc' || sortVal === 'category_desc') {
      const catAKey = tagToCategory[a.properties.primary_tag] || '';
      const catBKey = tagToCategory[b.properties.primary_tag] || '';
      
      const catATitle = catAKey ? (categoryColors[catAKey]?.title || 'Uncategorized') : 'Uncategorized';
      const catBTitle = catBKey ? (categoryColors[catBKey]?.title || 'Uncategorized') : 'Uncategorized';
      
      const comp = catATitle.localeCompare(catBTitle);
      if (comp !== 0) {
        return sortVal === 'category_asc' ? comp : -comp;
      }
      return (a.properties.name || '').localeCompare(b.properties.name || '');
    } else if (sortVal === 'tags_asc') {
      return (a.properties.tags || '').localeCompare(b.properties.tags || '');
    } else if (sortVal === 'tags_desc') {
      return (b.properties.tags || '').localeCompare(a.properties.tags || '');
    }
    return 0;
  });

  // Render cards grid
  dirGrid.innerHTML = '';
  if (resultsCount) {
    resultsCount.innerText = `Showing ${results.length} of ${allDirFeatures.length} listings`;
  }

  if (results.length === 0) {
    dirGrid.innerHTML = '<p class="no-results-msg">No matching listings found inside Westville.</p>';
    return;
  }

  results.forEach(f => {
    const card = document.createElement('div');
    card.className = 'facility-card';
    card.setAttribute('data-type', f._source);
    
    // Left-border color matching category
    const primaryTag = f.properties.primary_tag;
    const borderCol = tagColors[primaryTag] || '#888888';
    card.style.borderLeft = `5px solid ${borderCol}`;
    
    // Badges HTML
    const tagBadges = (f.properties.tags || f._source)
      .split(',')
      .map(tag => {
        const cleanTag = tag.trim();
        const color = tagColors[cleanTag.toLowerCase()] || '#888888';
        const textColor = getContrastColor(color);
        return `<span class="facility-badge" style="background-color: ${color}; color: ${textColor};">${cleanTag}</span>`;
      })
      .join(' ');

    // Contact & links
    const phone = f.properties.phone;
    const url = f.properties.url;
    const placeId = (f.properties && f.properties.id && typeof f.properties.id === 'string' && !/^(mock|vendor)-/i.test(f.properties.id.trim())) ? f.properties.id.trim() : '';
    
    let directionsUrl = '';
    if (f.geometry && f.geometry.type === 'Point') {
      const coords = f.geometry.coordinates;
      directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}${placeId ? `&destination_place_id=${encodeURIComponent(placeId)}` : ''}`;
    }

    let phoneButton = phone ? `
      <a href="tel:${phone.replace(/[^0-9]/g, '')}" class="facility-link phone-link" title="Call ${f.properties.name}">
        <svg class="detail-icon" viewBox="0 0 24 24"><path d="M6.62,10.79C8.06,13.5 10.38,15.74 13.09,17.18L15.29,14.98C15.56,14.71 15.96,14.63 16.3,14.74C17.43,15.11 18.64,15.31 19.89,15.31C20.5,15.31 21,15.81 21,16.42V19.89C21,20.5 20.5,21 19.89,21C10.56,21 3,13.44 3,4.11C3,3.5 3.5,3 4.11,3H7.58C8.19,3 8.69,3.5 8.69,4.11C8.69,5.36 8.89,6.57 9.26,7.7C9.37,8.04 9.29,8.44 9.02,8.71L6.62,10.79Z"/></svg>
        <span>Call</span>
      </a>` : '';

    let webButton = url ? `
      <a href="${url}" target="_blank" class="facility-link web-link" title="Visit website">
        <svg class="detail-icon" viewBox="0 0 24 24"><path d="M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3H14Z"/></svg>
        <span>Website</span>
      </a>` : '';

    let dirButton = directionsUrl ? `
      <a href="${directionsUrl}" target="_blank" class="facility-link dir-link" title="Get directions on Google Maps">
        <svg class="detail-icon stroke-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3L21 12L12 21L3 12ZM10 16v-4.5a2.5 2.5 0 0 1 2.5-2.5h3.5M14 6l3 3-3 3"/></svg>
        <span>Directions</span>
      </a>` : '';

    let detailsHtml = (phoneButton || webButton || dirButton) ? `
      <div class="facility-details">
        ${phoneButton}
        ${webButton}
        ${dirButton}
      </div>` : '';
    
    const catKey = tagToCategory[f.properties.primary_tag];
    const catTitle = catKey ? (categoryColors[catKey]?.title || 'Uncategorized') : 'Uncategorized';
    const catTextColor = catKey ? categoryColors[catKey].text : '#666666';

    const sortIndicatorHtml = `<div class="card-sort-indicator" style="color: ${catTextColor}; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.05em;">Category: ${catTitle}</div>`;

    card.innerHTML = `
      <div class="facility-header">
        ${sortIndicatorHtml}
        <h4>${f.properties.name || 'Unnamed'}</h4>
        <div class="facility-badges">${tagBadges}</div>
      </div>
      <p>${f.properties.description || ''}</p>
      <div class="facility-address">${f.properties.address || ''}</div>
      ${detailsHtml}
    `;

    dirGrid.appendChild(card);
  });

  if (document.activeElement === dirSearch) {
    updateUrlParams(false);
  } else {
    updateUrlParams(true);
  }
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

    if (selectedView && selectedView !== 'all') {
      newParams.set('view', selectedView);
    } else {
      newParams.delete('view');
    }

    const filterValues = [];
    
    if (selectedFilters && !selectedFilters.has('all')) {
      selectedFilters.forEach(val => {
        if (val === 'all') return;
        const cleanVal = val.startsWith('tag:') || val.startsWith('cat:') ? val.split(':')[1] : val;
        if (!filterValues.some(v => v.toLowerCase() === cleanVal.toLowerCase())) {
          filterValues.push(cleanVal);
        }
      });
    }

    if (selectedCategories && !selectedCategories.has('all')) {
      selectedCategories.forEach(val => {
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
    // 0. Reset selected Quick View
    selectedView = 'all';
    const pillsContainer = document.getElementById('quick-views-pills');
    if (pillsContainer) {
      pillsContainer.querySelectorAll('.quick-view-pill').forEach(btn => {
        const isAll = btn.getAttribute('data-view') === 'all';
        btn.classList.toggle('active', isAll);
        btn.setAttribute('aria-pressed', isAll ? 'true' : 'false');
      });
    }

    // 1. Reset directory search
    if (dirSearch) dirSearch.value = '';

    // 2. Reset directory sort
    if (dirSort) dirSort.value = 'name_asc';

    // 3. Clear/Reset selected categories
    if (selectedCategories) {
      selectedCategories.clear();
      selectedCategories.add('all');
    }
    // Update category checkboxes UI
    if (catDropdown) {
      const allCb = catDropdown.querySelector('input[value="all"]');
      if (allCb) allCb.checked = true;
      catDropdown.querySelectorAll('input').forEach(cb => {
        if (cb !== allCb) cb.checked = false;
      });
    }
    updateDropdownLabel(catTrigger, selectedCategories, 'All Categories', 'Categories');

    // 4. Clear/Reset selected filters
    if (selectedFilters) {
      selectedFilters.clear();
      selectedFilters.add('all');
    }
    // Update filter checkboxes UI
    if (filterDropdown) {
      const allCb = filterDropdown.querySelector('input[value="all"]');
      if (allCb) allCb.checked = true;
      filterDropdown.querySelectorAll('input').forEach(cb => {
        if (cb !== allCb) cb.checked = false;
      });
    }
    updateDropdownLabel(filterTrigger, selectedFilters, 'All Tags', 'Tags');

    // 5. Reset parent URL
    window.history.replaceState(null, '', window.location.pathname);

    // 6. Re-render directory
    renderDirectory();
  });
}

// --- Printing & Sharing Logic for Business Directory ---

// Helper to filter directory features
function getFilteredCards(includeAll = false) {
  if (includeAll) {
    return [...allDirFeatures].sort((a, b) => (a.properties.name || '').localeCompare(b.properties.name || ''));
  }
  
  if (!dirSearch || !dirSort) return [];
  const term = dirSearch.value.toLowerCase();
  const sortVal = dirSort.value;

  const results = allDirFeatures.filter(f => {
    // Filter by Quick View
    if (!featureMatchesView(f, selectedView)) {
      return false;
    }

    // Custom Multi-select Tags filter
    if (!selectedFilters.has('all') && selectedFilters.size > 0) {
      const tags = [];
      selectedFilters.forEach(val => {
        if (val.startsWith('tag:')) tags.push(val.slice(4).toLowerCase());
      });

      const featureTags = (f.properties.tags || '').toLowerCase().split(',').map(t => t.trim());
      const tagMatch = featureTags.some(t => tags.includes(t));

      if (!tagMatch) return false;
    }

    // Filter by Color Categories (selectedCategories)
    if (!selectedCategories.has('all') && selectedCategories.size > 0) {
      const primTag = f.properties.primary_tag;
      const featCatKey = tagToCategory[primTag] || null;
      if (!featCatKey || !selectedCategories.has(featCatKey)) {
        return false;
      }
    }

    if (term.length > 0) {
      const nameMatch = (f.properties.name || '').toLowerCase().includes(term);
      const descMatch = (f.properties.description || '').toLowerCase().includes(term);
      const tagsMatch = (f.properties.tags || '').toLowerCase().includes(term);
      const addrMatch = (f.properties.address || '').toLowerCase().includes(term);
      
      let categoryMatch = false;
      const primTag = f.properties.primary_tag;
      const catKey = tagToCategory[primTag];
      if (catKey && categoryColors[catKey]) {
        const cat = categoryColors[catKey];
        categoryMatch = (cat.title || '').toLowerCase().includes(term);
      }

      return nameMatch || descMatch || tagsMatch || addrMatch || categoryMatch;
    }
    return true;
  });

  results.sort((a, b) => {
    if (sortVal === 'name_asc') {
      return (a.properties.name || '').localeCompare(b.properties.name || '');
    } else if (sortVal === 'name_desc') {
      return (b.properties.name || '').localeCompare(a.properties.name || '');
    } else if (sortVal === 'category_asc' || sortVal === 'category_desc') {
      const catAKey = tagToCategory[a.properties.primary_tag] || '';
      const catBKey = tagToCategory[b.properties.primary_tag] || '';
      
      const catATitle = catAKey ? (categoryColors[catAKey]?.title || 'Uncategorized') : 'Uncategorized';
      const catBTitle = catBKey ? (categoryColors[catBKey]?.title || 'Uncategorized') : 'Uncategorized';
      
      const comp = catATitle.localeCompare(catBTitle);
      if (comp !== 0) {
        return sortVal === 'category_asc' ? comp : -comp;
      }
      return (a.properties.name || '').localeCompare(b.properties.name || '');
    } else if (sortVal === 'tags_asc') {
      return (a.properties.tags || '').localeCompare(b.properties.tags || '');
    } else if (sortVal === 'tags_desc') {
      return (b.properties.tags || '').localeCompare(a.properties.tags || '');
    }
    return 0;
  });

  return results;
}

// wrapText and base64ToUint8Array are loaded globally from components.js


// Compile printed header title from URL search parameters
function getPrintHeaderTitle() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const selections = [];

  const view = searchParams.get('view');
  if (view && window.directoryViews && window.directoryViews[view] && view !== 'all') {
    selections.push(`View: ${window.directoryViews[view].title}`);
  }
  
  const filter = searchParams.get('filter');
  if (filter) {
    filter.split(',').forEach(f => {
      const clean = f.trim().toLowerCase();
      if (categoryColors[clean]) {
        selections.push(categoryColors[clean].title);
      } else {
        const label = clean.charAt(0).toUpperCase() + clean.slice(1);
        selections.push(label);
      }
    });
  }
  
  const search = searchParams.get('search');
  if (search) selections.push(`Search: "${search}"`);
  
  if (selections.length === 0) {
    return "Westville Business Directory";
  }
  
  return "Westville Business Directory - " + selections.join(', ');
}

// Draw professional border cards within PDF pages
function drawPdfCard(pdfDoc, page, helvetica, helveticaBold, x, y, width, f) {
  const props = f.properties || {};
  const name = props.name || 'Unnamed';
  const primTag = props.primary_tag;
  const catKey = tagToCategory[primTag] || null;
  const cat = catKey ? categoryColors[catKey] : { title: 'Uncategorized', fill: '#1a4d7c' };
  const cleanSource = cat.title;
  const desc = props.description || '';
  const addr = props.address || '';
  const phone = props.phone || '';
  const web = props.url || '';
  
  const wrapWidth = Math.floor(width / 6);
  const descLines = desc ? wrapText(`About: ${desc}`, wrapWidth) : [];
  const addrLines = addr ? wrapText(`Location: ${addr}`, wrapWidth) : [];
  const phoneLines = phone ? [`Phone: ${phone}`] : [];
  const webLines = web ? wrapText(`Website: ${web}`, wrapWidth) : [];
  const tagsList = (props.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
  const tagsLine = tagsList.length > 0 ? `Tags: ${tagsList.join(', ')}` : '';
  const tagsLines = tagsLine ? wrapText(tagsLine, wrapWidth) : [];
  
  let lineCount = 2 + descLines.length + addrLines.length + phoneLines.length + webLines.length + tagsLines.length;
  const cardHeight = lineCount * 12 + 15;
  
  let r = 26/255, g = 77/255, b = 124/255;
  const themeColor = cat.fill;
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
    color: PDFLib.rgb(26/255, 77/255, 124/255),
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

// Generate print layout HTML inside body direct print containers
function generatePrintLayoutHTML(cards, orientation) {
  const container = document.getElementById('print-layout-container');
  if (!container) return;
  
  container.className = `print-${orientation}`;
  
  const title = getPrintHeaderTitle();
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  let cardsHtml = '';
  if (cards && cards.length > 0) {
    const cardItemsHtml = cards.map(f => {
      const primTag = f.properties.primary_tag;
      const catKey = tagToCategory[primTag] || null;
      const cat = catKey ? categoryColors[catKey] : { title: 'Uncategorized', fill: '#1a4d7c' };
      const cleanSource = cat.title;
      
      const tagsList = (f.properties.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
      const tagSpanList = tagsList.map(tag => `<span class="print-card-tag">${tag}</span>`).join('');
      
      const desc = f.properties.description ? `<p class="print-card-meta"><strong>About:</strong> ${f.properties.description}</p>` : '';
      const addr = f.properties.address ? `<p class="print-card-meta"><strong>Location:</strong> ${f.properties.address}</p>` : '';
      const phone = f.properties.phone ? `<p class="print-card-meta"><strong>Phone:</strong> ${f.properties.phone}</p>` : '';
      const web = f.properties.url ? `<p class="print-card-meta"><strong>Website:</strong> ${f.properties.url}</p>` : '';
      
      return `
        <div class="print-card" style="border-left-color: ${cat.fill || '#1a4d7c'};">
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
      <div class="print-section-title">Directory Listings (${cards.length} items)</div>
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
    <div class="print-subheader">Westville Borough Business Directory Portal</div>
    ${cardsHtml}
  `;
}

// Hook up printing modals and copy sharing triggers
function initPrintAndShare() {
  const printBtn = document.getElementById('print-btn');
  const printModal = document.getElementById('print-modal');
  const printModalCloseBtn = document.getElementById('print-modal-close-btn');
  const printCancelBtn = document.getElementById('print-cancel-btn');
  const printOrientation = document.getElementById('print-orientation');
  const printIncludeCards = document.getElementById('print-include-cards');
  const printLoadingMsg = document.getElementById('print-loading-msg');
  const printLoadingText = document.getElementById('print-loading-text');
  const printPdfBtn = document.getElementById('print-pdf-btn');
  const printExecuteBtn = document.getElementById('print-execute-btn');
  const printLayoutContainer = document.getElementById('print-layout-container');

  const shareBtn = document.getElementById('share-btn');

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
    }
  });

  if (printModal) {
    printModal.addEventListener('click', (e) => {
      if (e.target === printModal) {
        closeModal();
      }
    });
  }

  // --- Native Browser Printing ---
  if (printExecuteBtn) {
    printExecuteBtn.addEventListener('click', async () => {
      try {
        const orientation = printOrientation.value;
        const includeCardsVal = printIncludeCards.value;
        
        if (printLoadingMsg) {
          printLoadingText.innerText = "Formatting print layout...";
          printLoadingMsg.style.display = 'flex';
        }
        
        let cards = [];
        if (includeCardsVal === 'filtered') {
          cards = getFilteredCards(false);
        } else if (includeCardsVal === 'all') {
          cards = getFilteredCards(true);
        }
        
        generatePrintLayoutHTML(cards, orientation);
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
        console.error("Failed to execute native print:", err);
        alert("Error printing portal view: " + err.message);
        if (printLoadingMsg) printLoadingMsg.style.display = 'none';
      }
    });
  }

  // --- Export multi-page vector PDF ---
  if (printPdfBtn) {
    printPdfBtn.addEventListener('click', async () => {
      try {
        const orientation = printOrientation.value;
        const includeCardsVal = printIncludeCards.value;
        
        if (printLoadingMsg) {
          printLoadingText.innerText = "Preparing vector workspace...";
          printLoadingMsg.style.display = 'flex';
        }
        
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const pdfDoc = await PDFDocument.create();
        
        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const isLandscape = orientation === 'landscape';
        const pageWidth = isLandscape ? 792 : 612;
        const pageHeight = isLandscape ? 612 : 792;
        
        const title = getPrintHeaderTitle();
        const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        
        let currPage = pdfDoc.addPage([pageWidth, pageHeight]);
        let pageNum = 1;
        
        currPage.drawText(title, {
          x: 50,
          y: pageHeight - 45,
          size: 11.5,
          font: helveticaBold,
          color: rgb(43/255, 101/255, 159/255),
        });
        
        currPage.drawText("Westville Borough Business Directory Portal", {
          x: 50,
          y: pageHeight - 58,
          size: 10,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3),
        });
        
        const metaText = `Generated on: ${dateStr}  |  URL: ${window.location.origin + window.location.pathname}`;
        currPage.drawText(metaText, {
          x: 50,
          y: pageHeight - 70,
          size: 8.5,
          font: helvetica,
          color: rgb(0.4, 0.4, 0.4),
        });
        
        currPage.drawLine({
          start: { x: 50, y: pageHeight - 76 },
          end: { x: pageWidth - 50, y: pageHeight - 76 },
          thickness: 1.5,
          color: rgb(0.2, 0.2, 0.2),
        });
        
        let cardY = pageHeight - 95;
        
        let cards = [];
        if (includeCardsVal === 'filtered') {
          cards = getFilteredCards(false);
        } else if (includeCardsVal === 'all') {
          cards = getFilteredCards(true);
        }
        
        if (cards.length > 0) {
          if (printLoadingMsg) {
            printLoadingText.innerText = "Wrapping text & compiling directory grid...";
          }
          
          const leftColX = 50;
          const rightColX = isLandscape ? 410 : 315;
          const colWidth = isLandscape ? 332 : 247;
          
          let isLeftColumn = true;
          let leftColY = cardY;
          let rightColY = cardY;
          
          for (let i = 0; i < cards.length; i++) {
            const f = cards[i];
            
            const name = f.properties.name || 'Unnamed';
            const desc = f.properties.description || '';
            const addr = f.properties.address || '';
            const phone = f.properties.phone || '';
            const web = f.properties.url || '';
            
            const wrapWidth = Math.floor(colWidth / 6);
            const descLines = desc ? wrapText(`About: ${desc}`, wrapWidth) : [];
            const addrLines = addr ? wrapText(`Location: ${addr}`, wrapWidth) : [];
            const phoneLines = phone ? [`Phone: ${phone}`] : [];
            const webLines = web ? wrapText(`Website: ${web}`, wrapWidth) : [];
            const tagsList = (f.properties.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
            const tagsLine = tagsList.length > 0 ? `Tags: ${tagsList.join(', ')}` : '';
            const tagsLines = tagsLine ? wrapText(tagsLine, wrapWidth) : [];
            
            const lineCount = 2 + descLines.length + addrLines.length + phoneLines.length + webLines.length + tagsLines.length;
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
                  currPage.drawText(`Business Directory - Continued (${cards.length} items)`, {
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
                currPage.drawText(`Business Directory - Continued (${cards.length} items)`, {
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
        } else {
          currPage.drawText("No matching items to display inside directory list.", {
            x: 50,
            y: cardY - 20,
            size: 10,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5)
          });
        }
        
        if (printLoadingMsg) {
          printLoadingText.innerText = "Saving vector document...";
        }
        
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const downloadLink = document.createElement("a");
        const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `${cleanTitle}-directory-export.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        closeModal();
        if (printLoadingMsg) printLoadingMsg.style.display = 'none';
        
      } catch (err) {
        console.error("Failed to export PDF:", err);
        alert("Error generating PDF: " + err.message);
        if (printLoadingMsg) printLoadingMsg.style.display = 'none';
      }
    });
  }

  // --- Immediate share view clipboard copying ---
  if (shareBtn) {
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      shareBtn.disabled = true;
      const oldHtml = shareBtn.innerHTML;
      
      navigator.clipboard.writeText(window.location.href).then(() => {
        shareBtn.innerHTML = `
          <svg style="width: 15px; height: 15px; vertical-align: middle; margin-right: 6px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>Copied!
        `;
        setTimeout(() => {
          shareBtn.innerHTML = oldHtml;
          shareBtn.disabled = false;
        }, 2000);
      }, (err) => {
        alert('Could not copy link: ' + err.message);
        shareBtn.disabled = false;
      });
    });
  }
}


