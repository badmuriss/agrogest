import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Input, InputField, InputSlot } from '@/components/gluestack/input';
import { AppHeader } from '@/components/header';
import { useMenuTabs } from '@/components/navigation';
import { AccessGrid, type AccessItem } from '@/components/ui/access-grid';
import { Note } from '@/components/ui/controls';
import { EmptyState, Group, ListRow, Screen, Section, TitledSection } from '@/components/ui/layout';
import {
  Activity,
  ChartPie,
  Fence,
  FolderCog,
  MapPinned,
  Search,
  Tractor,
  Users,
  Warehouse,
  X,
} from '@/components/ui/lucide';
import { FadeIn, haptics } from '@/components/ui/motion';
import { AppText, Avatar } from '@/components/ui/text';
import { plural } from '@/domain/format';
import type { Mode } from '@/domain/types';
import { SUPPORT_WHATSAPP } from '@/services/support';
import { firstName, useApp } from '@/state/app-state';
import { useSyncStatus } from '@/state/sync-status';
import { usePreferences } from '@/state/preferences';
import { useThemePreference } from '@/state/theme-preference';
import { useIsDark, usePalette } from '@/theme';

const MODE_LABEL: Record<Mode, string> = { essencial: 'Essencial', gerencial: 'Gerencial', analitico: 'Analítico' };
const THEME_LABEL = { system: 'tema automático', light: 'tema claro', dark: 'tema escuro' } as const;

/** Compara sem acento e sem caixa: "relatorio" acha "Relatórios". */
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Menu no formato do PicPay: a conta no topo, a busca e o "Acesso rápido" em blocos grandes para
 * o que não está no menu de baixo (Fazenda, pessoas, estoque, pastos, mapa e, para sócios,
 * relatórios e cadastros); por fim, preferências, sincronização e sair.
 */
