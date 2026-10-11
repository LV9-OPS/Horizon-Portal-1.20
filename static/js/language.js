(() => {
  const COOKIE = "hzn_lang";
  const translations = {
    en: {
      "Le launcher officiel HZN Portal pour installer et gérer l'écosystème Horizon.":"The official HZN Portal launcher to install and manage the Horizon ecosystem.",
      "Votre identité Discord est utilisée pour la connexion et les droits Horizon.":"Your Discord identity is used for Horizon login and permissions.",
      "Discord est l'identité de connexion unique de Horizon Portal.":"Discord is the single sign-in identity for Horizon Portal.",
      "Reconnecter Discord":"Reconnect Discord",
      "Candidater via Discord":"Apply through Discord",
      "Accès autorisé pour ce compte.":"Access authorized for this account.",
      "Accès verrouillé.":"Access locked.",
      "Joueurs Beta uniquement":"Beta players only",
      "Créateur uniquement":"Creator only"
    },
    fr: {
      "Choose your language":"Choisissez votre langue",
      "Select your language for this session.":"Sélectionnez votre langue pour cette session.",
      "Workshop":"Workshop",
      "Creators":"Créateurs",
      "Download":"Téléchargement",
      "Account":"Compte",
      "Settings":"Paramètres",
      "Themes":"Thèmes",
      "Downloads":"Téléchargements",
      "Home":"Accueil",
      "Sign in":"Connexion",
      "Create account":"Créer un compte",
      "Beyond the Horizon":"Au-delà de l'Horizon",
      "Build beyond limits.":"Construisez au-delà des limites.",
      "A centralized home for Destiny modded projects, creators and players.":"Le point central pour les projets Destiny moddés, leurs créateurs et leurs joueurs.",
      "Explore the Workshop":"Explorer le Workshop",
      "Join Discord":"Rejoindre Discord",
      "Need help? Join Discord":"Besoin d'aide ? Rejoindre Discord",
      "Your account":"Votre compte",
      "Manage your profile, language and account access.":"Gérez votre profil, votre langue et votre accès au compte.",
      "Creator Program":"Programme Creator",
      "Publish quality Destiny modded projects and give players a clear way to discover your work.":"Publiez des projets Destiny moddés de qualité et donnez aux joueurs un moyen clair de découvrir votre travail.",
      "Horizon Portal":"Horizon Portal",
      "Install the Windows launcher and use Horizon Portal as your central entry point.":"Installez le launcher Windows et utilisez Horizon Portal comme point d'entrée central.",
      "Download the .exe":"Télécharger le .exe",
      "Version":"Version",
      "Size":"Taille",
      "Supported system":"Système compatible",
      "Quick install":"Installation rapide",
      "Inbox":"Messages",
      "Linux support is planned for a future release.":"Le support Linux est prévu pour une future version.",
      "Free Access":"Accès gratuit",
      "What is Horizon Portal?":"Qu'est-ce que Horizon Portal ?",
      "Horizon Portal brings discovery, installation and community support into one clean experience instead of scattering everything across websites and Discord channels.":"Horizon Portal rassemble découverte, installation et support communautaire dans une seule expérience claire, au lieu de disperser le contenu entre sites et serveurs Discord.",
      "Discover projects":"Découvrir les projets",
      "Check compatibility":"Vérifier la compatibilité",
      "Follow updates":"Suivre les mises à jour",
      "Install with confidence":"Installer en toute confiance",
      "Everything has a place.":"Chaque chose a sa place.",
      "Designed to keep project information visible and easy to understand.":"Conçu pour garder les informations des projets visibles et faciles à comprendre.",
      "Filter by project type.":"Filtrer par type de projet.",
      "People behind the projects.":"Les personnes derrière les projets.",
      "Discover the creators contributing content to the Horizon ecosystem.":"Découvrez les créateurs qui contribuent au contenu de l'écosystème Horizon.",
      "Creator":"Créateur",
      "View program":"Voir le programme",
      "Apply through Discord":"Candidater via Discord",
      "How publishing works":"Comment fonctionne la publication",
      "Supported project types":"Types de projets pris en charge",
      "Organized as a clear project category inside the Workshop.":"Organisé comme une catégorie de projet claire dans le Workshop.",
      "Public release files will be listed here when Horizon Portal enters distribution.":"Les fichiers de la version publique seront listés ici lorsque Horizon Portal entrera en distribution.",
      "Open download page":"Ouvrir la page de téléchargement",
      "Account tools":"Outils du compte",
      "Discord":"Discord",
      "Your Discord identity is used for Horizon login and permissions.":"Votre identité Discord est utilisée pour la connexion et les droits Horizon.",
      "Votre identité Discord est utilisée pour la connexion et les droits Horizon.":"Votre identité Discord est utilisée pour la connexion et les droits Horizon.",
      "Messages between users and creators will live here.":"Les messages entre utilisateurs et créateurs seront disponibles ici.",
      "Language":"Langue",
      "Interface preferences and account options.":"Préférences de l'interface et options du compte.",
      "Appearance":"Apparence",
      "Horizon Dark is currently the default theme.":"Horizon Dark est actuellement le thème par défaut.",
      "Horizon Art Direction.":"Direction artistique Horizon.",
      "Each theme is controlled server-side. The interface can display a locked theme, but the API never grants access without the corresponding entitlement.":"Chaque thème est contrôlé côté serveur. L'interface peut afficher un thème verrouillé, mais l'API ne délivre jamais son accès sans le droit correspondant.",
      "Accès autorisé pour ce compte.":"Accès autorisé pour ce compte.",
      "Access authorized for this account.":"Accès autorisé pour ce compte.",
      "Access locked.":"Accès verrouillé.",
      "UNLOCKED":"DÉVERROUILLÉ",
      "LOCKED":"VERROUILLÉ",
      "RELEASE":"VERSION",
      "DISCOVER":"DÉCOUVRIR",
      "CATEGORIES":"CATÉGORIES",
      "PROCESS":"PROCESSUS",
      "CONTENT":"CONTENU",
      "PROFILE":"PROFIL",
      "Platform":"Plateforme",
      "Status":"Statut",
      "Public build":"Version publique",
      "Windows 10 and Windows 11.":"Windows 10 et Windows 11.",
      "Horizon Manager is available as a Windows installer.":"Horizon Manager est disponible sous forme d'installateur Windows.",
      "Four steps. No archaeology required.":"Quatre étapes. Pas besoin d'archéologie.",
      "Le launcher officiel HZN Portal pour installer et gérer l'écosystème Horizon.":"Le launcher officiel HZN Portal pour installer et gérer l'écosystème Horizon.",
      "Download HZN Portal Launcher":"Télécharger le launcher HZN Portal",
      "Join Discord":"Rejoindre Discord",
      "Open the launcher":"Ouvrir le launcher",
      "Run the .exe":"Lancer le .exe",
      "Install Horizon Manager":"Installer Horizon Manager",
      "Download the installer":"Télécharger l'installateur",
      "Weapons":"Armes",
      "Missions":"Missions",
      "D1 Imports":"Imports D1",
      "HUD":"HUD",
      "Sandbox":"Sandbox",
      "Utilities":"Utilitaires",
      "HUD changes":"Modifications HUD",
      "Raid content":"Contenu de raid",
      "Mission content":"Contenu de missions",
      "Dawn creator pack.":"Pack du créateur Dawn.",
      "SunRise creator pack.":"Pack du créateur SunRise.",
      "Dawn":"Dawn",
      "SunRise":"SunRise",
      "Creator only":"Créateur uniquement",
      "Beta players only":"Joueurs Beta uniquement"
    }
  };  function getLang() {
    const match = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setLang(lang) {
    document.cookie = COOKIE + "=" + encodeURIComponent(lang) + "; path=/; SameSite=Lax";
  }

  function translate(root, lang) {
    if (lang !== "fr") return;
    const map = translations.fr;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    for (const textNode of nodes) {
      const parent = textNode.parentElement;
      if (!parent || ["SCRIPT","STYLE","NOSCRIPT"].includes(parent.tagName)) continue;
      const raw = textNode.nodeValue;
      const trimmed = raw.trim();
      if (!trimmed || !map[trimmed]) continue;
      textNode.nodeValue = raw.replace(trimmed, map[trimmed]);
    }
    for (const element of root.querySelectorAll("[aria-label],[title],[alt]")) {
      for (const attr of ["aria-label","title","alt"]) {
        const value = element.getAttribute(attr);
        if (value && map[value]) element.setAttribute(attr, map[value]);
      }
    }
  }  function showGate() {
    const gate = document.getElementById("language-gate");
    if (!gate) return;
    gate.hidden = false;
    document.documentElement.classList.add("language-selecting");
    gate.querySelector("[data-language='fr']")?.focus();
    gate.querySelectorAll("[data-language]").forEach(button => {
      button.addEventListener("click", () => {
        setLang(button.dataset.language === "fr" ? "fr" : "en");
        gate.hidden = true;
        document.documentElement.classList.remove("language-selecting");
        translate(document.body, getLang());
        window.location.reload();
      });
    });
  }

  function init() {
    const lang = getLang();
    if (!lang) showGate();
    else translate(document.body, lang);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();