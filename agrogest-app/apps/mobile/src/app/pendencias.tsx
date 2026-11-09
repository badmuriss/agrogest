import { Redirect } from 'expo-router';

/** Pendências: agora é o filtro Para você da Atividade. O endereço antigo continua valendo para links e avisos. */
export default function Redirecionar() {
  return <Redirect href={{ pathname: '/atividade', params: { filtro: 'voce' } }} />;
}
