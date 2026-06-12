interface VenueInfo {
  city: string;
  country: string;
  flag: string;
}

const VENUE_MAP: Array<{ keywords: string[]; info: VenueInfo }> = [
  // USA
  { keywords: ['sofi', 'los angeles', 'inglewood'],        info: { city: "לוס אנג'לס",      country: 'ארה"ב', flag: '🇺🇸' } },
  { keywords: ['metlife', 'east rutherford', 'new york'],  info: { city: 'ניו יורק',          country: 'ארה"ב', flag: '🇺🇸' } },
  { keywords: ["at&t", 'att stadium', 'arlington'],        info: { city: 'דאלאס',             country: 'ארה"ב', flag: '🇺🇸' } },
  { keywords: ["levi's", 'levis', 'santa clara'],          info: { city: 'סן פרנסיסקו',       country: 'ארה"ב', flag: '🇺🇸' } },
  { keywords: ['lincoln financial', 'philadelphia'],       info: { city: 'פילדלפיה',          country: 'ארה"ב', flag: '🇺🇸' } },
  { keywords: ['arrowhead', 'kansas city'],                info: { city: 'קנזס סיטי',         country: 'ארה"ב', flag: '🇺🇸' } },
  { keywords: ['lumen', 'seattle'],                        info: { city: 'סיאטל',             country: 'ארה"ב', flag: '🇺🇸' } },
  { keywords: ['gillette', 'foxborough', 'boston'],        info: { city: 'בוסטון',            country: 'ארה"ב', flag: '🇺🇸' } },
  { keywords: ['hard rock', 'miami'],                      info: { city: 'מיאמי',             country: 'ארה"ב', flag: '🇺🇸' } },
  { keywords: ['mercedes-benz', 'mercedes benz', 'atlanta'], info: { city: 'אטלנטה',         country: 'ארה"ב', flag: '🇺🇸' } },
  { keywords: ['allegiant', 'las vegas'],                  info: { city: 'לאס וגאס',          country: 'ארה"ב', flag: '🇺🇸' } },
  // Mexico
  { keywords: ['azteca', 'ciudad de mexico', 'mexico city'], info: { city: 'מקסיקו סיטי',   country: 'מקסיקו', flag: '🇲🇽' } },
  { keywords: ['bbva', 'monterrey'],                       info: { city: 'מונטריי',           country: 'מקסיקו', flag: '🇲🇽' } },
  { keywords: ['akron', 'guadalajara'],                    info: { city: "גוואדלחארה",        country: 'מקסיקו', flag: '🇲🇽' } },
  // Canada
  { keywords: ['bc place', 'vancouver'],                   info: { city: 'ונקובר',            country: 'קנדה',   flag: '🇨🇦' } },
  { keywords: ['bmo', 'toronto'],                          info: { city: 'טורונטו',           country: 'קנדה',   flag: '🇨🇦' } },
];

export function getVenueInfo(venue: string | null): VenueInfo | null {
  if (!venue) return null;
  const lower = venue.toLowerCase();
  for (const entry of VENUE_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.info;
    }
  }
  return null;
}
