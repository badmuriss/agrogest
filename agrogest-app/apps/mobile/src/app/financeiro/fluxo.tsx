import { Redirect } from 'expo-router';

/** Fluxo de caixa: agora é a aba Fluxo dos Relatórios. O endereço antigo continua valendo para links e avisos. */
export default function Redirecionar() {
  return <Redirect href={{ pathname: '/financeiro/relatorios', params: { aba: 'fluxo' } }} />;
}
