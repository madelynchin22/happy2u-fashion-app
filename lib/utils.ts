import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatCurrency(amount: number | null | undefined, currency = "RM"): string {
  if (amount == null) return "-";
  return `${currency} ${amount.toFixed(2)}`;
}

// Gross margin: SP = Cost / (1 - margin)
export function calcSellingPrice(costRm: number, marginPct: number): number {
  if (marginPct >= 1) return 0;
  return costRm / (1 - marginPct);
}

export function rmbToRm(rmb: number, rate: number): number {
  return rmb * rate;
}

export function generatePoNumber(sequence: number): string {
  const month = new Date().toLocaleString("en", { month: "short" }).toUpperCase();
  return `${month}-${String(sequence).padStart(2, "0")}`;
}

export function generateOrderNumber(prefix: string, sequence: number): string {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(sequence).padStart(3, "0")}`;
}

export const SIZE_COLUMNS = ["36", "37", "38", "39", "40", "41", "42"] as const;
export type SizeKey = typeof SIZE_COLUMNS[number];

export function sumSizes(item: Record<string, number>): number {
  return SIZE_COLUMNS.reduce((sum, s) => sum + (item[`qty${s}`] ?? 0), 0);
}

export const PRODUCT_CATEGORIES = [
  "heels", "flats", "sandals", "boots", "bags",
  "accessories", "shoe_care", "keychain", "merchandiser",
] as const;

export const USER_ROLES = ["admin", "buyer", "operation", "finance", "warehouse"] as const;

export const SAMPLE_STATUSES = ["draft", "sent", "received", "approved", "rejected"] as const;
export const PO_STATUSES = ["draft", "sent", "confirmed", "in_production", "shipped", "closed"] as const;
export const SHIPMENT_STATUSES = ["preparing", "in_transit", "customs", "arrived", "delivered"] as const;
