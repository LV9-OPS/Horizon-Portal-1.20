/* =========================================================
   HORIZON MANAGER
   Main Frontend
   ========================================================= */


/* =========================================================
   THEMES
   ========================================================= */

const HORIZON_VERSION = "1.0.0";

const THEMES = {
  destiny2: {
    name: "Destiny 2",
    logo: "Destiny2_Clean.png",
    description: "Default Horizon theme."
  },

  destiny1: {
    name: "Destiny 1",
    logo: "Destiny_Logo.png",
    description: "Art direction Destiny 1."
  },

  hive: {
    name: "Hive",
    logo: "Hive.png",
    description: "Hive art direction."
  },

  cabal: {
    name: "Cabal",
    logo: "Cabal.png",
    description: "Cabal art direction."
  },

  fallen: {
    name: "Fallen",
    logo: "Fallen.png",
    description: "Fallen art direction."
  },

  corrupted: {
    name: "Corrupted",
    logo: "Corrupted.png",
    description: "Corrupted art direction."
  },

  aria: {
    name: "Aria",
    logo: "Aria.png",
    description: "Aria art direction."
  },

  vex: {
    name: "Vex",
    requirement: "creator",
    logo: "Vex.png",
    description: "Reserved for accounts with the Creator badge."
  },

  beta: {
    name: "BETA",
    requirement: "beta",
    logo: "First_light.png",
    description: "Reserved for the 5 selected BETA accounts."
  },

  opulence: {
    name: "Opulence",
    requirement: "first",
    logo: "Opulence.png",
    description: "Reserved for people joining before Release."
  }
};

const THEME_DESCRIPTIONS = {
  opulence: {
    en: "Reserved for people joining before Release.",
    fr: "Réservé aux personnes qui rejoignent le projet avant sa sortie.",
    es: "Reservado para quienes se unan antes del lanzamiento.",
    ru: "Для тех, кто присоединится до релиза.",
    zh: "仅限正式发布前加入的用户。",
    ja: "リリース前に参加した方限定。",
    ko: "정식 출시 전에 참여한 분들 전용입니다."
  }
};

function themeDescription(key, theme) {
  return THEME_DESCRIPTIONS[key]?.[activeLanguage] || theme.description;
}


/* =========================================================
   USER
   Simulation locale
   À remplacer plus tard par l'API Horizon
   ========================================================= */

let USER = {
  authenticated: true,
  username: localStorage.getItem("horizon-username") || "",
  email: "",
  donationAmount: 0,
  creatorBadge: false,
  betaAccess: false,
  firstLightAccess: false,
  avatarDataUrl: localStorage.getItem("horizon-avatar") || "",
  deviceId: localStorage.getItem("horizon-installation-id") || crypto.randomUUID(),
  installationCredential: localStorage.getItem("horizon-installation-credential") || "",
  theme_entitlements: ["destiny2", "destiny1"]
};

localStorage.setItem("horizon-installation-id", USER.deviceId);

function ensureUsername() {
  if (USER.username) return true;
  const modal = document.getElementById("username-setup");
  const input = document.getElementById("username-setup-input");
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
  input?.focus();
  return false;
}

const storedHorizonApi = localStorage.getItem("horizon-api") || "";
const HORIZON_API = !storedHorizonApi || storedHorizonApi.includes("backend.vercel.app")
  ? "https://api.horizon-portal.xyz"
  : storedHorizonApi.replace(/\/$/, "");

function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i += 1) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x > y ? 1 : -1; }
  return 0;
}

async function checkForUpdates(showNoUpdate = true) {
  const button = document.getElementById("update-check-button");
  if (button) { button.disabled = true; button.textContent = "REFRESHING..."; }

  const syncResults = {
    account: false,
    workshop: false,
    manager: false
  };

  try {
    // Synchronize account entitlements first so Creator/BETA permissions are current.
    if (USER.installationCredential) {
      await refreshLocalEntitlements();
      syncResults.account = true;
    }

    // Refresh the public Workshop catalogue so newly approved mods appear immediately.
    try {
      await refreshWorkshop();
      syncResults.workshop = true;
    } catch (error) {
      console.warn("[Horizon] Workshop sync failed:", error);
    }

    // Check whether a newer Horizon Manager build is available.
    try {
      const response = await fetch(`${HORIZON_API}/api/v1/updates/manager`, { cache: "no-store" });
      if (!response.ok) throw new Error("Update service unavailable.");
      const data = await response.json();
      syncResults.manager = true;

      if (compareVersions(data.latest_version, HORIZON_VERSION) > 0) {
        const safeUrl = typeof data.download_url === "string" && /^https:\/\//i.test(data.download_url) ? data.download_url : "";
        if (safeUrl) await openExternal(safeUrl);
        showToast(`Horizon Manager ${data.latest_version} is available.`);
        return;
      }
    } catch (error) {
      console.warn("[Horizon] Manager update check failed:", error);
    }

    if (showNoUpdate) {
      const parts = [];
      if (syncResults.account) parts.push("Account");
      if (syncResults.workshop) parts.push("Workshop");
      if (syncResults.manager) parts.push("Manager");
      showToast(parts.length ? `Horizon synchronized: ${parts.join(" • ")}.` : "Horizon synchronization unavailable.");
    }
  } catch (error) {
    console.error("[Horizon] Synchronization failed:", error);
    if (showNoUpdate) showToast("Horizon synchronization unavailable.");
  } finally {
    if (button) { button.disabled = false; button.textContent = workshopText("checkUpdates"); }
  }
}

function accountStatus() {
  const badges = [];
  if (USER.firstLightAccess) badges.push("FIRST");
  if (USER.betaAccess) badges.push("BETA");
  if (USER.creatorBadge) badges.push("CREATOR");
  return badges.length ? badges.join(" • ") : "Guest";
}

function updateProfileUI() {
  const initial = accountStatus().charAt(0).toUpperCase() || "G";
  const avatarMarkup = USER.avatarDataUrl
    ? `<img src="${USER.avatarDataUrl}" alt="" draggable="false">`
    : initial;

  document.getElementById("top-username")?.replaceChildren(document.createTextNode(USER.username || "Guest"));
  document.getElementById("sidebar-username")?.replaceChildren(document.createTextNode(accountStatus()));
  document.getElementById("top-account-status")?.replaceChildren(document.createTextNode(accountStatus()));
  document.getElementById("sidebar-account-status")?.replaceChildren(document.createTextNode(accountStatus()));
  document.getElementById("top-avatar")?.replaceChildren();
  document.getElementById("sidebar-avatar")?.replaceChildren();
  document.getElementById("top-avatar")?.insertAdjacentHTML("beforeend", avatarMarkup);
  document.getElementById("sidebar-avatar")?.insertAdjacentHTML("beforeend", avatarMarkup);
  const creatorNav = document.getElementById("creator-top-nav");
  if (creatorNav) creatorNav.hidden = !USER.creatorBadge;
}

function applyLauncherEntitlements(data = {}) {
  const serverEntitlements = new Set(
    Array.isArray(data.entitlements)
      ? data.entitlements.map(value => String(value).trim().toLowerCase())
      : []
  );

  if (typeof data.entitlement === "string" && data.entitlement.trim()) {
    serverEntitlements.add(data.entitlement.trim().toLowerCase());
  }

  USER.betaAccess = Boolean(data.beta_access) || serverEntitlements.has("beta");
  USER.creatorBadge = Boolean(data.creator_badge) || serverEntitlements.has("creator");
  USER.firstLightAccess = Boolean(data.first_light_access) || serverEntitlements.has("first");

  const themeEntitlements = [
    "destiny2", "destiny1", "hive", "cabal", "fallen", "corrupted", "aria"
  ];

  if (USER.creatorBadge || serverEntitlements.has("vex")) themeEntitlements.push("vex");
  if (USER.betaAccess || serverEntitlements.has("beta")) themeEntitlements.push("beta");
  if (USER.firstLightAccess || serverEntitlements.has("opulence")) themeEntitlements.push("opulence");

  USER.theme_entitlements = [...new Set(themeEntitlements)];
}

async function refreshLocalEntitlements() {
  if (!USER.installationCredential) return;
  try {
    const response = await fetch(`${HORIZON_API}/api/launcher/state`, { headers: { Authorization: `Bearer ${USER.installationCredential}` } });
    if (!response.ok) return;
    const data = await response.json();
    if (data.installation_id) {
      USER.deviceId = data.installation_id;
      localStorage.setItem("horizon-installation-id", USER.deviceId);
    }
    applyLauncherEntitlements(data);
    if (data.installation_credential) {
      USER.installationCredential = data.installation_credential;
      localStorage.setItem("horizon-installation-credential", data.installation_credential);
    }
    USER.authenticated = true;
    updateProfileUI();
  if (activeTheme === "opulence" && !USER.firstLightAccess) setTheme("destiny1");
    else if (currentRoute === "themes") render("themes");
  } catch {
    // Guest mode remains fully usable when the API is unavailable.
  }
}async function redeemCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) {
    showToast("Enter a redeem code.");
    return;
  }

  try {
    const response = await fetch(`${HORIZON_API}/api/launcher/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: normalized, installation_id: USER.deviceId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Redeem failed.");

    if (data.installation_credential) {
      USER.installationCredential = data.installation_credential;
      localStorage.setItem("horizon-installation-credential", data.installation_credential);
    }
    USER.authenticated = true;
    applyLauncherEntitlements(data);

    updateProfileUI();
    render(currentRoute);    showToast(data.message || "Code redeemed.");
  } catch (error) {
    console.error("[Horizon] Redeem failed:", error);
    showToast(error?.message || "Redeem failed.");
  }
}

let guestInstallPromise = null;
async function ensureGuestInstallation() {
  if (USER.installationCredential) return true;
  if (guestInstallPromise) return guestInstallPromise;

  guestInstallPromise = (async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`${HORIZON_API}/api/launcher/guest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ installation_id: USER.deviceId })
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 409 && attempt === 0) {
          USER.deviceId = crypto.randomUUID();
          localStorage.setItem("horizon-installation-id", USER.deviceId);
          continue;
        }
        if (!response.ok || !data.installation_credential) return false;
        USER.deviceId = data.installation_id || USER.deviceId;
        USER.installationCredential = data.installation_credential;
        localStorage.setItem("horizon-installation-id", USER.deviceId);
        localStorage.setItem("horizon-installation-credential", USER.installationCredential);
        await refreshLocalEntitlements();
        return true;
      } catch (error) {
        console.warn("[Horizon] Guest installation setup failed:", error);
        return false;
      }
    }
    return false;
  })();

  try {
    return await guestInstallPromise;
  } finally {
    guestInstallPromise = null;
  }
}

function setLocalAvatar(file) {
  if (!file) return;
  const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
  if (!file.type.startsWith("image/")) {
    showToast("Select an image file.");
    return;
  }
  if (file.size > MAX_AVATAR_SIZE) {
    showToast("Profile image must be 2 MB or smaller.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    USER.avatarDataUrl = String(reader.result || "");
    localStorage.setItem("horizon-avatar", USER.avatarDataUrl);
    updateProfileUI();
    render(currentRoute);
    showToast("Profile picture updated.");
  };
  reader.readAsDataURL(file);
}

/* =========================================================
   PROJECTS
   ========================================================= */

const PROJECTS = [
  {
    name: "SunRise",
    type: "Modding environment",
    description: "Official SunRise installation guide.",
    url: "https://projectsunrise.dev/guides/installing/"
  },

  {
    name: "Dawn",
    type: "Open-source project",
    description: "Official Dawn GitHub repository.",
    url: "https://github.com/isinternets/Dawn"
  },
  {
    name: "Sundial",
    type: "Open-source project",
    description: "Official Sundial GitHub repository.",
    url: "https://github.com/kylethmpsn/sundial"
  }
];


/* =========================================================
   DOM
   ========================================================= */

const page = document.getElementById("page");
const title = document.getElementById("page-title");
const eyebrow = document.getElementById("eyebrow");
const searchWrap = document.getElementById("search-wrap");
const searchInput = document.getElementById("library-search");
const toast = document.getElementById("toast");
installEncodingGuard();

/* =========================================================
   CUSTOM WINDOW CHROME
   ========================================================= */

async function setupWindowControls() {
  const invoke = window.__TAURI__?.core?.invoke;
  const tauriWindow = window.__TAURI__?.window?.getCurrentWindow?.();

  const call = async (command) => {
    if (invoke) {
      await invoke(command);
      return;
    }
    if (tauriWindow) {
      if (command === "window_minimize") return tauriWindow.minimize();
      if (command === "window_toggle_maximize") return tauriWindow.toggleMaximize();
      if (command === "window_close") return tauriWindow.close();
    }
  };

  document.getElementById("window-minimize")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    call("window_minimize");
  });

  document.getElementById("window-maximize")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    call("window_toggle_maximize");
  });

  document.getElementById("window-close")?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    call("window_close");
  });

  if (tauriWindow) {
    document.querySelectorAll("[data-tauri-drag-region]").forEach(region => {
      region.addEventListener("mousedown", event => {
        if (event.button !== 0 || event.target.closest(".window-control")) return;
        tauriWindow.startDragging();
      });
    });
  }

  document.querySelectorAll(".window-control").forEach(control => {
    control.addEventListener("mousedown", event => event.stopPropagation());
  });
}

setupWindowControls();


/* =========================================================
   STATE
   ========================================================= */

let currentRoute = "home";
let localProjects = JSON.parse(localStorage.getItem("horizon-local-projects") || "[]");
let WORKSHOP_ITEMS = [];
let workshopSort = "date";
const tauriInvoke = window.__TAURI__?.core?.invoke;

async function chooseLocalExecutable(kind, label) {
  const dialog = window.__TAURI__?.dialog;
  if (typeof dialog?.open !== "function") {
    showToast("Native file picker unavailable.");
    return;
  }

  try {
    const selected = await dialog.open({
      multiple: false,
      directory: false,
      title: `Select ${label} executable`,
      filters: [{ name: "Executable", extensions: ["exe"] }]
    });

    if (!selected || Array.isArray(selected)) return;

    const executable = String(selected);
    const fileName = executable.split(/[\\/]/).pop()?.toLowerCase() || "";
    const expected = {
      destiny2: ["destiny2.exe", "destiny2"],
      dawn: ["dawn.exe", "dawn"],
      sunrise: ["sunrise.exe", "sunrise"],
      sundial: ["sundial.exe", "sundial"]
    }[kind] || [];

    if (!expected.includes(fileName)) {
      showToast(`Select the real ${label} executable.`);
      return;
    }

    const directory = executable.replace(/[\\/][^\\/]+$/, "");
    localProjects = [
      ...localProjects.filter(item => item.id !== kind),
      { id: kind, name: label, kind, executable, directory, source: "manual-selection" }
    ];
    localStorage.setItem("horizon-local-projects", JSON.stringify(localProjects));
    render(currentRoute);
    showToast(`${label} installation saved.`);
  } catch (error) {
    console.error("[Horizon] File selection failed:", error);
    showToast("Unable to select this executable.");
  }
}

async function launchLocalProject(executable) {
  if (typeof tauriInvoke !== "function") {
    showToast("Native launcher unavailable.");
    return;
  }
  try {
    await tauriInvoke("launch_project", { executable });
    showToast("Project launched.");
  } catch (error) {
    console.error("[Horizon] Project launch failed:", error);
    showToast(error?.toString() || "Unable to launch project.");
  }
}

