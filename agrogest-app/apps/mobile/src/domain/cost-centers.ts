import type { CostCenter } from './types';

export function assertCostCenter(centers: CostCenter[], operationId: string, id?: string | null): void {
  if (!id) return;
  const center = centers.find((c) => c.id === id && c.operationId === operationId);
  if (!center || center.isGroup) throw new Error('Escolha um centro de custo desta operação.');
  if (!center.active || (center.parentId && !centers.some((c) => c.id === center.parentId && c.active && c.operationId === operationId))) {
    throw new Error('Centro de custo ou agrupamento inativo. Escolha outro centro.');
  }
}

export function validateCostCenter(center: CostCenter, centers: CostCenter[], previous?: CostCenter): void {
  if (!center.name || center.name.length > 80) throw new Error('Informe um nome com até 80 caracteres.');
  if (previous && (previous.parentId !== center.parentId || previous.isGroup !== center.isGroup)) {
    throw new Error('O agrupamento é fixo para preservar o histórico. Crie outro centro.');
  }
  if (center.isGroup && center.parentId) throw new Error('Agrupamentos não podem ter um pai.');
  if (center.parentId && !centers.some((c) => c.id === center.parentId && c.operationId === center.operationId && c.isGroup && c.active)) {
    // An existing inactive group may still contain its existing centers.
    if (!previous || previous.parentId !== center.parentId) throw new Error('Escolha um agrupamento ativo desta operação.');
  }
  if (centers.some((c) => c.id !== center.id && c.operationId === center.operationId && c.name.toLocaleLowerCase('pt-BR') === center.name.toLocaleLowerCase('pt-BR'))) {
    throw new Error('Já existe um centro ou agrupamento com esse nome.');
  }
}
