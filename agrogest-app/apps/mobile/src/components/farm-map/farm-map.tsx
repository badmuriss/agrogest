import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react';
import { WebView } from 'react-native-webview';

import { farmMapHtml } from './map-html';
import { ARCGIS_API_KEY, dispatchMapMessage, type FarmMapHandle, type FarmMapProps, type MapOutMessage } from './types';

/** Mapa de satélite no WebView (Android/iOS). */
export function FarmMap({ ref, ...props }: FarmMapProps & { ref?: Ref<FarmMapHandle> }) {
  const view = useRef<WebView<object>>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => farmMapHtml(ARCGIS_API_KEY), []);
  // Handlers sempre atuais para as mensagens do mapa, sem reenviar a página.
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  const post = (message: object) => {
    view.current?.injectJavaScript(`window.__agrogestMap && window.__agrogestMap(${JSON.stringify(message)}); true;`);
  };

  useImperativeHandle(ref, () => ({
    undo: () => post({ type: 'undo' }),
    clear: () => post({ type: 'clear' }),
    fit: () => post({ type: 'fit' }),
    center: (position, zoom) => post({ type: 'center', position, zoom }),
    focus: (position, bounds) => post({ type: 'focus', position, bounds }),
  }));

  const { boundary, pins, mode, accent, areas, outline, outlineColor, drawKey } = props;
  useEffect(() => {
    if (ready) post({ type: 'state', boundary: boundary ?? null, pins, mode, accent, areas: areas ?? [], outline: outline ?? null, outlineColor, drawKey: drawKey ?? '' });
  }, [ready, boundary, pins, mode, accent, areas, outline, outlineColor, drawKey]);

  return (
    <WebView<object>
      ref={view}
      style={[{ flex: 1, backgroundColor: '#10140f' }, props.style]}
      originWhitelist={['*']}
      source={{ html, baseUrl: 'https://agrogest.app/' }}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      onMessage={(event) => {
        let message: MapOutMessage;
        try {
          message = JSON.parse(event.nativeEvent.data);
        } catch {
          return;
        }
        dispatchMapMessage(message, propsRef.current, () => setReady(true));
      }}
    />
  );
}
