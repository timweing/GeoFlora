import {
  BIOME_SCALES,
  DEFAULT_NEARBY_RADIUS_METERS,
  FAMILY_PALETTES,
  SEED_MODE_CONFIG,
  WORLD_CELL_SIZE_METERS
} from "@geoflora/config";
import type {
  AmbientSnapshot,
  BiomeType,
  GeoPoint,
  NearbyWorldSnapshot,
  PlantDNA,
  PlantFamily,
  PlantGrowthState,
  PlantRecord,
  SeedMode,
  SeasonState,
  WeatherSignature,
  WorldCell,
  WorldOffset
} from "@geoflora/shared";
import { haversineDistanceMeters } from "@geoflora/shared";

const EARTH_RADIUS_METERS = 6_378_137;

interface NearbyWorldOptions {
  anchor: GeoPoint;
  radiusMeters?: number;
  now?: Date;
}

interface PlayerPlantOptions {
  userId: string;
  location: GeoPoint;
  seedMode: SeedMode;
  movementState: "transit" | "wander" | "still";
  now?: Date;
}

export function generateNearbyWorld({
  anchor,
  radiusMeters = DEFAULT_NEARBY_RADIUS_METERS,
  now = new Date()
}: NearbyWorldOptions): NearbyWorldSnapshot {
  const anchorMercator = toMercator(anchor);
  const cellRadius = Math.ceil(radiusMeters / WORLD_CELL_SIZE_METERS) + 1;
  const anchorCell = mercatorToCell(anchorMercator);
  const cells: WorldCell[] = [];
  const plants: PlantRecord[] = [];

  for (let offsetX = -cellRadius; offsetX <= cellRadius; offsetX += 1) {
    for (let offsetY = -cellRadius; offsetY <= cellRadius; offsetY += 1) {
      const cellX = anchorCell.cellX + offsetX;
      const cellY = anchorCell.cellY + offsetY;
      const center = cellCenterFromIndices(cellX, cellY);
      const distance = haversineDistanceMeters(anchor, center);

      if (distance > radiusMeters + WORLD_CELL_SIZE_METERS) {
        continue;
      }

      const id = buildCellId(cellX, cellY);
      const rng = mulberry32(hashString(id));
      const biomeType = deriveBiome(center, rng);
      const weatherSignature = deriveWeatherSignature(now, center, biomeType, rng);
      const seasonState = deriveSeason(now);
      const worldOffset = projectToLocalMeters(anchor, center);
      const activityLevel = round(0.18 + rng() * 0.82, 2);
      const harmonyLevel = round(0.25 + rng() * 0.7, 2);
      const soundDensity = round(0.12 + rng() * 0.75, 2);
      const basePlantCount = Math.floor(rng() * 4 + (distance < radiusMeters * 0.35 ? 1 : 0));

      const cell: WorldCell = {
        id,
        center,
        worldOffset,
        biomeType,
        activityLevel,
        harmonyLevel,
        plantCount: basePlantCount,
        soundDensity,
        lastVisitedAt: new Date(now.getTime() - rng() * 1000 * 60 * 60 * 72).toISOString(),
        seasonState,
        weatherSignature,
        ensembleState: {
          active: rng() > 0.72,
          type: rng() > 0.72 ? pick(["choral_ring", "dew_arc", "lantern_weave"], rng) : null
        }
      };

      cells.push(cell);

      for (let index = 0; index < basePlantCount; index += 1) {
        const plantSeed = hashString(`${id}:${index}`);
        const plantRng = mulberry32(plantSeed);
        const localX = (plantRng() - 0.5) * WORLD_CELL_SIZE_METERS * 0.75;
        const localZ = (plantRng() - 0.5) * WORLD_CELL_SIZE_METERS * 0.75;
        const location = offsetPointMeters(center, localX, localZ);
        const seedMode = weightedSeedMode(plantRng);
        const family = deriveFamily(biomeType, weatherSignature, seedMode, plantRng);
        const ageDays = Math.floor(plantRng() * 18);
        const createdAt = new Date(now.getTime() - ageDays * 24 * 60 * 60 * 1000);
        const state = deriveGrowthState(ageDays, seedMode, weatherSignature);
        const dna = derivePlantDna({
          family,
          weatherSignature,
          biomeType,
          seedMode,
          seed: plantSeed
        });

        plants.push({
          id: `plant_${plantSeed.toString(36)}`,
          creatorUserId: `echo_${Math.floor(plantRng() * 240)}`,
          cellId: id,
          location,
          worldOffset: {
            x: worldOffset.x + localX,
            z: worldOffset.z + localZ
          },
          seedMode,
          family,
          state,
          growth: {
            stage: growthStageFromState(state),
            progress: round(plantRng() * 0.95, 2),
            lastGrowthAt: new Date(createdAt.getTime() + ageDays * 3_600_000).toISOString()
          },
          dna,
          weatherSignature,
          stats: {
            resonanceCount: Math.floor(plantRng() * 6),
            tendedCount: Math.floor(plantRng() * 3),
            pollinationCount: Math.floor(plantRng() * 2)
          },
          visibility: "public",
          createdAt: createdAt.toISOString(),
          updatedAt: new Date(createdAt.getTime() + plantRng() * 8 * 60 * 60 * 1000).toISOString()
        });
      }
    }
  }

  return {
    generatedAt: now.toISOString(),
    anchor,
    radiusMeters,
    cells,
    plants,
    ambient: deriveAmbientSnapshot(cells, plants)
  };
}