async function openLocalProjectFolder(directory) {
  if (typeof tauriInvoke !== "function") return;
  try {
    await tauriInvoke("open_project_folder", { path: directory });
  } catch (error) {
    console.error("[Horizon] Folder open failed:", error);
    showToast("Unable to open project folder.");
  }
}

const LANGUAGES = {
  en: { name: "English", flag: "EN" },
  fr: { name: "Français", flag: "FR" },
  es: { name: "Español", flag: "ES" },
  ru: { name: "Русский", flag: "RU" },
  zh: { name: "简体中文", flag: "ZH" },
  ja: { name: "日本語", flag: "JA" },
  ko: { name: "한국어", flag: "KO" }
};

const LANGUAGE_FLAGS = {
  en: "gb.svg",
  fr: "fr.svg",
  es: "es.svg",
  ru: "ru.svg",
  zh: "cn.svg",
  ja: "jp.svg",
  ko: "kr.svg"
};

let activeLanguage = localStorage.getItem("horizon-language") || "en";
if (!LANGUAGES[activeLanguage]) activeLanguage = "en";

document.documentElement.lang = activeLanguage;

let savedTheme = localStorage.getItem("horizon-theme");
if (!savedTheme || savedTheme === "destiny2") {
  savedTheme = "destiny1";
  localStorage.setItem("horizon-theme", savedTheme);
}
document.documentElement.dataset.theme = savedTheme;

let activeTheme = document.documentElement.dataset.theme;

if (activeTheme === "opulence" && !USER.installationCredential) {
  activeTheme = "destiny1";
  localStorage.setItem("horizon-theme", activeTheme);
}

document.documentElement.dataset.theme = activeTheme;

let accentColor = localStorage.getItem("horizon-accent") || "";
if (accentColor) document.documentElement.style.setProperty("--user-accent", accentColor);


/* =========================================================
   ASSETS
   ========================================================= */

/*
   On utilise URL() plutôt qu'un chemin HTML brut.
   Cela permet de résoudre correctement les assets
   depuis le dossier frontendDist de Tauri.
*/

function getThemeAsset(filename) {
  if (!filename) {
    return "";
  }

  return new URL(
    `assets/themes/${encodeURIComponent(filename)}`,
    window.location.href
  ).href;
}


/* =========================================================
   HTML SAFETY
   ========================================================= */

function repairMojibake(value) {
  let output = String(value);
  const cp1252 = {
    0x20AC: 0x80, 0x201A: 0x82, 0x192: 0x83, 0x201E: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x2C6: 0x88,
    0x2030: 0x89, 0x160: 0x8A, 0x2039: 0x8B, 0x152: 0x8C,
    0x17D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
    0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x2DC: 0x98, 0x2122: 0x99, 0x161: 0x9A, 0x203A: 0x9B,
    0x153: 0x9C, 0x17E: 0x9E, 0x178: 0x9F
  };
  for (let pass = 0; pass < 3; pass += 1) {
    if (!/(?:[ÃÂð]|[ãâ][^\x00-\x7F])/.test(output)) break;
    const bytes = [];
    let convertible = true;
    for (const character of output) {
      const code = character.codePointAt(0);
      if (code <= 0xFF) {
        bytes.push(code);
      } else if (cp1252[code] !== undefined) {
        bytes.push(cp1252[code]);
      } else {
        convertible = false;
        break;
      }
    }
    if (!convertible) break;
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
    if (repaired === output) break;
    output = repaired;
  }
  return output;
}

function repairRenderedText(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const repaired = repairMojibake(node.nodeValue);
    if (repaired !== node.nodeValue) node.nodeValue = repaired;
  });
}

function installEncodingGuard() {
  if (!document.body || document.body.dataset.encodingGuard === "1") return;
  document.body.dataset.encodingGuard = "1";
  const observer = new MutationObserver(() => repairRenderedText(document.body));
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  repairRenderedText(document.body);
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]
  );
}


/* =========================================================
   THEME ACCESS
   ========================================================= */

function canUseTheme(theme) {
  if (!theme) {
    return false;
  }

  if (theme.requirement === "creator") {
    return USER.authenticated && USER.theme_entitlements.includes("vex");
  }

  if (theme.requirement === "beta") {
    return USER.authenticated && USER.theme_entitlements.includes("beta");
  }

  if (theme.requirement === "first") {
    return USER.authenticated && USER.theme_entitlements.includes("opulence");
  }

  // Any theme without a special requirement is public.
  return !theme.requirement;
}


function requirementLabel(theme) {
  if (!theme) {
    return languageText("locked");
  }

  const standardThemes = ["destiny2", "destiny1", "hive", "cabal", "fallen", "corrupted", "aria"];

  if (standardThemes.includes(theme.id || theme.slug || "")) {
    return "";
  }

  if (theme.requirement === "creator") {
    return languageText("creator");
  }

  if (theme.requirement === "beta") {
    return languageText("betaSelected");
  }

  if (theme.requirement === "first") {
    return "First Light code";
  }

  return languageText("locked");
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}


/* =========================================================
   EXTERNAL LINKS
   ========================================================= */

async function openExternal(url) {
  if (!url) return;

  try {
    const openUrl = window.__TAURI__?.opener?.openUrl;
    if (typeof openUrl === "function") {
      await openUrl(url);
      return;
    }
  } catch (error) {
    console.error("[Horizon] Impossible d'ouvrir le lien externe:", error);
  }

  window.open(url, "_blank");
}


/* =========================================================
   THEME IMAGE
   ========================================================= */

function createThemeLogo(theme) {
  if (!theme || !theme.logo) return "";

  const key = Object.entries(THEMES).find(([, value]) => value === theme)?.[0] || "";
  const artMap = {
    destiny2: "destiny2-art.png",
    destiny1: "destiny2-art.png",
    hive: "hive-art.png",
    cabal: "cabal-art.png",
    fallen: "fallen-art.png",
    corrupted: "corrupted-art.png",
    aria: "aria-art.png",
    vex: "vex-art.png",
    beta: "beta-art-fixed.png",
    opulence: "opulence-art.png"
  };

  // Use normalized transparent derivatives for consistent framing.
  // The original source artwork remains untouched.
  const logoMap = {
    destiny2: "Destiny2_Clean-clean.png",
    destiny1: "Destiny_Logo-clean.png",
    hive: "Hive-clean.png",
    cabal: "Cabal-clean.png",
    fallen: "Fallen-clean.png",
    corrupted: "Corrupted-clean.png",
    aria: "Aria-clean.png",
    vex: "Vex-clean.png",
    beta: "First_light-clean.png",
    opulence: "Opulence-clean.png"
  };

  const src = getThemeAsset(logoMap[key] || theme.logo);
  const art = artMap[key] ? getThemeAsset(artMap[key]) : "";

  return `
    <div class="theme-logo-wrap theme-logo-wrap--${escapeHtml(key)}">
      <div class="theme-art" style="background-image:url('${art}')"></div>
      <div class="theme-logo-halo"></div>
      <img class="theme-logo" src="${src}" alt="${escapeHtml(theme.name)}"
        loading="eager" draggable="false" data-theme-image="${escapeHtml(theme.logo)}"
        onerror="this.classList.add('theme-image-error');">
      <span class="theme-logo-scanline" aria-hidden="true"></span>
    </div>
  `;
}


const THEME_FRAME = {
  destiny2: { faction:"HORIZON", designation:"GUARDIAN SYSTEM", glyph:"✦", sub:"NEUTRAL LIGHT" },
  destiny1: { faction:"DESTINY", designation:"GOLDEN AGE ARCHIVE", glyph:"â—ˆ", sub:"OLD TOWER // ARCHIVE" },
  hive: { faction:"HIVE", designation:"THRONE WORLD", glyph:"☽", sub:"BROOD PROTOCOL // SOULFIRE" },
  cabal: { faction:"CABAL", designation:"LEGION COMMAND", glyph:"â—†", sub:"ARMOR // WAR COUNCIL" },
  fallen: { faction:"FALLEN", designation:"HOUSE NETWORK", glyph:"⌁", sub:"ETHER // SALVAGE GRID" },
  corrupted: { faction:"TAKEN", designation:"ASCENDANT ANOMALY", glyph:"â—‰", sub:"BLIGHT // PARACOSMIC SIGNAL" },
  aria: { faction:"ARIA", designation:"COMBAT FRAME", glyph:"â–²", sub:"REDLINE // ACTIVE ENGAGEMENT" },
  vex: { faction:"VEX", designation:"SIMULATION CORE", glyph:"⬡", sub:"MIND // PATTERN ENGINE" },
  beta: { faction:"HORIZON", designation:"BETA // FIRST LIGHT", glyph:"â—‡", sub:"EXPERIMENTAL // BUILD 00" }
};

function renderThemeFrame() {
  const t = THEME_FRAME[activeTheme] || THEME_FRAME.destiny2;

  return `
    <div class="theme-frame" data-faction="${escapeHtml(activeTheme)}">
      <div class="theme-frame-noise"></div>
      <div class="theme-frame-grid"></div>
      <div class="theme-frame-sigil">${escapeHtml(t.glyph)}</div>
      <div class="theme-frame-copy">
        <span class="theme-frame-kicker">${escapeHtml(t.faction)}</span>
        <strong>${escapeHtml(t.designation)}</strong>
        <small>${escapeHtml(t.sub)}</small>
      </div>
      <div class="theme-frame-readout">
        <span>HZN // ${HORIZON_VERSION}</span>
        <i></i>
        <span>ONLINE</span>
      </div>
    </div>
  `;
}


/* =========================================================
   SET THEME
   ========================================================= */

const LANGUAGE_LABELS = {
  en: { home:"Home", workshop:"Workshop", library:"Library", downloads:"Downloads", themes:"Themes", settings:"Settings", account:"Account", application:"APPLICATION", language:"Language", languageHint:"Choose the interface language.", theme:"Theme", change:"Change", accent:"Accent color", accentHint:"Customize the main interface color.", search:"Search", searchHint:"Active only in Library", active:"ACTIVE", version:"Version", windows:"Windows x64", configuration:"Manager language and application settings.", openWorkshop:"Open Workshop", openLibrary:"Open Library", directProjectAccess:"Direct access to projects and their official resources.", findInstalled:"Find your installed content and search here.", changeVisualIdentity:"Change the Manager's complete visual identity.", checkUpdates:"Check for updates" },
  fr: { home:"Accueil", workshop:"Workshop", library:"Library", downloads:"Téléchargements", themes:"Thèmes", settings:"Paramètres", account:"Compte", application:"APPLICATION", language:"Langue", languageHint:"Choisissez la langue de l'interface.", theme:"Thème", change:"Changer", search:"Recherche", searchHint:"Active uniquement dans Library", active:"ACTIF", version:"Version", windows:"Windows x64", configuration:"Langue du Manager et paramètres de l'application.", accent:"Couleur d'accent", accentHint:"Personnalisez la couleur principale de l'interface.", openWorkshop:"Ouvrir le Workshop", openLibrary:"Ouvrir la Library", directProjectAccess:"Accès direct aux projets et à leurs ressources officielles.", findInstalled:"Retrouvez vos contenus installés et recherchez ici.", changeVisualIdentity:"Changez l'identité visuelle complète du Manager." },
  es: { home:"Inicio", workshop:"Workshop", library:"Biblioteca", downloads:"Descargas", themes:"Temas", settings:"Ajustes", account:"Cuenta", application:"APLICACIÓN", language:"Idioma", languageHint:"Elige el idioma de la interfaz.", theme:"Tema", change:"Cambiar", search:"Búsqueda", searchHint:"Activa solo en Library", active:"ACTIVO", version:"Versión", windows:"Windows x64", configuration:"Idioma del Manager y ajustes de la aplicación.", accent:"Color de acento", accentHint:"Personaliza el color principal de la interfaz.", openWorkshop:"Abrir Workshop", openLibrary:"Abrir Biblioteca", directProjectAccess:"Acceso directo a los proyectos y sus recursos oficiales.", findInstalled:"Encuentra tu contenido instalado y busca aquí.", changeVisualIdentity:"Cambia la identidad visual completa del Manager." },
  ru: { home:"Главная", workshop:"Workshop", library:"Библиотека", downloads:"Загрузки", themes:"Темы", settings:"Настройки", account:"Аккаунт", application:"ПРИЛОЖЕНИЕ", language:"Язык", languageHint:"Выберите язык интерфейса.", theme:"Тема", change:"Изменить", search:"Поиск", searchHint:"Доступен только в Library", active:"АКТИВНО", version:"Версия", windows:"Windows x64", configuration:"Язык Manager и настройки приложения.", accent:"Цвет акцента", accentHint:"Настройте основной цвет интерфейса.", openWorkshop:"Открыть Workshop", openLibrary:"Открыть библиотеку", directProjectAccess:"Прямой доступ к проектам и их официальным ресурсам.", findInstalled:"Находите установленный контент и выполняйте поиск здесь.", changeVisualIdentity:"Измените полную визуальную идентичность Manager." },
  zh: { home:"首页", workshop:"Workshop", library:"资料库", downloads:"下载", themes:"主题", settings:"设置", account:"账户", application:"应用程序", language:"语言", languageHint:"选择界面语言。", theme:"主题", change:"更改", search:"搜索", searchHint:"仅在 Library 中启用", active:"启用", version:"版本", windows:"Windows x64", configuration:"Manager 语言和应用设置。", accent:"强调色", accentHint:"自定义界面的主色。", openWorkshop:"打开 Workshop", openLibrary:"打开资料库", directProjectAccess:"直接访问项目及其官方资源。", findInstalled:"查找已安装内容并在此搜索。", changeVisualIdentity:"更改 Manager 的完整视觉风格。" },
  ja: { home:"ホーム", workshop:"Workshop", library:"ライブラリ", downloads:"ダウンロード", themes:"テーマ", settings:"設定", account:"アカウント", application:"アプリケーション", language:"言語", languageHint:"インターフェースの言語を選択します。", theme:"テーマ", change:"変更", search:"検索", searchHint:"Library のみで有効", active:"有効", version:"バージョン", windows:"Windows x64", configuration:"Manager の言語とアプリ設定。", accent:"アクセントカラー", accentHint:"インターフェースのメインカラーを変更します。", openWorkshop:"Workshop を開く", openLibrary:"ライブラリを開く", directProjectAccess:"プロジェクトと公式リソースへ直接アクセスします。", findInstalled:"インストール済みコンテンツを確認し、ここで検索できます。", changeVisualIdentity:"Manager のビジュアルアイデンティティ全体を変更します。" },
  ko: { home:"홈", workshop:"Workshop", library:"라이브러리", downloads:"다운로드", themes:"테마", settings:"설정", account:"계정", application:"애플리케이션", language:"언어", languageHint:"인터페이스 언어를 선택하세요.", theme:"테마", change:"변경", search:"검색", searchHint:"Library에서만 활성화", active:"활성", version:"버전", windows:"Windows x64", configuration:"Manager 언어 및 애플리케이션 설정.", accent:"강조 색상", accentHint:"인터페이스의 기본 색상을 사용자 지정합니다." }
};

