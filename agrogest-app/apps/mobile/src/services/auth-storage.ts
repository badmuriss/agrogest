import * as SecureStore from 'expo-secure-store';

// Keychain/Keystore values stay below 2 KiB, including non-ASCII profile names.
// Write a new generation before switching the pointer, so interruption cannot
// replace a valid session with a partially written one.
type Pointer = { generation: string; count: number };
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function pointer(key: string): Promise<Pointer | null> {
  const value = await SecureStore.getItemAsync(key, options);
  if (!value) return null;
  return JSON.parse(value) as Pointer;
}

async function removeChunks(key: string, value: Pointer | null) {
  if (!value) return;
  for (let i = 0; i < value.count; i++) {
    await SecureStore.deleteItemAsync(`${key}.${value.generation}.${i}`, options);
  }
}

export const authStorage = {
  async getItem(key: string) {
    const value = await pointer(key);
    if (!value) return null;
    let result = '';
    for (let i = 0; i < value.count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${value.generation}.${i}`, options);
      if (part === null) return null;
      result += part;
    }
    return result;
  },
  async setItem(key: string, value: string) {
    const old = await pointer(key);
    const chars = Array.from(value);
    const next = { generation: `${Date.now()}-${Math.random().toString(36).slice(2)}`, count: Math.ceil(chars.length / 400) };
    for (let i = 0; i < next.count; i++) {
      await SecureStore.setItemAsync(`${key}.${next.generation}.${i}`, chars.slice(i * 400, (i + 1) * 400).join(''), options);
    }
    await SecureStore.setItemAsync(key, JSON.stringify(next), options);
    await removeChunks(key, old);
  },
  async removeItem(key: string) {
    const old = await pointer(key);
    await SecureStore.deleteItemAsync(key, options);
    await removeChunks(key, old);
  },
};
