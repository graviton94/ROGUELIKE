/* build.mjs — 시안 하나를 자립형 HTML로 굽는다.
   아티팩트는 CDN을 못 부르므로 글꼴을 data URI로 박아 넣는다.
   usage: node proto/build.mjs > proto/deeprun-delve.html */
import { readFileSync } from 'node:fs';
const b64 = p => readFileSync(new URL(p, import.meta.url)).toString('base64');
process.stdout.write(
  readFileSync(new URL('./deeprun-delve.src.html', import.meta.url), 'utf8')
    .replace('__REG__',  b64('../fonts/Galmuri11.woff2'))
    .replace('__BOLD__', b64('../fonts/Galmuri11-Bold.woff2')));
