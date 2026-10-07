export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public hint?: string,
  ) {
    super(message);
  }
}

type Known = { test: RegExp; message: string; hint?: string };

/** Найчастіші помилки Google Play API з людським поясненням. */
const KNOWN: Known[] = [
  {
    test: /caller does not have permission|permission denied|insufficient permissions/i,
    message: "Сервісний акаунт не має доступу до цього застосунку.",
    hint: "Play Console → «Користувачі й дозволи» → запроси email сервісного акаунта й дай йому доступ до застосунку (адмін або права на релізи/тестування/інформацію в магазині). Нові права іноді починають діяти через кілька хвилин.",
  },
  {
    test: /package not found|No application was found/i,
    message: "Застосунок з такою назвою пакета не знайдено.",
    hint: "Перевір назву пакета (наприклад com.company.app). Застосунок має вже існувати в Play Console, а сервісний акаунт — мати до нього доступ.",
  },
  {
    test: /Only releases with status draft may be created on draft app/i,
    message: "Застосунок ще не опублікований, тому Google дозволяє лише релізи-чернетки.",
    hint: "Обери статус «Чернетка». Потім заверши заповнення обов'язкових розділів у Play Console (політика конфіденційності, вікова категорія, безпека даних тощо) і відправ реліз на перевірку там.",
  },
  {
    test: /version code .* has already been used|APK specifies a version code that has already been used/i,
    message: "Цей versionCode уже використовувався.",
    hint: "Збільш versionCode у build.gradle (android.defaultConfig.versionCode) і збери новий файл.",
  },
  {
    test: /signed in debug mode|debug certificate/i,
    message: "Файл підписаний debug-ключем.",
    hint: "Збери release-версію (./gradlew bundleRelease) з upload-ключем.",
  },
  {
    test: /wrong key|signed with the wrong key|certificate.*does not match/i,
    message: "Файл підписаний не тим ключем.",
    hint: "Для Play App Signing використовуй той самий upload-ключ, що й раніше. Якщо ключ втрачено — скинь його в Play Console → «Цілісність застосунку».",
  },
  {
    test: /Track .* not found|Unknown track/i,
    message: "Такого треку тестування не існує.",
  },
  {
    test: /invalid_grant|account not found|Invalid JWT/i,
    message: "Google не прийняв ключ сервісного акаунта.",
    hint: "Ключ міг бути видалений у Google Cloud. Створи новий JSON-ключ і заміни файл.",
  },
  {
    test: /Google Play Android Developer API has not been used|API has not been used in project|is disabled/i,
    message: "Google Play Android Developer API не увімкнено у вашому Google Cloud проєкті.",
    hint: "Відкрий console.cloud.google.com → APIs & Services → Library → «Google Play Android Developer API» → Enable. Почекай пару хвилин.",
  },
  {
    test: /This edit has already been (?:replaced|committed)|edit.*(?:expired|not found)/i,
    message: "Сесія змін (edit) застаріла.",
    hint: "Хтось змінив застосунок паралельно (або минуло багато часу). Почни крок спочатку.",
  },
];

export function humanizeError(status: number, message: string, hint?: string) {
  for (const k of KNOWN) {
    if (k.test.test(message)) {
      return { status, message: k.message, hint: hint ?? k.hint, details: message };
    }
  }
  return { status, message, hint, details: undefined as string | undefined };
}
