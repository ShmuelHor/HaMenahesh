// All Hebrew strings sent to Telegram, grouped by message type.
// Only Telegram-facing copy lives here; logger messages stay in English.

export const he = {
  prediction: {
    header: '⚽ <b>תחזית מונדיאל 2026</b>',
    match: (homeFlag: string, home: string, away: string, awayFlag: string) =>
      `${homeFlag} <b>${home}</b>  ·  <b>${away}</b> ${awayFlag}`,
    score: (homeFlag: string, h: number, awayFlag: string, a: number) =>
      `🎯 תחזית:  ${homeFlag} <b>${h}</b> – <b>${a}</b> ${awayFlag}`,
    datetime: (date: string, time: string) => `📅 ${date}\n⏰ ${time} שעון ישראל`,
    stadium: (name: string) => `🏟 ${name}`,
    location: (city: string, country: string, flag: string) => `📍 ${city}, ${country} ${flag}`,
    ranks: (homeFlag: string, homeRank: number, awayFlag: string, awayRank: number) =>
      `📊 דירוג פיפ"א: ${homeFlag} #${homeRank} מול ${awayFlag} #${awayRank}`,
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

  yesterdaySummary: {
    header: '📊 <b>סיכום 24 השעות האחרונות — מונדיאל 2026</b>',
    matchRow: (icon: string, homeFlag: string, home: string, predH: number, predA: number, away: string, awayFlag: string, actualH: number, actualA: number) =>
      `${icon} ${homeFlag} ${home} ${predH}–${predA} ${away} ${awayFlag}  →  יצא: ${actualH}–${actualA}`,
    pending: (homeFlag: string, home: string, away: string, awayFlag: string) =>
      `⏳ ${homeFlag} ${home} נגד ${away} ${awayFlag} — תוצאה טרם נקלטה`,
    accuracy: (correct: number, total: number, exact: number) =>
      `📈 <b>דיוק ב-24 שעות:</b> ${correct}/${total} ניצחונות נכונים | ${exact} מדויק`,
    overallAccuracy: (correct: number, total: number, exact: number) =>
      `🏆 <b>סה"כ עד כה:</b> ${correct}/${total} ניצחונות נכונים (${Math.round((correct / total) * 100)}%)\n⚽ ניחושים מדויקים: ${exact}/${total} (${Math.round((exact / total) * 100)}%)`,
    noResults: '⏳ תוצאות 24 השעות האחרונות טרם התקבלו',
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

  stats: {
    header: '📊 <b>סטטיסטיקות מונדיאל 2026</b>',
    total: (n: number) => `🎯 סה"כ משחקים שנבדקו: ${n}`,
    winners: (correct: number, total: number, pct: number) =>
      `🏆 ניצחונות נכונים: ${correct}/${total} (${pct}%)`,
    exact: (exact: number, total: number, pct: number) =>
      `⚽ ניחושים מדויקים: ${exact}/${total} (${pct}%)`,
    noData: 'ℹ️ עדיין אין נתונים.',
  },

  startup: (serviceLines: string, allOk: boolean) =>
    `${allOk ? '🔄 מערכת עלתה' : '⚠️ מערכת עלתה עם שגיאות'}\n\n${serviceLines}`,

  healthCheck: (serviceLines: string, allOk: boolean) =>
    allOk
      ? '🟢 כל המערכות פועלות'
      : `🔴 שירות לא זמין\n\n${serviceLines}`,

  system: {
    error: (context: string, message: string) =>
      `🚨 <b>שגיאת מערכת</b>\n<code>${context}</code>\n${message}`,
    noMatchesToday: (dateStr: string) =>
      `ℹ️ אין משחקי מונדיאל היום (${dateStr})`,
  },
};
