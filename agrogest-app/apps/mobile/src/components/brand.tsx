import { Image } from 'expo-image';
import { View } from 'react-native';

import dimensions from '@/assets/branding/v2/dimensions.json';
import { useBrandPreference } from '@/state/brand-preference';
import { useIsDark } from '@/theme';

const V2_LOGO = {
  light: require('@/assets/branding/v2/logo-light-v2.png'),
  dark: require('@/assets/branding/v2/logo-dark-v2.png'),
};
const V2_MARK = {
  light: require('@/assets/branding/v2/mark-light-v2.png'),
  dark: require('@/assets/branding/v2/mark-dark-v2.png'),
};
const V2_WORDMARK = {
  light: require('@/assets/branding/v2/wordmark-light-v2.png'),
  dark: require('@/assets/branding/v2/wordmark-dark-v2.png'),
};

const BRANDS = {
  v1: {
    logo: { light: require('@/assets/branding/logo-light.png'), dark: require('@/assets/branding/logo-dark.png') },
    mark: { light: require('@/assets/branding/mark-light.png'), dark: require('@/assets/branding/mark-dark.png') },
    wordmark: { light: require('@/assets/branding/wordmark-light.png'), dark: require('@/assets/branding/wordmark-dark.png') },
    icon: require('@/assets/images/icon.png'),
    logoRatio: 872 / 270,
    markRatio: 337 / 270,
    wordmarkRatio: 599 / 92,
  },
  v2: {
    logo: V2_LOGO,
    mark: V2_MARK,
    wordmark: V2_WORDMARK,
    icon: require('@/assets/images/v2/icon-v2.png'),
    logoRatio: dimensions.logo.ratio,
    markRatio: dimensions.mark.ratio,
    wordmarkRatio: dimensions.wordmark.ratio,
  },
};

export function useBrandAssets() {
  const { version } = useBrandPreference();
  const theme = useIsDark() ? 'dark' : 'light';
  const assets = BRANDS[version];
  return { ...assets, logo: assets.logo[theme], mark: assets.mark[theme], wordmark: assets.wordmark[theme] };
}

export function Logo({ height = 28 }: { height?: number }) {
  const brand = useBrandAssets();
  return (
    <Image
      source={brand.logo}
      style={{ height, width: height * brand.logoRatio }}
      contentFit="contain"
      accessibilityLabel="AgroGest"
    />
  );
}

export function LogoMark({ width }: { width: number }) {
  const brand = useBrandAssets();
  return <Image source={brand.mark} style={{ width, height: width / brand.markRatio }} contentFit="contain" accessibilityLabel="Símbolo AgroGest" />;
}

export function Wordmark({ width }: { width: number }) {
  const brand = useBrandAssets();
  return (
    <Image
      source={brand.wordmark}
      style={{ width, height: width / brand.wordmarkRatio }}
      contentFit="contain"
      accessibilityLabel="AgroGest"
    />
  );
}

/** Prévia da escolha de marca, acompanhando o tema claro/escuro selecionado. */
export function BrandPreview() {
  const brand = useBrandAssets();
  return (
    <View style={{ alignItems: 'center', gap: 24 }}>
      <Logo height={52} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
        <LogoMark width={64} />
        <Wordmark width={140} />
        <Image source={brand.icon} style={{ width: 56, height: 56, borderRadius: 12 }} accessibilityLabel="Prévia do ícone AgroGest" />
      </View>
    </View>
  );
}
