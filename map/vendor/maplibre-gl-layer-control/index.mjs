var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class CustomLayerRegistry {
  constructor() {
    __publicField(this, "adapters", /* @__PURE__ */ new Map());
    __publicField(this, "changeListeners", []);
    __publicField(this, "unsubscribers", /* @__PURE__ */ new Map());
  }
  /**
   * Register a custom layer adapter.
   * @param adapter The adapter to register
   */
  register(adapter) {
    this.adapters.set(adapter.type, adapter);
    if (adapter.onLayerChange) {
      const unsubscribe = adapter.onLayerChange((event, layerId) => {
        this.notifyChange(event, layerId);
      });
      this.unsubscribers.set(adapter.type, unsubscribe);
    }
  }
  /**
   * Unregister an adapter by type.
   * @param type The adapter type to unregister
   */
  unregister(type) {
    const unsubscribe = this.unsubscribers.get(type);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribers.delete(type);
    }
    this.adapters.delete(type);
  }
  /**
   * Get all custom layer IDs across all adapters.
   * @returns Array of layer IDs
   */
  getAllLayerIds() {
    const ids = [];
    this.adapters.forEach((adapter) => {
      ids.push(...adapter.getLayerIds());
    });
    return ids;
  }
  /**
   * Get each adapter's layer IDs as a separate list, in adapter order.
   * @returns One array of layer IDs per registered adapter
   */
  getLayerIdGroups() {
    return Array.from(this.adapters.values(), (adapter) => adapter.getLayerIds());
  }
  /**
   * Check if a layer ID is managed by any adapter.
   * @param layerId The layer ID to check
   * @returns true if the layer is managed by an adapter
   */
  hasLayer(layerId) {
    for (const adapter of this.adapters.values()) {
      if (adapter.getLayerIds().includes(layerId)) {
        return true;
      }
    }
    return false;
  }
  /**
   * Get the adapter responsible for a specific layer.
   * @param layerId The layer ID
   * @returns The adapter or null if not found
   */
  getAdapterForLayer(layerId) {
    for (const adapter of this.adapters.values()) {
      if (adapter.getLayerIds().includes(layerId)) {
        return adapter;
      }
    }
    return null;
  }
  /**
   * Get the state of a custom layer.
   * @param layerId The layer ID
   * @returns The layer state or null if not found
   */
  getLayerState(layerId) {
    const adapter = this.getAdapterForLayer(layerId);
    return adapter ? adapter.getLayerState(layerId) : null;
  }
  /**
   * Set visibility of a custom layer.
   * @param layerId The layer ID
   * @param visible Whether the layer should be visible
   * @returns true if the operation was handled by an adapter
   */
  setVisibility(layerId, visible) {
    const adapter = this.getAdapterForLayer(layerId);
    if (adapter) {
      adapter.setVisibility(layerId, visible);
      return true;
    }
    return false;
  }
  /**
   * Set opacity of a custom layer.
   * @param layerId The layer ID
   * @param opacity The opacity value (0-1)
   * @returns true if the operation was handled by an adapter
   */
  setOpacity(layerId, opacity) {
    const adapter = this.getAdapterForLayer(layerId);
    if (adapter) {
      adapter.setOpacity(layerId, opacity);
      return true;
    }
    return false;
  }
  /**
   * Get the symbol type for a custom layer (for UI display).
   * @param layerId The layer ID
   * @returns The symbol type or null if not available
   */
  getSymbolType(layerId) {
    const adapter = this.getAdapterForLayer(layerId);
    if (adapter && adapter.getSymbolType) {
      return adapter.getSymbolType(layerId);
    }
    return null;
  }
  /**
   * Get the bounds of a custom layer (for zoom-to-layer).
   * @param layerId The layer ID
   * @returns The bounds [west, south, east, north] or null if not available
   */
  getBounds(layerId) {
    const adapter = this.getAdapterForLayer(layerId);
    if (adapter && adapter.getBounds) {
      return adapter.getBounds(layerId);
    }
    return null;
  }
  /**
   * Get native MapLibre layer IDs for a custom layer.
   * @param layerId The custom layer ID
   * @returns Array of native layer IDs, or null if not available
   */
  getNativeLayerIds(layerId) {
    const adapter = this.getAdapterForLayer(layerId);
    if (adapter && adapter.getNativeLayerIds) {
      return adapter.getNativeLayerIds(layerId);
    }
    return null;
  }
  /**
   * Remove a custom layer through its adapter.
   * @param layerId The layer ID to remove
   * @returns true if the operation was handled by an adapter
   */
  removeLayer(layerId) {
    const adapter = this.getAdapterForLayer(layerId);
    if (adapter && adapter.removeLayer) {
      adapter.removeLayer(layerId);
      return true;
    }
    return false;
  }
  /**
   * Get the layer groups of every adapter. When two adapters define the same
   * group ID, the first registered adapter's group wins.
   * @returns The groups, in adapter order
   */
  getGroups() {
    const groups = [];
    const seen = /* @__PURE__ */ new Set();
    this.adapters.forEach((adapter) => {
      var _a;
      for (const group of ((_a = adapter.getGroups) == null ? void 0 : _a.call(adapter)) ?? []) {
        if (seen.has(group.id)) continue;
        seen.add(group.id);
        groups.push(group);
      }
    });
    return groups;
  }
  /**
   * Get the ID of the group a custom layer belongs to.
   * @param layerId The layer ID
   * @returns The group ID, or undefined when the layer is ungrouped
   */
  getLayerGroupId(layerId) {
    var _a;
    const adapter = this.getAdapterForLayer(layerId);
    return (_a = adapter == null ? void 0 : adapter.getLayerGroupId) == null ? void 0 : _a.call(adapter, layerId);
  }
  /**
   * Get the adapter that defines a group.
   * @param groupId The group ID
   * @returns The adapter or null if no adapter defines the group
   */
  getAdapterForGroup(groupId) {
    var _a;
    for (const adapter of this.adapters.values()) {
      if ((_a = adapter.getGroups) == null ? void 0 : _a.call(adapter).some((group) => group.id === groupId)) {
        return adapter;
      }
    }
    return null;
  }
  /**
   * Set visibility of a group.
   * @param groupId The group ID
   * @param visible Whether the group should be visible
   * @returns true if the operation was handled by an adapter
   */
  setGroupVisibility(groupId, visible) {
    const adapter = this.getAdapterForGroup(groupId);
    if (adapter == null ? void 0 : adapter.setGroupVisibility) {
      adapter.setGroupVisibility(groupId, visible);
      return true;
    }
    return false;
  }
  /**
   * Set opacity of a group.
   * @param groupId The group ID
   * @param opacity The opacity value (0-1)
   * @returns true if the operation was handled by an adapter
   */
  setGroupOpacity(groupId, opacity) {
    const adapter = this.getAdapterForGroup(groupId);
    if (adapter == null ? void 0 : adapter.setGroupOpacity) {
      adapter.setGroupOpacity(groupId, opacity);
      return true;
    }
    return false;
  }
  /**
   * Record that a group was collapsed or expanded.
   * @param groupId The group ID
   * @param collapsed Whether the group is now collapsed
   * @returns true if the operation was handled by an adapter
   */
  setGroupCollapsed(groupId, collapsed) {
    const adapter = this.getAdapterForGroup(groupId);
    if (adapter == null ? void 0 : adapter.setGroupCollapsed) {
      adapter.setGroupCollapsed(groupId, collapsed);
      return true;
    }
    return false;
  }
  /**
   * Subscribe to layer changes across all adapters.
   * @param callback Function called when layers are added or removed
   * @returns Unsubscribe function
   */
  onChange(callback) {
    this.changeListeners.push(callback);
    return () => {
      const idx = this.changeListeners.indexOf(callback);
      if (idx >= 0) {
        this.changeListeners.splice(idx, 1);
      }
    };
  }
  notifyChange(event, layerId) {
    this.changeListeners.forEach((cb) => cb(event, layerId));
  }
  /**
   * Clean up all subscriptions and adapters.
   */
  destroy() {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers.clear();
    this.adapters.clear();
    this.changeListeners = [];
  }
}
function getOpacityProperty(layerType) {
  switch (layerType) {
    case "fill":
      return "fill-opacity";
    case "line":
      return "line-opacity";
    case "circle":
      return "circle-opacity";
    case "symbol":
      return ["icon-opacity", "text-opacity"];
    case "raster":
      return "raster-opacity";
    case "background":
      return "background-opacity";
    case "heatmap":
      return "heatmap-opacity";
    case "fill-extrusion":
      return "fill-extrusion-opacity";
    case "hillshade":
      return "hillshade-exaggeration";
    case "color-relief":
      return null;
    default:
      return `${layerType}-opacity`;
  }
}
function getLayerOpacity(map, layerId, layerType) {
  const opacityProp = getOpacityProperty(layerType);
  if (opacityProp === null) {
    return 1;
  }
  if (Array.isArray(opacityProp)) {
    const opacity2 = map.getPaintProperty(layerId, opacityProp[0]);
    return opacity2 !== void 0 && opacity2 !== null ? opacity2 : 1;
  }
  const opacity = map.getPaintProperty(layerId, opacityProp);
  return opacity !== void 0 && opacity !== null ? opacity : 1;
}
function setLayerOpacity(map, layerId, layerType, opacity) {
  const opacityProp = getOpacityProperty(layerType);
  if (opacityProp === null) {
    return;
  }
  if (Array.isArray(opacityProp)) {
    opacityProp.forEach((prop) => {
      map.setPaintProperty(layerId, prop, opacity);
    });
  } else {
    map.setPaintProperty(layerId, opacityProp, opacity);
  }
}
function isStyleableLayerType(layerType) {
  return [
    "fill",
    "line",
    "circle",
    "symbol",
    "raster",
    "heatmap",
    "fill-extrusion",
    "hillshade"
  ].includes(layerType);
}
function getLayerType(map, layerId) {
  try {
    const layer = map.getLayer(layerId);
    return layer ? layer.type : null;
  } catch (error) {
    console.warn(`Failed to get layer type for ${layerId}:`, error);
    return null;
  }
}
function clonePaintValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => clonePaintValue(item));
  }
  if (value && typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }
  return value;
}
function cacheOriginalLayerStyle(map, layerId, originalStyles) {
  var _a;
  if (originalStyles.has(layerId)) {
    return;
  }
  try {
    const layer = map.getLayer(layerId);
    if (!layer) {
      return;
    }
    const paint = {};
    const style = map.getStyle();
    const layerDef = (_a = style.layers) == null ? void 0 : _a.find((l) => l.id === layerId);
    if (layer.type === "raster") {
      const rasterDefaults = {
        "raster-opacity": 1,
        "raster-brightness-min": 0,
        "raster-brightness-max": 1,
        "raster-saturation": 0,
        "raster-contrast": 0,
        "raster-hue-rotate": 0
      };
      Object.assign(paint, rasterDefaults);
      if (layerDef && "paint" in layerDef && layerDef.paint) {
        Object.entries(layerDef.paint).forEach(([prop, value]) => {
          if (prop.startsWith("raster-")) {
            paint[prop] = clonePaintValue(value);
          }
        });
      }
    } else {
      if (layerDef && "paint" in layerDef && layerDef.paint) {
        Object.entries(layerDef.paint).forEach(([prop, value]) => {
          paint[prop] = clonePaintValue(value);
        });
      }
    }
    originalStyles.set(layerId, { paint });
  } catch (error) {
    console.warn(`Failed to cache original style for ${layerId}:`, error);
  }
}
function restoreOriginalStyle(map, layerId, originalStyles) {
  const original = originalStyles.get(layerId);
  if (!original) {
    return {};
  }
  const applied = {};
  Object.entries(original.paint).forEach(([property, value]) => {
    try {
      const restoredValue = clonePaintValue(value);
      map.setPaintProperty(layerId, property, restoredValue);
      applied[property] = restoredValue;
    } catch (error) {
      console.warn(`Failed to restore ${property} for ${layerId}:`, error);
    }
  });
  return applied;
}
function rgbToHex(r, g, b) {
  const clamp2 = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v) => {
    const hex = clamp2(v).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function normalizeColor(value) {
  if (typeof value === "string") {
    if (value.startsWith("#")) {
      if (value.length === 4) {
        const r = value[1];
        const g = value[2];
        const b = value[3];
        return `#${r}${r}${g}${g}${b}${b}`;
      }
      return value;
    }
    if (value.startsWith("rgb")) {
      const match = value.match(/\d+/g);
      if (match && match.length >= 3) {
        const [r, g, b] = match.map((num) => parseInt(num, 10));
        return rgbToHex(r, g, b);
      }
    }
  } else if (Array.isArray(value) && value.length >= 3) {
    return rgbToHex(value[0], value[1], value[2]);
  }
  return "#3388ff";
}
function formatNumericValue(value, step) {
  let decimals = 0;
  if (step && Number(step) !== 1) {
    const stepNumber = Number(step);
    if (stepNumber > 0 && stepNumber < 1) {
      decimals = Math.min(4, Math.ceil(Math.abs(Math.log10(stepNumber))));
    }
  }
  return value.toFixed(decimals);
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
const COLOR_PROPERTY_MAP = {
  fill: ["fill-color", "fill-outline-color"],
  line: ["line-color"],
  circle: ["circle-color", "circle-stroke-color"],
  symbol: ["icon-color", "text-color"],
  background: ["background-color"],
  heatmap: ["heatmap-color"],
  "fill-extrusion": ["fill-extrusion-color"]
};
function extractColorFromExpression(expression) {
  if (!Array.isArray(expression) || expression.length === 0) return null;
  for (const item of expression) {
    if (typeof item === "string") {
      if (item.startsWith("#") || item.startsWith("rgb") || item.startsWith("hsl")) {
        return normalizeColor(item);
      }
    } else if (Array.isArray(item)) {
      const result = extractColorFromExpression(item);
      if (result) return result;
    }
  }
  return null;
}
function getLayerColor(map, layerId, layerType) {
  var _a;
  const propertyNames = COLOR_PROPERTY_MAP[layerType];
  if (!propertyNames) return null;
  for (const propertyName of propertyNames) {
    try {
      const runtimeColor = map.getPaintProperty(layerId, propertyName);
      if (runtimeColor) {
        if (typeof runtimeColor === "string") {
          return normalizeColor(runtimeColor);
        }
        if (Array.isArray(runtimeColor)) {
          const extracted = extractColorFromExpression(runtimeColor);
          if (extracted) return extracted;
        }
      }
    } catch {
    }
    const style = map.getStyle();
    const layer = (_a = style == null ? void 0 : style.layers) == null ? void 0 : _a.find(
      (l) => l.id === layerId
    );
    if (layer && "paint" in layer && layer.paint) {
      const paintColor = layer.paint[propertyName];
      if (paintColor) {
        if (typeof paintColor === "string") {
          return normalizeColor(paintColor);
        }
        if (Array.isArray(paintColor)) {
          const extracted = extractColorFromExpression(paintColor);
          if (extracted) return extracted;
        }
      }
    }
  }
  return null;
}
function getLayerColorFromSpec(layer) {
  const propertyNames = COLOR_PROPERTY_MAP[layer.type];
  if (!propertyNames) return null;
  for (const propertyName of propertyNames) {
    if ("paint" in layer && layer.paint) {
      const paintColor = layer.paint[propertyName];
      if (paintColor) {
        if (typeof paintColor === "string") {
          return normalizeColor(paintColor);
        }
        if (Array.isArray(paintColor)) {
          const extracted = extractColorFromExpression(paintColor);
          if (extracted) return extracted;
        }
      }
    }
  }
  return null;
}
function darkenColor(hexColor, amount) {
  let hex = hexColor.replace("#", "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = Math.max(
    0,
    parseInt(hex.slice(0, 2), 16) - Math.round(255 * amount)
  );
  const g = Math.max(
    0,
    parseInt(hex.slice(2, 4), 16) - Math.round(255 * amount)
  );
  const b = Math.max(
    0,
    parseInt(hex.slice(4, 6), 16) - Math.round(255 * amount)
  );
  return rgbToHex(r, g, b);
}
function createFillSymbol(size, color) {
  const padding = 2;
  const borderColor = darkenColor(color, 0.3);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}"
          fill="${color}" stroke="${borderColor}" stroke-width="1" rx="1"/>
  </svg>`;
}
function createLineSymbol(size, color, strokeWidth = 2) {
  const y = size / 2;
  const padding = 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${padding}" y1="${y}" x2="${size - padding}" y2="${y}"
          stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
  </svg>`;
}
function createCircleSymbol(size, color) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;
  const borderColor = darkenColor(color, 0.3);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"
            stroke="${borderColor}" stroke-width="1"/>
  </svg>`;
}
function createMarkerSymbol(size, color) {
  const borderColor = darkenColor(color, 0.3);
  const cx = size / 2;
  const pinWidth = size * 0.5;
  const pinHeight = size * 0.7;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <path d="M${cx} ${size - 2}
             L${cx - pinWidth / 2} ${size - pinHeight}
             A${pinWidth / 2} ${pinWidth / 2} 0 1 1 ${cx + pinWidth / 2} ${size - pinHeight}
             Z"
          fill="${color}" stroke="${borderColor}" stroke-width="1"/>
    <circle cx="${cx}" cy="${size - pinHeight - pinWidth / 4}" r="${pinWidth / 5}" fill="white"/>
  </svg>`;
}
function createRasterSymbol(size) {
  const padding = 2;
  const id = `rasterGrad_${Math.random().toString(36).slice(2, 9)}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e0e0e0"/>
        <stop offset="50%" stop-color="#808080"/>
        <stop offset="100%" stop-color="#404040"/>
      </linearGradient>
    </defs>
    <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}"
          fill="url(#${id})" rx="1"/>
  </svg>`;
}
function createBackgroundSymbol(size, color) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="${size - 2}" height="${size - 2}" fill="${color}" rx="2"/>
    <rect x="3" y="3" width="${size - 6}" height="${size - 6}" fill="none"
          stroke="white" stroke-width="1" stroke-opacity="0.5" rx="1"/>
  </svg>`;
}
function createHeatmapSymbol(size) {
  const padding = 2;
  const id = `heatmapGrad_${Math.random().toString(36).slice(2, 9)}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="${id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffff00"/>
        <stop offset="50%" stop-color="#ff8800"/>
        <stop offset="100%" stop-color="#ff0000"/>
      </radialGradient>
    </defs>
    <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}"
          fill="url(#${id})" rx="1"/>
  </svg>`;
}
function createHillshadeSymbol(size) {
  const padding = 2;
  const id = `hillshadeGrad_${Math.random().toString(36).slice(2, 9)}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#666666"/>
      </linearGradient>
    </defs>
    <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}"
          fill="url(#${id})" rx="1"/>
  </svg>`;
}
function createFillExtrusionSymbol(size, color) {
  const borderColor = darkenColor(color, 0.3);
  const topColor = color;
  const sideColor = darkenColor(color, 0.2);
  const depth = 3;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${2 + depth},2 ${size - 2},2 ${size - 2},${size - 2 - depth} ${size - 2 - depth},${size - 2} 2,${size - 2} 2,${2 + depth}"
             fill="${topColor}" stroke="${borderColor}" stroke-width="1"/>
    <polygon points="2,${2 + depth} ${2 + depth},2 ${2 + depth},${size - 2 - depth} 2,${size - 2}"
             fill="${sideColor}" stroke="${borderColor}" stroke-width="0.5"/>
    <polygon points="${2 + depth},${size - 2 - depth} ${size - 2},${size - 2 - depth} ${size - 2 - depth},${size - 2} 2,${size - 2}"
             fill="${sideColor}" stroke="${borderColor}" stroke-width="0.5"/>
  </svg>`;
}
function createDefaultSymbol(size, color) {
  const padding = 2;
  const borderColor = darkenColor(color, 0.3);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}"
          fill="${color}" stroke="${borderColor}" stroke-width="1"/>
  </svg>`;
}
function createCOGSymbol(size, color) {
  const padding = 2;
  const borderColor = darkenColor(color, 0.3);
  const cellSize = (size - padding * 2) / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${padding}" y="${padding}" width="${cellSize}" height="${cellSize}" fill="${color}" stroke="${borderColor}" stroke-width="0.5"/>
    <rect x="${padding + cellSize}" y="${padding}" width="${cellSize}" height="${cellSize}" fill="${color}" stroke="${borderColor}" stroke-width="0.5" opacity="0.8"/>
    <rect x="${padding}" y="${padding + cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}" stroke="${borderColor}" stroke-width="0.5" opacity="0.6"/>
    <rect x="${padding + cellSize}" y="${padding + cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}" stroke="${borderColor}" stroke-width="0.5" opacity="0.4"/>
  </svg>`;
}
function createZarrSymbol(size, color) {
  const padding = 2;
  const borderColor = darkenColor(color, 0.3);
  const innerSize = size - padding * 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${padding + 2}" y="${padding}" width="${innerSize - 2}" height="${innerSize - 2}" fill="${darkenColor(color, 0.2)}" stroke="${borderColor}" stroke-width="0.5" rx="1"/>
    <rect x="${padding + 1}" y="${padding + 1}" width="${innerSize - 2}" height="${innerSize - 2}" fill="${darkenColor(color, 0.1)}" stroke="${borderColor}" stroke-width="0.5" rx="1"/>
    <rect x="${padding}" y="${padding + 2}" width="${innerSize - 2}" height="${innerSize - 2}" fill="${color}" stroke="${borderColor}" stroke-width="0.5" rx="1"/>
    <line x1="${padding + 3}" y1="${padding + 5}" x2="${padding + innerSize - 5}" y2="${padding + 5}" stroke="${borderColor}" stroke-width="0.5" opacity="0.5"/>
    <line x1="${padding + 3}" y1="${padding + 8}" x2="${padding + innerSize - 5}" y2="${padding + 8}" stroke="${borderColor}" stroke-width="0.5" opacity="0.5"/>
  </svg>`;
}
function createCustomRasterSymbol(size, color) {
  const padding = 2;
  const borderColor = darkenColor(color, 0.3);
  const id = `customRasterGrad_${Math.random().toString(36).slice(2, 9)}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color}"/>
        <stop offset="100%" stop-color="${darkenColor(color, 0.4)}"/>
      </linearGradient>
    </defs>
    <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}"
          fill="url(#${id})" stroke="${borderColor}" stroke-width="1" rx="1"/>
    <line x1="${size / 2}" y1="${padding}" x2="${size / 2}" y2="${size - padding}" stroke="${borderColor}" stroke-width="0.5" opacity="0.3"/>
    <line x1="${padding}" y1="${size / 2}" x2="${size - padding}" y2="${size / 2}" stroke="${borderColor}" stroke-width="0.5" opacity="0.3"/>
  </svg>`;
}
function createStackedLayersSymbol(size) {
  const colors = ["#a8d4a8", "#8ec4e8", "#d4c4a8"];
  const borderColor = "#666666";
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="1" width="${size - 6}" height="${size - 6}" fill="${colors[2]}" stroke="${borderColor}" stroke-width="0.75" rx="1"/>
    <rect x="2" y="3" width="${size - 6}" height="${size - 6}" fill="${colors[1]}" stroke="${borderColor}" stroke-width="0.75" rx="1"/>
    <rect x="0" y="5" width="${size - 6}" height="${size - 6}" fill="${colors[0]}" stroke="${borderColor}" stroke-width="0.75" rx="1"/>
  </svg>`;
}
function createLayerSymbolSVG(layerType, color, options = {}) {
  const size = options.size || 16;
  const strokeWidth = options.strokeWidth || 2;
  const fillColor = color || "#888888";
  switch (layerType) {
    case "fill":
      return createFillSymbol(size, fillColor);
    case "line":
      return createLineSymbol(size, fillColor, strokeWidth);
    case "circle":
      return createCircleSymbol(size, fillColor);
    case "symbol":
      return createMarkerSymbol(size, fillColor);
    case "raster":
      return createRasterSymbol(size);
    case "background":
      return createBackgroundSymbol(size, fillColor);
    case "heatmap":
      return createHeatmapSymbol(size);
    case "hillshade":
      return createHillshadeSymbol(size);
    case "fill-extrusion":
      return createFillExtrusionSymbol(size, fillColor);
    case "background-group":
      return createStackedLayersSymbol(size);
    case "cog":
      return createCOGSymbol(size, fillColor);
    case "zarr":
      return createZarrSymbol(size, fillColor);
    case "custom-raster":
      return createCustomRasterSymbol(size, fillColor);
    default:
      return createDefaultSymbol(size, fillColor);
  }
}
function createBackgroundGroupSymbolSVG(size = 16) {
  return createStackedLayersSymbol(size);
}
class LayerControl {
  constructor(options = {}) {
    __publicField(this, "map");
    __publicField(this, "mapContainer");
    __publicField(this, "container");
    __publicField(this, "button");
    __publicField(this, "panel");
    // Panel positioning
    __publicField(this, "resizeHandler", null);
    __publicField(this, "mapResizeHandler", null);
    // State management
    __publicField(this, "state");
    __publicField(this, "targetLayers");
    __publicField(this, "styleEditors");
    __publicField(this, "initialSourceIds", null);
    __publicField(this, "initialLayerIds", null);
    __publicField(this, "initialLayerStates");
    // Panel width management
    __publicField(this, "minPanelWidth");
    __publicField(this, "maxPanelWidth");
    __publicField(this, "initialPanelWidth");
    /** Explicit max panel height; null means fill available vertical space */
    __publicField(this, "maxPanelHeight");
    __publicField(this, "showStyleEditor");
    __publicField(this, "showOpacitySlider");
    __publicField(this, "showLayerSymbol");
    __publicField(this, "excludeDrawnLayers");
    __publicField(this, "excludeLayerPatterns");
    __publicField(this, "customLayerRegistry", null);
    __publicField(this, "customLayerUnsubscribe", null);
    __publicField(this, "removedCustomLayerIds", /* @__PURE__ */ new Set());
    __publicField(this, "nativeLayerGroups", /* @__PURE__ */ new Map());
    /** Layer groups from the custom layer adapters, as of the last panel build */
    __publicField(this, "groupStates", /* @__PURE__ */ new Map());
    /** Group IDs, parents, and memberships the panel was last built from */
    __publicField(this, "groupStructureKey", "");
    __publicField(this, "basemapStyleUrl", null);
    __publicField(this, "basemapLayerIds", null);
    __publicField(this, "widthFrame", null);
    // Exact-opacity input popup
    __publicField(this, "opacityInputEl", null);
    // Panel edge-drag resizing (handles on both the left and right edges)
    __publicField(this, "resizeHandleEls", []);
    /** Which edge is anchored to the control corner (the other edge is "free") */
    __publicField(this, "panelAnchorSide", "right");
    __publicField(this, "isPanelResizing", false);
    /** The physical edge being dragged in the current resize gesture */
    __publicField(this, "panelResizeEdge", "left");
    __publicField(this, "panelResizeStartX", null);
    __publicField(this, "panelResizeStartWidth", null);
    __publicField(this, "panelResizeStartOffset", 0);
    // Context menu and drag-drop
    __publicField(this, "contextMenuEl", null);
    __publicField(this, "enableContextMenu");
    __publicField(this, "enableDragAndDrop");
    __publicField(this, "onLayerRename");
    __publicField(this, "onLayerReorder");
    __publicField(this, "onLayerRemove");
    __publicField(this, "onLayerStyleChange");
    __publicField(this, "onBackgroundVisibilityChange");
    __publicField(this, "onBackgroundOpacityChange");
    // Background-layer visibility presets
    __publicField(this, "enableBackgroundPresets");
    __publicField(this, "backgroundPresetStorageKey");
    __publicField(this, "onBackgroundPresetsChange");
    this.minPanelWidth = options.panelMinWidth || 240;
    this.maxPanelWidth = options.panelMaxWidth || 960;
    this.initialPanelWidth = options.panelWidth || 350;
    this.maxPanelHeight = options.panelMaxHeight ?? null;
    this.showStyleEditor = options.showStyleEditor !== false;
    this.showOpacitySlider = options.showOpacitySlider !== false;
    this.showLayerSymbol = options.showLayerSymbol !== false;
    this.excludeDrawnLayers = options.excludeDrawnLayers !== false;
    this.excludeLayerPatterns = this.wildcardPatternsToRegex(
      options.excludeLayers || []
    );
    this.enableContextMenu = options.enableContextMenu !== false;
    this.enableDragAndDrop = options.enableDragAndDrop !== false;
    this.onLayerRename = options.onLayerRename;
    this.onLayerReorder = options.onLayerReorder;
    this.onLayerRemove = options.onLayerRemove;
    this.onLayerStyleChange = options.onLayerStyleChange;
    this.onBackgroundVisibilityChange = options.onBackgroundVisibilityChange;
    this.onBackgroundOpacityChange = options.onBackgroundOpacityChange;
    this.enableBackgroundPresets = options.enableBackgroundPresets !== false;
    this.backgroundPresetStorageKey = options.backgroundPresetStorageKey || "maplibre-layer-control:background-presets";
    this.onBackgroundPresetsChange = options.onBackgroundPresetsChange;
    this.initialLayerStates = options.layerStates || {};
    this.state = {
      collapsed: options.collapsed !== false,
      panelWidth: options.panelWidth || 350,
      activeStyleEditor: null,
      layerStates: {},
      originalStyles: /* @__PURE__ */ new Map(),
      userInteractingWithSlider: false,
      backgroundLegendOpen: false,
      backgroundLayerVisibility: /* @__PURE__ */ new Map(),
      onlyRenderedFilter: false,
      contextMenu: {
        visible: false,
        targetLayerId: null,
        x: 0,
        y: 0
      },
      renamingLayerId: null,
      customLayerNames: /* @__PURE__ */ new Map(),
      drag: {
        active: false,
        layerId: null,
        startY: 0,
        currentY: 0,
        placeholder: null,
        draggedElement: null
      },
      isStyleOperationInProgress: false
    };
    this.targetLayers = options.layers || Object.keys(this.initialLayerStates);
    this.styleEditors = /* @__PURE__ */ new Map();
    if (options.customLayerAdapters && options.customLayerAdapters.length > 0) {
      this.customLayerRegistry = new CustomLayerRegistry();
      options.customLayerAdapters.forEach((adapter) => {
        this.customLayerRegistry.register(adapter);
      });
    }
    this.basemapStyleUrl = options.basemapStyleUrl || null;
  }
  /**
   * Called when the control is added to the map
   */
  onAdd(map) {
    this.map = map;
    this.mapContainer = map.getContainer();
    const style = this.map.getStyle();
    if (style && style.sources) {
      this.initialSourceIds = new Set(Object.keys(style.sources));
    } else {
      this.initialSourceIds = /* @__PURE__ */ new Set();
    }
    if (style && style.layers) {
      this.initialLayerIds = new Set(style.layers.map((layer) => layer.id));
    } else {
      this.initialLayerIds = /* @__PURE__ */ new Set();
    }
    this.container = this.createContainer();
    this.button = this.createToggleButton();
    this.panel = this.createPanel();
    this.container.appendChild(this.button);
    this.mapContainer.appendChild(this.panel);
    if (this.enableContextMenu) {
      this.contextMenuEl = this.createContextMenu();
      this.mapContainer.appendChild(this.contextMenuEl);
    }
    this.setupEventListeners();
    if (this.basemapStyleUrl && !this.basemapLayerIds) {
      this.fetchBasemapStyle().then(() => {
        if (Object.keys(this.state.layerStates).length === 0) {
          this.autoDetectLayers();
        }
        this.buildLayerItems();
      }).catch((error) => {
        console.warn(
          "Failed to fetch basemap style, falling back to heuristic detection:",
          error
        );
        if (Object.keys(this.state.layerStates).length === 0) {
          this.autoDetectLayers();
        }
        this.buildLayerItems();
      });
    } else {
      if (Object.keys(this.state.layerStates).length === 0) {
        this.autoDetectLayers();
      }
      this.buildLayerItems();
    }
    if (!this.state.collapsed) {
      requestAnimationFrame(() => {
        this.updatePanelPosition();
      });
    }
    return this.container;
  }
  /**
   * Fetch the basemap style JSON and extract layer IDs.
   * This provides reliable distinction between basemap and user-added layers.
   */
  async fetchBasemapStyle() {
    if (!this.basemapStyleUrl) return;
    try {
      const response = await fetch(this.basemapStyleUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const styleJson = await response.json();
      if (styleJson && Array.isArray(styleJson.layers)) {
        this.basemapLayerIds = new Set(
          styleJson.layers.map((layer) => layer.id)
        );
      } else {
        this.basemapLayerIds = /* @__PURE__ */ new Set();
      }
    } catch (error) {
      console.warn(
        "Failed to fetch basemap style from URL:",
        this.basemapStyleUrl,
        error
      );
      throw error;
    }
  }
  /**
   * Called when the control is removed from the map
   */
  onRemove() {
    var _a, _b, _c;
    if (this.customLayerUnsubscribe) {
      this.customLayerUnsubscribe();
      this.customLayerUnsubscribe = null;
    }
    if (this.customLayerRegistry) {
      this.customLayerRegistry.destroy();
      this.customLayerRegistry = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    if (this.mapResizeHandler) {
      this.map.off("resize", this.mapResizeHandler);
      this.mapResizeHandler = null;
    }
    if (this.contextMenuEl) {
      (_a = this.contextMenuEl.parentNode) == null ? void 0 : _a.removeChild(this.contextMenuEl);
      this.contextMenuEl = null;
    }
    this.hideOpacityInput();
    this.cleanupDragState();
    (_b = this.panel.parentNode) == null ? void 0 : _b.removeChild(this.panel);
    (_c = this.container.parentNode) == null ? void 0 : _c.removeChild(this.container);
  }
  /**
   * Auto-detect layers from the map and populate layerStates
   */
  autoDetectLayers() {
    const style = this.map.getStyle();
    if (!style || !style.layers) {
      return;
    }
    const allLayerIds = style.layers.map((layer) => layer.id);
    if (this.targetLayers.length === 0) {
      const userAddedLayers = [];
      const backgroundLayerIds = [];
      const useBasemapStyleDetection = this.basemapLayerIds !== null && this.basemapLayerIds.size > 0;
      const userAddedSourceIds = useBasemapStyleDetection ? /* @__PURE__ */ new Set() : this.detectUserAddedSources();
      allLayerIds.forEach((layerId) => {
        const layer = this.map.getLayer(layerId);
        if (!layer) return;
        if (this.excludeDrawnLayers && this.isDrawnLayer(layerId)) {
          backgroundLayerIds.push(layerId);
          return;
        }
        if (this.isExcludedByPattern(layerId)) {
          backgroundLayerIds.push(layerId);
          return;
        }
        if (useBasemapStyleDetection) {
          if (this.basemapLayerIds.has(layerId)) {
            backgroundLayerIds.push(layerId);
          } else {
            userAddedLayers.push(layerId);
          }
        } else {
          const sourceId = layer.source;
          if (sourceId && userAddedSourceIds.has(sourceId)) {
            userAddedLayers.push(layerId);
          } else {
            backgroundLayerIds.push(layerId);
          }
        }
      });
      if (backgroundLayerIds.length > 0) {
        this.state.layerStates["Background"] = {
          visible: true,
          opacity: 1,
          name: "Background"
        };
      }
      userAddedLayers.forEach((layerId) => {
        const layer = this.map.getLayer(layerId);
        if (!layer) return;
        const visibility = this.map.getLayoutProperty(layerId, "visibility");
        const isVisible = visibility !== "none";
        const layerType = layer.type;
        const opacity = getLayerOpacity(this.map, layerId, layerType);
        const friendlyName = this.generateFriendlyName(layerId);
        this.state.layerStates[layerId] = this.mergeWithUserState(layerId, {
          visible: isVisible,
          opacity,
          name: friendlyName
        });
      });
    } else {
      const userLayers = [];
      const basemapLayers = [];
      allLayerIds.forEach((layerId) => {
        if (this.isExcludedByPattern(layerId)) {
          basemapLayers.push(layerId);
          return;
        }
        if (this.targetLayers.includes(layerId)) {
          userLayers.push(layerId);
        } else {
          basemapLayers.push(layerId);
        }
      });
      if (basemapLayers.length > 0) {
        this.state.layerStates["Background"] = {
          visible: true,
          opacity: 1,
          name: "Background"
        };
      }
      userLayers.forEach((layerId) => {
        const layer = this.map.getLayer(layerId);
        if (!layer) return;
        const visibility = this.map.getLayoutProperty(layerId, "visibility");
        const isVisible = visibility !== "none";
        const layerType = layer.type;
        const opacity = getLayerOpacity(this.map, layerId, layerType);
        const friendlyName = this.generateFriendlyName(layerId);
        this.state.layerStates[layerId] = this.mergeWithUserState(layerId, {
          visible: isVisible,
          opacity,
          name: friendlyName
        });
      });
    }
    if (this.customLayerRegistry) {
      const customLayerIds = this.customLayerRegistry.getAllLayerIds();
      customLayerIds.forEach((layerId) => {
        if (this.state.layerStates[layerId]) return;
        const customState = this.customLayerRegistry.getLayerState(layerId);
        if (customState) {
          this.state.layerStates[layerId] = {
            visible: customState.visible,
            opacity: customState.opacity,
            name: customState.name,
            isCustomLayer: true,
            customLayerType: this.customLayerRegistry.getSymbolType(layerId) || void 0
          };
        }
      });
    }
    this.targetLayers = Object.keys(this.state.layerStates);
  }
  /**
   * Detect which sources are user-added (not from the basemap style)
   * User-added sources are identified by:
   * - Sources that were NOT present when the control was first added
   * - Additionally for sources added later:
   *   - GeoJSON sources with inline data objects (not URL strings)
   *   - Image, video, canvas sources
   *   - Raster, raster-dem, vector sources from non-basemap tile providers
   */
  detectUserAddedSources() {
    const userAddedSources = /* @__PURE__ */ new Set();
    const style = this.map.getStyle();
    if (!style || !style.sources) return userAddedSources;
    const basemapDomains = /* @__PURE__ */ new Set();
    const knownBasemapProviders = [
      "demotiles.maplibre.org",
      "api.maptiler.com",
      "tiles.stadiamaps.com",
      "api.mapbox.com",
      "basemaps.cartocdn.com",
      "tiles.mapbox.com",
      "a.basemaps.cartocdn.com",
      "b.basemaps.cartocdn.com",
      "c.basemaps.cartocdn.com",
      "d.basemaps.cartocdn.com",
      "tiles.arcgis.com",
      "server.arcgisonline.com",
      "services.arcgisonline.com"
    ];
    const spriteUrl = style.sprite;
    if (spriteUrl && typeof spriteUrl === "string") {
      try {
        const url = new URL(spriteUrl);
        basemapDomains.add(url.hostname);
      } catch {
      }
    }
    if (style.glyphs) {
      try {
        const url = new URL(
          style.glyphs.replace("{fontstack}", "x").replace("{range}", "x")
        );
        basemapDomains.add(url.hostname);
      } catch {
      }
    }
    for (const [sourceId, source] of Object.entries(style.sources)) {
      if (this.initialSourceIds && this.initialSourceIds.has(sourceId)) {
        continue;
      }
      const src = source;
      const sourceType = src.type;
      if (sourceType === "image" || sourceType === "video" || sourceType === "canvas") {
        userAddedSources.add(sourceId);
        continue;
      }
      if (sourceType === "geojson") {
        if (src.data && typeof src.data === "object") {
          userAddedSources.add(sourceId);
        } else if (src.data && typeof src.data === "string") {
          try {
            const url = new URL(src.data);
            const isBasemap = knownBasemapProviders.some((p) => url.hostname.includes(p)) || basemapDomains.has(url.hostname);
            if (!isBasemap) {
              userAddedSources.add(sourceId);
            }
          } catch {
            userAddedSources.add(sourceId);
          }
        }
        continue;
      }
      if (sourceType === "raster" || sourceType === "raster-dem" || sourceType === "vector") {
        const tileUrl = src.url || src.tiles && src.tiles[0] || "";
        if (tileUrl) {
          try {
            const url = new URL(tileUrl.replace(/{[^}]+}/g, "0"));
            const hostname = url.hostname;
            const isKnownBasemap = knownBasemapProviders.some(
              (provider) => hostname === provider || hostname.endsWith("." + provider)
            );
            const matchesBasemapDomain = basemapDomains.has(hostname);
            if (!isKnownBasemap && !matchesBasemapDomain) {
              userAddedSources.add(sourceId);
            }
          } catch {
            userAddedSources.add(sourceId);
          }
        }
      }
    }
    return userAddedSources;
  }
  /**
   * Generate a friendly display name from a layer ID
   */
  generateFriendlyName(layerId) {
    let name = layerId.replace(/^(layer[-_]?|gl[-_]?)/, "");
    name = name.replace(/[-_]/g, " ");
    name = name.replace(/\b\w/g, (char) => char.toUpperCase());
    return name || layerId;
  }
  /**
   * Merge auto-detected layer state with user-provided initial state.
   * User-provided values take precedence over detected values.
   */
  mergeWithUserState(layerId, detected) {
    const userState = this.initialLayerStates[layerId];
    if (!userState) return detected;
    return {
      visible: userState.visible ?? detected.visible,
      opacity: userState.opacity ?? detected.opacity,
      name: userState.name ?? detected.name,
      ...userState.isCustomLayer !== void 0 && {
        isCustomLayer: userState.isCustomLayer
      },
      ...userState.customLayerType !== void 0 && {
        customLayerType: userState.customLayerType
      }
    };
  }
  /**
   * Check if a layer ID belongs to a drawing library (Geoman, Mapbox GL Draw, etc.)
   * @param layerId The layer ID to check
   * @returns true if the layer is from a drawing library
   */
  isDrawnLayer(layerId) {
    const drawnLayerPatterns = [
      // Drawing libraries
      /^gm[-_\s]/i,
      // Geoman (gm-main-*, gm_*, Gm Temporary...)
      /^gl-draw[-_]/i,
      // Mapbox GL Draw
      /^mapbox-gl-draw[-_]/i,
      // Mapbox GL Draw alternative
      /^terra-draw[-_]/i,
      // Terra Draw
      /^maplibre-gl-draw[-_]/i,
      // MapLibre GL Draw
      /^draw[-_]layer/i,
      // Generic draw layers
      // maplibre-gl-components internal layers
      /^measure-/i,
      // MeasureControl (measure-{id}-fill, measure-{id}-line)
      /^pmtiles-source-/i,
      // PMTilesLayerControl (managed via adapter)
      /^stac-search-footprints/i
      // StacSearchControl footprint layers
    ];
    return drawnLayerPatterns.some((pattern) => pattern.test(layerId));
  }
  /**
   * Convert wildcard patterns (e.g., '*-temp-*', 'debug-*') to RegExp objects
   */
  wildcardPatternsToRegex(patterns) {
    return patterns.map((pattern) => {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      const regexStr = escaped.replace(/\*/g, ".*");
      return new RegExp(`^${regexStr}$`, "i");
    });
  }
  /**
   * Check if a layer matches any of the user-defined exclusion patterns
   */
  isExcludedByPattern(layerId) {
    return this.excludeLayerPatterns.some((pattern) => pattern.test(layerId));
  }
  /**
   * Create the main container element
   */
  createContainer() {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group maplibregl-ctrl-layer-control";
    return container;
  }
  /**
   * Create the toggle button
   */
  createToggleButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.title = "Layer Control";
    button.setAttribute("aria-label", "Layer Control");
    const icon = document.createElement("span");
    icon.className = "layer-control-icon";
    icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 3 8.25 12 13.5 21 8.25 12 3"></polygon><polyline points="3 12.75 12 18 21 12.75"></polyline><polyline points="3 17.25 12 22 21 17.25"></polyline></svg>';
    button.appendChild(icon);
    return button;
  }
  /**
   * Create the panel element
   */
  createPanel() {
    const panel = document.createElement("div");
    panel.className = "layer-control-panel";
    panel.style.width = `${this.state.panelWidth}px`;
    if (this.maxPanelHeight != null) {
      panel.style.maxHeight = `${this.maxPanelHeight}px`;
    }
    if (!this.state.collapsed) {
      panel.classList.add("expanded");
    }
    const header = this.createPanelHeader();
    panel.appendChild(header);
    const actionButtons = this.createActionButtons();
    panel.appendChild(actionButtons);
    panel.appendChild(this.createResizeHandle("left"));
    panel.appendChild(this.createResizeHandle("right"));
    return panel;
  }
  /**
   * Create a draggable edge handle for resizing the panel width. A handle is
   * added on each side so the panel can be resized by dragging either edge,
   * like a conventional resizable window.
   *
   * @param side Which physical edge of the panel the handle sits on
   */
  createResizeHandle(side) {
    const handle = document.createElement("div");
    handle.className = `layer-control-resize-handle layer-control-resize-handle-${side}`;
    handle.title = "Drag to resize panel";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    this.resizeHandleEls.push(handle);
    this.setupResizeHandleEvents(handle, side);
    return handle;
  }
  /**
   * Wire pointer events for an edge resize handle.
   *
   * @param handle The handle element
   * @param side Which physical edge of the panel the handle sits on
   */
  setupResizeHandleEvents(handle, side) {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.isPanelResizing = true;
      this.panelResizeEdge = side;
      this.panelResizeStartX = event.clientX;
      this.panelResizeStartWidth = this.state.panelWidth;
      this.panelResizeStartOffset = parseFloat(this.panel.style[this.panelAnchorSide]) || 0;
      handle.setPointerCapture(event.pointerId);
      this.panel.classList.add("resizing-active");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!this.isPanelResizing) return;
      this.resizePanelFromPointer(event.clientX);
    });
    const endResize = (event) => {
      if (!this.isPanelResizing) return;
      if (event.pointerId !== void 0) {
        try {
          handle.releasePointerCapture(event.pointerId);
        } catch {
        }
      }
      this.isPanelResizing = false;
      this.panelResizeStartX = null;
      this.panelResizeStartWidth = null;
      this.panel.classList.remove("resizing-active");
    };
    handle.addEventListener("pointerup", endResize);
    handle.addEventListener("pointercancel", endResize);
    handle.addEventListener("lostpointercapture", endResize);
    handle.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.applyPanelWidth(this.initialPanelWidth, true);
    });
  }
  /**
   * Compute and apply a new panel width from the pointer position during an
   * edge drag. Dragging the free edge changes the width while the anchored
   * edge stays put; dragging the anchored edge shifts the anchor so the free
   * edge stays put — both feel like resizing a normal window.
   */
  resizePanelFromPointer(clientX) {
    const dx = clientX - (this.panelResizeStartX ?? clientX);
    const startWidth = this.panelResizeStartWidth ?? this.state.panelWidth;
    const desiredWidth = this.panelResizeEdge === "left" ? startWidth - dx : startWidth + dx;
    const clamped = Math.round(
      Math.min(this.maxPanelWidth, Math.max(this.minPanelWidth, desiredWidth))
    );
    if (this.panelResizeEdge === this.panelAnchorSide) {
      let appliedDelta = clamped - startWidth;
      let newOffset = this.panelResizeStartOffset - appliedDelta;
      if (newOffset < 0) {
        newOffset = 0;
        appliedDelta = this.panelResizeStartOffset;
      }
      const finalWidth = Math.round(
        Math.min(
          this.maxPanelWidth,
          Math.max(this.minPanelWidth, startWidth + appliedDelta)
        )
      );
      this.applyPanelWidth(finalWidth, true);
      this.panel.style[this.panelAnchorSide] = `${newOffset}px`;
    } else {
      this.applyPanelWidth(clamped, true);
    }
  }
  /**
   * Record which panel edge is anchored to the control corner, based on the
   * corner the control occupies. Right corners anchor the right edge (panel
   * grows leftward); left corners anchor the left edge (panel grows rightward).
   */
  updatePanelAnchorSide(position) {
    this.panelAnchorSide = position === "top-right" || position === "bottom-right" ? "right" : "left";
  }
  /**
   * Detect which corner the control is positioned in
   * @returns The position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
   */
  getControlPosition() {
    const parent = this.container.parentElement;
    if (!parent) return "top-right";
    if (parent.classList.contains("maplibregl-ctrl-top-left"))
      return "top-left";
    if (parent.classList.contains("maplibregl-ctrl-top-right"))
      return "top-right";
    if (parent.classList.contains("maplibregl-ctrl-bottom-left"))
      return "bottom-left";
    if (parent.classList.contains("maplibregl-ctrl-bottom-right"))
      return "bottom-right";
    return "top-right";
  }
  /**
   * Update the panel position based on button location and control corner
   * Positions the panel next to the button, expanding in the appropriate direction
   */
  updatePanelPosition() {
    if (!this.button || !this.panel || !this.mapContainer) return;
    const buttonRect = this.button.getBoundingClientRect();
    const mapRect = this.mapContainer.getBoundingClientRect();
    const position = this.getControlPosition();
    this.updatePanelAnchorSide(position);
    const buttonTop = buttonRect.top - mapRect.top;
    const buttonBottom = mapRect.bottom - buttonRect.bottom;
    const buttonLeft = buttonRect.left - mapRect.left;
    const buttonRight = mapRect.right - buttonRect.right;
    const panelGap = 5;
    this.panel.style.top = "";
    this.panel.style.bottom = "";
    this.panel.style.left = "";
    this.panel.style.right = "";
    switch (position) {
      case "top-left":
        this.panel.style.top = `${buttonTop + buttonRect.height + panelGap}px`;
        this.panel.style.left = `${buttonLeft}px`;
        break;
      case "top-right":
        this.panel.style.top = `${buttonTop + buttonRect.height + panelGap}px`;
        this.panel.style.right = `${buttonRight}px`;
        break;
      case "bottom-left":
        this.panel.style.bottom = `${buttonBottom + buttonRect.height + panelGap}px`;
        this.panel.style.left = `${buttonLeft}px`;
        break;
      case "bottom-right":
        this.panel.style.bottom = `${buttonBottom + buttonRect.height + panelGap}px`;
        this.panel.style.right = `${buttonRight}px`;
        break;
    }
    const edgeMargin = 8;
    const isTopAnchored = position === "top-left" || position === "top-right";
    const occupiedFromEdge = isTopAnchored ? buttonTop + buttonRect.height + panelGap : buttonBottom + buttonRect.height + panelGap;
    const availableHeight = Math.max(
      120,
      Math.round(mapRect.height - occupiedFromEdge - edgeMargin)
    );
    const maxHeight = this.maxPanelHeight != null ? Math.min(this.maxPanelHeight, availableHeight) : availableHeight;
    this.panel.style.maxHeight = `${maxHeight}px`;
  }
  /**
   * Create action buttons for Show All / Hide All
   */
  createActionButtons() {
    const container = document.createElement("div");
    container.className = "layer-control-actions";
    const showAllBtn = document.createElement("button");
    showAllBtn.type = "button";
    showAllBtn.className = "layer-control-action-btn";
    showAllBtn.textContent = "Show All";
    showAllBtn.title = "Show all layers";
    showAllBtn.addEventListener(
      "click",
      () => this.setAllLayersVisibility(true)
    );
    const hideAllBtn = document.createElement("button");
    hideAllBtn.type = "button";
    hideAllBtn.className = "layer-control-action-btn";
    hideAllBtn.textContent = "Hide All";
    hideAllBtn.title = "Hide all layers";
    hideAllBtn.addEventListener(
      "click",
      () => this.setAllLayersVisibility(false)
    );
    container.appendChild(showAllBtn);
    container.appendChild(hideAllBtn);
    return container;
  }
  /**
   * Set visibility of all layers
   */
  setAllLayersVisibility(visible) {
    this.groupStates.forEach((_group, groupId) => {
      this.setGroupVisibility(groupId, visible);
    });
    Object.keys(this.state.layerStates).forEach((layerId) => {
      this.toggleLayerVisibility(layerId, visible);
      const itemEl = this.panel.querySelector(`[data-layer-id="${layerId}"]`);
      if (itemEl) {
        const checkbox = itemEl.querySelector(
          ".layer-control-checkbox"
        );
        if (checkbox) {
          checkbox.checked = visible;
          checkbox.indeterminate = false;
        }
      }
    });
  }
  /**
   * Create the panel header with the title. Panel width is adjusted by
   * dragging either edge of the panel (see createResizeHandle).
   */
  createPanelHeader() {
    const header = document.createElement("div");
    header.className = "layer-control-panel-header";
    const title = document.createElement("span");
    title.className = "layer-control-panel-title";
    title.textContent = "Layers";
    header.appendChild(title);
    return header;
  }
  /**
   * Apply panel width (clamped to min/max)
   */
  applyPanelWidth(width, immediate = false) {
    const clamped = Math.round(
      Math.min(this.maxPanelWidth, Math.max(this.minPanelWidth, width))
    );
    const applyWidth = () => {
      this.state.panelWidth = clamped;
      const px = `${clamped}px`;
      this.panel.style.width = px;
    };
    if (immediate) {
      applyWidth();
      return;
    }
    if (this.widthFrame) {
      cancelAnimationFrame(this.widthFrame);
    }
    this.widthFrame = requestAnimationFrame(() => {
      applyWidth();
      this.widthFrame = null;
    });
  }
  /**
   * Setup main event listeners
   */
  setupEventListeners() {
    this.button.addEventListener("click", () => this.toggle());
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (this.contextMenuEl && this.state.contextMenu.visible) {
        if (!this.contextMenuEl.contains(target)) {
          this.hideContextMenu();
        }
      }
      if (!this.container.contains(target) && !this.panel.contains(target)) {
        this.collapse();
      }
    });
    this.resizeHandler = () => {
      if (!this.state.collapsed) {
        this.updatePanelPosition();
      }
    };
    window.addEventListener("resize", this.resizeHandler);
    this.mapResizeHandler = () => {
      if (!this.state.collapsed) {
        this.updatePanelPosition();
      }
    };
    this.map.on("resize", this.mapResizeHandler);
    this.setupLayerChangeListeners();
  }
  /**
   * Setup listeners for map layer changes
   */
  setupLayerChangeListeners() {
    this.map.on("styledata", () => {
      setTimeout(() => {
        this.updateLayerStatesFromMap();
        this.checkForNewLayers();
      }, 100);
    });
    this.map.on("data", (e) => {
      if (e.sourceDataType === "content") {
        setTimeout(() => {
          this.updateLayerStatesFromMap();
          this.checkForNewLayers();
        }, 100);
      }
    });
    this.map.on("sourcedata", (e) => {
      if (e.sourceDataType === "metadata") {
        setTimeout(() => {
          this.checkForNewLayers();
        }, 150);
      }
    });
    if (this.customLayerRegistry) {
      this.customLayerUnsubscribe = this.customLayerRegistry.onChange(
        (event, layerId) => {
          if (event === "add" && layerId) {
            this.removedCustomLayerIds.delete(layerId);
          }
          setTimeout(() => this.checkForNewLayers(), 100);
        }
      );
    }
  }
  /**
   * Toggle panel expanded/collapsed state
   */
  toggle() {
    if (this.state.collapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }
  /**
   * Expand the panel
   */
  expand() {
    this.state.collapsed = false;
    this.panel.classList.add("expanded");
    this.updatePanelPosition();
  }
  /**
   * Collapse the panel
   */
  collapse() {
    this.state.collapsed = true;
    this.panel.classList.remove("expanded");
  }
  /**
   * Build layer items (called initially and when layers change)
   */
  buildLayerItems() {
    var _a;
    const existingItems = this.panel.querySelectorAll(
      ".layer-control-item, .layer-control-group"
    );
    existingItems.forEach((item) => item.remove());
    this.styleEditors.clear();
    const orderedLayerIds = this.getUserLayerIdsInMapOrder();
    const captured = new Set(orderedLayerIds);
    for (const layerId of Object.keys(this.state.layerStates)) {
      if (layerId !== "Background" && !captured.has(layerId)) {
        orderedLayerIds.push(layerId);
      }
    }
    if (this.state.layerStates["Background"]) {
      orderedLayerIds.push("Background");
    }
    this.groupStates = new Map(
      (((_a = this.customLayerRegistry) == null ? void 0 : _a.getGroups()) ?? []).map((group) => [
        group.id,
        { ...group }
      ])
    );
    this.groupStructureKey = this.computeGroupStructureKey(this.groupStates);
    const groupContainers = /* @__PURE__ */ new Map();
    orderedLayerIds.forEach((layerId) => {
      const state = this.state.layerStates[layerId];
      if (!state) {
        return;
      }
      if (layerId === "Background" || this.targetLayers.length === 0 || this.targetLayers.includes(layerId)) {
        const container = layerId === "Background" ? this.panel : this.getGroupContainer(
          this.getLayerGroupIdOf(layerId),
          groupContainers,
          /* @__PURE__ */ new Set()
        );
        this.addLayerItem(layerId, state, container);
      }
    });
  }
  /**
   * Get the ID of the group a layer belongs to, ignoring a group ID that no
   * adapter defines.
   * @param layerId The layer ID
   * @returns The group ID, or undefined when the layer is ungrouped
   */
  getLayerGroupIdOf(layerId) {
    var _a;
    if (this.groupStates.size === 0) return void 0;
    const groupId = (_a = this.customLayerRegistry) == null ? void 0 : _a.getLayerGroupId(layerId);
    return groupId !== void 0 && this.groupStates.has(groupId) ? groupId : void 0;
  }
  /**
   * Get the element a group's rows go into, creating the group (and any
   * enclosing groups) on first use.
   * @param groupId The group ID, or undefined for the panel's top level
   * @param containers Group child containers already created in this build
   * @param visiting Groups on the current parent chain, to stop on a cycle
   * @returns The element to append the group's rows to
   */
  getGroupContainer(groupId, containers, visiting) {
    if (groupId === void 0) return this.panel;
    const existing = containers.get(groupId);
    if (existing) return existing;
    const group = this.groupStates.get(groupId);
    if (!group || visiting.has(groupId)) return this.panel;
    visiting.add(groupId);
    const parentId = group.parentId !== void 0 && this.groupStates.has(group.parentId) ? group.parentId : void 0;
    const parent = this.getGroupContainer(parentId, containers, visiting);
    const { element, children } = this.createGroupItem(group);
    parent.appendChild(element);
    containers.set(groupId, children);
    return children;
  }
  /**
   * Summarize the group structure the panel is built from: each group's ID
   * and parent, and each layer's group. A change to any of these needs a
   * rebuild; a change to a group's name, visibility, opacity, or collapsed
   * state does not.
   * @param groups The groups to summarize
   * @returns A string that changes whenever the structure does
   */
  computeGroupStructureKey(groups) {
    if (groups.size === 0) return "";
    const memberships = Object.keys(this.state.layerStates).filter((layerId) => layerId !== "Background").map((layerId) => {
      var _a;
      return [
        layerId,
        ((_a = this.customLayerRegistry) == null ? void 0 : _a.getLayerGroupId(layerId)) ?? null
      ];
    });
    return JSON.stringify({
      groups: Array.from(groups.values(), (group) => [
        group.id,
        group.parentId ?? null
      ]),
      memberships
    });
  }
  /**
   * Create the element for a layer group: a header row with a collapse
   * toggle, visibility checkbox, name, and opacity slider, followed by a
   * container for the group's layers and nested groups.
   * @param group The group to render
   * @returns The group element and its child container
   */
  createGroupItem(group) {
    const element = document.createElement("div");
    element.className = "layer-control-group";
    element.setAttribute("data-group-id", group.id);
    const row = document.createElement("div");
    row.className = "layer-control-row layer-control-group-row";
    if (this.enableDragAndDrop) {
      row.appendChild(this.createDisabledDragHandle());
    }
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "layer-control-checkbox layer-control-group-checkbox";
    checkbox.addEventListener("change", () => {
      this.setGroupVisibility(group.id, checkbox.checked);
    });
    row.appendChild(checkbox);
    if (this.showLayerSymbol) {
      const symbol = document.createElement("span");
      symbol.className = "layer-control-symbol layer-control-group-symbol";
      symbol.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M1.5 3.5h4.5l1.5 1.5h7v8.5h-13z" fill="#f2c94c" stroke="#b8902a" stroke-width="1"/>
      </svg>`;
      symbol.title = "Layer group";
      row.appendChild(symbol);
    }
    const name = document.createElement("span");
    name.className = "layer-control-name layer-control-group-name";
    row.appendChild(name);
    if (this.showOpacitySlider) {
      const opacity = document.createElement("input");
      opacity.type = "range";
      opacity.className = "layer-control-opacity layer-control-group-opacity";
      opacity.min = "0";
      opacity.max = "1";
      opacity.step = "0.01";
      opacity.addEventListener("mousedown", () => {
        this.state.userInteractingWithSlider = true;
      });
      opacity.addEventListener("mouseup", () => {
        this.state.userInteractingWithSlider = false;
      });
      opacity.addEventListener("input", () => {
        this.setGroupOpacity(group.id, parseFloat(opacity.value));
      });
      row.appendChild(opacity);
    }
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "layer-control-group-toggle";
    toggle.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M6 4l4 4-4 4z"/>
    </svg>`;
    toggle.addEventListener("click", (e) => {
      var _a;
      e.stopPropagation();
      this.setGroupCollapsed(group.id, !((_a = this.groupStates.get(group.id)) == null ? void 0 : _a.collapsed));
    });
    row.appendChild(toggle);
    const children = document.createElement("div");
    children.className = "layer-control-group-children";
    element.appendChild(row);
    element.appendChild(children);
    this.updateGroupElement(element, group);
    return { element, children };
  }
  /**
   * Show a group's state on its element.
   * @param element The group element
   * @param group The group state to show
   */
  updateGroupElement(element, group) {
    element.classList.toggle("collapsed", group.collapsed);
    element.classList.toggle("layer-control-group-hidden", !group.visible);
    const row = element.querySelector(":scope > .layer-control-group-row");
    if (!row) return;
    const toggle = row.querySelector(
      ".layer-control-group-toggle"
    );
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(!group.collapsed));
      toggle.title = group.collapsed ? "Expand group" : "Collapse group";
      toggle.setAttribute(
        "aria-label",
        `${group.collapsed ? "Expand" : "Collapse"} ${group.name}`
      );
    }
    const checkbox = row.querySelector(
      ".layer-control-group-checkbox"
    );
    if (checkbox) checkbox.checked = group.visible;
    const name = row.querySelector(".layer-control-group-name");
    if (name) {
      name.textContent = group.name;
      name.title = group.name;
    }
    const opacity = row.querySelector(
      ".layer-control-group-opacity"
    );
    if (opacity) {
      opacity.value = String(group.opacity);
      opacity.title = `Opacity: ${Math.round(group.opacity * 100)}%`;
    }
  }
  /**
   * Get the element of a rendered group.
   * @param groupId The group ID
   * @returns The group element, or null when the group is not rendered
   */
  getGroupElement(groupId) {
    const groups = this.panel.querySelectorAll(".layer-control-group");
    for (const element of Array.from(groups)) {
      if (element.dataset.groupId === groupId) {
        return element;
      }
    }
    return null;
  }
  /**
   * Remove group elements left without any layer row, e.g. after their last
   * layer was removed.
   */
  pruneEmptyGroups() {
    const groups = Array.from(this.panel.querySelectorAll(".layer-control-group"));
    for (const element of groups.reverse()) {
      if (!element.querySelector(".layer-control-item")) element.remove();
    }
  }
  /**
   * Set a group's visibility from the panel and report it to its adapter.
   * @param groupId The group ID
   * @param visible Whether the group should be visible
   */
  setGroupVisibility(groupId, visible) {
    var _a;
    const group = this.groupStates.get(groupId);
    if (!group) return;
    group.visible = visible;
    const element = this.getGroupElement(groupId);
    if (element) this.updateGroupElement(element, group);
    this.state.isStyleOperationInProgress = true;
    (_a = this.customLayerRegistry) == null ? void 0 : _a.setGroupVisibility(groupId, visible);
    setTimeout(() => {
      this.state.isStyleOperationInProgress = false;
    }, 200);
  }
  /**
   * Set a group's opacity from the panel and report it to its adapter.
   * @param groupId The group ID
   * @param opacity The opacity value (0-1)
   */
  setGroupOpacity(groupId, opacity) {
    var _a;
    const group = this.groupStates.get(groupId);
    if (!group) return;
    group.opacity = opacity;
    const element = this.getGroupElement(groupId);
    if (element) this.updateGroupElement(element, group);
    this.state.isStyleOperationInProgress = true;
    (_a = this.customLayerRegistry) == null ? void 0 : _a.setGroupOpacity(groupId, opacity);
    setTimeout(() => {
      this.state.isStyleOperationInProgress = false;
    }, 200);
  }
  /**
   * Collapse or expand a group in the panel and report it to its adapter.
   * @param groupId The group ID
   * @param collapsed Whether the group should be collapsed
   */
  setGroupCollapsed(groupId, collapsed) {
    var _a;
    const group = this.groupStates.get(groupId);
    if (!group) return;
    group.collapsed = collapsed;
    const element = this.getGroupElement(groupId);
    if (element) this.updateGroupElement(element, group);
    (_a = this.customLayerRegistry) == null ? void 0 : _a.setGroupCollapsed(groupId, collapsed);
  }
  /**
   * Re-read the layer groups from the custom layer adapters. Call this after
   * groups change outside the control. The panel is rebuilt when a group was
   * added, removed, or re-parented, or a layer changed group; otherwise the
   * group rows' name, visibility, opacity, and collapsed state are updated in
   * place.
   */
  refreshGroups() {
    var _a;
    if (!this.panel) return;
    const next = new Map(
      (((_a = this.customLayerRegistry) == null ? void 0 : _a.getGroups()) ?? []).map((group) => [
        group.id,
        { ...group }
      ])
    );
    if (this.computeGroupStructureKey(next) !== this.groupStructureKey) {
      this.buildLayerItems();
      return;
    }
    this.groupStates = next;
    next.forEach((group, groupId) => {
      const element = this.getGroupElement(groupId);
      if (element) this.updateGroupElement(element, group);
    });
  }
  /**
   * Add a single layer item to the panel
   */
  addLayerItem(layerId, state, container = this.panel) {
    const item = document.createElement("div");
    item.className = "layer-control-item";
    item.setAttribute("data-layer-id", layerId);
    const row = document.createElement("div");
    row.className = "layer-control-row";
    if (this.enableDragAndDrop) {
      if (layerId === "Background") {
        const disabledHandle = this.createDisabledDragHandle();
        row.appendChild(disabledHandle);
      } else {
        const dragHandle = this.createDragHandle(layerId);
        row.appendChild(dragHandle);
      }
    }
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "layer-control-checkbox";
    checkbox.checked = state.visible;
    checkbox.addEventListener("change", () => {
      this.toggleLayerVisibility(layerId, checkbox.checked);
    });
    const displayName = this.state.customLayerNames.get(layerId) || state.name || layerId;
    const name = document.createElement("span");
    name.className = "layer-control-name";
    name.textContent = displayName;
    name.title = displayName;
    row.appendChild(checkbox);
    if (this.showLayerSymbol) {
      if (layerId === "Background") {
        const symbol = this.createBackgroundGroupSymbol();
        row.appendChild(symbol);
      } else {
        const symbol = this.createLayerSymbol(layerId);
        if (symbol) {
          row.appendChild(symbol);
        }
      }
    }
    row.appendChild(name);
    if (this.showOpacitySlider) {
      const opacity = document.createElement("input");
      opacity.type = "range";
      opacity.className = "layer-control-opacity";
      opacity.min = "0";
      opacity.max = "1";
      opacity.step = "0.01";
      opacity.value = String(state.opacity);
      opacity.title = `Opacity: ${Math.round(state.opacity * 100)}%`;
      opacity.addEventListener("mousedown", () => {
        this.state.userInteractingWithSlider = true;
      });
      opacity.addEventListener("mouseup", () => {
        this.state.userInteractingWithSlider = false;
      });
      opacity.addEventListener("input", () => {
        this.changeLayerOpacity(layerId, parseFloat(opacity.value));
        opacity.title = `Opacity: ${Math.round(parseFloat(opacity.value) * 100)}%`;
      });
      opacity.addEventListener("dblclick", (event) => {
        event.preventDefault();
        this.showOpacityInput(layerId, opacity);
      });
      row.appendChild(opacity);
    }
    if (this.showStyleEditor) {
      if (layerId === "Background") {
        const legendButton = this.createBackgroundLegendButton();
        row.appendChild(legendButton);
      } else {
        const styleButton = this.createStyleButton(layerId);
        if (styleButton) {
          row.appendChild(styleButton);
        }
      }
    }
    item.appendChild(row);
    if (this.enableContextMenu && layerId !== "Background") {
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showContextMenu(layerId, e.clientX, e.clientY);
      });
    }
    container.appendChild(item);
  }
  /**
   * Create a symbol element for a layer
   * @param layerId The layer ID
   * @returns The symbol HTML element, or null if layer not found
   */
  createLayerSymbol(layerId) {
    const layerState = this.state.layerStates[layerId];
    if (layerState == null ? void 0 : layerState.isCustomLayer) {
      const symbolType = layerState.customLayerType || "custom-raster";
      const color2 = "#4a90d9";
      const svgMarkup2 = createLayerSymbolSVG(symbolType, color2);
      const symbolContainer2 = document.createElement("span");
      symbolContainer2.className = "layer-control-symbol";
      symbolContainer2.innerHTML = svgMarkup2;
      symbolContainer2.title = `Layer type: ${symbolType}`;
      return symbolContainer2;
    }
    const layer = this.map.getLayer(layerId);
    if (!layer) return null;
    const layerType = layer.type;
    const color = getLayerColor(this.map, layerId, layerType);
    const svgMarkup = createLayerSymbolSVG(layerType, color);
    const symbolContainer = document.createElement("span");
    symbolContainer.className = "layer-control-symbol";
    symbolContainer.innerHTML = svgMarkup;
    symbolContainer.title = `Layer type: ${layerType}`;
    return symbolContainer;
  }
  /**
   * Create a symbol element for a background layer
   * @param layer The layer specification
   * @returns The symbol HTML element
   */
  createBackgroundLayerSymbol(layer) {
    const color = getLayerColorFromSpec(layer);
    const svgMarkup = createLayerSymbolSVG(layer.type, color, { size: 14 });
    const symbolContainer = document.createElement("span");
    symbolContainer.className = "background-legend-layer-symbol";
    symbolContainer.innerHTML = svgMarkup;
    symbolContainer.title = `Layer type: ${layer.type}`;
    return symbolContainer;
  }
  /**
   * Create a symbol element for the Background layer group
   * Shows a stacked layers icon to represent multiple background layers
   * @returns The symbol HTML element
   */
  createBackgroundGroupSymbol() {
    const svgMarkup = createBackgroundGroupSymbolSVG(16);
    const symbolContainer = document.createElement("span");
    symbolContainer.className = "layer-control-symbol";
    symbolContainer.innerHTML = svgMarkup;
    symbolContainer.title = "Background layers";
    return symbolContainer;
  }
  /**
   * Toggle layer visibility
   */
  toggleLayerVisibility(layerId, visible) {
    var _a;
    if (layerId === "Background") {
      this.toggleBackgroundVisibility(visible);
      return;
    }
    this.state.isStyleOperationInProgress = true;
    if (this.state.layerStates[layerId]) {
      this.state.layerStates[layerId].visible = visible;
    }
    if ((_a = this.customLayerRegistry) == null ? void 0 : _a.setVisibility(layerId, visible)) {
      setTimeout(() => {
        this.state.isStyleOperationInProgress = false;
      }, 200);
      return;
    }
    this.map.setLayoutProperty(
      layerId,
      "visibility",
      visible ? "visible" : "none"
    );
    setTimeout(() => {
      this.state.isStyleOperationInProgress = false;
    }, 200);
  }
  /**
   * Show a small popup that lets the user type an exact opacity percentage
   * (0-100) for a layer. Triggered by double-clicking the opacity slider.
   *
   * @param layerId The layer ID whose opacity is being edited
   * @param slider The opacity range input associated with the layer row
   */
  showOpacityInput(layerId, slider) {
    this.hideOpacityInput();
    const popup = document.createElement("div");
    popup.className = "layer-control-opacity-input";
    const label = document.createElement("span");
    label.className = "layer-control-opacity-input-label";
    label.textContent = "Opacity";
    const field = document.createElement("div");
    field.className = "layer-control-opacity-input-field";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.value = String(Math.round(parseFloat(slider.value) * 100));
    const suffix = document.createElement("span");
    suffix.className = "layer-control-opacity-input-suffix";
    suffix.textContent = "%";
    field.appendChild(input);
    field.appendChild(suffix);
    popup.appendChild(label);
    popup.appendChild(field);
    popup.addEventListener("click", (event) => event.stopPropagation());
    popup.addEventListener("pointerdown", (event) => event.stopPropagation());
    let settled = false;
    const apply = () => {
      if (settled) return;
      settled = true;
      const pct = clamp(Math.round(parseFloat(input.value)), 0, 100);
      if (!Number.isNaN(pct)) {
        const opacity = pct / 100;
        slider.value = String(opacity);
        slider.title = `Opacity: ${pct}%`;
        this.changeLayerOpacity(layerId, opacity);
      }
      this.hideOpacityInput();
    };
    const cancel = () => {
      if (settled) return;
      settled = true;
      this.hideOpacityInput();
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        apply();
        slider.focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
        slider.focus();
      }
    });
    input.addEventListener("blur", apply);
    this.mapContainer.appendChild(popup);
    this.opacityInputEl = popup;
    const sliderRect = slider.getBoundingClientRect();
    const mapRect = this.mapContainer.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    let left = sliderRect.left - mapRect.left;
    let top = sliderRect.bottom - mapRect.top + 4;
    if (left + popupRect.width > mapRect.width) {
      left = Math.max(0, mapRect.width - popupRect.width - 5);
    }
    if (top + popupRect.height > mapRect.height) {
      top = sliderRect.top - mapRect.top - popupRect.height - 4;
    }
    popup.style.left = `${Math.max(0, left)}px`;
    popup.style.top = `${Math.max(0, top)}px`;
    input.focus();
    input.select();
  }
  /**
   * Remove the exact-opacity input popup if it is open.
   */
  hideOpacityInput() {
    if (this.opacityInputEl) {
      this.opacityInputEl.remove();
      this.opacityInputEl = null;
    }
  }
  /**
   * Change layer opacity
   */
  changeLayerOpacity(layerId, opacity) {
    var _a;
    if (layerId === "Background") {
      this.changeBackgroundOpacity(opacity);
      return;
    }
    this.state.isStyleOperationInProgress = true;
    if (this.state.layerStates[layerId]) {
      this.state.layerStates[layerId].opacity = opacity;
    }
    if ((_a = this.customLayerRegistry) == null ? void 0 : _a.setOpacity(layerId, opacity)) {
      setTimeout(() => {
        this.state.isStyleOperationInProgress = false;
      }, 200);
      return;
    }
    const layerType = getLayerType(this.map, layerId);
    if (layerType) {
      setLayerOpacity(this.map, layerId, layerType, opacity);
    }
    setTimeout(() => {
      this.state.isStyleOperationInProgress = false;
    }, 200);
  }
  /**
   * Check if a layer is a user-added layer (vs basemap layer)
   * Used primarily for the background legend to determine which layers are background
   */
  isUserAddedLayer(layerId) {
    if (this.state.layerStates[layerId] !== void 0 && layerId !== "Background") {
      return true;
    }
    if (this.basemapLayerIds !== null && this.basemapLayerIds.size > 0) {
      return !this.basemapLayerIds.has(layerId);
    }
    if (this.initialLayerIds !== null && !this.initialLayerIds.has(layerId)) {
      return true;
    }
    const layer = this.map.getLayer(layerId);
    if (layer) {
      const sourceId = layer.source;
      if (sourceId) {
        const userAddedSourceIds = this.detectUserAddedSources();
        return userAddedSourceIds.has(sourceId);
      }
    }
    return false;
  }
  /**
   * Toggle visibility for all background layers (basemap layers)
   */
  toggleBackgroundVisibility(visible) {
    var _a;
    if (this.state.layerStates["Background"]) {
      this.state.layerStates["Background"].visible = visible;
    }
    const styleLayers = this.map.getStyle().layers || [];
    styleLayers.forEach((layer) => {
      if (!this.isUserAddedLayer(layer.id)) {
        this.state.backgroundLayerVisibility.set(layer.id, visible);
        this.map.setLayoutProperty(
          layer.id,
          "visibility",
          visible ? "visible" : "none"
        );
      }
    });
    if (this.state.backgroundLegendOpen) {
      const legendPanel = this.panel.querySelector(
        ".layer-control-background-legend"
      );
      if (legendPanel) {
        const checkboxes = legendPanel.querySelectorAll(
          ".background-legend-checkbox"
        );
        checkboxes.forEach((checkbox) => {
          checkbox.checked = visible;
        });
      }
    }
    (_a = this.onBackgroundVisibilityChange) == null ? void 0 : _a.call(this, visible);
  }
  /**
   * Change opacity for all background layers (basemap layers)
   */
  changeBackgroundOpacity(opacity) {
    var _a;
    if (this.state.layerStates["Background"]) {
      this.state.layerStates["Background"].opacity = opacity;
    }
    const styleLayers = this.map.getStyle().layers || [];
    styleLayers.forEach((styleLayer) => {
      if (!this.isUserAddedLayer(styleLayer.id)) {
        const layerType = getLayerType(this.map, styleLayer.id);
        if (layerType) {
          setLayerOpacity(this.map, styleLayer.id, layerType, opacity);
        }
      }
    });
    (_a = this.onBackgroundOpacityChange) == null ? void 0 : _a.call(this, opacity);
  }
  // ===== Background Legend Methods =====
  /**
   * Create legend button for Background layer
   */
  createBackgroundLegendButton() {
    const button = document.createElement("button");
    button.className = "layer-control-style-button layer-control-background-legend-button";
    button.innerHTML = "&#9881;";
    button.title = "Show background layer details";
    button.setAttribute(
      "aria-label",
      "Show background layer visibility controls"
    );
    button.setAttribute(
      "aria-expanded",
      String(this.state.backgroundLegendOpen)
    );
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleBackgroundLegend();
    });
    return button;
  }
  /**
   * Toggle background legend panel visibility
   */
  toggleBackgroundLegend() {
    if (this.state.backgroundLegendOpen) {
      this.closeBackgroundLegend();
    } else {
      this.openBackgroundLegend();
    }
  }
  /**
   * Open background legend panel
   */
  openBackgroundLegend() {
    if (this.state.activeStyleEditor) {
      this.closeStyleEditor(this.state.activeStyleEditor);
    }
    const itemEl = this.panel.querySelector('[data-layer-id="Background"]');
    if (!itemEl) return;
    let legendPanel = itemEl.querySelector(".layer-control-background-legend");
    if (legendPanel) {
      const layerList = legendPanel.querySelector(
        ".background-legend-layer-list"
      );
      if (layerList) {
        this.populateBackgroundLayerList(layerList);
      }
    } else {
      legendPanel = this.createBackgroundLegendPanel();
      itemEl.appendChild(legendPanel);
    }
    this.state.backgroundLegendOpen = true;
    const button = itemEl.querySelector(
      ".layer-control-background-legend-button"
    );
    if (button) {
      button.setAttribute("aria-expanded", "true");
      button.classList.add("active");
    }
    setTimeout(() => {
      legendPanel == null ? void 0 : legendPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }
  /**
   * Close background legend panel
   */
  closeBackgroundLegend() {
    const itemEl = this.panel.querySelector('[data-layer-id="Background"]');
    if (!itemEl) return;
    const legendPanel = itemEl.querySelector(
      ".layer-control-background-legend"
    );
    if (legendPanel) {
      legendPanel.remove();
    }
    this.state.backgroundLegendOpen = false;
    const button = itemEl.querySelector(
      ".layer-control-background-legend-button"
    );
    if (button) {
      button.setAttribute("aria-expanded", "false");
      button.classList.remove("active");
    }
  }
  /**
   * Create the background legend panel with individual layer controls
   */
  createBackgroundLegendPanel() {
    const panel = document.createElement("div");
    panel.className = "layer-control-background-legend";
    const header = document.createElement("div");
    header.className = "background-legend-header";
    const title = document.createElement("span");
    title.className = "background-legend-title";
    title.textContent = "Background Layers";
    const closeBtn = document.createElement("button");
    closeBtn.className = "background-legend-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeBackgroundLegend();
    });
    header.appendChild(title);
    header.appendChild(closeBtn);
    const actionsRow = document.createElement("div");
    actionsRow.className = "background-legend-actions";
    const showAllBtn = document.createElement("button");
    showAllBtn.className = "background-legend-action-btn";
    showAllBtn.textContent = "Show All";
    showAllBtn.addEventListener(
      "click",
      () => this.setAllBackgroundLayersVisibility(true)
    );
    const hideAllBtn = document.createElement("button");
    hideAllBtn.className = "background-legend-action-btn";
    hideAllBtn.textContent = "Hide All";
    hideAllBtn.addEventListener(
      "click",
      () => this.setAllBackgroundLayersVisibility(false)
    );
    actionsRow.appendChild(showAllBtn);
    actionsRow.appendChild(hideAllBtn);
    const filterRow = document.createElement("div");
    filterRow.className = "background-legend-filter";
    const filterCheckbox = document.createElement("input");
    filterCheckbox.type = "checkbox";
    filterCheckbox.className = "background-legend-filter-checkbox";
    filterCheckbox.id = "background-legend-only-rendered";
    filterCheckbox.checked = this.state.onlyRenderedFilter;
    filterCheckbox.addEventListener("change", () => {
      this.state.onlyRenderedFilter = filterCheckbox.checked;
      const layerList2 = panel.querySelector(".background-legend-layer-list");
      if (layerList2) {
        this.populateBackgroundLayerList(layerList2);
      }
    });
    const filterLabel = document.createElement("label");
    filterLabel.className = "background-legend-filter-label";
    filterLabel.htmlFor = "background-legend-only-rendered";
    filterLabel.textContent = "Only rendered";
    filterRow.appendChild(filterCheckbox);
    filterRow.appendChild(filterLabel);
    const layerList = document.createElement("div");
    layerList.className = "background-legend-layer-list";
    this.populateBackgroundLayerList(layerList);
    panel.appendChild(header);
    panel.appendChild(actionsRow);
    panel.appendChild(filterRow);
    panel.appendChild(layerList);
    if (this.enableBackgroundPresets) {
      panel.appendChild(this.createBackgroundPresetsRow());
    }
    return panel;
  }
  /**
   * Build the "Saved configurations" controls: a dropdown of saved presets with
   * Apply/Delete actions, plus a name field and Save button to capture the
   * current basemap element visibility as a reusable, persisted preset.
   */
  createBackgroundPresetsRow() {
    const section = document.createElement("div");
    section.className = "background-legend-presets";
    const label = document.createElement("div");
    label.className = "background-legend-presets-label";
    label.textContent = "Saved configurations";
    section.appendChild(label);
    const selectRow = document.createElement("div");
    selectRow.className = "background-legend-presets-row";
    const select = document.createElement("select");
    select.className = "background-legend-presets-select";
    select.title = "Saved configurations";
    const applyBtn = document.createElement("button");
    applyBtn.className = "background-legend-action-btn";
    applyBtn.textContent = "Apply";
    applyBtn.title = "Apply the selected configuration";
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "background-legend-action-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.title = "Delete the selected configuration";
    const refreshSelect = (selected) => {
      const presets = this.getBackgroundPresets();
      const names = Object.keys(presets).sort(
        (a, b) => a.localeCompare(b, void 0, { sensitivity: "base" })
      );
      select.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = names.length ? "Select a configuration…" : "No saved configurations";
      placeholder.disabled = names.length > 0;
      select.appendChild(placeholder);
      names.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
      });
      select.value = selected && names.includes(selected) ? selected : "";
      const hasSelection = select.value !== "";
      applyBtn.disabled = !hasSelection;
      deleteBtn.disabled = !hasSelection;
    };
    select.addEventListener("change", () => {
      const hasSelection = select.value !== "";
      applyBtn.disabled = !hasSelection;
      deleteBtn.disabled = !hasSelection;
    });
    applyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (select.value) this.applyBackgroundPreset(select.value);
    });
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (select.value) {
        this.deleteBackgroundPreset(select.value);
        refreshSelect();
      }
    });
    selectRow.appendChild(select);
    selectRow.appendChild(applyBtn);
    selectRow.appendChild(deleteBtn);
    const saveRow = document.createElement("div");
    saveRow.className = "background-legend-presets-row";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "background-legend-presets-input";
    nameInput.placeholder = "Configuration name…";
    nameInput.maxLength = 60;
    const saveBtn = document.createElement("button");
    saveBtn.className = "background-legend-action-btn";
    saveBtn.textContent = "Save";
    saveBtn.title = "Save the current visibility as a configuration";
    const commitSave = () => {
      const name = nameInput.value.trim();
      if (!name) return;
      this.saveBackgroundPreset(name);
      nameInput.value = "";
      refreshSelect(name);
    };
    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      commitSave();
    });
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitSave();
      }
    });
    saveRow.appendChild(nameInput);
    saveRow.appendChild(saveBtn);
    section.appendChild(selectRow);
    section.appendChild(saveRow);
    refreshSelect();
    return section;
  }
  /**
   * Check if a layer is currently rendered in the map viewport
   */
  isLayerRendered(layerId) {
    try {
      const layer = this.map.getLayer(layerId);
      if (!layer) return false;
      const visibility = this.map.getLayoutProperty(layerId, "visibility");
      if (visibility === "none") return false;
      if (layer.type === "raster" || layer.type === "hillshade") {
        return true;
      }
      if (layer.type === "background") {
        return true;
      }
      const features = this.map.queryRenderedFeatures({ layers: [layerId] });
      return features.length > 0;
    } catch (error) {
      return true;
    }
  }
  /**
   * Populate the background layer list with individual layers
   */
  populateBackgroundLayerList(container) {
    container.innerHTML = "";
    const styleLayers = this.map.getStyle().layers || [];
    styleLayers.forEach((layer) => {
      if (!this.isUserAddedLayer(layer.id)) {
        if (this.excludeDrawnLayers && this.isDrawnLayer(layer.id)) {
          return;
        }
        if (this.isExcludedByPattern(layer.id)) {
          return;
        }
        if (this.state.onlyRenderedFilter && !this.isLayerRendered(layer.id)) {
          return;
        }
        const layerRow = document.createElement("div");
        layerRow.className = "background-legend-layer-row";
        layerRow.setAttribute("data-background-layer-id", layer.id);
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "background-legend-checkbox";
        const visibility = this.map.getLayoutProperty(layer.id, "visibility");
        const isVisible = visibility !== "none";
        checkbox.checked = isVisible;
        this.state.backgroundLayerVisibility.set(layer.id, isVisible);
        checkbox.addEventListener("change", () => {
          this.toggleIndividualBackgroundLayer(layer.id, checkbox.checked);
        });
        const name = document.createElement("span");
        name.className = "background-legend-layer-name";
        name.textContent = this.generateFriendlyName(layer.id);
        name.title = layer.id;
        const typeIndicator = document.createElement("span");
        typeIndicator.className = "background-legend-layer-type";
        typeIndicator.textContent = layer.type;
        layerRow.appendChild(checkbox);
        if (this.showLayerSymbol) {
          const symbol = this.createBackgroundLayerSymbol(layer);
          if (symbol) {
            layerRow.appendChild(symbol);
          }
        }
        layerRow.appendChild(name);
        layerRow.appendChild(typeIndicator);
        container.appendChild(layerRow);
      }
    });
    if (container.children.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "background-legend-empty";
      emptyMsg.textContent = this.state.onlyRenderedFilter ? "No rendered layers in current view." : "No background layers found.";
      container.appendChild(emptyMsg);
    }
  }
  /**
   * Toggle visibility of an individual background layer
   */
  toggleIndividualBackgroundLayer(layerId, visible) {
    this.state.backgroundLayerVisibility.set(layerId, visible);
    this.map.setLayoutProperty(
      layerId,
      "visibility",
      visible ? "visible" : "none"
    );
    this.updateBackgroundCheckboxState();
  }
  /**
   * Set visibility for all background layers
   */
  setAllBackgroundLayersVisibility(visible) {
    const styleLayers = this.map.getStyle().layers || [];
    styleLayers.forEach((layer) => {
      if (!this.isUserAddedLayer(layer.id)) {
        this.state.backgroundLayerVisibility.set(layer.id, visible);
        this.map.setLayoutProperty(
          layer.id,
          "visibility",
          visible ? "visible" : "none"
        );
      }
    });
    const legendPanel = this.panel.querySelector(
      ".layer-control-background-legend"
    );
    if (legendPanel) {
      const checkboxes = legendPanel.querySelectorAll(
        ".background-legend-checkbox"
      );
      checkboxes.forEach((checkbox) => {
        checkbox.checked = visible;
      });
    }
    this.updateBackgroundCheckboxState();
  }
  /**
   * Update the main Background checkbox based on individual layer states
   */
  updateBackgroundCheckboxState() {
    const styleLayers = this.map.getStyle().layers || [];
    let anyVisible = false;
    let allVisible = true;
    styleLayers.forEach((layer) => {
      if (!this.isUserAddedLayer(layer.id)) {
        const visible = this.state.backgroundLayerVisibility.get(layer.id);
        if (visible === true) anyVisible = true;
        if (visible === false) allVisible = false;
      }
    });
    const backgroundItem = this.panel.querySelector(
      '[data-layer-id="Background"]'
    );
    if (backgroundItem) {
      const checkbox = backgroundItem.querySelector(
        ".layer-control-checkbox"
      );
      if (checkbox) {
        checkbox.checked = anyVisible;
        checkbox.indeterminate = anyVisible && !allVisible;
      }
    }
    if (this.state.layerStates["Background"]) {
      this.state.layerStates["Background"].visible = anyVisible;
    }
  }
  /**
   * Return the IDs of the background (basemap) style layers the control can
   * toggle, honoring the drawn-layer and user-defined exclusion filters but not
   * the transient "only rendered" view filter.
   */
  getControllableBackgroundLayerIds() {
    const styleLayers = this.map.getStyle().layers || [];
    return styleLayers.filter((layer) => {
      if (this.isUserAddedLayer(layer.id)) return false;
      if (this.excludeDrawnLayers && this.isDrawnLayer(layer.id))
        return false;
      if (this.isExcludedByPattern(layer.id)) return false;
      return true;
    }).map((layer) => layer.id);
  }
  /**
   * Get the current visibility of every controllable background (basemap) layer.
   *
   * @returns A map of style-layer ID to whether it is currently visible.
   */
  getBackgroundLayerVisibility() {
    const visibility = {};
    for (const layerId of this.getControllableBackgroundLayerIds()) {
      const value = this.map.getLayoutProperty(layerId, "visibility");
      visibility[layerId] = value !== "none";
    }
    return visibility;
  }
  /**
   * Apply a saved background-layer visibility configuration to the map. Only
   * layers that currently exist in the style are affected, so a configuration
   * captured on one basemap degrades gracefully when applied to another.
   *
   * @param visibility - Map of style-layer ID to desired visibility.
   */
  applyBackgroundLayerVisibility(visibility) {
    for (const [layerId, visible] of Object.entries(visibility)) {
      if (this.isUserAddedLayer(layerId)) continue;
      if (!this.map.getLayer(layerId)) continue;
      this.state.backgroundLayerVisibility.set(layerId, visible);
      this.map.setLayoutProperty(
        layerId,
        "visibility",
        visible ? "visible" : "none"
      );
    }
    const legendPanel = this.panel.querySelector(
      ".background-legend-layer-list"
    );
    if (legendPanel) {
      this.populateBackgroundLayerList(legendPanel);
    }
    this.updateBackgroundCheckboxState();
  }
  /**
   * Read all saved background-layer presets from localStorage. Returns an empty
   * object when storage is unavailable or the stored value is malformed.
   */
  getBackgroundPresets() {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(this.backgroundPresetStorageKey) : null;
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }
      const presets = {};
      for (const [name, value] of Object.entries(parsed)) {
        if (this.isUnsafePresetKey(name)) continue;
        if (value && typeof value === "object" && !Array.isArray(value)) {
          presets[name] = value;
        }
      }
      return presets;
    } catch {
      return {};
    }
  }
  /**
   * Reject preset names that, used as object keys, could pollute the prototype
   * chain or otherwise alias built-in object members.
   */
  isUnsafePresetKey(name) {
    return name === "__proto__" || name === "constructor" || name === "prototype";
  }
  /**
   * Persist the full preset map to localStorage and notify listeners.
   */
  writeBackgroundPresets(presets) {
    var _a;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          this.backgroundPresetStorageKey,
          JSON.stringify(presets)
        );
      }
    } catch {
    }
    (_a = this.onBackgroundPresetsChange) == null ? void 0 : _a.call(this, presets);
  }
  /**
   * Save the current background-layer visibility as a named preset. Reusing an
   * existing name overwrites that preset.
   *
   * @param name - Preset name; whitespace is trimmed. Empty names are ignored.
   * @returns The updated preset map.
   */
  saveBackgroundPreset(name) {
    const trimmed = name.trim();
    const presets = this.getBackgroundPresets();
    if (!trimmed || this.isUnsafePresetKey(trimmed)) return presets;
    presets[trimmed] = this.getBackgroundLayerVisibility();
    this.writeBackgroundPresets(presets);
    return presets;
  }
  /**
   * Apply a previously saved preset to the map.
   *
   * @param name - The preset name to apply.
   * @returns `true` if a preset with that name existed and was applied.
   */
  applyBackgroundPreset(name) {
    const presets = this.getBackgroundPresets();
    if (!Object.prototype.hasOwnProperty.call(presets, name)) return false;
    this.applyBackgroundLayerVisibility(presets[name]);
    return true;
  }
  /**
   * Delete a saved preset.
   *
   * @param name - The preset name to remove.
   * @returns The updated preset map.
   */
  deleteBackgroundPreset(name) {
    const presets = this.getBackgroundPresets();
    if (Object.prototype.hasOwnProperty.call(presets, name)) {
      delete presets[name];
      this.writeBackgroundPresets(presets);
    }
    return presets;
  }
  /**
   * Create style button for a layer
   */
  createStyleButton(layerId) {
    if (layerId === "Background") {
      return null;
    }
    const layerState = this.state.layerStates[layerId];
    const isCustomLayer = (layerState == null ? void 0 : layerState.isCustomLayer) === true;
    const button = document.createElement("button");
    button.className = "layer-control-style-button";
    button.innerHTML = "&#9881;";
    if (isCustomLayer) {
      button.title = "Layer info (style editing not available)";
      button.setAttribute("aria-label", `Layer info for ${layerId}`);
    } else {
      button.title = "Edit layer style";
      button.setAttribute("aria-label", `Edit style for ${layerId}`);
    }
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleStyleEditor(layerId);
    });
    return button;
  }
  /**
   * Toggle style editor for a layer
   */
  toggleStyleEditor(layerId) {
    if (this.state.activeStyleEditor === layerId) {
      this.closeStyleEditor(layerId);
      return;
    }
    if (this.state.activeStyleEditor) {
      this.closeStyleEditor(this.state.activeStyleEditor);
    }
    this.openStyleEditor(layerId);
  }
  /**
   * Open style editor for a layer
   */
  openStyleEditor(layerId) {
    var _a;
    const itemEl = this.panel.querySelector(`[data-layer-id="${layerId}"]`);
    if (!itemEl) return;
    const layerState = this.state.layerStates[layerId];
    if (layerState == null ? void 0 : layerState.isCustomLayer) {
      const nativeLayerIds = (_a = this.customLayerRegistry) == null ? void 0 : _a.getNativeLayerIds(layerId);
      if (nativeLayerIds && nativeLayerIds.length > 0) {
        for (const nativeId of nativeLayerIds) {
          if (!this.state.originalStyles.has(nativeId)) {
            const nativeLayer = this.map.getLayer(nativeId);
            if (nativeLayer) {
              cacheOriginalLayerStyle(
                this.map,
                nativeId,
                this.state.originalStyles
              );
            }
          }
        }
        const editor3 = this.createNativeSubLayerStyleEditor(
          layerId,
          nativeLayerIds
        );
        if (editor3) {
          itemEl.appendChild(editor3);
          this.styleEditors.set(layerId, editor3);
          this.state.activeStyleEditor = layerId;
          setTimeout(() => {
            editor3.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 50);
          return;
        }
      }
      const editor2 = this.createCustomLayerInfoPanel(layerId);
      itemEl.appendChild(editor2);
      this.styleEditors.set(layerId, editor2);
      this.state.activeStyleEditor = layerId;
      setTimeout(() => {
        editor2.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
      return;
    }
    if (!this.state.originalStyles.has(layerId)) {
      const layer = this.map.getLayer(layerId);
      if (layer) {
        cacheOriginalLayerStyle(this.map, layerId, this.state.originalStyles);
      }
    }
    const editor = this.createStyleEditor(layerId);
    if (!editor) return;
    itemEl.appendChild(editor);
    this.styleEditors.set(layerId, editor);
    this.state.activeStyleEditor = layerId;
    setTimeout(() => {
      editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }
  /**
   * Create info panel for custom layers (style editing not supported)
   */
  createCustomLayerInfoPanel(layerId) {
    const editor = document.createElement("div");
    editor.className = "layer-control-style-editor layer-control-custom-info";
    const header = document.createElement("div");
    header.className = "style-editor-header";
    const title = document.createElement("span");
    title.className = "style-editor-title";
    title.textContent = "Layer Info";
    const closeBtn = document.createElement("button");
    closeBtn.className = "style-editor-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeStyleEditor(layerId);
    });
    header.appendChild(title);
    header.appendChild(closeBtn);
    const content = document.createElement("div");
    content.className = "style-editor-controls";
    const infoText = document.createElement("p");
    infoText.className = "layer-control-custom-info-text";
    infoText.textContent = `This is a custom layer. Style editing is not available for this layer type. Use the visibility toggle and opacity slider to control the layer.`;
    content.appendChild(infoText);
    const actions = document.createElement("div");
    actions.className = "style-editor-actions";
    const removeBtn = document.createElement("button");
    removeBtn.className = "style-editor-button style-editor-button-remove";
    removeBtn.textContent = "Remove Layer";
    removeBtn.title = "Remove layer from map";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showRemoveConfirmation(editor, () => {
        this.closeStyleEditor(layerId);
        this.removeLayer(layerId);
      });
    });
    const closeActionBtn = document.createElement("button");
    closeActionBtn.className = "style-editor-button style-editor-button-close";
    closeActionBtn.textContent = "Close";
    closeActionBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeStyleEditor(layerId);
    });
    actions.appendChild(removeBtn);
    actions.appendChild(closeActionBtn);
    editor.appendChild(header);
    editor.appendChild(content);
    editor.appendChild(actions);
    return editor;
  }
  /**
   * Create a combined style editor for custom layers with native MapLibre sublayers.
   * Groups controls by sublayer type (fill, line, circle, etc.).
   */
  createNativeSubLayerStyleEditor(layerId, nativeLayerIds) {
    const layersByType = /* @__PURE__ */ new Map();
    for (const nativeId of nativeLayerIds) {
      const layer = this.map.getLayer(nativeId);
      if (layer) {
        const type = layer.type;
        if (!layersByType.has(type)) {
          layersByType.set(type, []);
        }
        layersByType.get(type).push(nativeId);
      }
    }
    if (layersByType.size === 0) return null;
    const editor = document.createElement("div");
    editor.className = "layer-control-style-editor";
    const header = document.createElement("div");
    header.className = "style-editor-header";
    const title = document.createElement("span");
    title.className = "style-editor-title";
    title.textContent = "Edit Style";
    const closeBtn = document.createElement("button");
    closeBtn.className = "style-editor-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeStyleEditor(layerId);
    });
    header.appendChild(title);
    header.appendChild(closeBtn);
    editor.appendChild(header);
    const controls = document.createElement("div");
    controls.className = "style-editor-controls";
    const typeLabels = {
      fill: "Fill",
      line: "Line",
      circle: "Circle",
      symbol: "Symbol",
      raster: "Raster"
    };
    for (const [type, ids] of layersByType) {
      if (layersByType.size > 1) {
        const sectionHeader = document.createElement("div");
        sectionHeader.className = "style-editor-section-header";
        sectionHeader.textContent = typeLabels[type] || type;
        controls.appendChild(sectionHeader);
      }
      const primaryId = ids[0];
      this.addStyleControlsForNativeGroup(controls, ids, primaryId, type);
    }
    const actions = document.createElement("div");
    actions.className = "style-editor-actions";
    const resetBtn = document.createElement("button");
    resetBtn.className = "style-editor-button style-editor-button-reset";
    resetBtn.textContent = "Reset Style";
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      for (const nativeId of nativeLayerIds) {
        restoreOriginalStyle(this.map, nativeId, this.state.originalStyles);
      }
      if (this.onLayerStyleChange) {
        editor.querySelectorAll("[data-property]").forEach((el) => {
          const control = el;
          const property = control.dataset.property;
          const sourceId = control.dataset.layerId;
          if (!property || !sourceId) return;
          const value = this.map.getPaintProperty(sourceId, property);
          if (value !== void 0) {
            this.notifyLayerStyleChange(
              property,
              typeof value === "number" ? value : normalizeColor(value)
            );
          }
        });
      }
      this.closeStyleEditor(layerId);
      this.openStyleEditor(layerId);
    });
    const removeBtn = document.createElement("button");
    removeBtn.className = "style-editor-button style-editor-button-remove";
    removeBtn.textContent = "Remove Layer";
    removeBtn.title = "Remove layer from map";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showRemoveConfirmation(editor, () => {
        this.closeStyleEditor(layerId);
        this.removeLayer(layerId);
      });
    });
    const closeActionBtn = document.createElement("button");
    closeActionBtn.className = "style-editor-button style-editor-button-close";
    closeActionBtn.textContent = "Close";
    closeActionBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeStyleEditor(layerId);
    });
    actions.appendChild(resetBtn);
    actions.appendChild(removeBtn);
    actions.appendChild(closeActionBtn);
    editor.appendChild(controls);
    editor.appendChild(actions);
    return editor;
  }
  /**
   * Add style controls for a group of native layers of the same type.
   * Changes to any control are applied to all layers in the group.
   */
  addStyleControlsForNativeGroup(container, layerIds, primaryLayerId, layerType) {
    this.nativeLayerGroups.set(primaryLayerId, layerIds);
    this.addStyleControlsForLayerType(container, primaryLayerId, layerType);
  }
  /**
   * Close style editor for a layer
   */
  closeStyleEditor(layerId) {
    const editor = this.styleEditors.get(layerId);
    if (editor) {
      editor.remove();
      this.styleEditors.delete(layerId);
    }
    this.nativeLayerGroups.clear();
    if (this.state.activeStyleEditor === layerId) {
      this.state.activeStyleEditor = null;
    }
  }
  /**
   * Create style editor UI
   */
  createStyleEditor(layerId) {
    const layer = this.map.getLayer(layerId);
    if (!layer) return null;
    const editor = document.createElement("div");
    editor.className = "layer-control-style-editor";
    const header = document.createElement("div");
    header.className = "style-editor-header";
    const title = document.createElement("span");
    title.className = "style-editor-title";
    title.textContent = "Edit Style";
    const closeBtn = document.createElement("button");
    closeBtn.className = "style-editor-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeStyleEditor(layerId);
    });
    header.appendChild(title);
    header.appendChild(closeBtn);
    const controls = document.createElement("div");
    controls.className = "style-editor-controls";
    const layerType = layer.type;
    this.addStyleControlsForLayerType(controls, layerId, layerType);
    const actions = document.createElement("div");
    actions.className = "style-editor-actions";
    const resetBtn = document.createElement("button");
    resetBtn.className = "style-editor-button style-editor-button-reset";
    resetBtn.textContent = "Reset Style";
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.resetLayerStyle(layerId);
    });
    const removeBtn = document.createElement("button");
    removeBtn.className = "style-editor-button style-editor-button-remove";
    removeBtn.textContent = "Remove Layer";
    removeBtn.title = "Remove layer from map";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showRemoveConfirmation(editor, () => {
        this.closeStyleEditor(layerId);
        this.removeLayer(layerId);
      });
    });
    const closeActionBtn = document.createElement("button");
    closeActionBtn.className = "style-editor-button style-editor-button-close";
    closeActionBtn.textContent = "Close";
    closeActionBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeStyleEditor(layerId);
    });
    actions.appendChild(resetBtn);
    actions.appendChild(removeBtn);
    actions.appendChild(closeActionBtn);
    editor.appendChild(header);
    editor.appendChild(controls);
    editor.appendChild(actions);
    return editor;
  }
  /**
   * Add style controls based on layer type
   */
  addStyleControlsForLayerType(container, layerId, layerType) {
    switch (layerType) {
      case "fill":
        this.addFillControls(container, layerId);
        break;
      case "line":
        this.addLineControls(container, layerId);
        break;
      case "circle":
        this.addCircleControls(container, layerId);
        break;
      case "raster":
        this.addRasterControls(container, layerId);
        break;
      case "symbol":
        this.addSymbolControls(container, layerId);
        break;
      default:
        container.textContent = `Style controls for ${layerType} layers not yet implemented.`;
    }
  }
  /**
   * Add controls for fill layers
   */
  addFillControls(container, layerId) {
    var _a;
    const style = this.map.getStyle();
    const layer = (_a = style.layers) == null ? void 0 : _a.find((l) => l.id === layerId);
    let fillColor = void 0;
    if (layer && "paint" in layer && layer.paint && "fill-color" in layer.paint) {
      fillColor = layer.paint["fill-color"];
    }
    if (!fillColor) {
      fillColor = this.map.getPaintProperty(layerId, "fill-color");
    }
    this.createColorControl(
      container,
      layerId,
      "fill-color",
      "Fill Color",
      normalizeColor(fillColor || "#088")
    );
    const fillOpacity = this.map.getPaintProperty(layerId, "fill-opacity");
    if (fillOpacity !== void 0 && typeof fillOpacity === "number") {
      this.createSliderControl(
        container,
        layerId,
        "fill-opacity",
        "Fill Opacity",
        fillOpacity,
        0,
        1,
        0.05
      );
    }
    const outlineColor = this.map.getPaintProperty(
      layerId,
      "fill-outline-color"
    );
    if (outlineColor !== void 0) {
      this.createColorControl(
        container,
        layerId,
        "fill-outline-color",
        "Outline Color",
        normalizeColor(outlineColor)
      );
    }
  }
  /**
   * Add controls for line layers
   */
  addLineControls(container, layerId) {
    var _a;
    const style = this.map.getStyle();
    const layer = (_a = style.layers) == null ? void 0 : _a.find((l) => l.id === layerId);
    let lineColor = void 0;
    if (layer && "paint" in layer && layer.paint && "line-color" in layer.paint) {
      lineColor = layer.paint["line-color"];
    }
    if (!lineColor) {
      lineColor = this.map.getPaintProperty(layerId, "line-color");
    }
    this.createColorControl(
      container,
      layerId,
      "line-color",
      "Line Color",
      normalizeColor(lineColor || "#000")
    );
    const lineWidth = this.map.getPaintProperty(layerId, "line-width");
    this.createSliderControl(
      container,
      layerId,
      "line-width",
      "Line Width",
      typeof lineWidth === "number" ? lineWidth : 1,
      0,
      20,
      0.5
    );
    const lineOpacity = this.map.getPaintProperty(layerId, "line-opacity");
    if (lineOpacity !== void 0 && typeof lineOpacity === "number") {
      this.createSliderControl(
        container,
        layerId,
        "line-opacity",
        "Line Opacity",
        lineOpacity,
        0,
        1,
        0.05
      );
    }
    const lineBlur = this.map.getPaintProperty(layerId, "line-blur");
    if (lineBlur !== void 0 && typeof lineBlur === "number") {
      this.createSliderControl(
        container,
        layerId,
        "line-blur",
        "Line Blur",
        lineBlur,
        0,
        5,
        0.1
      );
    }
  }
  /**
   * Add controls for circle layers
   */
  addCircleControls(container, layerId) {
    var _a;
    const style = this.map.getStyle();
    const layer = (_a = style.layers) == null ? void 0 : _a.find((l) => l.id === layerId);
    let circleColor = void 0;
    if (layer && "paint" in layer && layer.paint && "circle-color" in layer.paint) {
      circleColor = layer.paint["circle-color"];
    }
    if (!circleColor) {
      circleColor = this.map.getPaintProperty(layerId, "circle-color");
    }
    this.createColorControl(
      container,
      layerId,
      "circle-color",
      "Circle Color",
      normalizeColor(circleColor || "#000")
    );
    const circleRadius = this.map.getPaintProperty(layerId, "circle-radius");
    this.createSliderControl(
      container,
      layerId,
      "circle-radius",
      "Radius",
      typeof circleRadius === "number" ? circleRadius : 5,
      0,
      40,
      0.5
    );
    const circleOpacity = this.map.getPaintProperty(layerId, "circle-opacity");
    if (circleOpacity !== void 0 && typeof circleOpacity === "number") {
      this.createSliderControl(
        container,
        layerId,
        "circle-opacity",
        "Opacity",
        circleOpacity,
        0,
        1,
        0.05
      );
    }
    const strokeColor = this.map.getPaintProperty(
      layerId,
      "circle-stroke-color"
    );
    if (strokeColor !== void 0) {
      this.createColorControl(
        container,
        layerId,
        "circle-stroke-color",
        "Stroke Color",
        normalizeColor(strokeColor)
      );
    }
    const strokeWidth = this.map.getPaintProperty(
      layerId,
      "circle-stroke-width"
    );
    if (strokeWidth !== void 0 && typeof strokeWidth === "number") {
      this.createSliderControl(
        container,
        layerId,
        "circle-stroke-width",
        "Stroke Width",
        strokeWidth,
        0,
        10,
        0.1
      );
    }
  }
  /**
   * Add controls for raster layers
   */
  addRasterControls(container, layerId) {
    const rasterOpacity = this.map.getPaintProperty(layerId, "raster-opacity");
    this.createSliderControl(
      container,
      layerId,
      "raster-opacity",
      "Opacity",
      typeof rasterOpacity === "number" ? rasterOpacity : 1,
      0,
      1,
      0.05
    );
    const brightnessMin = this.map.getPaintProperty(
      layerId,
      "raster-brightness-min"
    );
    this.createSliderControl(
      container,
      layerId,
      "raster-brightness-min",
      "Brightness Min",
      typeof brightnessMin === "number" ? brightnessMin : 0,
      -1,
      1,
      0.05
    );
    const brightnessMax = this.map.getPaintProperty(
      layerId,
      "raster-brightness-max"
    );
    this.createSliderControl(
      container,
      layerId,
      "raster-brightness-max",
      "Brightness Max",
      typeof brightnessMax === "number" ? brightnessMax : 1,
      -1,
      1,
      0.05
    );
    const saturation = this.map.getPaintProperty(layerId, "raster-saturation");
    this.createSliderControl(
      container,
      layerId,
      "raster-saturation",
      "Saturation",
      typeof saturation === "number" ? saturation : 0,
      -1,
      1,
      0.05
    );
    const contrast = this.map.getPaintProperty(layerId, "raster-contrast");
    this.createSliderControl(
      container,
      layerId,
      "raster-contrast",
      "Contrast",
      typeof contrast === "number" ? contrast : 0,
      -1,
      1,
      0.05
    );
    const hueRotate = this.map.getPaintProperty(layerId, "raster-hue-rotate");
    this.createSliderControl(
      container,
      layerId,
      "raster-hue-rotate",
      "Hue Rotate",
      typeof hueRotate === "number" ? hueRotate : 0,
      0,
      350,
      5
    );
  }
  /**
   * Add controls for symbol layers
   */
  addSymbolControls(container, layerId) {
    const textColor = this.map.getPaintProperty(layerId, "text-color");
    if (textColor !== void 0) {
      this.createColorControl(
        container,
        layerId,
        "text-color",
        "Text Color",
        normalizeColor(textColor)
      );
    }
    const textOpacity = this.map.getPaintProperty(layerId, "text-opacity");
    if (textOpacity !== void 0 && typeof textOpacity === "number") {
      this.createSliderControl(
        container,
        layerId,
        "text-opacity",
        "Text Opacity",
        textOpacity,
        0,
        1,
        0.05
      );
    }
    const iconOpacity = this.map.getPaintProperty(layerId, "icon-opacity");
    if (iconOpacity !== void 0 && typeof iconOpacity === "number") {
      this.createSliderControl(
        container,
        layerId,
        "icon-opacity",
        "Icon Opacity",
        iconOpacity,
        0,
        1,
        0.05
      );
    }
  }
  /**
   * Notify the host that a paint property changed through the style editor.
   * Reports the layer the active style editor belongs to (`activeStyleEditor`),
   * not the internal native sub-layer id a control may edit, so consumers can
   * map the change back to their own layer model.
   */
  notifyLayerStyleChange(property, value) {
    const layerId = this.state.activeStyleEditor;
    if (layerId && this.onLayerStyleChange) {
      this.onLayerStyleChange(layerId, property, value);
    }
  }
  /**
   * Re-read an open style editor's controls from the current map paint so they
   * reflect changes made elsewhere (e.g. an external sidebar writing the same
   * paint properties). Setting input `.value` programmatically does not
   * dispatch an `input` event, so this never re-triggers
   * {@link LayerControlOptions.onLayerStyleChange}. The control the user is
   * actively dragging (the focused input) is left untouched so the refresh
   * does not fight an in-progress drag.
   *
   * @param layerId Restrict the refresh to one layer's editor. Defaults to the
   *   currently active editor. No-op when that editor is not open.
   */
  refreshStyleEditor(layerId) {
    const targetId = layerId ?? this.state.activeStyleEditor;
    if (!targetId) return;
    const editor = this.styleEditors.get(targetId);
    if (editor) {
      this.syncStyleEditorControlsFromMap(editor);
    }
  }
  /**
   * Update every slider/color control in a style editor from the layer's
   * current map paint. Each control records the layer it reads from in
   * `dataset.layerId` (see createSliderControl/createColorControl).
   */
  syncStyleEditorControlsFromMap(editor) {
    const active = document.activeElement;
    const sliders = editor.querySelectorAll(
      ".style-control-slider"
    );
    sliders.forEach((slider) => {
      var _a;
      if (slider === active) return;
      const property = slider.dataset.property;
      const sourceId = slider.dataset.layerId;
      if (!property || !sourceId) return;
      const value = this.map.getPaintProperty(sourceId, property);
      if (typeof value === "number") {
        slider.value = String(value);
        const valueDisplay = (_a = slider.parentElement) == null ? void 0 : _a.querySelector(
          ".style-control-value"
        );
        if (valueDisplay) {
          const step = parseFloat(slider.step);
          valueDisplay.textContent = formatNumericValue(value, step);
        }
      }
    });
    const colorPickers = editor.querySelectorAll(
      ".style-control-color-picker"
    );
    colorPickers.forEach((picker) => {
      var _a;
      if (picker === active) return;
      const property = picker.dataset.property;
      const sourceId = picker.dataset.layerId;
      if (!property || !sourceId) return;
      const value = this.map.getPaintProperty(sourceId, property);
      if (value !== void 0) {
        const hexColor = normalizeColor(value);
        picker.value = hexColor;
        const hexDisplay = (_a = picker.parentElement) == null ? void 0 : _a.querySelector(
          ".style-control-color-value"
        );
        if (hexDisplay) hexDisplay.value = hexColor;
      }
    });
  }
  /**
   * Create a color control
   */
  createColorControl(container, layerId, property, label, initialValue) {
    const controlGroup = document.createElement("div");
    controlGroup.className = "style-control-group";
    const labelEl = document.createElement("label");
    labelEl.className = "style-control-label";
    labelEl.textContent = label;
    const inputWrapper = document.createElement("div");
    inputWrapper.className = "style-control-color-group";
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "style-control-color-picker";
    colorInput.value = initialValue;
    colorInput.dataset.property = property;
    colorInput.dataset.layerId = layerId;
    const hexDisplay = document.createElement("input");
    hexDisplay.type = "text";
    hexDisplay.className = "style-control-color-value";
    hexDisplay.value = initialValue;
    hexDisplay.readOnly = true;
    colorInput.addEventListener("input", () => {
      const color = colorInput.value;
      hexDisplay.value = color;
      const targetIds = this.nativeLayerGroups.get(layerId) || [layerId];
      for (const id of targetIds) {
        this.map.setPaintProperty(id, property, color);
      }
      this.notifyLayerStyleChange(property, color);
    });
    inputWrapper.appendChild(colorInput);
    inputWrapper.appendChild(hexDisplay);
    controlGroup.appendChild(labelEl);
    controlGroup.appendChild(inputWrapper);
    container.appendChild(controlGroup);
  }
  /**
   * Create a slider control
   */
  createSliderControl(container, layerId, property, label, initialValue, min, max, step) {
    const controlGroup = document.createElement("div");
    controlGroup.className = "style-control-group";
    const labelEl = document.createElement("label");
    labelEl.className = "style-control-label";
    labelEl.textContent = label;
    const inputWrapper = document.createElement("div");
    inputWrapper.className = "style-control-input-wrapper";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "style-control-slider";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(initialValue);
    slider.dataset.property = property;
    slider.dataset.layerId = layerId;
    const valueDisplay = document.createElement("span");
    valueDisplay.className = "style-control-value";
    valueDisplay.textContent = formatNumericValue(initialValue, step);
    slider.addEventListener("input", () => {
      const value = parseFloat(slider.value);
      valueDisplay.textContent = formatNumericValue(value, step);
      const targetIds = this.nativeLayerGroups.get(layerId) || [layerId];
      for (const id of targetIds) {
        this.map.setPaintProperty(id, property, value);
      }
      this.notifyLayerStyleChange(property, value);
    });
    inputWrapper.appendChild(slider);
    inputWrapper.appendChild(valueDisplay);
    controlGroup.appendChild(labelEl);
    controlGroup.appendChild(inputWrapper);
    container.appendChild(controlGroup);
  }
  /**
   * Reset layer style to original
   */
  resetLayerStyle(layerId) {
    const originalStyle = this.state.originalStyles.get(layerId);
    if (!originalStyle) return;
    restoreOriginalStyle(this.map, layerId, this.state.originalStyles);
    const editor = this.styleEditors.get(layerId);
    if (editor) {
      const sliders = editor.querySelectorAll(
        ".style-control-slider"
      );
      sliders.forEach((slider) => {
        var _a;
        const property = slider.dataset.property;
        if (property) {
          const value = this.map.getPaintProperty(layerId, property);
          if (value !== void 0 && typeof value === "number") {
            slider.value = String(value);
            const valueDisplay = (_a = slider.parentElement) == null ? void 0 : _a.querySelector(
              ".style-control-value"
            );
            if (valueDisplay) {
              const step = parseFloat(slider.step);
              valueDisplay.textContent = formatNumericValue(value, step);
            }
            this.notifyLayerStyleChange(property, value);
          }
        }
      });
      const colorPickers = editor.querySelectorAll(
        ".style-control-color-picker"
      );
      colorPickers.forEach((picker) => {
        var _a;
        const property = picker.dataset.property;
        if (property) {
          const value = this.map.getPaintProperty(layerId, property);
          if (value !== void 0) {
            const hexColor = normalizeColor(value);
            picker.value = hexColor;
            const hexDisplay = (_a = picker.parentElement) == null ? void 0 : _a.querySelector(
              ".style-control-color-value"
            );
            if (hexDisplay) {
              hexDisplay.value = hexColor;
            }
            this.notifyLayerStyleChange(property, hexColor);
          }
        }
      });
    }
  }
  /**
   * Update layer states from map (sync UI with map)
   */
  updateLayerStatesFromMap() {
    if (this.state.userInteractingWithSlider) {
      return;
    }
    Object.keys(this.state.layerStates).forEach((layerId) => {
      var _a;
      try {
        if ((_a = this.state.layerStates[layerId]) == null ? void 0 : _a.isCustomLayer) {
          return;
        }
        if (layerId === "Background") {
          return;
        }
        const layer = this.map.getLayer(layerId);
        if (!layer) return;
        const visibility = this.map.getLayoutProperty(layerId, "visibility");
        const isVisible = visibility !== "none";
        const layerType = layer.type;
        const opacity = getLayerOpacity(this.map, layerId, layerType);
        if (this.state.layerStates[layerId]) {
          this.state.layerStates[layerId].visible = isVisible;
          this.state.layerStates[layerId].opacity = opacity;
        }
        this.updateUIForLayer(layerId, isVisible, opacity);
      } catch (error) {
        console.warn(`Failed to update state for layer ${layerId}:`, error);
      }
    });
  }
  /**
   * Update UI elements for a specific layer
   */
  updateUIForLayer(layerId, visible, opacity) {
    const layerItems = this.panel.querySelectorAll(".layer-control-item");
    layerItems.forEach((item) => {
      if (item.dataset.layerId === layerId) {
        const checkbox = item.querySelector(
          ".layer-control-checkbox"
        );
        const opacitySlider = item.querySelector(
          ".layer-control-opacity"
        );
        if (checkbox) {
          checkbox.checked = visible;
        }
        if (opacitySlider) {
          opacitySlider.value = String(opacity);
          opacitySlider.title = `Opacity: ${Math.round(opacity * 100)}%`;
        }
      }
    });
  }
  /**
   * Check for new layers and add them to the control, remove deleted layers
   */
  checkForNewLayers() {
    if (this.state.isStyleOperationInProgress) {
      return;
    }
    try {
      const style = this.map.getStyle();
      if (!style || !style.layers) {
        return;
      }
      const currentMapLayerIds = new Set(style.layers.map((layer) => layer.id));
      const isAutoDetectMode = this.targetLayers.length === 0 || this.targetLayers.length === 1 && this.targetLayers[0] === "Background" || this.targetLayers.every(
        (id) => id === "Background" || this.state.layerStates[id]
      );
      let layersAdded = false;
      const newLayers = [];
      const useBasemapStyleDetection = this.basemapLayerIds !== null && this.basemapLayerIds.size > 0;
      const useInitialLayerDetection = !useBasemapStyleDetection && this.initialLayerIds !== null && this.initialLayerIds.size > 0;
      currentMapLayerIds.forEach((layerId) => {
        if (layerId !== "Background" && !this.state.layerStates[layerId]) {
          const layer = this.map.getLayer(layerId);
          if (layer) {
            if (this.initialLayerIds !== null && this.initialLayerIds.has(layerId)) {
              return;
            }
            if (isAutoDetectMode) {
              if (this.excludeDrawnLayers && this.isDrawnLayer(layerId)) {
                return;
              }
              if (this.isExcludedByPattern(layerId)) {
                return;
              }
              if (!this.isUserAddedLayer(layerId)) {
                return;
              }
              if (useBasemapStyleDetection) {
                if (this.basemapLayerIds.has(layerId)) {
                  return;
                }
              } else if (useInitialLayerDetection) {
                if (this.initialLayerIds.has(layerId)) {
                  const userAddedSourceIds = this.detectUserAddedSources();
                  const sourceId = layer.source;
                  if (!sourceId || !userAddedSourceIds.has(sourceId)) {
                    return;
                  }
                }
              } else {
                const userAddedSourceIds = this.detectUserAddedSources();
                const sourceId = layer.source;
                if (!sourceId || !userAddedSourceIds.has(sourceId)) {
                  return;
                }
              }
            }
            newLayers.push(layerId);
          }
        }
      });
      const removedLayers = [];
      Object.keys(this.state.layerStates).forEach((layerId) => {
        const state = this.state.layerStates[layerId];
        if (layerId !== "Background" && !state.isCustomLayer && !currentMapLayerIds.has(layerId)) {
          removedLayers.push(layerId);
        }
      });
      if (removedLayers.length > 0) {
        removedLayers.forEach((layerId) => {
          delete this.state.layerStates[layerId];
          const itemEl = this.panel.querySelector(
            `[data-layer-id="${layerId}"]`
          );
          if (itemEl) {
            itemEl.remove();
          }
          if (this.state.activeStyleEditor === layerId) {
            this.state.activeStyleEditor = null;
          }
          this.styleEditors.delete(layerId);
        });
      }
      if (newLayers.length > 0) {
        newLayers.forEach((layerId) => {
          const layer = this.map.getLayer(layerId);
          if (!layer) return;
          const layerType = layer.type;
          const opacity = getLayerOpacity(this.map, layerId, layerType);
          const visibility = this.map.getLayoutProperty(layerId, "visibility");
          const isVisible = visibility !== "none";
          this.state.layerStates[layerId] = {
            visible: isVisible,
            opacity,
            name: this.generateFriendlyName(layerId)
          };
          if (this.targetLayers.length > 0 && !this.targetLayers.includes(layerId)) {
            this.targetLayers.push(layerId);
          }
          layersAdded = true;
        });
      }
      if (this.customLayerRegistry) {
        const customLayerIds = this.customLayerRegistry.getAllLayerIds();
        customLayerIds.forEach((layerId) => {
          if (!this.state.layerStates[layerId] && !this.removedCustomLayerIds.has(layerId)) {
            const customState = this.customLayerRegistry.getLayerState(layerId);
            if (customState) {
              this.state.layerStates[layerId] = {
                visible: customState.visible,
                opacity: customState.opacity,
                name: customState.name,
                isCustomLayer: true,
                customLayerType: this.customLayerRegistry.getSymbolType(layerId) || void 0
              };
              if (this.targetLayers.length > 0 && !this.targetLayers.includes(layerId)) {
                this.targetLayers.push(layerId);
              }
              layersAdded = true;
            }
          }
        });
        Object.keys(this.state.layerStates).forEach((layerId) => {
          const state = this.state.layerStates[layerId];
          if (state.isCustomLayer && !customLayerIds.includes(layerId)) {
            delete this.state.layerStates[layerId];
            const itemEl = this.panel.querySelector(
              `[data-layer-id="${layerId}"]`
            );
            if (itemEl) {
              itemEl.remove();
            }
            if (this.state.activeStyleEditor === layerId) {
              this.state.activeStyleEditor = null;
            }
            this.styleEditors.delete(layerId);
          }
        });
      }
      if (layersAdded) {
        this.buildLayerItems();
      } else {
        this.pruneEmptyGroups();
      }
    } catch (error) {
      console.warn("Failed to check for new layers:", error);
    }
  }
  /**
   * Register a custom layer adapter dynamically.
   * This allows adding adapters after the LayerControl has been initialized.
   * @param adapter The custom layer adapter to register
   */
  registerCustomAdapter(adapter) {
    if (!this.customLayerRegistry) {
      this.customLayerRegistry = new CustomLayerRegistry();
      this.customLayerUnsubscribe = this.customLayerRegistry.onChange(
        (event, layerId) => {
          if (event === "add" && layerId) {
            this.removedCustomLayerIds.delete(layerId);
          }
          this.checkForNewLayers();
        }
      );
    }
    this.customLayerRegistry.register(adapter);
    if (this.panel) {
      this.checkForNewLayers();
    }
  }
  // ===== Context Menu Methods =====
  /**
   * Create context menu element
   */
  createContextMenu() {
    const menu = document.createElement("div");
    menu.className = "layer-control-context-menu";
    menu.style.display = "none";
    const renameItem = this.createContextMenuItem("Rename", "✏️", () => {
      if (this.state.contextMenu.targetLayerId) {
        this.startRenaming(this.state.contextMenu.targetLayerId);
      }
      this.hideContextMenu();
    });
    const zoomItem = this.createContextMenuItem("Zoom to Layer", "🔍", () => {
      if (this.state.contextMenu.targetLayerId) {
        this.zoomToLayer(this.state.contextMenu.targetLayerId);
      }
      this.hideContextMenu();
    });
    const sep1 = document.createElement("div");
    sep1.className = "context-menu-separator";
    const moveUpItem = this.createContextMenuItem("Move Up", "↑", () => {
      if (this.state.contextMenu.targetLayerId) {
        this.moveLayerUp(this.state.contextMenu.targetLayerId);
      }
      this.hideContextMenu();
    });
    const moveTopItem = this.createContextMenuItem("Move to Top", "⤒", () => {
      if (this.state.contextMenu.targetLayerId) {
        this.moveLayerToTop(this.state.contextMenu.targetLayerId);
      }
      this.hideContextMenu();
    });
    const moveDownItem = this.createContextMenuItem("Move Down", "↓", () => {
      if (this.state.contextMenu.targetLayerId) {
        this.moveLayerDown(this.state.contextMenu.targetLayerId);
      }
      this.hideContextMenu();
    });
    const moveBottomItem = this.createContextMenuItem(
      "Move to Bottom",
      "⤓",
      () => {
        if (this.state.contextMenu.targetLayerId) {
          this.moveLayerToBottom(this.state.contextMenu.targetLayerId);
        }
        this.hideContextMenu();
      }
    );
    const sep2 = document.createElement("div");
    sep2.className = "context-menu-separator";
    const removeItem = this.createContextMenuItem(
      "Remove Layer",
      "🗑️",
      () => {
        if (this.state.contextMenu.targetLayerId) {
          this.removeLayer(this.state.contextMenu.targetLayerId);
        }
        this.hideContextMenu();
      },
      true
    );
    menu.appendChild(renameItem);
    menu.appendChild(zoomItem);
    menu.appendChild(sep1);
    menu.appendChild(moveUpItem);
    menu.appendChild(moveTopItem);
    menu.appendChild(moveDownItem);
    menu.appendChild(moveBottomItem);
    menu.appendChild(sep2);
    menu.appendChild(removeItem);
    return menu;
  }
  /**
   * Create a context menu item
   */
  createContextMenuItem(label, icon, onClick, isDanger = false) {
    const item = document.createElement("div");
    item.className = "context-menu-item" + (isDanger ? " context-menu-item-danger" : "");
    const iconEl = document.createElement("span");
    iconEl.className = "context-menu-item-icon";
    iconEl.textContent = icon;
    const labelEl = document.createElement("span");
    labelEl.className = "context-menu-item-label";
    labelEl.textContent = label;
    item.appendChild(iconEl);
    item.appendChild(labelEl);
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return item;
  }
  /**
   * Show context menu at position
   */
  showContextMenu(layerId, x, y) {
    if (!this.contextMenuEl) return;
    this.state.contextMenu = {
      visible: true,
      targetLayerId: layerId,
      x,
      y
    };
    const mapRect = this.mapContainer.getBoundingClientRect();
    let menuX = x - mapRect.left;
    let menuY = y - mapRect.top;
    this.contextMenuEl.style.display = "block";
    const menuRect = this.contextMenuEl.getBoundingClientRect();
    if (menuX + menuRect.width > mapRect.width) {
      menuX = mapRect.width - menuRect.width - 5;
    }
    if (menuY + menuRect.height > mapRect.height) {
      menuY = mapRect.height - menuRect.height - 5;
    }
    this.contextMenuEl.style.left = `${menuX}px`;
    this.contextMenuEl.style.top = `${menuY}px`;
  }
  /**
   * Hide context menu
   */
  hideContextMenu() {
    if (!this.contextMenuEl) return;
    this.state.contextMenu = {
      visible: false,
      targetLayerId: null,
      x: 0,
      y: 0
    };
    this.contextMenuEl.style.display = "none";
  }
  /**
   * Start renaming a layer
   */
  startRenaming(layerId) {
    var _a;
    const itemEl = this.panel.querySelector(`[data-layer-id="${layerId}"]`);
    if (!itemEl) return;
    const nameEl = itemEl.querySelector(".layer-control-name");
    if (!nameEl) return;
    this.state.renamingLayerId = layerId;
    const currentName = this.state.customLayerNames.get(layerId) || ((_a = this.state.layerStates[layerId]) == null ? void 0 : _a.name) || layerId;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "layer-control-name-input";
    input.value = currentName;
    const finishRename = () => {
      var _a2;
      const newName = input.value.trim() || currentName;
      const oldName = currentName;
      if (newName !== oldName) {
        this.state.customLayerNames.set(layerId, newName);
        if (this.state.layerStates[layerId]) {
          this.state.layerStates[layerId].name = newName;
        }
        (_a2 = this.onLayerRename) == null ? void 0 : _a2.call(this, layerId, oldName, newName);
      }
      const newNameEl = document.createElement("span");
      newNameEl.className = "layer-control-name";
      newNameEl.textContent = newName;
      newNameEl.title = newName;
      input.replaceWith(newNameEl);
      this.state.renamingLayerId = null;
    };
    input.addEventListener("blur", finishRename);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finishRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        const newNameEl = document.createElement("span");
        newNameEl.className = "layer-control-name";
        newNameEl.textContent = currentName;
        newNameEl.title = currentName;
        input.replaceWith(newNameEl);
        this.state.renamingLayerId = null;
      }
    });
    nameEl.replaceWith(input);
    input.focus();
    input.select();
  }
  /**
   * Zoom to a layer's bounds
   */
  zoomToLayer(layerId) {
    const layerState = this.state.layerStates[layerId];
    if ((layerState == null ? void 0 : layerState.isCustomLayer) && this.customLayerRegistry) {
      const bounds = this.customLayerRegistry.getBounds(layerId);
      if (bounds) {
        this.map.fitBounds(bounds, {
          padding: 50
        });
        return;
      }
    }
    const layer = this.map.getLayer(layerId);
    if (!layer) return;
    try {
      const sourceId = layer.source;
      let features = sourceId ? this.map.querySourceFeatures(sourceId) : [];
      if (features.length === 0) {
        features = this.map.queryRenderedFeatures({ layers: [layerId] });
      }
      if (features.length === 0) return;
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      features.forEach((feature) => {
        if (!feature.geometry) return;
        const processCoords = (coords) => {
          if (typeof coords[0] === "number") {
            const [lng, lat] = coords;
            minLng = Math.min(minLng, lng);
            minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng);
            maxLat = Math.max(maxLat, lat);
          } else {
            coords.forEach(processCoords);
          }
        };
        if (feature.geometry.type === "Point") {
          processCoords(feature.geometry.coordinates);
        } else if (feature.geometry.type === "LineString" || feature.geometry.type === "MultiPoint") {
          feature.geometry.coordinates.forEach(processCoords);
        } else if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiLineString") {
          feature.geometry.coordinates.forEach(
            (ring) => ring.forEach(processCoords)
          );
        } else if (feature.geometry.type === "MultiPolygon") {
          feature.geometry.coordinates.forEach(
            (polygon) => polygon.forEach((ring) => ring.forEach(processCoords))
          );
        }
      });
      if (minLng !== Infinity && minLat !== Infinity && maxLng !== -Infinity && maxLat !== -Infinity) {
        this.map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat]
          ],
          { padding: 50 }
        );
      }
    } catch (error) {
      console.warn(`Failed to zoom to layer ${layerId}:`, error);
    }
  }
  /**
   * Get user layer IDs in current map order (top to bottom in UI = high z-index to low)
   * Includes both MapLibre layers and custom layers managed by adapters.
   */
  getUserLayerIdsInMapOrder() {
    var _a;
    const style = this.map.getStyle();
    if (!(style == null ? void 0 : style.layers)) return [];
    const mapLayerIds = style.layers.map((l) => l.id);
    const indexById = new Map(mapLayerIds.map((id, i) => [id, i]));
    const userLayerIds = Object.keys(this.state.layerStates).filter(
      (id) => id !== "Background"
    );
    const resolvedIndexOf = (id) => {
      var _a2;
      const direct = indexById.get(id);
      if (direct !== void 0) return direct;
      const nativeIds = (_a2 = this.customLayerRegistry) == null ? void 0 : _a2.getNativeLayerIds(id);
      if (nativeIds && nativeIds.length > 0) {
        let best = -1;
        for (const nativeId of nativeIds) {
          const idx = indexById.get(nativeId);
          if (idx !== void 0 && idx > best) best = idx;
        }
        if (best !== -1) return best;
      }
      return void 0;
    };
    const anchors = /* @__PURE__ */ new Map();
    for (const group of ((_a = this.customLayerRegistry) == null ? void 0 : _a.getLayerIdGroups()) ?? []) {
      const resolved = group.map(resolvedIndexOf);
      const known = resolved.filter((idx) => idx !== void 0);
      if (known.length === 0) continue;
      const ids = known[0] > known[known.length - 1] ? [...group].reverse() : group;
      const indexes = ids === group ? resolved : [...resolved].reverse();
      ids.forEach((id, position) => {
        if (indexes[position] !== void 0) return;
        for (let below = position - 1; below >= 0; below--) {
          const idx = indexes[below];
          if (idx !== void 0) {
            anchors.set(id, { mapIndex: idx, offset: position - below });
            return;
          }
        }
        for (let above = position + 1; above < ids.length; above++) {
          const idx = indexes[above];
          if (idx !== void 0) {
            anchors.set(id, { mapIndex: idx, offset: position - above });
            return;
          }
        }
      });
    }
    const stackKeyOf = (id) => {
      const resolved = resolvedIndexOf(id);
      if (resolved !== void 0) return { mapIndex: resolved, offset: 0 };
      return anchors.get(id) ?? { mapIndex: Number.POSITIVE_INFINITY, offset: 0 };
    };
    return userLayerIds.map((id, insertionIndex) => ({
      id,
      insertionIndex,
      ...stackKeyOf(id)
    })).sort((a, b) => {
      if (a.mapIndex !== b.mapIndex) return a.mapIndex > b.mapIndex ? -1 : 1;
      if (a.offset !== b.offset) return b.offset - a.offset;
      return a.insertionIndex - b.insertionIndex;
    }).map((entry) => entry.id);
  }
  /**
   * Check if a layer is a MapLibre layer (not a custom layer)
   */
  isMapLibreLayer(layerId) {
    return this.map.getLayer(layerId) !== void 0;
  }
  /**
   * Find the next MapLibre layer ID in a direction from a given index
   * @param layerIds Array of layer IDs
   * @param startIndex Index to start searching from
   * @param direction 1 for forward (toward bottom), -1 for backward (toward top)
   * @returns MapLibre layer ID or undefined if not found
   */
  findNextMapLibreLayer(layerIds, startIndex, direction) {
    for (let i = startIndex; direction === 1 ? i < layerIds.length : i >= 0; i += direction) {
      if (this.isMapLibreLayer(layerIds[i])) {
        return layerIds[i];
      }
    }
    return void 0;
  }
  /**
   * Move a layer up in UI (higher rendering order = move to higher z-index)
   */
  moveLayerUp(layerId) {
    var _a, _b;
    if (this.groupStates.size > 0) {
      this.moveLayerWithinGroup(layerId, "up");
      return;
    }
    const layerIds = this.getUserLayerIdsInMapOrder();
    const index = layerIds.indexOf(layerId);
    if (index <= 0) return;
    const isCustom = (_a = this.state.layerStates[layerId]) == null ? void 0 : _a.isCustomLayer;
    if (!isCustom && this.isMapLibreLayer(layerId)) {
      try {
        const targetBeforeId = index >= 2 ? this.findNextMapLibreLayer(layerIds, index - 2, -1) : void 0;
        this.map.moveLayer(layerId, targetBeforeId);
      } catch (e) {
      }
    }
    const newLayerStates = {};
    const orderedIds = [...layerIds];
    [orderedIds[index], orderedIds[index - 1]] = [
      orderedIds[index - 1],
      orderedIds[index]
    ];
    if (this.state.layerStates["Background"]) {
      newLayerStates["Background"] = this.state.layerStates["Background"];
    }
    orderedIds.forEach((id) => {
      if (this.state.layerStates[id]) {
        newLayerStates[id] = this.state.layerStates[id];
      }
    });
    this.state.layerStates = newLayerStates;
    this.buildLayerItems();
    (_b = this.onLayerReorder) == null ? void 0 : _b.call(this, orderedIds);
  }
  /**
   * Move a layer to the top (highest rendering order)
   */
  moveLayerToTop(layerId) {
    var _a, _b;
    if (this.groupStates.size > 0) {
      this.moveLayerWithinGroup(layerId, "top");
      return;
    }
    const layerIds = this.getUserLayerIdsInMapOrder();
    const index = layerIds.indexOf(layerId);
    if (index <= 0) return;
    const isCustom = (_a = this.state.layerStates[layerId]) == null ? void 0 : _a.isCustomLayer;
    if (!isCustom && this.isMapLibreLayer(layerId)) {
      try {
        this.map.moveLayer(layerId);
      } catch (e) {
      }
    }
    const newLayerStates = {};
    const orderedIds = [...layerIds];
    orderedIds.splice(index, 1);
    orderedIds.unshift(layerId);
    if (this.state.layerStates["Background"]) {
      newLayerStates["Background"] = this.state.layerStates["Background"];
    }
    orderedIds.forEach((id) => {
      if (this.state.layerStates[id]) {
        newLayerStates[id] = this.state.layerStates[id];
      }
    });
    this.state.layerStates = newLayerStates;
    this.buildLayerItems();
    (_b = this.onLayerReorder) == null ? void 0 : _b.call(this, orderedIds);
  }
  /**
   * Move a layer down in UI (lower rendering order = move to lower z-index)
   */
  moveLayerDown(layerId) {
    var _a, _b;
    if (this.groupStates.size > 0) {
      this.moveLayerWithinGroup(layerId, "down");
      return;
    }
    const layerIds = this.getUserLayerIdsInMapOrder();
    const index = layerIds.indexOf(layerId);
    if (index < 0 || index >= layerIds.length - 1) return;
    const isCustom = (_a = this.state.layerStates[layerId]) == null ? void 0 : _a.isCustomLayer;
    if (!isCustom && this.isMapLibreLayer(layerId)) {
      const belowLayerId = this.findNextMapLibreLayer(layerIds, index + 1, 1);
      if (belowLayerId) {
        try {
          this.map.moveLayer(layerId, belowLayerId);
        } catch (e) {
        }
      }
    }
    const newLayerStates = {};
    const orderedIds = [...layerIds];
    [orderedIds[index], orderedIds[index + 1]] = [
      orderedIds[index + 1],
      orderedIds[index]
    ];
    if (this.state.layerStates["Background"]) {
      newLayerStates["Background"] = this.state.layerStates["Background"];
    }
    orderedIds.forEach((id) => {
      if (this.state.layerStates[id]) {
        newLayerStates[id] = this.state.layerStates[id];
      }
    });
    this.state.layerStates = newLayerStates;
    this.buildLayerItems();
    (_b = this.onLayerReorder) == null ? void 0 : _b.call(this, orderedIds);
  }
  /**
   * Move a layer to the bottom (lowest rendering order among user layers)
   */
  moveLayerToBottom(layerId) {
    var _a, _b;
    if (this.groupStates.size > 0) {
      this.moveLayerWithinGroup(layerId, "bottom");
      return;
    }
    const layerIds = this.getUserLayerIdsInMapOrder();
    if (layerIds.length <= 1) return;
    const index = layerIds.indexOf(layerId);
    if (index < 0 || index === layerIds.length - 1) return;
    const isCustom = (_a = this.state.layerStates[layerId]) == null ? void 0 : _a.isCustomLayer;
    if (!isCustom && this.isMapLibreLayer(layerId)) {
      const bottomLayerId = this.findNextMapLibreLayer(
        layerIds,
        layerIds.length - 1,
        -1
      );
      if (bottomLayerId && bottomLayerId !== layerId) {
        try {
          this.map.moveLayer(layerId, bottomLayerId);
        } catch (e) {
        }
      }
    }
    const newLayerStates = {};
    const orderedIds = [...layerIds];
    orderedIds.splice(index, 1);
    orderedIds.push(layerId);
    if (this.state.layerStates["Background"]) {
      newLayerStates["Background"] = this.state.layerStates["Background"];
    }
    orderedIds.forEach((id) => {
      if (this.state.layerStates[id]) {
        newLayerStates[id] = this.state.layerStates[id];
      }
    });
    this.state.layerStates = newLayerStates;
    this.buildLayerItems();
    (_b = this.onLayerReorder) == null ? void 0 : _b.call(this, orderedIds);
  }
  /**
   * Move a layer within its own group (or among the top-level rows), so the
   * context-menu moves never carry it out of its group. A nested group counts
   * as one block: moving up or down steps past the whole block.
   * @param layerId The layer ID
   * @param direction Where to move the layer within its group
   */
  moveLayerWithinGroup(layerId, direction) {
    var _a;
    const order = this.getUserLayerIdsInMapOrder();
    const groupId = this.getLayerGroupIdOf(layerId);
    const blocks = [];
    for (const id of order) {
      const key = this.getChildKeyWithin(id, groupId);
      if (key === null) continue;
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && lastBlock.key === key && key !== `layer:${id}`) {
        lastBlock.ids.push(id);
      } else {
        blocks.push({ key, ids: [id] });
      }
    }
    const position = blocks.findIndex((block2) => block2.key === `layer:${layerId}`);
    const last = blocks.length - 1;
    if (position < 0) return;
    if ((direction === "up" || direction === "top") && position === 0) return;
    if ((direction === "down" || direction === "bottom") && position === last) {
      return;
    }
    const above = direction === "up" || direction === "top";
    const block = {
      up: blocks[position - 1],
      top: blocks[0],
      down: blocks[position + 1],
      bottom: blocks[last]
    }[direction];
    const anchor = above ? block.ids[0] : block.ids[block.ids.length - 1];
    const next = order.filter((id) => id !== layerId);
    const anchorIndex = next.indexOf(anchor);
    next.splice(above ? anchorIndex : anchorIndex + 1, 0, layerId);
    const newLayerStates = {};
    if (this.state.layerStates["Background"]) {
      newLayerStates["Background"] = this.state.layerStates["Background"];
    }
    next.forEach((id) => {
      if (this.state.layerStates[id]) {
        newLayerStates[id] = this.state.layerStates[id];
      }
    });
    this.state.layerStates = newLayerStates;
    this.applyLayerOrderToMap(next);
    this.buildLayerItems();
    (_a = this.onLayerReorder) == null ? void 0 : _a.call(this, next);
  }
  /**
   * Identify which row of a group a layer falls under: the layer itself when
   * it belongs to the group directly, or the nested group that holds it.
   * @param layerId The layer ID
   * @param groupId The group, or undefined for the panel's top level
   * @returns `layer:<id>` or `group:<id>`, or null when the layer is not
   *   inside the group at all
   */
  getChildKeyWithin(layerId, groupId) {
    var _a;
    let current = this.getLayerGroupIdOf(layerId);
    if (current === groupId) return `layer:${layerId}`;
    const visited = /* @__PURE__ */ new Set();
    while (current !== void 0 && !visited.has(current)) {
      visited.add(current);
      const parentId = (_a = this.groupStates.get(current)) == null ? void 0 : _a.parentId;
      const parent = parentId !== void 0 && this.groupStates.has(parentId) ? parentId : void 0;
      if (parent === groupId) return `group:${current}`;
      current = parent;
    }
    return null;
  }
  /**
   * Show inline remove confirmation instead of browser confirm() dialog.
   * Works in Jupyter notebooks where native dialogs may not appear.
   */
  showRemoveConfirmation(container, onConfirm) {
    const existing = container.querySelector(".layer-control-remove-confirm");
    if (existing) {
      existing.remove();
    }
    const confirmEl = document.createElement("div");
    confirmEl.className = "layer-control-remove-confirm";
    const message = document.createElement("div");
    message.className = "layer-control-remove-confirm-message";
    message.innerHTML = `
      <svg class="layer-control-remove-confirm-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
      </svg>
      <span>Remove this layer?</span>
    `;
    const buttons = document.createElement("div");
    buttons.className = "layer-control-remove-confirm-buttons";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "layer-control-remove-confirm-btn layer-control-remove-confirm-btn-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmEl.remove();
    });
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "layer-control-remove-confirm-btn layer-control-remove-confirm-btn-confirm";
    confirmBtn.textContent = "Remove";
    confirmBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmEl.remove();
      onConfirm();
    });
    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);
    confirmEl.appendChild(message);
    confirmEl.appendChild(buttons);
    container.appendChild(confirmEl);
    requestAnimationFrame(() => {
      confirmEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
  /**
   * Remove a layer from the map
   */
  removeLayer(layerId) {
    var _a, _b;
    this.state.isStyleOperationInProgress = true;
    const layerState = this.state.layerStates[layerId];
    if ((layerState == null ? void 0 : layerState.isCustomLayer) && this.customLayerRegistry) {
      this.removedCustomLayerIds.add(layerId);
      this.customLayerRegistry.setVisibility(layerId, false);
      this.customLayerRegistry.removeLayer(layerId);
    }
    try {
      const layer = this.map.getLayer(layerId);
      if (layer) {
        const sourceId = layer.source;
        this.map.removeLayer(layerId);
        if (sourceId) {
          const style = this.map.getStyle();
          const sourceStillUsed = (_a = style == null ? void 0 : style.layers) == null ? void 0 : _a.some(
            (l) => l.source === sourceId
          );
          if (!sourceStillUsed) {
            try {
              this.map.removeSource(sourceId);
            } catch (e) {
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to remove layer ${layerId}:`, error);
    }
    delete this.state.layerStates[layerId];
    this.state.customLayerNames.delete(layerId);
    const itemEl = this.panel.querySelector(`[data-layer-id="${layerId}"]`);
    if (itemEl) {
      itemEl.remove();
    }
    this.pruneEmptyGroups();
    (_b = this.onLayerRemove) == null ? void 0 : _b.call(this, layerId);
    setTimeout(() => {
      this.state.isStyleOperationInProgress = false;
    }, 200);
  }
  // ===== Drag and Drop Methods =====
  /**
   * Create drag handle element
   */
  createDragHandle(layerId) {
    const handle = document.createElement("div");
    handle.className = "layer-control-drag-handle";
    handle.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="3" r="1.5"/>
      <circle cx="11" cy="3" r="1.5"/>
      <circle cx="5" cy="8" r="1.5"/>
      <circle cx="11" cy="8" r="1.5"/>
      <circle cx="5" cy="13" r="1.5"/>
      <circle cx="11" cy="13" r="1.5"/>
    </svg>`;
    handle.title = "Drag to reorder";
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.startDrag(layerId, e);
    });
    return handle;
  }
  /**
   * Create a disabled drag handle for alignment (used for Background layer)
   */
  createDisabledDragHandle() {
    const handle = document.createElement("div");
    handle.className = "layer-control-drag-handle layer-control-drag-handle-disabled";
    handle.innerHTML = `<svg viewBox="0 0 16 16" fill="currentColor">
      <circle cx="5" cy="3" r="1.5"/>
      <circle cx="11" cy="3" r="1.5"/>
      <circle cx="5" cy="8" r="1.5"/>
      <circle cx="11" cy="8" r="1.5"/>
      <circle cx="5" cy="13" r="1.5"/>
      <circle cx="11" cy="13" r="1.5"/>
    </svg>`;
    return handle;
  }
  /**
   * Start dragging a layer
   */
  startDrag(layerId, e) {
    var _a;
    const itemEl = this.panel.querySelector(
      `[data-layer-id="${layerId}"]`
    );
    if (!itemEl) return;
    const rect = itemEl.getBoundingClientRect();
    this.state.drag = {
      active: true,
      layerId,
      startY: e.clientY,
      currentY: e.clientY,
      placeholder: null,
      draggedElement: null
    };
    this.panel.classList.add("dragging-active");
    itemEl.classList.add("dragging");
    const placeholder = document.createElement("div");
    placeholder.className = "layer-control-drop-placeholder";
    placeholder.style.height = `${rect.height}px`;
    (_a = itemEl.parentNode) == null ? void 0 : _a.insertBefore(placeholder, itemEl);
    this.state.drag.placeholder = placeholder;
    const clone = itemEl.cloneNode(true);
    clone.classList.remove("dragging");
    clone.className = "layer-control-item layer-control-item-dragging";
    clone.style.width = `${rect.width}px`;
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    document.body.appendChild(clone);
    this.state.drag.draggedElement = clone;
    const onMove = (moveE) => this.onDragMove(moveE);
    const onEnd = (endE) => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
      this.endDrag(endE);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
  }
  /**
   * Handle drag move
   */
  onDragMove(e) {
    var _a, _b;
    if (!this.state.drag.active || !this.state.drag.draggedElement) return;
    const placeholder = this.state.drag.placeholder;
    if (!placeholder) return;
    const deltaY = e.clientY - this.state.drag.startY;
    const clone = this.state.drag.draggedElement;
    const currentTop = parseFloat(clone.style.top) || 0;
    clone.style.top = `${currentTop + deltaY}px`;
    this.state.drag.startY = e.clientY;
    this.state.drag.currentY = e.clientY;
    const scope = placeholder.parentElement;
    const items = Array.from((scope == null ? void 0 : scope.children) ?? []).filter(
      (item) => (item.classList.contains("layer-control-item") || item.classList.contains("layer-control-group")) && !item.classList.contains("dragging") && item.dataset.layerId !== "Background"
    );
    for (const item of items) {
      const itemRect = item.getBoundingClientRect();
      if (e.clientY >= itemRect.top && e.clientY <= itemRect.bottom) {
        const itemMiddle = itemRect.top + itemRect.height / 2;
        if (e.clientY < itemMiddle) {
          if (placeholder.nextSibling !== item) {
            (_a = item.parentNode) == null ? void 0 : _a.insertBefore(placeholder, item);
          }
        } else {
          if (placeholder.previousSibling !== item) {
            (_b = item.parentNode) == null ? void 0 : _b.insertBefore(placeholder, item.nextSibling);
          }
        }
        break;
      }
    }
  }
  /**
   * End dragging
   */
  endDrag(_e) {
    var _a;
    if (!this.state.drag.active) return;
    const layerId = this.state.drag.layerId;
    const placeholder = this.state.drag.placeholder;
    const itemEl = this.panel.querySelector(
      `[data-layer-id="${layerId}"]`
    );
    if (itemEl && placeholder) {
      (_a = placeholder.parentNode) == null ? void 0 : _a.insertBefore(itemEl, placeholder);
      itemEl.classList.remove("dragging");
    }
    this.cleanupDragState();
    this.applyUIOrderToMap();
  }
  /**
   * Clean up drag state
   */
  cleanupDragState() {
    if (this.state.drag.draggedElement) {
      this.state.drag.draggedElement.remove();
    }
    if (this.state.drag.placeholder) {
      this.state.drag.placeholder.remove();
    }
    this.panel.classList.remove("dragging-active");
    this.panel.querySelectorAll(".layer-control-item.dragging").forEach((el) => {
      el.classList.remove("dragging");
    });
    this.state.drag = {
      active: false,
      layerId: null,
      startY: 0,
      currentY: 0,
      placeholder: null,
      draggedElement: null
    };
  }
  /**
   * Apply UI order to map layers
   */
  applyUIOrderToMap() {
    var _a;
    const items = this.panel.querySelectorAll(".layer-control-item");
    const uiLayerIds = [];
    items.forEach((item) => {
      const layerId = item.dataset.layerId;
      if (layerId && layerId !== "Background") {
        uiLayerIds.push(layerId);
      }
    });
    this.applyLayerOrderToMap(uiLayerIds);
    (_a = this.onLayerReorder) == null ? void 0 : _a.call(this, uiLayerIds);
  }
  /**
   * Restack the map's MapLibre layers to match a panel order.
   * @param uiLayerIds User layer IDs top-to-bottom, as the panel lists them
   */
  applyLayerOrderToMap(uiLayerIds) {
    var _a;
    this.state.isStyleOperationInProgress = true;
    const style = this.map.getStyle();
    const mapLibreLayerIds = new Set(((_a = style == null ? void 0 : style.layers) == null ? void 0 : _a.map((l) => l.id)) || []);
    for (let i = 0; i < uiLayerIds.length; i++) {
      const layerId = uiLayerIds[i];
      if (!mapLibreLayerIds.has(layerId)) {
        continue;
      }
      let beforeId = void 0;
      for (let j = i - 1; j >= 0; j--) {
        if (mapLibreLayerIds.has(uiLayerIds[j])) {
          beforeId = uiLayerIds[j];
          break;
        }
      }
      try {
        this.map.moveLayer(layerId, beforeId);
      } catch (e) {
      }
    }
    setTimeout(() => {
      this.state.isStyleOperationInProgress = false;
    }, 200);
  }
}
export {
  CustomLayerRegistry,
  LayerControl,
  clamp,
  createBackgroundGroupSymbolSVG,
  createLayerSymbolSVG,
  darkenColor,
  formatNumericValue,
  getLayerColor,
  getLayerColorFromSpec,
  getLayerOpacity,
  getLayerType,
  isStyleableLayerType,
  normalizeColor,
  rgbToHex,
  setLayerOpacity
};
//# sourceMappingURL=index.mjs.map
