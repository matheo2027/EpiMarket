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
  return (
    <>
      <Section title="Créer un compte et se connecter">
        <p>
          Un compte démarre automatiquement avec <strong>1000 € de portefeuille virtuel</strong>{" "}
          — aucun argent réel n&apos;est impliqué. Mot de passe oublié ? Le lien sur la page de connexion
          génère un lien de réinitialisation affiché directement (pas de vrai email envoyé).
        </p>
      </Section>

      <Section title="La page d'accueil">
        <p>
          En haut, un <strong>carousel de statistiques</strong> (marchés ouverts, volume, paris actifs,
          parieurs) sous forme de courbes navigables : glissez ou utilisez les flèches pour changer de
          statistique, déplacez le curseur sur une courbe pour voir sa valeur à une date passée — pas
          besoin de cliquer. En dessous, le marché du moment et une grille des marchés ouverts.
        </p>
      </Section>

      <Section title="Parcourir les marchés et comprendre un marché">
        <p>Filtrez par statut (Ouverts/Résolus) et catégorie. Il existe deux types de marché :</p>
        <ul className="list-disc pl-4">
          <li><strong>OUI/NON</strong> : ce qui compte comme &quot;oui&quot; et comme &quot;non&quot; est écrit sur la page — lisez-le avant de parier, c&apos;est ce qui décide qui gagne. La cote actuelle s&apos;affiche en barre de répartition.</li>
          <li><strong>Options multiples</strong> (ex. &quot;qui remporte le tournoi ?&quot;) : une ligne par option avec son pourcentage. Un seul camp peut gagner.</li>
          <li>Dans les deux cas, un graphe d&apos;évolution du prix montre comment la cote a bougé dans le temps.</li>
        </ul>
      </Section>

      <Section title="Placer un pari">
        <p>
          Choisissez votre camp (ou votre option), un montant, et un <strong>gain estimé</strong>{" "}
          s&apos;affiche avant de valider. Ce n&apos;est pas garanti : d&apos;autres personnes peuvent encore parier avant la
          clôture. Le pari n&apos;est possible que sur un marché ouvert, dans sa période active, et avec un
          solde suffisant.
        </p>
      </Section>

      <Section title="Le Profil">
        <p>
          Solde, adresse du wallet on-chain, et des statistiques : taux de réussite, gains/pertes nets,
          exposition en cours (mise sur les paris pas encore résolus, comptée à part), une courbe de
          gains/pertes cumulés, et une répartition par catégorie. En dessous, l&apos;historique des paris
          (en cours / passés), chacun avec le hash de sa transaction on-chain.
        </p>
      </Section>

      <Section title="Comment sont calculés les gains">
        <p>
          Modèle <strong>pari-mutuel</strong> (comme aux courses hippiques) : à la clôture, tout
          l&apos;argent réellement misé est reversé aux gagnants, au prorata de leur mise. Si personne
          n&apos;a parié sur le camp gagnant, tout le monde est remboursé.
        </p>
      </Section>

      <Section title="Le Classement">
        <p>
          Accessible sans être connecté, il liste les 50 meilleurs parieurs classés par gain net réalisé
          (même calcul que sur votre Profil). Seuls les paris déjà résolus comptent.
        </p>
      </Section>

      <Section title="Signaler un problème">
        <p>
          La page <strong>Support</strong> permet de créer un ticket (sujet + message). Si vous y arrivez
          depuis un message d&apos;erreur qui mentionne une transaction, le formulaire est pré-rempli
          automatiquement avec son hash.
        </p>
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
