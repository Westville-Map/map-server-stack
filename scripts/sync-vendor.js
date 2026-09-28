#!/usr/bin/env node

/**
 * sync-vendor.js
 * Synchronizes frontend vendor dependencies from node_modules into local /vendor/ directories.
 * Removes reliance on 3rd-party CDNs (unpkg, google fonts) to prevent adblocker/safari blocking.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const isVerifyOnly = process.argv.includes('--verify');

const COPY_OPERATIONS = [
  // MapLibre GL (for map app and trash map)
  {
    src: 'node_modules/maplibre-gl/dist/maplibre-gl.js',
    dest: 'map/vendor/maplibre-gl/maplibre-gl.js'
  },
  {
    src: 'node_modules/maplibre-gl/dist/maplibre-gl.css',
    dest: 'map/vendor/maplibre-gl/maplibre-gl.css'
  },
  {
    src: 'node_modules/maplibre-gl/dist/maplibre-gl.js',
    dest: 'www/vendor/maplibre-gl/maplibre-gl.js'
  },
  {
    src: 'node_modules/maplibre-gl/dist/maplibre-gl.css',
    dest: 'www/vendor/maplibre-gl/maplibre-gl.css'
  },
  // MapLibre GL source maps
  {
    src: 'node_modules/maplibre-gl/dist/maplibre-gl.js.map',
    dest: 'map/vendor/maplibre-gl/maplibre-gl.js.map'
  },
  {
    src: 'node_modules/maplibre-gl/dist/maplibre-gl.js.map',
    dest: 'www/vendor/maplibre-gl/maplibre-gl.js.map'
  },
  // MapLibre Layer Control (ES Module & CSS & Source Map)
  {
    src: 'node_modules/maplibre-gl-layer-control/dist/index.mjs',
    dest: 'map/vendor/maplibre-gl-layer-control/index.mjs'
  },
  {
    src: 'node_modules/maplibre-gl-layer-control/dist/index.mjs.map',
    dest: 'map/vendor/maplibre-gl-layer-control/index.mjs.map'
  },
  {
    src: 'node_modules/maplibre-gl-layer-control/dist/maplibre-gl-layer-control.css',
    dest: 'map/vendor/maplibre-gl-layer-control/maplibre-gl-layer-control.css'
  },
  // PDF-Lib (for portal & directory printing)
  {
    src: 'node_modules/pdf-lib/dist/pdf-lib.min.js',
    dest: 'www/vendor/pdf-lib/pdf-lib.min.js',
    stripSourceMap: true
  }
];

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function syncFiles() {
  console.log(`[sync-vendor] ${isVerifyOnly ? 'Verifying' : 'Syncing'} vendor dependencies...`);
  let hasError = false;

  // 1. Copy core distribution files
  for (const op of COPY_OPERATIONS) {
    const srcPath = path.join(ROOT_DIR, op.src);
    const destPath = path.join(ROOT_DIR, op.dest);

    if (!fs.existsSync(srcPath)) {
      console.error(`[sync-vendor] ERROR: Source file missing: ${op.src}. Did you run npm install?`);
      hasError = true;
      continue;
    }

    if (isVerifyOnly) {
      if (!fs.existsSync(destPath)) {
        console.error(`[sync-vendor] ERROR: Destination missing: ${op.dest}`);
        hasError = true;
      }
    } else {
      ensureDir(destPath);
      if (op.stripSourceMap) {
        let content = fs.readFileSync(srcPath, 'utf8');
        content = content.replace(/\/\/# sourceMappingURL=.*$/m, '');
        fs.writeFileSync(destPath, content, 'utf8');
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
      console.log(`  ✓ Synced: ${op.dest}`);
    }
  }

  // 2. Sync Open Sans font files and generate CSS
  const fontsourceDir = path.join(ROOT_DIR, 'node_modules/@fontsource/open-sans/files');
  if (!fs.existsSync(fontsourceDir)) {
    console.error('[sync-vendor] ERROR: @fontsource/open-sans missing. Did you run npm install?');
    hasError = true;
  } else {
    const fontFiles = [
      'open-sans-latin-300-normal.woff2',
      'open-sans-latin-400-normal.woff2',
      'open-sans-latin-600-normal.woff2',
      'open-sans-latin-700-normal.woff2',
      'open-sans-latin-400-italic.woff2'
    ];

    const fontDestDirs = [
      path.join(ROOT_DIR, 'map/fonts'),
      path.join(ROOT_DIR, 'www/fonts')
    ];

    for (const targetDir of fontDestDirs) {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      for (const fontFile of fontFiles) {
        const srcFont = path.join(fontsourceDir, fontFile);
        const destFont = path.join(targetDir, fontFile);
        if (fs.existsSync(srcFont)) {
          if (!isVerifyOnly) {
            fs.copyFileSync(srcFont, destFont);
          }
        }
      }

      // Generate local fonts.css
      const fontsCssContent = `/* Open Sans self-hosted webfont */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 300;
  font-stretch: 100%;
  font-display: swap;
  src: url('/fonts/open-sans-latin-300-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 400;
  font-stretch: 100%;
  font-display: swap;
  src: url('/fonts/open-sans-latin-400-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 600;
  font-stretch: 100%;
  font-display: swap;
  src: url('/fonts/open-sans-latin-600-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 700;
  font-stretch: 100%;
  font-display: swap;
  src: url('/fonts/open-sans-latin-700-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Open Sans';
  font-style: italic;
  font-weight: 400;
  font-stretch: 100%;
  font-display: swap;
  src: url('/fonts/open-sans-latin-400-italic.woff2') format('woff2');
}
`;
      const cssPath = path.join(targetDir, 'fonts.css');
      if (!isVerifyOnly) {
        fs.writeFileSync(cssPath, fontsCssContent, 'utf8');
        console.log(`  ✓ Generated: ${path.relative(ROOT_DIR, cssPath)}`);
      }
    }
  }

  if (hasError) {
    console.error('[sync-vendor] FAILED: Vendor files are missing or out of sync.');
    process.exit(1);
  } else {
    console.log('[sync-vendor] Vendor assets synchronization complete.');
  }
}

syncFiles();
