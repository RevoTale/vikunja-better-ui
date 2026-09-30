export function registerOfflineShell() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  // Failure must never prevent online use (private mode, storage limits, unsupported browsers).
  const register = () => {
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
