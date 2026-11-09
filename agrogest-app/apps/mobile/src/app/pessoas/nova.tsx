import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppLottie } from '@/components/animation';
import { IllustrationHeader } from '@/components/illustration-header';
import { goBack } from '@/components/navigation';
import { FarmPicker } from '@/components/pickers';
import { Button, Note } from '@/components/ui/controls';
import { Field, TextField } from '@/components/ui/form';
import { Group, ListRow, Screen, Section } from '@/components/ui/layout';
import { FadeIn } from '@/components/ui/motion';
import { AppText } from '@/components/ui/text';
import type { Invite, MemberRole } from '@/domain/types';
import { useApp } from '@/state/app-state';
import { space } from '@/theme';

const ROLES: { value: MemberRole; title: string; description: string }[] = [
  { value: 'socio', title: 'Sócio', description: 'Vê custos e resultados e aprova despesas' },
  { value: 'funcionario', title: 'Funcionário', description: 'Registra no campo, sem acesso a valores' },
];

export default function ConvidarPessoaScreen() {
  const app = useApp();
  const [contact, setContact] = useState('');
  const [role, setRole] = useState<MemberRole | null>(null);
  const [farmId, setFarmId] = useState(app.defaultFarmId);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Invite | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const farm = app.farm(farmId);
  const errors = {
    contact: /^\S+@\S+\.\S+$/.test(contact.trim()) ? null : 'Informe o e-mail da conta convidada.',
    role: role ? null : 'Escolha o papel.',
  };

  if (sent) {
    return (
      <Screen footer={<Button title="Concluir" size="lg" onPress={goBack} />}>
        <View style={styles.done}>
          <AppLottie name="success" size={140} />
          <AppText variant="title" style={styles.center} accessibilityRole="header">
            Convite criado
          </AppText>
          <AppText tone="muted" style={styles.center}>
            {app.cloudMode ? `A pessoa verá o convite em Pessoas ao entrar com ${sent.contact}. O nome vem da conta dela, e o acesso começa quando aceitar.` : `Convite de demonstração para ${sent.contact}. O nome será o da conta quando o login estiver ativo.`}
          </AppText>
        </View>
      </Screen>
    );
  }

  const save = async () => {
    setTouched(true);
    if (errors.contact || !role || !farm) return;
    setBusy(true);
    setFormError(null);
    try {
      const invite = await app.invitePerson({
        operationId: farm.operationId,
        contact: contact.trim(),
        role,
        sharePct: null,
      });
      setSent(invite);
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Não foi possível criar o convite.'); }
    finally { setBusy(false); }
  };

  return (
    <Screen footer={<Button title="Criar convite" size="lg" disabled={busy} onPress={save} />}>
      <FadeIn>
        {formError ? <Note tone="danger">{formError}</Note> : null}
        <IllustrationHeader name="team" title="A fazenda se faz em equipe" description="Convide quem trabalha com você e escolha o papel de cada pessoa." />
        <Field label="E-mail da pessoa" hint="Use o e-mail da conta. O nome é preenchido automaticamente; quem ainda não tem conta aparece pelo e-mail até se cadastrar." error={touched ? errors.contact : null}>
          <TextField
            value={contact}
            onChangeText={setContact}
            invalid={touched && !!errors.contact}
            placeholder="nome@exemplo.com"
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>
        <Section title="Papel">
          <Group>
            {ROLES.map((r) => (
              <ListRow
                key={r.value}
                title={r.title}
                subtitle={r.description}
                selected={role === r.value}
                onPress={() => setRole(r.value)}
              />
            ))}
          </Group>
          {touched && errors.role ? (
            <AppText variant="caption" tone="danger">
              {errors.role}
            </AppText>
          ) : null}
        </Section>
        <FarmPicker value={farmId} onChange={setFarmId} />
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: { alignItems: 'center', gap: space.md, paddingTop: space.xxl, paddingHorizontal: space.md },
  center: { textAlign: 'center' },
});
