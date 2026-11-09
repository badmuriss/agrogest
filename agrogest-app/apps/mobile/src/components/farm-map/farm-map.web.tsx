import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import { View } from 'react-native';

import { farmMapHtml } from './map-html';
import { ARCGIS_API_KEY, dispatchMapMessage, type FarmMapHandle, type FarmMapProps, type MapOutMessage } from './types';

/** Mapa de satélite num iframe (web): a mesma página do WebView. */
export function FarmMap({ ref, ...props }: FarmMapProps & { ref?: Ref<FarmMapHandle> }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => farmMapHtml(ARCGIS_API_KEY), []);
  // Handlers sempre atuais para as mensagens do mapa, sem reenviar a página.
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  const post = (message: object) => frame.current?.contentWindow?.postMessage({ agrogestIn: message }, '*');

  useImperativeHandle(ref, () => ({
    undo: () => post({ type: 'undo' }),
    clear: () => post({ type: 'clear' }),
    fit: () => post({ type: 'fit' }),
    center: (position, zoom) => post({ type: 'center', position, zoom }),
    focus: (position, bounds) => post({ type: 'focus', position, bounds }),
  }));

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !event.data?.agrogestMap) return;
      dispatchMapMessage(event.data.agrogestMap as MapOutMessage, propsRef.current, () => setReady(true));
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  const { boundary, pins, mode, accent, areas, outline, outlineColor, drawKey } = props;
  useEffect(() => {
    if (ready) post({ type: 'state', boundary: boundary ?? null, pins, mode, accent, areas: areas ?? [], outline: outline ?? null, outlineColor, drawKey: drawKey ?? '' });
  }, [ready, boundary, pins, mode, accent, areas, outline, outlineColor, drawKey]);

  return (
    <View style={[{ flex: 1, backgroundColor: '#10140f' }, props.style]}>
      <iframe ref={frame} title="Mapa da fazenda" srcDoc={html} style={{ border: 0, width: '100%', height: '100%' }} />
    </View>
  );
}
