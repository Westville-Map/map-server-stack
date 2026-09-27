/**
 * Standalone, zero-dependency QR Code Generator with Custom Styling and Centered Westville Pin
 * Error Correction: Level H (~30% recovery) to guarantee scannability with center logo overlay.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WestvilleQR = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // --- Galois Field GF(256) Math for Reed-Solomon ECC ---
  const EXP_TABLE = new Uint8Array(512);
  const LOG_TABLE = new Uint8Array(256);

  (function initGalois() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP_TABLE[i] = x;
      LOG_TABLE[x] = i;
      x <<= 1;
      if (x & 0x100) {
        x ^= 0x11d; // Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
      }
    }
    for (let i = 255; i < 512; i++) {
      EXP_TABLE[i] = EXP_TABLE[i - 255];
    }
  })();

  function gfMul(x, y) {
    if (x === 0 || y === 0) return 0;
    return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
  }

  function rsGeneratorPoly(numEcBytes) {
    let poly = [1];
    for (let i = 0; i < numEcBytes; i++) {
      const root = EXP_TABLE[i];
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gfMul(poly[j], root);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    return poly;
  }

  function rsCompute(dataBytes, numEcBytes) {
    const gen = rsGeneratorPoly(numEcBytes);
    const remainder = new Array(numEcBytes).fill(0);
    for (let i = 0; i < dataBytes.length; i++) {
      const factor = dataBytes[i] ^ remainder.shift();
      remainder.push(0);
      if (factor !== 0) {
        for (let j = 0; j < numEcBytes; j++) {
          remainder[j] ^= gfMul(gen[j], factor);
        }
      }
    }
    return remainder;
  }

  // --- QR Code Specs for Error Correction Level H (High: 30%) ---
  // Table per version (1 to 14): [totalBytes, ecBytesPerBlock, numBlocksGroup1, dataBytesPerBlockGroup1, numBlocksGroup2, dataBytesPerBlockGroup2]
  const TABLE_H = [
    null,
    [26, 17, 1, 9, 0, 0],      // V1: 9 data bytes
    [44, 28, 1, 16, 0, 0],     // V2: 16 data bytes
    [70, 22, 2, 13, 0, 0],     // V3: 26 data bytes
    [100, 16, 4, 9, 0, 0],     // V4: 36 data bytes
    [134, 22, 2, 11, 2, 12],   // V5: 46 data bytes
    [172, 28, 4, 15, 0, 0],    // V6: 60 data bytes
    [196, 26, 4, 13, 1, 14],   // V7: 66 data bytes
    [242, 26, 4, 14, 2, 15],   // V8: 86 data bytes
    [292, 24, 4, 12, 4, 13],   // V9: 100 data bytes
    [346, 28, 6, 15, 2, 16],   // V10: 122 data bytes
    [404, 24, 4, 22, 4, 23],   // V11: 180 data bytes
    [466, 28, 6, 20, 2, 21],   // V12: 162 data bytes
    [532, 22, 8, 20, 4, 21],   // V13: 244 data bytes
    [581, 24, 10, 18, 2, 19]   // V14: 218 data bytes
  ];

  // Alignment pattern table locations
  const ALIGNMENT_PATTERN_POS = [
    [],
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58],
    [6, 34, 62],
    [6, 26, 46, 66]
  ];

  // Format info bits for Level H (Mask 0 to 7)
  const FORMAT_INFO_H = [
    0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b
  ];

  // Encode UTF-8 string to byte array
  function utf8Encode(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c < 0xd800 || c >= 0xe000) {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else {
        i++;
        c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return new Uint8Array(bytes);
  }

  // Pick smallest QR version supporting data length at Level H
  function chooseVersion(dataLen) {
    for (let v = 1; v < TABLE_H.length; v++) {
      const [totalBytes, ecBytes, g1Blocks, g1Data, g2Blocks, g2Data] = TABLE_H[v];
      const maxData = (g1Blocks * g1Data) + (g2Blocks * g2Data);
      const charCountBits = (v <= 9) ? 8 : 16;
      const headerBits = 4 + charCountBits; // 4 bit mode indicator + length
      const requiredBytes = Math.ceil((headerBits + dataLen * 8) / 8);
      if (requiredBytes <= maxData) {
        return v;
      }
    }
    throw new Error('Data string too long for Level H QR Code generation.');
  }

  // Bit Buffer helper
  class BitBuffer {
    constructor() {
      this.buffer = [];
      this.length = 0;
    }
    put(num, length) {
      for (let i = length - 1; i >= 0; i--) {
        this.buffer.push((num >>> i) & 1);
        this.length++;
      }
    }
    getBytes() {
      const bytes = [];
      for (let i = 0; i < this.buffer.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8 && i + j < this.buffer.length; j++) {
          b = (b << 1) | this.buffer[i + j];
        }
        bytes.push(b);
      }
      return bytes;
    }
  }

  function buildQrMatrix(text) {
    const dataBytes = utf8Encode(text);
    const version = chooseVersion(dataBytes.length);
    const [totalBytes, ecBytesPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] = TABLE_H[version];
    const totalDataCapacity = (g1Blocks * g1Data) + (g2Blocks * g2Data);

    const bb = new BitBuffer();
    // 1. Mode indicator: Byte mode (0100)
    bb.put(0x4, 4);
    // 2. Character count indicator
    const charCountBits = (version <= 9) ? 8 : 16;
    bb.put(dataBytes.length, charCountBits);
    // 3. Data bytes
    for (let i = 0; i < dataBytes.length; i++) {
      bb.put(dataBytes[i], 8);
    }
    // 4. Terminator
    const remainingBits = (totalDataCapacity * 8) - bb.length;
    const termLen = Math.min(4, remainingBits);
    bb.put(0x0, termLen);
    // 5. Pad to byte boundary
    while (bb.length % 8 !== 0) {
      bb.put(0, 1);
    }
    // 6. Pad bytes 0xEC, 0x11
    const padBytes = [0xEC, 0x11];
    let padIdx = 0;
    while (bb.length < totalDataCapacity * 8) {
      bb.put(padBytes[padIdx % 2], 8);
      padIdx++;
    }

    const allData = bb.getBytes();

    // 7. Divide into blocks and compute Reed-Solomon error correction
    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;

    for (let i = 0; i < g1Blocks; i++) {
      const block = allData.slice(offset, offset + g1Data);
      offset += g1Data;
      dataBlocks.push(block);
      ecBlocks.push(rsCompute(block, ecBytesPerBlock));
    }
    for (let i = 0; i < g2Blocks; i++) {
      const block = allData.slice(offset, offset + g2Data);
      offset += g2Data;
      dataBlocks.push(block);
      ecBlocks.push(rsCompute(block, ecBytesPerBlock));
    }

    // 8. Interleave data bytes and EC bytes
    const finalCodewords = [];
    const maxDataLen = Math.max(g1Data, g2Data);
    for (let j = 0; j < maxDataLen; j++) {
      for (let i = 0; i < dataBlocks.length; i++) {
        if (j < dataBlocks[i].length) {
          finalCodewords.push(dataBlocks[i][j]);
        }
      }
    }
    for (let j = 0; j < ecBytesPerBlock; j++) {
      for (let i = 0; i < ecBlocks.length; i++) {
        finalCodewords.push(ecBlocks[i][j]);
      }
    }

    // 9. Create module matrix
    const size = version * 4 + 17;
    const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
    const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

    function setFunctionModule(r, c, val) {
      matrix[r][c] = val ? 1 : 0;
      isFunction[r][c] = true;
    }

    // Finder patterns
    function placeFinder(topR, topC) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBlack = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          setFunctionModule(topR + r, topC + c, isBlack);
        }
      }
    }
    placeFinder(0, 0);
    placeFinder(0, size - 7);
    placeFinder(size - 7, 0);

    // Separators
    for (let i = 0; i < 8; i++) {
      // Top-left
      if (i < size) {
        setFunctionModule(7, i, false);
        setFunctionModule(i, 7, false);
      }
      // Top-right
      if (size - 8 + i < size) {
        setFunctionModule(7, size - 8 + i, false);
        setFunctionModule(i, size - 8, false);
      }
      // Bottom-left
      if (size - 8 + i < size) {
        setFunctionModule(size - 8, i, false);
        setFunctionModule(size - 8 + i, 7, false);
      }
    }

    // Alignment patterns
    const alignPos = ALIGNMENT_PATTERN_POS[version];
    for (let i = 0; i < alignPos.length; i++) {
      for (let j = 0; j < alignPos.length; j++) {
        const r = alignPos[i];
        const c = alignPos[j];
        if (isFunction[r][c]) continue; // Skip finders
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
            setFunctionModule(r + dr, c + dc, isBlack);
          }
        }
      }
    }

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!isFunction[6][i]) setFunctionModule(6, i, i % 2 === 0);
      if (!isFunction[i][6]) setFunctionModule(i, 6, i % 2 === 0);
    }

    // Dark module
    setFunctionModule(4 * version + 9, 8, true);

    // Reserve Format Info Area
    for (let i = 0; i < 9; i++) {
      if (!isFunction[8][i]) isFunction[8][i] = true;
      if (!isFunction[i][8]) isFunction[i][8] = true;
    }
    for (let i = 0; i < 8; i++) {
      if (!isFunction[8][size - 1 - i]) isFunction[8][size - 1 - i] = true;
      if (!isFunction[size - 1 - i][8]) isFunction[size - 1 - i] = true;
    }

    // 10. Place Data Codewords (Zigzag)
    let codewordBits = [];
    for (let i = 0; i < finalCodewords.length; i++) {
      for (let b = 7; b >= 0; b--) {
        codewordBits.push((finalCodewords[i] >>> b) & 1);
      }
    }

    let bitIdx = 0;
    let upwards = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right--; // Skip vertical timing pattern
      const rows = upwards ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
      for (let r of rows) {
        for (let colOffset = 0; colOffset < 2; colOffset++) {
          const c = right - colOffset;
          if (!isFunction[r][c]) {
            matrix[r][c] = (bitIdx < codewordBits.length) ? codewordBits[bitIdx] : 0;
            bitIdx++;
          }
        }
      }
      upwards = !upwards;
    }

    // 11. Mask Evaluation (Pick mask pattern 0-7 with lowest penalty)
    function getMaskBit(mask, r, c) {
      switch (mask) {
        case 0: return (r + c) % 2 === 0;
        case 1: return r % 2 === 0;
        case 2: return c % 3 === 0;
        case 3: return (r + c) % 3 === 0;
        case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
        case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
        case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      }
      return false;
    }

    function evaluatePenalty(testMatrix) {
      let penalty = 0;
      // Rule 1: 5+ consecutive modules of same color
      for (let r = 0; r < size; r++) {
        let runColor = -1, runLen = 0;
        for (let c = 0; c < size; c++) {
          if (testMatrix[r][c] === runColor) {
            runLen++;
            if (runLen === 5) penalty += 3;
            else if (runLen > 5) penalty += 1;
          } else {
            runColor = testMatrix[r][c];
            runLen = 1;
          }
        }
      }
      for (let c = 0; c < size; c++) {
        let runColor = -1, runLen = 0;
        for (let r = 0; r < size; r++) {
          if (testMatrix[r][c] === runColor) {
            runLen++;
            if (runLen === 5) penalty += 3;
            else if (runLen > 5) penalty += 1;
          } else {
            runColor = testMatrix[r][c];
            runLen = 1;
          }
        }
      }
      // Rule 2: 2x2 blocks of same color
      for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size - 1; c++) {
          const val = testMatrix[r][c];
          if (val === testMatrix[r + 1][c] && val === testMatrix[r][c + 1] && val === testMatrix[r + 1][c + 1]) {
            penalty += 3;
          }
        }
      }
      return penalty;
    }

    let bestMask = 0;
    let minPenalty = Infinity;
    let bestMatrix = null;

    for (let mask = 0; mask < 8; mask++) {
      const masked = matrix.map((row, r) =>
        row.map((val, c) => {
          if (isFunction[r][c]) return val;
          return val ^ (getMaskBit(mask, r, c) ? 1 : 0);
        })
      );

      // Write format info bits for this mask
      const formatBits = FORMAT_INFO_H[mask];
      // Place 15 format bits
      for (let i = 0; i < 15; i++) {
        const bit = (formatBits >>> (14 - i)) & 1;
        // Top-left
        if (i < 6) masked[8][i] = bit;
        else if (i === 6) masked[8][7] = bit;
        else if (i === 7) masked[8][8] = bit;
        else if (i === 8) masked[7][8] = bit;
        else masked[14 - i][8] = bit;

        // Split around bottom-left & top-right
        if (i < 8) masked[size - 1 - i][8] = bit;
        else masked[8][size - 15 + i] = bit;
      }

      const p = evaluatePenalty(masked);
      if (p < minPenalty) {
        minPenalty = p;
        bestMask = mask;
        bestMatrix = masked;
      }
    }

    return {
      size,
      version,
      matrix: bestMatrix
    };
  }

  // --- HTML5 Canvas & Vector Pin Rendering ---

  /**
   * Render Westville Pin Vector directly on 2D Canvas
   */
  function drawWestvillePin(ctx, cx, cy, pinW, pinH, options = {}) {
    const primaryColor = options.pinFill || '#4e73ac';
    const goldColor = options.pinStroke || '#e5c158';

    ctx.save();
    ctx.translate(cx, cy);

    // Scale to match viewBox (0 0 100 120) centered at (50, 60)
    const scale = Math.min(pinW / 100, pinH / 120);
    ctx.scale(scale, scale);
    ctx.translate(-50, -60);

    // Pin contour path
    ctx.beginPath();
    ctx.moveTo(50, 115);
    ctx.bezierCurveTo(50, 115, 10, 70, 10, 45);
    ctx.arc(50, 45, 40, Math.PI, 0, false);
    ctx.bezierCurveTo(90, 70, 50, 115, 50, 115);
    ctx.closePath();

    ctx.fillStyle = primaryColor;
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = goldColor;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Shadow W
    ctx.font = "bold 60px 'Times New Roman', Georgia, serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(42, 63, 95, 0.6)';
    ctx.fillText('W', 52, 76);

    // Front White W
    ctx.fillStyle = '#ffffff';
    ctx.fillText('W', 50, 74);

    ctx.restore();
  }

  /**
   * Generate a styled QR Code Canvas with rounded dots and centered Westville Pin
   */
  function generateQRCodeCanvas(text, options = {}) {
    const qr = buildQrMatrix(text);
    const size = qr.size;

    const canvasSize = options.size || 400;
    const quietZone = options.quietZone !== undefined ? options.quietZone : 4;
    const totalModules = size + quietZone * 2;
    const moduleSize = canvasSize / totalModules;

    const moduleColor = options.colorDark || '#1a4d7c';   // Westville Navy / Blue
    const bgColor = options.colorLight || '#ffffff';       // Option B: Crisp White
    const eyeOuterColor = options.eyeOuterColor || moduleColor;
    const eyeInnerColor = options.eyeInnerColor || moduleColor;

    let canvas;
    if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
    } else {
      // For testing in node if canvas shim provided
      return null;
    }

    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    // 1. Draw Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Helper: Is cell in any of the 3 finder pattern areas (including 1 cell quiet border)
    function isFinder(r, c) {
      if (r < 8 && c < 8) return true; // Top-Left
      if (r < 8 && c >= size - 8) return true; // Top-Right
      if (r >= size - 8 && c < 8) return true; // Bottom-Left
      return false;
    }

    // Helper: Draw rounded rectangle
    function roundRect(ctx, x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // 2. Draw Finder Patterns (Corner Eyes) with rounded elegant styling
    function drawFinderEye(r, c) {
      const x = (c + quietZone) * moduleSize;
      const y = (r + quietZone) * moduleSize;
      const w = 7 * moduleSize;
      const cornerR = moduleSize * 1.8;

      // Outer Ring
      ctx.fillStyle = eyeOuterColor;
      roundRect(ctx, x, y, w, w, cornerR);
      ctx.fill();

      // Inner White Cutout
      ctx.fillStyle = bgColor;
      const cutW = 5 * moduleSize;
      roundRect(ctx, x + moduleSize, y + moduleSize, cutW, cutW, cornerR * 0.7);
      ctx.fill();

      // Inner Center Eye
      ctx.fillStyle = eyeInnerColor;
      const eyeW = 3 * moduleSize;
      roundRect(ctx, x + 2 * moduleSize, y + 2 * moduleSize, eyeW, eyeW, cornerR * 0.5);
      ctx.fill();
    }

    drawFinderEye(0, 0);
    drawFinderEye(0, size - 7);
    drawFinderEye(size - 7, 0);

    // 3. Define Center Logo Exclusion Zone (Center ~22% of matrix)
    const centerRadiusMod = Math.floor(size * 0.16); // Modules around center to shield
    const centerModule = Math.floor(size / 2);
    const minCenterMod = centerModule - centerRadiusMod;
    const maxCenterMod = centerModule + centerRadiusMod;

    // 4. Draw Standard Data Modules
    ctx.fillStyle = moduleColor;
    const dotRadius = moduleSize * 0.35; // Soft rounded dots

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (isFinder(r, c)) continue;
        if (qr.matrix[r][c] === 1) {
          // Check if module falls inside center logo zone
          if (r >= minCenterMod && r <= maxCenterMod && c >= minCenterMod && c <= maxCenterMod) {
            continue; // Keep logo area clear for 100% scan decoding
          }
          const x = (c + quietZone) * moduleSize;
          const y = (r + quietZone) * moduleSize;

          // Draw rounded module
          ctx.beginPath();
          ctx.arc(x + moduleSize / 2, y + moduleSize / 2, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 5. Draw Center Logo Shield & Westville Pin
    const centerPx = canvasSize / 2;
    const logoAreaW = (maxCenterMod - minCenterMod + 1.2) * moduleSize;
    const logoAreaH = logoAreaW * 1.15;

    // Clear background circle/shield behind pin
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(centerPx, centerPx, logoAreaW * 0.58, 0, Math.PI * 2);
    ctx.fill();

    // Draw Westville Pin
    drawWestvillePin(ctx, centerPx, centerPx - 2, logoAreaW * 0.85, logoAreaH * 0.85, options);

    return canvas;
  }

  /**
   * Convert Data URL to Uint8Array for pdf-lib embedding
   */
  function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * High level API: generate QR Data URL and PNG bytes
   */
  function createWestvilleQR(text, options = {}) {
    const canvas = generateQRCodeCanvas(text, options);
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL('image/png');
    return {
      canvas,
      dataUrl,
      getBytes: () => dataUrlToUint8Array(dataUrl)
    };
  }

  return {
    buildQrMatrix,
    generateQRCodeCanvas,
    createWestvilleQR,
    dataUrlToUint8Array,
    drawWestvillePin
  };
}));
