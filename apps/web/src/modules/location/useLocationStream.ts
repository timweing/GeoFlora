import { useEffect, useMemo, useState } from "react";

import type { LocationSample } from "@geoflora/shared";

const DEMO_LOCATION: LocationSample = {
  lat: 47.3769,
  lng: 8.5417,
  accuracyMeters: 12,
  speedMps: 0,
  heading: 0,
  timestamp: Date.now()
};

type PermissionState = "idle" | "granted" | "denied" | "unsupported";

export function useLocationStream(enabled: boolean) {
  const [samples, setSamples] = useState<LocationSample[]>([DEMO_LOCATION]);
  const [permissionState, setPermissionState] = useState<PermissionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [source, setSource] = useState<"demo" | "live">("demo");

  useEffect(() => {
    if (!enabled) {
      setSource("demo");
      return;
    }

    if (!("geolocation" in navigator)) {
      setPermissionState("unsupported");
      setSource("demo");
      setErrorMessage("Geolocation ist in diesem Browser nicht verfügbar.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setPermissionState("granted");
        setSource("live");
        setErrorMessage(null);
        setSamples((current) => {
          const nextSample: LocationSample = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            speedMps: position.coords.speed,
            heading: position.coords.heading,
            timestamp: position.timestamp
          };

          return [...current, nextSample].slice(-12);
        });
      },
      (error) => {
        setPermissionState(error.code === error.PERMISSION_DENIED ? "denied" : "idle");
        setSource("demo");
        setErrorMessage("Live-Standort konnte nicht geladen werden. Demo-Welt bleibt aktiv.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 8_000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  const latestSample = useMemo(() => samples[samples.length - 1], [samples]);

  return {
    latestSample,
    samples,
    permissionState,
    errorMessage,
    source
  };
}

