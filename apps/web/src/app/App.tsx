import { useEffect, useMemo, useRef, useState } from "react";

import { summarizeSoundscape, type PlantVoice } from "@geoflora/audio";
import { APP_NAME, FAMILY_PALETTES, SEED_MODE_CONFIG } from "@geoflora/config";
import type {
  GuestProfile,
  MovementSnapshot,
  PlantRecord,
  SeedMode
} from "@geoflora/shared";
import { deriveMovementState } from "@geoflora/shared";
import { createPlayerPlant } from "@geoflora/worldgen";

import { GardenScene } from "../modules/garden/GardenScene";
import {
  detectArSupport,
  requestMotionPermission,
  type MotionPermissionState
} from "../modules/permissions/capabilities";
import { useLocationStream } from "../modules/location/useLocationStream";
import { useNearbyWorld } from "../modules/world/useNearbyWorld";

const STORAGE_KEYS = {
  guest: "geoflora.guest",
  plants: "geoflora.localPlants"
} as const;

const SEED_COPY: Record<SeedMode, { title: string; detail: string }> = {
  drift: {
    title: "Drift",
    detail: "20 Sekunden. Für leichte Gras- und Klangpunkte."
  },
  root: {
    title: "Root",
    detail: "60 Sekunden. Der Standard für neue Gartenknoten."
  },
  deep_root: {
    title: "Deep Root",
    detail: "120 Sekunden. Dichte Strukturen und seltenere Blüten."
  }
};

type ViewMode = "map" | "garden" | "ar";

interface ActivePlanting {
  plantingId: string;
  startedAtMs: number;
  durationSeconds: number;
  seedMode: SeedMode;
  serverBacked: boolean;
}

