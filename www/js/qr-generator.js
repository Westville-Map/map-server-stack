/**
 * Westville QR Code Generator
 * Core QR Engine: qrcode-generator (c) Kazuhiko Arase (MIT License)
 * Renderer: High-contrast canvas with vector Westville Pin logo overlay
 * Error Correction: Level H (High: 30% error recovery)
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

  // --- qrcode-generator Core by Kazuhiko Arase (MIT License) ---
  function qrCodeGenerator(typeNumber, errorCorrectionLevel) {
    const PAD0 = 0xEC;
    const PAD1 = 0x11;

    let _typeNumber = typeNumber;
    let _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    let _modules = null;
    let _moduleCount = 0;
    let _dataCache = null;
    const _dataList = [];

    const _this = {};

    _this.addData = function(data) {
      const newData = qr8BitByte(data);
      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw new Error(row + "," + col);
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        let typeNumber = 1;
        for (typeNumber = 1; typeNumber < 40; typeNumber++) {
          const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          const buffer = qrBitBuffer();
          let totalDataCount = 0;
          for (let i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }
          for (let i = 0; i < _dataList.length; i++) {
            const data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber));
            data.write(buffer);
          }
          if (buffer.getLengthInBits() <= totalDataCount * 8) break;
        }
        _typeNumber = typeNumber;
      }
      makeImpl(false, getBestMaskPattern());
    };

    function makeImpl(test, maskPattern) {
      _moduleCount = _typeNumber * 4 + 17;
      _modules = new Array(_moduleCount);
      for (let row = 0; row < _moduleCount; row++) {
        _modules[row] = new Array(_moduleCount);
        for (let col = 0; col < _moduleCount; col++) {
          _modules[row][col] = null;
        }
      }
      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);
      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }
      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }
      mapData(_dataCache, maskPattern);
    }

    function setupPositionProbePattern(row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || _moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || _moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c == 0 || c == 6)) ||
              (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
              (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    }

    function getBestMaskPattern() {
      let minLostPoint = 0;
      let pattern = 0;
      for (let i = 0; i < 8; i++) {
        makeImpl(true, i);
        const lostPoint = QRUtil.getLostPoint(_this);
        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    }

    function setupTimingPattern() {
      for (let r = 8; r < _moduleCount - 8; r++) {
        if (_modules[r][6] != null) continue;
        _modules[r][6] = (r % 2 == 0);
      }
      for (let c = 8; c < _moduleCount - 8; c++) {
        if (_modules[6][c] != null) continue;
        _modules[6][c] = (c % 2 == 0);
      }
    }

    function setupPositionAdjustPattern() {
      const pos = QRUtil.getPatternPosition(_typeNumber);
      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          const row = pos[i];
          const col = pos[j];
          if (_modules[row][col] != null) continue;
          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    }

    function setupTypeNumber(test) {
      const bits = QRUtil.getBCHTypeNumber(_typeNumber);
      for (let i = 0; i < 18; i++) {
        const mod = (!test && ((bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }
      for (let i = 0; i < 18; i++) {
        const mod = (!test && ((bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    }

    function setupTypeInfo(test, maskPattern) {
      const data = (_errorCorrectionLevel << 3) | maskPattern;
      const bits = QRUtil.getBCHTypeInfo(data);
      for (let i = 0; i < 15; i++) {
        const mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }
      for (let i = 0; i < 15; i++) {
        const mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i == 8) {
          _modules[8][15 - i] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }
      _modules[_moduleCount - 8][8] = !test;
    }

    function mapData(data, maskPattern) {
      let inc = -1;
      let row = _moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      const maskFunction = QRUtil.getMaskFunction(maskPattern);

      for (let col = _moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col--;
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (_modules[row][col - c] == null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
              }
              const mask = maskFunction(row, col - c);
              if (mask) {
                dark = !dark;
              }
              _modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex == -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    }

    function createData(typeNumber, errorCorrectionLevel, dataList) {
      const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);
      const buffer = qrBitBuffer();
      for (let i = 0; i < dataList.length; i++) {
        const data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber));
        data.write(buffer);
      }
      let totalDataCount = 0;
      for (let i = 0; i < rsBlocks.length; i++) {
        totalDataCount += rsBlocks[i].dataCount;
      }
      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw new Error("code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")");
      }
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }
      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) break;
        buffer.put(PAD0, 8);
        if (buffer.getLengthInBits() >= totalDataCount * 8) break;
        buffer.put(PAD1, 8);
      }
      return createBytes(buffer, rsBlocks);
    }

    function createBytes(buffer, rsBlocks) {
      let offset = 0;
      let maxDcCount = 0;
      let maxEcCount = 0;
      const dcdata = new Array(rsBlocks.length);
      const ecdata = new Array(rsBlocks.length);

      for (let r = 0; r < rsBlocks.length; r++) {
        const dcCount = rsBlocks[r].dataCount;
        const ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        dcdata[r] = new Array(dcCount);
        for (let i = 0; i < dcdata[r].length; i++) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;
        const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ecdata[r].length; i++) {
          const modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
        }
      }

      let totalCodeCount = 0;
      for (let i = 0; i < rsBlocks.length; i++) {
        totalCodeCount += rsBlocks[i].totalCount;
      }
      const data = new Array(totalCodeCount);
      let index = 0;
      for (let i = 0; i < maxDcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
          if (i < dcdata[r].length) {
            data[index++] = dcdata[r][i];
          }
        }
      }
      for (let i = 0; i < maxEcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
          if (i < ecdata[r].length) {
            data[index++] = ecdata[r][i];
          }
        }
      }
      return data;
    }

    return _this;
  }

  // --- Constants & Utilities ---
  const QRErrorCorrectionLevel = { L: 1, M: 0, Q: 3, H: 2 };
  const QRMode = { MODE_NUMBER: 1 << 0, MODE_ALPHA_NUM: 1 << 1, MODE_8BIT_BYTE: 1 << 2, MODE_KANJI: 1 << 3 };
  const QRMaskPattern = { PATTERN000: 0, PATTERN001: 1, PATTERN010: 2, PATTERN011: 3, PATTERN100: 4, PATTERN101: 5, PATTERN110: 6, PATTERN111: 7 };

  const QRUtil = {
    PATTERN_POSITION_TABLE: [
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
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ],
    G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),

    getBCHTypeInfo: function(data) {
      let d = data << 10;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
        d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
      }
      return ((data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber: function(data) {
      let d = data << 12;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
        d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)));
      }
      return (data << 12) | d;
    },

    getBCHDigit: function(data) {
      let digit = 0;
      while (data != 0) {
        digit++;
        data >>>= 1;
      }
      return digit;
    },

    getPatternPosition: function(typeNumber) {
      return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1] || [];
    },

    getMaskFunction: function(maskPattern) {
      switch (maskPattern) {
        case QRMaskPattern.PATTERN000: return function(i, j) { return (i + j) % 2 == 0; };
        case QRMaskPattern.PATTERN001: return function(i, j) { return i % 2 == 0; };
        case QRMaskPattern.PATTERN010: return function(i, j) { return j % 3 == 0; };
        case QRMaskPattern.PATTERN011: return function(i, j) { return (i + j) % 3 == 0; };
        case QRMaskPattern.PATTERN100: return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0; };
        case QRMaskPattern.PATTERN101: return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
        case QRMaskPattern.PATTERN110: return function(i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 == 0; };
        case QRMaskPattern.PATTERN111: return function(i, j) { return ((i * j) % 3 + (i + j) % 2) % 2 == 0; };
        default: throw new Error("bad maskPattern:" + maskPattern);
      }
    },

    getErrorCorrectPolynomial: function(errorCorrectLength) {
      let a = qrPolynomial([1], 0);
      for (let i = 0; i < errorCorrectLength; i++) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    },

    getLengthInBits: function(mode, type) {
      if (1 <= type && type < 10) {
        switch (mode) {
          case QRMode.MODE_NUMBER: return 10;
          case QRMode.MODE_ALPHA_NUM: return 9;
          case QRMode.MODE_8BIT_BYTE: return 8;
          case QRMode.MODE_KANJI: return 8;
          default: throw new Error("mode:" + mode);
        }
      } else if (type < 27) {
        switch (mode) {
          case QRMode.MODE_NUMBER: return 12;
          case QRMode.MODE_ALPHA_NUM: return 11;
          case QRMode.MODE_8BIT_BYTE: return 16;
          case QRMode.MODE_KANJI: return 10;
          default: throw new Error("mode:" + mode);
        }
      } else if (type < 41) {
        switch (mode) {
          case QRMode.MODE_NUMBER: return 14;
          case QRMode.MODE_ALPHA_NUM: return 13;
          case QRMode.MODE_8BIT_BYTE: return 16;
          case QRMode.MODE_KANJI: return 12;
          default: throw new Error("mode:" + mode);
        }
      } else {
        throw new Error("type:" + type);
      }
    },

    getLostPoint: function(qrCode) {
      const moduleCount = qrCode.getModuleCount();
      let lostPoint = 0;

      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          let sameCount = 0;
          const dark = qrCode.isDark(row, col);
          for (let r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (let c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r == 0 && c == 0) continue;
              if (dark == qrCode.isDark(row + r, col + c)) {
                sameCount++;
              }
            }
          }
          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      }

      for (let row = 0; row < moduleCount - 1; row++) {
        for (let col = 0; col < moduleCount - 1; col++) {
          let count = 0;
          if (qrCode.isDark(row, col)) count++;
          if (qrCode.isDark(row + 1, col)) count++;
          if (qrCode.isDark(row, col + 1)) count++;
          if (qrCode.isDark(row + 1, col + 1)) count++;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount - 6; col++) {
          if (qrCode.isDark(row, col) &&
              !qrCode.isDark(row, col + 1) &&
              qrCode.isDark(row, col + 2) &&
              qrCode.isDark(row, col + 3) &&
              qrCode.isDark(row, col + 4) &&
              !qrCode.isDark(row, col + 5) &&
              qrCode.isDark(row, col + 6)) {
            lostPoint += 40;
          }
        }
      }

      for (let col = 0; col < moduleCount; col++) {
        for (let row = 0; row < moduleCount - 6; row++) {
          if (qrCode.isDark(row, col) &&
              !qrCode.isDark(row + 1, col) &&
              qrCode.isDark(row + 2, col) &&
              qrCode.isDark(row + 3, col) &&
              qrCode.isDark(row + 4, col) &&
              !qrCode.isDark(row + 5, col) &&
              qrCode.isDark(row + 6, col)) {
            lostPoint += 40;
          }
        }
      }

      let darkCount = 0;
      for (let col = 0; col < moduleCount; col++) {
        for (let row = 0; row < moduleCount; row++) {
          if (qrCode.isDark(row, col)) darkCount++;
        }
      }
      const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    }
  };

  // --- Galois Field Math ---
  const QRMath = {
    glog: function(n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp: function(n) {
      while (n < 0) n += 255;
      while (n >= 256) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };

  for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  function qrPolynomial(num, shift) {
    if (num.length == undefined) throw new Error(num.length + "/" + shift);
    let offset = 0;
    while (offset < num.length && num[offset] == 0) offset++;
    const _num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) _num[i] = num[i + offset];

    const _this = {};
    _this.get = function(index) { return _num[index]; };
    _this.getLength = function() { return _num.length; };
    _this.multiply = function(e) {
      const num = new Array(_this.getLength() + e.getLength() - 1);
      for (let i = 0; i < _this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return qrPolynomial(num, 0);
    };
    _this.mod = function(e) {
      if (_this.getLength() - e.getLength() < 0) return _this;
      const ratio = QRMath.glog(_this.get(0)) - QRMath.glog(e.get(0));
      const num = new Array(_this.getLength());
      for (let i = 0; i < _this.getLength(); i++) num[i] = _this.get(i);
      for (let i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      }
      return qrPolynomial(num, 0).mod(e);
    };
    return _this;
  }

  function QRRSBlock(totalCount, dataCount) {
    const _this = {};
    _this.totalCount = totalCount;
    _this.dataCount = dataCount;
    return _this;
  }

  QRRSBlock.RS_BLOCK_TABLE = [
    // 1-5
    [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
    [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
    [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
    [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
    [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
    // 6-10
    [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
    [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
    [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
    [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
    [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
    // 11-15
    [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13],
    [2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15],
    [4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12],
    [3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13],
    [5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12, 7, 37, 13]
  ];

  QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
    const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectionLevel);
    if (rsBlock == undefined) throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectionLevel:" + errorCorrectionLevel);
    const length = rsBlock.length / 3;
    const list = [];
    for (let i = 0; i < length; i++) {
      const count = rsBlock[i * 3 + 0];
      const totalCount = rsBlock[i * 3 + 1];
      const dataCount = rsBlock[i * 3 + 2];
      for (let j = 0; j < count; j++) {
        list.push(QRRSBlock(totalCount, dataCount));
      }
    }
    return list;
  };

  QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
    switch (errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default: return undefined;
    }
  };

  function qrBitBuffer() {
    const _buffer = [];
    let _length = 0;
    const _this = {};
    _this.getBuffer = function() { return _buffer; };
    _this.get = function(index) {
      const bufIndex = Math.floor(index / 8);
      return ((_buffer[bufIndex] >>> (7 - index % 8)) & 1) == 1;
    };
    _this.put = function(num, length) {
      for (let i = 0; i < length; i++) {
        _this.putBit(((num >>> (length - i - 1)) & 1) == 1);
      }
    };
    _this.getLengthInBits = function() { return _length; };
    _this.putBit = function(bit) {
      const bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) _buffer.push(0);
      if (bit) _buffer[bufIndex] |= (0x80 >>> (_length % 8));
      _length++;
    };
    return _this;
  }

  function qr8BitByte(data) {
    const _mode = QRMode.MODE_8BIT_BYTE;
    const _data = data;
    const _parsedData = [];

    // UTF-8 encode string
    for (let i = 0; i < _data.length; i++) {
      const byteArray = [];
      const code = _data.charCodeAt(i);
      if (code > 0x10000) {
        byteArray[0] = 0xF0 | ((code & 0x1C0000) >>> 18);
        byteArray[1] = 0x80 | ((code & 0x3F000) >>> 12);
        byteArray[2] = 0x80 | ((code & 0xFC0) >>> 6);
        byteArray[3] = 0x80 | (code & 0x3F);
      } else if (code > 0x800) {
        byteArray[0] = 0xE0 | ((code & 0xF000) >>> 12);
        byteArray[1] = 0x80 | ((code & 0xFC0) >>> 6);
        byteArray[2] = 0x80 | (code & 0x3F);
      } else if (code > 0x80) {
        byteArray[0] = 0xC0 | ((code & 0x7C0) >>> 6);
        byteArray[1] = 0x80 | (code & 0x3F);
      } else {
        byteArray[0] = code;
      }
      for (let j = 0; j < byteArray.length; j++) {
        _parsedData.push(byteArray[j]);
      }
    }

    const _this = {};
    _this.getMode = function() { return _mode; };
    _this.getLength = function(buffer) { return _parsedData.length; };
    _this.write = function(buffer) {
      for (let i = 0; i < _parsedData.length; i++) {
        buffer.put(_parsedData[i], 8);
      }
    };
    return _this;
  }

  // --- High Contrast Canvas & Westville Pin Vector Overlay ---

  /**
   * Render Westville Pin Vector directly on 2D Canvas
   */
  function drawWestvillePin(ctx, cx, cy, pinW, pinH, options) {
    options = options || {};
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
   * Generate High-Contrast Branded QR Code Canvas
   */
  function generateQRCodeCanvas(text, options) {
    options = options || {};
    // Auto-detect typeNumber with Level H (High: 30% error recovery)
    const qr = qrCodeGenerator(0, 'H');
    qr.addData(text);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const canvasSize = options.size || 400;
    const margin = options.margin !== undefined ? options.margin : 4; // 4 module quiet zone
    const totalModules = moduleCount + margin * 2;
    const moduleSize = canvasSize / totalModules;

    const moduleColor = options.colorDark || '#1a4d7c';   // High-contrast Navy / Blue
    const bgColor = options.colorLight || '#ffffff';       // Option B: Crisp White

    let canvas;
    if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
    } else {
      return null;
    }

    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    // 1. Draw solid background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // 2. Draw 100% Solid High-Contrast Data Modules
    ctx.fillStyle = moduleColor;
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.isDark(r, c)) {
          const x = (c + margin) * moduleSize;
          const y = (r + margin) * moduleSize;
          // Fill full module square to ensure crisp scanner thresholding
          ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(moduleSize), Math.ceil(moduleSize));
        }
      }
    }

    // 3. Draw Centered Westville Pin Logo with Clean White Halo Shield
    // Logo radius occupies ~18% of total width (well within Level H 30% recovery margin)
    const centerPx = canvasSize / 2;
    const logoW = canvasSize * 0.19;
    const logoH = logoW * 1.2;
    const haloRadius = logoW * 0.65;

    // Draw circular white background halo to isolate the logo from dark modules
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(centerPx, centerPx - 1, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw Westville Pin
    drawWestvillePin(ctx, centerPx, centerPx - 2, logoW, logoH, options);

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
  function createWestvilleQR(text, options) {
    const canvas = generateQRCodeCanvas(text, options);
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL('image/png');
    return {
      canvas: canvas,
      dataUrl: dataUrl,
      getBytes: function() { return dataUrlToUint8Array(dataUrl); }
    };
  }

  let _toastTimeout = null;

  function showToast(message) {
    let toast = document.getElementById('share-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'share-toast';
      toast.className = 'share-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span style="font-size:1.1rem;">📋</span> ${message}`;
    toast.classList.add('show');
    if (_toastTimeout) clearTimeout(_toastTimeout);
    _toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  function copyTextToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg || 'Link copied to clipboard!');
      }).catch((err) => {
        console.warn('Clipboard writeText failed:', err);
        fallbackCopyText(text, successMsg);
      });
    } else {
      fallbackCopyText(text, successMsg);
    }
  }

  function fallbackCopyText(text, successMsg) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      showToast(successMsg || 'Link copied to clipboard!');
    } catch (e) {
      console.error('Fallback copy failed', e);
    }
  }

  function copyCanvasToClipboard(canvas, fallbackUrl, successMsg) {
    if (canvas && navigator.clipboard && window.ClipboardItem && canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) {
          copyTextToClipboard(fallbackUrl, 'Link copied to clipboard!');
          return;
        }
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          navigator.clipboard.write([item]).then(() => {
            showToast(successMsg || 'QR code image copied to clipboard!');
          }).catch((err) => {
            console.warn('Image clipboard write failed, fallback to URL:', err);
            copyTextToClipboard(fallbackUrl, 'Link copied to clipboard!');
          });
        } catch (err) {
          copyTextToClipboard(fallbackUrl, 'Link copied to clipboard!');
        }
      }, 'image/png');
    } else {
      copyTextToClipboard(fallbackUrl, 'Link copied to clipboard!');
    }
  }

  function openShareModal(options) {
    options = options || {};
    const url = options.url || window.location.href;
    const title = options.title || document.title || 'Westville';
    const subtitle = options.subtitle || 'Westville Borough Interactive Portal';
    const colorDark = options.colorDark || '#1a4d7c';
    const colorLight = options.colorLight || '#ffffff';

    const modal = document.getElementById('share-modal');
    if (!modal) return;

    // Update Title & Subtitle
    const titleEl = modal.querySelector('#share-modal-title');
    if (titleEl) titleEl.textContent = title;

    const subEl = modal.querySelector('#share-modal-subtitle');
    if (subEl) subEl.textContent = subtitle;

    // Update URL text
    const urlEl = modal.querySelector('#share-modal-url-text');
    if (urlEl) urlEl.textContent = url;

    // Render Canvas
    const renderArea = modal.querySelector('#share-qr-render-area');
    let activeCanvas = null;
    if (renderArea) {
      renderArea.innerHTML = '';
      activeCanvas = generateQRCodeCanvas(url, {
        size: 640,
        colorDark: colorDark,
        colorLight: colorLight,
        pinFill: options.pinFill || colorDark,
        pinStroke: options.pinStroke || '#e5c158'
      });
      if (activeCanvas) {
        renderArea.appendChild(activeCanvas);
      }
    }

    // Tap QR Box -> Copy image
    const qrBox = modal.querySelector('#share-qr-box');
    if (qrBox) {
      qrBox.onclick = () => {
        copyCanvasToClipboard(activeCanvas, url, 'QR code image copied to clipboard!');
      };
      qrBox.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          copyCanvasToClipboard(activeCanvas, url, 'QR code image copied to clipboard!');
        }
      };
    }

    // Tap Meta Card -> Copy link
    const metaCard = modal.querySelector('#share-meta-card');
    if (metaCard) {
      metaCard.onclick = () => {
        copyTextToClipboard(url, 'Link copied to clipboard!');
      };
      metaCard.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          copyTextToClipboard(url, 'Link copied to clipboard!');
        }
      };
    }

    // Copy QR Image button
    const copyQrBtn = modal.querySelector('#share-copy-qr-btn');
    if (copyQrBtn) {
      copyQrBtn.onclick = () => {
        copyCanvasToClipboard(activeCanvas, url, 'QR code image copied to clipboard!');
      };
    }

    // Copy Link button
    const copyLinkBtn = modal.querySelector('#share-copy-link-btn');
    if (copyLinkBtn) {
      copyLinkBtn.onclick = () => {
        copyTextToClipboard(url, 'Link copied to clipboard!');
      };
    }

    // Native Share button
    const nativeBtn = modal.querySelector('#share-native-btn');
    if (nativeBtn) {
      if (navigator.share) {
        nativeBtn.style.display = 'inline-flex';
        nativeBtn.onclick = () => {
          navigator.share({
            title: title,
            text: `${title} - ${subtitle}`,
            url: url
          }).catch((err) => {
            if (err.name !== 'AbortError') console.warn('Native share failed:', err);
          });
        };
      } else {
        nativeBtn.style.display = 'none';
      }
    }

    // Close button
    const closeBtn = modal.querySelector('#share-modal-close-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        if (typeof modal.close === 'function') {
          modal.close();
        } else {
          const overlay = modal.querySelector('.wv-modal-overlay');
          if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => { overlay.style.display = 'none'; }, 200);
          }
        }
      };
    }

    // Open Modal
    if (typeof modal.open === 'function') {
      modal.open();
    } else {
      const overlay = modal.querySelector('.wv-modal-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
          overlay.classList.add('active');
        });
      }
    }
  }

  return {
    qrCodeGenerator: qrCodeGenerator,
    generateQRCodeCanvas: generateQRCodeCanvas,
    createWestvilleQR: createWestvilleQR,
    dataUrlToUint8Array: dataUrlToUint8Array,
    drawWestvillePin: drawWestvillePin,
    openShareModal: openShareModal,
    showToast: showToast,
    copyTextToClipboard: copyTextToClipboard,
    copyCanvasToClipboard: copyCanvasToClipboard
  };
}));
