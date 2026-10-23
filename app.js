/* ============================================================
   Safe Route — application logic
   ============================================================ */

(() => {
  "use strict";

  const MINUTE = 60 * 1000;
  const STORAGE_KEY = "safe-route-v1";
  const DEFAULT_EMERGENCY_NUMBER = "112";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const appShell = $("#app");
  const watchView = $("#watchView");
  const modalRoot = $("#modalRoot");
  const toastRoot = $("#toastRoot");
  const sosDock = $(".sos-dock");
  const sosButton = $("#sosButton");

  let state = null;
  let isWatchMode = false;
  let watchData = null;
  let watchSourceLive = false;
  let lastJourneyStatus = null;
  let lastWatchStatus = null;
  let modalReturnFocus = null;
  let toastCounter = 0;

  let holdAnimationFrame = null;
  let holdTimeout = null;
  let holdStartedAt = 0;
  let holdTriggered = false;
  let suppressSosClick = false;
  const dueNotifications = new Set();
  const overdueNotifications = new Set();

  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });

  const icons = {
    check: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.4 3.4L15.5 6"/></svg>`,
    share: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="15" cy="4.5" r="2.3"/><circle cx="5" cy="10" r="2.3"/><circle cx="15" cy="15.5" r="2.3"/><path d="m7 9 5.8-3.3M7 11l5.8 3.3"/></svg>`,
    route: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="5" cy="15" r="2"/><circle cx="15" cy="5" r="2"/><path d="M7 15h3a3 3 0 0 0 3-3V8"/></svg>`,
    alert: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 19 18H1L10 2Z"/><path d="M10 7v5M10 15.2v.1"/></svg>`,
    arrived: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10.5 8 15 17 5"/><path d="M3 4v6h6"/></svg>`,
    bell: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.8 7.2a5.8 5.8 0 0 0-11.6 0c0 6.8-2.9 6.8-2.9 8.8h17.4c0-2-2.9-2-2.9-8.8M11.6 18a2 2 0 0 1-3.2 0"/></svg>`,
    pin: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 8.4c0 4.4-6 9.6-6 9.6s-6-5.2-6-9.6a6 6 0 1 1 12 0Z"/><circle cx="10" cy="8.4" r="2.1"/></svg>`,
    phone: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.7 3H4.4A1.4 1.4 0 0 0 3 4.4c0 7 5.6 12.6 12.6 12.6a1.4 1.4 0 0 0 1.4-1.4v-2.3l-3.4-1.1-1.5 1.8a10 10 0 0 1-4.1-4.1L9.8 8 6.7 3Z"/></svg>`,
    message: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M17 12.2a2.2 2.2 0 0 1-2.2 2.2H6l-3 2.2V4.8A2.2 2.2 0 0 1 5.2 2.6h9.6A2.2 2.2 0 0 1 17 4.8v7.4Z"/></svg>`,
    location: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 8.4c0 4.4-6 9.6-6 9.6s-6-5.2-6-9.6a6 6 0 1 1 12 0Z"/><circle cx="10" cy="8.4" r="2.1"/></svg>`,
    shield: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.2 16.6 5v4.5c0 3.9-2.8 7-6.6 8.3-3.8-1.3-6.6-4.4-6.6-8.3V5L10 2.2Z"/><path d="m7.1 9.7 1.9 1.9 4-4"/></svg>`,
    arrow: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5"/></svg>`,
    close: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg>`,
    copy: `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="7" width="9" height="10" rx="1"/><path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3H5.7A1.7 1.7 0 0 0 4 4.7v8.6A1.7 1.7 0 0 0 5.7 15H7"/></svg>`,
    whatsapp: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M17 9.7a7 7 0 0 1-10.4 6.1L3 17l1.2-3.4A7 7 0 1 1 17 9.7Z"/><path d="M7.4 6.4c.2-.3.4-.3.7-.3h.2c.2 0 .3.1.4.4l.5 1.1c.1.2 0 .4-.1.5l-.4.5c-.1.1-.2.3 0 .6.4.7 1 1.2 1.7 1.6.3.1.4.1.6-.1l.5-.6c.1-.2.3-.2.5-.1l1.1.5c.2.1.3.2.3.4 0 .2-.2 1-.6 1.3-.4.3-.8.4-1.4.3-1.7-.3-3.5-1.9-4.2-3.8-.2-.5-.2-1 .1-1.5l.1-.5Z" fill="currentColor" stroke="none"/></svg>`,
    mail: `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4" width="15" height="12" rx="1.5"/><path d="m3 5 7 5.5L17 5"/></svg>`,
    more: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  };

  const activityIcons = {
    checkin: icons.check,
    shared: icons.share,
    started: icons.route,
    overdue: icons.alert,
    sos: icons.alert,
    arrived: icons.arrived,
  };

  /* ---------- Utilities ---------- */

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function uid(prefix = "evt") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function sanitizePhone(value) {
    const cleaned = String(value ?? "").replace(/[^\d+]/g, "");
    return cleaned || "+112";
  }

  function sanitizeEmergencyNumber(value) {
    const cleaned = String(value ?? "").replace(/[^\d+]/g, "").slice(0, 8);
    return cleaned || DEFAULT_EMERGENCY_NUMBER;
  }

  function getRoutingApiKey() {
    return String(state?.routingApiKey || "").trim();
  }

  function formatTime(timestamp) {
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return "--:--";
    return timeFormatter.format(date);
  }

  function formatLongDate(date = new Date()) {
    return dateFormatter.format(date);
  }

  function formatShortDate(timestamp) {
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return "—";
    return shortDateFormatter.format(date);
  }

  function formatCountdown(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  function minutesLabel(milliseconds) {
    const minutes = Math.max(0, Math.round(milliseconds / MINUTE));
    if (minutes < 1) return "less than a minute";
    return `${minutes} min`;
  }

  function timeAgo(timestamp) {
    const diff = Date.now() - Number(timestamp);
    if (!Number.isFinite(diff) || diff < 45 * 1000) return "just now";
    if (diff < 60 * MINUTE) return `${Math.floor(diff / MINUTE)} min ago`;
    if (diff < 24 * 60 * MINUTE) return `${Math.floor(diff / (60 * MINUTE))} hr ago`;
    if (diff < 48 * 60 * MINUTE) return "yesterday";
    return `${Math.floor(diff / (24 * 60 * MINUTE))} days ago`;
  }

  function initials(name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase() || "YOU";
  }

  function ellipsize(value, max = 52) {
    const text = String(value ?? "");
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  /* ---------- Data ---------- */

  function createDemoState() {
    const now = Date.now();
    const startedAt = now - 18 * MINUTE;
    const lastCheckIn = now - 6 * MINUTE;
    const expectedAt = now + 28 * MINUTE;
    const contact = {
      name: "Maya Chen",
      relation: "Sister",
      phone: "+14155550184",
      email: "maya@example.com",
    };
    const journey = {
      id: "SR-2481",
      destination: "Riverside Station",
      origin: "Hawthorne Ave",
      startedAt,
      expectedAt,
      lastCheckIn,
      checkInInterval: 15 * MINUTE,
      demo: true,
      status: "active",
      overdueLogged: false,
      originCoords: { lat: 28.4744, lng: 77.504 },
      destinationCoords: { lat: 28.4595, lng: 77.508 },
    };
    const activities = [
      {
        id: uid(),
        type: "checkin",
        title: "Checked in — all good",
        detail: "Check-in saved to your safety history.",
        at: lastCheckIn,
        journeyId: journey.id,
      },
      {
        id: uid(),
        type: "shared",
        title: "Route shared with Maya Chen",
        detail: "Private journey view sent by message.",
        at: now - 16 * MINUTE,
        journeyId: journey.id,
      },
      {
        id: uid(),
        type: "started",
        title: "Journey started",
        detail: "Heading from Hawthorne Ave to Riverside Station.",
        at: startedAt,
        journeyId: journey.id,
      },
      {
        id: uid(),
        type: "arrived",
        title: "Arrived safely at Willow Courts",
        detail: "Previous journey · 8:42 min check-in completed.",
        at: now - 21 * 60 * MINUTE,
        journeyId: "SR-2394",
      },
    ];

    return {
      version: 1,
      user: { name: "Alex Rivera" },
      contact,
      emergencyNumber: "112",
      routingApiKey: "",
      journey,
      activities,
      createdAt: now,
    };
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return null;
      if (!parsed.contact) parsed.contact = createDemoState().contact;
      if (!parsed.activities) parsed.activities = [];
      if (!Array.isArray(parsed.activities)) parsed.activities = [];
      if (!parsed.user) parsed.user = { name: "Alex Rivera" };
      if (!parsed.emergencyNumber) parsed.emergencyNumber = DEFAULT_EMERGENCY_NUMBER;
      if (!parsed.routingApiKey) parsed.routingApiKey = "";
      return parsed;
    } catch {
      return null;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Local storage can be unavailable in private contexts. The experience still works for this session. */
    }
  }

  function addActivity(type, title, detail, at = Date.now()) {
    state.activities.unshift({
      id: uid(),
      type,
      title,
      detail,
      at,
      journeyId: state.journey?.id || null,
    });
    state.activities = state.activities.slice(0, 40);
    saveState();
  }

  function getJourneyStatus(now = Date.now()) {
    if (!state?.journey || state.journey.status !== "active") {
      return { key: "idle", label: "No active route", notice: null };
    }

    const overdue = now > state.journey.expectedAt;
    const dueAt = state.journey.lastCheckIn + state.journey.checkInInterval;
    const checkInDue = now >= dueAt;
    const contactName = state.contact?.name?.split(" ")[0] || "your contact";

    if (overdue) {
      return {
        key: "overdue",
        label: "Arrival overdue",
        notice: {
          title: "Arrival time passed",
          copy: `Check in with an updated estimate so ${contactName} isn't left guessing.`,
          action: "Check in",
        },
        dueAt,
      };
    }

    if (checkInDue) {
      return {
        key: "due",
        label: "Check-in due",
        notice: {
          title: "Check-in due",
          copy: `Let ${contactName} know you're still okay.`,
          action: "Check in",
        },
        dueAt,
      };
    }

    return {
      key: "onroute",
      label: "Live journey",
      notice: null,
      dueAt,
    };
  }

  /* ---------- Rendering: shared chrome ---------- */

  function updateClock() {
    const now = new Date();
    const dateEl = $("#currentDate");
    const clockEl = $("#currentClock");
    if (dateEl) dateEl.textContent = formatLongDate(now);
    if (clockEl) clockEl.textContent = timeFormatter.format(now);
  }

  function renderBrandMark() {
    return `
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="20" fill="#d4935d"/>
          <path d="M9 19.5C9 13.7 13.9 9 20 9s11 4.7 11 10.5H9Z" fill="none" stroke="#160b0d" stroke-width="2.2"/>
          <path d="M20 19.5v8.7a3.7 3.7 0 0 0 7.4 0v-1.5" fill="none" stroke="#160b0d" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M20 9v10.5" stroke="#160b0d" stroke-width="1.2" opacity=".45"/>
        </svg>
      </span>`;
  }

  function applyContactLinks() {
    const contact = state?.contact;
    if (!contact) return;
    const phone = sanitizePhone(contact.phone);
    const callContact = $("#callContact");
    const toolkitMessage = $("#toolkitMessage");
    const textContact = $("#textContact");
    if (callContact) callContact.href = `tel:${phone}`;
    if (toolkitMessage) {
      toolkitMessage.href = `sms:${phone}?&body=${encodeURIComponent(
        `Hey ${contact.name.split(" ")[0]}, just checking in. All good here.`
      )}`;
    }
    if (textContact) textContact.dataset.phone = phone;
  }

  function applyEmergencyLinks() {
    const emergencyNumber = getEmergencyNumber();
    const callLink = $("#toolkitEmergencyCall");
    const numberLabel = $("#toolkitEmergencyNumber");
    if (callLink) callLink.href = `tel:${emergencyNumber}`;
    if (numberLabel) numberLabel.textContent = emergencyNumber;
  }

  function renderContact() {
    if (!state?.contact) return;
    const contact = state.contact;
    const firstName = contact.name.split(" ")[0] || "contact";
    $("#contactAvatar").firstChild.nodeValue = initials(contact.name);
    $("#contactNameCard").textContent = contact.name;
    $("#contactRelation").textContent = `${contact.relation || "Trusted contact"} · Primary contact`;
    $("#contactNameInline").textContent = firstName;
    const toolkitMessage = $("#toolkitMessage");
    if (toolkitMessage) {
      $(".toolkit-copy strong", toolkitMessage).textContent = `Message ${firstName}`;
    }
    applyContactLinks();
  }

  /* ---------- Rendering: journey ---------- */

  function renderSystemState(statusKey) {
    const wrapper = $("#systemState");
    const label = $("#systemStateText");
    if (!wrapper || !label) return;

    wrapper.classList.remove("is-idle", "is-warn");
    if (statusKey === "idle") {
      wrapper.classList.add("is-idle");
      label.textContent = "Ready when you are";
    } else if (statusKey === "due") {
      wrapper.classList.add("is-warn");
      label.textContent = "Check-in due";
    } else if (statusKey === "overdue") {
      wrapper.classList.add("is-warn");
      label.textContent = "Arrival overdue";
    } else {
      label.textContent = "Route live";
    }
  }

  function renderJourneyNotice(status) {
    const notice = $("#journeyNotice");
    if (!notice) return;

    if (!status.notice) {
      notice.hidden = true;
      notice.innerHTML = "";
      return;
    }

    notice.hidden = false;
    notice.className = `journey-notice${status.key === "overdue" ? " is-overdue" : ""}`;
    notice.innerHTML = `
      <span class="notice-icon">${icons.bell}</span>
      <div class="notice-copy">
        <strong>${escapeHTML(status.notice.title)}</strong>
        <span>${escapeHTML(status.notice.copy)}</span>
      </div>
      <button class="notice-action" type="button" data-action="checkin">${escapeHTML(status.notice.action)}</button>`;
  }

  function applyJourneyStatusChrome(status) {
    const flag = $(".journey-flag");
    const label = $("#journeyStatusLabel");
    if (!flag || !label) return;

    flag.classList.remove("is-due", "is-overdue", "is-idle");
    if (status.key === "due") flag.classList.add("is-due");
    if (status.key === "overdue") flag.classList.add("is-overdue");
    if (status.key === "idle") flag.classList.add("is-idle");
    label.textContent = status.label;

    renderJourneyNotice(status);
    renderSystemState(status.key);
  }

  function updateJourneyLiveFields(status) {
    if (!state?.journey) return;
    const now = Date.now();
    const journey = state.journey;
    const remaining = journey.expectedAt - now;
    const overdue = remaining < 0;
    const countdown = $("#countdownText");
    const countdownLabel = $("#countdownLabel");
    const etaSub = $("#etaSub");
    const etaText = $("#etaText");
    const checkinDueText = $("#checkinDueText");
    const lastCheckinText = $("#lastCheckinText");
    const progressBar = $("#journeyProgressBar");
    const countdownTime = overdue ? formatCountdown(Math.abs(remaining)) : formatCountdown(remaining);

    if (countdown) {
      countdown.textContent = overdue ? `+${countdownTime}` : countdownTime;
      countdown.classList.toggle("is-overdue", overdue);
    }
    if (countdownLabel) countdownLabel.textContent = overdue ? "Arrival overdue" : "Arriving in";
    if (etaText) etaText.textContent = formatTime(journey.expectedAt);
    if (etaSub) {
      etaSub.textContent = overdue
        ? `${minutesLabel(Math.abs(remaining))} past ETA`
        : remaining < MINUTE
          ? "arriving now"
          : `in ${minutesLabel(remaining)}`;
    }
    if (checkinDueText) {
      const dueAt = journey.lastCheckIn + journey.checkInInterval;
      checkinDueText.textContent =
        status.key === "overdue"
          ? "overdue"
          : now >= dueAt
            ? "due now"
            : `due at ${formatTime(dueAt)}`;
    }
    if (lastCheckinText) {
      lastCheckinText.textContent = `Checked in ${timeAgo(journey.lastCheckIn)}`;
    }

    const duration = Math.max(1, journey.expectedAt - journey.startedAt);
    const progress = clamp((now - journey.startedAt) / duration, 0, 1);
    if (progressBar) progressBar.style.width = `${Math.round(progress * 100)}%`;
    updateMapChip(status.key);
  }

  /* ---------- Real map ---------- */

  const DEFAULT_MAP_CENTER = { lat: 28.4744, lng: 77.504 };
  let journeyMap = null;
  let journeyMapMarkers = [];
  let journeyMapRoute = null;
  let journeyMapUserMarker = null;
  let journeyMapUpdating = false;

  function cleanupJourneyMap() {
    if (journeyMap) {
      journeyMap.remove();
      journeyMap = null;
    }
    journeyMapMarkers = [];
    journeyMapRoute = null;
    journeyMapUserMarker = null;
  }

  let watchMap = null;

  function cleanupWatchMap() {
    if (watchMap) {
      watchMap.remove();
      watchMap = null;
    }
  }

  async function initWatchMap() {
    if (!watchData || !window.L) return;
    const container = document.getElementById("watchMap");
    if (!container || watchMap) return;

    const fallback = { lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng };
    let origin = watchData.originCoords || null;
    let destination = watchData.destinationCoords || null;

    if (!origin) origin = fallback;
    if (!destination) {
      const found = await geocodePlace(watchData.destination);
      destination = found || { lat: origin.lat + 0.035, lng: origin.lng + 0.045 };
    }

    watchMap = L.map(container, { zoomControl: false, attributionControl: true }).setView(
      [origin.lat, origin.lng],
      12
    );
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(watchMap);

    L.circleMarker([origin.lat, origin.lng], {
      radius: 7,
      color: "#86d5b3",
      fillColor: "#86d5b3",
      fillOpacity: 0.95,
      weight: 2,
    })
      .addTo(watchMap)
      .bindPopup(`<strong>Starting point</strong><br>${escapeHTML(watchData.origin)}`);

    L.marker([destination.lat, destination.lng])
      .addTo(watchMap)
      .bindPopup(`<strong>Destination</strong><br>${escapeHTML(watchData.destination)}`);

    const route = L.polyline(
      [
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ],
      { color: "#d4935d", weight: 3, opacity: 0.8, dashArray: "8 6" }
    ).addTo(watchMap);

    try {
      watchMap.fitBounds(route.getBounds(), { padding: [28, 28], maxZoom: 14 });
    } catch {
      /* Identical coordinates can make bounds invalid. */
    }
    window.setTimeout(() => {
      if (watchMap) watchMap.invalidateSize();
    }, 100);
  }

  async function geocodePlace(query) {
    if (!query || !window.fetch) return null;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" } }
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (Array.isArray(data) && data.length && data[0].lat && data[0].lon) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch {
      /* Geocoding can fail on slow or restricted networks. */
    }
    return null;
  }

  async function fetchRoadRoute(origin, destination, apiKey) {
    if (!origin || !destination || !apiKey) return null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${encodeURIComponent(
        apiKey
      )}&start=${origin.lng},${origin.lat}&end=${destination.lng},${destination.lat}`;
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      const data = await response.json();
      const coordinates = data?.features?.[0]?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
      return coordinates.map((point) => [point[1], point[0]]);
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function ensureJourneyCoords(journey) {
    if (!journey) return null;

    if (!journey.originCoords) {
      if (navigator.geolocation) {
        journey.originCoords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
          );
        });
      }
      if (!journey.originCoords) {
        journey.originCoords = { ...DEFAULT_MAP_CENTER };
      }
    }

    if (!journey.destinationCoords) {
      const found = await geocodePlace(journey.destination);
      journey.destinationCoords = found || {
        lat: journey.originCoords.lat + 0.035,
        lng: journey.originCoords.lng + 0.045,
      };
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Ignore storage restrictions. */
    }
    return journey;
  }

  async function updateJourneyMap() {
    if (!state?.journey || !window.L) return;
    const container = document.getElementById("journeyMap");
    if (!container) return;
    if (journeyMapUpdating) return;
    journeyMapUpdating = true;

    try {
      if (!journeyMap) {
        journeyMap = L.map(container, {
          zoomControl: true,
          attributionControl: true,
        }).setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], 12);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
          subdomains: "abcd",
          maxZoom: 20,
        }).addTo(journeyMap);
      }

      const journey = await ensureJourneyCoords(state.journey);
      if (!journey || !journeyMap) return;

      journeyMapMarkers.forEach((layer) => journeyMap.removeLayer(layer));
      journeyMapMarkers = [];
      if (journeyMapRoute) {
        journeyMap.removeLayer(journeyMapRoute);
        journeyMapRoute = null;
      }
      if (journeyMapUserMarker) {
        journeyMap.removeLayer(journeyMapUserMarker);
        journeyMapUserMarker = null;
      }

      const origin = journey.originCoords;
      const destination = journey.destinationCoords;

      journeyMapUserMarker = L.circleMarker([origin.lat, origin.lng], {
        radius: 8,
        color: "#86d5b3",
        fillColor: "#86d5b3",
        fillOpacity: 0.95,
        weight: 2,
      })
        .addTo(journeyMap)
        .bindPopup(`<strong>Starting point</strong><br>${escapeHTML(journey.origin || "Current location")}`);

      const destinationMarker = L.marker([destination.lat, destination.lng])
        .addTo(journeyMap)
        .bindPopup(`<strong>Destination</strong><br>${escapeHTML(journey.destination)}`);
      journeyMapMarkers.push(destinationMarker);

      const apiKey = getRoutingApiKey();
      let routeCoordinates = [
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ];
      const roadRoute = await fetchRoadRoute(origin, destination, apiKey);
      if (roadRoute) routeCoordinates = roadRoute;

      journeyMapRoute = L.polyline(routeCoordinates, {
        color: roadRoute ? "#ef3657" : "#ef3657",
        weight: 4,
        opacity: 0.82,
        dashArray: roadRoute ? null : "8 6",
      }).addTo(journeyMap);

      try {
        journeyMap.fitBounds(journeyMapRoute.getBounds(), {
          padding: [34, 34],
          maxZoom: 15,
        });
      } catch {
        /* Bounds can fail if coordinates are identical. */
      }

      updateMapChip(getJourneyStatus().key);
    } catch (error) {
      console.warn("Safe Route map could not load.", error);
    } finally {
      journeyMapUpdating = false;
      if (journeyMap) journeyMap.invalidateSize();
    }
  }

  function updateMapChip(statusKey) {
    const chip = document.querySelector(".map-chip");
    const chipText = document.getElementById("mapChipText");
    if (!chip || !chipText) return;
    chip.classList.remove("is-warn", "is-alert");
    if (statusKey === "due") {
      chip.classList.add("is-warn");
      chipText.textContent = "Check-in due";
    } else if (statusKey === "overdue") {
      chip.classList.add("is-alert");
      chipText.textContent = "Check in now";
    } else {
      chipText.textContent = "Live route";
    }
  }

  function renderJourney() {
    const active = Boolean(state?.journey && state.journey.status === "active");
    const journeyView = $("#journeyActive");
    const emptyView = $("#journeyEmpty");
    const endButton = $("#endJourneyButton");
    const demoBadge = $("#demoBadge");
    const journeyId = $("#journeyId");

    if (!active) {
      if (journeyView) journeyView.hidden = true;
      if (emptyView) emptyView.hidden = false;
      if (endButton) endButton.hidden = true;
      if (demoBadge) demoBadge.hidden = true;
      if (journeyId) journeyId.textContent = "—";
      cleanupJourneyMap();
      lastJourneyStatus = "idle";
      applyJourneyStatusChrome({ key: "idle", label: "No active route", notice: null });
      renderSystemState("idle");
      return;
    }

    const journey = state.journey;
    if (journeyView) journeyView.hidden = false;
    if (emptyView) emptyView.hidden = true;
    if (endButton) endButton.hidden = false;
    if (demoBadge) demoBadge.hidden = !journey.demo;
    if (journeyId) journeyId.textContent = journey.id;

    $("#destinationText").textContent = journey.destination;
    $("#originText").textContent = journey.origin || "Current location";
    $("#etaText").textContent = formatTime(journey.expectedAt);
    $("#intervalText").textContent = `${Math.round(journey.checkInInterval / MINUTE)} min`;
    $("#contactNameInline").textContent = state.contact?.name?.split(" ")[0] || "Contact";

    window.requestAnimationFrame(() => {
      if (state?.journey?.status === "active") updateJourneyMap();
    });

    renderContact();
    const status = getJourneyStatus();
    lastJourneyStatus = status.key;
    applyJourneyStatusChrome(status);
    updateJourneyLiveFields(status);
  }

  /* ---------- Rendering: activity ---------- */

  function renderActivities() {
    const container = $("#activityList");
    const count = $("#activityCount");
    const viewAllButton = $("#viewAllActivityButton");
    if (!container) return;

    const activities = [...(state?.activities || [])].sort((a, b) => b.at - a.at);
    if (count) {
      count.textContent = `${String(activities.length).padStart(2, "0")} ${
        activities.length === 1 ? "event" : "events"
      }`;
    }
    if (viewAllButton) viewAllButton.hidden = activities.length === 0;

    if (!activities.length) {
      container.innerHTML = `<p class="activity-empty">Your check-ins and shared routes will appear here.</p>`;
      return;
    }

    container.innerHTML = activities
      .slice(0, 8)
      .map(
        (activity) => `
        <div class="activity-row">
          <span class="activity-icon type-${escapeHTML(activity.type)}">${
            activityIcons[activity.type] || icons.route
          }</span>
          <div class="activity-copy">
            <strong>${escapeHTML(activity.title)}</strong>
            <p>${escapeHTML(activity.detail)}</p>
          </div>
          <time class="activity-time" datetime="${new Date(activity.at).toISOString()}">${escapeHTML(
            timeAgo(activity.at)
          )}</time>
        </div>`
      )
      .join("");
  }

  function openActivityModal() {
    if (!state) return;
    const activities = [...(state.activities || [])].sort((a, b) => b.at - a.at);
    openModal(
      `
      <div class="modal-head">
        <div>
          <p class="eyebrow">Safety history</p>
          <h2 class="modal-title">Everything in one place.</h2>
        </div>
        ${modalCloseButton()}
      </div>
      <p class="modal-lede">${activities.length} ${
        activities.length === 1 ? "event" : "events"
      } saved in this browser, newest first.</p>
      <div class="history-list">
        ${
          activities.length
            ? activities
                .map(
                  (activity) => `
            <div class="activity-row">
              <span class="activity-icon type-${escapeHTML(activity.type)}">${
                activityIcons[activity.type] || icons.route
              }</span>
              <div class="activity-copy">
                <strong>${escapeHTML(activity.title)}</strong>
                <p>${escapeHTML(activity.detail)}</p>
              </div>
              <time class="activity-time" datetime="${new Date(activity.at).toISOString()}">${escapeHTML(
                formatShortDate(activity.at)
              )} · ${escapeHTML(formatTime(activity.at))}</time>
            </div>`
                )
                .join("")
            : `<p class="activity-empty">No safety events have been recorded yet.</p>`
        }
      </div>`,
      "modal-wide"
    );
  }

  function renderAll() {
    updateClock();
    if (!state) return;
    renderJourney();
    renderContact();
    renderActivities();
    applyEmergencyLinks();
    updateNotificationState();
    updateDocumentMeta();
  }

  function updateDocumentMeta() {
    if (!state) return;
    const active = state.journey?.status === "active";
    if (active) {
      document.title = `${state.journey.destination} · Safe Route`;
    } else {
      document.title = "Safe Route — Your journey, watched over";
    }
  }

  /* ---------- Live tick ---------- */

  function sendSystemNotification(title, body, tag) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (!document.hidden) return;
    try {
      new Notification(title, {
        body,
        tag,
        silent: false,
      });
    } catch {
      /* Some browsers require a service worker; the in-app notice still works. */
    }
  }

  function handleJourneyStatusChange(status) {
    applyJourneyStatusChrome(status);
    if (!state?.journey) return;

    const journey = state.journey;
    const dueAt = journey.lastCheckIn + journey.checkInInterval;
    const contactName = state.contact?.name?.split(" ")[0] || "your contact";

    if (status.key === "due") {
      const key = `${journey.id}-${dueAt}`;
      if (!dueNotifications.has(key)) {
        dueNotifications.add(key);
        sendSystemNotification(
          "Safe Route — check-in due",
          `Let ${contactName} know you're okay.`,
          key
        );
      }
    }

    if (status.key === "overdue") {
      const key = `${journey.id}-${journey.expectedAt}`;
      if (!overdueNotifications.has(key)) {
        overdueNotifications.add(key);
        sendSystemNotification(
          "Safe Route — arrival overdue",
          `Your ETA has passed. Open Safe Route to check in.`,
          key
        );
      }
      if (!journey.overdueLogged) {
        journey.overdueLogged = true;
        addActivity(
          "overdue",
          "Arrival time passed",
          `No arrival was recorded by ${formatTime(journey.expectedAt)}. Check in when you can.`
        );
        renderActivities();
      }
    }
  }

  function tick() {
    updateClock();
    if (isWatchMode) {
      updateWatchLive();
      return;
    }
    if (!state) return;
    if (!state.journey || state.journey.status !== "active") {
      if (lastJourneyStatus !== "idle") {
        lastJourneyStatus = "idle";
        renderJourney();
      }
      return;
    }

    const status = getJourneyStatus();
    if (status.key !== lastJourneyStatus) {
      lastJourneyStatus = status.key;
      handleJourneyStatusChange(status);
    }
    updateJourneyLiveFields(status);
  }

  /* ---------- Notifications ---------- */

  function updateNotificationState() {
    const button = $("#notifyButton");
    const dot = $("#notifyDot");
    if (!button) return;
    const supported = "Notification" in window;
    const permission = supported ? Notification.permission : "unsupported";
    button.classList.toggle("is-enabled", permission === "granted");
    button.title =
      permission === "granted"
        ? "Check-in reminders are on"
        : permission === "denied"
          ? "Notifications are blocked in browser settings"
          : "Enable check-in reminders";
    if (dot) dot.hidden = permission !== "default";
  }

  async function enableNotifications(showToastWhenAlreadyOn = true) {
    if (!("Notification" in window)) {
      showToast("This browser doesn't support reminders. In-app check-ins still work.", true);
      return;
    }

    if (Notification.permission === "granted") {
      if (showToastWhenAlreadyOn) showToast("Check-in reminders are already on.");
      updateNotificationState();
      return;
    }

    if (Notification.permission === "denied") {
      showToast("Notifications are blocked. Update them in your browser settings.", true);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      updateNotificationState();
      if (permission === "granted") {
        showToast("Check-in reminders enabled. Keep this tab open for alerts.");
      } else {
        showToast("Reminders are off. In-app check-ins will still appear here.", true);
      }
    } catch {
      showToast("We couldn't enable reminders in this browser.", true);
    }
  }

  /* ---------- Share/watch link ---------- */

  function buildSnapshot() {
    if (!state?.journey) return null;
    const journey = state.journey;
    return {
      v: 1,
      jid: journey.id,
      traveler: state.user?.name || "A Safe Route traveler",
      destination: journey.destination,
      origin: journey.origin,
      expectedAt: journey.expectedAt,
      lastCheckIn: journey.lastCheckIn,
      checkInInterval: journey.checkInInterval,
      startedAt: journey.startedAt,
      sharedAt: Date.now(),
      emergencyNumber: getEmergencyNumber(),
      originCoords: journey.originCoords || null,
      destinationCoords: journey.destinationCoords || null,
    };
  }

  function encodePayload(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
  }

  function decodePayload(value) {
    const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function buildWatchLink() {
    const snapshot = buildSnapshot();
    if (!snapshot) return "";
    const base = window.location.href.split("#")[0].split("?")[0];
    return `${base}#watch=${encodePayload(snapshot)}`;
  }

  function parseWatchHash() {
    const hash = window.location.hash;
    if (!hash.startsWith("#watch=")) return null;
    try {
      const payload = decodePayload(hash.slice(7));
      if (
        !payload ||
        typeof payload.destination !== "string" ||
        !Number.isFinite(Number(payload.expectedAt)) ||
        !Number.isFinite(Number(payload.lastCheckIn))
      ) {
        return { error: true };
      }
      return {
        v: 1,
        jid: String(payload.jid || ""),
        traveler: String(payload.traveler || "A Safe Route traveler"),
        destination: String(payload.destination),
        origin: String(payload.origin || "Starting point"),
        expectedAt: Number(payload.expectedAt),
        lastCheckIn: Number(payload.lastCheckIn),
        checkInInterval: Number(payload.checkInInterval) || 15 * MINUTE,
        startedAt: Number(payload.startedAt) || Number(payload.lastCheckIn),
        sharedAt: Number(payload.sharedAt) || Date.now(),
        emergencyNumber: sanitizeEmergencyNumber(payload.emergencyNumber),
        originCoords: payload.originCoords || null,
        destinationCoords: payload.destinationCoords || null,
      };
    } catch {
      return { error: true };
    }
  }

  function getLiveWatchData(snapshot) {
    const latest = readState();
    if (
      latest?.journey &&
      latest.journey.status === "active" &&
      latest.journey.id === snapshot.jid
    ) {
      return {
        ...snapshot,
        destination: latest.journey.destination,
        origin: latest.journey.origin,
        expectedAt: latest.journey.expectedAt,
        lastCheckIn: latest.journey.lastCheckIn,
        checkInInterval: latest.journey.checkInInterval,
        startedAt: latest.journey.startedAt,
        traveler: latest.user?.name || snapshot.traveler,
        live: true,
      };
    }
    return { ...snapshot, live: false };
  }

  function watchStatus(now) {
    if (!watchData) return { key: "idle", label: "Journey view" };
    const overdue = now > watchData.expectedAt;
    const dueAt = watchData.lastCheckIn + watchData.checkInInterval;
    const due = now >= dueAt;
    if (overdue) return { key: "overdue", label: "Arrival overdue", dueAt };
    if (due) return { key: "due", label: "Check-in due", dueAt };
    return { key: "onroute", label: "On the way", dueAt };
  }

  function renderWatchPage() {
    if (!watchData) return;
    cleanupWatchMap();
    const traveler = watchData.traveler || "Your person";
    const firstName = traveler.split(" ")[0];
    const status = watchStatus(Date.now());
    const watchEmergency = sanitizeEmergencyNumber(watchData.emergencyNumber);
    const sharedLabel = watchData.live
      ? "Live on this device"
      : `Shared ${formatTime(watchData.sharedAt)}`;

    document.title = `${firstName}'s safe route · Safe Route`;
    document.body.classList.add("watch-mode");
    if (appShell) appShell.hidden = true;
    if (sosDock) sosDock.hidden = true;
    watchView.hidden = false;

    watchView.innerHTML = `
      <div class="watch-shell">
        <header class="watch-topbar">
          <a class="brand" href="./" aria-label="Open Safe Route">
            ${renderBrandMark()}
            <span class="brand-type"><strong>Safe Route</strong><small>Journey companion</small></span>
          </a>
          <span class="watch-badge"><span class="status-dot"></span>Trusted contact view</span>
        </header>

        <section class="watch-intro">
          <p class="eyebrow" id="watchEyebrow">Private journey update</p>
          <h1 id="watchHeading">${escapeHTML(firstName)} is<br><span>on the way.</span></h1>
          <p class="watch-lede">
            ${escapeHTML(traveler)} shared this route so you can follow along.
            ${watchData.live
              ? "This view is reading the latest update from this device."
              : "The countdown updates automatically from the shared arrival time."}
          </p>
        </section>

        <article class="watch-card">
          <div class="watch-card-head">
            <span class="watch-status" id="watchStatus"><span class="status-dot"></span><span id="watchStatusText">${escapeHTML(status.label)}</span></span>
            <span class="watch-shared-at" id="watchSharedAt">${escapeHTML(sharedLabel)}</span>
          </div>
          <div class="watch-card-body">
            <p class="watch-route">${icons.route}<span>${escapeHTML(watchData.origin)} → ${escapeHTML(watchData.destination)}</span></p>
            <h2 class="watch-destination" id="watchDestination">${escapeHTML(watchData.destination)}</h2>
            <p class="watch-person"><strong>${escapeHTML(firstName)}</strong> is sharing this journey with you.</p>

            <div class="watch-route-track">
              <span class="watch-route-fill" id="watchRouteFill"></span>
              <span class="watch-route-marker" id="watchRouteMarker"></span>
              <span class="watch-stop">${escapeHTML(watchData.origin)}</span>
              <span class="watch-stop is-end">${escapeHTML(watchData.destination)}</span>
            </div>

            <div id="watchMap" class="watch-map" aria-label="Shared route map"></div>

            <div class="watch-countdown-row">
              <div>
                <p class="eyebrow" id="watchCountdownLabel">Arriving in</p>
                <p class="watch-countdown" id="watchCountdown">--:--:--</p>
              </div>
              <div class="watch-eta">
                <span>Expected arrival</span>
                <strong id="watchEta">${escapeHTML(formatTime(watchData.expectedAt))}</strong>
              </div>
            </div>

            <div class="watch-details">
              <div class="watch-detail">
                <span>Last check-in</span>
                <strong id="watchLastCheckIn">${escapeHTML(timeAgo(watchData.lastCheckIn))}</strong>
              </div>
              <div class="watch-detail">
                <span>Check-in rhythm</span>
                <strong>Every ${Math.round(watchData.checkInInterval / MINUTE)} min</strong>
              </div>
              <div class="watch-detail">
                <span>Journey date</span>
                <strong>${escapeHTML(formatShortDate(watchData.startedAt))}</strong>
              </div>
            </div>

            <div class="watch-note">
              ${icons.shield}
              <span id="watchNoteText">If the arrival time passes without a new check-in, reach out to ${escapeHTML(firstName)} directly. This page never replaces a real conversation.</span>
            </div>
          </div>
          <div class="watch-card-foot">
            <span>Shared privately with Safe Route</span>
            <span class="watch-foot-links"><a href="./">Open Safe Route</a></span>
          </div>
        </article>

        <div class="watch-emergency">
          <p><strong>If you believe ${escapeHTML(firstName)} is in immediate danger</strong>Call local emergency services. Do not wait for a check-in.</p>
          <a href="tel:${watchEmergency}">Call ${watchEmergency}</a>
        </div>

        <footer class="watch-footer">
          <span>Safe Route · ${escapeHTML(getGreeting())}, ${escapeHTML(firstName)} is in your circle.</span>
          <a class="watch-back" href="./">← Back to Safe Route</a>
        </footer>
      </div>`;

    lastWatchStatus = null;
    window.setTimeout(() => {
      if (watchData) initWatchMap();
    }, 0);
    updateWatchLive();
  }

  function updateWatchLive() {
    if (!watchData || isWatchMode === false) return;
    const now = Date.now();
    const status = watchStatus(now);
    const remaining = watchData.expectedAt - now;
    const overdue = remaining < 0;
    const firstName = (watchData.traveler || "Your person").split(" ")[0];

    const countdown = $("#watchCountdown");
    const countdownLabel = $("#watchCountdownLabel");
    const statusEl = $("#watchStatus");
    const statusText = $("#watchStatusText");
    const lastCheckIn = $("#watchLastCheckIn");
    const fill = $("#watchRouteFill");
    const marker = $("#watchRouteMarker");
    const heading = $("#watchHeading");
    const note = $("#watchNoteText");

    if (!countdown) return;

    countdown.textContent = overdue
      ? `+${formatCountdown(Math.abs(remaining))}`
      : formatCountdown(remaining);
    countdown.classList.toggle("is-overdue", overdue);
    countdownLabel.textContent = overdue ? "Arrival overdue" : "Arriving in";
    if (lastCheckIn) lastCheckIn.textContent = timeAgo(watchData.lastCheckIn);

    if (status.key !== lastWatchStatus) {
      lastWatchStatus = status.key;
      if (statusEl) statusEl.classList.toggle("is-overdue", status.key === "overdue");
      if (statusText) statusText.textContent = status.label;
      if (heading) {
        heading.innerHTML =
          status.key === "overdue"
            ? `${escapeHTML(firstName)}’s arrival<br><span>is overdue.</span>`
            : status.key === "due"
              ? `${escapeHTML(firstName)}’s check-in<br><span>is due.</span>`
              : `${escapeHTML(firstName)} is<br><span>on the way.</span>`;
      }
      if (note) {
        note.textContent =
          status.key === "overdue"
            ? `The expected arrival time has passed without a recorded arrival. Reach out to ${firstName} directly.`
            : `If the arrival time passes without a new check-in, reach out to ${firstName} directly. This page never replaces a real conversation.`;
      }
    }

    const duration = Math.max(1, watchData.expectedAt - watchData.startedAt);
    const progress = clamp((now - watchData.startedAt) / duration, 0.03, 0.97);
    if (fill) fill.style.width = `calc(${(progress * 100).toFixed(1)}% - 8px)`;
    if (marker) marker.style.left = `${(progress * 100).toFixed(1)}%`;
  }

  function initWatchView() {
    const snapshot = parseWatchHash();
    if (!snapshot) return false;

    isWatchMode = true;
    document.body.classList.add("watch-mode");
    if (appShell) appShell.hidden = true;
    if (sosDock) sosDock.hidden = true;

    if (snapshot.error) {
      watchView.hidden = false;
      watchView.innerHTML = `
        <div class="watch-shell">
          <header class="watch-topbar">
            <a class="brand" href="./">${renderBrandMark()}<span class="brand-type"><strong>Safe Route</strong><small>Journey companion</small></span></a>
            <span class="watch-badge"><span class="status-dot"></span>Trusted contact view</span>
          </header>
          <div class="watch-error">
            <span class="empty-icon">${icons.alert}</span>
            <h1>This link isn’t valid.</h1>
            <p>The journey link may have been copied incompletely, or the route was removed. Ask your person to share a fresh link from Safe Route.</p>
            <a class="button button-primary" href="./">Open Safe Route ${icons.arrow}</a>
          </div>
        </div>`;
      document.title = "Link not valid · Safe Route";
      return true;
    }

    watchData = getLiveWatchData(snapshot);
    watchSourceLive = Boolean(watchData.live);
    renderWatchPage();
    return true;
  }

  /* ---------- Modal system ---------- */

  function openModal(content, className = "") {
    closeModal(false);
    modalReturnFocus = document.activeElement;
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <section class="modal ${className}" role="dialog" aria-modal="true" aria-label="Safe Route dialog" tabindex="-1">
          ${content}
        </section>
      </div>`;
    document.body.classList.add("modal-open");
    window.setTimeout(() => {
      const focusTarget =
        modalRoot.querySelector("[data-autofocus]") ||
        modalRoot.querySelector("input, select, a, button");
      focusTarget?.focus({ preventScroll: true });
    }, 40);
  }

  function closeModal(restoreFocus = true) {
    if (!modalRoot.innerHTML) return;
    modalRoot.innerHTML = "";
    document.body.classList.remove("modal-open");
    if (restoreFocus && modalReturnFocus?.isConnected) {
      modalReturnFocus.focus({ preventScroll: true });
    }
    modalReturnFocus = null;
  }

  function modalCloseButton() {
    return `<button class="modal-close" type="button" aria-label="Close dialog" data-close>${icons.close}</button>`;
  }

  function openNewRouteModal() {
    const contact = state?.contact || createDemoState().contact;
    const defaultDate = new Date(Date.now() + 30 * MINUTE);
    const defaultTime = `${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`;
    const existing = Boolean(state?.journey);

    openModal(
      `
      <div class="modal-head">
        <div>
          <p class="eyebrow">New journey</p>
          <h2 class="modal-title">Set your route.</h2>
        </div>
        ${modalCloseButton()}
      </div>
      <p class="modal-lede">Tell your circle where you're going and when to expect you. You can check in along the way.</p>
      <form class="modal-form" id="newRouteForm">
        <label class="field">
          <span>Where are you headed?</span>
          <input type="text" name="destination" placeholder="e.g. Riverside Station" maxlength="80" autocomplete="off" required data-autofocus>
        </label>
        <div class="form-row">
          <label class="field">
            <span>Leaving from</span>
            <input type="text" name="origin" placeholder="Current location" maxlength="80" autocomplete="off" value="Hawthorne Ave">
          </label>
          <label class="field">
            <span>Expected arrival</span>
            <input type="time" name="eta" value="${defaultTime}" required>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span>Check in every</span>
            <select name="interval">
              <option value="10">10 minutes</option>
              <option value="15" selected>15 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
            </select>
          </label>
          <label class="field">
            <span>Trusted contact</span>
            <input type="text" name="contactName" maxlength="60" value="${escapeHTML(contact.name)}" required>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span>Contact phone</span>
            <input type="tel" name="contactPhone" maxlength="25" value="${escapeHTML(contact.phone)}" required>
          </label>
          <label class="field">
            <span>Relationship</span>
            <input type="text" name="contactRelation" maxlength="30" value="${escapeHTML(contact.relation)}">
          </label>
        </div>
        <div class="form-notice">
          ${icons.shield}
          <span>Your trusted contact will see your destination, arrival time, and check-in status through a private link.</span>
        </div>
        ${
          existing
            ? `<div class="form-notice">${icons.alert}<span>Starting a new route will end your current live journey.</span></div>`
            : ""
        }
        <button class="button button-primary modal-submit" type="submit">
          <span>Start my safe route</span>${icons.arrow}
        </button>
      </form>`,
      "modal-wide"
    );

    $("#newRouteForm")?.addEventListener("submit", handleNewRouteSubmit);
  }

  function resolveArrivalTime(inputValue) {
    if (!inputValue) return null;
    const [hours, minutes] = inputValue.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const now = new Date();
    const arrival = new Date(now);
    arrival.setHours(hours, minutes, 0, 0);
    if (arrival.getTime() <= now.getTime() + 60 * 1000) {
      arrival.setDate(arrival.getDate() + 1);
    }
    return arrival.getTime();
  }

  function handleNewRouteSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const destination = String(data.get("destination") || "").trim();
    const origin = String(data.get("origin") || "").trim() || "Current location";
    const contactName = String(data.get("contactName") || "").trim();
    const contactPhone = String(data.get("contactPhone") || "").trim();
    const contactRelation = String(data.get("contactRelation") || "").trim() || "Trusted contact";
    const intervalMinutes = Number(data.get("interval")) || 15;
    const expectedAt = resolveArrivalTime(data.get("eta"));

    if (!destination || !contactName || !contactPhone || !expectedAt) {
      showToast("Add a destination, arrival time, and trusted contact to continue.", true);
      return;
    }

    const now = Date.now();
    const newJourney = {
      id: `SR-${Math.floor(1000 + Math.random() * 9000)}`,
      destination,
      origin,
      startedAt: now,
      expectedAt,
      lastCheckIn: now,
      checkInInterval: intervalMinutes * MINUTE,
      demo: false,
      status: "active",
      overdueLogged: false,
    };

    state.journey = newJourney;
    state.contact = {
      name: contactName,
      relation: contactRelation,
      phone: contactPhone,
      email: state.contact?.email || "",
    };
    addActivity(
      "started",
      `Journey to ${destination} started`,
      `Leaving ${origin} · expected arrival ${formatTime(expectedAt)} · check-in every ${intervalMinutes} min.`
    );
    saveState();
    closeModal();
    renderAll();
    const firstName = contactName.split(" ")[0];
    showToast(`Safe route started. Share it with ${firstName} when you're ready.`);
  }

  function openContactModal() {
    const contact = state?.contact || createDemoState().contact;
    openModal(
      `
      <div class="modal-head">
        <div>
          <p class="eyebrow">Safety circle</p>
          <h2 class="modal-title">Your trusted contact.</h2>
        </div>
        ${modalCloseButton()}
      </div>
      <p class="modal-lede">This is the person you share every journey with. Keep their details current.</p>
      <form class="modal-form" id="contactForm">
        <label class="field">
          <span>Full name</span>
          <input type="text" name="name" maxlength="60" value="${escapeHTML(contact.name)}" required data-autofocus>
        </label>
        <div class="form-row">
          <label class="field">
            <span>Relationship</span>
            <input type="text" name="relation" maxlength="30" value="${escapeHTML(contact.relation)}">
          </label>
          <label class="field">
            <span>Phone</span>
            <input type="tel" name="phone" maxlength="25" value="${escapeHTML(contact.phone)}" required>
          </label>
        </div>
        <label class="field">
          <span>Email <span style="color:var(--muted-dark)">(optional)</span></span>
          <input type="email" name="email" maxlength="80" value="${escapeHTML(contact.email || "")}">
        </label>
        <div class="form-notice">
          ${icons.shield}
          <span>Contact details stay in this browser. Safe Route never messages them automatically.</span>
        </div>
        <button class="button button-primary modal-submit" type="submit"><span>Save contact</span>${icons.arrow}</button>
      </form>`
    );

    $("#contactForm")?.addEventListener("submit", handleContactSubmit);
  }

  function handleContactSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    if (!name || !phone) {
      showToast("A contact name and phone number are required.", true);
      return;
    }
    state.contact = {
      name,
      relation: String(data.get("relation") || "").trim() || "Trusted contact",
      phone,
      email: String(data.get("email") || "").trim(),
    };
    saveState();
    closeModal();
    renderContact();
    renderJourney();
    showToast("Trusted contact updated.");
  }

  function openProfileModal() {
    const user = state?.user || { name: "Alex Rivera" };
    const emergencyNumber = getEmergencyNumber();
    openModal(
      `
      <div class="modal-head">
        <div>
          <p class="eyebrow">Your settings</p>
          <h2 class="modal-title">A safer circle.</h2>
        </div>
        ${modalCloseButton()}
      </div>
      <p class="modal-lede">This prototype keeps your journeys, contacts, and safety history in this browser. No account needed.</p>
      <div class="share-recipient">
        <div class="contact-avatar">${escapeHTML(initials(user.name))}</div>
        <div><strong>${escapeHTML(user.name)}</strong><span>Local profile · data stays on this device</span></div>
      </div>
      <form class="emergency-setting" id="emergencySettingsForm">
        <div class="emergency-setting-copy">
          <strong>Local emergency number</strong>
          <p>Used on every SOS screen and trusted-contact view. Confirm the correct number for your country.</p>
        </div>
        <div class="emergency-setting-control">
          <input type="tel" name="emergencyNumber" value="${escapeHTML(emergencyNumber)}" maxlength="8" aria-label="Local emergency number">
          <button class="button button-outline" type="submit">Save</button>
        </div>
      </form>
      <form class="emergency-setting" id="routingKeyForm">
        <div class="emergency-setting-copy">
          <strong>Free routing API key</strong>
          <p>Optional OpenRouteService key for real road routes. Leave blank to use the direct-line fallback.</p>
        </div>
        <div class="emergency-setting-control">
          <input type="text" name="routingApiKey" value="${escapeHTML(getRoutingApiKey())}" maxlength="120" aria-label="OpenRouteService API key" placeholder="ors-...">
          <button class="button button-outline" type="submit">Save</button>
        </div>
      </form>
      <div class="confirm-actions">
        <button class="button button-outline" type="button" id="settingsNotifyButton">${icons.bell}<span>Enable check-in reminders</span></button>
        <button class="button button-outline" type="button" id="settingsContactButton">${icons.shield}<span>Edit trusted contact</span></button>
        <button class="button button-quiet" type="button" id="settingsResetButton">Reset sample journey</button>
      </div>`
    );

    $("#emergencySettingsForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = sanitizeEmergencyNumber(new FormData(event.currentTarget).get("emergencyNumber"));
      state.emergencyNumber = value;
      saveState();
      applyEmergencyLinks();
      renderAll();
      showToast(`Emergency number updated to ${value}.`);
    });

    $("#routingKeyForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      state.routingApiKey = String(new FormData(event.currentTarget).get("routingApiKey") || "").trim();
      saveState();
      if (state?.journey?.status === "active") {
        cleanupJourneyMap();
        renderJourney();
      }
      showToast(state.routingApiKey ? "Routing key saved. Real road routes will load now." : "Routing key cleared. Using direct-line routes.");
    });

    $("#settingsNotifyButton")?.addEventListener("click", () => {
      closeModal(false);
      enableNotifications();
    });
    $("#settingsContactButton")?.addEventListener("click", () => {
      closeModal(false);
      openContactModal();
    });
    $("#settingsResetButton")?.addEventListener("click", () => {
      closeModal(false);
      openResetModal();
    });
  }

  function openResetModal() {
    openModal(`
      <div class="modal-head">
        <div>
          <p class="eyebrow">Reset experience</p>
          <h2 class="modal-title">Start fresh?</h2>
        </div>
        ${modalCloseButton()}
      </div>
      <p class="modal-lede">This clears journeys, contacts, and safety history saved in this browser, then restores the sample route.</p>
      <div class="confirm-actions">
        <button class="button button-primary" type="button" id="confirmResetButton"><span>Reset sample data</span>${icons.arrow}</button>
        <button class="button button-quiet" type="button" data-close>Keep my data</button>
      </div>`);

    $("#confirmResetButton")?.addEventListener("click", () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* Ignore storage restrictions. */
      }
      state = createDemoState();
      saveState();
      closeModal();
      renderAll();
      showToast("Sample route restored.");
    });
  }

  function openEndJourneyModal() {
    if (!state?.journey) return;
    const destination = state.journey.destination;
    openModal(`
      <div class="modal-head">
        <div>
          <p class="eyebrow">End journey</p>
          <h2 class="modal-title">Arrived safely?</h2>
        </div>
        ${modalCloseButton()}
      </div>
      <p class="modal-lede">Ending this route stops the live countdown and closes the shared journey view for ${escapeHTML(
        destination
      )}.</p>
      <div class="confirm-actions">
        <button class="button button-primary" type="button" id="confirmEndButton"><span>Yes, I've arrived</span>${icons.check}</button>
        <button class="button button-quiet" type="button" data-close>Keep my route running</button>
      </div>`);

    $("#confirmEndButton")?.addEventListener("click", () => {
      const destinationCopy = state.journey?.destination || "your destination";
      addActivity("arrived", `Arrived safely at ${destinationCopy}`, "Route closed. Glad you made it.");
      state.journey = null;
      saveState();
      closeModal();
      renderAll();
      showToast("Journey closed. Glad you're safe.");
    });
  }

  function openShareModal() {
    if (!state?.journey) {
      showToast("Start a route before sharing it.", true);
      return;
    }
    const link = buildWatchLink();
    const first = state.contact?.name?.split(" ")[0] || "your contact";
    const destination = state.journey.destination;
    const phone = sanitizePhone(state.contact?.phone);
    const message = `I'm on my way to ${destination}. Follow my Safe Route here: ${link}`;
    const encodedMessage = encodeURIComponent(message);
    const smsHref = `sms:${phone}?&body=${encodedMessage}`;
    const whatsappHref = `https://wa.me/?text=${encodedMessage}`;
    const email = state.contact?.email || "";
    const mailHref = email
      ? `mailto:${encodeURI(email)}?subject=${encodeURIComponent(
          `My Safe Route to ${destination}`
        )}&body=${encodedMessage}`
      : `mailto:?subject=${encodeURIComponent(`My Safe Route to ${destination}`)}&body=${encodedMessage}`;
    const shareSupported = Boolean(navigator.share);

    openModal(
      `
      <div class="modal-head">
        <div>
          <p class="eyebrow">Keep them close</p>
          <h2 class="modal-title">Share your route.</h2>
        </div>
        ${modalCloseButton()}
      </div>
      <p class="modal-lede">Send a private view of this journey. They'll see where you're headed, your ETA, and your latest check-in.</p>
      <div class="share-recipient">
        <div class="contact-avatar">${escapeHTML(initials(state.contact?.name || ""))}</div>
        <div><strong>${escapeHTML(state.contact?.name || "Your contact")}</strong><span>${escapeHTML(
          state.contact?.relation || "Trusted contact"
        )} · It only takes one message</span></div>
      </div>
      <p class="share-section-label">Your private journey link</p>
      <div class="share-link-row">
        <input class="share-link" id="shareLinkInput" readonly value="${escapeHTML(link)}" aria-label="Private journey link">
        <button class="button button-primary share-copy" type="button" id="copyShareLink">${icons.copy}<span>Copy</span></button>
      </div>
      <div class="share-channels">
        <a class="share-channel" href="${escapeHTML(whatsappHref)}" target="_blank" rel="noopener" data-share-channel>${icons.whatsapp}<span>WhatsApp</span></a>
        <a class="share-channel" href="${escapeHTML(smsHref)}" data-share-channel>${icons.message}<span>Text ${escapeHTML(first)}</span></a>
        <a class="share-channel" href="${escapeHTML(mailHref)}" data-share-channel>${icons.mail}<span>Email</span></a>
      </div>
      ${
        shareSupported
          ? `<button class="share-channel" type="button" id="nativeShareButton" style="width:100%; margin-bottom:16px;">${icons.more}<span>More sharing options</span></button>`
          : ""
      }
      <button class="share-preview" type="button" id="previewWatchButton"><span>Preview what ${escapeHTML(
        first
      )} will see</span><span>Open preview →</span></button>
      <p class="privacy-note">${icons.shield}<span>Anyone with this link can see the journey details. The link is a point-in-time view; it only updates live on this device's preview. No phone number or email is included.</span></p>`
    );

    const recordShare = () => {
      if (!state?.journey) return;
      const alreadyLogged = state.activities.some(
        (activity) => activity.type === "shared" && activity.journeyId === state.journey.id
      );
      if (!alreadyLogged) {
        addActivity(
          "shared",
          `Route shared with ${state.contact?.name || "trusted contact"}`,
          "Private journey view prepared for sharing."
        );
        renderActivities();
      }
    };

    const copyButton = $("#copyShareLink");
    copyButton?.addEventListener("click", async () => {
      const input = $("#shareLinkInput");
      try {
        await navigator.clipboard.writeText(input?.value || link);
        copyButton.innerHTML = `${icons.check}<span>Copied</span>`;
        window.setTimeout(() => {
          copyButton.innerHTML = `${icons.copy}<span>Copy</span>`;
        }, 1800);
        recordShare();
        showToast("Private journey link copied.");
      } catch {
        input?.select();
        try {
          document.execCommand("copy");
          showToast("Private journey link copied.");
          recordShare();
        } catch {
          showToast("Copy the highlighted link manually.", true);
        }
      }
    });

    $$("[data-share-channel]").forEach((channel) => {
      channel.addEventListener("click", recordShare);
    });

    $("#nativeShareButton")?.addEventListener("click", async () => {
      try {
        await navigator.share({
          title: "My Safe Route",
          text: `I'm on my way to ${destination}. Follow my Safe Route here:`,
          url: link,
        });
        recordShare();
      } catch {
        /* User cancelled the native share sheet. */
      }
    });

    $("#previewWatchButton")?.addEventListener("click", () => {
      recordShare();
      window.open(link, "_blank", "noopener");
    });
  }

  /* ---------- Check-in / end ---------- */

  function checkIn() {
    if (!state?.journey || state.journey.status !== "active") {
      showToast("There isn't an active route to check in.", true);
      window.setTimeout(() => {
        if (!modalRoot.innerHTML) openNewRouteModal();
      }, 250);
      return;
    }

    const now = Date.now();
    const journey = state.journey;
    const wasOverdue = now > journey.expectedAt;
    journey.lastCheckIn = now;
    journey.overdueLogged = false;
    journey.reminderLoggedFor = null;

    if (wasOverdue) {
      journey.expectedAt = now + journey.checkInInterval;
      addActivity(
        "checkin",
        "Checked in — ETA extended",
        `Still safe. New arrival estimate is ${formatTime(journey.expectedAt)}.`
      );
      showToast("Check-in saved. Your arrival estimate was updated.");
    } else {
      addActivity("checkin", "Checked in — all good", "Check-in saved to your safety history.");
      showToast("Check-in saved. Glad you're okay.");
    }

    saveState();
    lastJourneyStatus = null;
    renderJourney();
    renderActivities();
  }

  /* ---------- SOS ---------- */

  function resetSosButton() {
    cancelAnimationFrame(holdAnimationFrame);
    window.clearTimeout(holdTimeout);
    holdAnimationFrame = null;
    holdTimeout = null;
    holdStartedAt = 0;
    holdTriggered = false;
    sosButton.classList.remove("is-holding");
    sosButton.style.setProperty("--hold", "0deg");
  }

  function startSosHold(event) {
    if (holdStartedAt) return;
    if (event.cancelable) event.preventDefault();
    suppressSosClick = false;
    holdStartedAt = performance.now();
    holdTriggered = false;
    sosButton.classList.add("is-holding");
    if (event.pointerId !== undefined && sosButton.setPointerCapture) {
      try {
        sosButton.setPointerCapture(event.pointerId);
      } catch {
        /* Pointer capture can fail in unusual browsers. */
      }
    }

    const started = holdStartedAt;
    const animate = (timestamp) => {
      if (!holdStartedAt) return;
      const progress = clamp((timestamp - started) / 3000, 0, 1);
      sosButton.style.setProperty("--hold", `${progress * 360}deg`);
      if (progress < 1) {
        holdAnimationFrame = requestAnimationFrame(animate);
      }
    };
    holdAnimationFrame = requestAnimationFrame(animate);

    holdTimeout = window.setTimeout(() => {
      holdTriggered = true;
      suppressSosClick = true;
      resetSosButton();
      triggerSos();
    }, 3000);
  }

  function endSosHold() {
    if (!holdStartedAt) return;
    const duration = performance.now() - holdStartedAt;
    const wasTriggered = holdTriggered;
    resetSosButton();
    if (!wasTriggered && duration < 700) {
      /* The click handler gives a short instruction for a quick tap. */
    }
  }

  function triggerSos() {
    if (navigator.vibrate) {
      navigator.vibrate([80, 50, 120]);
    }
    addActivity("sos", "Emergency actions opened", "No call was placed automatically.");
    saveState();
    renderActivities();
    openSosModal();
  }

  function openSosModal() {
    const contact = state?.contact || createDemoState().contact;
    const phone = sanitizePhone(contact.phone);
    const journey = state?.journey;
    const emergencyNumber = getEmergencyNumber();
    const locationContext = journey
      ? `I may need help. I'm on my way from ${journey.origin} to ${journey.destination}. Expected arrival was ${formatTime(
          journey.expectedAt
        )}.`
      : "I may need help. Please reach out as soon as you can.";
    const smsBody = encodeURIComponent(locationContext);
    const firstName = contact.name.split(" ")[0];

    openModal(
      `
      <div class="sos-modal-head">
        <span class="sos-mark">${icons.alert}</span>
        ${modalCloseButton()}
      </div>
      <p class="eyebrow" style="color: var(--red-bright); margin-bottom: 8px;">Emergency actions</p>
      <h2 class="modal-title">Help is one<br>tap away.</h2>
      <p class="sos-lede">No call has been placed and nothing has been shared yet. Choose what you need. Your safety is the priority.</p>

      <a class="emergency-primary" href="tel:${emergencyNumber}" id="sosCallLink">
        <span><small>Immediate danger</small><strong>Call emergency services</strong></span>
        <span class="arrow-circle">${icons.phone}</span>
      </a>

      <div class="emergency-secondary">
        <a class="emergency-action" href="sms:${phone}?&body=${smsBody}" id="sosTextLink">
          <span>${icons.message}</span>
          <span><strong>Text ${escapeHTML(firstName)}</strong><small>Open a prepared message</small></span>
        </a>
        <button class="emergency-action" type="button" id="shareLocationButton">
          <span>${icons.location}</span>
          <span><strong>Share my location</strong><small>Copy coordinates + status</small></span>
        </button>
      </div>
      <div id="sosResult" class="sos-result" hidden></div>
      <button class="sos-cancel" type="button" data-close>I'm safe — close emergency actions</button>
      <p class="sos-safe-note">${icons.shield}<span>Safe Route never contacts emergency services automatically.</span></p>`,
      "modal-sos"
    );

    $("#sosCallLink")?.addEventListener("click", () => {
      addActivity("sos", "Emergency call opened", `Dialer opened for ${emergencyNumber}.`);
      renderActivities();
    });

    $("#shareLocationButton")?.addEventListener("click", handleSosLocationShare);
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        area.remove();
      }
    });
  }

  function showSosResult(message) {
    const result = $("#sosResult");
    if (!result) return;
    result.hidden = false;
    result.textContent = message;
  }

  function handleSosLocationShare() {
    const button = $("#shareLocationButton");
    const contact = state?.contact || createDemoState().contact;
    const journey = state?.journey;
    const firstName = contact.name.split(" ")[0];
    const fallback = journey
      ? `EMERGENCY: I may need help. I'm travelling from ${journey.origin} to ${journey.destination}, expected ${formatTime(
          journey.expectedAt
        )}. Please call me.`
      : "EMERGENCY: I may need help. Please call me.";

    if (!navigator.geolocation) {
      copyText(fallback)
        .then(() => {
          showSosResult(`Location isn't available here. A prepared emergency message was copied — send it to ${firstName}.`);
          showToast("Emergency message copied.");
        })
        .catch(() => showSosResult("Location isn't available and the message could not be copied. Call emergency services if you're in danger."));
      return;
    }

    if (button) {
      button.disabled = true;
      button.querySelector("strong").textContent = "Finding location…";
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const mapsLink = `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        const message = `EMERGENCY: I may need help. My live location: ${mapsLink}. ${journey ? `I was travelling to ${journey.destination}.` : ""}`;
        try {
          await copyText(message);
          showSosResult("Location copied. Send it to your trusted contact or emergency services now.");
          addActivity("sos", "Live location prepared", "Location copied to share in an emergency.");
          renderActivities();
          showToast("Location and emergency message copied.");
        } catch {
          showSosResult(`Your location is ${mapsLink}. Copy it manually if needed.`);
        }
        if (button) {
          button.disabled = false;
          button.querySelector("strong").textContent = "Share my location";
        }
      },
      async () => {
        try {
          await copyText(fallback);
          showSosResult(`Location permission was unavailable. A prepared emergency message was copied for ${firstName}.`);
        } catch {
          showSosResult("Location permission was unavailable. Call emergency services if you're in danger.");
        }
        if (button) {
          button.disabled = false;
          button.querySelector("strong").textContent = "Share my location";
        }
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 }
    );
  }

  /* ---------- Toasts ---------- */

  function showToast(message, isWarning = false) {
    if (!toastRoot) return;
    const toast = document.createElement("div");
    toast.className = `toast${isWarning ? " is-warn" : ""}`;
    toast.innerHTML = `<span class="toast-icon">${isWarning ? icons.alert : icons.check}</span><span>${escapeHTML(
      message
    )}</span>`;
    toastRoot.appendChild(toast);
    const id = ++toastCounter;
    toast.dataset.toastId = String(id);
    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 200);
    }, 4200);
    while (toastRoot.children.length > 3) {
      toastRoot.firstElementChild?.remove();
    }
  }

  /* ---------- Modal focus ---------- */

  function trapFocus(event) {
    if (event.key !== "Tab" || !modalRoot.innerHTML) return;
    const modal = modalRoot.querySelector(".modal");
    if (!modal) return;
    const focusable = $$("a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])", modal).filter((element) => {
      return element.offsetParent !== null || element === document.activeElement;
    });
    if (!focusable.length) {
      event.preventDefault();
      modal.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------- Events ---------- */

  function bindEvents() {
    $("#newRouteButton")?.addEventListener("click", openNewRouteModal);
    $("#emptyStartButton")?.addEventListener("click", openNewRouteModal);
    $("#shareButton")?.addEventListener("click", openShareModal);
    $("#toolkitShareButton")?.addEventListener("click", openShareModal);
    $("#checkinButton")?.addEventListener("click", checkIn);
    $("#endJourneyButton")?.addEventListener("click", openEndJourneyModal);
    $("#notifyButton")?.addEventListener("click", () => enableNotifications());
    $("#profileButton")?.addEventListener("click", openProfileModal);
    $("#navContacts")?.addEventListener("click", openContactModal);
    $("#editContactButton")?.addEventListener("click", openContactModal);
    $("#textContact")?.addEventListener("click", () => {
      const phone = sanitizePhone(state?.contact?.phone);
      window.location.href = `sms:${phone}?&body=${encodeURIComponent("Just checking in — all good?")}`;
    });
    $("#resetDemoButton")?.addEventListener("click", openResetModal);
    $("#viewAllActivityButton")?.addEventListener("click", openActivityModal);

    document.addEventListener("click", (event) => {
      const checkInTrigger = event.target.closest('[data-action="checkin"]');
      if (checkInTrigger) {
        event.preventDefault();
        checkIn();
      }

      const navLink = event.target.closest(".nav-link");
      if (navLink && navLink.tagName === "A") {
        $$(".nav-link").forEach((link) => link.classList.remove("is-active"));
        navLink.classList.add("is-active");
      }
    });

    modalRoot.addEventListener("click", (event) => {
      if (
        event.target.classList.contains("modal-backdrop") ||
        event.target.closest("[data-close]")
      ) {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modalRoot.innerHTML) {
        closeModal();
      }
    });

    document.addEventListener("keydown", trapFocus);

    window.addEventListener("hashchange", () => {
      if (window.location.hash.startsWith("#watch=")) {
        window.location.reload();
      }
    });

    window.addEventListener("storage", (event) => {
      if (!isWatchMode || event.key !== STORAGE_KEY) return;
      const snapshot = parseWatchHash();
      if (!snapshot || snapshot.error) return;
      watchData = getLiveWatchData(snapshot);
      watchSourceLive = Boolean(watchData.live);
      renderWatchPage();
    });
  }

  function bindSos() {
    sosButton.addEventListener("pointerdown", startSosHold);
    sosButton.addEventListener("pointerup", endSosHold);
    sosButton.addEventListener("pointercancel", endSosHold);
    sosButton.addEventListener("keydown", (event) => {
      if ((event.key === " " || event.key === "Enter") && !event.repeat) {
        startSosHold(event);
      }
    });
    sosButton.addEventListener("keyup", (event) => {
      if (event.key === " " || event.key === "Enter") {
        endSosHold();
      }
    });
    sosButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (suppressSosClick) {
        suppressSosClick = false;
        return;
      }
      if (!modalRoot.innerHTML) {
        showToast("Hold SOS for three seconds to open emergency actions.");
      }
    });
    sosButton.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  /* ---------- Boot ---------- */

  function init() {
    const watchInitialized = initWatchView();
    if (!watchInitialized) {
      state = readState() || createDemoState();
      saveState();
      bindEvents();
      bindSos();
      renderAll();
    }

    tick();
    window.setInterval(tick, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
