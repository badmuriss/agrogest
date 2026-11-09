import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { ImageCapture } from '@/components/image-capture';
import type { CapturedImage } from '@/components/image-capture.types';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/state/app-state';
import { FarmPicker } from '@/components/pickers';
import { Button, Note } from '@/components/ui/controls';
import { BigMoneyField, DateField, Field, TextField } from '@/components/ui/form';
import { Card, KV, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { analyzeDocument, captureDocument, documentDrafts, readDocumentDraft, saveDocumentDraft, type DocumentDraft } from '@/services/documents';

export default function ImportarDespesaScreen() {
  const app = useApp();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const [farmId, setFarmId] = useState(app.defaultFarmId);
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [recent, setRecent] = useState<DocumentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; void documentDrafts(db).then((rows) => { if (active) setRecent(rows); }); if (params.id) void readDocumentDraft(db, params.id).then((d) => { if (active) { setDraft(d); if (d) setFarmId(d.farmId); } }); return () => { active = false; }; }, [db, params.id]);
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível analisar. A imagem salva pode ser reaberta.'); }
    finally { setBusy(false); }
  };
  const choose = (image: CapturedImage) => run(async () => {
    const farm = app.farm(farmId); if (!farm) throw new Error('Escolha a fazenda do comprovante.');
    const saved = await captureDocument(db, { ...image, farmId: farm.id, operationId: farm.operationId });
    setDraft(saved); setRecent(await documentDrafts(db));
    const analyzed = await analyzeDocument(db, saved); setDraft(analyzed);
  });
  const update = (patch: Partial<NonNullable<DocumentDraft['reviewed']>>) => {
    if (!draft?.reviewed) return;
    const next = { ...draft, reviewed: { ...draft.reviewed, ...patch } };
    setDraft(next); void saveDocumentDraft(db, next).catch(() => setError('Não foi possível salvar a revisão no aparelho.'));
  };
  const linked = draft?.serverId ? app.visibleEntries.find((e) => e.kind === 'despesa' && e.payload.sourceDocumentId === draft.serverId) : undefined;
  const fields = draft?.reviewed;
  return <Screen>
    <Section title="Importar comprovante">
      <AppText>Fotografe ou escolha a imagem. Revise o que foi lido antes de registrar a despesa.</AppText>
      {!draft ? <FarmPicker value={farmId} onChange={setFarmId} /> : null}
      <ImageCapture disabled={busy || !farmId} onImage={choose} onError={setError} />
      {busy ? <Note>Lendo a imagem…</Note> : null}
    </Section>
    {error ? <Note tone="danger">{error} Sua captura fica disponível abaixo para tentar novamente.</Note> : null}
    {draft ? <>
      <Card><Image source={{ uri: `data:${draft.mime};base64,${draft.base64}` }} accessibilityLabel="Imagem original do comprovante" resizeMode="contain" style={{ width: '100%', height: 260 }} /><KV label="Arquivo" value={draft.name} /><KV label="Fazenda" value={app.farm(draft.farmId)?.name ?? 'Indisponível'} /></Card>
      {!draft.extraction ? <><Note>A imagem foi salva neste aparelho. Conecte o serviço local para extrair os campos.</Note><Button title={busy ? 'Analisando…' : 'Analisar imagem salva'} disabled={busy} onPress={() => void run(async () => setDraft(await analyzeDocument(db, draft)))} /></> : null}
      {draft.extraction && fields ? <>
        <Section title="Revise os campos">
          <Note>{`Leitura real: ${draft.extraction.provider === 'local' ? 'OCR local em português' : draft.extraction.provider}. Campos ausentes devem ser preenchidos. A leitura não aprova nem paga a despesa.`}</Note>
          {draft.extraction.warnings.map((w, i) => <AppText key={i} variant="caption">{w}</AppText>)}
          <BigMoneyField accessibilityLabel="Valor extraído" cents={fields.amountCents ?? 0} onChange={(value) => update({ amountCents: value })} />
          <Field label="Descrição"><TextField accessibilityLabel="Descrição extraída" value={fields.description ?? ''} onChangeText={(value) => update({ description: value })} /></Field>
          <Field label="Fornecedor"><TextField accessibilityLabel="Fornecedor extraído" value={fields.supplier ?? ''} onChangeText={(value) => update({ supplier: value })} /></Field>
          <DateField label="Data do comprovante" value={fields.occurredAt ?? app.today} onChange={(value) => update({ occurredAt: value })} />
          {!fields.occurredAt ? <Note tone="warning">A data não foi identificada. Confirme a data antes de continuar.</Note> : null}
          <Field label="Número do documento"><TextField accessibilityLabel="Número do documento" value={fields.document ?? ''} onChangeText={(value) => update({ document: value })} /></Field>
          <Card><AppText variant="label">Texto reconhecido</AppText><AppText variant="caption" selectable>{draft.extraction.text || 'Este provedor retornou apenas campos estruturados.'}</AppText></Card>
        </Section>
        {linked ? <><Note tone="warning">Este comprovante já foi utilizado. Abra a despesa existente para evitar duplicação.</Note><Button title="Abrir despesa existente" onPress={() => router.push(`/lancamento/${linked.id}`)} /></> : <Button title="Confirmar revisão e preparar despesa" disabled={busy || !fields.amountCents || !fields.description?.trim() || !fields.occurredAt} onPress={() => void run(async () => { await saveDocumentDraft(db, draft); router.push({ pathname: '/novo/despesa', params: { importacao: draft.id } }); })} />}
      </> : null}
    </> : null}
    {recent.length > 0 ? <Section title="Capturas salvas neste aparelho">{recent.filter((d) => d.id !== draft?.id && app.farm(d.farmId)).map((d) => <View key={d.id}><Button title={`${d.name} · ${d.extraction ? 'Reabrir revisão' : 'Leitura pendente'}`} variant="secondary" onPress={() => { setDraft(d); setFarmId(d.farmId); setError(null); }} /></View>)}</Section> : null}
  </Screen>;
}
