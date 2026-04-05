export type SeedMode = "drift" | "root" | "deep_root";
export type MovementState = "transit" | "wander" | "still";
export type BiomeType = "urban_park" | "waterfront" | "campus" | "forest_edge" | "old_town";
export type SeasonState = "spring" | "summer" | "autumn" | "winter";
export type PlantFamily =
  | "mist_grass"
  | "crystal_lily"
  | "poly_fern"
  | "echo_reed"
  | "lantern_bloom"
  | "stone_tree";
export type PlantGrowthState = "seed" | "sprout" | "formed" | "blooming" | "mature" | "seasonal_shifted";
export type WeatherCondition = "clear" | "rain" | "mist" | "wind" | "night";
export type TemperatureBand = "cold" | "cool" | "mild" | "warm";
export type MusicalScale = "pentatonic" | "lydian" | "dorian" | "aeolian" | "mixolydian";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface WorldOffset {
  x: number;
  z: number;
}

export interface WeatherSignature {
  condition: WeatherCondition;
  temperatureBand: TemperatureBand;
  isNight: boolean;
}

export interface AmbientSnapshot {
  mood: "dew" | "choral" | "rain" | "glow" | "mist";
  scale: MusicalScale;
  density: number;
  bloomChance: number;
  dominantFamily: PlantFamily;
}

export interface WorldCell {
  id: string;
  center: GeoPoint;
  worldOffset: WorldOffset;
  biomeType: BiomeType;
  activityLevel: number;
  harmonyLevel: number;
  plantCount: number;
  soundDensity: number;
  lastVisitedAt: string;
  seasonState: SeasonState;
  weatherSignature: WeatherSignature;
  ensembleState: {
    active: boolean;
    type: string | null;
  };
}

export interface PlantDNA {
  palette: string;
  height: number;
  branchCount: number;
  curvature: number;
  symmetry: number;
  complexity: number;
  bloomType: "halo" | "crystal" | "lantern" | "petal" | "spire";
  swayAmount: number;
  instrumentFamily: "drone" | "chime" | "pluck";
  tonicOffset: number;
  patternSeed: number;
}

export interface PlantRecord {
  id: string;
  creatorUserId: string;
  cellId: string;
  location: GeoPoint;
  worldOffset: WorldOffset;
  seedMode: SeedMode;
  family: PlantFamily;
  state: PlantGrowthState;
  growth: {
    stage: number;
    progress: number;
    lastGrowthAt: string;
  };
  dna: PlantDNA;
  weatherSignature: WeatherSignature;
  stats: {
    resonanceCount: number;
    tendedCount: number;
    pollinationCount: number;
  };
  visibility: "public" | "private";
  createdAt: string;
  updatedAt: string;
}

export interface NearbyWorldSnapshot {
  generatedAt: string;
  anchor: GeoPoint;
  radiusMeters: number;
  cells: WorldCell[];
  plants: PlantRecord[];
  ambient: AmbientSnapshot;
}

export interface GuestProfile {
  userId: string;
  displayName: string;
  createdAt: string;
}

export interface LocationSample extends GeoPoint {
  accuracyMeters: number;
  speedMps?: number | null;
  heading?: number | null;
  timestamp: number;
}

export interface MovementSnapshot {
  state: MovementState;
  speedKmh: number;
  stationaryMs: number;
  confidence: number;
}

export interface PlantingSession {
  plantingId: string;
  userId: string;
  seedMode: SeedMode;
  startedAt: string;
  durationSeconds: number;
  cellId: string;
  anchor: GeoPoint;
  status: "active" | "completed" | "cancelled";
}

export interface PlantingStartRequest {
  userId: string;
  location: GeoPoint;
  seedMode: SeedMode;
}

export interface PlantingHeartbeatRequest {
  plantingId: string;
  elapsedSeconds: number;
  movement: MovementSnapshot;
}

export interface PlantingCompleteRequest {
  plantingId: string;
  location: GeoPoint;
  movement: MovementSnapshot;
}

