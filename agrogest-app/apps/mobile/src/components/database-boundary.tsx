import { Component, Fragment, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { databaseFailureMessage, retryTransientWebLock } from '@/services/database-recovery';
import { radius, space, usePalette } from '@/theme';

interface Props {
  children: ReactNode;
  onError: () => void;
  onRetry: () => void;
}

interface State {
  error: unknown;
  failed: boolean;
  attempt: number;
}

/** Opening and migration failures must remain actionable before useApp is available. */
export class DatabaseBoundary extends Component<Props, State> {
  state: State = { error: null, failed: false, attempt: 0 };

  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true };
  }

  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  componentDidCatch(error: unknown) {
    this.props.onError();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const key = 'agrogest:last-opfs-retry';
        if (retryTransientWebLock(error, Number(window.sessionStorage.getItem(key) ?? 0), Date.now())) {
          window.sessionStorage.setItem(key, String(Date.now()));
          this.retryTimer = setTimeout(() => window.location.reload(), 300);
        }
      } catch { /* Storage denied: preserve the manual retry and the database. */ }
    }
  }

  componentWillUnmount() { if (this.retryTimer) clearTimeout(this.retryTimer); }

  retry = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Restart the page's worker against the same persisted database.
      window.location.reload();
      return;
    }
    this.props.onRetry();
    this.setState((state) => ({ error: null, failed: false, attempt: state.attempt + 1 }));
  };

  render() {
    if (this.state.failed) return <DatabaseFailure error={this.state.error} retry={this.retry} />;
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

function DatabaseFailure({ error, retry }: { error: unknown; retry: () => void }) {
  const p = usePalette();
  const text = databaseFailureMessage(error, Platform.OS === 'web');
  return (
    <View style={[styles.screen, { backgroundColor: p.background }]}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>{text.title}</Text>
        <Text accessibilityLiveRegion="polite" style={[styles.message, { color: p.textMuted }]}>{text.message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={({ pressed }) => [styles.button, { backgroundColor: p.accent, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={[styles.buttonText, { color: p.onAccent }]}>Tentar novamente</Text>
        </Pressable>
        <Text style={[styles.help, { color: p.textMuted }]}>{text.help}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  content: { width: '100%', maxWidth: 420, gap: space.lg },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  message: { fontSize: 16, lineHeight: 24 },
  help: { fontSize: 14, lineHeight: 21 },
  button: { minHeight: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', padding: space.md },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
