// ScrollSaber — Three scrollbar modes: Classic, Saber, Eject

(function () {
  "use strict";

  if (window !== window.top) return;

  const SABER_COLORS = {
    blue:   { color: "#4af",  bright: "#7cf",  glow: "#4af",  glowOuter: "rgba(68,170,255,0.4)"  },
    green:  { color: "#4f4",  bright: "#8f8",  glow: "#4f4",  glowOuter: "rgba(68,255,68,0.4)"   },
    red:    { color: "#f44",  bright: "#f88",  glow: "#f44",  glowOuter: "rgba(255,68,68,0.4)"   },
    purple: { color: "#c4f",  bright: "#d8f",  glow: "#c4f",  glowOuter: "rgba(200,68,255,0.4)"  },
    dark:   { color: "#222",  bright: "#fff",  glow: "#fff",  glowOuter: "rgba(255,255,255,0.3)" },
    white:  { color: "#eef",  bright: "#fff",  glow: "#ddf",  glowOuter: "rgba(220,220,255,0.4)" },
  };

  const VALID_HILTS = ["luke", "vader", "windu", "obiwan"];
  const VALID_MODES = ["classic", "saber", "eject"];

  const SCROLL_STEP = 80;
  const HOLD_DELAY = 300;
  const HOLD_INTERVAL = 40;
  const BLADE_LENGTH_RATIO = 4.55; // Eject blade length relative to hilt height

  // --- DOM refs ---
  let track, hilt, bladeArea, blade, blade2;

  // --- Core state ---
  let isDragging = false;
  let dragStartY = 0;
  let dragStartScroll = 0;
  let holdTimer = null;
  let holdInterval = null;
  let updateQueued = false;
  let leftHandMode = false;
  let lastScrollY = -1;
  let lastScrollHeight = 0;
  let clashCooldown = false;
  let currentMode = "classic";
  let bladeEjected = false;
  let hasIgnited = false;
  let maulMode = false;

  // --- Flicker ---
  let flickerEnabled = true;
  let flickerRunning = false;

  // --- Contact sparks & melt (top) ---
  let contactSparksActive = false;
  let contactSparksInterval = null;
  let contactIntensity = 0;
  let meltDripInterval = null;
  let meltJitterRAF = null;
  let lastSparkRate = 0;
  let lastDripRate = 0;

  // --- Contact sparks & melt (bottom — Maul mode) ---
  let contactSparksActive2 = false;
  let contactSparksInterval2 = null;
  let contactIntensity2 = 0;
  let meltDripInterval2 = null;
  let meltJitterRAF2 = null;
  let lastSparkRate2 = 0;
  let lastDripRate2 = 0;

  // --- Color ---
  let currentColor = SABER_COLORS.blue;
  let customColorHex = null;

  // --- Audio ---
  let soundEnabled = false;
  let sndIgnition = null;
  let sndRetraction = null;
  let soundVolume = 1;

  // --- Layout adjustment ---
  const TRACK_W = 28;
  let adjustTimer = null;

  // --- Build DOM ---
  function build() {
    track = document.createElement("div");
    track.id = "scrollsaber-track";

    hilt = document.createElement("div");
    hilt.id = "scrollsaber-hilt";
    hilt.innerHTML =
      '<div id="scrollsaber-pommel"></div>' +
      '<div id="scrollsaber-emitter2"></div>' +
      '<div id="scrollsaber-hilt-body">' +
        '<div id="scrollsaber-grip"></div>' +
        '<div id="scrollsaber-switch"></div>' +
      '</div>' +
      '<div id="scrollsaber-emitter"></div>';

    bladeArea = document.createElement("div");
    bladeArea.id = "scrollsaber-blade-area";

    blade = document.createElement("div");
    blade.id = "scrollsaber-blade";

    blade2 = document.createElement("div");
    blade2.id = "scrollsaber-blade2";

    const clash = document.createElement("div");
    clash.id = "scrollsaber-clash";

    const contact = document.createElement("div");
    contact.id = "scrollsaber-contact";

    const melt = document.createElement("div");
    melt.id = "scrollsaber-melt";

    const contact2 = document.createElement("div");
    contact2.id = "scrollsaber-contact2";

    const melt2 = document.createElement("div");
    melt2.id = "scrollsaber-melt2";

    bladeArea.appendChild(blade);
    bladeArea.appendChild(blade2);
    bladeArea.appendChild(clash);
    track.appendChild(hilt);
    track.appendChild(bladeArea);
    track.appendChild(contact);
    track.appendChild(melt);
    track.appendChild(contact2);
    track.appendChild(melt2);
    document.documentElement.appendChild(track);
  }

  // --- Apply hilt style ---
  function applyHilt(name) {
    if (!VALID_HILTS.includes(name)) name = "luke";
    VALID_HILTS.forEach(h => track.classList.remove("hilt-" + h));
    track.classList.add("hilt-" + name);
  }

  // --- Apply mode ---
  function applyMode(mode) {
    if (!VALID_MODES.includes(mode)) mode = "classic";
    currentMode = mode;

    // Swap mode class on track
    VALID_MODES.forEach(m => track.classList.remove("mode-" + m));
    track.classList.add("mode-" + mode);

    // Reset blade state
    blade.style.height = "0";
    blade.style.top = "";
    blade.classList.remove("igniting", "retracting");
    bladeEjected = false;
    track.classList.remove("blade-ejected");
    setContactSparks(false);
    // Force-reset melt element
    if (meltJitterRAF) { cancelAnimationFrame(meltJitterRAF); meltJitterRAF = null; }
    const meltEl = document.getElementById("scrollsaber-melt");
    if (meltEl) {
      meltEl.classList.remove("active", "cooling");
      meltEl.removeAttribute("style");
    }

    // Reset blade2 (Maul mode)
    blade2.style.height = "0";
    blade2.style.top = "";
    blade2.style.display = "none";
    blade2.classList.remove("igniting", "retracting");
    setContactSparks2(false);
    if (meltJitterRAF2) { cancelAnimationFrame(meltJitterRAF2); meltJitterRAF2 = null; }
    const meltEl2 = document.getElementById("scrollsaber-melt2");
    if (meltEl2) {
      meltEl2.classList.remove("active", "cooling");
      meltEl2.removeAttribute("style");
    }

    // Hide blade entirely in eject mode (shown on double-click)
    blade.style.display = mode === "eject" ? "none" : "";

    // Reset hilt position for classic mode
    if (mode === "classic") {
      hilt.style.top = "";
    }

    // Re-trigger ignition state for classic mode
    if (mode === "classic" && window.scrollY > 0) {
      hasIgnited = true;
    } else if (mode !== "classic") {
      hasIgnited = true;
    }

    updateBlade();
  }

  // --- Scroll math ---
  function getScrollMax() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function getScrollFraction() {
    const max = getScrollMax();
    return max <= 0 ? 0 : Math.min(1, window.scrollY / max);
  }

  // --- Eject blade geometry helper ---
  function getEjectBladeGeometry(hiltTop, hiltH) {
    const fixedLen = Math.round(hiltH * BLADE_LENGTH_RATIO);
    const bladeH = Math.min(fixedLen, hiltTop);
    const bladeTop = hiltTop - bladeH; // 0 when capped
    const touching = hiltTop > 0 && bladeTop <= 0;
    // How far the blade is pushed past the top (0 = just touching, 1 = fully compressed)
    const pushDepth = touching ? Math.min(1, (fixedLen - hiltTop) / fixedLen) : 0;
    return { bladeH, bladeTop, touching, pushDepth };
  }

  // --- Maul mode: bottom blade geometry ---
  function getEjectBlade2Geometry(hiltTop, hiltH, trackH) {
    const fixedLen = Math.round(hiltH * BLADE_LENGTH_RATIO);
    const bladeStart = hiltTop + hiltH;
    const maxLen = trackH - bladeStart;
    const bladeH = Math.max(0, Math.min(fixedLen, maxLen));
    const touching = maxLen >= 0 && maxLen < fixedLen;
    const pushDepth = touching ? Math.min(1, (fixedLen - maxLen) / fixedLen) : 0;
    return { bladeH, bladeStart, touching, pushDepth };
  }

  function updateBlade() {
    if (!blade || !bladeArea) return;
    if (isDragging) return;

    const scrollMax = getScrollMax();
    if (scrollMax <= 0) {
      track.style.display = "none";
      return;
    }
    track.style.display = "";

    const sh = document.documentElement.scrollHeight;
    if (Math.abs(sh - lastScrollHeight) > 200 && lastScrollHeight > 0) {
      lastScrollHeight = sh;
      return;
    }
    lastScrollHeight = sh;

    const frac = getScrollFraction();

    if (currentMode === "classic") {
      const areaH = bladeArea.clientHeight;
      const bladeH = Math.round(frac * areaH);
      blade.style.height = bladeH + "px";
      bladeArea.style.setProperty("--blade-height", bladeH + "px");
    } else {
      const trackH = track.clientHeight;
      const hiltH = hilt.offsetHeight;
      const scrollableH = trackH - hiltH;
      const hiltTop = Math.round(frac * scrollableH);

      hilt.style.top = hiltTop + "px";

      if (currentMode === "saber") {
        blade.style.top = "0";
        blade.style.height = hiltTop + "px";
        bladeArea.style.setProperty("--blade-height", hiltTop + "px");
      } else if (currentMode === "eject" && bladeEjected) {
        const geo = getEjectBladeGeometry(hiltTop, hiltH);
        blade.style.top = geo.bladeTop + "px";
        blade.style.height = geo.bladeH + "px";
        bladeArea.style.setProperty("--blade-height", geo.bladeH + "px");
        setContactSparks(geo.touching, geo.pushDepth);

        if (maulMode) {
          const geo2 = getEjectBlade2Geometry(hiltTop, hiltH, trackH);
          blade2.style.top = geo2.bladeStart + "px";
          blade2.style.height = geo2.bladeH + "px";
          setContactSparks2(geo2.touching, geo2.pushDepth);
        }
      } else {
        blade.style.height = "0";
        blade.style.top = "0";
        bladeArea.style.setProperty("--blade-height", "0px");
        setContactSparks(false);
        if (maulMode) {
          blade2.style.height = "0";
          setContactSparks2(false);
        }
      }
    }
  }

  function queueUpdate() {
    if (updateQueued) return;
    updateQueued = true;
    requestAnimationFrame(() => {
      updateQueued = false;
      updateBlade();
    });
  }

  // --- Hilt button: click to scroll up (classic mode only) ---
  function startHoldScroll() {
    if (currentMode !== "classic") return;
    stopHoldScroll();
    window.scrollBy({ top: -SCROLL_STEP, behavior: "smooth" });
    holdTimer = setTimeout(() => {
      holdInterval = setInterval(() => {
        window.scrollBy({ top: -SCROLL_STEP });
      }, HOLD_INTERVAL);
    }, HOLD_DELAY);
  }

  function stopHoldScroll() {
    clearTimeout(holdTimer);
    clearInterval(holdInterval);
    holdTimer = null;
    holdInterval = null;
  }

  // --- Blade drag (classic mode) ---
  function onBladeMouseDown(e) {
    if (currentMode !== "classic") return;
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    dragStartY = e.clientY;
    dragStartScroll = window.scrollY;
    blade.classList.add("dragging");
    document.addEventListener("mousemove", onDragMove, true);
    document.addEventListener("mouseup", onDragEnd, true);
  }

  // --- Hilt drag (saber/eject modes) ---
  function onHiltDragDown(e) {
    if (currentMode === "classic") return;
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    dragStartY = e.clientY;
    dragStartScroll = window.scrollY;
    hilt.classList.add("dragging");
    document.addEventListener("mousemove", onDragMove, true);
    document.addEventListener("mouseup", onDragEnd, true);
  }

  function onDragMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const scrollMax = getScrollMax();
    if (scrollMax <= 0) return;

    if (currentMode === "classic") {
      const areaH = bladeArea.clientHeight;
      if (areaH <= 0) return;

      const dy = e.clientY - dragStartY;
      const scrollDelta = (dy / areaH) * scrollMax;
      const newScroll = Math.max(0, Math.min(scrollMax, dragStartScroll + scrollDelta));

      window.scrollTo(0, newScroll);

      const frac = newScroll / scrollMax;
      const bladeH = Math.round(frac * areaH);
      blade.style.height = bladeH + "px";
      bladeArea.style.setProperty("--blade-height", bladeH + "px");
    } else {
      const trackH = track.clientHeight;
      const hiltH = hilt.offsetHeight;
      const scrollableH = trackH - hiltH;
      if (scrollableH <= 0) return;

      const dy = e.clientY - dragStartY;
      const scrollDelta = (dy / scrollableH) * scrollMax;
      const newScroll = Math.max(0, Math.min(scrollMax, dragStartScroll + scrollDelta));

      window.scrollTo(0, newScroll);

      const frac = newScroll / scrollMax;
      const hiltTop = Math.round(frac * scrollableH);
      hilt.style.top = hiltTop + "px";

      if (currentMode === "saber") {
        blade.style.top = "0";
        blade.style.height = hiltTop + "px";
        bladeArea.style.setProperty("--blade-height", hiltTop + "px");
      } else if (currentMode === "eject" && bladeEjected) {
        const geo = getEjectBladeGeometry(hiltTop, hiltH);
        blade.style.top = geo.bladeTop + "px";
        blade.style.height = geo.bladeH + "px";
        bladeArea.style.setProperty("--blade-height", geo.bladeH + "px");
        setContactSparks(geo.touching, geo.pushDepth);

        if (maulMode) {
          const geo2 = getEjectBlade2Geometry(hiltTop, hiltH, trackH);
          blade2.style.top = geo2.bladeStart + "px";
          blade2.style.height = geo2.bladeH + "px";
          setContactSparks2(geo2.touching, geo2.pushDepth);
        }
      }
    }
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    blade.classList.remove("dragging");
    hilt.classList.remove("dragging");
    document.removeEventListener("mousemove", onDragMove, true);
    document.removeEventListener("mouseup", onDragEnd, true);
    updateBlade();
  }

  // --- Eject mode: double-click to toggle blade ---
  function onHiltDblClick(e) {
    if (currentMode !== "eject") return;
    e.preventDefault();
    e.stopPropagation();

    if (!bladeEjected) {
      // Ignite — eject blade upward with fixed length
      bladeEjected = true;
      track.classList.add("blade-ejected");
      const trackH = track.clientHeight;
      const hiltH = hilt.offsetHeight;
      const scrollableH = trackH - hiltH;
      const frac = getScrollFraction();
      const hiltTop = Math.round(frac * scrollableH);
      const geo = getEjectBladeGeometry(hiltTop, hiltH);

      blade.style.display = "";
      blade.style.top = geo.bladeTop + "px";
      blade.style.height = geo.bladeH + "px";
      bladeArea.style.setProperty("--blade-height", geo.bladeH + "px");
      blade.classList.remove("retracting");
      blade.classList.add("igniting");
      blade.addEventListener("animationend", () => {
        blade.classList.remove("igniting");
      }, { once: true });
      setContactSparks(geo.touching, geo.pushDepth);

      // Maul mode — ignite bottom blade
      if (maulMode) {
        const geo2 = getEjectBlade2Geometry(hiltTop, hiltH, trackH);
        blade2.style.display = "block";
        blade2.style.top = geo2.bladeStart + "px";
        blade2.style.height = geo2.bladeH + "px";
        blade2.classList.remove("retracting");
        blade2.classList.add("igniting");
        blade2.addEventListener("animationend", () => {
          blade2.classList.remove("igniting");
        }, { once: true });
        setContactSparks2(geo2.touching, geo2.pushDepth);
      }

      playSound(sndIgnition);
    } else {
      // Retract blade
      bladeEjected = false;
      track.classList.remove("blade-ejected");
      setContactSparks(false);
      playSound(sndRetraction);
      const emitter = document.getElementById("scrollsaber-emitter");
      if (emitter) emitter.style.boxShadow = "";
      blade.classList.remove("igniting");
      blade.classList.add("retracting");
      blade.addEventListener("animationend", () => {
        blade.classList.remove("retracting");
        blade.style.height = "0";
        blade.style.top = "0";
        blade.style.display = "none";
        bladeArea.style.setProperty("--blade-height", "0px");
      }, { once: true });

      // Maul mode — retract bottom blade
      if (maulMode) {
        setContactSparks2(false);
        const emitter2 = document.getElementById("scrollsaber-emitter2");
        if (emitter2) emitter2.style.boxShadow = "";
        blade2.classList.remove("igniting");
        blade2.classList.add("retracting");
        blade2.addEventListener("animationend", () => {
          blade2.classList.remove("retracting");
          blade2.style.height = "0";
          blade2.style.top = "";
          blade2.style.display = "none";
        }, { once: true });
      }
    }
  }

  // --- Contact sparks + melt effect (eject blade touching top) ---
  function jitterMelt(meltEl) {
    if (!contactSparksActive || !meltEl) { meltJitterRAF = null; return; }
    // Randomize the melt shape each frame for organic look
    const skew = ((Math.random() - 0.5) * 6).toFixed(1);
    const blobL = (30 + Math.random() * 40).toFixed(0);
    const blobR = (30 + Math.random() * 40).toFixed(0);
    const hotspot = (40 + Math.random() * 30).toFixed(0);
    meltEl.style.setProperty("--melt-skew", skew + "deg");
    meltEl.style.setProperty("--melt-blobL", blobL + "%");
    meltEl.style.setProperty("--melt-blobR", blobR + "%");
    meltEl.style.setProperty("--melt-hotspot", hotspot + "%");
    meltJitterRAF = requestAnimationFrame(() => {
      setTimeout(() => jitterMelt(meltEl), 40 + Math.random() * 60);
    });
  }

  function setContactSparks(active, pushDepth) {
    const contactEl = document.getElementById("scrollsaber-contact");
    const meltEl = document.getElementById("scrollsaber-melt");
    if (!contactEl) return;

    if (active) {
      contactIntensity = pushDepth || 0;
      const glowScale = 0.6 + contactIntensity * 1.4;
      contactEl.style.transform = "scaleY(" + glowScale + ")";
      contactEl.style.opacity = (0.5 + contactIntensity * 0.5).toString();

      // Scale melt glow with intensity — organic size
      if (meltEl) {
        meltEl.classList.add("active");
        meltEl.classList.remove("cooling");
        const meltH = Math.round(8 + contactIntensity * 28);
        const meltOpacity = 0.3 + contactIntensity * 0.7;
        meltEl.style.height = meltH + "px";
        meltEl.style.opacity = meltOpacity.toString();
      }
    }

    if (active && !contactSparksActive) {
      contactSparksActive = true;
      contactEl.classList.add("active");
      spawnContactSparks(); // immediate burst on first contact
      updateSparkInterval();
      updateDripInterval();
      // Start organic jitter loop
      if (meltEl && !meltJitterRAF) jitterMelt(meltEl);
    } else if (active && contactSparksActive) {
      updateSparkInterval();
      updateDripInterval();
    } else if (!active && contactSparksActive) {
      contactSparksActive = false;
      const lastIntensity = contactIntensity;
      contactIntensity = 0;
      contactEl.classList.remove("active");
      contactEl.style.transform = "";
      contactEl.style.opacity = "";
      clearInterval(contactSparksInterval);
      contactSparksInterval = null;
      clearInterval(meltDripInterval);
      meltDripInterval = null;
      lastSparkRate = 0;
      lastDripRate = 0;
      if (meltJitterRAF) { cancelAnimationFrame(meltJitterRAF); meltJitterRAF = null; }

      // Trigger cooling — preserve last organic shape, fade from hot to cold
      if (meltEl && lastIntensity > 0.05) {
        const coolDur = (0.8 + lastIntensity * 1.5).toFixed(2);
        // Pass current state to cooling animation via CSS vars
        meltEl.style.setProperty("--cool-dur", coolDur + "s");
        meltEl.style.setProperty("--cool-start-opacity", (0.3 + lastIntensity * 0.7).toFixed(2));
        meltEl.style.setProperty("--cool-height", meltEl.style.height);
        meltEl.classList.remove("active");
        meltEl.classList.add("cooling");
        meltEl.addEventListener("animationend", () => {
          meltEl.classList.remove("cooling");
          meltEl.style.height = "";
          meltEl.style.opacity = "";
          meltEl.style.removeProperty("--cool-dur");
          meltEl.style.removeProperty("--cool-start-opacity");
          meltEl.style.removeProperty("--cool-height");
          meltEl.style.removeProperty("--melt-skew");
          meltEl.style.removeProperty("--melt-blobL");
          meltEl.style.removeProperty("--melt-blobR");
          meltEl.style.removeProperty("--melt-hotspot");
        }, { once: true });
      } else if (meltEl) {
        meltEl.classList.remove("active", "cooling");
        meltEl.style.height = "";
        meltEl.style.opacity = "";
      }
    }
  }

  function updateSparkInterval() {
    const rate = Math.round(80 - contactIntensity * 55);
    if (rate === lastSparkRate && contactSparksInterval) return;
    lastSparkRate = rate;
    clearInterval(contactSparksInterval);
    contactSparksInterval = setInterval(spawnContactSparks, rate);
  }

  function updateDripInterval() {
    // Drips: only at moderate+ intensity, faster as it heats up
    if (contactIntensity < 0.15) {
      clearInterval(meltDripInterval);
      meltDripInterval = null;
      lastDripRate = 0;
      return;
    }
    const rate = Math.round(400 - contactIntensity * 280); // 400ms → 120ms
    if (rate === lastDripRate && meltDripInterval) return;
    lastDripRate = rate;
    clearInterval(meltDripInterval);
    meltDripInterval = setInterval(spawnMeltDrip, rate);
  }

  function spawnMeltDrip() {
    if (!bladeArea) return;
    const t = contactIntensity;
    const drip = document.createElement("div");
    drip.className = "scrollsaber-melt-drip";

    // Hotter = brighter drips
    if (t > 0.6 && Math.random() < 0.4) {
      drip.classList.add("drip-hot");
    } else if (t > 0.3 && Math.random() < 0.5) {
      drip.classList.add("drip-warm");
    }

    const fallDist = 20 + Math.random() * (30 + t * 60);
    const dur = 0.6 + Math.random() * 0.8;
    const drift = (Math.random() - 0.5) * 8;
    drip.style.setProperty("--fall", fallDist + "px");
    drip.style.setProperty("--drift", drift + "px");
    drip.style.setProperty("--dur", dur + "s");
    drip.style.left = (5 + Math.random() * 18) + "px";
    drip.style.top = "0";
    track.appendChild(drip);
    setTimeout(() => drip.remove(), dur * 1000 + 50);
  }

  function spawnContactSparks() {
    if (!bladeArea) return;
    const t = contactIntensity; // 0-1

    // More sparks at higher intensity: 2 at gentle touch → 8 at full push
    const count = 2 + Math.floor(t * 6) + Math.floor(Math.random() * (1 + t * 3));
    for (let i = 0; i < count; i++) {
      const spark = document.createElement("div");
      const r = Math.random();
      // Higher intensity = more hot embers
      const hotChance = 0.15 + t * 0.35;
      const warmChance = hotChance + 0.35;
      const type = r < hotChance ? "ember-hot" : r < warmChance ? "ember-warm" : "ember-dim";
      spark.className = "scrollsaber-contact-spark " + type;

      // Wider angles and farther distances at higher intensity
      const angleSpread = (1.0 + t * 0.8) * Math.PI; // arc widens with push
      const angle = Math.random() * angleSpread - angleSpread * 0.15;
      const baseSpeed = 15 + t * 30;
      const speed = baseSpeed + Math.random() * (50 + t * 80);
      let dx = Math.cos(angle) * speed;
      let dy = Math.abs(Math.sin(angle)) * speed + 3;

      // Wild flings get more likely and more extreme with intensity
      const wildChance = 0.1 + t * 0.2;
      const wild = Math.random();
      if (wild < wildChance * 0.5) {
        dx *= 2 + t * 2; // extreme sideways
      }
      if (wild > 1 - wildChance * 0.4) {
        dy = -Math.abs(dy) * (0.3 + t * 0.7); // upward bounce, harder at higher intensity
      }

      const dur = 0.2 + Math.random() * (0.4 + t * 0.4);
      spark.style.setProperty("--sx", dx + "px");
      spark.style.setProperty("--sy", dy + "px");
      spark.style.setProperty("--dur", dur + "s");
      spark.style.left = (4 + Math.random() * 20) + "px";
      spark.style.top = "0";
      track.appendChild(spark);
      setTimeout(() => spark.remove(), dur * 1000 + 50);
    }
  }

  // --- Bottom contact sparks + melt (Maul mode — blade hitting bottom) ---
  function jitterMelt2(meltEl) {
    if (!contactSparksActive2 || !meltEl) { meltJitterRAF2 = null; return; }
    const skew = ((Math.random() - 0.5) * 6).toFixed(1);
    const blobL = (30 + Math.random() * 40).toFixed(0);
    const blobR = (30 + Math.random() * 40).toFixed(0);
    const hotspot = (40 + Math.random() * 30).toFixed(0);
    meltEl.style.setProperty("--melt-skew2", skew + "deg");
    meltEl.style.setProperty("--melt-blobL2", blobL + "%");
    meltEl.style.setProperty("--melt-blobR2", blobR + "%");
    meltEl.style.setProperty("--melt-hotspot2", hotspot + "%");
    meltJitterRAF2 = requestAnimationFrame(() => {
      setTimeout(() => jitterMelt2(meltEl), 40 + Math.random() * 60);
    });
  }

  function setContactSparks2(active, pushDepth) {
    const contactEl = document.getElementById("scrollsaber-contact2");
    const meltEl = document.getElementById("scrollsaber-melt2");
    if (!contactEl) return;

    if (active) {
      contactIntensity2 = pushDepth || 0;
      const glowScale = 0.6 + contactIntensity2 * 1.4;
      contactEl.style.transform = "scaleY(" + glowScale + ")";
      contactEl.style.opacity = (0.5 + contactIntensity2 * 0.5).toString();

      if (meltEl) {
        meltEl.classList.add("active");
        meltEl.classList.remove("cooling");
        const meltH = Math.round(8 + contactIntensity2 * 28);
        const meltOpacity = 0.3 + contactIntensity2 * 0.7;
        meltEl.style.height = meltH + "px";
        meltEl.style.opacity = meltOpacity.toString();
      }
    }

    if (active && !contactSparksActive2) {
      contactSparksActive2 = true;
      contactEl.classList.add("active");
      spawnContactSparks2();
      updateSparkInterval2();
      updateDripInterval2();
      if (meltEl && !meltJitterRAF2) jitterMelt2(meltEl);
    } else if (active && contactSparksActive2) {
      updateSparkInterval2();
      updateDripInterval2();
    } else if (!active && contactSparksActive2) {
      contactSparksActive2 = false;
      const lastIntensity = contactIntensity2;
      contactIntensity2 = 0;
      contactEl.classList.remove("active");
      contactEl.style.transform = "";
      contactEl.style.opacity = "";
      clearInterval(contactSparksInterval2);
      contactSparksInterval2 = null;
      clearInterval(meltDripInterval2);
      meltDripInterval2 = null;
      lastSparkRate2 = 0;
      lastDripRate2 = 0;
      if (meltJitterRAF2) { cancelAnimationFrame(meltJitterRAF2); meltJitterRAF2 = null; }

      if (meltEl && lastIntensity > 0.05) {
        const coolDur = (0.8 + lastIntensity * 1.5).toFixed(2);
        meltEl.style.setProperty("--cool-dur2", coolDur + "s");
        meltEl.style.setProperty("--cool-start-opacity2", (0.3 + lastIntensity * 0.7).toFixed(2));
        meltEl.style.setProperty("--cool-height2", meltEl.style.height);
        meltEl.classList.remove("active");
        meltEl.classList.add("cooling");
        meltEl.addEventListener("animationend", () => {
          meltEl.classList.remove("cooling");
          meltEl.style.height = "";
          meltEl.style.opacity = "";
          meltEl.style.removeProperty("--cool-dur2");
          meltEl.style.removeProperty("--cool-start-opacity2");
          meltEl.style.removeProperty("--cool-height2");
          meltEl.style.removeProperty("--melt-skew2");
          meltEl.style.removeProperty("--melt-blobL2");
          meltEl.style.removeProperty("--melt-blobR2");
          meltEl.style.removeProperty("--melt-hotspot2");
        }, { once: true });
      } else if (meltEl) {
        meltEl.classList.remove("active", "cooling");
        meltEl.style.height = "";
        meltEl.style.opacity = "";
      }
    }
  }

  function updateSparkInterval2() {
    const rate = Math.round(80 - contactIntensity2 * 55);
    if (rate === lastSparkRate2 && contactSparksInterval2) return;
    lastSparkRate2 = rate;
    clearInterval(contactSparksInterval2);
    contactSparksInterval2 = setInterval(spawnContactSparks2, rate);
  }

  function updateDripInterval2() {
    if (contactIntensity2 < 0.15) {
      clearInterval(meltDripInterval2);
      meltDripInterval2 = null;
      lastDripRate2 = 0;
      return;
    }
    const rate = Math.round(400 - contactIntensity2 * 280);
    if (rate === lastDripRate2 && meltDripInterval2) return;
    lastDripRate2 = rate;
    clearInterval(meltDripInterval2);
    meltDripInterval2 = setInterval(spawnMeltDrip2, rate);
  }

  function spawnMeltDrip2() {
    if (!bladeArea) return;
    const t = contactIntensity2;
    const drip = document.createElement("div");
    drip.className = "scrollsaber-melt-drip";

    if (t > 0.6 && Math.random() < 0.4) {
      drip.classList.add("drip-hot");
    } else if (t > 0.3 && Math.random() < 0.5) {
      drip.classList.add("drip-warm");
    }

    const fallDist = -(20 + Math.random() * (30 + t * 60)); // Negative = upward
    const dur = 0.6 + Math.random() * 0.8;
    const drift = (Math.random() - 0.5) * 8;
    drip.style.setProperty("--fall", fallDist + "px");
    drip.style.setProperty("--drift", drift + "px");
    drip.style.setProperty("--dur", dur + "s");
    drip.style.left = (5 + Math.random() * 18) + "px";
    drip.style.top = "auto";
    drip.style.bottom = "0";
    track.appendChild(drip);
    setTimeout(() => drip.remove(), dur * 1000 + 50);
  }

  function spawnContactSparks2() {
    if (!bladeArea) return;
    const t = contactIntensity2;

    const count = 2 + Math.floor(t * 6) + Math.floor(Math.random() * (1 + t * 3));
    for (let i = 0; i < count; i++) {
      const spark = document.createElement("div");
      const r = Math.random();
      const hotChance = 0.15 + t * 0.35;
      const warmChance = hotChance + 0.35;
      const type = r < hotChance ? "ember-hot" : r < warmChance ? "ember-warm" : "ember-dim";
      spark.className = "scrollsaber-contact-spark " + type;

      const angleSpread = (1.0 + t * 0.8) * Math.PI;
      const angle = Math.random() * angleSpread - angleSpread * 0.15;
      const baseSpeed = 15 + t * 30;
      const speed = baseSpeed + Math.random() * (50 + t * 80);
      let dx = Math.cos(angle) * speed;
      let dy = -(Math.abs(Math.sin(angle)) * speed + 3); // Negative = upward

      const wildChance = 0.1 + t * 0.2;
      const wild = Math.random();
      if (wild < wildChance * 0.5) {
        dx *= 2 + t * 2;
      }
      if (wild > 1 - wildChance * 0.4) {
        dy = Math.abs(dy) * (0.3 + t * 0.7); // Downward bounce (opposite of top)
      }

      const dur = 0.2 + Math.random() * (0.4 + t * 0.4);
      spark.style.setProperty("--sx", dx + "px");
      spark.style.setProperty("--sy", dy + "px");
      spark.style.setProperty("--dur", dur + "s");
      spark.style.left = (4 + Math.random() * 20) + "px";
      spark.style.top = "auto";
      spark.style.bottom = "0";
      track.appendChild(spark);
      setTimeout(() => spark.remove(), dur * 1000 + 50);
    }
  }

  // --- Maul mode toggle ---
  function setMaulMode(on) {
    maulMode = on;
    if (on) {
      track.classList.add("maul-mode");
      // If blade is already ejected, ignite blade2 immediately
      if (currentMode === "eject" && bladeEjected) {
        const trackH = track.clientHeight;
        const hiltH = hilt.offsetHeight;
        const scrollableH = trackH - hiltH;
        const frac = getScrollFraction();
        const hiltTop = Math.round(frac * scrollableH);
        const geo2 = getEjectBlade2Geometry(hiltTop, hiltH, trackH);
        blade2.style.display = "block";
        blade2.style.top = geo2.bladeStart + "px";
        blade2.style.height = geo2.bladeH + "px";
        blade2.classList.remove("retracting");
        blade2.classList.add("igniting");
        blade2.addEventListener("animationend", () => {
          blade2.classList.remove("igniting");
        }, { once: true });
        setContactSparks2(geo2.touching, geo2.pushDepth);
      }
    } else {
      track.classList.remove("maul-mode");
      // If blade2 is visible, retract it
      if (bladeEjected && blade2.style.display !== "none") {
        setContactSparks2(false);
        const emitter2 = document.getElementById("scrollsaber-emitter2");
        if (emitter2) emitter2.style.boxShadow = "";
        blade2.classList.remove("igniting");
        blade2.classList.add("retracting");
        blade2.addEventListener("animationend", () => {
          blade2.classList.remove("retracting");
          blade2.style.height = "0";
          blade2.style.top = "";
          blade2.style.display = "none";
        }, { once: true });
      }
    }
  }

  // --- Audio engine (file-based) ---
  function setSoundEnabled(on) {
    soundEnabled = on;
    if (on && !sndIgnition) {
      sndIgnition = new Audio(browser.runtime.getURL("sounds/eject.ogg"));
      sndRetraction = new Audio(browser.runtime.getURL("sounds/retract.ogg"));
    }
  }

  function playSound(audio) {
    if (!soundEnabled || !audio) return;
    audio.volume = soundVolume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  // --- Click on empty track to jump ---
  function onTrackClick(e) {
    if (isDragging) return;
    if (currentMode === "eject") return; // Eject: hilt-only interaction
    if (e.target.closest("#scrollsaber-blade")) return;
    if (e.target.closest("#scrollsaber-hilt")) return;

    if (currentMode === "classic") {
      const areaRect = bladeArea.getBoundingClientRect();
      const clickY = e.clientY - areaRect.top;
      const areaH = areaRect.height;
      const frac = Math.max(0, Math.min(1, clickY / areaH));
      window.scrollTo({ top: frac * getScrollMax(), behavior: "smooth" });
    } else {
      const trackRect = track.getBoundingClientRect();
      const clickY = e.clientY - trackRect.top;
      const trackH = trackRect.height;
      const frac = Math.max(0, Math.min(1, clickY / trackH));
      window.scrollTo({ top: frac * getScrollMax(), behavior: "smooth" });
    }
  }

  // --- Saber color ---
  function hexToColorObj(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const br = Math.min(255, r + Math.round((255 - r) * 0.5));
    const bg = Math.min(255, g + Math.round((255 - g) * 0.5));
    const bb = Math.min(255, b + Math.round((255 - b) * 0.5));
    return {
      color: hex,
      bright: "#" + [br, bg, bb].map(v => v.toString(16).padStart(2, "0")).join(""),
      glow: hex,
      glowOuter: "rgba(" + r + "," + g + "," + b + ",0.4)"
    };
  }

  function applySaberColor(name, customHex) {
    let s;
    if (name === "custom" && customHex) {
      customColorHex = customHex;
      s = hexToColorObj(customHex);
    } else if (name === "custom" && customColorHex) {
      s = hexToColorObj(customColorHex);
    } else {
      s = SABER_COLORS[name] || SABER_COLORS.blue;
    }
    currentColor = s;
    const root = document.documentElement;
    root.style.setProperty("--saber-color", s.color);
    root.style.setProperty("--saber-color-bright", s.bright);
    root.style.setProperty("--saber-glow", s.glow);
    root.style.setProperty("--saber-glow-outer", s.glowOuter);
  }

  // --- Volume ---
  function setSoundVolume(val) {
    soundVolume = Math.max(0, Math.min(1, val / 100));
    if (sndIgnition) sndIgnition.volume = soundVolume;
    if (sndRetraction) sndRetraction.volume = soundVolume;
  }

  // --- Blade width ---
  function setBladeWidth(val) {
    const inset = 8 - (val - 1) * 1.5;
    track.style.setProperty("--blade-inset", inset + "px");
  }

  // --- Flicker engine ---
  function setFlicker(on) {
    flickerEnabled = on;
    if (on) {
      track.classList.remove("no-flicker");
      if (!flickerRunning) {
        flickerRunning = true;
        flickerLoop();
      }
    } else {
      track.classList.add("no-flicker");
      flickerRunning = false;
      const c = currentColor;
      const staticShadow =
        `0 0 4px #fff, 0 0 6px #fff, ` +
        `0 0 10px ${c.color}, 0 0 20px ${c.color}, 0 0 35px ${c.color}, ` +
        `0 0 50px ${c.glowOuter}, 0 0 80px ${c.glowOuter}`;
      blade.style.boxShadow = staticShadow;
      if (maulMode) blade2.style.boxShadow = staticShadow;
      const emitter = document.getElementById("scrollsaber-emitter");
      const emitter2 = document.getElementById("scrollsaber-emitter2");
      const emitterOff = currentMode === "eject" && !bladeEjected;
      const emitterShadow = emitterOff ? "" :
        `0 2px 6px ${c.color}, 0 4px 14px ${c.glowOuter}, ` +
        `inset 0 1px 0 rgba(255,255,255,0.3)`;
      if (emitter) emitter.style.boxShadow = emitterShadow;
      if (emitter2 && maulMode) emitter2.style.boxShadow = emitterShadow;
    }
  }

  function flickerLoop() {
    if (!blade || !flickerEnabled) { flickerRunning = false; return; }
    const bladeH = parseInt(blade.style.height) || 0;
    const blade2H = maulMode ? (parseInt(blade2.style.height) || 0) : 0;
    if (bladeH <= 0 && blade2H <= 0) {
      requestAnimationFrame(flickerLoop);
      return;
    }

    const c = currentColor;
    const r1 = 3  + Math.random() * 3;
    const r2 = 5  + Math.random() * 3;
    const r3 = 8  + Math.random() * 6;
    const r4 = 16 + Math.random() * 10;
    const r5 = 28 + Math.random() * 16;
    const r6 = 40 + Math.random() * 25;
    const r7 = 60 + Math.random() * 40;

    const bladeShadow =
      `0 0 ${r1}px #fff, ` +
      `0 0 ${r2}px #fff, ` +
      `0 0 ${r3}px ${c.color}, ` +
      `0 0 ${r4}px ${c.color}, ` +
      `0 0 ${r5}px ${c.color}, ` +
      `0 0 ${r6}px ${c.glowOuter}, ` +
      `0 0 ${r7}px ${c.glowOuter}`;
    blade.style.boxShadow = bladeShadow;
    if (maulMode && blade2H > 0) blade2.style.boxShadow = bladeShadow;

    const emitter = document.getElementById("scrollsaber-emitter");
    const emitter2El = maulMode ? document.getElementById("scrollsaber-emitter2") : null;
    if (emitter) {
      if (currentMode === "eject" && !bladeEjected) {
        emitter.style.boxShadow = "";
        if (emitter2El) emitter2El.style.boxShadow = "";
      } else {
        const er = 4 + Math.random() * 4;
        const er2 = 10 + Math.random() * 8;
        const emitterShadow =
          `0 2px ${er}px ${c.color}, ` +
          `0 4px ${er2}px ${c.glowOuter}, ` +
          `inset 0 1px 0 rgba(255,255,255,0.3)`;
        emitter.style.boxShadow = emitterShadow;
        if (emitter2El) emitter2El.style.boxShadow = emitterShadow;
      }
    }

    setTimeout(() => {
      requestAnimationFrame(flickerLoop);
    }, 30 + Math.random() * 60);
  }

  // --- Adjust fixed elements for track overlap ---
  function adjustFixedElements() {
    const els = document.querySelectorAll("*");
    for (const el of els) {
      if (el.closest("#scrollsaber-track")) continue;
      if (el.dataset.scrollsaberAdjusted) continue;

      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;

      const rect = el.getBoundingClientRect();
      if (leftHandMode) {
        if (rect.left <= 2) {
          const existing = parseFloat(cs.paddingLeft) || 0;
          el.style.setProperty("padding-left", (existing + TRACK_W) + "px", "important");
          el.dataset.scrollsaberAdjusted = "true";
        }
      } else {
        if (rect.right >= window.innerWidth - 2) {
          const existing = parseFloat(cs.paddingRight) || 0;
          el.style.setProperty("padding-right", (existing + TRACK_W) + "px", "important");
          el.dataset.scrollsaberAdjusted = "true";
        }
      }
    }
  }

  function queueAdjust() {
    clearTimeout(adjustTimer);
    adjustTimer = setTimeout(adjustFixedElements, 200);
  }

  function resetFixedElements() {
    const els = document.querySelectorAll("[data-scrollsaber-adjusted]");
    for (const el of els) {
      el.style.removeProperty("padding-right");
      el.style.removeProperty("padding-left");
      delete el.dataset.scrollsaberAdjusted;
    }
  }

  // --- Left-hand mode ---
  function setLeftHand(on) {
    leftHandMode = on;
    if (on) {
      track.classList.add("left-hand");
      document.documentElement.classList.add("scrollsaber-left");
    } else {
      track.classList.remove("left-hand");
      document.documentElement.classList.remove("scrollsaber-left");
    }
    resetFixedElements();
    adjustFixedElements();
  }

  // --- Ignition on first scroll (classic mode) ---
  function maybeIgnite() {
    if (hasIgnited) return;
    if (currentMode !== "classic") { hasIgnited = true; return; }
    if (window.scrollY > 0) {
      hasIgnited = true;
      blade.classList.add("igniting");
      blade.addEventListener("animationend", () => {
        blade.classList.remove("igniting");
      }, { once: true });
    }
  }

  // --- Clash effect ---
  function checkClash() {
    if (currentMode === "eject" && !bladeEjected) { lastScrollY = window.scrollY; return; }
    if (!hasIgnited) { lastScrollY = window.scrollY; return; }
    const scrollMax = getScrollMax();
    if (scrollMax <= 0) { lastScrollY = window.scrollY; return; }

    const sy = window.scrollY;
    if (lastScrollY < 0) { lastScrollY = sy; return; }

    const atBottom = sy >= scrollMax - 1;
    const atTop = sy <= 0;
    const wasAtBottom = lastScrollY >= scrollMax - 1;
    const wasAtTop = lastScrollY <= 0;

    if (atBottom && !wasAtBottom) triggerClash("bottom");
    if (atTop && !wasAtTop && lastScrollY > 10) triggerClash("top");

    lastScrollY = sy;
  }

  function triggerClash(position) {
    if (clashCooldown) return;
    clashCooldown = true;
    setTimeout(() => { clashCooldown = false; }, 500);

    const clashEl = document.getElementById("scrollsaber-clash");
    if (!clashEl) return;

    let clashY;
    if (currentMode === "classic") {
      clashY = position === "bottom" ? (parseInt(blade.style.height) || 0) : 0;
    } else {
      clashY = position === "top" ? 0 : (parseInt(blade.style.height) || 0);
    }
    clashEl.style.top = clashY + "px";

    clashEl.classList.remove("active");
    void clashEl.offsetWidth;
    clashEl.classList.add("active");

    for (let i = 0; i < 8; i++) {
      const spark = document.createElement("div");
      spark.className = "scrollsaber-spark";
      const dx = (Math.random() - 0.5) * 40;
      const dy = position === "bottom"
        ? 5 + Math.random() * 30
        : -(5 + Math.random() * 30);
      spark.style.setProperty("--sx", dx + "px");
      spark.style.setProperty("--sy", dy + "px");
      spark.style.left = "50%";
      spark.style.top = clashY + "px";
      track.appendChild(spark);
      setTimeout(() => spark.remove(), 400);
    }

    setTimeout(() => clashEl.classList.remove("active"), 400);
  }

  // --- Init ---
  function init() {
    build();

    if (window.scrollY > 0) {
      hasIgnited = true;
    }
    updateBlade();

    window.addEventListener("scroll", () => {
      maybeIgnite();
      checkClash();
      queueUpdate();
    }, { passive: true });
    window.addEventListener("resize", queueUpdate, { passive: true });

    const observer = new MutationObserver(() => {
      queueUpdate();
      queueAdjust();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    adjustFixedElements();
    setTimeout(adjustFixedElements, 1000);
    setTimeout(adjustFixedElements, 3000);

    blade.addEventListener("mousedown", onBladeMouseDown);

    bladeArea.addEventListener("click", onTrackClick);
    track.addEventListener("click", (e) => {
      if (currentMode !== "classic" && !e.target.closest("#scrollsaber-blade-area")) {
        onTrackClick(e);
      }
    });

    hilt.addEventListener("mousedown", (e) => {
      if (currentMode === "classic") {
        e.preventDefault();
        startHoldScroll();
      } else {
        onHiltDragDown(e);
      }
    });
    document.addEventListener("mouseup", stopHoldScroll);

    hilt.addEventListener("dblclick", onHiltDblClick);

    track.addEventListener("selectstart", (e) => e.preventDefault());

    browser.storage.local.get(["saberColor", "saberCustomColor", "saberHilt", "saberFlicker", "saberLeftHand", "saberMode", "saberSound", "saberVolume", "saberWidth", "saberMaul"]).then((result) => {
      applySaberColor(result.saberColor || "blue", result.saberCustomColor);
      applyHilt(result.saberHilt || "luke");
      applyMode(result.saberMode || "eject");
      const flicker = result.saberFlicker !== false;
      flickerEnabled = flicker;
      if (flicker) {
        flickerRunning = true;
        flickerLoop();
      } else {
        setFlicker(false);
      }
      if (result.saberLeftHand) setLeftHand(true);
      setSoundEnabled(result.saberSound !== false);
      setSoundVolume(result.saberVolume != null ? result.saberVolume : 50);
      setBladeWidth(result.saberWidth != null ? result.saberWidth : 1);
      if (result.saberMaul) setMaulMode(true);
    });

    browser.storage.onChanged.addListener((changes) => {
      if (changes.saberColor || changes.saberCustomColor) {
        const color = changes.saberColor ? changes.saberColor.newValue : null;
        const customHex = changes.saberCustomColor ? changes.saberCustomColor.newValue : null;
        if (color) applySaberColor(color, customHex);
        else if (customHex) applySaberColor("custom", customHex);
      }
      if (changes.saberHilt) applyHilt(changes.saberHilt.newValue);
      if (changes.saberFlicker) setFlicker(changes.saberFlicker.newValue);
      if (changes.saberLeftHand) setLeftHand(changes.saberLeftHand.newValue);
      if (changes.saberMode) applyMode(changes.saberMode.newValue);
      if (changes.saberSound) setSoundEnabled(!!changes.saberSound.newValue);
      if (changes.saberVolume) setSoundVolume(changes.saberVolume.newValue);
      if (changes.saberWidth) setBladeWidth(changes.saberWidth.newValue);
      if (changes.saberMaul) setMaulMode(!!changes.saberMaul.newValue);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
