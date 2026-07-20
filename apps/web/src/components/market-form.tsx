"use client";

import { useState, type SubmitEvent } from "react";
import { errorMessage } from "@/lib/api";
import { CATEGORY_LABELS, type MarketCategory, type MarketType } from "@/lib/types";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MarketCategory[];
const inputClass =
  "rounded-lg border border-line bg-ink px-3.5 py-2.5 text-paper outline-none focus-visible:border-brand";
const MIN_OPTIONS = 3;
const MAX_OPTIONS = 6;

export type MarketFormValues = {
  title: string;
  description: string;
  type: MarketType;
  yesDescription: string;
  noDescription: string;
  options: string[];
  category: MarketCategory;
  startDate: string;
  endDate: string;
};

export function MarketForm({
  initialValues,
  submitLabel,
  onSubmit,
  allowTypeChange = false,
  allowOptionCountChange = false,
}: {
  initialValues: MarketFormValues;
  submitLabel: string;
  onSubmit: (values: MarketFormValues) => Promise<void>;
  allowTypeChange?: boolean;
  allowOptionCountChange?: boolean;
}) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof MarketFormValues>(key: K, value: MarketFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function setOption(index: number, label: string) {
    setValues((v) => ({ ...v, options: v.options.map((o, i) => (i === index ? label : o)) }));
  }

  function addOption() {
    setValues((v) => {
      if (v.options.length >= MAX_OPTIONS) return v;
      const last = v.options[v.options.length - 1];
      if (last === "Autre") {
        return { ...v, options: [...v.options.slice(0, -1), "", "Autre"] };
      }
      return { ...v, options: [...v.options, ""] };
    });
  }

  function removeOption(index: number) {
    setValues((v) => (v.options.length <= MIN_OPTIONS ? v : { ...v, options: v.options.filter((_, i) => i !== index) }));
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
      {allowTypeChange && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Type de marché</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => set("type", "BINARY")}
              className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                values.type === "BINARY" ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-paper"
              }`}
            >
              Oui / Non
            </button>
            <button
              type="button"
              onClick={() => set("type", "MULTI")}
              className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                values.type === "MULTI" ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:text-paper"
              }`}
            >
              Options multiples
            </button>
          </div>
        </div>
      )}

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

      {values.type === "BINARY" ? (
        <>
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
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">
            Options ({MIN_OPTIONS} à {MAX_OPTIONS})
          </span>
          <div className="flex flex-col gap-2">
            {values.options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  required
                  value={option}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className={`flex-1 ${inputClass}`}
                />
                {allowOptionCountChange && values.options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    aria-label="Supprimer l'option"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-no hover:text-no"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {allowOptionCountChange && values.options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="mt-1 self-start rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-paper transition-colors hover:border-brand"
            >
              + Ajouter une option
            </button>
          )}
          {!allowOptionCountChange && (
            <p className="text-xs text-muted">Le nombre d&apos;options ne peut plus changer après la création.</p>
          )}
        </div>
      )}

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
