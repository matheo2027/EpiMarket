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

export type MarketType = "BINARY" | "MULTI";

export type BetSide = "YES" | "NO";

export type MarketOption = {
  id: string;
  label: string;
  sortOrder: number;
  pool: string;
  marketId: string;
  price: number;
};

export type User = {
  id: string;
  email: string;
  username: string;
  role: Role;
  walletBalance: string;
  walletAddress: string | null;
  createdAt: string;
};

export type Market = {
  id: string;
  title: string;
  description: string;
  type: MarketType;
  yesDescription: string | null;
  noDescription: string | null;
  category: MarketCategory;
  status: MarketStatus;
  resolvedOutcome: BetSide | null;
  resolvedOptionId: string | null;
  startDate: string;
  endDate: string;
  yesPool: string;
  noPool: string;
  totalVolume: string;
  createdAt: string;
  resolvedAt: string | null;
  yesPrice: number;
  noPrice: number;
  options?: MarketOption[];
};

export type Bet = {
  id: string;
  side: BetSide | null;
  amount: string;
  price: string;
  payout: string | null;
  txHash: string | null;
  createdAt: string;
  userId: string;
  marketId: string;
  optionId: string | null;
  market?: Market;
  option?: MarketOption | null;
  user?: User;
};

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  adminNote: string | null;
  txHash: string | null;
  createdAt: string;
  resolvedAt: string | null;
  userId: string;
  betId: string | null;
  marketId: string | null;
  user?: Pick<User, "id" | "email" | "username">;
  bet?: Bet | null;
  market?: Pick<Market, "id" | "title"> | null;
};

export type UnsyncedMarket = { id: string; title: string };

export type StuckBet = Bet & {
  market: Pick<Market, "id" | "title" | "type" | "resolvedOutcome" | "resolvedOptionId">;
  user: Pick<User, "id" | "username">;
};

export type BalanceDrift = { id: string; username: string; dbBalance: number; onChainBalance: number };

export type DiagnosticsReport = {
  unsyncedMarkets: UnsyncedMarket[];
  stuckBets: StuckBet[];
  balanceDrift: BalanceDrift[];
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
};

export type AdminStats = {
  totalUsers: number;
  totalMarkets: number;
  openMarkets: number;
  resolvedMarkets: number;
  totalBets: number;
  totalVolume: string;
};

export type StatsHistoryPoint = {
  date: string;
  openMarkets: number;
  totalVolume: string;
  activeBets: number;
  bettors: number;
};

export type PricePoint = {
  id: string;
  yesPrice: string;
  timestamp: string;
  marketId: string;
};

export type OptionPricePoint = {
  id: string;
  price: string;
  timestamp: string;
  optionId: string;
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
