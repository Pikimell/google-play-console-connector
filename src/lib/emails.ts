const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Розібрати будь-який вставлений текст (через кому, пробіли, з нового рядка, "Ім'я <email>") на email-и. */
export function parseEmails(input: string[] | string) {
  const parts = Array.isArray(input) ? input : input.split(/[\s,;]+/);
  const valid = new Set<string>();
  const invalid: string[] = [];
  for (const raw of parts) {
    const e = raw.trim().toLowerCase().replace(/^[<("']+|[>)"']+$/g, "");
    if (!e) continue;
    if (EMAIL.test(e)) valid.add(e);
    else if (e.includes("@")) invalid.push(raw.trim());
  }
  return { valid: [...valid].sort(), invalid };
}

export function isEmail(s: string) {
  return EMAIL.test(s.trim());
}

/** CSV у форматі, який приймає Play Console (один email на рядок, без заголовка). */
export function emailsCsv(emails: string[]) {
  return emails.join("\n") + "\n";
}
