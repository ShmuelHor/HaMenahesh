// All Hebrew strings sent to Telegram, grouped by message type.
// Only Telegram-facing copy lives here; logger messages stay in English.

export const he = {
  prediction: {
    header: '⚽ <b>תחזית גביע העולם 2026</b>',
    match: (homeFlag: string, home: string, h: number, a: number, away: string, awayFlag: string) =>
      `${homeFlag} <b>${home}</b> ${h}–${a} <b>${away}</b> ${awayFlag}`,
    date: (dateStr: string) => `📅 ${dateStr}`,
    venue: (v: string) => `🏟️ ${v || 'לא ידוע'}`,
    ranks: (homeRank: number, awayRank: number) =>
      `📊 דירוג פיפ"א: מקום ${homeRank} נגד מקום ${awayRank}`,
    confidence: (pct: number) => `🔮 ביטחון: ${pct}%`,
    reasoning: (text: string) => `💭 ${text}`,
  },

  dailySummary: {
    header: (dateLabel: string) => `⚽ <b>ניחושי המונדיאל — ${dateLabel}</b>`,
    matchLine: (homeFlag: string, home: string, h: number, a: number, away: string, awayFlag: string) =>
      `${homeFlag} ${home} ${h}–${a} ${away} ${awayFlag}`,
    confidenceLine: (pct: number, homeRank: number, awayRank: number) =>
      `ביטחון: ${pct}% | דירוג: ${homeRank} נגד ${awayRank}`,
    accuracy: (correct: number, total: number) =>
      `📊 <b>דיוק עד כה:</b> ${correct}/${total} ניצחונות נכונים`,
    noStats: '',
  },

  preMatch: {
    header: '⏰ <b>עוד 30 דקות!</b>',
    match: (homeFlag: string, home: string, away: string, awayFlag: string) =>
      `${homeFlag} ${home} נגד ${away} ${awayFlag}`,
    prediction: (h: number, a: number) => `🎯 התחזית שלי: ${h}–${a}`,
    confidence: (pct: number) => `🔮 ביטחון: ${pct}%`,
    reasoning: (text: string) => `💭 ${text}`,
  },

  postMatch: {
    headerExact: '✅ <b>ניחשתי מדויק!</b>',
    headerCorrect: '✓ <b>ניצחון נכון</b>',
    headerWrong: '❌ <b>טעיתי</b>',
    result: (homeFlag: string, home: string, h: number, a: number, away: string, awayFlag: string) =>
      `${homeFlag} ${home} ${h}–${a} ${away} ${awayFlag}`,
    predicted: (h: number, a: number) => `🎯 חיזיתי: ${h}–${a}`,
    actual: (h: number, a: number) => `⚽ יצא: ${h}–${a}`,
    labelExact: '✅ ניחוש מדויק',
    labelCorrect: '✓ ניצחון נכון',
    labelWrong: '✗ טעות',
  },

  weeklyReport: {
    header: (weekNum: number) =>
      `📊 <b>דוח שבועי — גביע העולם 2026</b>\nשבוע ${weekNum}`,
    total: (n: number) => `🎯 סה"כ תחזיות: ${n}`,
    winners: (correct: number, total: number, pct: number) =>
      `✅ ניחושי ניצחון נכונים: ${correct}/${total} (${pct}%)`,
    exact: (exact: number, total: number, pct: number) =>
      `⚽ ניחושים מדויקים: ${exact}/${total} (${pct}%)`,
    detailHeader: '📋 <b>פירוט:</b>',
    matchRow: (icon: string, homeFlag: string, home: string, h: number, a: number, away: string, awayFlag: string, actualH: number, actualA: number) =>
      `${icon} ${homeFlag}${home} ${h}–${a} ${away}${awayFlag} (יצא: ${actualH}–${actualA})`,
    noFinished: 'אין תוצאות לדיווח השבוע.',
  },

  nightSummary: {
    header: '🌙 <b>סיכום יומי — מונדיאל 2026</b>',
    matchesCount: (n: number) => `📊 משחקים היום: ${n}`,
    resultsReceived: (n: number) => `✅ תוצאות שהתקבלו: ${n}`,
    correctWinners: (correct: number, total: number) =>
      `🎯 ניחושי ניצחון נכונים: ${correct}/${total}`,
    exactScores: (exact: number, total: number) =>
      `⚽ ניחושים מדויקים: ${exact}/${total}`,
  },

  startup: (serviceLines: string) =>
    `🏆 <b>מנבא המונדיאל 2026 — מוכן לפעולה!</b>\n\n` +
    `⚽ אני אנחש בשבילך את תוצאות כל משחק בגביע העולם\n` +
    `🤖 מופעל על ידי Claude AI + נתונים מ-football-data.org\n` +
    `🌤️ כולל מזג אוויר, דירוגי פיפ"א ופורמה אחרונה\n\n` +
    `<b>בדיקת חיבורים:</b>\n${serviceLines}\n\n` +
    `📅 גביע העולם 2026 מתחיל ב-11 יוני\n` +
    `🇺🇸 🇲🇽 🇨🇦 48 קבוצות | 104 משחקים | 1 אלוף\n\n` +
    `<b>כל בוקר ב-08:00 תחזיות היום יגיעו אוטומטית ☀️</b>`,

  system: {
    error: (context: string, message: string) =>
      `🚨 <b>שגיאת מערכת</b>\n<code>${context}</code>\n${message}`,
    noMatchesToday: (dateStr: string) =>
      `ℹ️ אין משחקי מונדיאל היום (${dateStr})`,
  },
};