Object.assign(LANGUAGE_LABELS.en, {
  home:"Home", workshop:"Workshop", library:"Library", downloads:"Downloads", themes:"Themes", settings:"Settings", account:"Account",
  application:"APPLICATION", language:"Language", languageHint:"Choose the interface language.", theme:"Theme", change:"Change",
  accent:"Accent color", accentHint:"Customize the main interface color.", search:"Search", searchHint:"Active only in Library",
  active:"ACTIVE", version:"Version", windows:"Windows x64", configuration:"Manager language and application settings.",
  openWorkshop:"Open Workshop", openLibrary:"Open Library", directProjectAccess:"Direct access to projects and their official resources.",
  findInstalled:"Find your installed content and search here.", changeVisualIdentity:"Change the Manager's complete visual identity."
});
Object.assign(LANGUAGE_LABELS.fr, {
  home:"Accueil", workshop:"Workshop", library:"Bibliothèque", downloads:"Téléchargements", themes:"Thèmes", settings:"Paramètres", account:"Compte",
  application:"APPLICATION", language:"Langue", languageHint:"Choisissez la langue de l'interface.", theme:"Thème", change:"Changer",
  accent:"Couleur d'accent", accentHint:"Personnalisez la couleur principale de l'interface.", search:"Recherche",
  searchHint:"Active uniquement dans la Bibliothèque", active:"ACTIF", version:"Version", windows:"Windows x64",
  configuration:"Langue du Manager et paramètres de l'application.", openWorkshop:"Ouvrir le Workshop", openLibrary:"Ouvrir la Bibliothèque",
  directProjectAccess:"Accès direct aux projets et à leurs ressources officielles.", findInstalled:"Retrouvez vos contenus installés et recherchez ici.",
  changeVisualIdentity:"Changez l'identité visuelle complète du Manager."
});
Object.assign(LANGUAGE_LABELS.es, {
  home:"Inicio", workshop:"Workshop", library:"Biblioteca", downloads:"Descargas", themes:"Temas", settings:"Ajustes", account:"Cuenta",
  application:"APLICACIÓN", language:"Idioma", languageHint:"Elige el idioma de la interfaz.", theme:"Tema", change:"Cambiar",
  accent:"Color de acento", accentHint:"Personaliza el color principal de la interfaz.", search:"Búsqueda", searchHint:"Activa solo en la Biblioteca",
  active:"ACTIVO", version:"Versión", windows:"Windows x64", configuration:"Idioma del Manager y ajustes de la aplicación.",
  openWorkshop:"Abrir Workshop", openLibrary:"Abrir Biblioteca", directProjectAccess:"Acceso directo a los proyectos y sus recursos oficiales.",
  findInstalled:"Encuentra tu contenido instalado y busca aquí.", changeVisualIdentity:"Cambia la identidad visual completa del Manager."
});
Object.assign(LANGUAGE_LABELS.ru, {
  home:"Главная", workshop:"Workshop", library:"Библиотека", downloads:"Загрузки", themes:"Темы", settings:"Настройки", account:"Аккаунт",
  application:"ПРИЛОЖЕНИЕ", language:"Язык", languageHint:"Выберите язык интерфейса.", theme:"Тема", change:"Изменить",
  accent:"Цвет акцента", accentHint:"Настройте основной цвет интерфейса.", search:"Поиск", searchHint:"Активно только в Библиотеке",
  active:"АКТИВНО", version:"Версия", windows:"Windows x64", configuration:"Язык Manager и настройки приложения.",
  openWorkshop:"Открыть Workshop", openLibrary:"Открыть библиотеку", directProjectAccess:"Прямой доступ к проектам и их официальным ресурсам.",
  findInstalled:"Найдите установленный контент и выполняйте поиск здесь.", changeVisualIdentity:"Измените полный визуальный стиль Manager."
});
Object.assign(LANGUAGE_LABELS.zh, {
  home:"首页", workshop:"Workshop", library:"资料库", downloads:"下载", themes:"主题", settings:"设置", account:"账户",
  application:"应用程序", language:"语言", languageHint:"选择界面语言。", theme:"主题", change:"更改",
  accent:"强调色", accentHint:"自定义界面的主要颜色。", search:"搜索", searchHint:"仅在资料库中启用",
  active:"已启用", version:"版本", windows:"Windows x64", configuration:"Manager 语言和应用程序设置。",
  openWorkshop:"打开 Workshop", openLibrary:"打开资料库", directProjectAccess:"直接访问项目及其官方资源。",
  findInstalled:"查找已安装内容并在此搜索。", changeVisualIdentity:"更改 Manager 的完整视觉风格。"
});
Object.assign(LANGUAGE_LABELS.ja, {
  home:"ホーム", workshop:"Workshop", library:"ライブラリ", downloads:"ダウンロード", themes:"テーマ", settings:"設定", account:"アカウント",
  application:"アプリケーション", language:"言語", languageHint:"インターフェースの言語を選択します。", theme:"テーマ", change:"変更",
  accent:"アクセントカラー", accentHint:"インターフェースのメインカラーを変更します。", search:"検索", searchHint:"ライブラリでのみ有効",
  active:"有効", version:"バージョン", windows:"Windows x64", configuration:"Manager の言語とアプリケーション設定。",
  openWorkshop:"Workshop を開く", openLibrary:"ライブラリを開く", directProjectAccess:"プロジェクトと公式リソースへ直接アクセスします。",
  findInstalled:"インストール済みコンテンツを確認して検索します。", changeVisualIdentity:"Manager の完全なビジュアルスタイルを変更します。"
});
Object.assign(LANGUAGE_LABELS.ko, {
  home:"홈", workshop:"Workshop", library:"라이브러리", downloads:"다운로드", themes:"테마", settings:"설정", account:"계정",
  application:"애플리케이션", language:"언어", languageHint:"인터페이스 언어를 선택하세요.", theme:"테마", change:"변경",
  accent:"강조 색상", accentHint:"인터페이스의 기본 색상을 사용자 지정합니다.", search:"검색", searchHint:"라이브러리에서만 활성화",
  active:"활성", version:"버전", windows:"Windows x64", configuration:"Manager 언어 및 애플리케이션 설정.",
  openWorkshop:"Workshop 열기", openLibrary:"라이브러리 열기", directProjectAccess:"프로젝트와 공식 리소스에 직접 접근합니다.",
  findInstalled:"설치된 콘텐츠를 찾고 여기에서 검색합니다.", changeVisualIdentity:"Manager의 전체 시각 스타일을 변경합니다."
});

function setAccent(color) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
  accentColor = color;
  localStorage.setItem("horizon-accent", color);
  document.documentElement.style.setProperty("--user-accent", color);
  showToast(`Accent ${color}`);
}

function setLanguage(language) {
  if (!LANGUAGES[language]) return;
  activeLanguage = language;
  localStorage.setItem("horizon-language", language);
  document.documentElement.lang = language;
  showToast(`${LANGUAGES[language].flag} ${LANGUAGES[language].name}`);
  render(currentRoute);
}

