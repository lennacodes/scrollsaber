const modeBtns = document.querySelectorAll(".mode-btn");
const colorBtns = document.querySelectorAll(".saber-btn");
const hiltBtns = document.querySelectorAll(".hilt-btn");
const flickerToggle = document.getElementById("flicker-toggle");
const lefthandToggle = document.getElementById("lefthand-toggle");
const soundToggle = document.getElementById("sound-toggle");
const dualToggle = document.getElementById("dual-toggle");
const dualRow = document.getElementById("dual-row");
const dualHint = document.getElementById("dual-hint");
const volumeSlider = document.getElementById("volume-slider");
const widthSlider = document.getElementById("width-slider");
const customToggle = document.getElementById("custom-toggle");
const customSwatch = document.getElementById("custom-swatch");
const customWrap = document.querySelector(".custom-color");
const hueSlider = document.getElementById("hue-slider");
const brightSlider = document.getElementById("bright-slider");

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}

function updateCustomSwatch() {
  const hex = hslToHex(parseInt(hueSlider.value), 100, parseInt(brightSlider.value));
  customSwatch.style.background = hex;
  customSwatch.style.boxShadow = "0 0 6px " + hex;
  return hex;
}

function updateDualEnabled(mode) {
  if (mode === "eject") {
    dualRow.classList.remove("disabled", "flash");
    dualHint.classList.remove("show");
  } else {
    dualRow.classList.add("disabled");
    // Turn off dual if switching away from eject
    if (dualToggle.checked) {
      dualToggle.checked = false;
      browser.storage.local.set({ saberMaul: false });
    }
  }
}

// Load saved state
browser.storage.local.get(["saberColor", "saberCustomColor", "saberCustomHue", "saberCustomBright", "saberHilt", "saberFlicker", "saberLeftHand", "saberMode", "saberSound", "saberVolume", "saberWidth", "saberMaul"]).then((result) => {
  const currentMode = result.saberMode || "eject";
  const currentColor = result.saberColor || "blue";
  const currentHilt = result.saberHilt || "chrome";
  const flickerOn = result.saberFlicker !== false;

  modeBtns.forEach((btn) => {
    if (btn.dataset.mode === currentMode) btn.classList.add("active");
  });

  if (result.saberCustomHue != null) hueSlider.value = result.saberCustomHue;
  if (result.saberCustomBright != null) brightSlider.value = result.saberCustomBright;
  updateCustomSwatch();

  if (currentColor === "custom") {
    customWrap.classList.add("active");
  } else {
    colorBtns.forEach((btn) => {
      if (btn.dataset.color === currentColor) btn.classList.add("active");
    });
  }

  hiltBtns.forEach((btn) => {
    if (btn.dataset.hilt === currentHilt) btn.classList.add("active");
  });
  flickerToggle.checked = flickerOn;
  lefthandToggle.checked = !!result.saberLeftHand;
  soundToggle.checked = result.saberSound !== false;
  dualToggle.checked = !!result.saberMaul;
  updateDualEnabled(currentMode);
  volumeSlider.value = result.saberVolume != null ? result.saberVolume : 50;
  widthSlider.value = result.saberWidth != null ? result.saberWidth : 1;
});

// Mode selection
modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    browser.storage.local.set({ saberMode: btn.dataset.mode });
    modeBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    updateDualEnabled(btn.dataset.mode);
  });
});

// Color selection (presets)
colorBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    browser.storage.local.set({ saberColor: btn.dataset.color });
    colorBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    customWrap.classList.remove("active", "open");
  });
});

// Custom color toggle
customToggle.addEventListener("click", () => {
  const isOpen = customWrap.classList.toggle("open");
  if (isOpen) {
    const hex = updateCustomSwatch();
    browser.storage.local.set({ saberColor: "custom", saberCustomColor: hex });
    colorBtns.forEach((b) => b.classList.remove("active"));
    customWrap.classList.add("active");
  }
});

// Hue / Brightness sliders
hueSlider.addEventListener("input", () => {
  const hex = updateCustomSwatch();
  browser.storage.local.set({
    saberColor: "custom",
    saberCustomColor: hex,
    saberCustomHue: parseInt(hueSlider.value)
  });
  colorBtns.forEach((b) => b.classList.remove("active"));
  customWrap.classList.add("active");
});

brightSlider.addEventListener("input", () => {
  const hex = updateCustomSwatch();
  browser.storage.local.set({
    saberColor: "custom",
    saberCustomColor: hex,
    saberCustomBright: parseInt(brightSlider.value)
  });
  colorBtns.forEach((b) => b.classList.remove("active"));
  customWrap.classList.add("active");
});

// Hilt selection
hiltBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    browser.storage.local.set({ saberHilt: btn.dataset.hilt });
    hiltBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Flicker toggle
flickerToggle.addEventListener("change", () => {
  browser.storage.local.set({ saberFlicker: flickerToggle.checked });
});

// Left-hand toggle
lefthandToggle.addEventListener("change", () => {
  browser.storage.local.set({ saberLeftHand: lefthandToggle.checked });
});

// Sound FX toggle
soundToggle.addEventListener("change", () => {
  browser.storage.local.set({ saberSound: soundToggle.checked });
});

// Dual mode toggle
dualToggle.addEventListener("change", () => {
  browser.storage.local.set({ saberMaul: dualToggle.checked });
});

// Show hint when clicking disabled dual toggle
dualRow.addEventListener("click", (e) => {
  if (!dualRow.classList.contains("disabled")) return;
  e.preventDefault();
  e.stopPropagation();
  dualRow.classList.add("flash");
  dualHint.classList.add("show");
  setTimeout(() => {
    dualHint.classList.remove("show");
    dualRow.classList.remove("flash");
  }, 1500);
});

// Volume slider
volumeSlider.addEventListener("input", () => {
  browser.storage.local.set({ saberVolume: parseInt(volumeSlider.value) });
});

// Width slider
widthSlider.addEventListener("input", () => {
  browser.storage.local.set({ saberWidth: parseInt(widthSlider.value) });
});
