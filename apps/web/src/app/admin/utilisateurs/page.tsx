"use client";

import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import { frT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { useConfirm } from "@/lib/confirm-context";
import type { Role, User } from "@/lib/types";

const inputClass =
  "rounded-lg border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus-visible:border-brand";

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const { token } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/users", { method: "POST", token, body: { email, username, password, role } });
      setEmail("");
      setUsername("");
      setPassword("");
      setRole("USER");
      onCreated();
    } catch (err) {
      setError(errorMessage(err, frT));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Nom d&apos;utilisateur</span>
        <input
          required
          minLength={3}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Mot de passe</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Rôle</span>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
          <option value="USER">Utilisateur</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-brand disabled:opacity-50"
      >
        {submitting ? "Création…" : "Créer"}
      </button>
      {error && <p className="w-full text-sm text-no">{error}</p>}
    </form>
  );
}

function UserRow({ user, onChanged }: { user: User; onChanged: () => void }) {
  const { token, user: currentUser } = useAuth();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/users/${user.id}`, {
        method: "PATCH",
        token,
        body: { role },
      });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, frT));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Supprimer l'utilisateur",
      message: `Supprimer l'utilisateur « ${user.username} » ?`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/users/${user.id}`, { method: "DELETE", token });
      onChanged();
    } catch (err) {
      setError(errorMessage(err, frT));
    } finally {
      setBusy(false);
    }
  }

  const isSelf = user.id === currentUser?.id;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-paper">{user.username}</p>
            <span
              className={`font-mono text-[11px] uppercase tracking-wide ${user.role === "ADMIN" ? "text-brand" : "text-muted"}`}
            >
              {user.role}
            </span>
          </div>
          <p className="text-xs text-muted">{user.email}</p>
        </div>

        {!editing ? (
          <div className="flex items-center gap-4">
            <p className="font-mono text-sm tabular-nums text-paper">{Number(user.walletBalance).toFixed(2)} €</p>
            <button
              onClick={() => {
                setRole(user.role);
                setEditing(true);
              }}
              className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-paper transition-colors hover:border-brand"
            >
              Éditer
            </button>
            <button
              disabled={isSelf || busy}
              onClick={handleDelete}
              title={isSelf ? "Vous ne pouvez pas vous supprimer vous-même" : undefined}
              className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-no hover:text-no disabled:opacity-30"
            >
              Supprimer
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
              <option value="USER">Utilisateur</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              disabled={busy}
              onClick={handleSave}
              className="rounded-full bg-paper px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-brand disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-paper"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-no">{error}</p>}
    </div>
  );
}

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<{ users: User[] }>("/users", { token })
      .then((data) => setUsers(data.users))
      .catch((err) => setError(errorMessage(err, frT)));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <CreateUserForm onCreated={load} />

      <p className="text-sm text-muted">{users?.length ?? "…"} utilisateur(s)</p>
      {error && <p className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{error}</p>}

      <div className="flex flex-col gap-3">
        {users?.map((user) => (
          <UserRow key={user.id} user={user} onChanged={load} />
        ))}
      </div>
    </div>
  );
}
