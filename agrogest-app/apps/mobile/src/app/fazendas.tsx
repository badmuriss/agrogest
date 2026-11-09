import { Redirect } from 'expo-router';

/** Fazendas: agora ficam no hub Fazenda, em Mais. O endereço antigo continua valendo para links e avisos. */
export default function Redirecionar() {
  return <Redirect href={'/fazenda'} />;
}
