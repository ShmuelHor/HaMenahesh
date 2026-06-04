// Hebrew team name translations for all 48 WC 2026 qualified nations.
// Keyed by football-data.org TLA (3-letter code).

export const HEBREW_TEAM_NAMES: Record<string, string> = {
  // Hosts
  USA: 'ארה"ב',
  MEX: 'מקסיקו',
  CAN: 'קנדה',

  // CONMEBOL
  BRA: 'ברזיל',
  ARG: 'ארגנטינה',
  URU: 'אורוגוואי',
  COL: 'קולומביה',
  ECU: 'אקוודור',
  PAR: 'פרגוואי',
  BOL: 'בוליביה',
  VEN: 'ונצואלה',
  CHI: "צ'ילה",
  PER: 'פרו',

  // CONCACAF
  PAN: 'פנמה',
  HON: 'הונדורס',
  CRC: 'קוסטה ריקה',
  JAM: "ג'מייקה",
  TRI: 'טרינידד וטובגו',

  // UEFA
  GER: 'גרמניה',
  FRA: 'צרפת',
  ENG: 'אנגליה',
  ESP: 'ספרד',
  POR: 'פורטוגל',
  NED: 'הולנד',
  BEL: 'בלגיה',
  ITA: 'איטליה',
  CRO: 'קרואטיה',
  AUT: 'אוסטריה',
  DEN: 'דנמרק',
  SUI: 'שוויץ',
  SCO: 'סקוטלנד',
  SRB: 'סרביה',
  SVK: 'סלובקיה',
  POL: 'פולין',
  TUR: 'טורקיה',
  UKR: 'אוקראינה',
  HUN: 'הונגריה',
  GEO: 'גאורגיה',
  ALB: 'אלבניה',
  SLO: 'סלובניה',
  CZE: "צ'כיה",
  NOR: 'נורווגיה',
  WAL: 'וולס',

  // CAF
  MAR: 'מרוקו',
  SEN: 'סנגל',
  NGA: 'ניגריה',
  EGY: 'מצרים',
  CMR: 'קמרון',
  CIV: 'חוף השנהב',
  TUN: 'תוניסיה',
  RSA: 'דרום אפריקה',
  GHA: 'גאנה',
  MLI: 'מאלי',

  // AFC
  JPN: 'יפן',
  KOR: 'קוריאה הדרומית',
  IRN: 'איראן',
  AUS: 'אוסטרליה',
  SAU: 'ערב הסעודית',
  IRQ: 'עיראק',
  JOR: 'ירדן',
  UZB: 'אוזבקיסטן',
  CHN: 'סין',

  // OFC
  NZL: 'ניו זילנד',
};

export function getHebrewName(tla: string, fallback: string): string {
  return HEBREW_TEAM_NAMES[tla.toUpperCase()] ?? fallback;
}
