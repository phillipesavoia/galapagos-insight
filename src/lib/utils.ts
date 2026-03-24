import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Period } from "@/components/dashboard/PeriodFilter";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface NavDataPoint {
  date: string;
  nav: number;
  daily_return: number | null;
  ytd_return: number | null;
}

export function filterByPeriod(data: NavDataPoint[], period: Period): NavDataPoint[] {
  if (data.length === 0 || period === "Máx") return data;
  const lastDate = new Date(data[data.length - 1].date);
  let cutoff: Date;
  if (period === "YTD") {
    cutoff = new Date(lastDate.getFullYear(), 0, 1);
  } else {
    const months = period === "1M" ? 1 : period === "3M" ? 3 : 12;
    cutoff = new Date(lastDate);
    cutoff.setMonth(cutoff.getMonth() - months);
  }
  return data.filter((d) => d.date >= cutoff.toISOString().slice(0, 10));
}
