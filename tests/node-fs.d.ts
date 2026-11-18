// The few node:fs calls the tests use (the project has no @types/node: everything else runs in the browser)
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function statSync(path: string): { size: number };
  export function readdirSync(path: string): string[];
}
