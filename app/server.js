const express = require('express');
const fs = require('fs').promises; // Use promise-based fs for cleaner async/await
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const geojsonValidation = require('geojson-validation');

const app = express();

// Basic Security Headers (Protect against web-based attacks)
app.use(helmet());

// Rate Limiter to prevent Denial of Service and Brute Force attacks
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);
app.set('trust proxy', 2 /* one for caddy, one for cloudflare tunnel */)
// Limit JSON payload size to prevent disk-exhaustion attacks
app.use(express.json({ limit: '5mb' }));

// Whitelist of allowed feature types to prevent path traversal attacks
const ALLOWED_FEATURE_TYPES = new Set(['parks', 'roads', 'boundaries',
'users', 'establishments', 'home-business', 'industrial', 'fall-festival']); 

const DATA_DIR = path.join(__dirname, 'data');

// Helper to safely compare tokens using a timing-safe algorithm
function safeCompare(inputToken, actualToken) {
    if (!inputToken || !actualToken) return false;
    
    // Hash both tokens to ensure they are the same length before comparing
    const inputHash = crypto.createHash('sha256').update(inputToken).digest();
    const actualHash = crypto.createHash('sha256').update(actualToken).digest();
    
    return crypto.timingSafeEqual(inputHash, actualHash);
}

app.post('/api/map_data_save', async (req, res) => {
    try {
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

        const payload = req.body;

        // GeoJSON Validation
        if (!geojsonValidation.valid(payload)) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Invalid GeoJSON payload' 
            });
        }

        const fileName = `${featureType}.geojson`;
        const tempFileName = `${featureType}.${crypto.randomBytes(4).toString('hex')}.tmp`;
        
        const FINAL_FILE_PATH = path.join(DATA_DIR, fileName);
        const TEMP_FILE_PATH = path.join(DATA_DIR, tempFileName);

        // Ensure data directory exists
        await fs.mkdir(DATA_DIR, { recursive: true });

        // Write to temp file first, then rename to avoid corruption
        await fs.writeFile(TEMP_FILE_PATH, JSON.stringify(payload, null, null), 'utf8');
        await fs.rename(TEMP_FILE_PATH, FINAL_FILE_PATH);

        console.log(`Data successfully written for feature: ${featureType}`);
        return res.json({ status: 'success', message: 'Data written successfully' });

    } catch (err) {
        console.error('Error handling map data save:', err);
        return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
