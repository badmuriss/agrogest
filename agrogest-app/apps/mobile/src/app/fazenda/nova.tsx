import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { IllustrationHeader } from '@/components/illustration-header';
import { Button, Note } from '@/components/ui/controls';
import { Field, MoneyField, TextField } from '@/components/ui/form';
import { Group, ListRow, Screen } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { formatHectares, ringAreaHa } from '@/domain/geo';
import { useApp } from '@/state/app-state';

/** Criar (ou editar, com ?id=) uma fazenda. Só o nome é obrigatório. */
export default function FazendaScreen() {
  const app = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const existing = params.id ? app.farm(params.id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [rentCents, setRentCents] = useState(existing?.pastureRentCents ?? 0);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const nameError = name.trim().length < 2 ? 'Dê um nome para a fazenda.' : null;

  if (app.cloudMode && existing && !app.canSeeFinance(existing.operationId)) return <Screen><Note>Somente um sócio desta operação pode alterar o cadastro da fazenda.</Note></Screen>;

  const save = async () => {
    setTouched(true);
    if (nameError) return;
    const input = { name: name.trim(), city: city.trim() || null, pastureRentCents: rentCents };
    setBusy(true);
    if (existing) {
      await app.updateFarm(existing.id, input);
      router.back();
      return;
    }
    // Fecha antes: a fazenda nova abre sob a tela de transição.
    router.back();
    await app.createFarm(input);
  };

  return (
    <Screen footer={<Button title={existing ? 'Salvar' : 'Criar fazenda'} size="lg" disabled={busy} onPress={save} />}>
      <FadeIn>
        <IllustrationHeader
          name="farm"
          title={existing ? 'A sua fazenda' : 'Tudo começa na fazenda'}
          description="Só o nome é obrigatório. O resto dá para completar depois."
        />
        <Field label="Nome da fazenda" error={touched ? nameError : null}>
          <TextField
            value={name}
            onChangeText={setName}
            onBlur={() => name && setTouched(true)}
            invalid={touched && !!nameError}
            placeholder="Ex.: Fazenda Santa Rita"
            autoCapitalize="words"
            autoFocus={!existing}
            returnKeyType="next"
          />
        </Field>
        <Field label="Município (opcional)">
          <TextField value={city} onChangeText={setCity} placeholder="Ex.: Uberaba, MG" autoCapitalize="words" />
        </Field>
        <Field
          label="Aluguel de pastagem (opcional)"
          hint="Por cabeça ao mês, como custo de oportunidade. Não sai do caixa: entra só no resultado ajustado.">
          <MoneyField accessibilityLabel="Aluguel de pastagem por cabeça ao mês" cents={rentCents} onChange={setRentCents} />
        </Field>
        {existing ? (
          <Group>
            <ListRow
              icon="map-outline"
              iconTone="accent"
              title="Mapa da fazenda"
              subtitle={existing.boundary ? `${formatHectares(ringAreaHa(existing.boundary))} desenhados no satélite` : 'Desenhe a área no satélite'}
              onPress={() => router.push({ pathname: '/fazenda/mapa/[id]', params: { id: existing.id } })}
            />
          </Group>
        ) : null}
      </FadeIn>
    </Screen>
  );
}
