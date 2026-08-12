/* ═══════════════════════════════════════════════════════════
   events.js — the ? room.

   Slay the Spire's `?` node is its cheapest content and its best:
   a screen of prose, two or three buttons, and a consequence you
   chose. No new art, no new controls, no new systems — and it is
   where most of a run's *story* comes from, because it is the
   only place the game reacts to what you happen to be carrying.

   That last part is the whole design here. Half of these are
   gated on something specific — a relic, an affix on your weapon,
   a kill streak you managed, a class that can cast. An event you
   can only see because of a choice you made forty turns ago is
   worth more than three generic ones.

   Every event receives an `api` object built by game.js. Nothing
   in this file imports the rules layer, so there is no cycle and
   these stay pure descriptions of an offer.

   Contract for one entry:
     id     stable key
     n      title
     t      the prose, shown once
     w      spawn weight
     when   optional (api) => bool — the gate
     opts   [{ n: label, t: what it does, run(api) }]
   Every option must resolve; there is no implicit "walk away"
   unless the event provides one, and most should.

   An option may also be a wager:
     odds   0..1 — printed on the button, rolled by game.js
     fail   (api) => void — the losing branch
     risk   one line naming what losing costs, printed in red
   All three come together or none of them do. game.js owns the
   roll on purpose, so the number on the button is provably the
   number that was rolled.
   ═══════════════════════════════════════════════════════════ */

const pct = (api, f) => Math.max(1, Math.round(api.p.maxhp * f));

