import { AppHeader } from '@/components/header';
import { RegisterActions } from '@/components/register-actions';
import { Screen } from '@/components/ui/layout';

/** Endereço direto do "+" (links e web); no menu, o "+" abre a mesma lista numa folha de baixo. */
export default function RegistrarScreen() {
  return (
    <Screen tab header={<AppHeader title="Registrar" />}>
      <RegisterActions />
    </Screen>
  );
}
