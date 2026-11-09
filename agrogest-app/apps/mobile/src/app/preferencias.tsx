import { router } from 'expo-router';
import { useState } from 'react';

import { MODES } from '@/components/modes';
import { Chip, ChipWrap, Segmented, SwitchRow } from '@/components/ui/controls';
import { Card, Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { AppText } from '@/components/ui/text';
import { ALERT_DAY_OPTIONS } from '@/domain/finance';
import { useApp } from '@/state/app-state';
import { usePreferences } from '@/state/preferences';
import { useThemePreference } from '@/state/theme-preference';
import type { ThemePreference } from '@/theme';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

/** Como o app se apresenta para esta pessoa, mais as ferramentas do protótipo e os dados de exemplo. */
export default function PreferenciasScreen() {
  const app = useApp();
  const prefs = usePreferences();
  const theme = useThemePreference();
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <Screen>
      <Section title="Como prefere usar o AgroGest">
        <Group>
          {MODES.map((mode) => (
            <ListRow
              key={mode.value}
              icon={mode.icon}
              iconTone={prefs.mode === mode.value ? 'accent' : 'neutral'}
              title={mode.label}
              subtitle={mode.description}
              selected={prefs.mode === mode.value}
              onPress={() => prefs.setMode(mode.value)}
            />
          ))}
        </Group>
        <AppText variant="caption" tone="muted">
          Muda só o que aparece no Início. O que cada pessoa pode ver e os números são os mesmos.
        </AppText>
      </Section>

      <Section title="Aparência">
        <Segmented accessibilityLabel="Tema" options={THEMES} value={theme.preference} onChange={theme.setPreference} />
        <AppText variant="caption" tone="muted">
          Automático segue o tema do celular.
        </AppText>
      </Section>

      {app.scopedFarms.some((f) => app.canSeeFinance(f.operationId)) ? (
        <Section title="Avisos de vencimento">
          <ChipWrap>
            {ALERT_DAY_OPTIONS.map((d) => {
              const days = app.alertOptions.days ?? [];
              const selected = days.includes(d);
              return (
                <Chip
                  key={d}
                  label={d === 0 ? 'No dia' : d === 1 ? '1 dia antes' : `${d} dias antes`}
                  selected={selected}
                  onPress={() => void app.setAlertPreferences(selected ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => b - a), app.alertOptions.overdueReminder ?? true)}
                />
              );
            })}
          </ChipWrap>
          <Card>
            <SwitchRow
              label="Lembrar das contas vencidas"
              description="Um aviso por dia, por uma semana, enquanto houver conta a pagar vencida."
              value={app.alertOptions.overdueReminder ?? true}
              onValueChange={(value) => void app.setAlertPreferences(app.alertOptions.days ?? [], value)}
            />
          </Card>
          <AppText variant="caption" tone="muted">
            Os avisos ficam agendados neste aparelho e funcionam sem internet, às 8h. Valem para as parcelas, as faturas do cartão e as despesas recorrentes de todas as operações em que você é sócio.
          </AppText>
        </Section>
      ) : null}

      <Section title="Acessibilidade">
        <Card>
          <SwitchRow
            label="Reduzir animações"
            description="Também respeita a configuração do celular."
            value={prefs.reduceMotion}
            onValueChange={(value) => prefs.setReduceMotion(value)}
          />
        </Card>
      </Section>

      <Section title={app.cloudMode ? 'Aparência e dados locais' : 'Protótipo'}>
        <Group>
          <ListRow
            icon="flask-outline"
            title={app.cloudMode ? 'Aparência e dados locais' : 'Ferramentas do protótipo'}
            subtitle={app.cloudMode ? 'Marca, ilustrações e limpeza do aparelho' : 'Internet, ver como outra pessoa, marca'}
            onPress={() => router.push('/prototipo')}
          />
          {!app.cloudMode ? (
            app.hasSampleData ? (
              <ListRow
                icon={confirmRemove ? 'alert-outline' : 'database-remove-outline'}
                iconTone={confirmRemove ? 'danger' : 'neutral'}
                title={confirmRemove ? 'Toque de novo para remover' : 'Remover dados de exemplo'}
                subtitle="Suas fazendas e registros continuam."
                chevron={false}
                onPress={async () => {
                  if (!confirmRemove) {
                    setConfirmRemove(true);
                    return;
                  }
                  setConfirmRemove(false);
                  await app.removeSampleData();
                }}
              />
            ) : (
              <ListRow
                icon="database-import-outline"
                title="Carregar dados de exemplo"
                subtitle="Duas fazendas fictícias com lotes, despesas e aprovações, ao lado dos seus dados."
                chevron={false}
                onPress={() => app.loadSampleData()}
              />
            )
          ) : null}
        </Group>
      </Section>
    </Screen>
  );
}
