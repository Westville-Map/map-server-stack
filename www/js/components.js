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
