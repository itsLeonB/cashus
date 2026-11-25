/// <reference types="vite/client" />

declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>) => void;
  interface Matchers<T> {
    toEqual: (expected: T | Partial<T>) => void;
    toBe: (expected: T) => void;
    toBeNull: () => void;
    toBeUndefined: () => void;
    toContain: (expected: string) => void;
    toHaveLength: (expected: number) => void;
    toEndWith: (expected: string) => void;
    toMatchObject: (expected: Partial<T>) => void;
    not: Matchers<T>;
    rejects: { toMatchObject: (expected: Partial<import("./lib/api/types").ApiError>) => Promise<void> };
  }
  export const expect: <T>(actual: T) => Matchers<T>;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const afterEach: (fn: () => void | Promise<void>) => void;
}
