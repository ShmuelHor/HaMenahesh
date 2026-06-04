# World Cup 2026 Predictor

A TypeScript daemon that automatically predicts World Cup 2026 match results, learns from its history throughout the tournament, and delivers everything to Telegram.

## How It Works

The system runs continuously in Docker Compose and performs the following tasks every day:

| Time | Action |
|------|--------|
| **08:00** | Fetches today's matches, enriches with form/weather, sends predictions to Telegram |
| **30 min before** | Sends a reminder with the prediction and confidence % |
| **Every 30 min** | Polls for finished matches and sends results |
| **23:00** | Final result sweep + daily summary |
| **Sunday 20:00** | Weekly report with cumulative statistics |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- API keys (see next section)

## API Keys

### 1. football-data.org

Free registration at [football-data.org](https://www.football-data.org/client/register).
Free tier allows 10 requests/minute. Used to fetch today's matches and team form.

### 2. Anthropic (Claude)

Create a key at [console.anthropic.com](https://console.anthropic.com/).
Used to generate match predictions. Default model: `claude-sonnet-4-6`.

### 3. Telegram Bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram
2. Send `/newbot` and follow the instructions
3. Copy the token you receive

### 4. Telegram Chat ID

1. Send any message to your bot
2. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser
3. Find `chat.id` in the response
4. For a group: add the bot to the group, then check the ID (starts with `-100`)

### 5. OpenWeatherMap

Free registration at [OpenWeatherMap](https://openweathermap.org/api).
Enable the "Current Weather and Forecasts collection" (free tier).

## Setup and Running

```bash
# 1. Enter the project directory
cd world-cup-predictor

# 2. Create the .env file
cp .env.example .env

# 3. Edit .env and fill in all API keys

# 4. Start
docker compose up -d --build
```

## Viewing Logs

```bash
# Live logs
docker compose logs -f app

# MongoDB logs only
docker compose logs -f mongo

# Local log files (daily rotation, kept 14 days)
ls logs/
```

## Checking the Database

```bash
# Connect to MongoDB
docker exec -it world-cup-mongo mongosh worldcup

# Show all predictions
db.predictions.find().pretty()

# Pending predictions (no result yet)
db.predictions.find({ resultFetched: false }).pretty()

# Overall accuracy stats
db.predictions.aggregate([
  { $match: { resultFetched: true } },
  { $group: {
    _id: null,
    total: { $sum: 1 },
    correctWinners: { $sum: { $cond: ["$isCorrectWinner", 1, 0] } },
    exactScores: { $sum: { $cond: ["$isExactScore", 1, 0] } }
  }}
])
```

## Testing Without Waiting for 08:00

Add `RUN_MORNING_NOW=true` to `.env`, then:

```bash
docker compose restart app
docker compose logs -f app
```

Remove the variable after testing.

## Stopping

```bash
# Stop (keeps data)
docker compose down

# Stop and delete all data
docker compose down -v
```

## Project Structure

```text
src/
├── index.ts              # Entry point, startup sequence, /health endpoint
├── types/index.ts        # All TypeScript interfaces
├── config/index.ts       # .env loading + fail-fast validation
├── i18n/he.ts            # All Hebrew Telegram message strings
├── cron/
│   ├── morningJob.ts     # 08:00 — main daily orchestration
│   ├── preMatchJob.ts    # Dynamic setTimeout-based reminders
│   ├── postMatchJob.ts   # Result polling every 30 min
│   ├── nightJob.ts       # 23:00 — daily summary
│   └── weeklyReport.ts   # Sunday 20:00 — weekly report
├── services/
│   ├── football.service.ts  # football-data.org API
│   ├── claude.service.ts    # Anthropic Claude + prompt caching
│   ├── telegram.service.ts  # Telegram Bot API messages
│   └── weather.service.ts   # OpenWeatherMap for all 16 stadiums
├── models/
│   └── prediction.model.ts  # Mongoose schema
├── db/mongo.ts           # MongoDB connection lifecycle
└── utils/
    ├── logger.ts          # Winston with daily log rotation
    ├── retry.ts           # Exponential backoff for all API calls
    ├── prompt.builder.ts  # Builds Claude prompt (Hebrew content for Hebrew output)
    ├── stats.ts           # Weekly statistics computation
    └── fifa-rankings.ts   # Static FIFA ranking table — update before tournament
```

## Known Limitations

- **Injuries / suspensions** — The free football-data.org tier does not provide injury data. The Claude prompt relies on recent form only.
- **FIFA rankings** — football-data.org does not expose official FIFA rankings. A static table in `utils/fifa-rankings.ts` is used instead; update it before the tournament starts.
- **Pre-match recovery** — If the container restarts within 30 minutes of a kick-off, the reminder is silently skipped (too late to be useful anyway).
- **Rate limit** — The free football-data.org tier allows 10 req/min. Automatic delays are inserted between team form requests.
