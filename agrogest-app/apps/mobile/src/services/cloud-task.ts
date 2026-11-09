/** Serialize network snapshots and confirmed transfers per account database.
 * An older in-flight workspace reply must never erase a confirmed movement. */
const pending = new WeakMap<object, Promise<unknown>>();
export async function cloudTask<T>(database: object, task: () => Promise<T>): Promise<T> {
  const previous = pending.get(database) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  pending.set(database, next);
  try { return await next; }
  finally { if (pending.get(database) === next) pending.delete(database); }
}