export function createPlayerPlant({
  userId,
  location,
  seedMode,
  movementState,
  now = new Date()
}: PlayerPlantOptions): PlantRecord {
  const { cellX, cellY } = mercatorToCell(toMercator(location));
  const cellId = buildCellId(cellX, cellY);
  const center = cellCenterFromIndices(cellX, cellY);
  const biomeType = deriveBiome(center, mulberry32(hashString(cellId)));
  const movementBias = movementState === "still" ? 0.92 : movementState === "wander" ? 0.66 : 0.35;
  const seed = hashString(`${userId}:${cellId}:${now.toISOString()}`);
  const rng = mulberry32(seed);
  const weatherSignature = deriveWeatherSignature(now, center, biomeType, rng);
  const family = deriveFamily(biomeType, weatherSignature, seedMode, rng);
  const dna = derivePlantDna({
    family,
    weatherSignature,
    biomeType,
    seedMode,
    seed: seed + Math.round(movementBias * 1000)
  });
  const createdAt = now.toISOString();

  return {
    id: `plant_${seed.toString(36)}`,
    creatorUserId: userId,
    cellId,
    location,
    worldOffset: { x: 0, z: 0 },
    seedMode,
    family,
    state: seedMode === "deep_root" ? "formed" : "sprout",
    growth: {
      stage: seedMode === "deep_root" ? 2 : 1,
      progress: round(0.3 + movementBias * 0.45, 2),
      lastGrowthAt: createdAt
    },
    dna: {
      ...dna,
      complexity: Math.max(dna.complexity, seedMode === "deep_root" ? 4 : 2)
    },
    weatherSignature,
    stats: {
      resonanceCount: 0,
      tendedCount: 0,
      pollinationCount: 0
    },
    visibility: "public",
    createdAt,
    updatedAt: createdAt
  };
}

export function reprojectPlant(plant: PlantRecord, anchor: GeoPoint): PlantRecord {
  return {
    ...plant,
    worldOffset: projectToLocalMeters(anchor, plant.location)
  };
}

export function reprojectCell(cell: WorldCell, anchor: GeoPoint): WorldCell {
  return {
    ...cell,
    worldOffset: projectToLocalMeters(anchor, cell.center)
  };
}

export function projectToLocalMeters(anchor: GeoPoint, point: GeoPoint): WorldOffset {
  const lat1 = toRadians(anchor.lat);
  const lat2 = toRadians(point.lat);
  const dLat = lat2 - lat1;
  const dLng = toRadians(point.lng - anchor.lng);
  const avgLat = (lat1 + lat2) / 2;

  return {
    x: round(dLng * Math.cos(avgLat) * EARTH_RADIUS_METERS, 2),
    z: round(dLat * EARTH_RADIUS_METERS, 2)
  };
}

export function distanceToAnchor(anchor: GeoPoint, point: GeoPoint) {
  return haversineDistanceMeters(anchor, point);
}

