const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid credentials": "Email ou mot de passe incorrect.",
  "Invalid email": "Adresse email invalide.",
  "Email or username already in use": "Cet email ou ce nom d'utilisateur est déjà utilisé.",
  "Username must be at least 3 characters": "Le nom d'utilisateur doit contenir au moins 3 caractères.",
  "Password must be at least 8 characters": "Le mot de passe doit contenir au moins 8 caractères.",
  "Email and password are required": "Email et mot de passe sont requis.",
  "Email is required": "L'email est requis.",
  "No account with this email": "Aucun compte ne correspond à cet email.",
  "token is required": "Lien de réinitialisation invalide.",
  "Invalid or expired reset token": "Ce lien de réinitialisation est invalide ou a expiré.",
  "Insufficient wallet balance": "Solde insuffisant pour ce montant.",
  "Market is not open for betting": "Ce marché n'accepte plus de paris.",
  "Market has not started yet": "Ce marché n'a pas encore commencé.",
  "Market betting period has ended": "La période de paris de ce marché est terminée.",
  "amount must be a positive number": "Le montant doit être un nombre positif.",
  "side must be YES or NO": "Choisissez OUI ou NON.",
  "marketId is required": "Marché invalide.",
  "Missing bearer token": "Vous devez être connecté.",
  "Invalid or expired token": "Votre session a expiré, reconnectez-vous.",
  "Market not found": "Marché introuvable.",
  "Admin access required": "Accès réservé aux administrateurs.",
  "Not allowed to view this user": "Vous n'avez pas accès à cet utilisateur.",
  "Not allowed to view this bet": "Vous n'avez pas accès à ce pari.",
  "User not found": "Utilisateur introuvable.",
  "Bet not found": "Pari introuvable.",
  "Cannot delete a user that has placed bets": "Impossible de supprimer un utilisateur qui a déjà parié.",
  "Cannot delete your own account": "Vous ne pouvez pas supprimer votre propre compte.",
  "Cannot delete a market that already has bets. Resolve it instead.":
    "Impossible de supprimer un marché qui a déjà des paris. Concluez-le plutôt.",
  "Cannot edit a resolved market": "Impossible de modifier un marché résolu.",
  "Cannot delete a resolved market": "Impossible de supprimer un marché résolu.",
  "Market is already resolved": "Ce marché est déjà résolu.",
  "Cannot void a bet on a resolved market": "Impossible d'annuler un pari sur un marché résolu.",
  "outcome must be YES or NO": "Le résultat doit être OUI ou NON.",
  "walletBalance must be a non-negative number": "Le solde doit être un nombre positif ou nul.",
  "Invalid startDate/endDate": "Dates de début/fin invalides.",
  "endDate must be after startDate": "La date de clôture doit être après la date de début.",
  "Title must be at least 3 characters": "Le titre doit contenir au moins 3 caractères.",
  "Description is required": "La description est requise.",
  "yesDescription is required": "La description du OUI est requise.",
  "noDescription is required": "La description du NON est requise.",
};

function translateError(message: string): string {
  return ERROR_MESSAGES[message] ?? message;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Une erreur est survenue.";
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, translateError(data.error ?? "Une erreur est survenue."));
  }

  return data as T;
}
