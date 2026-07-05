class SiteHeader extends HTMLElement {
  connectedCallback() {
    const activePage = this.getAttribute('active-page') || 'portal';
    
    let shortcutsHTML = '';
    
    if (activePage === 'portal') {
      shortcutsHTML = `
        <a href="https://map.westville.app/?hide=establishments&filter=parking" class="header-btn scroll-trigger" target="mapFrame">
          <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
            <img style="width:20px; height:20px;" src="/images/parking.svg"/>
          </span>
          <span class="header-btn-text">Public Parking</span>
        </a>
        <a href="https://map.westville.app/?hide=all&show=establishments,map,satellite" class="header-btn scroll-trigger" target="mapFrame">
          <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
            <img style="width:20px; height:20px;" src="/images/store.svg"/>
          </span>
          <span class="header-btn-text">Local Establishments</span>
        </a>
        <button id="help-btn" class="header-btn help-btn" title="How to Use the Map">
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
      shortcutsHTML = `
        <a href="/?hide=establishments&filter=parking" class="header-btn">
          <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
            <img style="width:20px; height:20px;" src="/images/parking.svg"/>
          </span>
          <span class="header-btn-text">Public Parking</span>
        </a>
        <a href="/?hide=all&show=establishments,map,satellite" class="header-btn">
          <span class="header-btn-icon" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; vertical-align: middle;">
            <img style="width:20px; height:20px;" src="/images/store.svg"/>
          </span>
          <span class="header-btn-text">Local Establishments</span>
        </a>
        <a href="/?help=true" id="header-help-btn" class="header-btn" title="How to Use the Map">
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
