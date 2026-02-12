# ScrollSaber

A Firefox extension that replaces your scrollbar with a beam sword.

![Firefox](https://img.shields.io/badge/Firefox-Extension-ff7139?logo=firefoxbrowser&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

**Three scrollbar modes:**
- **Eject** — Double-click the hilt to ignite. Blade extends upward from the hilt with contact sparks, molten melt effects, and flying embers when the blade hits the top. Enable **Dual mode** for a double-bladed sword that extends from both ends.
- **Sword** — Hilt moves as a scroll handle. Blade extends upward as you scroll.
- **Static** — Hilt fixed at top, blade extends downward like a classic scrollbar.

**Four hilt designs:**
- Chrome slim (thin grip rings, red activation switch)
- Dark aggressive (black body, silver bands)
- Electrum gold (ornate, gold finish)
- Copper stepped (brass tones, tiered shroud)

**Seven blade colors:**
- Blue, Green, Red, Purple, Black (Darksword), White, and a custom color picker with hue/brightness sliders.

**Additional settings:**
- Dual mode (double-bladed, eject only)
- Blade flicker animation
- Left-hand mode
- Sound effects (eject/retract) with volume control
- Blade width adjustment
- Clash sparks when hitting scroll boundaries

## Install

### Firefox Add-ons (recommended)
Coming soon.

### Manual install (development)
1. Clone this repo
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select `manifest.json` from the cloned directory

## How it works

ScrollSaber hides the native scrollbar with `scrollbar-width: none` and renders a full DOM-based scrollbar overlay using `position: fixed`. All styling is driven by CSS custom properties. Settings are persisted with `browser.storage.local` and synced in real time between the popup and content script via `browser.storage.onChanged`.

No remote resources. No dependencies. Pure vanilla JS and CSS.

## Project structure

```
scrollsaber/
  manifest.json         Extension manifest (v2)
  scrollsaber.js        Content script — builds and drives the sword overlay
  scrollsaber.css       All scrollbar, blade, hilt, spark, and melt styles
  popup/
    popup.html          Extension popup UI
    popup.js            Popup logic — reads/writes settings to storage
    popup.css           Popup styling with starfield background
  icons/
    scrollsaber-48.svg  Toolbar and extension icon
  sounds/
    eject.ogg           Blade ignition sound
    retract.ogg         Blade retraction sound
  LICENSE               MIT License
  PRIVACY.md            Privacy policy
```

## Privacy

ScrollSaber collects zero data. All preferences are stored locally in your browser. No analytics, no tracking, no network requests. See [PRIVACY.md](PRIVACY.md) for details.

## Contributing

Issues and pull requests are welcome at [github.com/lennacodes/scrollsaber](https://github.com/lennacodes/scrollsaber).

## License

[MIT](LICENSE)

## Support

If you enjoy ScrollSaber, consider [buying me a coffee](https://buymeacoffee.com/lennacodes).
