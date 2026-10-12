# Play Publisher — Google Play Console Publisher

> A focused full-stack dashboard for managing Google Play publishing workflows through the Google Play Developer API.

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

- **Створити новий застосунок через API не можна** — лише в Play Console. Панель проводить через цей крок.
- **Список усіх застосунків API не віддає** — застосунки додаються в панель один раз за назвою пакета.
- **Тестувальників через API можна призначати лише Google-групами.** Email-списки Play Console через API недоступні. Панель зберігає email-и у себе, прив'язує Google-групу до треку автоматично, а для email-списків дає CSV-файл для завантаження в Play Console.
- **Внутрішнє тестування** приймає лише email-списки — їх задають у Play Console один раз.
- **Обов'язкові анкети** (вікова категорія, безпека даних, реклама, цільова аудиторія тощо) заповнюються лише в Play Console. Поки вони не заповнені, релізи можна зберігати тільки як чернетки.
- **Підписки** можна створювати лише після завантаження збірки з Google Play Billing Library (дозвіл `com.android.vending.BILLING`) і за наявності платіжного профілю. Міграцію чинних підписників на нову ціну та пропозиції (пробний період, знижки) поки що робимо в Play Console.
- **Reviews:** the API returns text reviews from the last seven days only.

The Ukrainian documentation is available in [README-uk.md](README-uk.md).
