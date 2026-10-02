export interface PackingItem {
  category?: string;
  categoryId?: string;
  quantity: number;
}

export function getPackingCharge(
  items: PackingItem[],
  enabled: boolean,
  rates: Record<string, number>
) {
  if (!enabled) return { total: 0, breakdown: {} as Record<string, number> };
  const ratesByKey = new Map(Object.entries(rates || {}).map(([key, value]) => [key.trim().toLowerCase(), Math.max(0, Number(value) || 0)]));
  const breakdown: Record<string, number> = {};
  for (const item of items) {
    const category = item.category || item.categoryId || "Other";
    const rate = ratesByKey.get(category.trim().toLowerCase()) || 0;
    if (rate <= 0) continue;
    breakdown[category] = (breakdown[category] || 0) + rate * Math.max(0, item.quantity || 0);
  }
  return { total: Object.values(breakdown).reduce((sum, value) => sum + value, 0), breakdown };
}
