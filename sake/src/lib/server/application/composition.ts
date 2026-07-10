// Public composition surface for controllers and server infrastructure.
// Subsystem wiring lives in the focused modules below; keeping these re-exports
// preserves the existing imports while making the dependency graph easier to navigate.
export * from './composition/foundation';
export * from './composition/providers';
export * from './composition/downloads';
export * from './composition/library';
export * from './composition/search';
export * from './composition/auth';
export * from './composition/integrations';
