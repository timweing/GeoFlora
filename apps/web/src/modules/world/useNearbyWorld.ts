import { useEffect, useState } from "react";

import { DEFAULT_NEARBY_RADIUS_METERS } from "@geoflora/config";
import type { GeoPoint, NearbyWorldSnapshot, PlantRecord } from "@geoflora/shared";
import { generateNearbyWorld, reprojectPlant } from "@geoflora/worldgen";

interface UseNearbyWorldOptions {
  anchor: GeoPoint;
  localPlants: PlantRecord[];
  radiusMeters?: number;
}

export function useNearbyWorld({
  anchor,
  localPlants,
  radiusMeters = DEFAULT_NEARBY_RADIUS_METERS
}: UseNearbyWorldOptions) {
  const [world, setWorld] = useState<NearbyWorldSnapshot>(() =>
    mergeWorld(generateNearbyWorld({ anchor, radiusMeters }), anchor, localPlants)
  );
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWorld() {
      setIsRefreshing(true);

      try {
        const response = await fetch(
          `/api/v1/world/nearby?lat=${anchor.lat}&lng=${anchor.lng}&radius=${radiusMeters}`
        );

        if (!response.ok) {
          throw new Error(`World API failed with ${response.status}`);
        }

        const data = (await response.json()) as NearbyWorldSnapshot;
        if (!cancelled) {
          setServerReachable(true);
          setWorld(mergeWorld(data, anchor, localPlants));
        }
      } catch {
        if (!cancelled) {
          setServerReachable(false);
          setWorld(mergeWorld(generateNearbyWorld({ anchor, radiusMeters }), anchor, localPlants));
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void loadWorld();
    const intervalId = window.setInterval(() => {
      void loadWorld();
    }, 20_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [anchor.lat, anchor.lng, localPlants, radiusMeters]);

  return {
    world,
    serverReachable,
    isRefreshing
  };
}

function mergeWorld(world: NearbyWorldSnapshot, anchor: GeoPoint, localPlants: PlantRecord[]) {
  const cellsById = new Map(world.cells.map((cell) => [cell.id, { ...cell }]));
  const mergedPlants = [...world.plants];
  const seenPlantIds = new Set(mergedPlants.map((plant) => plant.id));

  for (const plant of localPlants) {
    const projectedPlant = reprojectPlant(plant, anchor);
    if (Math.abs(projectedPlant.worldOffset.x) > world.radiusMeters || Math.abs(projectedPlant.worldOffset.z) > world.radiusMeters) {
      continue;
    }

    if (!seenPlantIds.has(projectedPlant.id)) {
      seenPlantIds.add(projectedPlant.id);
      mergedPlants.push(projectedPlant);
    }

    const cell = cellsById.get(projectedPlant.cellId);
    if (cell) {
      cell.plantCount += 1;
      cell.harmonyLevel = Number(Math.min(1, cell.harmonyLevel + 0.06).toFixed(2));
      cell.activityLevel = Number(Math.min(1, cell.activityLevel + 0.04).toFixed(2));
    }
  }

  return {
    ...world,
    anchor,
    cells: [...cellsById.values()],
    plants: mergedPlants
  };
}

