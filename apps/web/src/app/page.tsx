type HealthResponse = {
  status: "ok" | "error";
  db: "connected" | "disconnected";
  message?: string;
};

async function getApiHealth(): Promise<HealthResponse> {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${apiUrl}/health`);
    return (await res.json()) as HealthResponse;
  } catch {
    return { status: "error", db: "disconnected", message: "API unreachable" };
  }
}

export default async function Home() {
  const health = await getApiHealth();
  const isOk = health.status === "ok";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Epitech Polymarket
      </h1>
      <div
        className={`rounded-full px-4 py-2 text-sm font-medium ${
          isOk
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        }`}
      >
        API: {health.status} — DB: {health.db}
      </div>
      {health.message && (
        <p className="text-sm text-zinc-500">{health.message}</p>
      )}
    </div>
  );
}
