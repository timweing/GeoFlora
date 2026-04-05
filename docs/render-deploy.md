# Render Deployment

GeoFlora ist in diesem Stand für einen einzelnen Render-Web-Service vorbereitet.

## Setup

- `render.yaml` liegt im Repo-Root
- Render baut das komplette Monorepo mit `npm install && npm run build`
- der Fastify-Server liefert nach dem Build zusätzlich das Vite-Frontend aus `apps/web/dist` aus
- Health Check läuft auf `/health`

## Wichtige Monorepo-Regel

Die Service-Root sollte das Repo-Root bleiben.

`apps/server` allein als `rootDir` wäre hier falsch, weil die Workspace-Pakete unter `packages/*` und das Frontend unter `apps/web` dann außerhalb des Service-Roots liegen würden. Für diesen Aufbau muss Render daher auf dem Repo-Root bauen.

## Laufzeitbild

- eine Origin für API und Web-App
- keine zusätzliche Proxy-Schicht zwischen statischem Frontend und API nötig
- lokaler Mock-Fallback im Web bleibt für Demo-Sessions weiter nutzbar
