import type { FastifyInstance } from "fastify";

import { API_PREFIX, DEFAULT_NEARBY_RADIUS_METERS } from "@geoflora/config";
import { generateNearbyWorld, reprojectPlant } from "@geoflora/worldgen";

import { store } from "../store.js";

export async function registerWorldRoutes(app: FastifyInstance) {
  app.get(`${API_PREFIX}/world/nearby`, async (request, reply) => {
    const query = request.query as { lat?: string; lng?: string; radius?: string };
    const lat = Number(query.lat);
    const lng = Number(query.lng);
    const radiusMeters = Number(query.radius ?? DEFAULT_NEARBY_RADIUS_METERS);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      reply.code(400);
      return {
        error: "lat and lng query parameters are required"
      };
    }

    const anchor = { lat, lng };
    const world = generateNearbyWorld({
      anchor,
      radiusMeters: Number.isFinite(radiusMeters) ? radiusMeters : DEFAULT_NEARBY_RADIUS_METERS
    });
    const storedPlants = store.listPlantsNearby(anchor, world.radiusMeters).map((plant) => reprojectPlant(plant, anchor));
    const cells = new Map(world.cells.map((cell) => [cell.id, { ...cell }]));

    for (const plant of storedPlants) {
      const cell = cells.get(plant.cellId);
      if (!cell) {
        continue;
      }

      cell.plantCount += 1;
      cell.harmonyLevel = Math.min(1, Number((cell.harmonyLevel + 0.05).toFixed(2)));
    }

    return {
      ...world,
      cells: [...cells.values()],
      plants: dedupePlants([...world.plants, ...storedPlants])
    };
  });
}

function dedupePlants(plants: ReturnType<typeof store.listPlantsNearby>) {
  const seen = new Set<string>();

  return plants.filter((plant) => {
    if (seen.has(plant.id)) {
      return false;
    }

    seen.add(plant.id);
    return true;
  });
}

