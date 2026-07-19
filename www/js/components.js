const SHOW_FESTIVAL = false; // Set to false to manually hide the Festival page from navigation

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const activePage = this.getAttribute('active-page') || 'portal';
    
    const homeActive = activePage === 'portal' ? 'style="background-color: var(--accent-gold); color: var(--primary-blue);"' : '';
    const directoryActive = activePage === 'directory' ? 'style="background-color: var(--accent-gold); color: var(--primary-blue);"' : '';
    const festivalActive = activePage === 'festival' ? 'style="background-color: var(--accent-gold); color: var(--primary-blue);"' : '';

    let festivalLinkHTML = '';
    if (SHOW_FESTIVAL) {
      festivalLinkHTML = `
        <a href="/festival/" class="header-btn" ${festivalActive}>
          <span class="header-btn-text">Festival</span>
        </a>
      `;
    }

    let shortcutsHTML = `
      <a href="/" class="header-btn" ${homeActive}>
        <span class="header-btn-text">Home</span>
      </a>
      <a href="/directory/" class="header-btn" ${directoryActive}>
        <span class="header-btn-text">Directory</span>
      </a>
      ${festivalLinkHTML}
      <div class="help-split-btn">
        ${activePage === 'portal' ? `
        <button id="help-btn" class="help-split-left-btn help-btn" title="How to Use the Map">
          <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
              <path d="M12 21.5s-7-7.75-7-12.5a7 7 0 1 1 14 0c0 4.75-7 12.5-7 12.5z" />
              <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2.5-2.5 2.5" />
              <path d="M12 14h.01" />
            </svg>
          </span>
          <span class="header-btn-text">Help</span>
        </button>
        ` : `
        <a href="/?help=true" id="header-help-btn" class="help-split-left-btn" title="How to Use the Map">
          <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
              <path d="M12 21.5s-7-7.75-7-12.5a7 7 0 1 1 14 0c0 4.75-7 12.5-7 12.5z" />
              <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2.5-2.5 2.5" />
              <path d="M12 14h.01" />
            </svg>
          </span>
          <span class="header-btn-text">Help</span>
        </a>
        `}
        <button id="help-dropdown-toggle" class="help-split-right-btn" title="More Information" aria-haspopup="true" aria-expanded="false">
          <span style="font-size: 0.75rem;">▼</span>
        </button>
        <div id="help-dropdown" class="help-dropdown-menu">
          <a href="/credits.html" class="help-dropdown-item">
            <span class="help-dropdown-item-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; vertical-align: middle; margin-right: 6px;">
              <img style="width:14px; height:14px;" src="/images/credits-scroll.svg">
            </span>
            <span class="help-dropdown-item-text">Credits</span>
          </a>
          <a href="/privacy-tos.html" class="help-dropdown-item">
            <span class="help-dropdown-item-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; vertical-align: middle; margin-right: 6px;">
              <img style="width:14px; height:14px;" src="/images/shield-privacy.svg">
            </span>
            <span class="help-dropdown-item-text">Privacy & TOS</span>
          </a>
        </div>
      </div>
    `;
    
    this.innerHTML = `
      <header>
        <div class="brand-logo">
          <div class="brand-icon-img">
            <a href="/"><img class="mapicon" src="/images/w-pin.svg" alt="Westville Map Project Site Logo" aria-hidden="true"/></a>
          </div>
          <h1><a href="/" class="header_link">Welcome to Westville</a></h1>
        </div>
        <div class="header-shortcuts">
          ${shortcutsHTML}
        </div>
      </header>
    `;

    // Dropdown toggle logic
    const toggleBtn = this.querySelector('#help-dropdown-toggle');
    const dropdownMenu = this.querySelector('#help-dropdown');
    
    if (toggleBtn && dropdownMenu) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = dropdownMenu.classList.toggle('show');
        toggleBtn.setAttribute('aria-expanded', isShown);
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!this.contains(e.target)) {
          dropdownMenu.classList.remove('show');
          toggleBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    const activePage = this.getAttribute('active-page') || 'portal';
    
    const creditsStyle = activePage === 'credits' ? 'style="background-color: var(--accent-gold); color: var(--primary-blue);"' : '';
    const privacyStyle = activePage === 'privacy-tos' ? 'style="background-color: var(--accent-gold); color: var(--primary-blue);"' : '';

    let helpHTML = '';
    if (activePage === 'portal') {
      helpHTML = `
        <button id="footer-help-btn" class="header-btn help-btn" title="How to Use the Map">
          <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
              <path d="M12 21.5s-7-7.75-7-12.5a7 7 0 1 1 14 0c0 4.75-7 12.5-7 12.5z" />
              <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2.5-2.5 2.5" />
              <path d="M12 14h.01" />
            </svg>
          </span>
          <span class="header-btn-text">Help</span>
        </button>
      `;
    } else {
      helpHTML = `
        <a href="/?help=true" id="footer-help-btn" class="header-btn" title="How to Use the Map">
          <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
              <path d="M12 21.5s-7-7.75-7-12.5a7 7 0 1 1 14 0c0 4.75-7 12.5-7 12.5z" />
              <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2.5-2.5 2.5" />
              <path d="M12 14h.01" />
            </svg>
          </span>
          <span class="header-btn-text">Help</span>
        </a>
      `;
    }

    this.innerHTML = `
      <footer>
        <div class="brand-logo">
          <div class="brand-icon-img">
            <a href="/"><img class="mapicon" src="/images/w-pin.svg" alt="Westville Map Project Site Logo" aria-hidden="true"/></a>
          </div>
          <h1 style="font-size: 1.2rem;"><a href="/" style="color: var(--white); text-decoration: none;">Welcome to Westville</a></h1>
        </div>
        <p class="footer-copyright">&copy; 2026 Welcome to Westville Map Project. Not an official borough communication.</p>
        <div class="footer-shortcuts">
          <a href="/credits.html" class="header-btn" ${creditsStyle}>
            <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
              <img style="width:18px; height:18px;" src="/images/credits-scroll.svg" alt="Credits scroll">
            </span>
            <span class="header-btn-text">Credits</span>
          </a>
          <a href="/privacy-tos.html" class="header-btn" ${privacyStyle}>
            <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
              <img style="width:18px; height:18px;" src="/images/shield-privacy.svg" alt="Privacy shield">
            </span>
            <span class="header-btn-text">Privacy & TOS</span>
          </a>
          ${helpHTML}
        </div>
      </footer>
    `;
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);

