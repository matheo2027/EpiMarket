"use client";

import { useState, type SubmitEvent } from "react";
import { errorMessage } from "@/lib/api";
import { CATEGORY_LABELS, type MarketCategory } from "@/lib/types";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MarketCategory[];
const inputClass =
  "rounded-lg border border-line bg-ink px-3.5 py-2.5 text-paper outline-none focus-visible:border-brand";

export type MarketFormValues = {
  title: string;
  description: string;
  yesDescription: string;
  noDescription: string;
  category: MarketCategory;
  startDate: string;
  endDate: string;
};

export function MarketForm({
  initialValues,
  submitLabel,
  onSubmit,
}: {
  initialValues: MarketFormValues;
  submitLabel: string;
  onSubmit: (values: MarketFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof MarketFormValues>(key: K, value: MarketFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">Titre</span>
        <input required value={values.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">Description</span>
        <textarea
          required
          rows={2}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">Ce qui compte comme OUI</span>
        <textarea
          required
          rows={2}
          value={values.yesDescription}
          onChange={(e) => set("yesDescription", e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">Ce qui compte comme NON</span>
        <textarea
          required
          rows={2}
          value={values.noDescription}
          onChange={(e) => set("noDescription", e.target.value)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">Catégorie</span>
        <select
          value={values.category}
          onChange={(e) => set("category", e.target.value as MarketCategory)}
          className={inputClass}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Début</span>
          <input
            type="datetime-local"
            required
            value={values.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Clôture</span>
          <input
            type="datetime-local"
            required
            value={values.endDate}
            onChange={(e) => set("endDate", e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      {error && <p className="rounded-lg border border-no/30 bg-no-soft px-3.5 py-2.5 text-sm text-no">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 self-start rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand disabled:opacity-50"
      >
        {submitting ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
