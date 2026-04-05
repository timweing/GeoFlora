# GeoFlora MVP-Architektur

## Ziel dieses Stands

Der aktuelle Stand liefert einen ersten Vertical Slice für GeoFlora:

- mobile-first Web-App
- deterministische Nearby-Welt
- Bewegungszustand aus geglätteten GPS-Samples
- lokaler Pflanz-Loop
- 3D-Garden-Ansicht
- optionale API für Guest Auth und Planting

## Schichten

### `packages/shared`

Gemeinsame Typen für:

- Pflanzen
- Zellen
- Planting-Sessions
- Bewegungs-Snapshots

Außerdem liegt hier die geglättete Bewegungsableitung, damit Client und Server dieselbe Logik nutzen können.

### `packages/worldgen`

Deterministische Welt aus Rasterzellen:

- globale Mercator-Zellen in Metergröße
- lokale ENU-ähnliche Offsets in Metern
- Biom- und Wetterabdruck
- Pflanzen-DNA und Wachstum

### `packages/rendering`

Übersetzt Pflanzen-DNA in primitive 3D-Bausteine. Dadurch bleibt das Rendering stilisiert und performancefreundlich.

### `packages/audio`

Leitet ruhige Klang-DNA und Voice-Spezifikationen aus Pflanzen und Zellen ab. Im MVP ist das noch bewusst leichtgewichtig.

### `apps/web`

Erste Produktoberfläche mit:

- Intro und ruhigem Permission-Flow
- Demo- und GPS-Betrieb
- Map Mode
- Garden View
- Pflanzritual mit drei Zeitstufen

### `apps/browser`

Separate Offline-Variante ohne Serverkopplung:

- keine API-Requests
- eigener Local-Storage-Namespace
- lokaler Service Worker für Shell- und Asset-Cache
- deterministische Nearby-Welt und lokaler Pflanz-Loop

### `apps/server`

In-Memory-API für:

- Guest Auth
- Nearby World
- Planting Start / Heartbeat / Complete

## Nächste technische Ausbaustufen

1. MongoDB-Persistenz und Rate-Limits
2. Redis-Nearby-Cache
3. Socket Presence
4. Tone.js Audio Scheduler
5. WebXR AR Session mit Capability Detection und sauberem Fallback
