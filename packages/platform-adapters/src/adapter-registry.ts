import type { Platform } from '@omni-ad/shared';
import type { PlatformAdapter } from './types';

/**
 * Central registry that maps each Platform to its concrete adapter instance.
 *
 * Adapters are registered once at application startup (or in the platform-
 * specific module initializer) and then retrieved by the orchestration layer
 * using the platform enum key.
 *
 * The registry holds a single adapter instance per platform — adapters are
 * stateless with regard to credentials (access tokens are passed per-call),
 * so sharing one instance across requests is safe.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<Platform, PlatformAdapter>();

  /**
   * Registers an adapter for the given platform.
   * Overwrites any previously registered adapter for that platform.
   */
  register(platform: Platform, adapter: PlatformAdapter): void {
    this.adapters.set(platform, adapter);
  }

  /**
   * Returns the adapter for the requested platform.
   * Throws if no adapter has been registered for that platform — callers
   * must ensure registration before use (typically at application startup).
   */
  get(platform: Platform): PlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (adapter === undefined) {
      throw new Error(
        `No adapter registered for platform "${platform}". ` +
          `Register it with adapterRegistry.register() before use.`,
      );
    }
    return adapter;
  }

  /** Returns a snapshot of the current registry contents. */
  getAll(): Map<Platform, PlatformAdapter> {
    return new Map(this.adapters);
  }

  /** Returns true when an adapter is registered for the given platform. */
  has(platform: Platform): boolean {
    return this.adapters.has(platform);
  }
}

/** Application-wide singleton registry. */
export const adapterRegistry = new AdapterRegistry();
