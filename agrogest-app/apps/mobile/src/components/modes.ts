import type { IconName } from '@/components/ui/text';
import type { Mode } from '@/domain/types';

/**
 * Os três modos de experiência. `task` é como o primeiro acesso pergunta (pelo que a pessoa vai
 * fazer, não pelo cargo); `label` e `description` aparecem em Preferências; `preview` resume o
 * Início de cada modo (components/home/*-home.tsx).
 */
export const MODES: {
  value: Mode;
  label: string;
  description: string;
  icon: IconName;
  task: string;
  taskHint: string;
  preview: string[];
}[] = [
  {
    value: 'essencial',
    label: 'Essencial',
    description: 'Para quem está no campo: rebanho de hoje, mapa e lotes para pesar. Sem valores em reais.',
    icon: 'cow',
    task: 'Registrar o dia a dia',
    taskHint: 'Pesagem, mudança de pasto e mortes, direto do campo.',
    preview: ['Cabeças de hoje e o botão de pesar', 'Atalhos do dia a dia', 'Mapa da fazenda e lotes para pesar'],
  },
  {
    value: 'gerencial',
    label: 'Gerencial',
    description: 'Para quem acompanha o negócio: resultado, o mês, custos por mês e aprovações.',
    icon: 'chart-box-outline',
    task: 'Acompanhar custos e resultado',
    taskHint: 'Quanto entra, quanto sai e quanto cada lote dá.',
    preview: ['Resultado e o mês em reais', 'Contas a pagar e a receber', 'Custos por mês e o que aprovar'],
  },
  {
    value: 'analitico',
    label: 'Analítico',
    description: 'Para comparar: indicadores do rebanho e do dinheiro e lotes lado a lado.',
    icon: 'chart-bar',
    task: 'Analisar e comparar',
    taskHint: 'Indicadores e lotes lado a lado, com detalhe.',
    preview: ['Indicadores do rebanho e do dinheiro', 'Lotes comparados lado a lado', 'Rateios recentes'],
  },
];
