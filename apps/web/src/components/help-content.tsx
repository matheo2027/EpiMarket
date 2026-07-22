"use client";

import { useLanguage } from "@/lib/language-context";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-display text-base font-semibold tracking-tight text-paper">{title}</h3>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-paper">
        {children}
      </div>
    </div>
  );
}

export function UserGuideContent() {
  const { t } = useLanguage();
  return (
    <>
      <Section title={t("help.section.account")}>
        <p>{t("help.account", { amount: "1000 €" })}</p>
      </Section>

      <Section title={t("help.section.home")}>
        <p>{t("help.home")}</p>
      </Section>

      <Section title={t("help.section.markets")}>
        <p>{t("help.markets.intro")}</p>
        <ul className="list-disc pl-4">
          <li>{t("help.markets.binary")}</li>
          <li>{t("help.markets.multi")}</li>
          <li>{t("help.markets.chart")}</li>
        </ul>
      </Section>

      <Section title={t("help.section.bet")}>
        <p>{t("help.bet")}</p>
      </Section>

      <Section title={t("help.section.profile")}>
        <p>{t("help.profile")}</p>
      </Section>

      <Section title={t("help.section.gains")}>
        <p>{t("help.gains")}</p>
      </Section>

      <Section title={t("help.section.classement")}>
        <p>{t("help.classement")}</p>
      </Section>

      <Section title={t("help.section.support")}>
        <p>{t("help.support")}</p>
      </Section>
    </>
  );
}

export function AdminGuideContent() {
  return (
    <>
      <Section title="Généralités">
        <p>
          Un compte Admin n&apos;a <strong>pas de portefeuille</strong> et <strong>ne peut pas parier</strong> :
          il peut créer et résoudre des marchés, donc il ne doit pas pouvoir parier dessus (conflit
          d&apos;intérêt).
        </p>
      </Section>

      <Section title="Marchés">
        <ul className="list-disc pl-4">
          <li><strong>+ Nouveau marché</strong> : titre, description, catégorie, dates, et soit les règles du &quot;oui&quot;/&quot;non&quot;, soit une liste de 3 à 6 options (une option &quot;Autre&quot; est pré-remplie en dernière position, supprimable).</li>
          <li>Le type et le nombre d&apos;options sont fixés à la création (blockchain) ; les libellés restent modifiables ensuite.</li>
          <li><strong>Éditer</strong> : impossible une fois le marché résolu.</li>
          <li><strong>Conclure</strong> : OUI/NON, ou l&apos;option gagnante — règle les gains immédiatement, action irréversible, confirmation demandée.</li>
          <li><strong>Supprimer</strong> : possible seulement sans pari et non résolu.</li>
        </ul>
      </Section>

      <Section title="Paris">
        <p>Liste de tous les paris, tous utilisateurs confondus. Un pari ne peut jamais être annulé, ni par vous ni par l&apos;utilisateur.</p>
      </Section>

      <Section title="Utilisateurs">
        <p>Créer un compte (y compris un autre admin), modifier un rôle, supprimer un utilisateur (impossible s&apos;il a déjà parié, ou pour vous-même).</p>
      </Section>

      <Section title="Tickets">
        <p>
          Les signalements envoyés via la page Support. Changez le statut (Ouvert / En cours / Résolu) et
          laissez une note, visible par l&apos;utilisateur.
        </p>
      </Section>

      <Section title="Diagnostics">
        <p>Détecte automatiquement les désaccords entre la base et la blockchain :</p>
        <ul className="list-disc pl-4">
          <li><strong>Marchés désynchronisés</strong> — absents on-chain → bouton Recréer on-chain.</li>
          <li><strong>Paris bloqués</strong> — marché résolu sans gain calculé → bouton Resynchroniser le gain.</li>
          <li><strong>Soldes désynchronisés</strong> — écart avec le solde réel on-chain → bouton Resynchroniser le solde.</li>
        </ul>
        <p>
          Juste après avoir démarré le projet, un message &quot;blockchain en cours de démarrage&quot; peut
          s&apos;afficher quelques secondes — la page réessaie automatiquement, pas besoin de recharger.
        </p>
      </Section>
    </>
  );
}
