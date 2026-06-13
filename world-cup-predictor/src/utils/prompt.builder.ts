// Builds the English-language user message sent to Claude for each match prediction.
// English prompts produce better analytical reasoning from Claude.
// The reasoning field in Claude's JSON response is requested in Hebrew
// so it can be displayed directly in Telegram without translation.

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
  // AFC (additional)
  IDN: '🇮🇩', QAT: '🇶🇦', THA: '🇹🇭', KUW: '🇰🇼',
  // CAF (additional)
  ALG: '🇩🇿', COD: '🇨🇩', TAN: '🇹🇿', MOZ: '🇲🇿', CPV: '🇨🇻',
  GIN: '🇬🇳', ZIM: '🇿🇼', GAB: '🇬🇦', BFA: '🇧🇫',
  // CONCACAF (additional)
  CUB: '🇨🇺', GUA: '🇬🇹', SLV: '🇸🇻', HAI: '🇭🇹',
  // UEFA (additional)
  GRE: '🇬🇷', ROU: '🇷🇴', SVN: '🇸🇮', ISL: '🇮🇸', FIN: '🇫🇮',
  IRL: '🇮🇪', MNE: '🇲🇪', BIH: '🇧🇦', MKD: '🇲🇰',
  // OFC
  NZL: '🇳🇿',
};

export function countryCodeToFlag(tla: string | null): string {
  return (tla ? TLA_TO_FLAG[tla.toUpperCase()] : null) ?? '🏳️';
}

export function formatFormRecord(matches: FDMatch[], teamId: number): string {
  if (!matches.length) return 'N/A';
  return matches
    .slice(0, 5)
    .map((m) => {
      if (m.score.winner === null) return 'D';
      if (m.homeTeam.id === teamId) {
        return m.score.winner === 'HOME_TEAM' ? 'W' : 'L';
      }
      return m.score.winner === 'AWAY_TEAM' ? 'W' : 'L';
    })
    .join(' ');
}

const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ENGLISH_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Used by Telegram messages — returns a Hebrew-formatted date string
const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export function formatMatchDateTime(utcDate: Date): { date: string; time: string } {
  const israel = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);
  const day = HEBREW_DAYS[israel.getUTCDay()];
  const dd = israel.getUTCDate().toString().padStart(2, '0');
  const mm = (israel.getUTCMonth() + 1).toString().padStart(2, '0');
  const yyyy = israel.getUTCFullYear();
  const hh = israel.getUTCHours().toString().padStart(2, '0');
  const min = israel.getUTCMinutes().toString().padStart(2, '0');
  return { date: `${day}, ${dd}.${mm}.${yyyy}`, time: `${hh}:${min}` };
}

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

function formatDateEnglish(utcDate: Date): string {
  const israel = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000);
  const day = ENGLISH_DAYS[israel.getUTCDay()];
  const date = israel.getUTCDate();
  const month = ENGLISH_MONTHS[israel.getUTCMonth()];
  const year = israel.getUTCFullYear();
  const hours = israel.getUTCHours().toString().padStart(2, '0');
  const minutes = israel.getUTCMinutes().toString().padStart(2, '0');
  return `${day}, ${date} ${month} ${year}, ${hours}:${minutes} (Israel time)`;
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
    ? `${Math.round(weather.temp)}°C, humidity ${weather.humidity}%, wind ${Math.round(weather.windSpeed)} km/h` +
      (weather.rain > 0 ? `, rain ${weather.rain} mm/h` : '')
    : 'unavailable';

  let historyStr = 'No prediction history yet.';
  const finishedHistory = history.filter((p) => p.resultFetched).slice(0, 8);
  if (finishedHistory.length > 0) {
    const rows = finishedHistory.map((p) => {
      const result = p.isExactScore
        ? '✅ exact'
        : p.isCorrectWinner
        ? '✓ correct winner'
        : '✗ wrong';
      return `  - Predicted ${p.homeTeam} ${p.predictedHome}–${p.predictedAway} ${p.awayTeam} → actual ${p.actualHome}–${p.actualAway} ${result}`;
    });
    historyStr = 'Past prediction history:\n' + rows.join('\n');
  }

  return `MATCH DATA:
- ${homeTeam.name} (FIFA rank #${homeRank}) vs ${awayTeam.name} (FIFA rank #${awayRank})
- Date: ${formatDateEnglish(new Date(match.utcDate))}
- Venue: ${match.venue || 'Unknown'}
- Stage: ${match.stage}${match.group ? ` — ${match.group}` : ''}

RECENT FORM (last 5 matches, most recent first — W=Win, D=Draw, L=Loss):
- ${homeTeam.name}: ${homeFormStr}
- ${awayTeam.name}: ${awayFormStr}

REST DAYS SINCE LAST MATCH:
- ${homeTeam.name}: ${restDaysHome} days
- ${awayTeam.name}: ${restDaysAway} days

WEATHER AT KICK-OFF:
- ${weatherStr}

${historyStr}

Reply with JSON only — no other text:
{"home_score": X, "away_score": X, "confidence": X, "reasoning": "1-3 sentences in Hebrew"}`;
}