export default function MaisScreen() {
  const app = useApp();
  const sync = useSyncStatus();
  const prefs = usePreferences();
  const p = usePalette();
  const isDark = useIsDark();
  const theme = useThemePreference();
  const { financeTab } = useMenuTabs();
  const [query, setQuery] = useState('');
  const account = app.account;
  const actingAsOther = account !== null && app.user.id !== account.id;
  const hasFarm = app.visibleFarms.length > 0;
  const mapped = app.visibleFarms.filter((f) => f.boundary).length;
  const lowStock = app.supplies.length > 0 && app.stock().some((s) => s.low);

  const shortcuts: AccessItem[] = [
    {
      key: 'fazenda',
      icon: Tractor,
      label: hasFarm ? 'Fazendas' : 'Criar fazenda',
      hint: hasFarm ? `${plural(app.visibleFarms.length, 'fazenda', 'fazendas')} · ${mapped === 0 ? 'sem mapa' : `${mapped} com mapa`}` : 'Comece por aqui',
      // Em destaque só quando ainda é o próximo passo (criar a primeira fazenda).
      primary: !hasFarm,
      onPress: () => router.push(hasFarm ? '/fazenda' : '/fazenda/nova'),
    },
    ...(hasFarm
      ? ([
          { key: 'pessoas', icon: Users, label: 'Pessoas', hint: 'Equipe e convites', onPress: () => router.push('/pessoas') },
          { key: 'estoque', icon: Warehouse, label: 'Estoque', hint: lowStock ? 'Há insumo acabando' : 'Insumos e saldo', onPress: () => router.push('/estoque') },
          { key: 'pastos', icon: Fence, label: 'Pastos', hint: 'Ocupação e descanso', onPress: () => router.navigate({ pathname: '/rebanho', params: { aba: 'pastos' } }) },
          { key: 'mapa', icon: MapPinned, label: 'Mapa', hint: 'Fazenda e pastos', onPress: () => router.navigate({ pathname: '/rebanho', params: { aba: 'mapa' } }) },
          // A Atividade está no menu de baixo de quem não vê o financeiro; para os sócios, fica aqui e no sino.
          ...(financeTab ? [{ key: 'atividade', icon: Activity, label: 'Atividade', hint: 'Quem fez o quê', onPress: () => router.navigate('/atividade') }] : []),
          ...(financeTab
            ? [
                { key: 'relatorios', icon: ChartPie, label: 'Relatórios', hint: 'Fluxo, orçamento, DRE', onPress: () => router.push('/financeiro/relatorios') },
                { key: 'cadastros', icon: FolderCog, label: 'Cadastros', hint: 'Fornecedores e categorias', onPress: () => router.push('/financeiro/cadastros') },
              ]
            : []),
        ] satisfies AccessItem[])
      : []),
  ];

  const settings = [
    {
      key: 'preferencias',
      icon: 'tune-variant' as const,
      title: 'Preferências',
      subtitle: `Modo ${MODE_LABEL[prefs.mode]} · ${THEME_LABEL[theme.preference]}${app.cloudMode ? '' : ' · ferramentas do protótipo'}`,
      onPress: () => router.push('/preferencias'),
    },
    {
      key: 'ajuda',
      icon: 'lifebuoy' as const,
      title: 'Ajuda e suporte',
      subtitle: SUPPORT_WHATSAPP ? 'Falar com a gente, dúvidas comuns e o primeiro acesso' : 'Dúvidas comuns e rever o primeiro acesso',
      onPress: () => router.push('/ajuda'),
    },
    ...(app.cloudMode
      ? [
          {
            key: 'sincronizacao',
            icon: 'cloud-sync-outline' as const,
            title: 'Sincronização',
            subtitle: sync.pendingCommands > 0 ? `${sync.pendingCommands} registros aguardando envio` : 'Tudo enviado · conferir conexão',
            onPress: () => router.push('/sincronizacao'),
          },
        ]
      : []),
  ];

  const term = normalize(query.trim());
  const match = (...texts: (string | undefined)[]) => !term || texts.some((t) => t && normalize(t).includes(term));
  const shownShortcuts = shortcuts.filter((s) => match(s.label, s.hint));
  const shownSettings = settings.filter((s) => match(s.title, s.subtitle));
  const nothing = shownShortcuts.length === 0 && shownSettings.length === 0 && !match('Sair');

  return (
    <Screen tab header={<AppHeader title="Mais" />}>
      <FadeIn index={0}>
        <Group>
          <ListRow
            leading={<Avatar name={app.user.name} size={48} />}
            title={
              <AppText variant="heading" numberOfLines={1}>
                {app.user.name}
              </AppText>
            }
            subtitle={actingAsOther ? 'Pessoa simulada' : (account?.email ?? 'Neste aparelho')}
            onPress={() => router.push('/preferencias')}
            accessibilityLabel={`${app.user.name}. Abrir preferências`}
          />
        </Group>
        {actingAsOther && account ? (
          <Note boxed tone="info" icon="account-switch-outline" title={`Vendo como ${firstName(app.user.name)}`}>
            {`Para testar aprovações. Volte para ${firstName(account.name)} em Preferências › Ferramentas do protótipo.`}
          </Note>
        ) : null}
      </FadeIn>

      <FadeIn index={1}>
        <Input className="rounded-full" style={{ backgroundColor: isDark ? p.fill : p.surface }}>
          <InputSlot>
            <Search size={20} color={p.textMuted} strokeWidth={2} />
          </InputSlot>
          <InputField
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar no menu"
            aria-label="Buscar no menu"
            returnKeyType="search"
            autoCorrect={false}
            selectionColor={p.accent}
            keyboardAppearance={isDark ? 'dark' : 'light'}
          />
          {query ? (
            <InputSlot
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              hitSlop={10}
              onPress={() => {
                haptics.tap();
                setQuery('');
              }}>
              <X size={18} color={p.textMuted} strokeWidth={2.2} />
            </InputSlot>
          ) : null}
        </Input>
      </FadeIn>

      {nothing ? (
        <EmptyState icon="magnify" title="Nada encontrado" message={`Nenhum item do menu com "${query.trim()}".`} />
      ) : null}

      {shownShortcuts.length > 0 ? (
        <FadeIn index={2}>
          <TitledSection title="Acesso rápido">
            <AccessGrid items={shownShortcuts} />
          </TitledSection>
        </FadeIn>
      ) : null}

      {shownSettings.length > 0 || match('Sair') ? (
        <FadeIn index={3}>
          <Section title="Conta e aplicativo">
            <Group>
              {shownSettings.map((s) => (
                <ListRow key={s.key} icon={s.icon} title={s.title} subtitle={s.subtitle} onPress={s.onPress} />
              ))}
              {match('Sair') ? <ListRow icon="logout" iconTone="danger" title="Sair" chevron={false} onPress={() => app.signOut()} /> : null}
            </Group>
          </Section>
          <AppText variant="caption" tone="muted" style={styles.center}>
            {app.cloudMode ? 'Dados locais com sincronização segura. Leitura de notas por IA ainda em preparação.' : 'Protótipo · tudo fica neste aparelho. Sincronização e IA são simuladas.'}
          </AppText>
        </FadeIn>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
