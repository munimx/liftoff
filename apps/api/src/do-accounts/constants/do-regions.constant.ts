/**
 * Supported DigitalOcean regions for account-scoped resources.
 */
export const DO_REGIONS = [
  'nyc1',
  'nyc3',
  'sfo3',
  'ams3',
  'sgp1',
  'lon1',
  'fra1',
  'tor1',
  'blr1',
  'syd1',
] as const;

export type DoRegion = (typeof DO_REGIONS)[number];
