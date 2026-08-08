// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://holmestrandmuseum.no',
  i18n: {
    defaultLocale: 'nb',
    locales: ['nb', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
