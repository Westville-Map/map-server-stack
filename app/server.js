const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());


app.post('/api/map_data_save', (req, res) => {
    // 1. Extract the token from the "X-Write-Token" header
    const clientToken = req.headers['x-map-data-token'];
    const featureType = req.headers['x-feature-type'];
    const secureToken = process.env.APPS_SCRIPT_TOKEN;

    // 2. Validate token presence and match
    if (!secureToken || clientToken !== secureToken) {
        console.warn(`Unauthorized write attempt from IP: ${req.ip}`);
        return res.status(403).json({ 
            status: 'error', 
            message: 'Forbidden: Invalid or missing secure token' 
        });
    }

    // 3. Prepare data payload
    const payload = {
        updatedAt: new Date().toISOString(),
        data: req.body
    };

    // 4. Overwrite the file entirely (fs.writeFile overwrites by default)
    const fileName = featureType + ".geojson";
    const DATA_FILE = path.join(__dirname, 'data', fileName);
    fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), (err) => {
        if (err) {
            console.error('Failed to write data:', err);
            return res.status(500).json({ status: 'error', message: 'Failed to write to disk' });
        }
        console.log('Data successfully written.');
        res.json({ status: 'success', message: 'Data written successfully' });
    });
});

app.listen(3000, () => console.log('Backend listening on port 3000'));
