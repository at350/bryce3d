let counter = 0;

/** Unique id for scene objects (stable within a session, unique across loads). */
export function newId(): string {
  counter = (counter + 1) % 1e6;
  return `o${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