class WvSort extends HTMLElement {
  constructor() {
    super();
    this._value = '';
    this._options = [];
  }

  get value() {
    return this._value;
  }

  set value(val) {
    if (this._value !== val) {
      this._value = val;
      this._updateSelected();
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  connectedCallback() {
    // Remove class from host to avoid double borders/padding on the custom element itself
    this.removeAttribute('class');

    // Parse light DOM options
    const optionElements = Array.from(this.querySelectorAll('option'));
    this._options = optionElements.map(opt => ({
      value: opt.value,
      label: opt.textContent,
      selected: opt.hasAttribute('selected')
    }));

    // Find default selected option or default to first
    const selectedOpt = this._options.find(opt => opt.selected) || this._options[0];
    this._value = selectedOpt ? selectedOpt.value : '';

    this._render();
  }

  _render() {
    const ariaLabel = this.getAttribute('aria-label') || 'Sort results';

    // Create the outer styled markup matching our custom-multiselect
    this.innerHTML = `
      <div class="custom-multiselect" style="position: relative;">
        <div class="multiselect-trigger" tabindex="0" role="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${ariaLabel}">
          <span class="trigger-text"></span>
          <span class="trigger-arrow">▼</span>
        </div>
        <div class="multiselect-dropdown" style="padding: 4px 0; border-top: 1px solid #ccc;">
          ${this._options.map(opt => `
            <div class="wv-sort-option" data-value="${opt.value}" style="padding: 10px 16px; cursor: pointer; transition: background-color 0.15s; display: flex; align-items: center; justify-content: space-between; font-size: 0.9rem; color: #453b36;">
              <span>${opt.label}</span>
              <span class="check-mark" style="color: var(--wv-checkmark-color, #c2410c); font-weight: bold; visibility: hidden;">✓</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Bind event listeners
    const trigger = this.querySelector('.multiselect-trigger');
    const container = this.querySelector('.custom-multiselect');

    if (trigger && container) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Toggle this dropdown active class
        const isActive = container.classList.toggle('active');
        trigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        
        // Close any other open dropdowns on the page safely
        document.querySelectorAll('.custom-multiselect').forEach(el => {
          if (el !== container) {
            el.classList.remove('active');
            const otherTrigger = el.querySelector('.multiselect-trigger');
            if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
          }
        });
      });

      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          trigger.click();
        }
      });
    }

    // Option clicks
    this.querySelectorAll('.wv-sort-option').forEach(optEl => {
      optEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = optEl.getAttribute('data-value');
        this.value = val;
        
        // Close dropdown
        if (container && trigger) {
          container.classList.remove('active');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('wv-sort')) {
        if (container && trigger) {
          container.classList.remove('active');
          trigger.setAttribute('aria-expanded', 'false');
        }
      }
    });

    this._updateSelected();
  }

  _updateSelected() {
    const selectedOpt = this._options.find(opt => opt.value === this._value);
    
    // Update trigger text
    const triggerText = this.querySelector('.trigger-text');
    if (triggerText && selectedOpt) {
      triggerText.innerText = selectedOpt.label;
    }

    // Update checkmarks and background styles on options
    this.querySelectorAll('.wv-sort-option').forEach(optEl => {
      const val = optEl.getAttribute('data-value');
      const isSelected = val === this._value;
      
      const checkMark = optEl.querySelector('.check-mark');
      if (checkMark) {
        checkMark.style.visibility = isSelected ? 'visible' : 'hidden';
      }

      optEl.style.backgroundColor = isSelected ? 'var(--wv-hover-bg, #f7f1eb)' : 'transparent';
      optEl.style.fontWeight = isSelected ? '700' : 'normal';
    });
  }
}

