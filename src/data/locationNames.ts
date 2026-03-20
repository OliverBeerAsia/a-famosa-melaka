export const LOCATION_NAMES: Record<string, string> = {
  'a-famosa-gate': 'A Famosa Fortress',
  'rua-direita': 'Rua Direita',
  'st-pauls-church': "St. Paul's Church",
  waterfront: 'The Waterfront',
  kampung: 'Kampung Quarter',
};

export function getLocationName(locationId: string): string {
  return LOCATION_NAMES[locationId] || locationId;
}
