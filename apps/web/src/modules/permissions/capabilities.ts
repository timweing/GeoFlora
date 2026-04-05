type MotionPermissionState = "idle" | "granted" | "denied" | "unsupported";

type DeviceOrientationPermissionEvent = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export async function detectArSupport() {
  const xr = (navigator as Navigator & {
    xr?: {
      isSessionSupported?: (mode: string) => Promise<boolean>;
    };
  }).xr;

  if (!xr?.isSessionSupported) {
    return false;
  }

  try {
    return await xr.isSessionSupported("immersive-ar");
  } catch {
    return false;
  }
}

export async function requestMotionPermission(): Promise<MotionPermissionState> {
  const permissionEvent = window.DeviceOrientationEvent as typeof DeviceOrientationEvent &
    DeviceOrientationPermissionEvent;

  if (!permissionEvent) {
    return "unsupported";
  }

  if (typeof permissionEvent.requestPermission !== "function") {
    return "granted";
  }

  try {
    const result = await permissionEvent.requestPermission();
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

export type { MotionPermissionState };

