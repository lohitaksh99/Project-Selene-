/**
 * Project Selene — Workspace Switch Lifecycle Manager
 *
 * Ensures switching workspaces deterministically:
 *   1. Cancels pending network requests owned by the outgoing workspace.
 *   2. Invokes registered teardown callbacks (animation loops, timers, WebGL helpers).
 *   3. Records active workspace ID for telemetry-safe diagnostics and smooth transitions.
 */

import { abortWorkspaceRequests } from '@/lib/services/apiRequestManager';

type CleanupCallback = () => void;

const cleanupRegistry = new Map<string, Set<CleanupCallback>>();
let currentActiveWorkspace = 'home';

export function registerWorkspaceCleanup(
  workspaceId: string,
  callback: CleanupCallback
): () => void {
  let set = cleanupRegistry.get(workspaceId);
  if (!set) {
    set = new Set();
    cleanupRegistry.set(workspaceId, set);
  }
  set.add(callback);
  return () => {
    cleanupRegistry.get(workspaceId)?.delete(callback);
  };
}

export function transitionWorkspaceLifecycle(
  previousWorkspaceId: string,
  nextWorkspaceId: string
): void {
  if (previousWorkspaceId === nextWorkspaceId) return;

  abortWorkspaceRequests(previousWorkspaceId);

  const callbacks = cleanupRegistry.get(previousWorkspaceId);
  if (callbacks) {
    for (const cb of callbacks) {
      try {
        cb();
      } catch {
        // Ignore teardown errors during unmount/switch
      }
    }
    callbacks.clear();
  }

  currentActiveWorkspace = nextWorkspaceId;
}

export function getCurrentActiveWorkspaceId(): string {
  return currentActiveWorkspace;
}
