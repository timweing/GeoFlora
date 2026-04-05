import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";

import { registerAuthRoutes } from "./routes/auth.js";
import { registerPlantingRoutes } from "./routes/planting.js";
import { registerWorldRoutes } from "./routes/world.js";

export async function createServer() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  app.get("/health", async () => {
    return {
      ok: true,
      service: "geoflora-server"
    };
  });

  await registerAuthRoutes(app);
  await registerWorldRoutes(app);
  await registerPlantingRoutes(app);

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const webDistRoot = resolve(currentDir, "../../web/dist");
  const webIndexPath = resolve(webDistRoot, "index.html");

  if (existsSync(webIndexPath)) {
    await app.register(fastifyStatic, {
      root: webDistRoot,
      prefix: "/"
    });

    app.setNotFoundHandler(async (request, reply) => {
      const requestPath = request.raw.url ?? "/";

      if (
        requestPath.startsWith("/api/") ||
        requestPath === "/health" ||
        /\.[a-z0-9]+$/i.test(requestPath)
      ) {
        reply.code(404);
        return {
          error: "not_found"
        };
      }

      return reply.sendFile("index.html");
    });
  }

  return app;
}

const app = await createServer();
const port = Number(process.env.PORT ?? 8787);

app.listen({
  port,
  host: "0.0.0.0"
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
