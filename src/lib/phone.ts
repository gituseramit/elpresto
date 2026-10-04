export function normalisePhone(raw: string): string {
  return String(raw || "").replace(/\D/g, "").slice(-10);
}

export function phoneSearchVariants(raw: string): string[] {
  const phone = normalisePhone(raw);
  if (phone.length !== 10) return [];

  const firstHalf = phone.slice(0, 5);
  const secondHalf = phone.slice(5);
  return Array.from(
    new Set([
      phone,
      `+91${phone}`,
      `91${phone}`,
      `0${phone}`,
      `${firstHalf} ${secondHalf}`,
      `${firstHalf}-${secondHalf}`,
      `+91 ${firstHalf} ${secondHalf}`,
      `+91-${firstHalf}-${secondHalf}`,
      `91 ${firstHalf} ${secondHalf}`,
    ])
  );
}
