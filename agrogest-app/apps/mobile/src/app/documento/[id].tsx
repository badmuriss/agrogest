import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams } from 'expo-router';
import { Button, Note } from '@/components/ui/controls';
import { Card, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { apiFetch } from '@/services/backend';
import type { DocumentDraft } from '@/services/documents';
import { useApp } from '@/state/app-state';

export default function DocumentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp(), db = useSQLiteContext();
  const operations = [...new Set(app.visibleFarms.map((f) => f.operationId))].sort().join(',');
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      setError(null); setSource(null);
      const cached = await db.getFirstAsync<{ data: string }>("SELECT data FROM local_documents WHERE json_extract(data,'$.serverId')=? LIMIT 1", [id]);
      if (cached) {
        const draft = JSON.parse(cached.data) as DocumentDraft;
        if (!operations.split(',').includes(draft.operationId)) throw new Error('Sem acesso à operação deste documento.');
        if (active) setSource(`data:${draft.mime};base64,${draft.base64}`);
        return;
      }
      const infoResponse = await apiFetch(`/api/documents/${id}`), info = await infoResponse.json();
      if (!infoResponse.ok) throw new Error(info.error?.message ?? 'Não foi possível abrir o documento.');
      const response = await apiFetch(`/api/documents/${id}/content`);
      if (!response.ok) throw new Error('Imagem indisponível. Conecte o serviço local para abrir.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      if (active) setSource(`data:${info.mime};base64,${btoa(binary)}`);
    })().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o documento.'); });
    return () => { active = false; };
  }, [db, id, operations]);
  return <Screen><Section title="Comprovante original"><AppText>Compare a imagem com a despesa antes de aprovar.</AppText>{error ? <Note tone="danger">{error}</Note> : !source ? <Note>Carregando imagem…</Note> : <><Card><Image source={{ uri: source }} accessibilityLabel="Comprovante original anexado à despesa" resizeMode="contain" style={{ width: '100%', height: expanded ? 900 : 420 }} /></Card><Button title={expanded ? 'Reduzir imagem' : 'Ampliar imagem'} variant="secondary" onPress={() => setExpanded((v) => !v)} /></>}</Section></Screen>;
}
