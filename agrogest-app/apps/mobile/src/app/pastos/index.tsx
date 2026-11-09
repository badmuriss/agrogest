import { Redirect, useLocalSearchParams } from 'expo-router';

/** Pastos: agora são a aba Pastos do Rebanho. O endereço antigo continua valendo para links e avisos. */
export default function Redirecionar() {
  const { fazenda } = useLocalSearchParams<{ fazenda?: string }>();
  return <Redirect href={{ pathname: '/rebanho', params: fazenda ? { aba: 'pastos', fazenda } : { aba: 'pastos' } }} />;
}
