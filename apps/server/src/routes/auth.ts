import type { FastifyInstance } from "fastify";

import { API_PREFIX } from "@geoflora/config";

import { store } from "../store.js";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post(`${API_PREFIX}/auth/guest`, async (request) => {
    const body = (request.body ?? {}) as { displayName?: string };
    return store.createGuest(body.displayName);
  });

  app.get(`${API_PREFIX}/me`, async (request, reply) => {
    const query = request.query as { userId?: string };

    if (!query.userId) {
      reply.code(400);
      return {
        error: "userId query parameter is required"
      };
    }

    const guest = store.getGuest(query.userId);
    if (!guest) {
      reply.code(404);
      return {
        error: "guest_not_found"
      };
    }

    return guest;
  });
}