const EXTRA_LABELS = {
  en: { open:"Open", noResults:"No results", noDownloads:"No active downloads", noDownloadsDescription:"There are currently no downloads.", available:"Available", locked:"Locked", free:"Free", access:"Access:", donor1:"Donor ≥ €1", donor5:"Donor ≥ €5", donor10:"Donor ≥ €10", creator:"Creator badge", betaSelected:"Selected for BETA", searchOnly:"Search is available only in Library.", accountDescription:"Theme entitlements will be linked to your Horizon account when the authentication API is connected.", donations:"Donations", storedLocally:"registered locally", badgeDetected:"Badge detected", notDetected:"Not detected", donator:"DONATOR", freeUser:"FREE", creatorStatus:"CREATOR", online:"ONLINE" },
  fr: { open:"Ouvrir", noResults:"Aucun résultat", noDownloads:"Aucun téléchargement actif", noDownloadsDescription:"Aucun téléchargement n'est actuellement disponible.", available:"Disponible", locked:"Verrouillé", free:"Gratuit", access:"Accès :", donor1:"Donateur ≥ 1 €", donor5:"Donateur ≥ 5 €", donor10:"Donateur ≥ 10 €", creator:"Badge Creator", betaSelected:"Sélectionné pour la BETA", searchOnly:"La recherche est disponible uniquement dans la bibliothèque.", accountDescription:"Les droits des thèmes seront liés à votre compte Horizon lorsque l'API d'authentification sera connectée.", donations:"Dons", storedLocally:"enregistrés localement", badgeDetected:"Badge détecté", notDetected:"Non détecté", donator:"DONATEUR", freeUser:"GRATUIT", creatorStatus:"CREATOR", online:"EN LIGNE" },
  es: { open:"Abrir", noResults:"Sin resultados", noDownloads:"No hay descargas activas", noDownloadsDescription:"Actualmente no hay descargas.", available:"Disponible", locked:"Bloqueado", free:"Gratis", access:"Acceso:", donor1:"Donante ≥ 1 €", donor5:"Donante ≥ 5 €", donor10:"Donante ≥ 10 €", creator:"Insignia Creator", betaSelected:"Seleccionado para la BETA", searchOnly:"La búsqueda solo está disponible en la biblioteca.", accountDescription:"Los permisos de los temas se vincularán a tu cuenta de Horizon cuando se conecte la API de autenticación.", donations:"Donaciones", storedLocally:"registrados localmente", badgeDetected:"Insignia detectada", notDetected:"No detectada", donator:"DONANTE", freeUser:"GRATIS", creatorStatus:"CREATOR", online:"EN LÍNEA" },
  ru: { open:"Открыть", noResults:"Нет результатов", noDownloads:"Нет активных загрузок", noDownloadsDescription:"Сейчас загрузок нет.", available:"Доступно", locked:"Заблокировано", free:"Бесплатно", access:"Доступ:", donor1:"Донор ≥ 1 €", donor5:"Донор ≥ 5 €", donor10:"Донор ≥ 10 €", creator:"Значок Creator", betaSelected:"Выбрано для BETA", searchOnly:"Поиск доступен только в библиотеке.", accountDescription:"Права на темы будут связаны с аккаунтом Horizon после подключения API аутентификации.", donations:"Пожертвования", storedLocally:"сохранено локально", badgeDetected:"Значок обнаружен", notDetected:"Не обнаружен", donator:"ДОНОР", freeUser:"БЕСПЛАТНО", creatorStatus:"CREATOR", online:"В СЕТИ" },
  zh: { open:"打开", noResults:"没有结果", noDownloads:"没有活动下载", noDownloadsDescription:"目前没有下载。", available:"可用", locked:"已锁定", free:"免费", access:"访问权限:", donor1:"捐赠者 ≥ €1", donor5:"捐赠者 ≥ €5", donor10:"捐赠者 ≥ €10", creator:"Creator 徽章", betaSelected:"BETA 入选", searchOnly:"搜索仅在资料库中可用。", accountDescription:"连接身份验证 API 后,主题权限将关联到你的 Horizon 账户。", donations:"捐赠", storedLocally:"已在本地记录", badgeDetected:"已检测到徽章", notDetected:"未检测到", donator:"捐赠者", freeUser:"免费", creatorStatus:"CREATOR", online:"在线" },
  ja: { open:"開く", noResults:"結果なし", noDownloads:"アクティブなダウンロードなし", noDownloadsDescription:"現在ダウンロードはありません。", available:"利用可能", locked:"ロック中", free:"無料", access:"アクセス:", donor1:"寄付者 ≥ €1", donor5:"寄付者 ≥ €5", donor10:"寄付者 ≥ €10", creator:"Creator バッジ", betaSelected:"BETA 選出", searchOnly:"検索はライブラリでのみ利用できます。", accountDescription:"認証 API 接続後、テーマ権限は Horizon アカウントに紐づきます。", donations:"寄付", storedLocally:"ローカルに記録済み", badgeDetected:"バッジを検出", notDetected:"未検出", donator:"寄付者", freeUser:"無料", creatorStatus:"CREATOR", online:"オンライン" },
  ko: { open:"열기", noResults:"결과 없음", noDownloads:"활성 다운로드 없음", noDownloadsDescription:"현재 다운로드가 없습니다.", available:"사용 가능", locked:"잠김", free:"무료", access:"액세스:", donor1:"후원자 ≥ €1", donor5:"후원자 ≥ €5", donor10:"후원자 ≥ €10", creator:"Creator 배지", betaSelected:"BETA 선정", searchOnly:"검색은 라이브러리에서만 사용할 수 있습니다.", accountDescription:"인증 API가 연결되면 테마 권한이 Horizon 계정에 연결됩니다.", donations:"후원", storedLocally:"로컬에 기록됨", badgeDetected:"배지 감지됨", notDetected:"감지되지 않음", donator:"후원자", freeUser:"무료", creatorStatus:"CREATOR", online:"온라인" }
};
Object.assign(EXTRA_LABELS.en,{sunriseDescription:"SunRise environment.",dawnDescription:"Dawn project.",horizonDescription:"Horizon components installed locally.",accountLabel:"Account",versionLabel:"Version",searchLabel:"Search",searchHintLabel:"Active only in Library",activeLabel:"ACTIVE"});
Object.assign(EXTRA_LABELS.fr,{sunriseDescription:"Environnement SunRise.",dawnDescription:"Projet Dawn.",horizonDescription:"Composants Horizon installés localement.",accountLabel:"Compte",versionLabel:"Version",searchLabel:"Recherche",searchHintLabel:"Active uniquement dans la bibliothèque",activeLabel:"ACTIF"});
Object.assign(EXTRA_LABELS.es,{sunriseDescription:"Entorno SunRise.",dawnDescription:"Proyecto Dawn.",horizonDescription:"Componentes de Horizon instalados localmente.",accountLabel:"Cuenta",versionLabel:"Versión",searchLabel:"Búsqueda",searchHintLabel:"Activa solo en la biblioteca",activeLabel:"ACTIVO"});
Object.assign(EXTRA_LABELS.ru,{sunriseDescription:"Среда SunRise.",dawnDescription:"Проект Dawn.",horizonDescription:"Компоненты Horizon, установленные локально.",accountLabel:"Аккаунт",versionLabel:"Версия",searchLabel:"Поиск",searchHintLabel:"Доступно только в библиотеке",activeLabel:"АКТИВНО"});
Object.assign(EXTRA_LABELS.zh,{sunriseDescription:"SunRise 环境。",dawnDescription:"Dawn 项目。",horizonDescription:"本地安装的 Horizon 组件。",accountLabel:"账户",versionLabel:"版本",searchLabel:"搜索",searchHintLabel:"仅在资料库中启用",activeLabel:"启用"});
Object.assign(EXTRA_LABELS.ja,{sunriseDescription:"SunRise 環境。",dawnDescription:"Dawn プロジェクト。",horizonDescription:"ローカルにインストールされた Horizon コンポーネント。",accountLabel:"アカウント",versionLabel:"バージョン",searchLabel:"検索",searchHintLabel:"ライブラリのみで有効",activeLabel:"有効"});
Object.assign(EXTRA_LABELS.ko,{sunriseDescription:"SunRise 환경.",dawnDescription:"Dawn 프로젝트.",horizonDescription:"로컬에 설치된 Horizon 구성 요소.",accountLabel:"계정",versionLabel:"버전",searchLabel:"검색",searchHintLabel:"라이브러리에서만 활성화",activeLabel:"활성"});
Object.assign(EXTRA_LABELS.en,{donor1Description:"Donor access from €1.",donor5Description:"Donor access from €5.",donor10Description:"Donor access from €10.",creatorDescription:"Reserved for accounts with the Creator badge.",betaDescription:"Reserved for the 5 selected BETA accounts."});
Object.assign(EXTRA_LABELS.ru,{home:"Главная",workshop:"Мастерская",library:"Библиотека",downloads:"Загрузки",themes:"Темы",settings:"Настройки",account:"Аккаунт",application:"ПРИЛОЖЕНИЕ",language:"Язык",languageHint:"Выберите язык интерфейса.",theme:"Тема",change:"Изменить",accent:"Цвет акцента",accentHint:"Настройте основной цвет интерфейса.",search:"Поиск",searchHint:"Доступно только в библиотеке",active:"АКТИВНО",version:"Версия",windows:"Windows x64",configuration:"Язык Manager и настройки приложения.",openWorkshop:"Открыть Workshop",openLibrary:"Открыть библиотеку"});
Object.assign(EXTRA_LABELS.zh,{home:"首页",workshop:"工作坊",library:"资料库",downloads:"下载",themes:"主题",settings:"设置",account:"账户",application:"应用程序",language:"语言",languageHint:"选择界面语言。",theme:"主题",change:"更改",accent:"强调色",accentHint:"自定义界面的主色。",search:"搜索",searchHint:"仅在资料库中启用",active:"启用",version:"版本",windows:"Windows x64",configuration:"Manager 语言和应用设置。",openWorkshop:"打开工作坊",openLibrary:"打开资料库"});
Object.assign(EXTRA_LABELS.ja,{home:"ホーム",workshop:"ワークショップ",library:"ライブラリ",downloads:"ダウンロード",themes:"テーマ",settings:"設定",account:"アカウント",application:"アプリケーション",language:"言語",languageHint:"インターフェースの言語を選択します。",theme:"テーマ",change:"変更",accent:"アクセントカラー",accentHint:"インターフェースのメインカラーを変更します。",search:"検索",searchHint:"ライブラリのみで有効",active:"有効",version:"バージョン",windows:"Windows x64",configuration:"Manager の言語とアプリ設定。",openWorkshop:"ワークショップを開く",openLibrary:"ライブラリを開く"});
Object.assign(EXTRA_LABELS.ko,{home:"홈",workshop:"워크숍",library:"라이브러리",downloads:"다운로드",themes:"테마",settings:"설정",account:"계정",application:"애플리케이션",language:"언어",languageHint:"인터페이스 언어를 선택하세요.",theme:"테마",change:"변경",accent:"강조 색상",accentHint:"인터페이스의 기본 색상을 사용자 지정합니다.",search:"검색",searchHint:"라이브러리에서만 활성화",active:"활성",version:"버전",windows:"Windows x64",configuration:"Manager 언어 및 애플리케이션 설정.",openWorkshop:"워크숍 열기",openLibrary:"라이브러리 열기"});
Object.assign(EXTRA_LABELS.fr,{donor1Description:"Accès donateur à partir de 1 €.",donor5Description:"Accès donateur à partir de 5 €.",donor10Description:"Accès donateur à partir de 10 €.",creatorDescription:"Réservé aux comptes possédant le badge Creator.",betaDescription:"Réservé aux 5 comptes sélectionnés pour la BETA."});
Object.assign(EXTRA_LABELS.es,{donor1Description:"Acceso de donante desde 1 €.",donor5Description:"Acceso de donante desde 5 €.",donor10Description:"Acceso de donante desde 10 €.",creatorDescription:"Reservado para cuentas con la insignia Creator.",betaDescription:"Reservado para las 5 cuentas seleccionadas para la BETA."});
Object.assign(EXTRA_LABELS.ru,{donor1Description:"Доступ для доноров от 1 €.",donor5Description:"Доступ для доноров от 5 €.",donor10Description:"Доступ для доноров от 10 €.",creatorDescription:"Только для аккаунтов со значком Creator.",betaDescription:"Только для 5 выбранных аккаунтов BETA."});
Object.assign(EXTRA_LABELS.zh,{donor1Description:"捐赠 €1 起可访问。",donor5Description:"捐赠 €5 起可访问。",donor10Description:"捐赠 €10 起可访问。",creatorDescription:"仅限拥有 Creator 徽章的账户。",betaDescription:"仅限 5 个入选 BETA 账户。"});
Object.assign(EXTRA_LABELS.ja,{donor1Description:"€1 以上の寄付でアクセス。",donor5Description:"€5 以上の寄付でアクセス。",donor10Description:"€10 以上の寄付でアクセス。",creatorDescription:"Creator バッジを持つアカウント限定。",betaDescription:"選ばれた 5 つの BETA アカウント限定。"});
Object.assign(EXTRA_LABELS.ko,{donor1Description:"€1 이상 후원 시 이용 가능.",donor5Description:"€5 이상 후원 시 이용 가능.",donor10Description:"€10 이상 후원 시 이용 가능.",creatorDescription:"Creator 배지가 있는 계정 전용.",betaDescription:"선정된 5개의 BETA 계정 전용."});
const PAGE_PHRASES = {
  "Beyond the Horizon.":"heroTitle",
  "The Horizon Workshop entry point for installing, organizing and launching modding projects.":"heroDescription",
  "The two official entry points for installing Horizon modding environments.":"workshopDescription",
  "SunRise and Dawn are external projects.":"externalProjects",
  "Application search works":"libraryDescription",
  "Downloads and installations will":"downloadsDescription",
  "Themes change the complete":"themeDescription",
  "Destiny 1 and Destiny 2 are free for everyone.":"accessRules",
  "The Library contains nothing matching":"noResultsDescription",
  "Disponible":"available",
  "Environnement SunRise.":"sunriseDescription",
  "Projet Dawn.":"dawnDescription",
  "Composants Horizon installés localement.":"horizonDescription",
  "Aucun résultat":"noResults",
  "Aucun téléchargement actif":"noDownloads",
  "Le tuyau est actuellement vide.":"noDownloadsDescription",
  "Recherche":"searchLabel",
  "Active uniquement dans Library":"searchHintLabel",
  "ACTIF":"activeLabel",
  "Compte":"accountLabel",
  "Donations":"donations",
  "Ouvrir":"open",
  "Badge détecté":"badgeDetected",
  "Non détecté":"notDetected",
  "Accès :":"access",
  "Verrouillé":"locked",
  "Gratuit":"free",
  "Les droits de thèmes seront liés au compte Horizon lorsque l'API d'authentification sera connectée.":"accountDescription",
  "Les droits de thèmes seront liés au compte Horizon lorsque l'API d'authentification sera connectée.":"accountDescription",
  "La recherche est disponible uniquement dans Library.":"searchOnly",
  "Accès donateur à partir de 1 €.":"donor1Description",
  "Accès donateur à partir de 5 €.":"donor5Description",
  "Accès donateur à partir de 10 €.":"donor10Description",
  "Réservé aux comptes possédant le badge Creator.":"creatorDescription",
  "Réservé aux 5 comptes sélectionnés pour la BETA.":"betaDescription",
  "Donor access from €1.":"donor1Description",
  "Donor access from €5.":"donor5Description",
  "Donor access from €10.":"donor10Description",
  "Reserved for accounts with the Creator badge.":"creatorDescription",
  "Reserved for the 5 selected BETA accounts.":"betaDescription"
};
Object.assign(EXTRA_LABELS.en,{heroTitle:"Beyond the Horizon.",heroDescription:"The Horizon Workshop entry point for installing, organizing and launching modding projects.",workshopDescription:"The two official entry points for installing Horizon modding environments.",externalProjects:"SunRise and Dawn are external projects. Horizon Manager opens their official resources in your browser.",libraryDescription:"Application search works only here.",downloadsDescription:"Downloads and installations will be managed here once the Horizon API is connected.",themeDescription:"Themes change the complete Horizon Manager appearance and persist after restart.",accessRules:"Standard themes are available to all players. Vex requires the Creator badge. BETA is reserved for selected accounts.",noResultsDescription:"The Library contains nothing matching for «{query}»."});
Object.assign(EXTRA_LABELS.fr,{heroTitle:"Au-delà de l'Horizon.",heroDescription:"Le point d'entrée du Workshop Horizon pour installer, organiser et lancer les projets de modding.",workshopDescription:"Les deux points d'entrée officiels pour installer les environnements de modding Horizon.",externalProjects:"SunRise et Dawn sont des projets externes. Horizon Manager ouvre leurs ressources officielles dans votre navigateur.",libraryDescription:"La recherche de l'application fonctionne uniquement ici.",downloadsDescription:"Les téléchargements et installations seront gérés ici lorsque l'API Horizon sera connectée.",themeDescription:"Les thèmes modifient l'apparence complète de Horizon Manager et sont conservés après redémarrage.",accessRules:"Les thèmes standards sont disponibles pour tous les joueurs. Vex nécessite le badge Creator. La BETA est réservée aux comptes sélectionnés.",noResultsDescription:"La bibliothèque ne contient rien correspondant à « {query} »."});
Object.assign(EXTRA_LABELS.es,{heroTitle:"Más allá del Horizonte.",heroDescription:"El punto de entrada de Horizon Workshop para instalar, organizar y ejecutar proyectos de modding.",workshopDescription:"Los dos puntos de entrada oficiales para instalar entornos de modding de Horizon.",externalProjects:"SunRise y Dawn son proyectos externos. Horizon Manager abre sus recursos oficiales en tu navegador.",libraryDescription:"La búsqueda de la aplicación funciona solo aquí.",downloadsDescription:"Las descargas e instalaciones se gestionarán aquí cuando la API de Horizon esté conectada.",themeDescription:"Los temas cambian por completo la apariencia de Horizon Manager y se conservan después de reiniciar.",accessRules:"Los temas estándar están disponibles para todos los jugadores. Vex requiere la insignia Creator. La BETA está reservada para cuentas seleccionadas.",noResultsDescription:"La biblioteca no contiene nada que coincida con «{query}»."});
Object.assign(EXTRA_LABELS.ru,{heroTitle:"За горизонтом.",heroDescription:"Точка входа Horizon Workshop для установки, организации и запуска проектов моддинга.",workshopDescription:"Две официальные точки входа для установки сред моддинга Horizon.",externalProjects:"SunRise и Dawn являются внешними проектами. Horizon Manager открывает их официальные ресурсы в браузере.",libraryDescription:"Поиск в приложении работает только здесь.",downloadsDescription:"Загрузки и установки будут управляться здесь после подключения API Horizon.",themeDescription:"Темы полностью меняют внешний вид Horizon Manager и сохраняются после перезапуска.",accessRules:"Стандартные темы доступны всем игрокам. Для Vex требуется значок Creator. BETA предназначена для выбранных аккаунтов.",noResultsDescription:"В библиотеке нет совпадений для «{query}»."});
Object.assign(EXTRA_LABELS.zh,{heroTitle:"超越地平线。",heroDescription:"Horizon Workshop 的入口,用于安装、整理和启动 Mod 项目。",workshopDescription:"安装 Horizon Mod 环境的两个官方入口。",externalProjects:"SunRise 和 Dawn 是外部项目。Horizon Manager 会在浏览器中打开它们的官方资源。",libraryDescription:"应用内搜索仅在这里可用。",downloadsDescription:"连接 Horizon API 后,下载和安装将在此管理。",themeDescription:"主题会改变 Horizon Manager 的完整外观,并在重启后保留。",accessRules:"标准主题对所有玩家开放。Vex 需要 Creator 徽章。BETA 仅限选定账户。",noResultsDescription:"资料库中没有与「{query}」匹配的内容。"});
Object.assign(EXTRA_LABELS.ja,{heroTitle:"地平線の彼方へ。",heroDescription:"Horizon Workshop の入口です。Mod プロジェクトのインストール、整理、起動を行えます。",workshopDescription:"Horizon Mod 環境をインストールするための公式エントリーポイントです。",externalProjects:"SunRise と Dawn は外部プロジェクトです。Horizon Manager はブラウザで公式リソースを開きます。",libraryDescription:"アプリケーション検索はここでのみ利用できます。",downloadsDescription:"Horizon API 接続後、ダウンロードとインストールをここで管理します。",themeDescription:"テーマは Horizon Manager の外観全体を変更し、再起動後も保持されます。",accessRules:"標準テーマはすべてのプレイヤーが利用できます。Vex には Creator バッジが必要です。BETA は選定されたアカウント限定です。",noResultsDescription:"「{query}」に一致する項目はありません。"});
Object.assign(EXTRA_LABELS.ko,{heroTitle:"지평선 너머.",heroDescription:"Horizon Workshop의 진입점으로 Mod 프로젝트를 설치, 정리하고 실행합니다.",workshopDescription:"Horizon Mod 환경을 설치하기 위한 두 개의 공식 진입점입니다.",externalProjects:"SunRise와 Dawn은 외부 프로젝트입니다. Horizon Manager가 브라우저에서 공식 리소스를 엽니다.",libraryDescription:"애플리케이션 검색은 여기에서만 사용할 수 있습니다.",downloadsDescription:"Horizon API가 연결되면 다운로드와 설치를 여기에서 관리합니다.",themeDescription:"테마는 Horizon Manager의 전체 외관을 변경하며 재시작 후에도 유지됩니다.",accessRules:"Destiny 1과 Destiny 2는 모두 무료입니다. Hive, Cabal, Fallen은 최소 €1 후원이 필요합니다. Corrupted는 €5, Aria는 €10이 필요합니다. Vex는 Creator 배지가 필요합니다. BETA는 선정된 5개 계정 전용입니다.",noResultsDescription:"「{query}」와 일치하는 항목이 없습니다."});

