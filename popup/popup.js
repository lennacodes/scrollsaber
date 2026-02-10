const modeBtns = document.querySelectorAll(".mode-btn");
const colorBtns = document.querySelectorAll(".saber-btn");
const hiltBtns = document.querySelectorAll(".hilt-btn");
const flickerToggle = document.getElementById("flicker-toggle");
const lefthandToggle = document.getElementById("lefthand-toggle");
const soundToggle = document.getElementById("sound-toggle");
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

// Load saved state
browser.storage.local.get(["saberColor", "saberCustomColor", "saberCustomHue", "saberCustomBright", "saberHilt", "saberFlicker", "saberLeftHand", "saberMode", "saberSound", "saberVolume", "saberWidth"]).then((result) => {
  const currentMode = result.saberMode || "eject";
  const currentColor = result.saberColor || "blue";
  const currentHilt = result.saberHilt || "luke";
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
  volumeSlider.value = result.saberVolume != null ? result.saberVolume : 100;
  widthSlider.value = result.saberWidth != null ? result.saberWidth : 1;
});

// Mode selection
modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    browser.storage.local.set({ saberMode: btn.dataset.mode });
    modeBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
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

// Volume slider
volumeSlider.addEventListener("input", () => {
  browser.storage.local.set({ saberVolume: parseInt(volumeSlider.value) });
});

// Width slider
widthSlider.addEventListener("input", () => {
  browser.storage.local.set({ saberWidth: parseInt(widthSlider.value) });
});
