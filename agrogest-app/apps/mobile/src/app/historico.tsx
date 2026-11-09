import { Redirect } from 'expo-router';

/** Histórico: agora é o filtro Registros da Atividade. O endereço antigo continua valendo para links e avisos. */
export default function Redirecionar() {
  return <Redirect href={{ pathname: '/atividade', params: { filtro: 'registros' } }} />;
}