Object.assign(EXTRA_LABELS.en, { open:"Open", noResults:"No results", noDownloads:"No active downloads", noDownloadsDescription:"There are currently no downloads.", available:"Available", locked:"Locked", free:"Free", access:"Access:", creator:"Creator badge", betaSelected:"Selected for BETA", searchOnly:"Search is available only in Library.", donations:"Donations", storedLocally:"stored locally", badgeDetected:"Badge detected", notDetected:"Not detected", donator:"DONATOR", freeUser:"FREE", creatorStatus:"CREATOR", online:"ONLINE" });
Object.assign(EXTRA_LABELS.fr, { open:"Ouvrir", noResults:"Aucun résultat", noDownloads:"Aucun téléchargement actif", noDownloadsDescription:"Aucun téléchargement n'est actuellement disponible.", available:"Disponible", locked:"Verrouillé", free:"Gratuit", access:"Accès :", creator:"Badge Creator", betaSelected:"Sélectionné pour la BETA", searchOnly:"La recherche est disponible uniquement dans la Bibliothèque.", donations:"Dons", storedLocally:"enregistrés localement", badgeDetected:"Badge détecté", notDetected:"Non détecté", donator:"DONATEUR", freeUser:"GRATUIT", creatorStatus:"CREATOR", online:"EN LIGNE" });
Object.assign(EXTRA_LABELS.es, { open:"Abrir", noResults:"Sin resultados", noDownloads:"No hay descargas activas", noDownloadsDescription:"Actualmente no hay descargas.", available:"Disponible", locked:"Bloqueado", free:"Gratis", access:"Acceso:", creator:"Insignia Creator", betaSelected:"Seleccionado para la BETA", searchOnly:"La búsqueda está disponible solo en la Biblioteca.", donations:"Donaciones", storedLocally:"guardados localmente", badgeDetected:"Insignia detectada", notDetected:"No detectada", donator:"DONANTE", freeUser:"GRATIS", creatorStatus:"CREATOR", online:"EN LÍNEA" });
Object.assign(EXTRA_LABELS.ru, { open:"Открыть", noResults:"Нет результатов", noDownloads:"Нет активных загрузок", noDownloadsDescription:"Сейчас нет доступных загрузок.", available:"Доступно", locked:"Заблокировано", free:"Бесплатно", access:"Доступ:", creator:"Значок Creator", betaSelected:"Выбрано для BETA", searchOnly:"Поиск доступен только в Библиотеке.", donations:"Пожертвования", storedLocally:"сохранено локально", badgeDetected:"Значок обнаружен", notDetected:"Не обнаружено", donator:"ДОНАТОР", freeUser:"БЕСПЛАТНО", creatorStatus:"CREATOR", online:"ОНЛАЙН" });
Object.assign(EXTRA_LABELS.zh, { open:"打开", noResults:"没有结果", noDownloads:"没有活动下载", noDownloadsDescription:"目前没有可用的下载。", available:"可用", locked:"已锁定", free:"免费", access:"访问权限:", creator:"Creator 徽章", betaSelected:"BETA 专属", searchOnly:"搜索仅在资料库中可用。", donations:"捐赠", storedLocally:"本地保存", badgeDetected:"已检测到徽章", notDetected:"未检测到", donator:"捐赠者", freeUser:"免费用户", creatorStatus:"CREATOR", online:"在线" });
Object.assign(EXTRA_LABELS.ja, { open:"開く", noResults:"結果なし", noDownloads:"アクティブなダウンロードはありません", noDownloadsDescription:"現在利用できるダウンロードはありません。", available:"利用可能", locked:"ロック中", free:"無料", access:"アクセス:", creator:"Creator バッジ", betaSelected:"BETA 選択済み", searchOnly:"検索はライブラリでのみ利用できます。", donations:"寄付", storedLocally:"ローカル保存", badgeDetected:"バッジを検出", notDetected:"未検出", donator:"ドナー", freeUser:"無料", creatorStatus:"CREATOR", online:"オンライン" });
Object.assign(EXTRA_LABELS.ko, { open:"열기", noResults:"결과 없음", noDownloads:"활성 다운로드 없음", noDownloadsDescription:"현재 사용 가능한 다운로드가 없습니다.", available:"사용 가능", locked:"잠김", free:"무료", access:"액세스:", creator:"Creator 배지", betaSelected:"BETA 선택됨", searchOnly:"검색은 라이브러리에서만 사용할 수 있습니다.", donations:"후원", storedLocally:"로컬 저장", badgeDetected:"배지 감지됨", notDetected:"감지되지 않음", donator:"후원자", freeUser:"무료", creatorStatus:"CREATOR", online:"온라인" });

const CLEAN_DESCRIPTIONS = {
  en: {
    heroTitle:"Beyond the Horizon.", heroDescription:"The Horizon Workshop entry point for installing, organizing and launching modding projects.",
    workshopDescription:"The two official entry points for installing Horizon modding environments.",
    externalProjects:"SunRise and Dawn are external projects. Horizon Manager opens their official resources in your browser.",
    libraryDescription:"Application search works only here.", downloadsDescription:"Downloads and installations will be managed here once the Horizon API is connected.",
    themeDescription:"Themes change the complete Horizon Manager appearance and persist after restart.",
    accessRules:"Standard themes are available to everyone. Vex requires the Creator badge. BETA is reserved for selected accounts.",
    noResultsDescription:"The Library contains nothing matching «{query}»."
  },
  fr: {
    heroTitle:"Au-delà de l'Horizon.", heroDescription:"Le point d'entrée du Workshop Horizon pour installer, organiser et lancer les projets de modding.",
    workshopDescription:"Les deux points d'entrée officiels pour installer les environnements de modding Horizon.",
    externalProjects:"SunRise et Dawn sont des projets externes. Horizon Manager ouvre leurs ressources officielles dans votre navigateur.",
    libraryDescription:"La recherche dans l'application fonctionne uniquement ici.", downloadsDescription:"Les téléchargements et installations seront gérés ici lorsque l'API Horizon sera connectée.",
    themeDescription:"Les thèmes modifient complètement l'apparence de Horizon Manager et sont conservés après redémarrage.",
    accessRules:"Les thèmes standards sont disponibles pour tous. Vex nécessite le badge Creator. La BETA est réservée aux comptes sélectionnés.",
    noResultsDescription:"La Bibliothèque ne contient rien correspondant à « {query} »."
  },
  es: {
    heroTitle:"Más allá del Horizonte.", heroDescription:"El punto de entrada de Horizon Workshop para instalar, organizar y ejecutar proyectos de modding.",
    workshopDescription:"Los dos puntos de entrada oficiales para instalar los entornos de modding de Horizon.",
    externalProjects:"SunRise y Dawn son proyectos externos. Horizon Manager abre sus recursos oficiales en el navegador.",
    libraryDescription:"La búsqueda de la aplicación funciona solo aquí.", downloadsDescription:"Las descargas e instalaciones se gestionarán aquí cuando la API de Horizon esté conectada.",
    themeDescription:"Los temas cambian por completo el aspecto de Horizon Manager y se conservan después de reiniciar.",
    accessRules:"Los temas estándar están disponibles para todos. Vex requiere la insignia Creator. La BETA está reservada para cuentas seleccionadas.",
    noResultsDescription:"La Biblioteca no contiene nada que coincida con «{query}»."
  },
  ru: {
    heroTitle:"За горизонтом.", heroDescription:"Точка входа Horizon Workshop для установки, организации и запуска моддинг-проектов.",
    workshopDescription:"Две официальные точки входа для установки моддинг-сред Horizon.",
    externalProjects:"SunRise и Dawn являются внешними проектами. Horizon Manager открывает их официальные ресурсы в браузере.",
    libraryDescription:"Поиск в приложении работает только здесь.", downloadsDescription:"Загрузки и установки будут управляться здесь после подключения Horizon API.",
    themeDescription:"Темы полностью изменяют внешний вид Horizon Manager и сохраняются после перезапуска.",
    accessRules:"Стандартные темы доступны всем. Для Vex требуется значок Creator. BETA предназначена для выбранных аккаунтов.",
    noResultsDescription:"В Библиотеке нет элементов, соответствующих «{query}»."
  },
  zh: {
    heroTitle:"超越地平线。", heroDescription:"Horizon Workshop 的入口,用于安装、管理和启动 Mod 项目。",
    workshopDescription:"用于安装 Horizon Mod 环境的两个官方入口。",
    externalProjects:"SunRise 和 Dawn 是外部项目。Horizon Manager 会在浏览器中打开它们的官方资源。",
    libraryDescription:"应用内搜索仅在此处可用。", downloadsDescription:"连接 Horizon API 后,下载和安装功能将在此处管理。",
    themeDescription:"主题会完全改变 Horizon Manager 的外观,并在重启后保留。",
    accessRules:"标准主题对所有玩家开放。Vex 需要 Creator 徽章。BETA 仅提供给选定账户。",
    noResultsDescription:"资料库中没有与「{query}」匹配的内容。"
  },
  ja: {
    heroTitle:"地平線の彼方へ。", heroDescription:"Horizon Workshop の入口です。Mod プロジェクトのインストール、管理、起動を行えます。",
    workshopDescription:"Horizon Mod 環境をインストールするための2つの公式エントリーポイントです。",
    externalProjects:"SunRise と Dawn は外部プロジェクトです。Horizon Manager はブラウザで公式リソースを開きます。",
    libraryDescription:"アプリ内検索はここでのみ利用できます。", downloadsDescription:"Horizon API 接続後、ダウンロードとインストールをここで管理します。",
    themeDescription:"テーマは Horizon Manager の外観全体を変更し、再起動後も保持されます。",
    accessRules:"標準テーマは全プレイヤーが利用できます。Vex には Creator バッジが必要です。BETA は選択されたアカウント専用です。",
    noResultsDescription:"ライブラリに「{query}」に一致する項目はありません。"
  },
  ko: {
    heroTitle:"지평선 너머.", heroDescription:"Horizon Workshop의 진입점으로 Mod 프로젝트를 설치하고 관리하며 실행합니다.",
    workshopDescription:"Horizon Mod 환경을 설치하기 위한 두 개의 공식 진입점입니다.",
    externalProjects:"SunRise와 Dawn은 외부 프로젝트입니다. Horizon Manager는 브라우저에서 공식 리소스를 엽니다.",
    libraryDescription:"앱 내 검색은 여기에서만 사용할 수 있습니다.", downloadsDescription:"Horizon API 연결 후 다운로드와 설치를 여기에서 관리합니다.",
    themeDescription:"테마는 Horizon Manager의 전체 외관을 변경하며 재시작 후에도 유지됩니다.",
    accessRules:"기본 테마는 모든 플레이어가 사용할 수 있습니다. Vex에는 Creator 배지가 필요합니다. BETA는 선택된 계정 전용입니다.",
    noResultsDescription:"라이브러리에 「{query}」와 일치하는 항목이 없습니다."
  }
};

Object.keys(CLEAN_DESCRIPTIONS).forEach(code => Object.assign(EXTRA_LABELS[code], CLEAN_DESCRIPTIONS[code]));

const CLEAN_CONTEXT = {
  en:{sunriseDescription:"SunRise environment.",dawnDescription:"Dawn project.",horizonDescription:"Horizon components installed locally.",accountLabel:"Account",versionLabel:"Version",searchLabel:"Search",searchHintLabel:"Available only in Library",activeLabel:"ACTIVE",donor1Description:"Donor access from €1.",donor5Description:"Donor access from €5.",donor10Description:"Donor access from €10.",creatorDescription:"Reserved for accounts with the Creator badge.",betaDescription:"Reserved for the 5 selected BETA accounts."},
  fr:{sunriseDescription:"Environnement SunRise.",dawnDescription:"Projet Dawn.",horizonDescription:"Composants Horizon installés localement.",accountLabel:"Compte",versionLabel:"Version",searchLabel:"Recherche",searchHintLabel:"Disponible uniquement dans la Bibliothèque",activeLabel:"ACTIF",donor1Description:"Accès donateur à partir de 1 €.",donor5Description:"Accès donateur à partir de 5 €.",donor10Description:"Accès donateur à partir de 10 €.",creatorDescription:"Réservé aux comptes possédant le badge Creator.",betaDescription:"Réservé aux 5 comptes sélectionnés pour la BETA."},
  es:{sunriseDescription:"Entorno SunRise.",dawnDescription:"Proyecto Dawn.",horizonDescription:"Componentes de Horizon instalados localmente.",accountLabel:"Cuenta",versionLabel:"Versión",searchLabel:"Búsqueda",searchHintLabel:"Disponible solo en la Biblioteca",activeLabel:"ACTIVO",donor1Description:"Acceso de donante desde 1 €.",donor5Description:"Acceso de donante desde 5 €.",donor10Description:"Acceso de donante desde 10 €.",creatorDescription:"Reservado para cuentas con la insignia Creator.",betaDescription:"Reservado para las 5 cuentas seleccionadas para la BETA."},
  ru:{sunriseDescription:"Среда SunRise.",dawnDescription:"Проект Dawn.",horizonDescription:"Компоненты Horizon, установленные локально.",accountLabel:"Аккаунт",versionLabel:"Версия",searchLabel:"Поиск",searchHintLabel:"Доступно только в Библиотеке",activeLabel:"АКТИВНО",donor1Description:"Доступ для донатеров от 1 €.",donor5Description:"Доступ для донатеров от 5 €.",donor10Description:"Доступ для донатеров от 10 €.",creatorDescription:"Только для аккаунтов со значком Creator.",betaDescription:"Только для 5 выбранных аккаунтов BETA."},
  zh:{sunriseDescription:"SunRise 环境。",dawnDescription:"Dawn 项目。",horizonDescription:"本地安装的 Horizon 组件。",accountLabel:"账户",versionLabel:"版本",searchLabel:"搜索",searchHintLabel:"仅在资料库中可用",activeLabel:"已启用",donor1Description:"捐赠 1 欧元起可访问。",donor5Description:"捐赠 5 欧元起可访问。",donor10Description:"捐赠 10 欧元起可访问。",creatorDescription:"仅限拥有 Creator 徽章的账户。",betaDescription:"仅限 5 个选定的 BETA 账户。"},
  ja:{sunriseDescription:"SunRise 環境。",dawnDescription:"Dawn プロジェクト。",horizonDescription:"ローカルにインストールされた Horizon コンポーネント。",accountLabel:"アカウント",versionLabel:"バージョン",searchLabel:"検索",searchHintLabel:"ライブラリでのみ利用可能",activeLabel:"有効",donor1Description:"1 € からの寄付でアクセスできます。",donor5Description:"5 € からの寄付でアクセスできます。",donor10Description:"10 € からの寄付でアクセスできます。",creatorDescription:"Creator バッジを持つアカウント専用です。",betaDescription:"選択された5つの BETA アカウント専用です。"},
  ko:{sunriseDescription:"SunRise 환경.",dawnDescription:"Dawn 프로젝트.",horizonDescription:"로컬에 설치된 Horizon 구성 요소.",accountLabel:"계정",versionLabel:"버전",searchLabel:"검색",searchHintLabel:"라이브러리에서만 사용 가능",activeLabel:"활성",donor1Description:"1 €부터 후원자 액세스.",donor5Description:"5 €부터 후원자 액세스.",donor10Description:"10 €부터 후원자 액세스.",creatorDescription:"Creator 배지가 있는 계정 전용입니다.",betaDescription:"선택된 5개의 BETA 계정 전용입니다."}
};
Object.keys(CLEAN_CONTEXT).forEach(code => Object.assign(EXTRA_LABELS[code], CLEAN_CONTEXT[code]));

function languageText(key) {
  return EXTRA_LABELS[activeLanguage]?.[key] || LANGUAGE_LABELS[activeLanguage]?.[key] || LANGUAGE_LABELS.en[key] || EXTRA_LABELS.en[key] || key;
}

const PHRASES = {
  "Accueil":"Home", "Le point d'entrée du Workshop Horizon pour installer, organiser et lancer les projets de modding.":"The Horizon Workshop entry point for installing, organizing and launching modding projects.",
  "Ouvrir":"Open", "Votre bibliothèque":"Your library", "Aucun résultat":"No results", "Aucun téléchargement actif":"No active downloads",
  "Le tuyau est actuellement vide.":"There are currently no downloads.", "Recherche":"Search", "Active uniquement dans Library":"Active only in Library",
  "Version":"Version", "Horizon Manager ${HORIZON_VERSION}":"Horizon Manager ${HORIZON_VERSION}", "Compte":"Account", "Donations":"Donations",
  "enregistrés localement":"stored locally", "Badge détecté":"Badge detected", "Non détecté":"Not detected",
  "Accès :":"Access:", "ACTIF":"ACTIVE", "Verrouillé":"Locked", "Gratuit":"Free", "Badge Creator":"Creator badge", "BETA sélectionnée":"Selected for BETA",
  "Accès donateur à partir de 1 €.":"Donor access from €1.", "Accès donateur à partir de 5 €.":"Donor access from €5.", "Accès donateur à partir de 10 €.":"Donor access from €10.",
  "Réservé aux comptes possédant le badge Creator.":"Reserved for accounts with the Creator badge.", "Réservé aux 5 comptes sélectionnés pour la BETA.":"Reserved for the 5 selected BETA accounts.",
  "Thème Horizon par défaut.":"Default Horizon theme.", "Guide officiel d'installation de SunRise.":"Official SunRise installation guide.", "Dépôt officiel GitHub de Dawn.":"Official Dawn GitHub repository.",
  "Environnement SunRise.":"SunRise environment.", "Projet Dawn.":"Dawn project.", "Composants Horizon installés localement.":"Horizon components installed locally."
};