customElements.define('wv-sort', WvSort);

// Centralized Color Groupings metadata structure (Dual-Token System for Accessibility)
const categoryColors = {
  'safety': {
    title: 'Safety & Emergency',
    colorName: 'Red',
    fill: '#dc2626',
    text: '#c53030',
    tags: ['safety', 'police station', 'fire station', 'police']
  },
  'nightlife': {
    title: 'Nightlife, Bars & Breweries',
    colorName: 'Amber',
    fill: '#d97706',
    text: '#b45309',
    tags: ['brewery', 'bar', 'pub', 'nightlife', 'craft beer', 'liquor store', 'wine', 'beer', 'spirits']
  },
  'food': {
    title: 'Food, Dining & Cafes',
    colorName: 'Rose',
    fill: '#db2777',
    text: '#be123c',
    tags: ['restaurant', 'dining', 'food', 'cafe', 'banquet hall', 'event space', 'diner', 'bakery', 'sweets', 'take out', 'takeout', 'bbq', 'dessert', 'cookie cakes', 'cookies', 'pizza']
  },
  'wellness': {
    title: 'Wellness, Health & Salons',
    colorName: 'Teal',
    fill: '#0d9488',
    text: '#0f766e',
    tags: ['wellness', 'fitness', 'yoga', 'tai chi', 'health', 'umaa', 'salon', 'hair styling', 'barber', 'barbershop', 'kickboxing', 'karate', 'jujitsu', 'doctor']
  },
  'shop': {
    title: 'Shop & Retail',
    colorName: 'Emerald',
    fill: '#059669',
    text: '#047857',
    tags: ['convenience store', 'retail', 'groceries', 'shop', 'appliances', 'smoke shop', 'tobacco']
  },
  'services': {
    title: 'Services & Professional',
    colorName: 'Purple',
    fill: '#81007F',
    text: '#81007F',
    tags: ['laundry', 'service', 'laundromat', 'locksmith', 'key duplication', 'tax prep', 'bookkeeping', 'it management', 'bail bonds', 'bank']
  },
  'public': {
    title: 'Public & Government Resources',
    colorName: 'Royal Blue',
    fill: '#2563eb',
    text: '#1d4ed8',
    tags: ['borough offices', 'public resource', 'government', 'library', 'community', 'post office', 'education', 'public elementary school', 'pre-kindergarten school', 'pk-6', 'mail', 'packages', 'po boxes', 'senior center', 'public']
  },
  'autos': {
    title: 'Automotive',
    colorName: 'Gold',
    fill: '#ffd700',
    text: '#854d0e',
    tags: ['auto repair', 'dealership', 'mechanic', 'mechanic service', 'auto service', 'oil change', 'used cars', 'new cars', 'car wash', 'detailing', 'performance tuning']
  },
  'recreation': {
    title: 'Parks & Recreation',
    colorName: 'Forest Green',
    fill: '#16a34a',
    text: '#15803d',
    tags: ['park', 'recreation', 'walking path', 'walkingpath']
  },
  'parking': {
    title: 'Parking',
    colorName: 'Cobalt Blue',
    fill: '#2563eb',
    text: '#1e40af',
    tags: ['parking', 'free']
  },
  'home-business': {
    title: 'Home-Based Businesses',
    colorName: 'Warm Terracotta',
    fill: '#C2593F',
    text: '#A0432C',
    tags: ['home-business', 'web design', 'software', 'bookkeeping', 'finance', 'crafts', 'candles', 'tutoring', 'education', 'gardening', 'landscaping', 'music', 'piano', 'voice lessons', 'pet sitting', 'dog walking']
  },
  'industrial': {
    title: 'Industrial & Manufacturing',
    colorName: 'Steel Grey',
    fill: '#5E6D75',
    text: '#455056',
    tags: ['industrial', 'manufacturing', 'machining', 'metal fab', 'logistics', 'warehousing', 'distribution', 'building materials', 'wholesale', 'auto body', 'collision repair', 'commercial printing', 'publishing', 'hvac', 'packaging', 'shipping boxes']
  }
};

