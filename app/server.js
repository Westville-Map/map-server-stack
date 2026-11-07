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

// Queue tasks to guarantee serialized, race-free file writes and version increments
let saveQueue = Promise.resolve();
function queueSaveTask(task) {
    const next = saveQueue.then(() => task(), () => task());
    saveQueue = next;
    return next;
}

// Deep JSON semantic comparison
function areJsonPayloadsEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!areJsonPayloadsEqual(a[i], b[i])) return false;
        }
        return true;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
        const k = keysA[i];
        if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
        if (!areJsonPayloadsEqual(a[k], b[k])) return false;
    }
    return true;
}

// Date and timestamp helpers in America/New_York
function getNewYorkDate() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '.');
}

function getNewYorkTimestamp() {
    const d = new Date();
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const timeStr = d.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
    });
    const tzAbbr = d.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        timeZoneName: 'short'
    }).split(' ').pop();
    return `${dateStr} ${timeStr} ${tzAbbr}`;
}

async function getExistingDataVersion() {
    try {
        const raw = await fs.readFile(path.join(DATA_DIR, 'data-version.json'), 'utf8');
        const parsed = JSON.parse(raw);
        return typeof parsed.version === 'string' ? parsed.version : null;
    } catch (_) {
        return null;
    }
}

async function incrementDataVersion() {
    const todayPrefix = getNewYorkDate();
    const currentVersion = await getExistingDataVersion();
    let nextPoint = 1;

    if (currentVersion && currentVersion.startsWith(`${todayPrefix}.`)) {
        const pointStr = currentVersion.slice(todayPrefix.length + 1);
        const parsedPoint = parseInt(pointStr, 10);
        if (Number.isFinite(parsedPoint) && parsedPoint >= 1) {
            nextPoint = parsedPoint + 1;
        }
    }

    const newVersion = `${todayPrefix}.${nextPoint}`;
    const versionPayload = {
        version: newVersion,
        lastUpdated: getNewYorkTimestamp(),
        timezone: 'America/New_York'
    };

    const tempFileName = `data-version.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const tempFilePath = path.join(DATA_DIR, tempFileName);
    const finalFilePath = path.join(DATA_DIR, 'data-version.json');

    await fs.writeFile(tempFilePath, JSON.stringify(versionPayload, null, 2), 'utf8');
    await fs.rename(tempFilePath, finalFilePath);

    return newVersion;
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

        const result = await queueSaveTask(async () => {
            const fileName = featureType === 'taxonomies' ? `${featureType}.json` : `${featureType}.geojson`;
            const FINAL_FILE_PATH = path.join(DATA_DIR, fileName);

            // Ensure data directory exists
            await fs.mkdir(DATA_DIR, { recursive: true });

            // Check if file already exists and compare data
            let hasChanged = true;
            try {
                const existingRaw = await fs.readFile(FINAL_FILE_PATH, 'utf8');
                const newRaw = JSON.stringify(payload);
                if (existingRaw === newRaw) {
                    hasChanged = false;
                } else {
                    const existingParsed = JSON.parse(existingRaw);
                    if (areJsonPayloadsEqual(existingParsed, payload)) {
                        hasChanged = false;
                    }
                }
            } catch (_) {
                // File does not exist yet or failed to read/parse
                hasChanged = true;
            }

            if (!hasChanged) {
                const currentVersion = await getExistingDataVersion();
                return {
                    status: 'success',
                    message: 'Data unchanged',
                    changed: false,
                    version: currentVersion
                };
            }

            // Write updated feature dataset atomically
            const tempFileName = `${featureType}.${crypto.randomBytes(4).toString('hex')}.tmp`;
            const TEMP_FILE_PATH = path.join(DATA_DIR, tempFileName);

            await fs.writeFile(TEMP_FILE_PATH, JSON.stringify(payload), 'utf8');
            await fs.rename(TEMP_FILE_PATH, FINAL_FILE_PATH);

            // Bump data version atomically
            const newVersion = await incrementDataVersion();

            return {
                status: 'success',
                message: 'Data written successfully',
                changed: true,
                version: newVersion
            };
        });

        return res.json(result);

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
