# Call Bot — Local Control Center

Replaces **all Make.com scenarios** with one local app. Run `npm run dev` and manage everything from the UI.

## Make.com blueprints mapped

| Blueprint file | What it did | Where in this app |
| --- | --- | --- |
| `1. LEAD_FLOW.blueprint.json` | SMS → wait 10s → SMS → POST lead | **Lead Flow SMS** page |
| Outbound 19-step (user flow) | SMS → wait 5m → check reply → AI yes/no → call or reschedule | **Outbound Campaign** page |
| `Lead_Flow_BismillahRealty.blueprint.json` | Webhook → Retell call → poll → DeepSeek → Calendar → dashboard | Inside Outbound Campaign (after YES) |
| `2.Lead_Flow_call.blueprint.json` | Call ended → OpenAI extract → dashboard POST | Auto after every call |
| `Call_pilot_Calendar_Summary Complete.blueprint.json` | GetCall → DeepSeek → Google Calendar | Auto after outbound call ends |

## Quick start

```bash
npm install
cp .env.example .env   # fill in keys
npm run dev
```

Open http://localhost:3000

## Pages

| Page | Purpose |
| --- | --- |
| **Dashboard** | Calls + active workflows stats |
| **Workflows** | All running/completed flows with step timeline |
| **Lead Flow SMS** | Blueprint 1 — nurture SMS sequence |
| **Outbound Campaign** | Full 19-step SMS → yes/no → call/reschedule |
| **Quick Call** | Immediate Retell dial (no SMS wait) |
| **Web Call** | Browser mic test |
| **Settings** | Env status (Retell, Twilio, Calendar, LLM) |

## Outbound Campaign flow (19 steps)

1. New lead trigger → 2. Delay → 3. SMS "call in 5 min" → 4. Wait 5 min → 5. Check messages → 6. AI yes/no decision → 7. Router → 8. **YES** → Retell call → poll → extract → calendar → dashboard → 9–19. **NO** → time analysis → confirm/reschedule SMS → save schedule → reminder loop

On the **workflow detail page** you can **simulate SMS replies** locally (type "YES", "busy", "call me at 3pm") when Twilio webhook isn't set up.

## Environment

See [`.env.example`](.env.example). Required for full flows:

- **Retell**: `RETELL_API_KEY`, agent IDs, from number
- **Twilio**: account SID, auth token, messaging service (for real SMS)
- **LLM**: OpenAI or DeepSeek (for SMS decisions + transcript extraction)
- **Google Calendar** (optional): service account + calendar ID

## Webhooks (optional, use with ngrok)

- Retell: `/api/webhooks/retell`
- Twilio inbound SMS: `/api/webhooks/twilio/sms`

Without webhooks, the app polls Retell for call results and lets you simulate SMS replies in the UI.
