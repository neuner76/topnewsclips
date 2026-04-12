/**
 * Standardized descriptors for Mainstream Pulse outlets.
 * Ensures consistent labeling across all digest views.
 */

export const OUTLET_DESCRIPTORS: Record<string, string> = {
  // Wire services
  'AP': 'wire service',
  'Reuters': 'global wire',

  // Public media
  'NPR': 'public media',
  'PBS': 'public media',
  'BBC': 'public media',
  'ABC Australia': 'public media',
  'DW': 'public media',
  'France 24': 'public media',

  // Commercial newsrooms
  'CNN': 'commercial newsroom',
  'CBS News': 'commercial newsroom',
  'NBC News': 'commercial newsroom',
  'ABC News': 'commercial newsroom',
  '60 Minutes': 'commercial newsroom',

  // Print/digital
  'NYT': 'newspaper',
  'New York Times': 'newspaper',
  'Washington Post': 'newspaper',
  'WSJ': 'business newspaper',
  'Wall Street Journal': 'business newspaper',

  // Opinion/ideological
  'Fox News': 'conservative cable',
  'MSNBC': 'liberal cable',
}

export function getOutletDescriptor(source: string): string {
  return OUTLET_DESCRIPTORS[source] ?? 'news outlet'
}
