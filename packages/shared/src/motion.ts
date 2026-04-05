import { MOVEMENT_THRESHOLDS } from "@geoflora/config";

import type { LocationSample, MovementSnapshot } from "./types";

const EARTH_RADIUS_METERS = 6_371_000;

export function haversineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRadians(b.lng - a.lng);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function deriveMovementState(samples: LocationSample[]): MovementSnapshot {
  if (samples.length === 0) {
    return {
      state: "still",
      speedKmh: 0,
      stationaryMs: 0,
      confidence: 0.2
    };
  }

  const recent = samples.slice(-MOVEMENT_THRESHOLDS.smoothingWindow);
  const now = recent[recent.length - 1].timestamp;

  const derivedSpeeds = recent
    .map((sample, index) => {
      if (typeof sample.speedMps === "number" && Number.isFinite(sample.speedMps)) {
        return sample.speedMps;
      }

      if (index === 0) {
        return 0;
      }

      const prev = recent[index - 1];
      const dtSeconds = Math.max((sample.timestamp - prev.timestamp) / 1000, 1);
      return haversineDistanceMeters(prev, sample) / dtSeconds;
    })
    .filter((speed) => Number.isFinite(speed));

  const averageSpeedMps =
    derivedSpeeds.reduce((sum, speed) => sum + speed, 0) / Math.max(derivedSpeeds.length, 1);
  const speedKmh = averageSpeedMps * 3.6;

  const anchor = recent[recent.length - 1];
  const maxDispersion = recent.reduce((max, sample) => {
    return Math.max(max, haversineDistanceMeters(anchor, sample));
  }, 0);

  const stationarySamples = [...recent].reverse();
  let stationaryMs = 0;

  for (let index = 0; index < stationarySamples.length - 1; index += 1) {
    const current = stationarySamples[index];
    const next = stationarySamples[index + 1];
    const speed = typeof current.speedMps === "number" ? current.speedMps * 3.6 : speedKmh;
    const dispersion = haversineDistanceMeters(anchor, next);

    if (speed > MOVEMENT_THRESHOLDS.stillKmh || dispersion > MOVEMENT_THRESHOLDS.maxDispersionMeters) {
      break;
    }

    stationaryMs = now - next.timestamp;
  }

  let state: MovementSnapshot["state"] = "wander";
  if (speedKmh >= MOVEMENT_THRESHOLDS.transitKmh) {
    state = "transit";
  } else if (
    speedKmh <= MOVEMENT_THRESHOLDS.stillKmh &&
    stationaryMs >= MOVEMENT_THRESHOLDS.stillHoldMs &&
    maxDispersion <= MOVEMENT_THRESHOLDS.maxDispersionMeters
  ) {
    state = "still";
  }

  const accuracyPenalty =
    recent.reduce((sum, sample) => sum + sample.accuracyMeters, 0) / recent.length;
  const confidence = clamp(1 - accuracyPenalty / 60, 0.15, 0.98);

  return {
    state,
    speedKmh: round(speedKmh, 2),
    stationaryMs,
    confidence
  };
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