// Expose categoryColors globally
window.categoryColors = categoryColors;

// Centralized dynamic tag mapping
window.tagColors = {};
window.tagToCategory = {};
Object.keys(categoryColors).forEach(catKey => {
  const cat = categoryColors[catKey];
  cat.tags.forEach(tag => {
    window.tagColors[tag] = cat.fill;
    window.tagToCategory[tag] = catKey;
  });
});

// Relative Luminance and Contrast Ratio calculation helper
window.getContrastColor = function(hexcolor) {
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
  ];
  
  const a = rgb.map(v => {
    if (v <= 0.03928) {
      return v / 12.92;
    }
    return Math.pow((v + 0.055) / 1.055, 2.4);
  });
  
  const luminance = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  return luminance > 0.179 ? '#000000' : '#ffffff';
};

// Text wrapping utility
window.wrapText = function(text, maxLength) {
  if (maxLength <= 0) return [text];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';
  
  words.forEach(word => {
    if ((currentLine + ' ' + word).length <= maxLength) {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    } else {
      if (word.length > maxLength) {
        const subWords = [];
        const parts = word.split(/([./?&#\-_=,:])/);
        parts.forEach(part => {
          if (!part) return;
          if (part.length <= maxLength) {
            subWords.push(part);
          } else {
            let rem = part;
            while (rem.length > maxLength) {
              subWords.push(rem.substring(0, maxLength));
              rem = rem.substring(maxLength);
            }
            if (rem) subWords.push(rem);
          }
        });

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
};

// Base64 to array buffer conversion helper
window.base64ToUint8Array = function(base64) {
  const base64Data = base64.split(',')[1] || base64;
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Custom Dropdown management helpers
window.setupDropdownTrigger = function(trigger, dropdown) {
  if (!trigger || !dropdown) return;
  const container = trigger.closest('.custom-multiselect');
  
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', !expanded);
    if (container) {
      const isActive = container.classList.toggle('active');
      
      // Close other custom dropdowns on the page safely if active
      if (isActive) {
        document.querySelectorAll('.custom-multiselect').forEach(el => {
          if (el !== container) {
            el.classList.remove('active');
            const otherTrigger = el.querySelector('.multiselect-trigger, [aria-haspopup="true"]');
            if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
          }
        });
      }
    }
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      trigger.click();
    }
  });

  dropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });
};

window.closeDropdown = function(trigger, dropdown) {
  if (!trigger || !dropdown) return;
  trigger.setAttribute('aria-expanded', 'false');
  const container = trigger.closest('.custom-multiselect');
  if (container) {
    container.classList.remove('active');
  }
};

