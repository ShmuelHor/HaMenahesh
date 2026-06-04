// ── football-data.org API types ─────────────────────────────────────────────

export type FDStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED';

export type FDWinner = 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW';

export interface FDScore {
  home: number | null;
  away: number | null;
}

export interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface FDMatch {
  id: number;
  utcDate: string;
  status: FDStatus;
  stage: string;
  group: string | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: {
    winner: FDWinner | null;
    fullTime: FDScore;
    halfTime: FDScore;
  };
  venue: string;
}

export interface FDMatchesResponse {
  count: number;
  matches: FDMatch[];
}

// ── OpenWeatherMap types ─────────────────────────────────────────────────────

export interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  description: string;
  windSpeed: number;
  rain: number;
}

// ── Internal enriched match (all context gathered) ──────────────────────────

export interface EnrichedMatch {
  match: FDMatch;
  homeForm: FDMatch[];
  awayForm: FDMatch[];
  restDaysHome: number;
  restDaysAway: number;
  weather: WeatherData | null;
}

// ── Claude API response (validated by Zod) ──────────────────────────────────

export interface ClaudePredictionResponse {
  home_score: number;
  away_score: number;
  confidence: number;
  reasoning: string;
}

// ── MongoDB document ─────────────────────────────────────────────────────────

export interface IPrediction {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  matchDate: Date;
  venue: string;
  homeRank: number;
  awayRank: number;
  predictedHome: number;
  predictedAway: number;
  confidence: number;
  reasoning: string;
  actualHome?: number;
  actualAway?: number;
  resultFetched: boolean;
  isCorrectWinner?: boolean;
  isExactScore?: boolean;
  preMatchNotified: boolean;
  postMatchNotified: boolean;
  createdAt: Date;
}

// ── Validated app config ─────────────────────────────────────────────────────

export interface AppConfig {
  mongoUri: string;
  footballApiKey: string;
  anthropicApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
  openWeatherApiKey: string;
  claudeModel: string;
  nodeEnv: string;
}

// ── Weekly report stats ──────────────────────────────────────────────────────

export interface WeeklyStats {
  totalPredictions: number;
  correctWinners: number;
  exactScores: number;
  winnerAccuracyPct: number;
  exactScorePct: number;
  predictions: IPrediction[];
  weekStart: Date;
  weekEnd: Date;
}
