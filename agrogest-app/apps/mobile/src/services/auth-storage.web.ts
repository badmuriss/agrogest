// Browser sessions are scoped to this origin. Native sessions use Keychain/Keystore.
export const authStorage = {
  async getItem(key: string) { return globalThis.localStorage?.getItem(key) ?? null; },
  async setItem(key: string, value: string) { globalThis.localStorage.setItem(key, value); },
  async removeItem(key: string) { globalThis.localStorage.removeItem(key); },
};
