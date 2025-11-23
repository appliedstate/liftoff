/**
 * Network ID mappings for all platforms
 * Source: strategis-api/lib/network-ids.js
 */
export const NETWORK_IDS: Record<string, string> = {
  taboola: '107',
  gemini: '108',
  outbrain: '109',
  facebookDigitalMoses: '110',
  tiktok: '111',
  facebook: '112',
  mediago: '113',
  googleads: '114',
  zemanta: '115',
  newsbreak: '116',
  smartnews: '117',
};

/**
 * Reverse mapping: networkId → platform name
 */
export const NETWORK_ID_TO_PLATFORM: Record<string, string> = {
  '107': 'taboola',
  '108': 'gemini',
  '109': 'outbrain',
  '110': 'facebookDigitalMoses',
  '111': 'tiktok',
  '112': 'facebook',
  '113': 'mediago',
  '114': 'googleads',
  '115': 'zemanta',
  '116': 'newsbreak',
  '117': 'smartnews',
};

/**
 * Get platform name from networkId
 */
export function getPlatformFromNetworkId(networkId: string | number | null | undefined): string | null {
  if (!networkId) return null;
  return NETWORK_ID_TO_PLATFORM[String(networkId)] || null;
}