export function App() {
  const [guest, setGuest] = useState<GuestProfile>(() => readStoredGuest());
  const [storedPlants, setStoredPlants] = usePersistentState<PlantRecord[]>(STORAGE_KEYS.plants, []);
  const [selectedSeedMode, setSelectedSeedMode] = useState<SeedMode>("root");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [motionPermission, setMotionPermission] = useState<MotionPermissionState>("idle");
  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const [planting, setPlanting] = useState<ActivePlanting | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [notice, setNotice] = useState<string>("Langsames Gehen macht den Garten sichtbar.");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const completingRef = useRef(false);

  useEffect(() => {
    setTick(Date.now());
    const intervalId = window.setInterval(() => {
      setTick(Date.now());
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.guest, JSON.stringify(guest));
  }, [guest]);

  useEffect(() => {
    let cancelled = false;

    async function syncGuest() {
      if (!guest.userId.startsWith("guest_local_")) {
        return;
      }

      try {
        const response = await fetch("/api/v1/auth/guest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            displayName: guest.displayName
          })
        });

        if (!response.ok) {
          return;
        }

        const serverGuest = (await response.json()) as GuestProfile;
        if (!cancelled) {
          setGuest(serverGuest);
        }
      } catch {
        // Local fallback stays active.
      }
    }

    void syncGuest();

    return () => {
      cancelled = true;
    };
  }, [guest.displayName, guest.userId]);

  useEffect(() => {
    void detectArSupport().then(setArSupported);
  }, []);

  const {
    latestSample,
    samples,
    permissionState,
    errorMessage: locationError,
    source
  } = useLocationStream(locationEnabled);
  const movement = useMemo<MovementSnapshot>(() => deriveMovementState(samples), [samples]);
  const { world, serverReachable, isRefreshing } = useNearbyWorld({
    anchor: {
      lat: latestSample.lat,
      lng: latestSample.lng
    },
    localPlants: storedPlants
  });
  const soundscape = useMemo(() => summarizeSoundscape(world), [world]);
  useAmbientVoices(soundscape.voices, audioEnabled);

  const remainingSeconds = planting
    ? Math.max(0, planting.durationSeconds - Math.floor((tick - planting.startedAtMs) / 1000))
    : 0;
  const canPlant = movement.state !== "transit";
  const recentOwnPlants = useMemo(
    () =>
      [...storedPlants]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 3),
    [storedPlants]
  );

  useEffect(() => {
    if (!planting || remainingSeconds > 0 || completingRef.current) {
      return;
    }

    completingRef.current = true;
    void completePlanting();
  }, [remainingSeconds, planting]);

  useEffect(() => {
    if (!planting?.serverBacked || remainingSeconds <= 0) {
      return;
    }

    const elapsedSeconds = Math.floor((tick - planting.startedAtMs) / 1000);
    if (elapsedSeconds === 0 || elapsedSeconds % 5 !== 0) {
      return;
    }

    void fetch("/api/v1/planting/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        plantingId: planting.plantingId,
        elapsedSeconds,
        movement
      })
    }).catch(() => {
      // Fallback remains local if the API disappears mid-session.
    });
  }, [tick, planting, movement, remainingSeconds]);

  async function completePlanting() {
    if (!planting) {
      completingRef.current = false;
      return;
    }

    const location = {
      lat: latestSample.lat,
      lng: latestSample.lng
    };
    let plant: PlantRecord | null = null;

    if (planting.serverBacked) {
      try {
        const response = await fetch("/api/v1/planting/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            plantingId: planting.plantingId,
            location,
            movement
          })
        });

        if (response.ok) {
          plant = (await response.json()) as PlantRecord;
        }
      } catch {
        // Local fallback below.
      }
    }

    if (!plant) {
      plant = createPlayerPlant({
        userId: guest.userId,
        location,
        seedMode: planting.seedMode,
        movementState: movement.state,
        now: new Date()
      });
    }

    setStoredPlants((current) => dedupeById([...current, plant!]));
    setPlanting(null);
    setViewMode("garden");
    setNotice(`${SEED_COPY[planting.seedMode].title} hat an diesem Ort Wurzeln geschlagen.`);
    completingRef.current = false;
  }

  async function beginPlanting() {
    if (!canPlant) {
      setNotice("Zu schnell. Im Transit bleibt der Garten stumm.");
      return;
    }

    const location = {
      lat: latestSample.lat,
      lng: latestSample.lng
    };
    const seedMode = selectedSeedMode;
    const fallbackSession: ActivePlanting = {
      plantingId: `local_${Date.now()}`,
      startedAtMs: Date.now(),
      durationSeconds: SEED_MODE_CONFIG[seedMode].durationSeconds,
      seedMode,
      serverBacked: false
    };

    try {
      const response = await fetch("/api/v1/planting/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: guest.userId,
          location,
          seedMode
        })
      });

      if (response.ok) {
        const session = (await response.json()) as {
          plantingId: string;
          durationSeconds: number;
          seedMode: SeedMode;
        };
        setPlanting({
          plantingId: session.plantingId,
          startedAtMs: Date.now(),
          durationSeconds: session.durationSeconds,
          seedMode: session.seedMode,
          serverBacked: true
        });
      } else {
        setPlanting(fallbackSession);
      }
    } catch {
      setPlanting(fallbackSession);
    }

    setViewMode("garden");
    setNotice(`${SEED_COPY[seedMode].title} läuft. Bleibe ruhig und lass den Ort antworten.`);
  }

  async function enableMotion() {
    const result = await requestMotionPermission();
    setMotionPermission(result);
    setNotice(
      result === "granted"
        ? "Bewegungssensoren freigegeben."
        : result === "denied"
          ? "Ohne Bewegungssensoren bleibt GeoFlora nutzbar."
          : "Dieser Browser verlangt keine zusätzliche Sensorfreigabe."
    );
  }

  return (
    <div className="shell">
      <div className="shell__glow shell__glow--left" />
      <div className="shell__glow shell__glow--right" />

      <header className="hero">
        <p className="eyebrow">Synchronisierte Stille</p>
        <div className="hero__row">
          <div>
            <h1>{APP_NAME}</h1>
            <p className="hero__copy">
              Eine persistente Walking-Gartenwelt aus GPS, prozeduralen Pflanzen und ruhigen Stimmen.
            </p>
          </div>
          <div className="hero__status">
            <StatusPill label="Quelle" value={source === "live" ? "Live GPS" : "Demo-Ort"} tone={source === "live" ? "emerald" : "sand"} />
            <StatusPill label="Bewegung" value={titleCase(movement.state)} tone={movementTone(movement.state)} />
            <StatusPill label="Wetterspur" value={titleCase(world.ambient.mood)} tone="mist" />
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="panel panel--wide">
          <div className="section-header">
            <div>
              <p className="section-header__kicker">Onboarding</p>
              <h2>Ruhiger Einstieg</h2>
            </div>
            <p className="section-header__meta">
              {notice}
            </p>
          </div>

          <div className="permission-grid">
            <article className="card">
              <p className="card__label">Standort</p>
              <h3>Der Garten orientiert sich an deinem Ort</h3>
              <p>
                Sichere Kontexte vorausgesetzt, wechselt GeoFlora automatisch von Demo nach Live.
              </p>
              <button className="button" onClick={() => setLocationEnabled(true)}>
                Standort aktivieren
              </button>
              <p className="meta-line">
                Status: {titleCase(permissionState)} {locationError ? `· ${locationError}` : ""}
              </p>
            </article>

            <article className="card">
              <p className="card__label">Sensoren</p>
              <h3>Langsamkeit als Spielinput</h3>
              <p>
                Bewegungsstatus und Verweilen werden geglättet, damit GPS-Sprünge nicht unfair wirken.
              </p>
              <button className="button button--secondary" onClick={enableMotion}>
                Bewegung freigeben
              </button>
              <p className="meta-line">Status: {titleCase(motionPermission)}</p>
            </article>

            <article className="card">
              <p className="card__label">AR</p>
              <h3>Optionaler Hologramm-Modus</h3>
              <p>
                Capability Detection bleibt Pflicht. Der Kernloop lebt in Karte und Garden View.
              </p>
              <button
                className="button button--ghost"
                disabled={!arSupported}
                onClick={() => setViewMode("ar")}
              >
                {arSupported ? "AR öffnen" : "AR nicht verfügbar"}
              </button>
              <p className="meta-line">
                {arSupported === null
                  ? "Prüfung läuft…"
                  : arSupported
                    ? "Gerät meldet AR-Unterstützung."
                    : "Fallback bleibt aktiv."}
              </p>
            </article>
          </div>
        </section>

        <section className="panel panel--wide">
          <div className="section-header">
            <div>
              <p className="section-header__kicker">Welt</p>
              <h2>Map Mode + Garden View</h2>
            </div>
            <div className="mode-switch">
              {(["map", "garden", "ar"] as const).map((mode) => (
                <button
                  key={mode}
                  className={mode === viewMode ? "chip chip--active" : "chip"}
                  onClick={() => setViewMode(mode)}
                >
                  {mode === "map" ? "Map" : mode === "garden" ? "Garden" : "AR"}
                </button>
              ))}
            </div>
          </div>

          {viewMode === "map" && <NearbyMap plants={world.plants} />}
          {viewMode === "garden" && <GardenScene plants={world.plants} />}
          {viewMode === "ar" && (
            <div className="ar-state">
              <h3>AR bleibt optional</h3>
              <p>
                Der Capability-Check ist aktiv. Für den MVP wird AR bewusst nicht zum Pflichtpfad gemacht.
              </p>
            </div>
          )}

          <div className="world-footer">
            <span>{world.cells.length} Zellen im Umkreis</span>
            <span>{world.plants.length} sichtbare Pflanzen</span>
            <span>{isRefreshing ? "aktualisiert…" : serverReachable ? "API verbunden" : "lokale Welt"}</span>
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="section-header__kicker">Pflanzung</p>
              <h2>Drei Rituale statt starrem Warten</h2>
            </div>
            <p className="section-header__meta">{Math.max(0, remainingSeconds)}s</p>
          </div>

          <div className="seed-grid">
            {(Object.keys(SEED_COPY) as SeedMode[]).map((seedMode) => (
              <button
                key={seedMode}
                className={seedMode === selectedSeedMode ? "seed-card seed-card--active" : "seed-card"}
                onClick={() => setSelectedSeedMode(seedMode)}
              >
                <span className="seed-card__title">{SEED_COPY[seedMode].title}</span>
                <span className="seed-card__detail">{SEED_COPY[seedMode].detail}</span>
              </button>
            ))}
          </div>

          <div className="planting-panel">
            <div>
              <p className="card__label">Bewegungslogik</p>
              <h3>{titleCase(movement.state)}</h3>
              <p>
                {movement.state === "transit"
                  ? "Schnelle Fortbewegung dämpft die Welt."
                  : movement.state === "still"
                    ? "Du bist ruhig genug, um Wurzeln zu schlagen."
                    : "Wander ist aktiv. Ein kurzer Halt vertieft die Pflanzung."}
              </p>
              <p className="meta-line">
                {movement.speedKmh.toFixed(1)} km/h · {Math.round(movement.confidence * 100)}% Vertrauen
              </p>
            </div>

            <button
              className="button button--primary"
              disabled={!canPlant || Boolean(planting)}
              onClick={beginPlanting}
            >
              {planting ? "Ritual läuft" : `${SEED_COPY[selectedSeedMode].title} starten`}
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="section-header__kicker">Klang</p>
              <h2>Audiovisueller Atem</h2>
            </div>
            <button
              className={audioEnabled ? "chip chip--active" : "chip"}
              onClick={() => setAudioEnabled((current) => !current)}
            >
              {audioEnabled ? "Audio an" : "Audio starten"}
            </button>
          </div>

          <p className="sound-headline">{soundscape.headline}</p>
          <div className="sound-stats">
            <StatusPill label="Skala" value={soundscape.scale} tone="sand" />
            <StatusPill label="Dichte" value={soundscape.density.toFixed(2)} tone="emerald" />
            <StatusPill label="Voices" value={String(soundscape.voices.length)} tone="mist" />
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="section-header__kicker">Journal</p>
              <h2>Rückkehrgründe</h2>
            </div>
            <p className="section-header__meta">{guest.displayName}</p>
          </div>

          {recentOwnPlants.length === 0 ? (
            <p className="empty-state">
              Noch keine eigene Pflanzung gespeichert. Der erste Standort bleibt nach Reload erhalten.
            </p>
          ) : (
            <div className="journal-list">
              {recentOwnPlants.map((plant) => (
                <article className="journal-entry" key={plant.id}>
                  <span
                    className="journal-entry__swatch"
                    style={{ background: FAMILY_PALETTES[plant.family].bloom }}
                  />
                  <div>
                    <h3>{titleCase(plant.family.replace("_", " "))}</h3>
                    <p>{new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(plant.createdAt))}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function NearbyMap({ plants }: { plants: PlantRecord[] }) {
  return (
    <div className="map-frame">
      <svg className="map-view" viewBox="0 0 320 320" role="img" aria-label="Nearby garden map">
        <defs>
          <radialGradient id="gardenGlow" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#f5e9c8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#163329" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="320" height="320" rx="32" fill="#132a22" />
        <circle cx="160" cy="160" r="126" fill="url(#gardenGlow)" />
        <circle cx="160" cy="160" r="18" fill="#f4ead8" opacity="0.85" />

        {[40, 80, 120].map((radius) => (
          <circle
            key={radius}
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            stroke="#305447"
            strokeDasharray="6 8"
            opacity="0.5"
          />
        ))}

        {plants.slice(0, 100).map((plant) => {
          const x = 160 + plant.worldOffset.x * 0.75;
          const y = 160 + plant.worldOffset.z * 0.75;
          const palette = FAMILY_PALETTES[plant.family];
          return (
            <g key={plant.id}>
              <circle cx={x} cy={y} r="9" fill={palette.stem} opacity="0.18" />
              <circle cx={x} cy={y} r="4.5" fill={palette.bloom} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "emerald" | "sand" | "mist" | "rose";
}) {
  return (
    <div className={`status-pill status-pill--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function movementTone(state: MovementSnapshot["state"]) {
  switch (state) {
    case "still":
      return "emerald";
    case "wander":
      return "sand";
    case "transit":
      return "rose";
  }
}

function readStoredGuest(): GuestProfile {
  const stored = localStorage.getItem(STORAGE_KEYS.guest);
  if (stored) {
    try {
      return JSON.parse(stored) as GuestProfile;
    } catch {
      // fall through to local guest
    }
  }

  return {
    userId: `guest_local_${crypto.randomUUID()}`,
    displayName: "Quiet Walker",
    createdAt: new Date().toISOString()
  };
}

function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    if (!stored) {
      return initialValue;
    }

    try {
      return JSON.parse(stored) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState] as const;
}

function dedupeById(plants: PlantRecord[]) {
  const seen = new Set<string>();

  return plants.filter((plant) => {
    if (seen.has(plant.id)) {
      return false;
    }

    seen.add(plant.id);
    return true;
  });
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function useAmbientVoices(voices: PlantVoice[], enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Array<{
    oscillator: OscillatorNode;
    gain: GainNode;
    panner?: StereoPannerNode;
  }>>([]);

  useEffect(() => {
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!enabled || !AudioContextCtor) {
      teardownAudio(nodesRef.current);
      return;
    }

    const context = contextRef.current ?? new AudioContextCtor();
    contextRef.current = context;
    void context.resume();

    teardownAudio(nodesRef.current);

    nodesRef.current = voices.slice(0, 4).map((voice) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const panner = "createStereoPanner" in context ? context.createStereoPanner() : undefined;
      oscillator.type = voice.waveform;
      oscillator.frequency.value = voice.frequencyHz;
      gain.gain.value = voice.gain;

      if (panner) {
        panner.pan.value = voice.pan;
        oscillator.connect(gain);
        gain.connect(panner);
        panner.connect(context.destination);
      } else {
        oscillator.connect(gain);
        gain.connect(context.destination);
      }

      oscillator.start();
      return {
        oscillator,
        gain,
        panner
      };
    });

    return () => {
      teardownAudio(nodesRef.current);
    };
  }, [enabled, voices]);
}

function teardownAudio(nodes: Array<{ oscillator: OscillatorNode; gain: GainNode; panner?: StereoPannerNode }>) {
  nodes.forEach(({ oscillator, gain, panner }) => {
    try {
      oscillator.stop();
    } catch {
      // StrictMode can tear down the same node twice in development.
    }

    oscillator.disconnect();
    gain.disconnect();
    panner?.disconnect();
  });
  nodes.length = 0;
}
