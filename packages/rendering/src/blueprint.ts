import { FAMILY_PALETTES } from "@geoflora/config";
import type { PlantRecord } from "@geoflora/shared";

export type PrimitiveKind = "cylinder" | "cone" | "sphere" | "octahedron" | "torus";

export interface PrimitiveSpec {
  kind: PrimitiveKind;
  color: string;
  opacity: number;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface PlantBlueprint {
  swayAmount: number;
  primitives: PrimitiveSpec[];
}

export function buildPlantBlueprint(plant: PlantRecord): PlantBlueprint {
  const palette = FAMILY_PALETTES[plant.family];
  const height = plant.dna.height;
  const branchCount = Math.max(2, plant.dna.branchCount);
  const primitives: PrimitiveSpec[] = [];
  const stemSegments = Math.max(2, Math.round(plant.dna.complexity / 2) + 2);

  for (let index = 0; index < stemSegments; index += 1) {
    const y = (index / stemSegments) * height;
    primitives.push({
      kind: "cylinder",
      color: palette.stem,
      opacity: 0.95,
      position: [0, y, 0],
      rotation: [0, 0, plant.dna.curvature * 0.18 * index],
      scale: [0.08 + (stemSegments - index) * 0.012, height / stemSegments, 0.08]
    });
  }

  for (let index = 0; index < branchCount; index += 1) {
    const progress = branchCount === 1 ? 0.5 : index / (branchCount - 1);
    const angle = progress * Math.PI * 2;
    const branchHeight = height * (0.2 + progress * 0.65);
    const reach = 0.18 + plant.dna.curvature * 0.45 + progress * 0.2;

    primitives.push({
      kind: plant.family === "stone_tree" ? "cone" : "cylinder",
      color: palette.stem,
      opacity: 0.92,
      position: [
        Math.cos(angle) * reach * 0.6,
        branchHeight,
        Math.sin(angle) * reach * 0.6
      ],
      rotation: [Math.sin(angle) * 0.35, 0, Math.cos(angle) * 0.5],
      scale: [0.04, 0.25 + progress * 0.28, 0.04]
    });

    primitives.push({
      kind: bloomPrimitiveForPlant(plant),
      color: palette.bloom,
      opacity: plant.state === "seed" ? 0.35 : 0.9,
      position: [
        Math.cos(angle) * reach,
        branchHeight + 0.15,
        Math.sin(angle) * reach
      ],
      rotation: [angle * 0.3, angle, 0],
      scale: [
        0.1 + plant.dna.symmetry * 0.16,
        0.1 + plant.dna.complexity * 0.015,
        0.1 + plant.dna.symmetry * 0.16
      ]
    });
  }

  if (plant.dna.bloomType === "halo" || plant.family === "lantern_bloom") {
    primitives.push({
      kind: "torus",
      color: palette.bloom,
      opacity: 0.3,
      position: [0, height * 0.85, 0],
      rotation: [Math.PI / 2, 0, 0],
      scale: [0.28, 0.28, 0.06]
    });
  }

  return {
    swayAmount: plant.dna.swayAmount,
    primitives
  };
}

function bloomPrimitiveForPlant(plant: PlantRecord): PrimitiveKind {
  switch (plant.dna.bloomType) {
    case "crystal":
      return "octahedron";
    case "spire":
      return "cone";
    case "halo":
      return "torus";
    case "lantern":
      return "sphere";
    case "petal":
    default:
      return "sphere";
  }
}