function deriveAmbientSnapshot(cells: WorldCell[], plants: PlantRecord[]): AmbientSnapshot {
  const dominantCell = [...cells].sort((left, right) => right.soundDensity - left.soundDensity)[0];
  const dominantPlant = [...plants].sort((left, right) => right.growth.stage - left.growth.stage)[0];
  const density =
    plants.reduce((sum, plant) => sum + plant.growth.progress, 0) / Math.max(plants.length, 1);
  const bloomChance =
    cells.reduce((sum, cell) => sum + cell.harmonyLevel, 0) / Math.max(cells.length, 1);

  return {
    mood: dominantCell?.weatherSignature.condition === "rain"
      ? "rain"
      : dominantCell?.weatherSignature.isNight
        ? "glow"
        : dominantCell?.weatherSignature.condition === "mist"
          ? "mist"
          : plants.length > 18
            ? "choral"
            : "dew",
    scale: BIOME_SCALES[dominantCell?.biomeType ?? "urban_park"],
    density: round(density, 2),
    bloomChance: round(bloomChance, 2),
    dominantFamily: dominantPlant?.family ?? "mist_grass"
  };
}

function derivePlantDna({
  family,
  weatherSignature,
  biomeType,
  seedMode,
  seed
}: {
  family: PlantFamily;
  weatherSignature: WeatherSignature;
  biomeType: BiomeType;
  seedMode: SeedMode;
  seed: number;
}): PlantDNA {
  const rng = mulberry32(seed);
  const palette = `${family}_${weatherSignature.condition}`;
  const intensity = SEED_MODE_CONFIG[seedMode].intensity;

  return {
    palette,
    height: round(0.7 + rng() * 1.6 + intensity * 1.2, 2),
    branchCount: Math.max(2, Math.round(2 + rng() * 5 + intensity * 2)),
    curvature: round(0.15 + rng() * 0.75, 2),
    symmetry: round(0.2 + rng() * 0.8, 2),
    complexity: Math.round(1 + rng() * 4 + intensity * 2),
    bloomType: bloomTypeFromFamily(family, biomeType),
    swayAmount: round(0.05 + rng() * 0.35, 2),
    instrumentFamily: weatherSignature.isNight ? "drone" : seedMode === "drift" ? "pluck" : "chime",
    tonicOffset: Math.floor(rng() * 12),
    patternSeed: seed % 100_000
  };
}

function deriveFamily(
  biomeType: BiomeType,
  weatherSignature: WeatherSignature,
  seedMode: SeedMode,
  rng: () => number
): PlantFamily {
  if (weatherSignature.condition === "rain") {
    return rng() > 0.5 ? "crystal_lily" : "echo_reed";
  }

  if (weatherSignature.isNight) {
    return seedMode === "deep_root" ? "lantern_bloom" : "mist_grass";
  }

  switch (biomeType) {
    case "waterfront":
      return rng() > 0.35 ? "echo_reed" : "crystal_lily";
    case "forest_edge":
      return rng() > 0.4 ? "poly_fern" : "stone_tree";
    case "old_town":
      return seedMode === "deep_root" ? "stone_tree" : "lantern_bloom";
    case "campus":
      return rng() > 0.45 ? "mist_grass" : "poly_fern";
    case "urban_park":
    default:
      return seedMode === "drift" ? "mist_grass" : "poly_fern";
  }
}

function deriveBiome(point: GeoPoint, rng: () => number): BiomeType {
  const latitudeBias = Math.abs(point.lat) % 1;
  const longitudeBias = Math.abs(point.lng) % 1;
  const noise = (latitudeBias * 0.7 + longitudeBias * 0.3 + rng() * 0.5) % 1;

  if (noise < 0.18) {
    return "waterfront";
  }
  if (noise < 0.38) {
    return "forest_edge";
  }
  if (noise < 0.58) {
    return "campus";
  }
  if (noise < 0.78) {
    return "old_town";
  }
  return "urban_park";
}

function deriveWeatherSignature(
  now: Date,
  point: GeoPoint,
  biomeType: BiomeType,
  rng: () => number
): WeatherSignature {
  const hour = now.getHours();
  const isNight = hour < 6 || hour >= 20;
  const seasonalBias = fractional(now.getMonth() + point.lat + point.lng);
  const conditionRoll = fractional(rng() + seasonalBias + biomeType.length * 0.03);
  const temperatureRoll = (Math.sin(toRadians(point.lat * 2 + now.getMonth() * 20)) + 1) / 2;

  let condition: WeatherSignature["condition"] = "clear";
  if (isNight) {
    condition = "night";
  } else if (conditionRoll < 0.22) {
    condition = "rain";
  } else if (conditionRoll < 0.37) {
    condition = "mist";
  } else if (conditionRoll < 0.53) {
    condition = "wind";
  }

  let temperatureBand: WeatherSignature["temperatureBand"] = "mild";
  if (temperatureRoll < 0.2) {
    temperatureBand = "cold";
  } else if (temperatureRoll < 0.42) {
    temperatureBand = "cool";
  } else if (temperatureRoll > 0.76) {
    temperatureBand = "warm";
  }

  return {
    condition,
    temperatureBand,
    isNight
  };
}

