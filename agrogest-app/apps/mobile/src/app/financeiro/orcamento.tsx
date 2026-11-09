import { Redirect } from 'expo-router';

/** Orçamento: agora é a aba Orçamento dos Relatórios. O endereço antigo continua valendo para links e avisos. */
export default function Redirecionar() {
  return <Redirect href={{ pathname: '/financeiro/relatorios', params: { aba: 'orcamento' } }} />;
}
