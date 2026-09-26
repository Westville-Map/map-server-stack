const SHOW_FESTIVAL = false; // Set to false to manually hide the Festival page from navigation

// Global Map Domain & URL Synchronization for all portal pages
function getMapDomain() {
  const host = window.location.hostname;
  const protocol = window.location.protocol;
  if (host.includes('testing.westville.app') || host.includes('testing-map.westville.app')) {
    return `${protocol}//testing-map.westville.app`;
  } else if (host.includes('westville.app')) {
    return `${protocol}//map.westville.app`;
  } else {
    return `${protocol}//testing-map.westville.app`;
  }
}
window.getMapDomain = getMapDomain;

function syncPortalMapUrls() {
  const mapDomain = getMapDomain();
  const elements = document.querySelectorAll('[href*="map.westville.app"], [src*="map.westville.app"], [href*="testing-map.westville.app"], [src*="testing-map.westville.app"]');
  elements.forEach(el => {
    if (el.tagName === 'IFRAME') {
      try {
        const url = new URL(el.src, window.location.origin);
        const targetMap = new URL(mapDomain);
        if (url.hostname !== targetMap.hostname) {
          url.hostname = targetMap.hostname;
          url.protocol = targetMap.protocol;
          url.port = targetMap.port;
          el.src = url.toString();
        }
      } catch (_) {
        el.src = el.src.replace(/^https?:\/\/[^\/]+/, mapDomain);
      }
    } else if (el.hasAttribute('href')) {
      const href = el.getAttribute('href');
      el.setAttribute('href', href.replace(/^https?:\/\/(testing-map|map)\.westville\.app/, mapDomain));
    } else if (el.hasAttribute('src')) {
      const src = el.getAttribute('src');
      el.setAttribute('src', src.replace(/^https?:\/\/(testing-map|map)\.westville\.app/, mapDomain));
    }
  });
}
window.syncPortalMapUrls = syncPortalMapUrls;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncPortalMapUrls);
} else {
  syncPortalMapUrls();
}

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const activePage = this.getAttribute('active-page') || 'portal';
    
    const homeActive = activePage === 'portal' ? 'style="background-color: var(--white); color: var(--primary-blue); border-color: var(--accent-gold);"' : '';
    const directoryActive = activePage === 'directory' ? 'style="background-color: var(--white); color: var(--primary-blue); border-color: var(--accent-gold);"' : '';
    const festivalActive = activePage === 'festival' ? 'style="background-color: var(--white); color: var(--primary-blue); border-color: var(--accent-gold);"' : '';

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
        <button id="header-help-btn" class="help-split-left-btn help-btn" title="How to Use the Site">
          <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
              <path d="M12 21.5s-7-7.75-7-12.5a7 7 0 1 1 14 0c0 4.75-7 12.5-7 12.5z" />
              <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2.5-2.5 2.5" />
              <path d="M12 14h.01" />
            </svg>
          </span>
          <span class="header-btn-text">Help</span>
        </button>
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

    // Auto-inject the site-help component if not present
    if (!document.querySelector('site-help')) {
      const siteHelpEl = document.createElement('site-help');
      document.body.appendChild(siteHelpEl);
    }

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
    
    const creditsStyle = activePage === 'credits' ? 'style="background-color: var(--white); color: var(--primary-blue); border-color: var(--accent-gold);"' : '';
    const privacyStyle = activePage === 'privacy-tos' ? 'style="background-color: var(--white); color: var(--primary-blue); border-color: var(--accent-gold);"' : '';

    const helpHTML = `
      <button id="footer-help-btn" class="header-btn help-btn" title="How to Use the Site">
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

    this.innerHTML = `
      <footer>
        <div class="brand-logo">
          <div class="brand-icon-img">
            <a href="/"><img class="mapicon" src="/images/w-pin.svg" alt="Westville Map Project Site Logo" aria-hidden="true"/></a>
          </div>
          <h1 style="font-size: 1.2rem;"><a href="/" style="color: var(--white); text-decoration: none;">Welcome to Westville</a></h1>
        </div>
        <p class="footer-copyright">&copy; 2026 Welcome to Westville Map Project. <span id="site-footer-version"></span>Not an official borough communication.</p>
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

    this.loadVersion();
  }

  async loadVersion() {
    try {
      const res = await fetch('/version.json');
      if (res.ok) {
        const data = await res.json();
        const verEl = this.querySelector('#site-footer-version');
        if (verEl && data && data.version) {
          const isTest = data.channel === 'testing' || data.version.includes('test');
          const repoUrl = isTest
            ? 'https://github.com/Westville-Map/map-server-stack/tree/testing'
            : 'https://github.com/Westville-Map/map-server-stack';
          const title = `Version: ${data.version}\nBuilt: ${data.buildDate || 'Unknown'}\nCommit: ${data.gitCommit || ''}`;
          verEl.innerHTML = `<a href="${repoUrl}" target="_blank" rel="noopener noreferrer" class="footer-version-link" title="${title}">v${data.version}</a> - `;
        }
      }
    } catch (_) {
      // Fallback silently
    }
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);

