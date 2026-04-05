import { randomUUID } from "node:crypto";

import { SEED_MODE_CONFIG } from "@geoflora/config";
import type {
  GeoPoint,
  GuestProfile,
  MovementSnapshot,
  PlantRecord,
  PlantingSession,
  SeedMode
} from "@geoflora/shared";
import { haversineDistanceMeters } from "@geoflora/shared";
import { createPlayerPlant } from "@geoflora/worldgen";

interface StartSessionInput {
  userId: string;
  location: GeoPoint;
  seedMode: SeedMode;
}

interface CompleteSessionInput {
  plantingId: string;
  location: GeoPoint;
  movement: MovementSnapshot;
}

class GeoFloraStore {
  private readonly guests = new Map<string, GuestProfile>();
  private readonly sessions = new Map<string, PlantingSession>();
  private readonly plants = new Map<string, PlantRecord>();

  createGuest(displayName?: string) {
    const userId = `guest_${randomUUID()}`;
    const guest: GuestProfile = {
      userId,
      displayName: displayName?.trim() || `Quiet Walker ${this.guests.size + 1}`,
      createdAt: new Date().toISOString()
    };

    this.guests.set(userId, guest);
    return guest;
  }

  getGuest(userId: string) {
    return this.guests.get(userId) ?? null;
  }

  startPlantingSession({ userId, location, seedMode }: StartSessionInput) {
    const plantingId = `planting_${randomUUID()}`;
    const now = new Date();
    const previewPlant = createPlayerPlant({
      userId,
      location,
      seedMode,
      movementState: "still",
      now
    });
    const session: PlantingSession = {
      plantingId,
      userId,
      seedMode,
      startedAt: now.toISOString(),
      durationSeconds: SEED_MODE_CONFIG[seedMode].durationSeconds,
      cellId: previewPlant.cellId,
      anchor: location,
      status: "active"
    };

    this.sessions.set(plantingId, session);
    return session;
  }

  getPlantingSession(plantingId: string) {
    return this.sessions.get(plantingId) ?? null;
  }

  updateHeartbeat(plantingId: string, elapsedSeconds: number, movement: MovementSnapshot) {
    const session = this.sessions.get(plantingId);
    if (!session || session.status !== "active") {
      return {
        accepted: false,
        reason: "session_not_found"
      } as const;
    }

    if (movement.state === "transit") {
      return {
        accepted: false,
        reason: "moving_too_fast"
      } as const;
    }

    return {
      accepted: elapsedSeconds <= session.durationSeconds + 10,
      reason: elapsedSeconds > session.durationSeconds + 10 ? "session_expired" : "ok"
    } as const;
  }

  completePlantingSession({ plantingId, location, movement }: CompleteSessionInput) {
    const session = this.sessions.get(plantingId);
    if (!session || session.status !== "active") {
      return null;
    }

    session.status = "completed";
    const plant = createPlayerPlant({
      userId: session.userId,
      location,
      seedMode: session.seedMode,
      movementState: movement.state,
      now: new Date()
    });

    this.plants.set(plant.id, plant);
    return plant;
  }

  listPlantsNearby(anchor: GeoPoint, radiusMeters: number) {
    return [...this.plants.values()].filter((plant) => {
      return haversineDistanceMeters(anchor, plant.location) <= radiusMeters;
    });
  }
}

export const store = new GeoFloraStore();

