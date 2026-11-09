import { router, useLocalSearchParams } from 'expo-router';

import { LotForm } from '@/components/lot-form';
import { Note } from '@/components/ui/controls';
import { EmptyState, Screen } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { useApp } from '@/state/app-state';

/** Correção dos dados de raiz de um lote já cadastrado. Só sócios editam. */
export default function EditarLoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const lot = app.lotSummary(id)?.lot;

  if (!lot) {
    return (
      <Screen>
        <EmptyState icon="cow-off" title="Lote não encontrado" />
      </Screen>
    );
  }
  if (!app.canSeeFinance(lot.operationId)) {
    return (
      <Screen>
        <EmptyState icon="lock-outline" title="Edição por um sócio" message="Peça a um sócio desta operação para corrigir os dados do lote." />
      </Screen>
    );
  }

  if (lot.transfer?.incoming || lot.transfer?.outgoing) {
    return <Screen><Note icon="truck-outline" title="Entrada por transferência preservada">
      Os dados de entrada e o histórico permanecem vinculados à transferência. Registre novas pesagens e despesas no lote de destino.
    </Note></Screen>;
  }
  const farmName = app.farm(lot.farmId)?.name;
  return (
    <LotForm
      key={lot.id}
      farmId={lot.farmId}
      initial={lot}
      finance
      limits={app.lotEditLimits(lot.id)}
      submitLabel="Salvar alterações"
      top={
        <Note icon="barn" title={farmName}>
          Para mudar os animais de pasto, use Mover de pasto; para outra fazenda, Transferir. Esta edição corrige somente os dados da entrada.
        </Note>
      }
      onSubmit={async (result) => {
        await app.updateLot(lot.id, result);
        haptics.success();
        router.back();
      }}
    />
  );
}