class WvModal extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    const modalId = this.getAttribute('modal-id') || 'wv-modal';
    const modalTitle = this.getAttribute('modal-title') || '';
    const titleIcon = this.getAttribute('title-icon') || '';
    const titleEmoji = this.getAttribute('title-emoji') || '';
    const fullScreenMobile = this.hasAttribute('full-screen-mobile');

    // Hold original children
    const originalChildren = Array.from(this.childNodes);
    this.innerHTML = '';

    // Create overall overlay
    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = `wv-modal-overlay${fullScreenMobile ? ' full-screen-mobile' : ''}`;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-labelledby', `${modalId}-title`);
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.display = 'none';

    // Card
    const card = document.createElement('div');
    card.className = 'wv-modal-card glass-card animate-zoom';

    // Header
    const header = document.createElement('div');
    header.className = 'wv-modal-header';

    const title = document.createElement('h3');
    title.id = `${modalId}-title`;
    title.className = 'wv-modal-title';

    const headerIconSlot = originalChildren.find(child => child.nodeType === Node.ELEMENT_NODE && child.getAttribute('slot') === 'header-icon');
    if (headerIconSlot) {
      headerIconSlot.removeAttribute('slot');
      title.appendChild(headerIconSlot);
    } else if (titleIcon) {
      const img = document.createElement('img');
      img.src = titleIcon;
      img.style.width = '24px';
      img.style.height = '24px';
      img.alt = '';
      title.appendChild(img);
    } else if (titleEmoji) {
      const emojiSpan = document.createElement('span');
      emojiSpan.style.fontSize = '1.25rem';
      emojiSpan.textContent = titleEmoji;
      title.appendChild(emojiSpan);
    }

    const titleTextSpan = document.createElement('span');
    titleTextSpan.textContent = modalTitle;
    title.appendChild(titleTextSpan);

    const closeBtn = document.createElement('button');
    closeBtn.id = `${modalId}-close-btn`;
    closeBtn.className = 'wv-modal-close close-btn';
    closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.innerHTML = '&times;';

    header.appendChild(title);
    header.appendChild(closeBtn);
    card.appendChild(header);

    // Body
    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'wv-modal-body';

    // Footer
    const footerContainer = document.createElement('div');
    footerContainer.className = 'wv-modal-footer';
    let hasFooter = false;

    // Distribute children
    originalChildren.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE && child.getAttribute('slot') === 'footer') {
        hasFooter = true;
        child.removeAttribute('slot');
        footerContainer.appendChild(child);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.getAttribute('slot') === 'body') {
        child.removeAttribute('slot');
        bodyContainer.appendChild(child);
      } else if (child === headerIconSlot) {
        // Skip since we distributed it directly to title
      } else {
        // Only append if it's not a purely whitespace text node
        if (child.nodeType !== Node.TEXT_NODE || child.textContent.trim().length > 0) {
          bodyContainer.appendChild(child);
        }
      }
    });

    card.appendChild(bodyContainer);
    if (hasFooter) {
      card.appendChild(footerContainer);
    }

    overlay.appendChild(card);
    this.appendChild(overlay);

    // Wire local close event
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.close();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });
  }

  isOpen() {
    const overlay = this.querySelector('.wv-modal-overlay');
    return overlay && overlay.classList.contains('active');
  }

  open() {
    const overlay = this.querySelector('.wv-modal-overlay');
    if (overlay) {
      this._previouslyFocusedElement = document.activeElement;
      overlay.style.display = 'flex';
      requestAnimationFrame(() => {
        overlay.classList.add('active');
      });
      document.body.style.overflow = 'hidden';
      const closeBtn = this.querySelector('.wv-modal-close');
      if (closeBtn) closeBtn.focus();
    }
  }

  close() {
    const overlay = this.querySelector('.wv-modal-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        if (this._previouslyFocusedElement && typeof this._previouslyFocusedElement.focus === 'function') {
          this._previouslyFocusedElement.focus();
        }
      }, 250);
    }
  }
}
customElements.define('wv-modal', WvModal);

