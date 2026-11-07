const assert = require('assert');
const net = require('net');
const http = require('http');

process.env.APPS_SCRIPT_TOKEN = 'test-secret-token-12345';
const app = require('../server.js');

function simulateRequest(options, bodyData) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1' });
        Object.defineProperty(socket, 'encrypted', { value: false });

        const req = new http.IncomingMessage(socket);
        req.method = options.method || 'GET';
        req.url = options.url || '/';
        req.headers = options.headers || {};

        const res = new http.ServerResponse(req);
        let chunks = [];
        const origWrite = res.write.bind(res);
        res.write = (chunk, encoding, cb) => {
            if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            return origWrite(chunk, encoding, cb);
        };
        const origEnd = res.end.bind(res);
        res.end = (chunk, encoding, cb) => {
            if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            origEnd(chunk, encoding, cb);
            resolve({
                statusCode: res.statusCode,
                body: Buffer.concat(chunks).toString('utf8')
            });
        };

        app(req, res);

        if (bodyData) {
            req.push(bodyData);
        }
        req.push(null);
    });
}

async function runTests() {
    console.log('--- Running Backend Security & Decompression Tests ---');

    // Test 1: Unauthenticated request should be rejected with 403 before body parsing
    {
        const payload = JSON.stringify({ type: 'FeatureCollection', features: [] });
        const res = await simulateRequest({
            method: 'POST',
            url: '/api/map_data_save',
            headers: {
                'content-type': 'application/json',
                'content-length': String(Buffer.byteLength(payload))
            }
        }, payload);

        assert.strictEqual(res.statusCode, 403, `Expected 403 Forbidden for missing token, got ${res.statusCode}`);
        assert.ok(res.body.includes('Forbidden'), 'Response body should indicate Forbidden');
        console.log('✓ Test 1 Passed: Unauthenticated request rejected with 403 before parsing');
    }

    // Test 2: Invalid feature type should be rejected with 400
    {
        const payload = JSON.stringify({ type: 'FeatureCollection', features: [] });
        const res = await simulateRequest({
            method: 'POST',
            url: '/api/map_data_save',
            headers: {
                'content-type': 'application/json',
                'content-length': String(Buffer.byteLength(payload)),
                'x-map-data-token': 'test-secret-token-12345',
                'x-feature-type': 'malicious-path-traversal'
            }
        }, payload);

        assert.strictEqual(res.statusCode, 400, `Expected 400 for invalid feature type, got ${res.statusCode}`);
        assert.ok(res.body.includes('Invalid or unauthorized feature type'), 'Response should flag invalid feature type');
        console.log('✓ Test 2 Passed: Invalid feature type rejected with 400 before parsing');
    }

    // Test 3: Compressed request (Content-Encoding: br) should be rejected with 415 (inflate: false)
    {
        const compressedBytes = Buffer.from([0x21, 0x02, 0x00, 0x04]);
        const res = await simulateRequest({
            method: 'POST',
            url: '/api/map_data_save',
            headers: {
                'content-type': 'application/json',
                'content-encoding': 'br',
                'content-length': String(compressedBytes.length),
                'x-map-data-token': 'test-secret-token-12345',
                'x-feature-type': 'parks'
            }
        }, compressedBytes);

        assert.strictEqual(res.statusCode, 415, `Expected 415 Unsupported Media Type for Content-Encoding: br, got ${res.statusCode}`);
        console.log('✓ Test 3 Passed: Content-Encoding: br rejected with 415 (decompression disabled)');
    }

    // Test 4: Valid uncompressed GeoJSON with valid token should succeed (200)
    {
        const validPayload = JSON.stringify({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [-75.132, 39.868] },
                    properties: { name: 'Test Park' }
                }
            ]
        });
        const res = await simulateRequest({
            method: 'POST',
            url: '/api/map_data_save',
            headers: {
                'content-type': 'application/json',
                'content-length': String(Buffer.byteLength(validPayload)),
                'x-map-data-token': 'test-secret-token-12345',
                'x-feature-type': 'parks'
            }
        }, validPayload);

        assert.strictEqual(res.statusCode, 200, `Expected 200 OK for valid GeoJSON upload, got ${res.statusCode}`);
        assert.ok(res.body.includes('Data written successfully'), 'Response should confirm data written');
        console.log('✓ Test 4 Passed: Legitimate uncompressed GeoJSON upload succeeds with 200');
    }

    // Test 5: Verify ip-address >= 10.7.4 and ReDoS resilience
    {
        const { Address6 } = require('ip-address');
        const ipAddressPkg = require('ip-address/package.json');
        const semver = ipAddressPkg.version.split('.').map(Number);
        assert.ok(
            semver[0] > 10 || (semver[0] === 10 && semver[1] > 7) || (semver[0] === 10 && semver[1] === 7 && semver[2] >= 4),
            `Expected ip-address >= 10.7.4, found ${ipAddressPkg.version}`
        );

        const start = process.hrtime.bigint();
        Address6.isValid('%'.repeat(10000) + '\n');
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
        assert.ok(elapsedMs < 10, `ReDoS payload took too long: ${elapsedMs.toFixed(2)}ms`);
        console.log(`✓ Test 5 Passed: ip-address@${ipAddressPkg.version} immune to ReDoS (${elapsedMs.toFixed(2)}ms)`);
    }

    console.log('--- All Security & Decompression Tests Passed ---');
}

runTests().catch((err) => {
    console.error('Security test failed:', err);
    process.exit(1);
});
