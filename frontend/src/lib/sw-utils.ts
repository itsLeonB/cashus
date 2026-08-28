/**
 * Service Worker Utilities
 *
 * Helper functions to manage service worker cache and ensure fresh data
 * after authentication changes.
 */

/**
 * Clear all service worker caches
 * Call this function on logout and after successful login
 */
export async function clearServiceWorkerCache(): Promise<void> {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    try {
      // Send message to service worker to clear cache
      const messageChannel = new MessageChannel();

      const clearPromise = new Promise<void>((resolve, reject) => {
        messageChannel.port1.onmessage = (event) => {
          if (event?.data?.success) {
            resolve();
          } else {
            reject(new Error("Cache clearing failed"));
          }
        };

        // Timeout after 5 seconds
        setTimeout(() => reject(new Error("Cache clearing timeout")), 5000);
      });

      navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" }, [
        messageChannel.port2,
      ]);

      await clearPromise;
      console.log("[SW Utils] Service worker cache cleared successfully");
    } catch (error) {
      console.error("[SW Utils] Failed to clear service worker cache:", error);
      // Fallback: try to clear cache directly
      await clearCacheDirectly();
    }
  } else {
    // If no service worker, try direct cache clearing
    await clearCacheDirectly();
  }
}

/**
 * Clear caches directly using Cache API
 */
async function clearCacheDirectly(): Promise<void> {
  if ("caches" in globalThis) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName)),
      );
      console.log("[SW Utils] Caches cleared directly");
    } catch (error) {
      console.error("[SW Utils] Failed to clear caches directly:", error);
    }
  }
}

/**
 * Force a hard reload of the page
 * Use this as a last resort after clearing cache
 */
export function forceReload(): void {
  // Use location.reload() for hard reload
  if (globalThis.location.reload) {
    globalThis.location.reload();
  }
}

/**
 * Unregister service worker (nuclear option)
 * Only use this if you need to completely disable the service worker
 */
export async function unregisterServiceWorker(): Promise<void> {
  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
      console.log("[SW Utils] Service worker unregistered");
    } catch (error) {
      console.error("[SW Utils] Failed to unregister service worker:", error);
    }
  }
}

/**
 * Check if service worker is controlling the page
 */
export function isServiceWorkerActive(): boolean {
  return "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
}

/**
 * Wait for service worker to be ready
 */
export async function waitForServiceWorker(): Promise<boolean> {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.ready;
    return true;
  }
  return false;
}
