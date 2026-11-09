import { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { haptics } from '@/components/ui/motion';
import { AppText, Icon } from '@/components/ui/text';
import { parseCoordinates, type Position } from '@/domain/geo';
import { searchPlaces, type Place } from '@/services/geocoding';
import { radius, space, useIsDark, usePalette } from '@/theme';

/** Intervalo mínimo entre buscas pedido pela política do Nominatim. */
const MIN_INTERVAL_MS = 1100;

/**
 * Barra de busca sobre o mapa: cidade, distrito, fazenda ou coordenadas ("-20.45, -54.6").
 * Busca só ao confirmar (teclado ou lupa), mostra até 6 lugares e leva o mapa até o escolhido.
 */
export function PlaceSearch({ onPick }: { onPick: (place: Pick<Place, 'name' | 'position' | 'bounds'>) => void }) {
  const p = usePalette();
  const dark = useIsDark();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = useRef(0);
  const pending = useRef<AbortController | null>(null);

  const pick = (place: Pick<Place, 'name' | 'position' | 'bounds'>) => {
    haptics.tap();
    Keyboard.dismiss();
    setResults(null);
    setError(null);
    onPick(place);
  };

  const search = async () => {
    const text = query.trim();
    if (text.length < 2) return;
    const coordinates: Position | null = parseCoordinates(text);
    if (coordinates) {
      pick({ name: text, position: coordinates, bounds: null });
      return;
    }
    const wait = last.current + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    last.current = Date.now();
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    try {
      const places = await searchPlaces(text, controller.signal);
      if (controller.signal.aborted) return;
      if (places.length === 1) pick(places[0]);
      else {
        setResults(places);
        if (places.length === 0) setError('Nenhum lugar encontrado. Tente o município e o estado, ex.: "Uberaba, MG".');
      }
    } catch (failure) {
      if (controller.signal.aborted) return;
      setResults(null);
      setError(failure instanceof Error && failure.message.startsWith('A busca') ? failure.message : 'Sem internet para buscar agora.');
    } finally {
      if (pending.current === controller) setBusy(false);
    }
  };

  const clear = () => {
    pending.current?.abort();
    setQuery('');
    setResults(null);
    setError(null);
    setBusy(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Icon name="magnify" size={22} color={p.textMuted} />
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (results || error) {
              setResults(null);
              setError(null);
            }
          }}
          onSubmitEditing={() => void search()}
          placeholder="Buscar cidade, distrito ou coordenadas"
          placeholderTextColor={p.textFaint}
          returnKeyType="search"
          autoCorrect={false}
          keyboardAppearance={dark ? 'dark' : 'light'}
          selectionColor={p.accent}
          accessibilityLabel="Buscar lugar no mapa"
          style={[styles.input, { color: p.text }]}
        />
        {busy ? (
          <ActivityIndicator color={p.accent} />
        ) : query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" hitSlop={10} onPress={clear}>
            <Icon name="close-circle" size={20} color={p.textFaint} />
          </Pressable>
        ) : null}
        {query.trim().length >= 2 && !busy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buscar"
            onPress={() => void search()}
            style={({ pressed }) => [styles.go, { backgroundColor: p.accent, opacity: pressed ? 0.8 : 1 }]}>
            <Icon name="arrow-right" size={20} color={p.onAccent} />
          </Pressable>
        ) : null}
      </View>

      {error || (results && results.length > 0) ? (
        <View style={[styles.results, { backgroundColor: p.surface, borderColor: p.border }]}>
          {error ? (
            <AppText variant="caption" tone="muted" style={styles.message}>
              {error}
            </AppText>
          ) : (
            results!.map((place, i) => (
              <Pressable
                key={place.id}
                accessibilityRole="button"
                accessibilityLabel={`${place.name}, ${place.detail}`}
                onPress={() => pick(place)}
                style={({ pressed }) => [
                  styles.result,
                  i > 0 && { borderTopColor: p.border, borderTopWidth: StyleSheet.hairlineWidth },
                  pressed && { backgroundColor: p.fill },
                ]}>
                <Icon name="map-marker-outline" size={20} color={p.textMuted} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {place.name}
                  </AppText>
                  {place.detail ? (
                    <AppText variant="caption" tone="muted" numberOfLines={1}>
                      {place.detail}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
          <AppText variant="caption" tone="faint" style={styles.credit}>
            Busca: © colaboradores do OpenStreetMap
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: space.xs },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingLeft: space.md,
    paddingRight: 6,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: space.sm },
  go: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  results: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', elevation: 4 },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm + 2, minHeight: 52 },
  message: { padding: space.md },
  credit: { paddingHorizontal: space.md, paddingBottom: space.sm, paddingTop: 2 },
});
