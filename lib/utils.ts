import { cache } from 'react';
import { APP_CONFIG_DEFAULTS } from '@/app-config';
import type { AppConfig } from '@/app-config';

/**
 * Get the app configuration
 * @returns The app configuration
 */
export const getAppConfig = cache(async (): Promise<AppConfig> => {
  return APP_CONFIG_DEFAULTS;
});

/**
 * Get styles for the app
 * @param appConfig - The app configuration
 * @returns A string of styles
 */
export function getStyles(appConfig: AppConfig) {
  const { accent, accentDark } = appConfig;

  return [
    accent
      ? `:root { --primary: ${accent}; --primary-hover: color-mix(in srgb, ${accent} 80%, #000); }`
      : '',
    accentDark
      ? `.dark { --primary: ${accentDark}; --primary-hover: color-mix(in srgb, ${accentDark} 80%, #000); }`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
