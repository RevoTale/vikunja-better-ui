const changeKey = "vbu:session-change";
let channel: BroadcastChannel | undefined;
let leaveDocument: ((target?: string) => void) | undefined;

// Keep the private Apollo cache, router and mounted editors within one browser session.
export function watchSessionChanges(discard: (target?: string) => void): void {
  let leaving = false;
  leaveDocument = (target) => {
    if (leaving) return;
    leaving = true;
    discard(target);
  };
  const restart = () => leaveDocument?.();
  const initialMarker = readMarker();
  window.addEventListener("storage", (event) => {
    if (event.key === changeKey) restart();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && readMarker() !== initialMarker) restart();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) restart();
  });
  if ("BroadcastChannel" in window) {
    try {
      channel = new BroadcastChannel(changeKey);
      channel.onmessage = restart;
    } catch {
      // Storage events still notify tabs when the channel is unavailable.
    }
  }
}

function readMarker(): string | null {
  try {
    return window.localStorage.getItem(changeKey);
  } catch {
    return null;
  }
}

export function finishSessionChange(target: string): void {
  // The marker carries no identity, credentials, task data or destination.
  try {
    window.localStorage.setItem(changeKey, crypto.getRandomValues(new Uint32Array(2)).join("."));
  } catch {
    // BroadcastChannel also works when local storage is unavailable.
  }
  channel?.postMessage(null);
  leaveDocument?.(target);
}

export function sessionChangedElsewhere(): void {
  leaveDocument?.();
}
