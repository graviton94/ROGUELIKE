import * as P from '../src/pixels.js';
const N = 16;
let bad = 0;
const keys = new Set(Object.keys(P.PALETTE).concat(['C','D']));
function check(label, g) {
  if (!Array.isArray(g)) { console.log(`✗ ${label}: not an array`); bad++; return; }
  if (g.length !== N) { console.log(`✗ ${label}: ${g.length} rows`); bad++; }
  g.forEach((line, i) => {
    if (line.length !== N) { console.log(`✗ ${label} row ${i}: ${line.length} chars  |${line}|`); bad++; }
    for (const ch of line) if (!keys.has(ch)) { console.log(`✗ ${label} row ${i}: unknown key '${ch}'`); bad++; }
  });
}
for (const [n, g] of Object.entries(P.SPRITES)) check(`SPRITES.${n}`, g);
for (const [n, v] of Object.entries(P.RACE_BODY))
  for (const view of P.VIEWS) check(`RACE_BODY.${n}.${view}`, v[view]);
for (const [n, v] of Object.entries(P.CLASS_KIT))
  for (const view of P.VIEWS) check(`CLASS_KIT.${n}.${view}`, v[view]);
console.log(bad ? `\n${bad} problems` : '\nall grids 16×16, all keys known');
