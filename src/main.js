/* ═══════════════════════════════════════════════════════════
   main.js — boot.
   ═══════════════════════════════════════════════════════════ */

import { bakeAll } from './pixels.js';
import * as UI from './ui.js';
import { G } from './game.js';

bakeAll();
UI.bindInput();
UI.startLoop();

document.getElementById('btn-new').onclick = () => {
  UI.setScreen('create');
  UI.renderCreate();
};

UI.setScreen('title');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// expose for console tinkering while developing
window.G = G;
