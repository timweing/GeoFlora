# GeoFlora

GeoFlora ist eine mobile, ortsbasierte, prozedurale Gartenwelt. Dieses Repository enthält den ersten MVP-Vertical-Slice als Monorepo:

- `apps/web`: mobile-first PWA-Shell mit Onboarding, Map Mode, Garden View und lokalem Planting-Loop
- `apps/browser`: separate browser-only Offline-PWA ohne API-Verbindung, mit eigenem Cache und eigenem Local Storage
- `apps/server`: Fastify-API für Guest Auth, Nearby World und Planting-Flow
- `packages/shared`: gemeinsame Domain-Modelle und Bewegungslogik
- `packages/worldgen`: deterministische Zell-, Wetter- und Pflanzen-Generierung
- `packages/rendering`: plant blueprint generation für 3D-Primitiven
- `packages/audio`: ruhige Klang-DNA und Voice-Ableitungen
- `packages/config`: zentrale Gameplay- und Performance-Konstanten

## Start

1. `npm install`
2. `npm run dev:server`
3. `npm run dev:web`
4. `npm run dev:browser`

Die Web-App läuft im MVP auch ohne API mit lokaler Mock-Welt weiter, damit das Core-Erlebnis sofort demonstrierbar bleibt.
Die Browser-App ist davon getrennt: keine Fetches zur API, eigene Storage-Keys und ein eigener Service Worker für den Offline-Cache.

## MVP-Scope in diesem Stand

- Gastidentität mit lokalem Fallback
- GPS/Demo-Lokation und geglätteter Bewegungsstatus (`Transit`, `Wander`, `Still`)
- Nearby-World-Generierung mit Zellen, Biomen, Wetterabdruck und Pflanzen-DNA
- Drei Pflanzmodi: `Drift`, `Root`, `Deep Root`
- Garden View mit Three.js-Primitiven
- AR-Capability-Detection als optionaler Layer
- PWA-Manifest und einfacher Service-Worker
- separate browser-only Offline-App mit lokalem Cache für Shell und Assets
- Fastify-Endpunkte für `auth`, `world`, `planting`

## Render Deployment

GeoFlora ist in diesem Stand für einen einzelnen Render `web` service vorbereitet.

- `render.yaml` liegt im Repo-Root
- Render baut das komplette Monorepo mit `npm install && npm run build`
- der Fastify-Server liefert nach dem Build zusätzlich das Vite-Frontend aus `apps/web/dist` aus
- Health Check läuft auf `/health`

Wichtig für dieses Monorepo:

- Die Render-Service-Root sollte das Repo-Root bleiben
- `apps/server` allein als `rootDir` wäre hier falsch, weil Render laut Monorepo-Regeln Dateien außerhalb des Root-Verzeichnisses dann weder beim Build noch zur Laufzeit bereitstellt und die Workspace-Pakete damit fehlen würden

Für lokales Deployment-Verhalten gilt weiter:

- ohne laufende API bleibt die Web-App über lokale Mock-Welt nutzbar
- auf Render laufen Web-App und API unter derselben Origin

## Nächste Sprints

- echte Persistenz mit MongoDB + Redis
- Tone.js-basierte generative Audio-Engine
- Socket-basierte Presence und kollektive Harmonie-Updates
- saisonale Pflege- und Revisit-Systeme