class SiteHelp extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
    this.checkUrlParams();
  }

  render() {
    let festivalSectionHTML = '';
    if (SHOW_FESTIVAL) {
      festivalSectionHTML = `
        <li id="help-section-festival" class="help-section-item">
          <div class="help-item-header">
            <span class="help-popover-icon">
              <span style="font-size:1.15rem; line-height:1;">🍁</span>
            </span>
            <strong>Autumn Festival Interactive Guide</strong>
          </div>
          <p class="help-item-desc">
            The standalone <strong>Fall Festival</strong> page is an interactive guide for our annual community autumn celebration along Broadway. It is designed to help you quickly search, filter, and locate vendors, stages, and activities.
          </p>
          <p class="help-item-desc">
            <strong>Interactive Vendor Map</strong>: Displays exact numbered booth spaces along Broadway. Clicking any numbered space circle on the map instantly highlights their details in the list below.
          </p>
          <p class="help-item-desc">
            <strong>Searchable Vendor Directory</strong>: Quickly find specific food items (like cider, kettle corn, or food trucks), craft providers, kids' activities, or entertainment stages using the live search bar. Filter booths dynamically by categories (food, crafts, etc.) or sort them numerically by booth number.
          </p>
        </li>
      `;
    }

    this.innerHTML = `
      <wv-modal modal-id="help-popover" modal-title="Welcome to Westville Help" full-screen-mobile>
        <span slot="header-icon" class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle; color: var(--primary-blue, #1e3a8a); margin-right: 2px;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
            <path d="M12 21.5s-7-7.75-7-12.5a7 7 0 1 1 14 0c0 4.75-7 12.5-7 12.5z" />
            <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2.5-2.5 2.5" />
            <path d="M12 14h.01" />
          </svg>
        </span>
        <div slot="body">
          <p>Welcome to the Borough of Westville Interactive Portal! Use this comprehensive help panel to learn about map navigation, the directory, printing options, and event guides. Select a quick category below to scroll directly to its instructions.</p>
          
          <!-- Quick navigation pill shortcuts inside help -->
          <div class="help-nav-pills" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 1.5rem;">
            <button class="help-nav-pill btn-secondary" style="font-family: inherit; font-size: 0.8rem; font-weight: 600; padding: 6px 12px; border-radius: 20px; cursor: pointer; border: 1px solid #cbd5e1; background: #f8fafc; color: var(--text-dark); transition: all 0.15s ease;" data-target="portal">Map &amp; Layers</button>
            <button class="help-nav-pill btn-secondary" style="font-family: inherit; font-size: 0.8rem; font-weight: 600; padding: 6px 12px; border-radius: 20px; cursor: pointer; border: 1px solid #cbd5e1; background: #f8fafc; color: var(--text-dark); transition: all 0.15s ease;" data-target="tours">Guided Tours</button>
            <button class="help-nav-pill btn-secondary" style="font-family: inherit; font-size: 0.8rem; font-weight: 600; padding: 6px 12px; border-radius: 20px; cursor: pointer; border: 1px solid #cbd5e1; background: #f8fafc; color: var(--text-dark); transition: all 0.15s ease;" data-target="directory">Directory</button>
            ${SHOW_FESTIVAL ? `<button class="help-nav-pill btn-secondary" style="font-family: inherit; font-size: 0.8rem; font-weight: 600; padding: 6px 12px; border-radius: 20px; cursor: pointer; border: 1px solid #cbd5e1; background: #f8fafc; color: var(--text-dark); transition: all 0.15s ease;" data-target="festival">Fall Festival</button>` : ''}
            <button class="help-nav-pill btn-secondary" style="font-family: inherit; font-size: 0.8rem; font-weight: 600; padding: 6px 12px; border-radius: 20px; cursor: pointer; border: 1px solid #cbd5e1; background: #f8fafc; color: var(--text-dark); transition: all 0.15s ease;" data-target="universal">Sharing &amp; Printing</button>
          </div>

          <ul class="help-popover-list">
            <!-- Section: Map & Portal -->
            <li id="help-section-portal" class="help-section-item">
              <div class="help-item-header">
                <span class="help-popover-icon">
                  <img style="width:20px; height:20px;" src="/images/map-folded.svg" alt="Map icon">
                </span>
                <strong>Map &amp; Layers</strong>
              </div>
              <p class="help-item-desc">
                Explore the Borough visually on our main page. Control visible features using the <strong>Toggle Layers</strong> checkboxes inside the Map Footer (below the map) for Parking, Establishments, and Recreation.
              </p>
              <p class="help-item-desc">
                <strong>Map &amp; Satellite Views</strong>: Switch between the standard street <strong>Map</strong> view or a high-resolution <strong>Satellite</strong> view. When Satellite is checked, you can toggle street and landmark <strong>Labels</strong>.
              </p>
              <p class="help-item-desc">
                <strong>Quick Filter Tags</strong>: Click the Parking, Establishments, or Recreation tags in the header row to instantly clear any active search, reset the viewpoint, and highlight just those locations.
              </p>
              <p class="help-item-desc">
                <strong>My Location (GPS)</strong>: Click the target crosshair button (below the zoom controls on the map) to center on and track your current physical position in real-time. This runs purely in-browser and protects your privacy.
              </p>
              <p class="help-item-desc">
                <strong>Interactive Directory Cards</strong>: Click any card below the map to re-center, zoom, and highlight that specific location on the map.
              </p>
            </li>

            <!-- Section: Guided Tours & Exploration -->
            <li id="help-section-tours" class="help-section-item">
              <div class="help-item-header">
                <span class="help-popover-icon">
                  <img style="width:20px; height:20px;" src="/images/compass.svg" alt="Compass icon">
                </span>
                <strong>Guided Tours &amp; Exploration</strong>
              </div>
              <p class="help-item-desc">
                Tap the <strong>Explore</strong> button in the header actions to access custom automated guided tours:
              </p>
              <ul class="help-tour-list" style="margin: 4px 0 8px 1.5rem; padding: 0; color: #555; font-size: 0.9rem; line-height: 1.5; list-style-type: disc;">
                <li><strong>Borough Tour</strong> Comprehensive tour of public parks, parking, and municipal services.</li>
                <li><strong>Business Tour</strong> Showcase of commercial businesses and local establishments.</li>
                <li><strong>Parks &amp; Rec Tour</strong> Highlights public parks, fields, courts, and trails.</li>
                <li><strong>Public Services Tour</strong> Highlights municipal resources, library, schools, fire, and police.</li>
              </ul>
              <p class="help-item-desc">
                <strong>How Tours Work</strong>: When a tour is active, the map camera moves using smooth, cinematic transitions to pan and zoom from location to location automatically, showing each place's details popup card before proceeding.
              </p>
              <p class="help-item-desc">
                <strong>Controlling the Tour</strong>: To cancel or stop an active tour, click the (X) button on the "Running" banner in the header, close the details card popup on the map, or click anywhere on the map to begin exploring freely.
              </p>
              <p class="help-item-desc">
                <strong>Open Full Map</strong>: Select the <strong>Open Full Map</strong> button at the bottom of the Explore dropdown menu to launch the full-screen interactive mapping application in a new browser tab.
              </p>
            </li>

            <!-- Section: Standalone Directory -->
            <li id="help-section-directory" class="help-section-item">
              <div class="help-item-header">
                <span class="help-popover-icon">
                  <img style="width:20px; height:20px;" src="/images/search.svg" alt="Search icon">
                </span>
                <strong>Local Directory</strong>
              </div>
              <p class="help-item-desc">
                The standalone <strong><a class="help-link" href="/directory/">Directory</a></strong> page lists all commercial, industrial, recreation, and public providers in Westville.
              </p>
              <p class="help-item-desc">
                <strong>Searching &amp; Advanced Filtering</strong>: Start typing in the search box to instantly search listings. Narrow results down by selecting specific tags or categories from the custom multi-select dropdown menus.
              </p>
              <p class="help-item-desc">
                <strong>Custom Sorting &amp; Quick Reset</strong>: Sort establishments alphabetically, by category, or by tags. Click the <strong>Reset</strong> button at any time to clear search text, reset selectors, and restore default A-Z lists.
              </p>
              <p class="help-item-desc">
                <strong>Card Actions</strong>: Use the direct call links to place a call, click Website to open their portal, or tap Directions to route to them instantly on Google Maps.
              </p>
            </li>

            <!-- Section: Fall Festival Guide (Conditional) -->
            ${festivalSectionHTML}

            <!-- Section: Universal Features (Sharing & Printing) -->
            <li id="help-section-universal" class="help-section-item">
              <div class="help-item-header">
                <span class="help-popover-icon">
                  <img style="width:20px; height:20px;" src="/images/share.svg" alt="Share icon">
                </span>
                <strong>Sharing Views &amp; Custom Printing</strong>
              </div>
              <p class="help-item-desc">
                <strong>Copy &amp; Share Links</strong>: Tap the <strong>Share</strong> button in the header of any map page to copy a dynamic link. This link perfectly restores your zoom level, coordinates, toggled layer checkboxes, active search query, and highlighted cards so you share exactly what you are seeing.
              </p>
              <p class="help-item-desc">
                <strong>Privacy-Safe Location Sharing</strong>: Click the drop-arrow next to "Share" and click "Share my location" to generate a specialized link showing your current GPS coordinates. It disables card highlights and doesn't store any data to protect privacy. Only your current latitude and longitude coordinates are shared, no other personally-identifiable data is used, and you remain in charge of who you share the unique link with.
              </p>
              <p class="help-item-desc">
                <strong>High-Resolution Printing &amp; PDFs</strong>: Click the <strong>Print</strong> button to configure output. Customize portrait/landscape orientations, choose to hide or include map views, and select whether to print your filtered cards or compile a complete local directory PDF.
              </p>
            </li>
          </ul>
        </div>
        
        <div slot="footer" class="help-popover-footer-links" style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
          <div style="display: flex; gap: 10px; width: 100%;">
            <a href="/credits.html" class="help-footer-btn" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 12px;">
              <img style="width:16px; height:16px; flex-shrink: 0;" src="/images/credits-scroll.svg" alt="">
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Credits</span>
            </a>
            <a href="/privacy-tos.html" class="help-footer-btn" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 12px;">
              <img style="width:16px; height:16px; flex-shrink: 0;" src="/images/shield-privacy.svg" alt="">
              <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Privacy &amp; TOS</span>
            </a>
          </div>
          <button id="help-popover-ok-btn" class="btn-main help-popover-action-btn" style="width: 100%; margin: 0; padding: 12px;">Ok</button>
        </div>
      </wv-modal>
    `;

    this.overlay = this.querySelector('#help-popover');
    this.okBtn = this.querySelector('#help-popover-ok-btn');
  }

  setupListeners() {
    if (this.okBtn) this.okBtn.addEventListener('click', () => this.close());

    const navPills = this.querySelectorAll('.help-nav-pill');
    navPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const target = pill.getAttribute('data-target');
        this.scrollToSection(target);
      });
      // Add visual hover feedback
      pill.addEventListener('mouseenter', () => {
        pill.style.borderColor = 'var(--primary-blue)';
        pill.style.background = '#f0f4f8';
      });
      pill.style.transition = 'all 0.2s ease';
      pill.addEventListener('mouseleave', () => {
        pill.style.borderColor = '#cbd5e1';
        pill.style.background = '#f8fafc';
      });
    });

    // Intercept clicks on help buttons globally on this page
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.help-btn');
      if (btn) {
        e.preventDefault();
        const siteHeader = document.querySelector('site-header');
        const activePage = siteHeader ? siteHeader.getAttribute('active-page') : 'portal';
        this.open(activePage);
      }
    });
  }

  scrollToSection(sectionId) {
    if (!sectionId) return;
    const section = this.querySelector(`#help-section-${sectionId}`);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      section.classList.remove('highlight-pulse');
      void section.offsetWidth; // Reflow
      section.classList.add('highlight-pulse');
    }
  }

  open(sectionId) {
    const modal = this.querySelector('wv-modal');
    if (modal) {
      modal.open();
      if (sectionId) {
        setTimeout(() => {
          this.scrollToSection(sectionId);
        }, 150);
      } else {
        const body = this.querySelector('.wv-modal-body');
        if (body) body.scrollTop = 0;
      }
    }
  }

  close() {
    const modal = this.querySelector('wv-modal');
    if (modal) {
      modal.close();
    }
  }

  checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('help') === 'true') {
      const siteHeader = document.querySelector('site-header');
      const activePage = siteHeader ? siteHeader.getAttribute('active-page') : 'portal';
      this.open(activePage);
      
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('help');
      window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);
    }
  }
}
customElements.define('site-help', SiteHelp);

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
        <div class="multiselect-dropdown" style="padding: 4px 0; border-top: 1px solid #ccc;" role="listbox" aria-label="${ariaLabel} options">
          ${this._options.map(opt => `
            <div class="wv-sort-option" tabindex="0" role="option" aria-selected="false" data-value="${opt.value}" style="padding: 10px 16px; cursor: pointer; transition: background-color 0.15s; display: flex; align-items: center; justify-content: space-between; font-size: 0.9rem; color: #453b36;">
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
    const optEls = Array.from(this.querySelectorAll('.wv-sort-option'));

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
        } else if (e.key === 'ArrowDown' && container.classList.contains('active')) {
          e.preventDefault();
          if (optEls.length > 0) optEls[0].focus();
        }
      });
    }

    // Option events
    optEls.forEach((optEl, idx) => {
      optEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = optEl.getAttribute('data-value');
        this.value = val;
        
        // Close dropdown
        if (container && trigger) {
          container.classList.remove('active');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
        }
      });

      optEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          optEl.click();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIdx = (idx + 1) % optEls.length;
          optEls[nextIdx].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIdx = (idx - 1 + optEls.length) % optEls.length;
          optEls[prevIdx].focus();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (container && trigger) {
            container.classList.remove('active');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.focus();
          }
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
      
      optEl.setAttribute('aria-selected', isSelected ? 'true' : 'false');

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
    tags: ['restaurant', 'dining', 'food', 'cafe', 'banquet hall', 'event space', 'diner', 'bakery', 'sweets', 'take out', 'takeout', 'bbq', 'dessert', 'cookie cakes', 'cookies', 'pizza', 'italian', 'mexican', 'puerto rican', 'shakes', 'bowls', 'coffee', 'breakfast', 'lunch', 'dinner', 'deli', 'hoagies', 'sandwiches', 'seafood', 'juice bar', 'smoothies']
  },
  'wellness': {
    title: 'Wellness, Health & Salons',
    colorName: 'Teal',
    fill: '#0d9488',
    text: '#0f766e',
    tags: ['wellness', 'fitness', 'yoga', 'tai chi', 'health', 'umaa', 'salon', 'hair styling', 'barber', 'barbershop', 'kickboxing', 'karate', 'jujitsu', 'doctor', 'gym', 'gymnastics', 'personal training']
  },
  'shop': {
    title: 'Shop & Retail',
    colorName: 'Emerald',
    fill: '#059669',
    text: '#047857',
    tags: ['convenience store', 'retail', 'groceries', 'shop', 'appliances', 'smoke shop', 'tobacco', 'supermarket', 'collectibles', 'bait', 'provisions', 'lottery']
  },
  'services': {
    title: 'Services & Professional',
    colorName: 'Purple',
    fill: '#81007F',
    text: '#81007F',
    tags: ['laundry', 'service', 'services', 'laundromat', 'locksmith', 'key duplication', 'tax prep', 'bookkeeping', 'it management', 'cloud services', 'bail bonds', 'bank', 'atm', 'home insurance', 'professional', 'photography', 'real estate', 'property management', 'hospitality', 'consulting', 'business services', 'financial', 'funeral home', 'human services', 'union', 'cleaning', 'disaster restoration', 'telecommunications']
  },
  'public': {
    title: 'Public & Government Resources',
    colorName: 'Royal Blue',
    fill: '#2563eb',
    text: '#1d4ed8',
    tags: ['borough offices', 'public resource', 'government', 'library', 'community', 'post office', 'education', 'public elementary school', 'pre-kindergarten school', 'pk-6', 'mail', 'packages', 'po boxes', 'senior center', 'public', 'daycare', 'child care']
  },
  'autos': {
    title: 'Automotive',
    colorName: 'Gold',
    fill: '#ffd700',
    text: '#854d0e',
    tags: ['auto repair', 'dealership', 'mechanic', 'mechanic service', 'auto service', 'oil change', 'used cars', 'new cars', 'car wash', 'detailing', 'performance tuning', 'car insurance', 'automotive']
  },
  'recreation': {
    title: 'Parks & Recreation',
    colorName: 'Forest Green',
    fill: '#16a34a',
    text: '#15803d',
    tags: ['park', 'recreation', 'walking path', 'walkingpath', 'entertainment']
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
    title: 'Industrial, Manufacturing & Trade',
    colorName: 'Steel Grey',
    fill: '#5E6D75',
    text: '#455056',
    tags: ['industrial', 'manufacturing', 'machining', 'metal fab', 'logistics', 'warehousing', 'distribution', 'building materials', 'wholesale', 'auto body', 'collision repair', 'commercial printing', 'publishing', 'hvac', 'packaging', 'shipping boxes', 'contractors', 'carpentry', 'flooring', 'plumbing', 'fence', 'machinery', 'environmental', 'pest control', 'lawn care', 'outdoor', 'textiles', 'apparel', 'upholstery', 'custom framing', 'medical supplies']
  },
  'boating': {
    title: 'Boating & Marine',
    colorName: 'Ocean Blue',
    fill: '#0284c7',
    text: '#0369a1',
    tags: ['marine', 'boating', 'boat sales', 'marina', 'boat club', 'yacht club', 'power boat', 'boating & marine']
  }
};

// Curated Directory Views (Quick Views)
const directoryViews = {
  'all': {
    title: 'All Listings',
    categories: ['safety', 'nightlife', 'food', 'wellness', 'shop', 'services', 'public', 'autos', 'recreation', 'parking', 'home-business', 'industrial', 'boating']
  },
  'walkup': {
    title: 'Walk-Up & Retail',
    categories: ['food', 'nightlife', 'shop']
  },
  'industrial': {
    title: 'Industrial & Trade',
    categories: ['industrial']
  },
  'services': {
    title: 'Services & Pro',
    categories: ['services', 'home-business', 'wellness']
  },
  'public': {
    title: 'Parks & Public',
    categories: ['public', 'safety', 'recreation']
  },
  'automarine': {
    title: 'Auto & Marine',
    categories: ['autos', 'boating']
  },
  'parking': {
    title: 'Parking',
    categories: ['parking']
  }
};

function getQuickViewCategories(viewKey) {
  if (!viewKey || viewKey === 'all' || !directoryViews[viewKey]) {
    return directoryViews['all'] ? directoryViews['all'].categories : [];
  }
  return directoryViews[viewKey].categories || [];
}

// Expose categoryColors and directoryViews globally
window.categoryColors = categoryColors;
window.directoryViews = directoryViews;
window.getQuickViewCategories = getQuickViewCategories;

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

// Unified Collapsible Pill Tray Web Component for responsive mobile map controls
class CollapsiblePillTray extends HTMLElement {
  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;

    const title = this.getAttribute('tray-title') || this.getAttribute('title') || 'Options';
    const activeLabel = this.getAttribute('active-label') || '';
    const activeCount = this.getAttribute('active-count') || '';

    // Create trigger button
    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.className = 'pill-tray-trigger';
    triggerBtn.setAttribute('aria-haspopup', 'true');
    triggerBtn.setAttribute('aria-expanded', 'false');
    triggerBtn.innerHTML = `
      <span class="pill-tray-label-prefix">${title}:</span>
      <span class="pill-tray-active-text">${activeLabel}</span>
      <span class="pill-tray-active-count" style="${(activeCount !== '' && activeCount !== null && activeCount !== undefined) ? '' : 'display: none;'}">${activeCount}</span>
      <span class="pill-tray-arrow">▼</span>
    `;

    // Move direct children into .pill-tray-content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'pill-tray-content';
    contentWrapper.setAttribute('role', 'region');
    contentWrapper.setAttribute('aria-label', title);

    while (this.firstChild) {
      contentWrapper.appendChild(this.firstChild);
    }

    this.appendChild(triggerBtn);
    this.appendChild(contentWrapper);

    // Toggle on click
    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    triggerBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) {
        this.close();
      }
    });

    // Close when pressing Escape
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
        triggerBtn.focus();
      }
    });
  }

  setActiveLabel(text) {
    this.setAttribute('active-label', text);
    const labelEl = this.querySelector('.pill-tray-active-text');
    if (labelEl) labelEl.innerText = text;
  }

  setActiveCount(count) {
    this.setAttribute('active-count', count);
    const countEl = this.querySelector('.pill-tray-active-count');
    if (countEl) {
      countEl.innerText = count;
      countEl.style.display = (count !== '' && count !== null && count !== undefined) ? 'inline-flex' : 'none';
    }
  }

  toggle(forceState) {
    const shouldOpen = (typeof forceState === 'boolean') ? forceState : !this.classList.contains('open');
    this.classList.toggle('open', shouldOpen);
    const triggerBtn = this.querySelector('.pill-tray-trigger');
    if (triggerBtn) {
      triggerBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }

    // Close other trays if opened
    if (shouldOpen) {
      document.querySelectorAll('collapsible-pill-tray').forEach(tray => {
        if (tray !== this) tray.close();
      });
    }
  }

  close() {
    if (this.classList.contains('open')) {
      this.classList.remove('open');
      const triggerBtn = this.querySelector('.pill-tray-trigger');
      if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'false');
    }
  }
}

if (!customElements.get('collapsible-pill-tray')) {
  customElements.define('collapsible-pill-tray', CollapsiblePillTray);
}

// Register Service Worker for offline shell caching (progressive enhancement)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // Silently handle registration errors in restricted sandbox or dev environments
      console.debug('[SW] ServiceWorker registration skipped/failed:', err);
    });
  });
}


