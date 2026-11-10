import { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { ImageCapture } from '@/components/image-capture';
import type { CapturedImage } from '@/components/image-capture.types';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/state/app-state';
import { FarmPicker } from '@/components/pickers';
import { Button, Note } from '@/components/ui/controls';
import { BigMoneyField, DateField, Field, TextField } from '@/components/ui/form';
import { Card, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { analyzeDocument, captureDocument, documentDrafts, readDocumentDraft, saveDocumentDraft, type DocumentDraft } from '@/services/documents';

export default function ImportarDespesaScreen() {
  const app = useApp();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string; analisar?: string }>();
  const pending = useRef(new Map<string, Promise<DocumentDraft>>());
  const [farmId, setFarmId] = useState(app.defaultFarmId);
  const [draft, setDraft] = useState<DocumentDraft | null>(null);
  const [recent, setRecent] = useState<DocumentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(false);
  const [showText, setShowText] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [rows, selected] = await Promise.all([documentDrafts(db), params.id ? readDocumentDraft(db, params.id) : Promise.resolve(null)]);
        if (!active) return;
        setRecent(rows);
        if (!selected) return;
        setDraft(selected); setFarmId(selected.farmId);
        if (params.analisar === '1' && !selected.extraction) {
          setBusy(true);
          let work = pending.current.get(selected.id);
          if (!work) { work = analyzeDocument(db, selected); pending.current.set(selected.id, work); }
          const analyzed = await work;
          if (active) setDraft(analyzed);
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Não foi possível ler o comprovante.'); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [db, params.id, params.analisar]);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível analisar. Sua imagem continua salva.'); }
    finally { setBusy(false); }
  };
  const choose = (image: CapturedImage) => run(async () => {
    const farm = app.farm(farmId); if (!farm) throw new Error('Escolha a fazenda do comprovante.');
    const saved = await captureDocument(db, { ...image, farmId: farm.id, operationId: farm.operationId });
    setDraft(saved); setDetails(false); setShowText(false); setRecent(await documentDrafts(db));
    setDraft(await analyzeDocument(db, saved));
  });
  const update = (patch: Partial<NonNullable<DocumentDraft['reviewed']>>) => {
    if (!draft?.reviewed) return;
    const next = { ...draft, reviewed: { ...draft.reviewed, ...patch } };
    setDraft(next); void saveDocumentDraft(db, next).catch(() => setError('Não foi possível salvar a revisão no aparelho.'));
  };
  const linked = draft?.serverId ? app.visibleEntries.find((e) => e.kind === 'despesa' && e.payload.sourceDocumentId === draft.serverId) : undefined;
  const fields = draft?.reviewed;
  const missing = fields ? [!fields.amountCents && 'valor', !fields.description?.trim() && 'descrição', !fields.occurredAt && 'data'].filter(Boolean).join(', ') : '';
  const source = draft ? { uri: `data:${draft.mime};base64,${draft.base64}` } : undefined;

  return <Screen>
    {!draft ? <Section title="Adicionar comprovante">
      <AppText>Escolha a foto para preencher sua despesa.</AppText>
      <FarmPicker value={farmId} onChange={setFarmId} />
      <ImageCapture disabled={busy || !farmId} onImage={choose} onError={setError} />
    </Section> : <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Image source={source} accessibilityLabel="Imagem original do comprovante" resizeMode="contain" style={{ width: 72, height: 96 }} />
        <View style={{ flex: 1, gap: 4 }}><AppText variant="label">{busy ? 'Lendo comprovante…' : 'Comprovante salvo'}</AppText><AppText variant="caption" numberOfLines={1}>{draft.name}</AppText><AppText variant="caption">{app.farm(draft.farmId)?.name ?? 'Fazenda indisponível'}</AppText></View>
      </View>
      <ImageCapture title="Trocar foto" disabled={busy || !farmId} onImage={choose} onError={setError} />
    </Card>}
    {busy ? <Note>Aguarde a leitura. Sua imagem já está salva neste aparelho.</Note> : null}
    {error ? <Note tone="danger">{error} Você pode tentar novamente com a imagem salva.</Note> : null}
    {draft && !draft.extraction && !busy ? <Button title="Analisar imagem salva" onPress={() => void run(async () => setDraft(await analyzeDocument(db, draft)))} /> : null}
    {draft?.extraction && fields && !busy ? <>
      <Section title="Confira os dados">
        <AppText variant="caption">Compare com a foto e ajuste o que precisar.</AppText>
        {missing ? <Note tone="warning">Preencha os campos não identificados: {missing}.</Note> : null}
        <BigMoneyField accessibilityLabel="Valor extraído" cents={fields.amountCents ?? 0} onChange={(value) => update({ amountCents: value })} />
        <Field label="Descrição"><TextField accessibilityLabel="Descrição extraída" value={fields.description ?? ''} onChangeText={(value) => update({ description: value })} /></Field>
        <DateField label="Data do comprovante" value={fields.occurredAt ?? app.today} onChange={(value) => update({ occurredAt: value })} />
        <Button title={details ? 'Ocultar detalhes' : 'Ver imagem e detalhes'} variant="ghost" onPress={() => setDetails((value) => !value)} />
      </Section>
      {details ? <Section title="Detalhes do comprovante">
        <Image source={source} accessibilityLabel="Comprovante ampliado para conferência" resizeMode="contain" style={{ width: '100%', height: 360 }} />
        <Field label="Fornecedor"><TextField accessibilityLabel="Fornecedor extraído" value={fields.supplier ?? ''} placeholder="Preencha se estiver visível" onChangeText={(value) => update({ supplier: value })} /></Field>
        <Field label="Número do documento"><TextField accessibilityLabel="Número do documento" value={fields.document ?? ''} onChangeText={(value) => update({ document: value })} /></Field>
        {draft.extraction.text ? <><Button title={showText ? 'Ocultar texto lido' : 'Ver texto lido'} variant="ghost" onPress={() => setShowText((value) => !value)} />{showText ? <Card><AppText variant="caption" selectable>{draft.extraction.text}</AppText></Card> : null}</> : null}
        {!linked ? <><Button title="Refazer leitura" variant="secondary" disabled={busy} onPress={() => void run(async () => setDraft(await analyzeDocument(db, draft, { force: true, replaceReview: true })))} /><AppText variant="caption">A nova leitura substitui os campos desta revisão.</AppText></> : null}
      </Section> : null}
      {linked ? <><Note tone="warning">Este comprovante já tem uma despesa.</Note><Button title="Abrir despesa existente" onPress={() => router.push(`/lancamento/${linked.id}`)} /></> : <Button title="Confirmar e preparar despesa" disabled={busy || !fields.amountCents || !fields.description?.trim() || !fields.occurredAt} onPress={() => void run(async () => { await saveDocumentDraft(db, draft); router.push({ pathname: '/novo/despesa', params: { importacao: draft.id } }); })} />}
    </> : null}
    {!draft && recent.length ? <Section title="Comprovantes salvos">{recent.filter((d) => app.farm(d.farmId)).map((d) => <Button key={d.id} title={`${d.name} · ${d.extraction ? 'Revisar' : 'Leitura pendente'}`} variant="secondary" onPress={() => { setDraft(d); setFarmId(d.farmId); setError(null); setDetails(false); setShowText(false); }} />)}</Section> : null}
  </Screen>;
}
