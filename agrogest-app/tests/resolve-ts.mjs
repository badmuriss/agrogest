// Preloaded by `npm run test:database`. Node's TS stripping runs the app sources as-is,
// but does not resolve Metro's `@/` alias nor extensionless relative imports.
import { registerHooks } from 'node:module';

const src = new URL('../apps/mobile/src/', import.meta.url);

registerHooks({
  load(url, context, next) {
    // Only the app's TS sources are ESM. Metro/PostCSS/ESLint configs stay CommonJS.
    if (url.startsWith(src.href) && url.endsWith('.ts')) {
      return next(url, { ...context, format: 'module-typescript' });
    }
    return next(url, context);
  },
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) return next(new URL(`${specifier.slice(2)}.ts`, src).href, context);
    const inApp = context.parentURL?.startsWith(src.href);
    if (inApp && (specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});