const PHRASES_FR = {
  "Home":"Accueil", "The Horizon Workshop entry point for installing, organizing and launching modding projects.":"Le point d'entrée du Workshop Horizon pour installer, organiser et lancer les projets de modding.", "Open":"Ouvrir", "Your library":"Votre bibliothèque", "No results":"Aucun résultat", "No active downloads":"Aucun téléchargement actif", "There are currently no downloads.":"Le tuyau est actuellement vide.", "Search":"Recherche", "Active only in Library":"Active uniquement dans Library", "Account":"Compte", "stored locally":"enregistrés localement", "Badge detected":"Badge détecté", "Not detected":"Non détecté", "Access:":"Accès:", "ACTIVE":"ACTIF", "Locked":"Verrouillé", "Free":"Gratuit", "Creator badge":"Badge Creator", "Selected for BETA":"BETA sélectionnée" 
};

function translatePhrase(text) {
  const key = text.trim();
  if (activeLanguage === "en") return PHRASES[key] || key;
  if (activeLanguage === "fr") return PHRASES_FR[key] || key;
  return key;
}

function applyLanguage() {
  const navMap = {
    home: languageText("home"), workshop: languageText("workshop"), library: languageText("library"),
    downloads: languageText("downloads"), themes: languageText("themes"), settings: languageText("settings"), account: languageText("account")
  };
  document.querySelectorAll(".nav-item[data-route]").forEach(item => {
    const label = navMap[item.dataset.route];
    if (label) {
      const icon = item.querySelector("span");
      item.textContent = "";
      if (icon) item.appendChild(icon);
      item.append(document.createTextNode(label));
    }
  });

  const updatesButton = document.getElementById("update-check-button");
  if (updatesButton) updatesButton.textContent = workshopText("checkUpdates");

  if (searchInput) searchInput.placeholder = `${languageText("search")} ${languageText("library")}...`;

  const root = document.getElementById("page");
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const raw = node.nodeValue.trim();
    if (!raw) return;
    const key = PAGE_PHRASES[raw];
    if (key) {
      node.nodeValue = node.nodeValue.replace(raw, languageText(key));
      return;
    }
    const phrase = PHRASES[raw];
    if (phrase && activeLanguage === "en") {
      node.nodeValue = node.nodeValue.replace(raw, phrase);
    }
  });
  /*
  if (activeLanguage === "en") {
    const walker = document.createTreeWalker(document.getElementById("page"), NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const translated = PHRASES[node.nodeValue.trim()];
      if (translated) node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), translated);
    });
  }
  }*/
}


function setTheme(themeKey) {
  const theme = THEMES[themeKey];

  if (!theme) {
    return;
  }

  if (!canUseTheme(theme)) {
    showToast(
      `${theme.name} ${languageText("locked").toLowerCase()}: ${requirementLabel(theme)}.`
    );

    return;
  }

  activeTheme = themeKey;

  document.documentElement.dataset.theme = themeKey;

  localStorage.setItem(
    "horizon-theme",
    themeKey
  );

  showToast(
    `Theme ${theme.name} applied.`
  );

  render(currentRoute);
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function nav() {
  document
    .querySelectorAll(".nav-item")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.route === currentRoute
      );
    });

  if (searchWrap) {
    searchWrap.classList.toggle(
      "hidden",
      !["library", "workshop"].includes(currentRoute)
    );

    if (searchInput) {
      searchInput.placeholder =
        currentRoute === "workshop"
          ? "Search Workshop..."
          : "Search Library...";
    }
  }
}


/* =========================================================
   PROJECT CARD
   ========================================================= */

function cardProject(project) {
  const copy = PROJECT_COPY[activeLanguage] || PROJECT_COPY.en;
  const description = project.name === "SunRise" ? copy.sunrise : project.name === "Dawn" ? copy.dawn : copy.sundial;
  const type = project.name === "SunRise" ? copy.environment : copy.openSource;
  return `
    <article class="card link-card">

      <div>
        <small>
          ${escapeHtml(project.name.toUpperCase())}
        </small>

        <h3>
          ${escapeHtml(project.name)}
        </h3>

        <p>
          ${escapeHtml(description)}
        </p>

        <span class="meta">
          ${escapeHtml(type)}
        </span>
      </div>

      <button
        class="button primary"
        data-external="${escapeHtml(project.url)}"
      >
        ${copy.open}
      </button>

    </article>
  `;
}


/* =========================================================
   HOME
   ========================================================= */

function renderHome() {
  const L = languageText;
  return `
    <section class="hero">

      <div>

        <span class="section-label">
          DESTINY MODDING ECOSYSTEM
        </span>

        <h2>
          Beyond the Horizon.
        </h2>

        <p>
          The Horizon Workshop entry point for installing, organizing and launching modding projects.
        </p>

        <div class="actions">

          <button
            class="button primary"
            data-route="workshop"
          >
            ${L("openWorkshop").toUpperCase()}
          </button>

          <button
            class="button ghost"
            data-route="library"
          >
            ${L("openLibrary").toUpperCase()}
          </button>

        </div>

      </div>

    </section>

    <div class="grid">

      <article
        class="card interactive"
        data-route="workshop"
      >
        <small>WORKSHOP</small>

        <h3>
          SunRise & Dawn
        </h3>

        <p>
          ${L("directProjectAccess")}
        </p>
      </article>


      <article
        class="card interactive"
        data-route="library"
      >
        <small>LIBRARY</small>

        <h3>
          ${L("yourLibrary")}
        </h3>

        <p>
          ${L("findInstalled")}
        </p>
      </article>


      <article
        class="card interactive"
        data-route="themes"
      >
        <small>THEMES</small>

        <h3>
          Destiny Art Direction
        </h3>

        <p>
          ${L("changeVisualIdentity")}
        </p>
      </article>

    </div>
  `;
}


/* =========================================================
   WORKSHOP
   ========================================================= */

async function refreshWorkshop() {
  try {
    const response = await fetch(`${HORIZON_API}/api/launcher/workshop`);
    if (!response.ok) return;
    const data = await response.json();
    WORKSHOP_ITEMS = Array.isArray(data.items) ? data.items : [];
    if (currentRoute === "workshop") {
      page.innerHTML = renderWorkshop(searchInput?.value || "");
      bind();
    }
  } catch (error) {
    console.warn("[Horizon] Workshop refresh failed:", error);
  }
}

