export const APP_NAME = "GeoFlora";
export const API_PREFIX = "/api/v1";

export const WORLD_CELL_SIZE_METERS = 32;
export const DEFAULT_NEARBY_RADIUS_METERS = 180;
export const MAX_RENDER_RADIUS_METERS = 220;
export const MAX_VISIBLE_PLANTS = 120;

export const MOVEMENT_THRESHOLDS = {
  transitKmh: 6,
  stillKmh: 1,
  stillHoldMs: 12_000,
  smoothingWindow: 6,
  maxDispersionMeters: 16
} as const;

export const SEED_MODE_CONFIG = {
  drift: {
    durationSeconds: 20,
    rarityBias: 0.2,
    intensity: 0.35
  },
  root: {
    durationSeconds: 60,
    rarityBias: 0.5,
    intensity: 0.6
  },
  deep_root: {
    durationSeconds: 120,
    rarityBias: 0.85,
    intensity: 0.95
  }
} as const;

export const FAMILY_PALETTES = {
  mist_grass: {
    stem: "#88b7a2",
    bloom: "#c8f2d7"
  },
  crystal_lily: {
    stem: "#82d6ff",
    bloom: "#e5f6ff"
  },
  poly_fern: {
    stem: "#6ca06e",
    bloom: "#b9de7a"
  },
  echo_reed: {
    stem: "#8cc1c3",
    bloom: "#e0fffb"
  },
  lantern_bloom: {
    stem: "#e4a86f",
    bloom: "#ffe7bb"
  },
  stone_tree: {
    stem: "#958d86",
    bloom: "#d8d4d2"
  }
} as const;

export const BIOME_SCALES = {
  urban_park: "dorian",
  waterfront: "lydian",
  campus: "pentatonic",
  forest_edge: "aeolian",
  old_town: "mixolydian"
} as const;

