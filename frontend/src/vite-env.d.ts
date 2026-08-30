/// <reference types="vite/client" />

declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  export const expect: <T>(actual: T) => {
    toEqual: (expected: T) => void;
    toBe: (expected: T) => void;
    toBeNull: () => void;
  };
  export const beforeEach: (fn: () => void) => void;
}