function workshopCard(item) {
  const title = escapeHtml(item.title || "Untitled");
  const description = escapeHtml(item.description || "No description provided.");
  const game = escapeHtml(String(item.game || "").toUpperCase());
  const fileName = escapeHtml(item.file_name || "package.zip");
  const url = escapeHtml(item.download_url || "");
  const score = Number(item.rating || 0).toFixed(1);
  const votes = Number(item.vote_count || 0);
  const copy = WORKSHOP_COPY[activeLanguage] || WORKSHOP_COPY.en;
  const image = item.image_url ? '<img class="workshop-cover" src="' + escapeHtml(item.image_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : "";
  return '<article class="card link-card"><div><small>' + game + ' // COMMUNITY</small><h3>' + title + '</h3><p>' + description + '</p><span class="meta">' + fileName + '</span><div class="workshop-rating">★ ' + score + ' · ' + votes + ' ' + copy.votes + '</div><div class="workshop-vote"><select aria-label="' + copy.yourVote + '" data-vote-score><option value="5">5 ★</option><option value="4">4 ★</option><option value="3">3 ★</option><option value="2">2 ★</option><option value="1">1 ★</option></select><button class="button ghost" type="button" data-vote="' + Number(item.id) + '">' + copy.vote + '</button></div></div><button class="button primary" type="button" data-external="' + url + '" ' + (url ? "" : "disabled") + '>' + copy.download + '</button></article>';
}


function renderWorkshop(query = "") {
  const q = query.trim().toLowerCase();
  const copy = WORKSHOP_COPY[activeLanguage] || WORKSHOP_COPY.en;
  const projects = PROJECTS.filter(project =>
    !q || project.name.toLowerCase().includes(q)
  );

  return `
    <div class="page-head">

      <span class="section-label">
        ${copy.kicker}
      </span>

      <h2>
        ${copy.title}
      </h2>

      <p>
        ${copy.intro}
      </p>
      <button class="button primary workshop-refresh" type="button" data-refresh-workshop>${copy.update}</button>

    </div>

    <div class="library-grid">
      ${projects.map(cardProject).join("")}
    </div>

    ${WORKSHOP_ITEMS.length ? `
      <div class="page-head workshop-community-head">
        <span class="section-label">${copy.published}</span>
        <h3>${copy.releases}</h3>
        <p>${copy.approved}</p>
      </div>
      <div class="workshop-sort"><label for="workshop-sort">${copy.sort}</label><select id="workshop-sort"><option value="name" ${workshopSort === "name" ? "selected" : ""}>${copy.name}</option><option value="date" ${workshopSort === "date" ? "selected" : ""}>${copy.date}</option><option value="rating" ${workshopSort === "rating" ? "selected" : ""}>${copy.rating}</option></select></div>
      <div class="library-grid">
        ${WORKSHOP_ITEMS.filter(item => !q || String(item.title).toLowerCase().includes(q)).slice().sort((a,b)=>workshopSort==="name"?String(a.title).localeCompare(String(b.title)):workshopSort==="rating"?Number(b.rating||0)-Number(a.rating||0):String(b.published_at||"").localeCompare(String(a.published_at||""))).map(workshopCard).join("")}
      </div>
    ` : `
      <div class="info-box">${copy.empty}</div>
    `}
    
    <div class="info-box">
      ${copy.external}
    </div>
  `;
}

const WORKSHOP_COPY = {
  en:{kicker:"COMMUNITY WORKSHOP",title:"Workshop",intro:"The two official entry points for installing Horizon modding environments.",update:"UPDATE WORKSHOP",published:"PUBLISHED CONTENT",releases:"Community Releases",approved:"Approved Creator content published through Horizon moderation.",empty:"No approved Creator content has been published yet.",external:"SunRise and Dawn are external projects. Horizon Manager opens their official resources in your browser."},
  fr:{kicker:"ATELIER COMMUNAUTAIRE",title:"Workshop",intro:"Les deux points d'entrée officiels pour installer les environnements de modding Horizon.",update:"METTRE À JOUR LE WORKSHOP",published:"CONTENU PUBLIÉ",releases:"Publications communautaires",approved:"Contenu Creator approuvé et publié après modération par Horizon.",empty:"Aucun contenu Creator approuvé n'a encore été publié.",external:"SunRise et Dawn sont des projets externes. Horizon Manager ouvre leurs ressources officielles dans votre navigateur."},
  es:{kicker:"TALLER DE LA COMUNIDAD",title:"Workshop",intro:"Los dos puntos oficiales para instalar los entornos de modding de Horizon.",update:"ACTUALIZAR WORKSHOP",published:"CONTENIDO PUBLICADO",releases:"Publicaciones de la comunidad",approved:"Contenido Creator aprobado y publicado tras la moderación de Horizon.",empty:"Aún no se ha publicado contenido Creator aprobado.",external:"SunRise y Dawn son proyectos externos. Horizon Manager abre sus recursos oficiales en el navegador."},
  ru:{kicker:"СООБЩЕСТВО WORKSHOP",title:"Workshop",intro:"Два официальных способа установить среды для моддинга Horizon.",update:"ОБНОВИТЬ WORKSHOP",published:"ОПУБЛИКОВАННЫЙ КОНТЕНТ",releases:"Публикации сообщества",approved:"Материалы Creator, одобренные модерацией Horizon.",empty:"Одобренных материалов Creator пока нет.",external:"SunRise и Dawn — внешние проекты. Horizon Manager открывает их официальные ресурсы в браузере."},
  zh:{kicker:"社区工坊",title:"Workshop",intro:"安装 Horizon 模组环境的两个官方入口。",update:"更新 WORKSHOP",published:"已发布内容",releases:"社区发布",approved:"经 Horizon 审核并发布的 Creator 内容。",empty:"尚无已审核的 Creator 内容。",external:"SunRise 和 Dawn 是外部项目。Horizon Manager 会在浏览器中打开其官方资源。"},
  ja:{kicker:"コミュニティ Workshop",title:"Workshop",intro:"Horizon の Mod 環境を導入するための公式エントリーポイントです。",update:"WORKSHOP を更新",published:"公開済みコンテンツ",releases:"コミュニティ公開作品",approved:"Horizon の審査で承認された Creator コンテンツです。",empty:"承認済みの Creator コンテンツはまだありません。",external:"SunRise と Dawn は外部プロジェクトです。公式リソースをブラウザーで開きます。"},
  ko:{kicker:"커뮤니티 워크숍",title:"Workshop",intro:"Horizon 모딩 환경을 설치하는 두 가지 공식 진입점입니다.",update:"WORKSHOP 업데이트",published:"게시된 콘텐츠",releases:"커뮤니티 공개 항목",approved:"Horizon 검토를 통과해 게시된 Creator 콘텐츠입니다.",empty:"승인된 Creator 콘텐츠가 아직 없습니다.",external:"SunRise와 Dawn은 외부 프로젝트입니다. Horizon Manager가 공식 리소스를 브라우저에서 엽니다."}
};
Object.assign(WORKSHOP_COPY.en,{sort:"Sort by",name:"Name",date:"Date",rating:"Rating",votes:"votes",yourVote:"Your rating",vote:"VOTE",download:"DOWNLOAD"});
Object.assign(WORKSHOP_COPY.fr,{sort:"Trier par",name:"Nom",date:"Date",rating:"Note",votes:"votes",yourVote:"Votre note",vote:"NOTER",download:"TÉLÉCHARGER"});
Object.assign(WORKSHOP_COPY.es,{sort:"Ordenar por",name:"Nombre",date:"Fecha",rating:"Valoración",votes:"votos",yourVote:"Tu valoración",vote:"VOTAR",download:"DESCARGAR"});
Object.assign(WORKSHOP_COPY.ru,{sort:"Сортировать",name:"Название",date:"Дата",rating:"Оценка",votes:"оценок",yourVote:"Ваша оценка",vote:"ОЦЕНИТЬ",download:"СКАЧАТЬ"});
Object.assign(WORKSHOP_COPY.zh,{sort:"排序",name:"名称",date:"日期",rating:"评分",votes:"票",yourVote:"你的评分",vote:"评分",download:"下载"});
Object.assign(WORKSHOP_COPY.ja,{sort:"並べ替え",name:"名前",date:"日付",rating:"評価",votes:"票",yourVote:"評価",vote:"投票",download:"ダウンロード"});
Object.assign(WORKSHOP_COPY.ko,{sort:"정렬",name:"이름",date:"날짜",rating:"평점",votes:"표",yourVote:"평가",vote:"투표",download:"다운로드"});
const PROJECT_COPY = {
  en:{sunrise:"Official SunRise installation guide.",dawn:"Official Dawn GitHub repository.",sundial:"Official Sundial GitHub repository.",environment:"Modding environment",openSource:"Open-source project",open:"Open"},
  fr:{sunrise:"Guide officiel d'installation de SunRise.",dawn:"Dépôt GitHub officiel de Dawn.",sundial:"Dépôt GitHub officiel de Sundial.",environment:"Environnement de modding",openSource:"Projet open source",open:"Ouvrir"},
  es:{sunrise:"Guía oficial de instalación de SunRise.",dawn:"Repositorio oficial de Dawn en GitHub.",sundial:"Repositorio oficial de Sundial en GitHub.",environment:"Entorno de modding",openSource:"Proyecto de código abierto",open:"Abrir"},
  ru:{sunrise:"Официальное руководство по установке SunRise.",dawn:"Официальный репозиторий Dawn на GitHub.",sundial:"Официальный репозиторий Sundial на GitHub.",environment:"Среда для моддинга",openSource:"Открытый проект",open:"Открыть"},
  zh:{sunrise:"SunRise 官方安装指南。",dawn:"Dawn 官方 GitHub 仓库。",sundial:"Sundial 官方 GitHub 仓库。",environment:"模组环境",openSource:"开源项目",open:"打开"},
  ja:{sunrise:"SunRise の公式インストールガイド。",dawn:"Dawn の公式 GitHub リポジトリ。",sundial:"Sundial の公式 GitHub リポジトリ。",environment:"Mod 環境",openSource:"オープンソースプロジェクト",open:"開く"},
  ko:{sunrise:"SunRise 공식 설치 안내입니다.",dawn:"Dawn 공식 GitHub 저장소입니다.",sundial:"Sundial 공식 GitHub 저장소입니다.",environment:"모딩 환경",openSource:"오픈 소스 프로젝트",open:"열기"}
};
const WORKSHOP_UPDATE_LABELS = {en:"Check for updates",fr:"Vérifier les mises à jour",es:"Buscar actualizaciones",ru:"Проверить обновления",zh:"检查更新",ja:"更新を確認",ko:"업데이트 확인"};
function workshopText(key) { return WORKSHOP_COPY[activeLanguage]?.[key] || WORKSHOP_COPY.en[key] || WORKSHOP_UPDATE_LABELS[activeLanguage] || WORKSHOP_UPDATE_LABELS.en; }


/* =========================================================
   LOCAL PROJECTS / LIBRARY
   ========================================================= */

function localProjectCard(kind, label, description) {
  const project = localProjects.find(item => item.id === kind);
  const detected = Boolean(project);

  return `
    <article class="card local-project-card ${detected ? "detected" : "not-detected"}">
      <div class="local-project-head">
        <div>
          <small>GAME / PROJECT</small>
          <h3>${label}</h3>
        </div>
        <span class="project-status-dot ${detected ? "" : "offline"}"></span>
      </div>
      <p class="local-project-path" title="${detected ? escapeHtml(project.executable) : ""}">
        ${detected ? escapeHtml(project.executable) : "Executable not detected"}
      </p>
      <div class="local-project-actions">
        ${detected
          ? `
            <button class="button primary" type="button" data-launch-local="${escapeHtml(project.executable)}">
              START
            </button>
            <button class="button ghost local-project-change" type="button" data-select-local="${kind}">
              CHANGE FOLDER
            </button>
          `
          : `<button class="button ghost" type="button" data-select-local="${kind}">SELECT .EXE</button>`}
      </div>
      <small class="local-project-description">${escapeHtml(description)}</small>
    </article>
  `;
}

function renderLocalProjectPanel() {
  return `
    <div class="local-project-toolbar">
      <div>
        <span class="section-label">GAME LAUNCHER</span>
        <h3>Select your executables manually</h3>
      </div>
    </div>
    <div class="library-grid local-project-grid">
      ${["destiny2", "dawn", "sunrise", "sundial"].map(kind => {
        const labels = { destiny2: "Destiny 2", dawn: "Dawn", sunrise: "SunRise", sundial: "Sundial" };
        const project = localProjects.find(item => item.id === kind);
        return project
          ? localProjectCard(kind, labels[kind], "Manual installation selected.")
          : `<article class="card local-project-card not-detected">
              <div class="local-project-head">
                <div><small>GAME / PROJECT</small><h3>${labels[kind]}</h3></div>
                <span class="project-status-dot offline"></span>
              </div>
              <p class="local-project-path">No executable selected</p>
              <div class="local-project-actions">
                <button class="button primary" type="button" data-select-local="${kind}">SELECT .EXE</button>
              </div>
            </article>`;
      }).join("")}
    </div>
  `;
}

function renderLibrary(query = "") {
  const q = query
    .trim()
    .toLowerCase();

  const items = [
    {
      name: "SunRise",
      type: "Environment",
      status: languageText("available"),
      description: languageText("sunriseDescription")
    },

    {
      name: "Dawn",
      type: "Project",
      status: languageText("available"),
      description: languageText("dawnDescription")
    },

    {
      name: "Horizon Core",
      type: "Horizon",
      status: "Manager",
      description: languageText("horizonDescription")
    }
  ].filter(item => {
    const searchable = `
      ${item.name}
      ${item.type}
      ${item.description}
    `.toLowerCase();

    return !q || item.name.toLowerCase().includes(q);
  });


  return `
    <div class="page-head">

      <span class="section-label">
        LOCAL LIBRARY
      </span>

      <h2>
        Library
      </h2>

      <p>
        Select Destiny 2, Dawn, SunRise or Sundial manually and launch them directly from Horizon.
      </p>

    </div>

    ${renderLocalProjectPanel()}

    ${items.length

        ? `
          <div class="library-grid">

            ${items.map(item => `
              <article
                class="card ${q ? "search-result" : ""}"
              >

                <small>
                  ${escapeHtml(item.type.toUpperCase())}
                </small>

                <h3>
                  ${escapeHtml(item.name)}
                </h3>

                <p>
                  ${escapeHtml(item.description)}
                </p>

                <span class="meta">
                  ${escapeHtml(item.status)}
                </span>

              </article>
            `).join("")}

          </div>
        `

        : `
          <div class="empty">

            <h3>
              Aucun résultat
            </h3>

            <p>
              The Library contains nothing matching
              for "${escapeHtml(query)}".
            </p>

          </div>
        `
    }
  `;
}


/* =========================================================
   DOWNLOADS
   ========================================================= */

function renderDownloads() {
  return `
    <div class="page-head">

      <span class="section-label">
        DOWNLOAD CENTER
      </span>

      <h2>
        Downloads
      </h2>

      <p>
        Downloads and installations will
        be managed here once the Horizon API is connected.
      </p>

    </div>

    <div class="empty">

      <h3>
        Aucun téléchargement actif
      </h3>

      <p>
        Le tuyau est actuellement vide.
      </p>

    </div>
  `;
}


/* =========================================================
   TOOLS
   ========================================================= */

const HORIZON_TOOLS = [
  { id:"dim", name:"DIM", description:"Destiny Item Manager.", url:"https://app.destinyitemmanager.com/", logo:"./assets/tools/dim.png" },
  { id:"bungie", name:"Bungie.net", description:"Official Bungie Destiny portal.", url:"https://www.bungie.net/7/en/Destiny", logo:"./assets/tools/bungie.png" },
  { id:"raidhub", name:"RaidHub", description:"Raid performance, clears and leaderboards.", url:"https://raidhub.io/", logo:"./assets/tools/raidhub.png" },
  { id:"raidreport", name:"Raid Report", description:"Raid statistics and clears.", url:"https://raid.report/", logo:"./assets/tools/raidreport.png" },
  { id:"dungeonreport", name:"Dungeon Report", description:"Dungeon clears, speedruns and leaderboards.", url:"https://dungeon.report/", logo:"./assets/tools/dungeonreport.png" },
  { id:"trialsreport", name:"Trials Report", description:"Trials of Osiris statistics.", url:"https://trials.report/", logo:"./assets/tools/trialsreport.png" },
  { id:"braytech", name:"Bray.tech", description:"Destiny progression, collections and activity data.", url:"https://bray.tech/", logo:"./assets/tools/braytech.png" },
  { id:"lightgg", name:"Light.gg", description:"Destiny database and item rolls.", url:"https://www.light.gg/", logo:"./assets/tools/lightgg.png" },
  { id:"d2foundry", name:"D2Foundry", description:"Weapon crafting and perk analysis.", url:"https://d2foundry.gg/", logo:"./assets/tools/d2foundry.png" },
  { id:"d2armorpicker", name:"D2ArmorPicker", description:"Build and armor optimization.", url:"https://d2armorpicker.com/", logo:"./assets/tools/d2armorpicker.ico" },
  { id:"todayindestiny", name:"TodayInDestiny", description:"Daily activities and rotations.", url:"https://www.todayindestiny.com/", logo:"./assets/tools/todayindestiny.png" },
  { id:"speedrun", name:"Speedrun.com", description:"Destiny 2 speedrun leaderboards and records.", url:"https://www.speedrun.com/destiny2", logo:"./assets/tools/speedrun.png" }
];

function renderTools() {
  return `
    <div class="page-head">
      <span class="section-label">DESTINY 2 TOOLS</span>
      <h2>Tools</h2>
      <p>Quick access to the Destiny 2 tools used by the Horizon community.</p>
    </div>

    <div class="grid tools-grid">
      ${HORIZON_TOOLS.map(tool => `
        <article class="card tool-card">
          <div class="tool-card-head">
            <div class="tool-icon"><img src="${tool.logo}" alt="" draggable="false"></div>
            <span class="badge">EXTERNAL</span>
          </div>
          <h3>${escapeHtml(tool.name)}</h3>
          <p>${escapeHtml(tool.description)}</p>
          <div class="tool-actions">
            <button class="button primary" data-tool-open="${tool.id}">OPEN</button>
            <button class="button" data-tool-copy="${tool.id}">COPY LINK</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}


/* =========================================================
   THEMES
   ========================================================= */

function renderThemes() {

  const order = [
    "destiny2",
    "destiny1",
    "hive",
    "cabal",
    "fallen",
    "corrupted",
    "aria",
    "vex",
    "beta",
    "opulence"
  ];


  return `
    <div class="page-head">

      <span class="section-label">
        ART DIRECTION SYSTEM
      </span>

      <h2>
        Themes
      </h2>

      <p>
        Themes change the complete
        Horizon Manager appearance and persist after restart.
      </p>

    </div>


    <div class="theme-grid">

      ${order.map(key => {

        const theme = THEMES[key];

        const unlocked =
          canUseTheme({ ...theme, id: key });

        const selected =
          activeTheme === key;

        const logo =
          createThemeLogo(theme);


        return `
          <article
            class="
              card
              theme-card
              ${selected ? "selected" : ""}
              ${unlocked ? "" : "locked"}
            "
            data-theme-choice="${key}"
          >

            <div class="theme-preview theme-preview--${escapeHtml(key)}"
              style="--theme-art:url('${getThemeAsset(({
                destiny2:"destiny2-art.png",
                destiny1:"destiny2-art.png",
                hive:"hive-art.png",
                cabal:"cabal-art.png",
                fallen:"fallen-art.png",
                corrupted:"corrupted-art.png",
                aria:"aria-art.png",
                vex:"vex-art.png",
                beta:"beta-art-fixed.png",
                opulence:"opulence-art.png"
              })[key] || "")}')">
              <div class="theme-preview-art" aria-hidden="true"></div>
              ${logo}
            </div>


            <div class="theme-body">

              ${""}

              <h3>
                ${escapeHtml(theme.name)}
              </h3>

              <p>
                ${escapeHtml(themeDescription(key, theme))}
              </p>

              ${
                selected
                  ? `<small>${languageText("active")}</small>`
                  : ""
              }

            </div>

          </article>
        `;

      }).join("")}

    </div>


    <div class="info-box">

      <strong>${languageText("access")}</strong>

      Standard themes are available to everyone.
      Vex requires the Creator badge.
      BETA is reserved for the selected BETA accounts.

    </div>
  `;
}


/* =========================================================
   SETTINGS
   ========================================================= */

function renderSettings() {
  return `
    <div class="page-head">

      <span class="section-label">
        ${languageText("application")}
      </span>

      <h2>
        ${languageText("settings")}
      </h2>

      <p>
        ${languageText("configuration")}
      </p>

    </div>


    <div class="settings">

      <div class="setting language-setting">
        <div class="setting-copy">
          <strong>${languageText("language")}</strong>
          <small>${languageText("languageHint")}</small>
        </div>
        <label class="language-select-wrap" aria-label="${languageText("language")} ">
          <img class="language-current-flag" src="./assets/flags/${LANGUAGE_FLAGS[activeLanguage] || "gb.svg"}" alt="">
          <select id="language-select" class="language-select">
            ${Object.entries(LANGUAGES).map(([code, lang]) => `
              <option value="${code}" ${code === activeLanguage ? "selected" : ""}>
                ${escapeHtml(lang.name)}
              </option>
            `).join("")}
          </select>
          <span class="language-chevron">⌄</span>
        </label>
      </div>

      <div class="setting">
        <div>
          <strong>${languageText("theme")}</strong>
          <small>${escapeHtml(THEMES[activeTheme].name)}</small>
        </div>
        <button class="button ghost" data-route="themes">${languageText("change")}</button>
      </div>

      <div class="setting">
        <div>
          <strong>${languageText("accent")}</strong>
          <small>${languageText("accentHint")}</small>
        </div>
        <div class="color-control">
          <div class="accent-presets">
            ${["#d9c18a","#7cc7ff","#9baf70","#e34a43","#b48cff","#ff78b7","#62d7d0","#ffffff"].map(color => `<button class="accent-preset" type="button" data-accent="${color}" style="background:${color}" aria-label="${color}"></button>`).join("")}
          </div>
          <input id="accent-picker" class="accent-picker" type="color" value="${accentColor || "#d9c18a"}" aria-label="${languageText("accent")}">
        </div>
      </div>


      <div class="setting">

        <div>
          <strong>
            ${languageText("search")}
          </strong>

          <small>
            ${languageText("searchHint")}
          </small>
        </div>

        <span class="meta">
          ${languageText("active")}
        </span>

      </div>


      <div class="setting">

        <div>
          <strong>
            ${languageText("version")}
          </strong>

          <small>
            Horizon Manager ${HORIZON_VERSION}
          </small>
        </div>

        <span class="meta">
          Windows x64
        </span>

      </div>

      <div class="setting redeem-setting">
        <div>
          <strong>Redeem Code</strong>
          <small>Redeem BETA, Creator or First Light access codes.</small>
        </div>
        <div class="redeem-control">
          <input id="redeem-code" class="redeem-input" type="text" maxlength="64" placeholder="HZN-FIRST-XXXXXXXXXXXXXXXXXXXXXXXXXX" autocomplete="off">
          <button class="button primary" type="button" data-redeem-code>REDEEM</button>
        </div>
      </div>

    </div>
  `;
}


/* =========================================================
   ACCOUNT
   ========================================================= */

function renderAccount() {
  return `
    <div class="page-head">
      <span class="section-label">HORIZON ACCOUNT</span>
      <h2>${languageText("account")}</h2>
      <p>Your local Horizon account and entitlement profile.</p>
    </div>

    <div class="settings">
      <div class="setting">
        <div>
          <strong>Account status</strong>
          <small>Local entitlement profile</small>
        </div>
        <span class="meta">${accountStatus().toUpperCase()}</span>
      </div>

      <div class="setting">
        <div>
          <strong>BETA access</strong>
          <small>${USER.betaAccess ? "BETA theme unlocked" : "Redeem a BETA code to unlock it."}</small>
        </div>
        <span class="meta">${USER.betaAccess ? "BETA" : "LOCKED"}</span>
      </div>

      <div class="setting">
        <div>
          <strong>Creator access</strong>
          <small>${USER.creatorBadge ? "Creator theme and Creator area unlocked." : "Redeem a Creator code to unlock it."}</small>
        </div>
        <span class="meta">${USER.creatorBadge ? "CREATOR" : "LOCKED"}</span>
      </div>

      <div class="setting avatar-setting">
        <div>
          <strong>Profile picture</strong>
          <small>PNG, JPG, WEBP or GIF. Maximum 2 MB. Stored locally on this PC.</small>
        </div>
        <div>
          <input id="profile-avatar-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
          <button class="button ghost" type="button" data-avatar-picker>CHANGE PHOTO</button>
        </div>
      </div>
    </div>
  `;
}


