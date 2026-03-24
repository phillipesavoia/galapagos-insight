export const PORTFOLIOS = [
  "Conservative",
  "Income",
  "Balanced",
  "Growth",
  "Liquidity",
  "Bond Portfolio",
] as const;

export type PortfolioName = (typeof PORTFOLIOS)[number];
