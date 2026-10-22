const express = require('express');
const fs = require('fs').promises; // Use promise-based fs for cleaner async/await
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const geojsonValidation = require('geojson-validation');

const app = express();

// Trust proxy first for accurate IP detection behind Caddy and Cloudflare Tunnel
app.set('trust proxy', 2);

// Basic Security Headers (Protect against web-based attacks)
app.use(helmet());

// Rate Limiter to prevent Denial of Service and Brute Force attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 10, // Limit each IP to 10 requests per window
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Whitelist of allowed feature types to prevent path traversal attacks
const ALLOWED_FEATURE_TYPES = new Set([
  'parks', 'roads', 'boundaries', 'users', 'establishments',
  'home-business', 'industrial', 'fall-festival', 'trash-schedule',
  'taxonomies'
]); 

const DATA_DIR = path.join(__dirname, 'data');

// Helper to safely compare tokens using a timing-safe algorithm
function safeCompare(inputToken, actualToken) {
    if (!inputToken || !actualToken) return false;
    
    // Hash both tokens to ensure they are the same length before comparing
    const inputHash = crypto.createHash('sha256').update(inputToken).digest();
    const actualHash = crypto.createHash('sha256').update(actualToken).digest();
    
    return crypto.timingSafeEqual(inputHash, actualHash);
}

// Middleware: Validate auth token and feature type BEFORE reading/parsing request body
function verifyMapDataHeaders(req, res, next) {
    const clientToken = req.headers['x-map-data-token'];
    const featureType = req.headers['x-feature-type'];
    const secureToken = process.env.APPS_SCRIPT_TOKEN;

    // Secure Token Validation
    if (!secureToken || !safeCompare(clientToken, secureToken)) {
        console.warn(`Unauthorized write attempt from IP: ${req.ip}`);
        return res.status(403).json({ 
            status: 'error', 
            message: 'Forbidden' // Keep message generic
        });
    }

    // Strict Feature Type (Path Traversal) Validation
    if (!featureType || !ALLOWED_FEATURE_TYPES.has(featureType)) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Invalid or unauthorized feature type' 
        });
    }

    next();
}

// Route-scoped JSON parser: Decompression disabled (inflate: false) to prevent Brotli/gzip decoder exploits
const jsonParser = express.json({ 
    limit: '5mb', 
    inflate: false 
});

app.post('/api/map_data_save', verifyMapDataHeaders, jsonParser, async (req, res) => {
    try {
        const featureType = req.headers['x-feature-type'];
        const payload = req.body;

        // Validation based on feature type
        if (featureType === 'taxonomies') {
            if (!payload || typeof payload !== 'object' || !payload.categories || typeof payload.categories !== 'object') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid taxonomies payload structure'
                });
            }
        } else {
            // GeoJSON Validation
            if (!geojsonValidation.valid(payload)) {
                return res.status(400).json({ 
                    status: 'error', 
                    message: 'Invalid GeoJSON payload' 
                });
            }
        }

        const fileName = featureType === 'taxonomies' ? `${featureType}.json` : `${featureType}.geojson`;
        const tempFileName = `${featureType}.${crypto.randomBytes(4).toString('hex')}.tmp`;
        
        const FINAL_FILE_PATH = path.join(DATA_DIR, fileName);
        const TEMP_FILE_PATH = path.join(DATA_DIR, tempFileName);

        // Ensure data directory exists
        await fs.mkdir(DATA_DIR, { recursive: true });

        // Write to temp file first, then rename to avoid corruption
        await fs.writeFile(TEMP_FILE_PATH, JSON.stringify(payload, null, null), 'utf8');
        await fs.rename(TEMP_FILE_PATH, FINAL_FILE_PATH);

        return res.json({ status: 'success', message: 'Data written successfully' });

    } catch (err) {
        console.error('Error handling map data save:', err);
        return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Backend listening on port ${PORT} [Node: ${process.version}, Brotli: ${process.versions.brotli || 'none'}, OpenSSL: ${process.versions.openssl || 'none'}]`);
    });
}

module.exports = app;
