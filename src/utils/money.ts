export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Summarises a set of amounts as a single figure or a low–high range. Used for an SPU's
 * price and MAP, which vary across its SKUs. Returns null when there is nothing to show.
 */
export function formatMoneyRange(amounts: number[]): string | null {
  if (amounts.length === 0) return null;
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  return low === high ? formatMoney(low) : `${formatMoney(low)} – ${formatMoney(high)}`;
}
