import type { FastifyInstance } from "fastify";

import { API_PREFIX } from "@geoflora/config";
import type {
  PlantingCompleteRequest,
  PlantingHeartbeatRequest,
  PlantingStartRequest
} from "@geoflora/shared";

import { store } from "../store.js";

export async function registerPlantingRoutes(app: FastifyInstance) {
  app.post(`${API_PREFIX}/planting/start`, async (request, reply) => {
    const body = request.body as PlantingStartRequest;

    if (!body?.userId || !body.location || !body.seedMode) {
      reply.code(400);
      return {
        error: "userId, location and seedMode are required"
      };
    }

    return store.startPlantingSession(body);
  });

  app.post(`${API_PREFIX}/planting/heartbeat`, async (request, reply) => {
    const body = request.body as PlantingHeartbeatRequest;

    if (!body?.plantingId || !body.movement) {
      reply.code(400);
      return {
        error: "plantingId and movement are required"
      };
    }

    const result = store.updateHeartbeat(body.plantingId, body.elapsedSeconds, body.movement);
    if (!result.accepted) {
      reply.code(409);
    }

    return result;
  });

  app.post(`${API_PREFIX}/planting/complete`, async (request, reply) => {
    const body = request.body as PlantingCompleteRequest;

    if (!body?.plantingId || !body.location || !body.movement) {
      reply.code(400);
      return {
        error: "plantingId, location and movement are required"
      };
    }

    const plant = store.completePlantingSession(body);
    if (!plant) {
      reply.code(404);
      return {
        error: "session_not_found"
      };
    }

    return plant;
  });
}