/* =========================================================
   CREATOR
   ========================================================= */

function renderCreator() {
  if (!USER.creatorBadge) {
    return `
      <div class="empty">
        <h3>Creator area locked</h3>
        <p>Redeem a Creator code to unlock the Creator workspace.</p>
      </div>
    `;
  }

  return `
    <div class="page-head">
      <span class="section-label">CREATOR PROGRAM</span>
      <h2>Creator</h2>
      <p>Submit a mod upload request. The Horizon team can review the request before publication.</p>
    </div>

    <div class="settings creator-request-card">
      <div class="setting">
        <div>
          <strong>Mod title</strong>
          <small>Name shown to the Horizon team.</small>
        </div>
        <input id="creator-mod-title" class="redeem-input" maxlength="255" placeholder="My Destiny Mod">
      </div>

      <div class="setting">
        <div>
          <strong>Game / environment</strong>
          <small>Choose where the mod belongs.</small>
        </div>
        <select id="creator-mod-game" class="creator-select">
          <option value="destiny2">Destiny 2</option>
          <option value="dawn">Dawn</option>
          <option value="sunrise">SunRise</option>
          <option value="sundial">Sundial</option>
        </select>
      </div>

      <div class="setting">
        <div>
          <strong>Description</strong>
          <small>Explain what the mod does and what players need.</small>
        </div>
        <textarea id="creator-mod-description" class="creator-textarea" maxlength="5000" placeholder="Describe your mod..."></textarea>
      </div>

      <div class="setting">
        <div>
          <strong>Category / version</strong>
          <small>Use a clear category and semantic project version.</small>
        </div>
        <div class="creator-file-control">
          <select id="creator-mod-category" class="creator-select">
            <option>Custom Weapon</option><option>Destiny Weapon</option><option>Custom Mission</option><option>Strike Remake</option><option>Raid</option><option>Utility</option><option>Other</option>
          </select>
          <input id="creator-mod-version" class="redeem-input" maxlength="50" value="1.0.0" placeholder="1.0.0">
        </div>
      </div>

      <div class="setting">
        <div>
          <strong>Changelog</strong>
          <small>Tell players what changed in this release.</small>
        </div>
        <textarea id="creator-mod-changelog" class="creator-textarea" maxlength="5000" placeholder="Initial release..."></textarea>
      </div>

      <div class="setting">
        <div>
          <strong>Mod file</strong>
          <small>Maximum 2 GB metadata for now. The request is reviewed before upload publication.</small>
        </div>
        <div class="creator-file-control">
          <input id="creator-mod-file" type="file" hidden>
          <button class="button ghost" type="button" data-creator-file>SELECT FILE</button>
          <span id="creator-file-name" class="meta">No file selected</span>
        </div>
      </div>

      <div class="setting">
        <div>
          <strong>Submit request</strong>
          <small>This creates a pending Creator upload request in Horizon Portal.</small>
        </div>
        <button class="button primary" type="button" data-mod-request>REQUEST UPLOAD</button>
      </div>
    </div>
  `;
}

async function submitCreatorModRequest() {
  const file = document.getElementById("creator-mod-file")?.files?.[0];
  const title = document.getElementById("creator-mod-title")?.value?.trim() || "";
  const game = document.getElementById("creator-mod-game")?.value || "";
  const description = document.getElementById("creator-mod-description")?.value?.trim() || "";
  const version = document.getElementById("creator-mod-version")?.value?.trim() || "1.0.0";
  const changelog = document.getElementById("creator-mod-changelog")?.value?.trim() || "";
  const category = document.getElementById("creator-mod-category")?.value?.trim() || "Other";

  if (!USER.installationCredential) {
    showToast("Creator authentication is required. Redeem your Creator access first.");
    return;
  }
  if (!title || !file) {
    showToast("Add a mod title and select a ZIP package.");
    return;
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    showToast("Only ZIP Workshop packages are accepted.");
    return;
  }
  if (file.size > 512 * 1024 * 1024) {
    showToast("The package is larger than 512 MiB.");
    return;
  }

  const button = document.querySelector("[data-mod-request]");
  if (button) {
    button.disabled = true;
    button.textContent = "UPLOADING...";
  }

  try {
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    form.append("game", game);
    form.append("description", description);
    form.append("version", version);
    form.append("changelog", changelog);
    form.append("category", category);

    const response = await fetch(`${HORIZON_API}/api/launcher/mod-upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${USER.installationCredential}` },
      body: form
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Upload failed.");

    showToast(`Submission #${data.request_id} is ${data.status}.`);
    document.getElementById("creator-mod-title").value = "";
    document.getElementById("creator-mod-description").value = "";
    document.getElementById("creator-mod-file").value = "";
    document.getElementById("creator-file-name").textContent = "No file selected";
  } catch (error) {
    console.error("[Horizon] Creator upload failed:", error);
    showToast(error?.message || "Unable to upload the package.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "SUBMIT FOR REVIEW";
    }
  }
}

/* =========================================================
   ROUTER
   ========================================================= */

function render(route = currentRoute) {

  currentRoute = route;


  const labels = {

    home: [
      "HORIZON MANAGER",
      "Accueil"
    ],

    workshop: [
      "COMMUNITY WORKSHOP",
      "Workshop"
    ],

    library: [
      "LOCAL LIBRARY",
      "Library"
    ],

    downloads: [
      "DOWNLOAD CENTER",
      "Downloads"
    ],

    tools: [
      "DESTINY 2 TOOLS",
      "Tools"
    ],

    themes: [
      "ART DIRECTION SYSTEM",
      "Themes"
    ],

    settings: [
      "APPLICATION",
      "Settings"
    ],

    account: [
      "HORIZON ACCOUNT",
      "Account"
    ],

    creator: [
      "CREATOR PROGRAM",
      "Creator"
    ]

  };


  const label =
    labels[route] || labels.home;


  if (eyebrow) {
    eyebrow.textContent = label[0];
  }

  if (title) {
    title.textContent = languageText(route);
  }


  if (route === "home") {
    page.innerHTML = renderHome();
  }

  if (route === "workshop") {
    page.innerHTML =
      renderWorkshop(
        searchInput
          ? searchInput.value
          : ""
      );
    refreshWorkshop();
  }

  if (route === "library") {
    page.innerHTML =
      renderLibrary(
        searchInput
          ? searchInput.value
          : ""
      );
  }

  if (route === "downloads") {
    page.innerHTML = renderDownloads();
  }

  if (route === "tools") {
    page.innerHTML = renderTools();
  }

  if (route === "themes") {
    page.innerHTML = renderThemes();
  }

  if (route === "settings") {
    page.innerHTML = renderSettings();
  }

  if (route === "account") {
    page.innerHTML = renderAccount();
  }

  if (route === "creator") {
    page.innerHTML = renderCreator();
  }


  page.insertAdjacentHTML("afterbegin", renderThemeFrame());

  nav();
  applyLanguage();

  bind();
}


/* =========================================================
   EVENTS
   ========================================================= */

function bind() {

  document.querySelectorAll("[data-select-local]").forEach(element => {
    element.addEventListener("click", () => {
      const kind = element.dataset.selectLocal;
      const labels = { destiny2: "Destiny 2", dawn: "Dawn", sunrise: "SunRise", sundial: "Sundial" };
      chooseLocalExecutable(kind, labels[kind] || kind);
    });
  });

  document.querySelectorAll("[data-redeem-code]").forEach(element => {
    element.addEventListener("click", () => {
      const input = document.getElementById("redeem-code");
      redeemCode(input?.value || "");
    });
  });

  document.querySelectorAll("[data-refresh-workshop]").forEach(element => {
    element.addEventListener("click", () => checkForUpdates(true));
  });

  document.querySelectorAll("[data-tool-open]").forEach(element => {
    element.addEventListener("click", () => {
      const tool = HORIZON_TOOLS.find(item => item.id === element.dataset.toolOpen);
      if (tool) openExternal(tool.url);
    });
  });

  document.querySelectorAll("[data-tool-copy]").forEach(element => {
    element.addEventListener("click", async () => {
      const tool = HORIZON_TOOLS.find(item => item.id === element.dataset.toolCopy);
      if (!tool) return;
      try {
        await navigator.clipboard.writeText(tool.url);
        showToast(`${tool.name} link copied.`);
      } catch {
        showToast("Unable to copy the link.");
      }
    });
  });

  document.getElementById("workshop-sort")?.addEventListener("change", event => {
    workshopSort = event.target.value;
    page.innerHTML = renderWorkshop(searchInput?.value || "");
    bind();
    const sortSelect = document.getElementById("workshop-sort");
    if (sortSelect) sortSelect.value = workshopSort;
  });

  document.querySelectorAll("[data-vote]").forEach(element => {
    element.addEventListener("click", async () => {
      if (!USER.installationCredential) {
        const ready = await ensureGuestInstallation();
        if (!ready) {
          showToast("Unable to prepare your free voting profile. Try again shortly.");
          return;
        }
      }
      const score = Number(element.parentElement?.querySelector("[data-vote-score]")?.value || 5);
      try {
        const response = await fetch(`${HORIZON_API}/api/launcher/workshop/${element.dataset.vote}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${USER.installationCredential}` },
          body: JSON.stringify({ score })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Vote failed.");
        await refreshWorkshop();
        showToast("Your vote was recorded.");
      } catch (error) { showToast(error.message || "Vote failed."); }
    });
  });

  document.querySelectorAll("#redeem-code").forEach(input => {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") redeemCode(input.value);
    });
  });

  document.querySelectorAll("[data-launch-local]").forEach(element => {
    element.addEventListener("click", () => launchLocalProject(element.dataset.launchLocal));
  });

  document.querySelectorAll("[data-open-local-folder]").forEach(element => {
    element.addEventListener("click", () => openLocalProjectFolder(element.dataset.openLocalFolder));
  });

  const usernameSetup = document.getElementById("username-setup");
  const usernameInput = document.getElementById("username-setup-input");
  const usernameSubmit = document.getElementById("username-setup-submit");
  const completeUsernameSetup = () => {
    const username = usernameInput?.value.trim() || "";
    if (username.length < 2 || username.length > 24) {
      usernameInput?.focus();
      showToast("Choose a username between 2 and 24 characters.");
      return;
    }
    USER.username = username;
    localStorage.setItem("horizon-username", username);
    usernameSetup?.classList.remove("open");
    usernameSetup?.setAttribute("aria-hidden", "true");
    usernameSetup?.setAttribute("aria-hidden", "true");
    updateProfileUI();
  };
  usernameSubmit?.addEventListener("click", completeUsernameSetup);
  document.getElementById("update-check-button")?.addEventListener("click", () => checkForUpdates(true));
  usernameInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") completeUsernameSetup();
  });

  const avatarPicker = document.querySelector("[data-avatar-picker]");
  const avatarInput = document.getElementById("profile-avatar-input");
  avatarPicker?.addEventListener("click", () => avatarInput?.click());
  avatarInput?.addEventListener("change", event => setLocalAvatar(event.target.files?.[0]));

  const creatorFileButton = document.querySelector("[data-creator-file]");
  const creatorFileInput = document.getElementById("creator-mod-file");
  const creatorFileName = document.getElementById("creator-file-name");
  creatorFileButton?.addEventListener("click", () => creatorFileInput?.click());
  creatorFileInput?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (creatorFileName) creatorFileName.textContent = file ? file.name : "No file selected";
  });
  document.querySelector("[data-mod-request]")?.addEventListener("click", submitCreatorModRequest);

  const languageSelect = document.getElementById("language-select");
  languageSelect?.addEventListener("change", event => {
    setLanguage(event.target.value);
  });

  const accentPicker = document.getElementById("accent-picker");
  accentPicker?.addEventListener("input", event => setAccent(event.target.value));

  document.querySelectorAll("[data-accent]").forEach(element => {
    element.addEventListener("click", () => setAccent(element.dataset.accent));
  });

  document
    .querySelectorAll("[data-route]")
    .forEach(element => {

      element.onclick = () => {
        render(element.dataset.route);
      };

    });


  document
    .querySelectorAll("[data-external]")
    .forEach(element => {

      element.onclick = () => {
        openExternal(
          element.dataset.external
        );
      };

    });


  document
    .querySelectorAll("[data-theme-choice]")
    .forEach(element => {

      element.onclick = () => {
        setTheme(
          element.dataset.themeChoice
        );
      };

    });


  /*
     Vérification des images.
     Si une image ne se charge pas, on log le chemin
     exact dans la console Tauri.
  */

  document
    .querySelectorAll("[data-theme-image]")
    .forEach(image => {

      image.addEventListener(
        "load",
        () => {
          console.log(
            `[Horizon] Theme asset loaded: ${image.dataset.themeImage}`
          );
        },
        { once: true }
      );


      image.addEventListener(
        "error",
        () => {
          console.error(
            `[Horizon] Theme asset NOT FOUND: ${image.dataset.themeImage}`
          );

          console.error(
            `[Horizon] Resolved URL: ${getThemeAsset(
              image.dataset.themeImage
            )}`
          );
        },
        { once: true }
      );

    });

}


/* =========================================================
   SEARCH
   ========================================================= */

if (searchInput) {

  searchInput.addEventListener(
    "input",
    () => {

      if (currentRoute === "library") {
        page.innerHTML = renderLibrary(searchInput.value);
        bind();
      }

      if (currentRoute === "workshop") {
        page.innerHTML = renderWorkshop(searchInput.value);
        bind();
      }

    }
  );

}


/* =========================================================
   CTRL + K
   ========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "k"
    ) {

      if (currentRoute !== "library") {

        event.preventDefault();

        showToast(languageText("searchOnly"));

        return;
      }


      if (searchInput) {

        event.preventDefault();

        searchInput.focus();

      }

    }

  }
);


/* =========================================================
   START
   ========================================================= */

async function setupAppIcon() {
  try {
    const api = window.__TAURI__;
    const Image = api?.image?.Image;
    const getCurrentWindow = api?.window?.getCurrentWindow;
    if (!Image || !getCurrentWindow) return;

    const response = await fetch("./assets/horizon-favicon.ico");
    if (!response.ok) throw new Error("Unable to load horizon-favicon.ico");

    const bytes = new Uint8Array(await response.arrayBuffer());
    const icon = await Image.fromBytes(bytes);
    await getCurrentWindow().setIcon(icon);
    await icon.close();

    console.log("[Horizon] Taskbar icon set from favicon.ico");
  } catch (error) {
    console.error("[Horizon] Failed to set taskbar icon:", error);
  }
}

render();
updateProfileUI();
setupAppIcon();
refreshLocalEntitlements();
ensureGuestInstallation();
ensureUsername();
checkForUpdates(false);

document.addEventListener("contextmenu", event => event.preventDefault());