function deriveSeason(now: Date): SeasonState {
  const month = now.getMonth();
  if (month <= 1 || month === 11) {
    return "winter";
  }
  if (month <= 4) {
    return "spring";
  }
  if (month <= 7) {
    return "summer";
  }
  return "autumn";
}

function deriveGrowthState(ageDays: number, seedMode: SeedMode, weatherSignature: WeatherSignature): PlantGrowthState {
  if (ageDays < 1) {
    return "seed";
  }
  if (ageDays < 3) {
    return "sprout";
  }
  if (ageDays < 6) {
    return "formed";
  }
  if (weatherSignature.condition === "rain" || seedMode === "deep_root") {
    return ageDays < 12 ? "blooming" : "mature";
  }
  return ageDays < 12 ? "formed" : "seasonal_shifted";
}

function growthStageFromState(state: PlantGrowthState) {
  switch (state) {
    case "seed":
      return 0;
    case "sprout":
      return 1;
    case "formed":
      return 2;
    case "blooming":
      return 3;
    case "mature":
      return 4;
    case "seasonal_shifted":
      return 5;
  }
}

function bloomTypeFromFamily(family: PlantFamily, biomeType: BiomeType): PlantDNA["bloomType"] {
  if (family === "crystal_lily") {
    return "crystal";
  }
  if (family === "lantern_bloom") {
    return "lantern";
  }
  if (family === "stone_tree") {
    return "spire";
  }
  if (biomeType === "waterfront") {
    return "halo";
  }
  return "petal";
}

function weightedSeedMode(rng: () => number): SeedMode {
  const value = rng();
  if (value < 0.34) {
    return "drift";
  }
  if (value < 0.82) {
    return "root";
  }
  return "deep_root";
}

function buildCellId(cellX: number, cellY: number) {
  return `cell_${cellX}_${cellY}`;
}

function mercatorToCell(mercator: { x: number; y: number }) {
  return {
    cellX: Math.floor(mercator.x / WORLD_CELL_SIZE_METERS),
    cellY: Math.floor(mercator.y / WORLD_CELL_SIZE_METERS)
  };
}

function cellCenterFromIndices(cellX: number, cellY: number): GeoPoint {
  return fromMercator({
    x: (cellX + 0.5) * WORLD_CELL_SIZE_METERS,
    y: (cellY + 0.5) * WORLD_CELL_SIZE_METERS
  });
}

function toMercator(point: GeoPoint) {
  const lngRad = toRadians(point.lng);
  const lat = Math.max(Math.min(point.lat, 85), -85);
  const latRad = toRadians(lat);

  return {
    x: EARTH_RADIUS_METERS * lngRad,
    y: EARTH_RADIUS_METERS * Math.log(Math.tan(Math.PI / 4 + latRad / 2))
  };
}

function fromMercator(mercator: { x: number; y: number }): GeoPoint {
  return {
    lng: round((mercator.x / EARTH_RADIUS_METERS) * (180 / Math.PI), 6),
    lat: round((2 * Math.atan(Math.exp(mercator.y / EARTH_RADIUS_METERS)) - Math.PI / 2) * (180 / Math.PI), 6)
  };
}

function offsetPointMeters(point: GeoPoint, eastMeters: number, northMeters: number): GeoPoint {
  const latRad = toRadians(point.lat);
  const lngScale = Math.cos(latRad);

  return {
    lat: round(point.lat + (northMeters / EARTH_RADIUS_METERS) * (180 / Math.PI), 6),
    lng: round(point.lng + (eastMeters / (EARTH_RADIUS_METERS * Math.max(lngScale, 0.2))) * (180 / Math.PI), 6)
  };
}

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function hashString(value: string) {
  let hash = 1779033703 ^ value.length;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return (hash >>> 0) + 1;
}

function mulberry32(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let result = Math.imul(value ^ (value >>> 15), value | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function fractional(value: number) {
  return value - Math.floor(value);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export { FAMILY_PALETTES };
