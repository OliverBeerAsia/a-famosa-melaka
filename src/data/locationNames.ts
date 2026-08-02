export const LOCATION_NAMES: Record<string, string> = {
  'a-famosa-gate': 'A Famosa Fortress',
  'rua-direita': 'Rua Direita',
  // 1580-correct: the church was N. S. da Annunciada / Madre de Deus under the
  // Jesuits; "St. Paul's" is the post-1641 Dutch name (see historical-audit E1).
  // Internal id stays 'st-pauls-church'.
  'st-pauls-church': 'Igreja Madre de Deus',
  waterfront: 'The Waterfront',
  kampung: 'Kampung Quarter',
};

export function getLocationName(locationId: string): string {
  return LOCATION_NAMES[locationId] || locationId;
}
