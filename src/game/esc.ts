// Escapes text for putting in innerHTML (names a rider typed, area names).
export const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
