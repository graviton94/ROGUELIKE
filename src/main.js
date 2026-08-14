/* ═══════════════════════════════════════════════════════════
   main.js — boot.
   ═══════════════════════════════════════════════════════════ */

import { bakeAll } from './pixels.js';
import * as UI from './ui.js';
import { G } from './game.js';
import * as Game from './game.js';
import * as Save from './save.js';
import * as Data from './data.js';
import * as Audio from './audio.js';

bakeAll();
UI.bindInput();
UI.startLoop();

const $ = id => document.getElementById(id);

$('btn-new').onclick    = () => UI.openSlots('new');
$('btn-load').onclick   = () => UI.openSlots('load');
$('slots-back').onclick = () => UI.setScreen('title');
$('btn-again').onclick  = () => location.reload();
/* A finished run still has a reader. The ledger, the codex and the
   shackle ladder all live on the title, and until now the only
   door out of the ending was a page reload. */
$('btn-totitle').onclick  = () => { G.running = false; UI.setScreen('title'); };
$('btn-endcodex').onclick = () => { G.running = false; UI.setScreen('codex'); };
$('btn-share').onclick    = () => UI.shareRun();

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
window.Audio2 = Audio;

/* Browsers refuse to start audio before a real gesture, and
   asking earlier only logs warnings. Hook the first one, take
   the stored preference with it, then get out of the way. */
Audio.loadPref();
const wake = () => {
  Audio.init();
  Audio.loadPref();
  for (const ev of ['pointerdown', 'keydown']) window.removeEventListener(ev, wake);
};
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, wake, { passive: true });
