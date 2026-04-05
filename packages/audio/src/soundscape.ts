import { BIOME_SCALES } from "@geoflora/config";
import type { NearbyWorldSnapshot, PlantRecord } from "@geoflora/shared";

export interface PlantVoice {
  id: string;
  frequencyHz: number;
  gain: number;
  pan: number;
  waveform: "sine" | "triangle" | "sawtooth";
}

export interface SoundscapeSummary {
  scale: string;
  headline: string;
  voices: PlantVoice[];
  density: number;
}

export function summarizeSoundscape(world: NearbyWorldSnapshot): SoundscapeSummary {
  const voices = world.plants
    .slice(0, 12)
    .map((plant) => derivePlantVoice(plant))
    .sort((left, right) => left.frequencyHz - right.frequencyHz);

  const dominantCell = world.cells[0];
  const scale = BIOME_SCALES[dominantCell?.biomeType ?? "urban_park"];
  const density = world.ambient.density;
  const moodCopy =
    world.ambient.mood === "rain"
      ? "Regen verdichtet die Stimmen."
      : world.ambient.mood === "glow"
        ? "Die Nacht zieht lange Drones auf."
        : world.ambient.mood === "mist"
          ? "Nebel dämpft die oberen Obertöne."
          : world.ambient.mood === "choral"
            ? "Mehrere Pflanzen tragen einen Chor."
            : "Leichte Töne halten den Garten offen.";

  return {
    scale,
    headline: moodCopy,
    voices,
    density
  };
}

export function derivePlantVoice(plant: PlantRecord): PlantVoice {
  const baseMidi = 48 + plant.dna.tonicOffset;
  const stageBoost = plant.growth.stage * 2;
  const midi = baseMidi + stageBoost;
  const frequencyHz = round(440 * 2 ** ((midi - 69) / 12), 2);

  return {
    id: plant.id,
    frequencyHz,
    gain: round(0.08 + plant.growth.progress * 0.22, 2),
    pan: clamp(plant.worldOffset.x / 80, -1, 1),
    waveform:
      plant.dna.instrumentFamily === "drone"
        ? "sine"
        : plant.dna.instrumentFamily === "pluck"
          ? "triangle"
          : "sawtooth"
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

