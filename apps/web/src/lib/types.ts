export type Role = "USER" | "ADMIN";

export type MarketCategory =
  | "POLITICS"
  | "SPORTS"
  | "CRYPTO"
  | "ECONOMY"
  | "SCIENCE_TECH"
  | "POP_CULTURE"
  | "OTHER";

export type MarketStatus = "OPEN" | "RESOLVED";

export type BetSide = "YES" | "NO";

export type User = {
  id: string;
  email: string;
  username: string;
  role: Role;
  walletBalance: string;
  createdAt: string;
};

export type Market = {
  id: string;
  title: string;
  description: string;
  yesDescription: string;
  noDescription: string;
  category: MarketCategory;
  status: MarketStatus;
  resolvedOutcome: BetSide | null;
  startDate: string;
  endDate: string;
  yesPool: string;
  noPool: string;
  totalVolume: string;
  createdAt: string;
  resolvedAt: string | null;
  yesPrice: number;
  noPrice: number;
};

export type Bet = {
  id: string;
  side: BetSide;
  amount: string;
  price: string;
  payout: string | null;
  createdAt: string;
  userId: string;
  marketId: string;
  market?: Market;
  user?: User;
};

export type PricePoint = {
  id: string;
  yesPrice: string;
  timestamp: string;
  marketId: string;
};

export const CATEGORY_LABELS: Record<MarketCategory, string> = {
  POLITICS: "Politique",
  SPORTS: "Sport",
  CRYPTO: "Crypto",
  ECONOMY: "Économie",
  SCIENCE_TECH: "Science & Tech",
  POP_CULTURE: "Culture",
  OTHER: "Autre",
};
