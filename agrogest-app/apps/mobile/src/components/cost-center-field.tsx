import { router } from 'expo-router';

import { FormField } from '@/components/fields';
import { Button, Chip, ChipWrap } from '@/components/ui/controls';
import { useApp } from '@/state/app-state';

export function CostCenterField({ operationId, value, onChange }: { operationId: string; value: string | null; onChange: (id: string | null) => void }) {
  const app = useApp();
  if (!app.canSeeFinance(operationId)) return null;
  const centers = app.costCenters.filter((c) => c.operationId === operationId && !c.isGroup &&
    ((c.active && (!c.parentId || app.costCenters.some((g) => g.id === c.parentId && g.active))) || c.id === value));
  return (
    <FormField label="Centro de custo / finalidade" hint="Onde o recurso foi aplicado. Independente da categoria e do rateio por lote.">
      <ChipWrap>
        <Chip label="Sem centro de custo" selected={!value} onPress={() => onChange(null)} />
        {centers.map((c) => <Chip key={c.id} label={`${c.name}${c.active ? '' : ' (inativo)'}`} selected={value === c.id} onPress={() => onChange(c.id)} />)}
      </ChipWrap>
      <Button title="Gerenciar centros" variant="ghost" onPress={() => router.push('/financeiro/centros')} />
    </FormField>
  );
}
