import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, ButtonText } from '@/components/gluestack/button';
import { IllustrationHeader } from '@/components/illustration-header';
import { LotForm } from '@/components/lot-form';
import { FarmPicker } from '@/components/pickers';
import { EmptyState, Screen } from '@/components/ui/layout';
import { haptics } from '@/components/ui/motion';
import { Icon } from '@/components/ui/text';
import { useApp } from '@/state/app-state';
import { usePalette } from '@/theme';

/** Entrada de animais: cria o lote de origem que guarda cabeças, peso e custo de entrada. */
export default function NovoLoteScreen() {
  const app = useApp();
  const p = usePalette();
  const params = useLocalSearchParams<{ fazenda?: string }>();
  const [farmId, setFarmId] = useState(params.fazenda ?? app.defaultFarmId);
  // Valores iniciais fixados na montagem: o código sugerido não muda enquanto se digita.
  const [initial] = useState(() => ({
    code: app.nextLotCode(),
    managementGroup: '',
    pastureId: null,
    supplier: '',
    category: '',
    purchasedAt: app.today,
    headsPurchased: 0,
    entryWeightKg: 0,
    purchaseCents: 0,
    commissionCents: 0,
    freightCents: 0,
    gtaNumbers: [],
    invoiceNumbers: [],
  }));

  // Fixado na montagem: o texto não troca quando o lote acaba de ser criado.
  const [firstLot] = useState(() => !app.visibleFarms.some((f) => app.farmLotSummaries(f.id).length > 0));

  const farm = app.farm(farmId);
  if (!farm) {
    return (
      <Screen>
        <EmptyState icon="barn" illustration="farm" title="Crie uma fazenda primeiro" message="O lote fica dentro de uma fazenda.">
          <Button onPress={() => router.replace('/fazenda/nova')}>
            <Icon name="plus" size={20} color={p.onAccent} />
            <ButtonText>Criar fazenda</ButtonText>
          </Button>
        </EmptyState>
      </Screen>
    );
  }

  const finance = app.canSeeFinance(farm.operationId);
  if (app.cloudMode && !finance) return <Screen><FarmPicker value={farmId} onChange={setFarmId} /><EmptyState icon="lock-outline" title="Cadastro por um sócio" message="Peça a um sócio desta operação para cadastrar o lote e os custos de entrada." /></Screen>;

  return (
    <LotForm
      farmId={farm.id}
      initial={initial}
      finance={finance}
      submitLabel="Cadastrar lote"
      top={
        <>
          <IllustrationHeader
            name="herd"
            title="Seu rebanho começa aqui"
            description={
              firstLot
                ? 'Reúna os animais que entraram juntos. Animais e identificação são obrigatórios; documentos e custo podem ficar para depois.'
                : 'Reúna os animais que entraram juntos para acompanhar peso e custos.'
            }
          />
          <FarmPicker value={farmId} onChange={setFarmId} />
        </>
      }
      onSubmit={async (result) => {
        const lot = await app.createLot({ ...result, farmId: farm.id });
        haptics.success();
        // Com valor de compra, o próximo passo é dizer como ela foi paga (vira conta a pagar).
        if (finance && lot.purchaseCents + lot.commissionCents + lot.freightCents > 0) {
          router.replace({ pathname: '/lote/pagamento/[id]', params: { id: lot.id, novo: '1' } });
        } else {
          router.replace({ pathname: '/lote/[id]', params: { id: lot.id } });
        }
      }}
    />
  );
}