export const EVENTS = [
  /* ── open to anyone ─────────────────────────────────────── */
  {
    id:'well', n:'말라붙은 우물', w:10,
    t:'두레박이 끊어진 우물. 바닥에서 쇳소리가 난다. 팔을 넣으면 닿을 것 같기도 하다.',
    opts:[
      { n:'팔을 넣는다', t:'재료를 건진다. 무언가에 물릴 수도 있다.',
        run: api => {
          if (api.chance(0.5)) { api.mats({ scrap: 3 + api.rnd(4), dust: 1 + api.rnd(2) }); api.say('녹슨 부품과 마른 가루를 건졌다.', 'good'); }
          else { api.hurt(pct(api, 0.14), '우물 속 무언가'); api.afflict('poison', 18); api.say('무언가가 손목을 물었다.', 'hit'); }
        } },
      { n:'돌을 떨어뜨려 본다', t:'깊이를 알 수 있다. 소리가 크다.',
        run: api => { api.rouse(9); api.say('한참 뒤에 소리가 올라왔다. 그리고 다른 소리도.', 'warn'); } },
      { n:'지나친다', t:'아무 일도 없다.', run: api => api.say('우물을 지나쳤다.') },
    ],
  },
  {
    id:'grave', n:'무너진 무덤', w:10,
    t:'뚜껑이 반쯤 밀려난 석관. 안쪽에서 마른 천 냄새가 난다.',
    opts:[
      { n:'파헤친다', t:'장비 하나. 안에 있던 것도 함께 나온다.',
        run: api => { api.gear(4); api.spawn('mummy', 1); api.say('붕대 감긴 것이 일어섰다.', 'hit'); } },
      { n:'기도한다', t:'체력을 전부 회복한다. 다음 층 전리품 −50%, 정예 +50%.',
        run: api => { api.heal(api.p.maxhp); api.nextFloor({ item: 0.5, elite: 1.5 });
                      api.say('숨이 트인다. 무언가를 빌렸다는 느낌이 든다.', 'good'); } },
      { n:'지나친다', t:'', run: api => api.say('무덤을 지나쳤다.') },
    ],
  },
  {
    id:'machine', n:'녹슨 기계', w:9,
    t:'톱니와 모루가 붙은 장치. 투입구에 쇳조각이 몇 개 끼어 있다.',
    opts:[
      { n:'쇳조각 6개를 넣는다', t:'착용 중인 물건 하나가 +1.',
        need: api => api.has({ scrap: 6 }),
        run: api => { api.pay({ scrap: 6 }); api.forge(1); } },
      { n:'쇳조각 14개를 넣는다', t:'착용 중인 물건 하나가 +2.',
        need: api => api.has({ scrap: 14 }),
        run: api => { api.pay({ scrap: 14 }); api.forge(2); } },
      { n:'뜯어낸다', t:'재료가 나온다. 톱니에 손이 갈린다.',
        run: api => { api.mats({ scrap: 2 + api.rnd(3), essence: api.chance(0.3) ? 1 : 0 });
                      api.hurt(Math.max(2, Math.round(api.p.maxhp * 0.08)), '톱니'); } },
    ],
  },
  {
    id:'twin', n:'쌍둥이 문', w:9,
    t:'똑같이 생긴 두 개의 문. 표시도 자물쇠도 없다. 하나는 무언가를 숨기고 있고, 하나는 무언가가 숨어 있다.',
    opts:[
      { n:'왼쪽을 연다', t:'반은 유물, 반은 정예 둘.', run: api => twinDoor(api) },
      { n:'오른쪽을 연다', t:'반은 유물, 반은 정예 둘.', run: api => twinDoor(api) },
      { n:'둘 다 두고 간다', t:'', run: api => api.say('두 문을 등지고 걸었다.') },
    ],
  },
  {
    id:'candles', n:'두 갈래 촛대', w:9,
    t:'가지가 둘로 갈라진 촛대. 한쪽 심지는 굵고 밝게, 한쪽은 가늘고 낮게 탄다.',
    opts:[
      { n:'굵은 심지', t:'불빛 반경 +2 영구. 기름을 300 태운다.',
        run: api => { api.perm('lightR', 2); api.burnOil(300); api.say('등불이 넓어졌다.', 'level'); } },
      { n:'가는 심지', t:'은신 +15%p 영구. 불빛 반경 −1 영구.',
        run: api => { api.perm('stealth', 0.15); api.perm('lightR', -1); api.say('발소리가 사라졌다. 대신 어둡다.', 'level'); } },
      { n:'양쪽을 끈다', t:'재료. 아무것도 배우지 않는다.',
        run: api => api.mats({ dust: 3 + api.rnd(3) }) },
    ],
  },
  {
    id:'scholar', n:'떠도는 학자', w:9,
    t:'무릎에 책을 펴 놓고 앉은 사람. 당신 배낭을 흘끔 본다. "이름을 붙여 드릴까요. 값은 받습니다."',
    opts:[
      { n:'금화 140을 낸다', t:'가진 미확인 물건이 전부 판별된다.',
        need: api => api.p.gold >= 140,
        run: api => { api.p.gold -= 140; const n = api.identifyAll(); api.say(n ? `${n}가지의 이름을 알았다.` : '판별할 것이 없었다.', 'good'); } },
      { n:'피를 조금 준다', t:'최대 체력의 15%. 같은 값을 한다.',
        run: api => { api.hurt(pct(api, 0.15), '학자의 바늘'); const n = api.identifyAll(); api.say(n ? `${n}가지의 이름을 알았다.` : '판별할 것이 없었다.', 'good'); } },
      { n:'거절한다', t:'', run: api => api.say('학자가 다시 책으로 눈을 내린다.') },
    ],
  },
  {
    id:'scales', n:'낡은 저울', w:8,
    t:'한쪽 접시에 마른 피가 굳어 있다. 반대쪽은 비어 있고, 무언가를 기다린다.',
    opts:[
      { n:'피를 올린다', t:'현재 체력의 절반. 다음 층 전리품 두 배.',
        run: api => { api.hurt(Math.ceil(api.p.hp / 2), '저울'); api.nextFloor({ item: 2 }); api.say('접시가 기울고, 아래쪽에서 무언가 쏟아지는 소리가 났다.', 'level'); } },
      { n:'금화를 올린다', t:'가진 금화의 절반. 다음 층 정예가 줄어든다.',
        need: api => api.p.gold >= 60,
        run: api => { api.p.gold = Math.floor(api.p.gold / 2); api.nextFloor({ elite: 0.35 }); api.say('저울이 잠잠해졌다.', 'good'); } },
      { n:'지나친다', t:'', run: api => api.say('저울을 지나쳤다.') },
    ],
  },
  {
    id:'clockwork', n:'깨진 시계', w:8,
    t:'추가 멈춘 큰 시계. 태엽 구멍에 손가락이 들어간다. 돌리면 뭔가가 되감길 것 같다.',
    opts:[
      { n:'이 층을 되감는다', t:'이 층의 시계가 처음으로 돌아간다.',
        run: api => { api.resetClock(); api.say('발밑의 소리가 잦아들었다. 시간이 되감겼다.', 'level'); } },
      { n:'다음 층을 늦춘다', t:'다음 층 시계가 30% 길어진다.',
        run: api => { api.nextFloor({ clock: 1.3 }); api.say('태엽이 반대로 감겼다.', 'good'); } },
      { n:'부순다', t:'재료가 쏟아진다. 이 층이 15턴 빨라진다.',
        run: api => { api.mats({ scrap: 4 + api.rnd(4), dust: 2 }); api.spendClock(15); api.say('유리와 톱니가 쏟아졌다.', 'warn'); } },
    ],
  },
  /* ── 불에 관한 사건들 ────────────────────────────────────
     빛은 이 게임에서 유일하게 공간을 바꾸는 자원이라, 기름을 건 선택은
     체력을 건 선택과 다른 결을 낸다. 지금 당장의 안전을 팔아 나중의
     시야를 사거나, 그 반대이거나. */
  {
    id:'seep', n:'스며 나오는 기름', w:9,
    t:'벽 틈으로 검은 기름이 배어 나와 바닥에 고여 있다. 냄새가 독하다. 불을 가까이 대면 어떻게 될지는 알 만하다.',
    opts:[
      { n:'심지에 적신다', t:'기름 +420.',
        run: api => { api.oil(420); api.say('심지가 검게 젖었다. 한동안은 밝겠다.', 'good'); } },
      { n:'웅덩이에 불을 붙인다', t:'경험치. 이 층이 깨어난다.',
        run: api => { api.xp(40 + api.depth * 26); api.wakeHalf();
          api.say('불길이 벽을 타고 올랐다. 이 층의 모든 것이 그 소리를 들었다.', 'hit'); } },
      { n:'지나친다', t:'', run: api => api.say('기름을 밟지 않게 돌아서 지났다.') },
    ],
  },
  {
    id:'wickseller', n:'심지를 파는 자', w:7,
    t:'거죽을 뒤집어쓴 것이 벽에 기대 앉아 있다. 무릎 위에 심지 뭉치가 있고, 그것은 돈을 원하지 않는다.',
    opts:[
      { n:'피를 준다', t:'최대 체력 −4. 기름 +600.',
        run: api => { api.p.maxhp = Math.max(8, api.p.maxhp - 4);
          api.p.hp = Math.min(api.p.hp, api.p.maxhp); api.oil(600);
          api.say('손목을 그었다. 심지가 붉게 젖더니 잘 탄다.', 'warn'); } },
      { n:'기억을 준다', t:'경험치를 잃고 기름 +900.',
        run: api => { api.xp(-(20 + api.depth * 18)); api.oil(900);
          api.say('무엇을 주었는지도 잊었다. 대신 통이 가득하다.', 'warn'); } },
      { n:'거절한다', t:'', run: api => api.say('그것은 고개를 돌렸다.') },
    ],
  },
  {
    id:'blackroom', n:'불이 닿지 않는 방', w:8,
    t:'문 너머가 검다. 횃불을 들이밀어도 빛이 한 뼘에서 잘려 나간다. 안쪽에서 쇠붙이가 서로 부딪는 소리가 난다.',
    opts:[
      { n:'불을 끄고 들어간다', t:'기름을 전부 쓴다. 유물 하나.',
        run: api => { api.p.lightTurns = 0; api.relic();
          api.say('어둠은 어둠을 알아본다. 손에 무언가가 잡혔다.', 'level'); } },
      { n:'문틈으로 손만 넣는다', t:'금화. 다칠 수 있다.',
        run: api => { api.gold(60 + api.depth * 30);
          if (Math.random() < 0.5) { api.hurt(6 + api.depth * 2); api.say('무언가가 손등을 물었다.', 'hit'); }
          else api.say('손끝에 걸린 것을 끌어냈다.', 'good'); } },
      { n:'문을 닫는다', t:'', run: api => api.say('문을 닫고 빗장을 걸었다.') },
    ],
  },
  {
    id:'eggs', n:'거미의 알집', w:8,
    t:'천장에 매달린 회색 주머니. 안에서 무언가 꿈틀거린다. 아래 바닥에 마른 정수가 붙어 있다.',
    opts:[
      { n:'태운다', t:'경험치. 기름을 200 쓴다.',
        run: api => { api.p.lightTurns = Math.max(0, api.p.lightTurns - 200); api.xp(30 + api.depth * 22); api.say('주머니가 타면서 안의 것들이 조용해졌다.', 'level'); } },
      { n:'조심히 긁어낸다', t:'정수 2. 거미 하나가 깬다.',
        run: api => { api.mats({ essence: 2 }); api.spawn('spider', 1); api.say('정수를 챙기는 사이 하나가 내려왔다.', 'warn'); } },
      { n:'건드리지 않는다', t:'', run: api => api.say('알집을 지나쳤다.') },
    ],
  },
  {
    id:'miner', n:'취한 광부', w:8,
    t:'벽에 기대 앉아 술병을 든 사내. "아래층? 아, 알지. 내가 다 봤어."',
    opts:[
      { n:'금화 110을 준다', t:'다음 층 지도를 전부 안다.',
        need: api => api.p.gold >= 110,
        run: api => { api.p.gold -= 110; api.nextFloor({ mapped: true }); api.say('사내가 바닥에 그림을 그렸다.', 'good'); } },
      { n:'술을 나눠 마신다', t:'체력을 조금 회복한다. 취해서 20턴을 흘린다.',
        run: api => { api.heal(pct(api, 0.18)); api.spendClock(20);
                      api.say('독한 술이었다. 정신을 차리니 한참 지나 있었다.', 'good'); } },
      { n:'털어버린다', t:'금화를 빼앗는다. 상인들이 알게 된다.',
        run: api => { const g = 90 + api.rnd(140); api.p.gold += api.gold(g); api.infamy(0.35); api.say(`${g}닢을 빼앗았다. 소문이 빠를 것이다.`, 'warn'); } },
    ],
  },
  {
    id:'tree', n:'석화된 나무', w:8,
    t:'돌이 된 나무. 결을 따라 손을 대면 손바닥이 굳는 느낌이 든다.',
    opts:[
      { n:'몸에 문지른다', t:'방어 +2 영구. 은신 −6%p 영구.',
        run: api => { api.perm('ac', 2); api.perm('stealth', -0.06); api.say('살갗이 돌처럼 단단해졌다. 그만큼 무겁다.', 'level'); } },
      { n:'날에 문지른다', t:'피해 +3 영구. 최대 체력 −6.',
        run: api => { api.perm('dmg', 3); api.permHp(-6); api.say('날에 돌가루가 박혔다. 손목이 저리다.', 'level'); } },
      { n:'열매를 깬다', t:'물약 두 개. 뭔지는 모른다.',
        run: api => { api.givePotion(2); api.say('돌 열매 안에서 액체가 흘러나왔다.', 'good'); } },
    ],
  },
  {
    id:'crate', n:'봉인된 나무 상자', w:7,
    t:'못이 촘촘히 박힌 상자. 흔들면 유리가 부딪치는 소리가 난다.',
    opts:[
      { n:'열어 본다', t:'물약 셋. 그중 하나는 나쁜 것이다.',
        run: api => { api.givePotion(3, true); api.say('세 병이 굴러 나왔다.', 'good'); } },
      { n:'상인에게 팔 셈으로 챙긴다', t:'금화. 무거워서 이 층 시계가 25턴 줄어든다.',
        run: api => { const g = 120 + api.rnd(120); api.p.gold += api.gold(g); api.spendClock(25);
                      api.say(`무겁지만 값은 됐다. ${g}닢.`, 'good'); } },
    ],
  },

  /* ── gated: the game reacting to what you carry ─────────── */
  {
    id:'bloodpool', n:'식지 않은 피 웅덩이', w:12,
    when: api => api.hasAffix('lifesteal'),
    t:'바닥의 피가 아직 따뜻하다. 당신 무기가 손안에서 미세하게 떨린다 — 이런 반응은 처음이다.',
    opts:[
      { n:'무기를 담근다', t:'흡혈 +6%p, 영구. 최대 체력 −6.',
        run: api => { api.perm('lifesteal', 0.06); api.permHp(-6); api.say('날이 피를 빨아들였다.', 'level'); } },
      { n:'직접 마신다', t:'최대 체력 +10. 중독.',
        run: api => { api.permHp(10); api.afflict('poison', 26); api.say('비린 것을 삼켰다. 몸이 커지는 느낌과 함께 속이 뒤집힌다.', 'warn'); } },
      { n:'지나친다', t:'', run: api => api.say('피를 밟지 않고 돌아갔다.') },
    ],
  },
  {
    id:'mirrorroom', n:'마주 선 거울', w:12,
    when: api => api.hasRelic('mirror'),
    t:'방 양쪽에 거울이 마주 서 있다. 당신 방패의 거울이 그 사이에서 끝없이 겹친다.',
    opts:[
      { n:'겹친 상을 받아들인다', t:'반사 +15%p. 받는 피해 +10%.',
        run: api => { api.tune('mirror', 0.15); api.perm('takeMore', 0.10); api.say('방패가 무언가를 하나 더 배웠다.', 'level'); } },
      { n:'거울을 깬다', t:'재료가 쏟아지고, 유리에 베인다.',
        run: api => { api.mats({ dust: 4 + api.rnd(4), essence: 1 }); api.hurt(pct(api, 0.12), '유리'); } },
    ],
  },
  {
    id:'emberjar', n:'식은 화로', w:12,
    when: api => api.hasRelic('ember'),
    t:'꺼진 화로. 당신 항아리 속 불씨가 여기서 갑자기 밝아진다.',
    opts:[
      { n:'불씨를 나눈다', t:'다음 세 층에 모닥불이 반드시 있다. 항아리의 여벌은 사라진다.',
        run: api => { api.grantCamps(3); api.dropRelic('ember'); api.say('불씨가 아래로 흘러 내려갔다.', 'level'); } },
      { n:'화로를 되살린다', t:'지금 모닥불 한 번을 쓴다.',
        run: api => { api.openCamp(); } },
    ],
  },
  {
    id:'thiefmark', n:'도둑의 표식', w:12,
    when: api => api.hasRelic('glove'),
    t:'문틀에 그어진 세 줄. 당신 장갑의 실밥과 같은 매듭이다. 같은 손에서 나온 표식.',
    opts:[
      { n:'표식을 따라간다', t:'이 층 상자 전부의 위치를 알고, 내용이 한 번 더 늘어난다.',
        run: api => { api.revealChests(true); api.say('벽마다 표식이 이어져 있었다.', 'level'); } },
      { n:'표식을 지운다', t:'금화. 다음 층 상자가 두 배.',
        run: api => { api.p.gold += api.gold(150 + api.rnd(150)); api.nextFloor({ chests: 2 }); api.say('지운 자리에 당신 매듭을 남겼다.', 'good'); } },
    ],
  },
  {
    id:'dojo', n:'먼지 앉은 훈련장', w:12,
    when: api => (api.G.bestCombo || 0) >= 8,
    t:'짚 인형과 발자국이 남은 바닥. 당신 발이 그 자리에 정확히 들어맞는다.',
    opts:[
      { n:'끝까지 따라 한다', t:'연격 배수가 링크마다 +1.2%p, 영구. 지금 체력의 20%.',
        run: api => { api.hurt(Math.ceil(api.p.hp * 0.2), '훈련'); api.perm('comboStep', 0.012); api.say('손이 기억했다.', 'level'); } },
      { n:'요령만 본다', t:'연격이 끊기는 시간이 6턴 길어진다, 영구.',
        run: api => { api.perm('comboHold', 6); api.say('숨을 고르는 법을 봤다.', 'level'); } },
      { n:'지나친다', t:'', run: api => api.say('훈련장을 지나쳤다.') },
    ],
  },
  {
    id:'library', n:'무너진 서고', w:12,
    when: api => api.canCast(),
    t:'물에 불은 책들. 대부분 읽을 수 없지만, 한 권은 당신이 아는 문법으로 쓰여 있다.',
    opts:[
      { n:'읽는다', t:'주문 하나가 +1 연마된다. 이 층 시계가 30턴 줄어든다.',
        run: api => { api.honeSpell(); api.spendClock(30); } },
      { n:'찢어 태운다', t:'최대 마나 +5 영구. 최대 체력 −8.',
        run: api => { api.perm('manaFlat', 5); api.permHp(-8); api.say('연기를 들이마셨다. 머리가 넓어지고 몸이 준다.', 'level'); } },
      { n:'가루를 챙긴다', t:'마력 가루 6.',
        run: api => { api.mats({ dust: 6 }); api.say('젖은 종이에서 가루를 긁어냈다.', 'good'); } },
    ],
  },
  {
    id:'shrine', n:'잊힌 사당', w:12,
    when: api => (api.p.relics || []).length >= 2,
    t:'빈 좌대 셋. 하나에는 먼지가 없다 — 최근까지 무언가 놓여 있었다.',
    opts:[
      { n:'유물 하나를 바친다', t:'다른 유물 두 개 중에서 고른다.',
        run: api => { api.tradeRelic(); } },
      { n:'좌대를 비운 채 절한다', t:'체력 전부 회복. 이 층 시계가 40턴 줄어든다.',
        run: api => { api.heal(api.p.maxhp); api.spendClock(40); api.say('빈 좌대가 당신을 돌려보냈다.', 'good'); } },
    ],
  },
  {
    id:'ledger', n:'상인의 장부', w:11,
    when: api => api.p.gold >= 300,
    t:'펼쳐진 장부에 당신 이름 비슷한 것이 적혀 있다. 옆에 숫자가 하나.',
    opts:[
      { n:'값을 치른다', t:'금화 300. 남은 판 동안 상점 가격 −25%.',
        run: api => { api.p.gold -= 300; api.perm('haggle', 0.25); api.say('장부에 줄이 그어졌다.', 'level'); } },
      { n:'장부를 찢는다', t:'상점 가격 +40%. 재료가 쏟아진다.',
        run: api => { api.infamy(0.4); api.mats({ scrap: 6, dust: 4, essence: 1 }); api.say('찢은 종이 사이에서 담보물이 떨어졌다.', 'warn'); } },
      { n:'덮어 둔다', t:'', run: api => api.say('장부를 덮었다.') },
    ],
  },
  {
    id:'furnace', n:'식은 대장간', w:11,
    when: api => api.has({ scrap: 10 }),
    t:'모루와 물통이 그대로 남은 대장간. 화덕만 식었다.',
    opts:[
      { n:'무기를 다시 벼린다', t:'쇳조각 10. 무기에 접두·접미를 새로 굴린다.',
        need: api => api.has({ scrap: 10 }),
        run: api => { api.pay({ scrap: 10 }); api.reroll(); } },
      { n:'갑옷을 두껍게 한다', t:'쇳조각 10. 갑옷 +1, 은신 −5%p 영구.',
        need: api => api.has({ scrap: 10 }),
        run: api => { api.pay({ scrap: 10 }); api.forge(1, 'body'); api.perm('stealth', -0.05); } },
      { n:'지나친다', t:'', run: api => api.say('식은 화덕을 지나쳤다.') },
    ],
  },
  {
    id:'chorus', n:'울리는 방', w:11,
    when: api => api.hasAffix('chain') || api.hasAffix('burst'),
    t:'소리가 여러 번 겹쳐 돌아오는 방. 당신 무기가 휘둘리기 전에 이미 울린다.',
    opts:[
      { n:'울림에 맞춰 휘두른다', t:'연쇄 확률 +12%p, 영구. 명중 −5%.',
        run: api => { api.perm('chain', 0.12); api.perm('hitPctMul', 0.95); api.say('한 번이 두 번으로 들린다.', 'level'); } },
      { n:'벽을 두드려 본다', t:'이 층 몬스터 절반이 깬다. 경험치를 크게 얻는다.',
        run: api => { const n = api.wakeHalf(); api.xp(40 + api.depth * 26); api.say(`${n}마리가 눈을 떴다.`, 'hit'); } },
    ],
  },

  /* ── the wagers ─────────────────────────────────────────
     The altar stakes an item; these stake the floor.

     Everything above resolves: you pay a price and you get the
     thing. That is a decision, but it is not a gamble, and the
     ? room is exactly where a gamble belongs — it is the only
     screen where the game will happily hand you a run-defining
     object for free.

     An option with `odds` declares its chance on the button and
     splits into `run` (won) and `fail` (lost). game.js does the
     rolling, so the printed number is provably the rolled number
     — an option that rolls its own chance can drift from its own
     label, and odds you cannot trust are just a surprise. `risk`
     is the losing cost, printed in red under the offer, because
     the surprise is meant to be which way it went and never what
     the downside was.

     The losing branch mostly calls `surround`, which puts bodies
     on the rings around you rather than scattering them across
     the floor. There is no corridor to back into and no door to
     shut: the wager is not health or gold, it is your position,
     and position is the thing this game is actually about. */
  {
    id:'ashring', n:'재로 그린 원', w:11,
    t:'누군가 바닥에 재로 원을 그렸다. 안쪽은 아직 따뜻하고, 바깥쪽 재는 오래 전에 식었다. ' +
      '이런 것을 그리는 데에는 이유가 있고, 대개 두 가지 중 하나다.',
    opts:[
      { n:'원 안에 선다', odds:0.55, risk:'원 둘레에서 셋이 일어선다',
        t:'좌대 위의 것이 남아 있다면 가져간다.',
        run: api => { api.relic(); api.say('재가 한 번 밝아지고, 원 안에 무언가가 남았다.', 'level'); },
        fail: api => { api.surround(3); api.say('원은 좌대가 아니라 덫이었다.', 'hit'); } },
      { n:'바깥의 식은 재만 쓸어담는다', t:'안전하다. 가루와 정수를 조금.',
        run: api => api.mats({ dust: 3 + api.rnd(4), essence: api.chance(0.35) ? 1 : 0 }) },
      { n:'지나친다', t:'', run: api => api.say('원을 크게 돌아 걸었다.') },
    ],
  },
  {
    id:'deepstair', n:'끊어진 계단', w:10, when: api => api.depth >= 3,
    t:'아래로 이어지던 계단이 중간에서 끊겨 있다. 끊긴 자리 너머로 다음 층이 보인다. ' +
      '뛰면 닿는다. 닿지 않으면 그 사이 어딘가로 떨어진다.',
    opts:[
      { n:'뛴다', odds:0.6, risk:'추락 피해와, 떨어진 자리를 둘러싼 셋',
        t:'다음 층에 물건이 크게 늘어난 채로 도착한다.',
        run: api => { api.nextFloor({ item: 2, mapped: true });
                      api.say('건너뛰었다. 아래쪽이 훤히 보인다.', 'level'); },
        fail: api => { api.hurt(pct(api, 0.22), '끊어진 계단'); api.surround(3); } },
      { n:'밧줄을 걸어 천천히 내려간다', t:'안전하지만 오래 걸린다. 시간 25.',
        run: api => { api.spendClock(25); api.mats({ scrap: 4 + api.rnd(4) });
                      api.say('한참 걸렸다. 내려오는 길에 쓸 만한 것을 주웠다.') } },
      { n:'돌아선다', t:'', run: api => api.say('끊긴 자리에서 돌아섰다.') },
    ],
  },
  {
    id:'gamblerbones', n:'도박꾼의 뼈', w:10, when: api => api.p.gold >= 120,
    t:'마른 손 하나가 주사위 두 개를 쥔 채 굳어 있다. 손가락을 펴면 아직 굴릴 수 있다. ' +
      '판돈은 손 옆의 무더기가 정한다.',
    opts:[
      { n:'한 번 굴린다', odds:0.5, risk:'건 만큼 사라지고, 소문이 돈다',
        t:'가진 금화의 절반을 건다. 이기면 두 배로 돌려받는다.',
        run: api => { const bet = Math.floor(api.p.gold / 2); api.p.gold += bet;
                      api.say(`${bet}닢이 두 배가 되어 돌아왔다.`, 'level'); },
        fail: api => { const bet = Math.floor(api.p.gold / 2); api.p.gold -= bet;
                       api.infamy(0.2); api.say(`${bet}닢을 잃었다.`, 'hit'); } },
      { n:'세 번 연달아 굴린다', odds:0.14, risk:'전 재산과, 소리를 듣고 온 넷',
        t:'가진 금화 전부를 건다. 이기면 다섯 배, 그리고 유물 하나.',
        run: api => { const bet = api.p.gold; api.p.gold += bet * 4; api.relic();
                      api.say(`${bet}닢이 다섯 배가 되었다. 손이 무언가를 내밀었다.`, 'level'); },
        fail: api => { api.p.gold = 0; api.infamy(0.5); api.surround(4);
                       api.say('주사위 구르는 소리가 너무 컸다.', 'hit'); } },
      { n:'손가락을 도로 접어준다', t:'', run: api => api.say('손을 원래대로 두고 물러났다.') },
    ],
  },
  {
    id:'hungrydoor', n:'배고픈 문', w:10, when: api => api.depth >= 6,
    t:'문 하나가 벽에 박혀 있다. 경첩도 손잡이도 없고, 가운데가 사람 입처럼 조금 벌어져 있다. ' +
      '안쪽에서 더운 바람이 규칙적으로 나온다. 숨 쉬는 간격이다.',
    opts:[
      { n:'벌어진 틈에 손을 넣는다', odds:0.4, risk:'문에서 쏟아지는 넷',
        t:'이 층보다 네 층 깊은 물건이 나온다. 접두와 접미가 붙은 채로.',
        run: api => { api.gear(4); api.gear(4); api.say('안쪽에서 두 개가 잡혔다.', 'level'); },
        fail: api => { api.hurt(pct(api, 0.18), '배고픈 문'); api.surround(4);
                       api.say('문이 다물렸다. 그리고 뒤에서 열렸다.', 'hit'); } },
      { n:'문을 못질한다', t:'못 대신 쇳조각 8. 다음 층이 조용해진다.',
        need: api => api.has({ scrap: 8 }),
        run: api => { api.pay({ scrap: 8 }); api.nextFloor({ clock: 1.6, elite: 0.4 });
                      api.say('숨소리가 멎었다.', 'good'); } },
      { n:'지나친다', t:'', run: api => api.say('숨소리를 등지고 걸었다.') },
    ],
  },
  {
    id:'ashenpact', n:'재 속의 약속', w:9, when: api => api.depth >= 9,
    t:'벽에 손자국이 하나 찍혀 있다. 재가 아니라 안쪽에서 눌러 만든 자국이다. ' +
      '크기가 딱 당신 손만 하다.',
    opts:[
      { n:'손을 맞춰 댄다', odds:0.35, risk:'벽에서 나온 넷과, 이 층 절반이 깬다',
        t:'최대 체력이 영구히 크게 오르고, 무기가 두 단계 벼려진다.',
        run: api => { api.permHp(22); api.forge(2, 'weapon');
                      api.say('벽이 따뜻해졌다. 손목까지 따라 올라온다.', 'level'); },
        fail: api => { api.surround(4); api.wakeHalf();
                       api.say('맞춰 댄 손을 벽이 놓아주지 않았다.', 'hit'); } },
      { n:'자국을 재로 덮는다', t:'안전하다. 이 층의 상자 위치가 드러난다.',
        run: api => { api.revealChests(false); api.say('자국이 덮였다. 대신 방들의 윤곽이 보였다.', 'good'); } },
    ],
  },
];

/* Both doors are the same coin flip. Printing "반은 유물" and then
   quietly rigging left-vs-right would be a lie the player can
   only catch by save-scumming — which this game does not allow. */
function twinDoor(api) {
  if (api.chance(0.5)) { api.relic(); api.say('문 뒤에는 좌대가 하나 있었다.', 'level'); }
  else { api.spawnElite(2); api.say('문 뒤에서 두 쌍의 눈이 돌아봤다.', 'hit'); }
}
