/* ═══════════════════════════════════════════════════════════
   main.js — boot.
   ═══════════════════════════════════════════════════════════ */

import { bakeAll } from './pixels.js';
import * as UI from './ui.js';
import { G } from './game.js';
import * as Game from './game.js';
import * as Save from './save.js';
import * as Data from './data.js';

bakeAll();
UI.bindInput();
UI.startLoop();

const $ = id => document.getElementById(id);

$('btn-new').onclick    = () => UI.openSlots('new');
$('btn-load').onclick   = () => UI.openSlots('load');
$('slots-back').onclick = () => UI.setScreen('title');
$('btn-again').onclick  = () => location.reload();

UI.setScreen('title');

/* Register, then actively look for a newer worker. Without the
   update() nudge an installed PWA can sit on a stale build for
   a long time; with it, a reload after one visit is enough. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.update();
      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller)
            next.postMessage('skip-waiting');
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
    } catch { /* offline or unsupported; the game still runs */ }
  });
}

// expose for console tinkering while developing
window.G = G;
window.Game = Game;
window.Save = Save;
window.Data = Data;
window.UI = UI;
