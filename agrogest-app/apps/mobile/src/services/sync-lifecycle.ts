import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { API_URL } from './local-config';

// Network availability means the configured local API, never a public internet probe.
NetInfo.configure({ reachabilityUrl: `${API_URL}/api/health`, reachabilityMethod: 'GET', reachabilityTest: async (response) => response.status === 200, useNativeReachability: false, reachabilityRequestTimeout: 3000 });

/** One subscription per account; only foreground work or a reconnection starts a sync. */
export function watchCloudSync(sync: () => Promise<void>, onNetworkChange: (available: boolean) => void): () => void {
  let disposed = false;
  let foreground = AppState.currentState === 'active' || AppState.currentState === null;
  let connected = false;
  const refresh = () => {
    if (!disposed && foreground && connected) void sync();
  };

  const unsubscribe = NetInfo.addEventListener((state) => {
    if (disposed) return;
    const available = state.isConnected !== false && state.isInternetReachable !== false;
    const reconnected = available && !connected;
    connected = available;
    onNetworkChange(available);
    if (reconnected) refresh();
  });
  const lifecycle = AppState.addEventListener('change', (state) => {
    if (disposed) return;
    const resumed = state === 'active' && !foreground;
    foreground = state === 'active';
    if (resumed) refresh();
  });
  const timer = setInterval(refresh, 30000);

  return () => {
    disposed = true;
    unsubscribe();
    lifecycle.remove();
    clearInterval(timer);
  };
}
