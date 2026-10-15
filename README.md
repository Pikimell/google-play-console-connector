# Google Play Console Connector

> A focused full-stack dashboard for managing Google Play publishing workflows through the Google Play Developer API.

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Google Play API](https://img.shields.io/badge/Google_Play_Developer_API-414141?logo=googleplay&logoColor=white)

A Next.js dashboard for Google Play Developer API (Android Publisher v3): releases, closed testing, store listings, graphics, subscriptions, localization, and reviews.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 and use the Connection page for the guided setup.

## Configuration

| Item | Location |
|---|---|
| Google service-account JSON | `credentials/service-account.json` |
| Optional dashboard password | `.env.local` → `ADMIN_PASSWORD=...` |
| Optional OpenAI translation key | `.env.local` → `OPENAI_API_KEY=...`, `OPENAI_MODEL=...` |

For filesystem-free hosting, use `GOOGLE_SERVICE_ACCOUNT_JSON` as raw JSON or base64. Applications and tester groups are stored in `data/store.json`, so they are not persistent on serverless hosting such as Vercel. Local or VPS deployment is recommended.

## Main areas

- **Overview** — applications and quick actions.
- **Connection** — credential validation and setup guidance.
- **Releases** — upload AAB/APK files, select tracks, publish immediately, progressively, or as drafts.
- **Closed testing** — tracks and tester management.
- **Store listing and graphics** — localized metadata and assets.
- **Subscriptions** — products, base plans, prices, and activation.
- **Localization** — translate store copy with OpenAI and save it to Google Play.
- **Testers** — reusable email groups and CSV export for Play Console.

## Google Play API limitations

- **Apps cannot be created via the API.** This is only possible in Play Console, and the dashboard guides you through that step.
- **The API does not list all apps.** Each app is added to the dashboard once by its package name.
- **Testers can only be assigned through Google Groups.** Play Console email lists are not available via the API. The dashboard stores emails itself, binds a Google Group to the track automatically, and exports a CSV for email lists.
- **Internal testing** accepts only email lists, which are configured once in Play Console.
- **Mandatory questionnaires** (content rating, data safety, ads, target audience) can only be completed in Play Console. Until then, releases can only be saved as drafts.
- **Subscriptions** can only be created after uploading a build with the Google Play Billing Library (`com.android.vending.BILLING`) and with a payments profile. Migrating existing subscribers to a new price and offers (trials, discounts) are still handled in Play Console.
- **Reviews:** the API returns text reviews from the last seven days only.

The Ukrainian documentation is available in [README-uk.md](README-uk.md).

## Author

**Volodymyr Pashchenko**, Full-stack Developer · [GitHub](https://github.com/Pikimell) · [LinkedIn](https://www.linkedin.com/in/pashchenko-v-r)
