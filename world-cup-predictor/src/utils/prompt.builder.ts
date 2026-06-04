// Builds the Hebrew-language user message sent to Claude for each match prediction.
// Prompt content stays Hebrew so Claude produces Hebrew reasoning in its response.

import { EnrichedMatch, FDMatch, IPrediction } from '../types';
import { getFifaRanking } from './fifa-rankings';

// Maps football-data.org TLA codes to Unicode flag emoji
const TLA_TO_FLAG: Record<string, string> = {
  // Hosts
  USA: '🇺🇸', MEX: '🇲🇽', CAN: '🇨🇦',
  // CONMEBOL
  BRA: '🇧🇷', ARG: '🇦🇷', URU: '🇺🇾', COL: '🇨🇴', ECU: '🇪🇨',
  PAR: '🇵🇾', BOL: '🇧🇴', VEN: '🇻🇪', CHI: '🇨🇱', PER: '🇵🇪',
  // CONCACAF
  PAN: '🇵🇦', HON: '🇭🇳', CRC: '🇨🇷', JAM: '🇯🇲', TRI: '🇹🇹',
  // UEFA
  GER: '🇩🇪', FRA: '🇫🇷', ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', ESP: '🇪🇸', POR: '🇵🇹',
  NED: '🇳🇱', BEL: '🇧🇪', ITA: '🇮🇹', CRO: '🇭🇷', AUT: '🇦🇹',
  DEN: '🇩🇰', SUI: '🇨🇭', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', SRB: '🇷🇸', SVK: '🇸🇰',
  POL: '🇵🇱', TUR: '🇹🇷', UKR: '🇺🇦', HUN: '🇭🇺', GEO: '🇬🇪',
  ALB: '🇦🇱', SLO: '🇸🇮', CZE: '🇨🇿', NOR: '🇳🇴', WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  // CAF
  MAR: '🇲🇦', SEN: '🇸🇳', NGA: '🇳🇬', EGY: '🇪🇬', CMR: '🇨🇲',
  CIV: '🇨🇮', TUN: '🇹🇳', RSA: '🇿🇦', GHA: '🇬🇭', MLI: '🇲🇱',
  // AFC
  JPN: '🇯🇵', KOR: '🇰🇷', IRN: '🇮🇷', AUS: '🇦🇺', SAU: '🇸🇦',
  IRQ: '🇮🇶', JOR: '🇯🇴', UZB: '🇺🇿', CHN: '🇨🇳',
  // OFC
  NZL: '🇳🇿',
};

export function countryCodeToFlag(tla: string): string {
  return TLA_TO_FLAG[tla.toUpperCase()] ?? '🏳️';
}

export function formatFormRecord(matches: FDMatch[], teamId: number): string {
  if (!matches.length) return 'אין נתונים';
  return matches
    .slice(0, 5)
    .map((m) => {
      if (m.score.winner === null) return 'תיקו';
      if (m.homeTeam.id === teamId) {
        return m.score.winner === 'HOME_TEAM' ? 'נצ׳' : 'הפ׳';
      }
      return m.score.winner === 'AWAY_TEAM' ? 'נצ׳' : 'הפ׳';
    })
    .join(' ');
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export function formatDateIsrael(utcDate: Date): string {
  // Israel summer time is UTC+3 (IDT)
  const israel = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);
  const day = HEBREW_DAYS[israel.getUTCDay()];
  const date = israel.getUTCDate();
  const month = HEBREW_MONTHS[israel.getUTCMonth()];
  const year = israel.getUTCFullYear();
  const hours = israel.getUTCHours().toString().padStart(2, '0');
  const minutes = israel.getUTCMinutes().toString().padStart(2, '0');
  return `יום ${day}, ${date} ${month} ${year}, ${hours}:${minutes}`;
}

export function buildMatchPrompt(
  enriched: EnrichedMatch,
  history: IPrediction[]
): string {
  const { match, homeForm, awayForm, restDaysHome, restDaysAway, weather } = enriched;
  const { homeTeam, awayTeam } = match;
  const homeRank = getFifaRanking(homeTeam.tla);
  const awayRank = getFifaRanking(awayTeam.tla);

  const homeFormStr = formatFormRecord(homeForm, homeTeam.id);
  const awayFormStr = formatFormRecord(awayForm, awayTeam.id);

  const weatherStr = weather
    ? `${Math.round(weather.temp)}°C, לחות ${weather.humidity}%, רוח ${Math.round(weather.windSpeed)} קמ"ש` +
      (weather.rain > 0 ? `, גשם ${weather.rain} מ"מ` : '')
    : 'אין נתונים';

  let historyStr = 'אין היסטוריית ניחושים עדיין.';
  const finishedHistory = history.filter((p) => p.resultFetched).slice(0, 8);
  if (finishedHistory.length > 0) {
    const rows = finishedHistory.map((p) => {
      const result = p.isExactScore
        ? '✅ מדויק'
        : p.isCorrectWinner
        ? '✓ ניצחון נכון'
        : '✗ טעות';
      return `  - ניחשתי ${p.homeTeam} ${p.predictedHome}–${p.predictedAway} ${p.awayTeam} → יצא ${p.actualHome}–${p.actualAway} ${result}`;
    });
    historyStr = 'היסטוריית ניחושים קודמים:\n' + rows.join('\n');
  }

  return `נתוני המשחק:
- ${homeTeam.name} (דירוג ${homeRank}) נגד ${awayTeam.name} (דירוג ${awayRank})
- תאריך: ${formatDateIsrael(new Date(match.utcDate))}
- מגרש: ${match.venue || 'לא ידוע'}

כוח אחרון (5 משחקים):
- ${homeTeam.name}: ${homeFormStr}
- ${awayTeam.name}: ${awayFormStr}

ימי מנוחה:
- ${homeTeam.name}: ${restDaysHome} ימים
- ${awayTeam.name}: ${restDaysAway} ימים

מזג אוויר ביום המשחק:
- ${weatherStr}

${historyStr}

ענה בJSON בלבד, ללא טקסט נוסף:
{"home_score": X, "away_score": X, "confidence": X, "reasoning": "הסבר קצר בעברית"}`;
}
