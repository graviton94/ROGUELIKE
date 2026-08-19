/* ═══════════════════════════════════════════════════════════
   events.js — the ? room (깊은 곳의 사건들).

   Slay the Spire의 `?` 노드는 가장 저렴하면서도 가장 뛰어난 서사 도구다:
   한 화면의 담담한 문장, 두세 개의 선택지, 그리고 당신이 고른 대가.
   새로운 아트나 시스템 없이도 매 판의 고유한 이야기가 여기서 나온다.

   DESIGN.md §1 & §2 원칙:
   - 사건은 5대 층대 사다리(거짓말의 진행) 위에 놓인다.
   - 1~3층: 성채의 잔해와 앞선 자들의 유해
   - 4~6층: 파낸 자국, 버려진 장비, 굳어버린 선발대
   - 7~9층: 신앙에 먹힌 자들, 왜곡된 제단, 침식된 경전
   - 10~12층: 신의 것들, 잿불, 배고픈 문, 타오르는 부호
   - 13~15층: 화로의 전대 용사들

   모든 선택지는 resolve되어야 하며, wagers는 odds·fail·risk가 함께 온다.
   ═══════════════════════════════════════════════════════════ */

const pct = (api, f) => Math.max(1, Math.round(api.p.maxhp * f));

export const EVENTS = [
  /* ── 1~3층: 앞서 내려간 자들의 흔적 ──────────────────────── */
  {
    id:'thelast', n:'앞서 간 자', w:9,
    t:'벽에 기대 앉은 채로 말라 있다. 무릎 위에 배낭이 그대로 있고, 손은 아직 그것을 쥐고 있다. 목에 걸린 패에 번호가 찍혀 있다 — 당신 것보다 앞선 번호다.',
    opts:[
      { n:'배낭을 연다', t:'그가 여기까지 들고 온 것을 가져간다.',
        run: api => {
          api.mats({ scrap: 4 + api.rnd(6), dust: 2 + api.rnd(3) });
          api.gold(40 + api.rnd(60));
          api.say('쓸 만한 것이 남아 있었다. 그는 여기까지 잘 왔다.', 'good');
        } },
      { n:'손에 쥔 것을 편다', t:'끝까지 놓지 않은 것이다. 굳은 손가락을 펴야 한다.',
        odds:0.62, risk:'뼈가 부러지는 소리에 층이 깨어난다',
        run: api => { api.item(6); api.say('그가 마지막까지 쥐고 있던 것이다.', 'level'); },
        fail: api => { api.rouse(11); api.say('마른 뼈가 부러졌다. 그 소리가 멀리 갔다.', 'bad'); } },
      { n:'패를 떼어 묻어 준다', t:'가져갈 것은 없다. 대신 다음이 덜 무섭다.',
        run: api => { api.heal(pct(api, 0.10)); api.say('번호를 주머니에 넣었다. 위로 가져갈 사람이 있을지도 모른다.', 'good'); } },
    ],
  },
  {
    id:'scratch', n:'벽에 긁어 놓은 것', w:8,
    t:'돌에 손톱으로 판 글씨다. 이름 여섯과, 그 아래 한 줄. 「여기서부터는 불을 끄지 마라.」 마지막 이름 옆에는 손톱자국만 남아 있다.',
    opts:[
      { n:'읽고 새긴다', t:'앞 사람들이 알아낸 것을 믿는다.',
        run: api => { api.oil(260); api.say('기름통을 다시 채웠다. 그들이 옳았기를.', 'good'); } },
      { n:'내 이름도 새긴다', t:'다음 사람이 여기까지 왔다는 것을 알게 된다.',
        run: api => {
          api.xp(30 + api.depth * 10);
          api.say('일곱 번째 이름을 팠다. 손톱이 갈라졌지만 팔 만했다.', 'level');
        } },
      { n:'지나친다', t:'읽을 시간이 없다.', run: api => api.say('글씨를 등지고 걸었다.') },
    ],
  },
  {
    id:'well', n:'핏물이 괸 웅덩이', w:10, when: api => api.depth <= 7,
    t:'바닥이 꺼진 자리에 검붉은 물이 고여 있다. 바닥에서 쇠붙이가 부딪히는 소리가 난다. 손을 넣으면 닿을 듯하다.',
    opts:[
      { n:'손을 집어넣는다', t:'재료를 건진다. 웅덩이 속 무언가에 물릴 수 있다.',
        run: api => {
          if (api.chance(0.5)) { api.mats({ scrap: 3 + api.rnd(4), dust: 1 + api.rnd(2) }); api.say('가라앉아 있던 쇳조각과 뼛가루를 건졌다.', 'good'); }
          else { api.hurt(pct(api, 0.14), '웅덩이 속 무언가'); api.afflict('poison', 18); api.say('물속의 무언가가 손목을 물어뜯었다.', 'hit'); }
        } },
      { n:'돌을 던져 본다', t:'깊이를 잰다. 파문이 크게 인다.',
        run: api => { api.rouse(9); api.say('돌이 닿는 소리가 울렸다. 그리고 무언가 기어 나오는 소리도.', 'warn'); } },
      { n:'지나친다', t:'아무 일도 없다.', run: api => api.say('웅덩이를 피해 지나쳤다.') },
    ],
  },
  {
    id:'grave', n:'전대 용사의 석관', w:10, when: api => api.depth >= 3,
    t:'부서진 석관. 뚜껑에 성채의 문장이 파여 있고, 안쪽에서 차가운 공기가 배어 나온다.',
    opts:[
      { n:'뚜껑을 밀어낸다', t:'장비 하나. 잠들어 있던 것이 일어선다.',
        run: api => { api.gear(4); api.spawn('mummy', 1); api.say('관 안의 유해가 눈을 떴다.', 'hit'); } },
      { n:'손을 얹고 기도한다', t:'체력을 전부 회복한다. 다음 층 전리품 −50%, 정예 +50%.',
        run: api => { api.heal(api.p.maxhp); api.nextFloor({ item: 0.5, elite: 1.5 });
                      api.say('숨이 트인다. 앞선 자의 고통을 나누어 짊어진 느낌이다.', 'good'); } },
      { n:'지나친다', t:'', run: api => api.say('석관을 건드리지 않고 지나쳤다.') },
    ],
  },
  {
    id:'machine', n:'버려진 톱니 모루', w:9, when: api => api.depth >= 2 && api.depth <= 8,
    t:'다듬은 돌 사이에 박힌 톱니와 모루. 갱도를 파던 자들이 남겨둔 장치다. 투입구에 쇳조각이 끼어 있다.',
    opts:[
      { n:'쇳조각 6개를 넣는다', t:'착용 중인 물건 하나가 +1.',
        need: api => api.has({ scrap: 6 }),
        run: api => { api.pay({ scrap: 6 }); api.forge(1); } },
      { n:'쇳조각 14개를 넣는다', t:'착용 중인 물건 하나가 +2.',
        need: api => api.has({ scrap: 14 }),
        run: api => { api.pay({ scrap: 14 }); api.forge(2); } },
      { n:'톱니를 뜯어낸다', t:'재료를 얻지만 손이 찧인다.',
        run: api => { api.mats({ scrap: 2 + api.rnd(3), essence: api.chance(0.3) ? 1 : 0 });
                      api.hurt(Math.max(2, Math.round(api.p.maxhp * 0.08)), '톱니'); } },
    ],
  },
  {
    id:'twin', n:'뒤틀린 두 개의 문', w:9,
    t:'벽에 똑같이 생긴 두 개의 석문이 박혀 있다. 표시도 손잡이도 없다. 하나는 두고 간 유물을, 하나는 눈을 뜬 것을 품고 있다.',
    opts:[
      { n:'왼쪽 문을 연다', t:'반은 유물, 반은 정예 둘.', run: api => twinDoor(api) },
      { n:'오른쪽 문을 연다', t:'반은 유물, 반은 정예 둘.', run: api => twinDoor(api) },
      { n:'둘 다 두고 간다', t:'', run: api => api.say('두 문을 등지고 걸었다.') },
    ],
  },
  {
    id:'candles', n:'갈라진 촛대', w:9,
    t:'가지가 둘로 찢긴 촛대. 한쪽은 굵은 불꽃으로 밝게, 한쪽은 검은 기름을 흘리며 낮게 탄다.',
    opts:[
      { n:'굵은 심지를 켠다', t:'불빛 반경 +2 영구. 기름을 300 태운다.',
        run: api => { api.perm('lightR', 2); api.burnOil(300); api.say('등불의 원이 넓어졌다.', 'level'); } },
      { n:'가는 심지를 켠다', t:'은신 +15%p 영구. 불빛 반경 −1 영구.',
        run: api => { api.perm('stealth', 0.15); api.perm('lightR', -1); api.say('발소리가 지워졌다. 대신 어둠이 짙다.', 'level'); } },
      { n:'양쪽 다 끈다', t:'마른 가루를 챙긴다.',
        run: api => api.mats({ dust: 3 + api.rnd(3) }) },
    ],
  },
  {
    id:'scholar', n:'눈을 잃은 기록자', w:9, when: api => api.depth <= 9,
    t:'눈을 천으로 동여맨 자가 벽에 기대어 가죽 책을 만지고 있다. "이름을 알고 싶으십니까. 공짜로는 읽어 드리지 않습니다."',
    opts:[
      { n:'금화 140을 낸다', t:'가진 미확인 물건이 전부 판별된다.',
        need: api => api.p.gold >= 140,
        run: api => { api.p.gold -= 140; const n = api.identifyAll(); api.say(n ? `${n}가지의 이름을 알았다.` : '판별할 것이 없었다.', 'good'); } },
      { n:'피를 내어 준다', t:'최대 체력의 15%. 같은 값을 한다.',
        run: api => { api.hurt(pct(api, 0.15), '기록자의 침'); const n = api.identifyAll(); api.say(n ? `${n}가지의 이름을 알았다.` : '판별할 것이 없었다.', 'good'); } },
      { n:'지나친다', t:'', run: api => api.say('기록자가 다시 손가락으로 글자를 더듬는다.') },
    ],
  },
  {
    id:'scales', n:'피 묻은 저울', w:8, when: api => api.depth >= 4,
    t:'한쪽 접시에 마른 피가 눌어붙은 저울. 반대쪽 접시는 허공을 향해 들려 있다. 무언가를 바쳐야 기울어진다.',
    opts:[
      { n:'피를 쏟는다', t:'현재 체력의 절반. 다음 층 전리품 두 배.',
        run: api => { api.hurt(Math.ceil(api.p.hp / 2), '저울'); api.nextFloor({ item: 2 }); api.say('접시가 바닥에 닿았다. 아래쪽에서 무언가 쏟아지는 소리가 났다.', 'level'); } },
      { n:'금화를 올린다', t:'가진 금화의 절반. 다음 층 정예가 줄어든다.',
        need: api => api.p.gold >= 60,
        run: api => { api.p.gold = Math.floor(api.p.gold / 2); api.nextFloor({ elite: 0.35 }); api.say('쇠붙이가 내려앉으며 저울이 멈췄다.', 'good'); } },
      { n:'지나친다', t:'', run: api => api.say('저울을 건드리지 않고 지나쳤다.') },
    ],
  },
  {
    id:'clockwork', n:'멈춘 잿불의 추', w:8, when: api => api.depth >= 3,
    t:'돌벽에 매달린 커다란 태엽 추. 바늘이 꺾여 있고, 구멍 사이에 손가락이 들어간다. 돌리면 굴의 박자가 되감길 것 같다.',
    opts:[
      { n:'이 층의 시간을 되감는다', t:'이 층의 시계가 처음으로 돌아간다.',
        run: api => { api.resetClock(); api.say('발밑의 울림이 잦아들었다. 시간이 되감겼다.', 'level'); } },
      { n:'다음 층의 시간을 늦춘다', t:'다음 층 시계가 30% 길어진다.',
        run: api => { api.nextFloor({ clock: 1.3 }); api.say('태엽이 반대로 삐걱이며 감겼다.', 'good'); } },
      { n:'부수어 부품을 챙긴다', t:'재료가 쏟아진다. 이 층이 15턴 빨라진다.',
        run: api => { api.mats({ scrap: 4 + api.rnd(4), dust: 2 }); api.spendClock(15); api.say('유리와 톱니가 바닥에 튀었다.', 'warn'); } },
    ],
  },
  {
    id:'seep', n:'스며 나오는 기름', w:9, when: api => api.depth <= 9,
    t:'벽 틈으로 검은 기름이 배어 나와 바닥에 고여 있다. 냄새가 비릿하다. 불을 가까이 대면 층 전체가 타오를 것이다.',
    opts:[
      { n:'심지에 적신다', t:'기름 +420.',
        run: api => { api.oil(420); api.say('심지가 검게 젖었다. 한동안은 밝겠다.', 'good'); } },
      { n:'웅덩이에 불을 지른다', t:'경험치. 이 층의 절반이 깨어난다.',
        run: api => { api.xp(40 + api.depth * 26); api.wakeHalf();
          api.say('불길이 벽을 타고 번졌다. 굴 안의 모든 것이 그 비명을 들었다.', 'hit'); } },
      { n:'지나친다', t:'', run: api => api.say('기름 웅덩이를 돌아서 지났다.') },
    ],
  },
  {
    id:'wickseller', n:'거죽을 쓴 자', w:7, when: api => api.depth >= 4,
    t:'가죽 거죽을 뒤집어쓴 형체가 웅크리고 있다. 무릎 위에 심지 뭉치가 있고, 눈구멍으로 이쪽을 본다. 금화에는 관심이 없다.',
    opts:[
      { n:'피를 준다', t:'최대 체력 −4. 기름 +600.',
        run: api => { api.p.maxhp = Math.max(8, api.p.maxhp - 4);
          api.p.hp = Math.min(api.p.hp, api.p.maxhp); api.oil(600);
          api.say('손목을 그었다. 심지가 붉게 물들며 활활 탔다.', 'warn'); } },
      { n:'기억을 지운다', t:'경험치를 잃고 기름 +900.',
        run: api => { api.xp(-(20 + api.depth * 18)); api.oil(900);
          api.say('무엇을 내주었는지 잊어버렸다. 대신 통이 무겁다.', 'warn'); } },
      { n:'거절한다', t:'', run: api => api.say('형체가 천천히 고개를 돌렸다.') },
    ],
  },
  {
    id:'blackroom', n:'빛을 삼키는 방', w:8, when: api => api.depth >= 4,
    t:'문 너머가 검다. 횃불을 들이밀어도 빛이 잘려 나가 어둠에 먹힌다. 안쪽에서 무언가 긁는 소리가 난다.',
    opts:[
      { n:'불을 끄고 걸어 들어간다', t:'기름을 전부 쓴다. 유물 하나.',
        run: api => { api.p.lightTurns = 0; api.relic();
          api.say('어둠이 살갗에 닿았다. 손끝에 차가운 유물이 걸렸다.', 'level'); } },
      { n:'틈새로 손만 찔러 넣는다', t:'금화. 상처를 입을 수 있다.',
        run: api => { api.gold(60 + api.depth * 30);
          if (Math.random() < 0.5) { api.hurt(6 + api.depth * 2); api.say('무언가가 손등을 깊게 물었다.', 'hit'); }
          else api.say('손에 잡힌 금화를 낚아챘다.', 'good'); } },
      { n:'문을 닫는다', t:'', run: api => api.say('문을 닫고 빗장을 질렀다.') },
    ],
  },
  {
    id:'eggs', n:'벽에 매달린 혈낭', w:8, when: api => api.depth <= 7,
    t:'벽면에 달라붙은 검붉은 주머니. 안쪽에서 핏줄이 뛰듯 꿈틀거린다. 바닥에 마른 정수가 떨어져 있다.',
    opts:[
      { n:'불로 지진다', t:'경험치. 기름을 200 태운다.',
        run: api => { api.p.lightTurns = Math.max(0, api.p.lightTurns - 200); api.xp(30 + api.depth * 22); api.say('주머니가 타들어가며 안쪽의 박동이 멎었다.', 'level'); } },
      { n:'칼로 조심스럽게 긁어낸다', t:'정수 2. 거미 하나가 떨어진다.',
        run: api => { api.mats({ essence: 2 }); api.spawn('spider', 1); api.say('정수를 챙기는 틈에 천장에서 거미가 떨어졌다.', 'warn'); } },
      { n:'건드리지 않는다', t:'', run: api => api.say('혈낭을 건드리지 않고 지나쳤다.') },
    ],
  },
  {
    id:'miner', n:'버려진 선발대원', w:8, when: api => api.depth <= 7,
    t:'벽에 기대어 탁한 액체를 들이켜는 자. "아래층? 어, 다 봤지. 먼저 내려간 놈들이 어떻게 됐는지도."',
    opts:[
      { n:'금화 110을 건넨다', t:'다음 층 지도를 전부 안다.',
        need: api => api.p.gold >= 110,
        run: api => { api.p.gold -= 110; api.nextFloor({ mapped: true }); api.say('그가 피 묻은 손가락으로 바닥에 길을 그렸다.', 'good'); } },
      { n:'독한 액체를 나눠 마신다', t:'체력을 조금 회복한다. 취기로 20턴을 잃는다.',
        run: api => { api.heal(pct(api, 0.18)); api.spendClock(20);
                      api.say('목구멍이 타는 듯했다. 정신을 차렸을 땐 시간이 꽤 지나 있었다.', 'good'); } },
      { n:'남은 짐을 빼앗는다', t:'금화를 얻지만 악명이 쌓인다.',
        run: api => { const g = 90 + api.rnd(140); api.gold(g); api.infamy(0.35); api.say(`${g}닢을 빼앗았다. 소문은 아래로 먼저 번진다.`, 'warn'); } },
    ],
  },
  {
    id:'tree', n:'석화된 살덩이 기둥', w:8, when: api => api.depth >= 5,
    t:'돌처럼 굳어버린 살덩이 기둥. 결을 따라 손을 대면 차가운 감촉이 손바닥을 타고 올라온다.',
    opts:[
      { n:'몸에 문지른다', t:'방어 +2 영구. 은신 −6%p 영구.',
        run: api => { api.perm('ac', 2); api.perm('stealth', -0.06); api.say('피부가 돌처럼 굳었다. 걸음이 무거워졌다.', 'level'); } },
      { n:'날에 문지른다', t:'피해 +3 영구. 최대 체력 −6.',
        run: api => { api.perm('dmg', 3); api.permHp(-6); api.say('칼날에 검은 광물이 박혔다. 뼈마디가 쑤신다.', 'level'); } },
      { n:'굳은 종기를 깨뜨린다', t:'추출물 둘을 얻는다.',
        run: api => { api.givePotion(2); api.say('돌 종기 속에서 점액이 흘러나왔다.', 'good'); } },
    ],
  },
  {
    id:'crate', n:'못 박힌 납 상자', w:7, when: api => api.depth <= 8,
    t:'납을 붓고 굵은 못을 박아 닫은 궤짝. 흔들면 안에서 병들이 부딪히는 소리가 난다.',
    opts:[
      { n:'억지로 뜯어낸다', t:'소모품 셋. 그중 하나는 변질된 것이다.',
        run: api => { api.givePotion(3, true); api.say('세 병이 굴러 나왔다. 하나는 빛깔이 탁하다.', 'good'); } },
      { n:'상자째 짊어진다', t:'금화. 무거워서 이 층 시계가 25턴 줄어든다.',
        run: api => { const g = 120 + api.rnd(120); api.gold(g); api.spendClock(25);
                      api.say(`무게에 짓눌리며 끌고 왔다. ${g}닢.`, 'good'); } },
    ],
  },

  /* ── 장비 및 상태에 반응하는 사건들 ────────────────────── */
  {
    id:'bloodpool', n:'식지 않은 피 웅덩이', w:12,
    when: api => api.depth >= 4 && api.hasAffix('lifesteal'),
    t:'바닥의 피가 아직 따뜻하게 김을 뿜는다. 당신 무기가 손안에서 핏줄처럼 떨린다.',
    opts:[
      { n:'무기를 담근다', t:'흡혈 +6%p 영구. 최대 체력 −6.',
        run: api => { api.perm('lifesteal', 0.06); api.permHp(-6); api.say('날이 피를 빨아들이며 검붉게 물들었다.', 'level'); } },
      { n:'직접 들이킨다', t:'최대 체력 +10. 중독.',
        run: api => { api.permHp(10); api.afflict('poison', 26); api.say('비린 것을 삼켰다. 살갗이 부풀어 오르고 속이 뒤집힌다.', 'warn'); } },
      { n:'지나친다', t:'', run: api => api.say('피 웅덩이를 밟지 않고 돌아갔다.') },
    ],
  },
  {
    id:'mirrorroom', n:'마주 선 거울', w:12,
    when: api => api.hasRelic('mirror'),
    t:'방 양쪽에 거울이 마주 서 있다. 당신 방패의 거울이 그 사이에서 끝없이 왜곡된 형상을 낳는다.',
    opts:[
      { n:'겹친 형상을 방패에 새긴다', t:'반사 +15%p. 받는 피해 +10%.',
        run: api => { api.tune('mirror', 0.15); api.perm('takeMore', 0.10); api.say('거울이 뒤틀리며 방패 속으로 빨려 들어갔다.', 'level'); } },
      { n:'거울을 박살 낸다', t:'재료가 쏟아지고 유리 파편에 베인다.',
        run: api => { api.mats({ dust: 4 + api.rnd(4), essence: 1 }); api.hurt(pct(api, 0.12), '유리'); } },
    ],
  },
  {
    id:'emberjar', n:'식은 화로', w:12,
    when: api => api.hasRelic('ember'),
    t:'꺼진 화로. 당신 항아리 속 불씨가 차가운 재를 알아보고 타오른다.',
    opts:[
      { n:'불씨를 나누어 묻는다', t:'다음 세 층에 모닥불이 반드시 있다. 항아리의 여벌은 사라진다.',
        run: api => { api.grantCamps(3); api.dropRelic('ember'); api.say('불씨가 재를 타고 아래층으로 번져 내려갔다.', 'level'); } },
      { n:'화로를 강제로 지핀다', t:'지금 모닥불 한 번을 쓴다.',
        run: api => { api.openCamp(); } },
    ],
  },
  {
    id:'thiefmark', n:'도둑의 표식', w:12,
    when: api => api.hasRelic('glove'),
    t:'문틀에 긁힌 세 줄의 자국. 당신 장갑의 꿰맨 자국과 같은 모양이다. 앞서 온 도둑이 남긴 흔적.',
    opts:[
      { n:'표식을 따라 걷는다', t:'이 층 상자 전부의 위치를 알고 내용물이 늘어난다.',
        run: api => { api.revealChests(true); api.say('벽마다 그어진 자국이 상자가 숨겨진 곳을 가리켰다.', 'level'); } },
      { n:'표식을 긁어 지운다', t:'금화. 다음 층 상자가 두 배.',
        run: api => { api.gold(150 + api.rnd(150)); api.nextFloor({ chests: 2 }); api.say('자국을 뭉개고 당신만의 매듭을 남겼다.', 'good'); } },
    ],
  },
  {
    id:'dojo', n:'피 묻은 검흔의 벽', w:12,
    when: api => (api.G.bestCombo || 0) >= 8 && api.depth >= 3,
    t:'벽마다 깊게 파인 칼자국. 앞선 전사가 베고 간 궤적이다. 당신의 발이 그 걸음에 정확히 맞아떨어진다.',
    opts:[
      { n:'궤적을 끝까지 밟는다', t:'연격 배수가 링크마다 +1.2%p 영구. 지금 체력의 20%.',
        run: api => { api.hurt(Math.ceil(api.p.hp * 0.2), '검흔'); api.perm('comboStep', 0.012); api.say('손과 어깨가 그 잔인한 궤적을 익혔다.', 'level'); } },
      { n:'숨을 고르는 법만 본다', t:'연격 유지 시간이 6턴 길어진다 영구.',
        run: api => { api.perm('comboHold', 6); api.say('검을 거두는 틈을 배웠다.', 'level'); } },
      { n:'지나친다', t:'', run: api => api.say('칼자국을 등지고 걸었다.') },
    ],
  },
  {
    id:'library', n:'타다 남은 교단의 서고', w:12,
    when: api => api.canCast() && api.depth >= 4,
    t:'반쯤 그을린 양피지 뭉치. 대부분 재가 되었지만, 한 장은 신을 저주하는 주문으로 채워져 있다.',
    opts:[
      { n:'주문을 정독한다', t:'주문 하나가 +1 연마된다. 이 층 시계가 30턴 줄어든다.',
        run: api => { api.honeSpell(); api.spendClock(30); } },
      { n:'양피지를 태워 연기를 마신다', t:'최대 마나 +5 영구. 최대 체력 −8.',
        run: api => { api.perm('manaFlat', 5); api.permHp(-8); api.say('연기를 들이마셨다. 머릿속이 찢어지듯 밝아진다.', 'level'); } },
      { n:'가루를 긁어모은다', t:'마력 가루 6.',
        run: api => { api.mats({ dust: 6 }); api.say('그을린 종이에서 가루를 모았다.', 'good'); } },
    ],
  },
  {
    id:'shrine', n:'깎여나간 신의 제단', w:12,
    when: api => (api.p.relics || []).length >= 2 && api.depth >= 4,
    t:'신상의 얼굴이 쪼개져 나간 제단. 좌대 셋 중 하나에는 유물이 놓였던 자국이 선명하다.',
    opts:[
      { n:'유물 하나를 바친다', t:'다른 유물 두 개 중에서 고른다.',
        run: api => { api.tradeRelic(); } },
      { n:'좌대를 비운 채 무릎 꿇는다', t:'체력 전부 회복. 이 층 시계가 40턴 줄어든다.',
        run: api => { api.heal(api.p.maxhp); api.spendClock(40); api.say('얼굴 없는 석상이 침묵으로 당신을 돌려보냈다.', 'good'); } },
    ],
  },
  {
    id:'ledger', n:'성채의 빚진 자 명부', w:11,
    when: api => api.p.gold >= 300,
    t:'피 묻은 가죽 장부에 당신 이름과 같은 글자가 적혀 있다. 아래로 팔려 온 대가가 숫자로 박혀 있다.',
    opts:[
      { n:'몸값을 치른다', t:'금화 300. 남은 판 동안 상점 가격 −25%.',
        run: api => { api.p.gold -= 300; api.perm('haggle', 0.25); api.say('장부에서 이름이 그어졌다.', 'level'); } },
      { n:'장부를 찢어버린다', t:'상점 가격 +40%. 담보물이 떨어진다.',
        run: api => { api.infamy(0.4); api.mats({ scrap: 6, dust: 4, essence: 1 }); api.say('찢긴 가죽 사이에서 담보로 잡혔던 것들이 떨어졌다.', 'warn'); } },
      { n:'덮어 둔다', t:'', run: api => api.say('장부를 덮고 돌아섰다.') },
    ],
  },
  {
    id:'furnace', n:'식은 대장간', w:11,
    when: api => api.has({ scrap: 10 }) && api.depth >= 3,
    t:'모루와 담금질 통이 그대로 남은 대장간. 화덕은 식었지만 쇠를 다룰 메아리는 남아 있다.',
    opts:[
      { n:'무기를 다시 벼린다', t:'쇳조각 10. 무기에 접두·접미를 새로 굴린다.',
        need: api => api.has({ scrap: 10 }),
        run: api => { api.pay({ scrap: 10 }); api.reroll(); } },
      { n:'갑옷을 덧댄다', t:'쇳조각 10. 갑옷 +1, 은신 −5%p 영구.',
        need: api => api.has({ scrap: 10 }),
        run: api => { api.pay({ scrap: 10 }); api.forge(1, 'body'); api.perm('stealth', -0.05); } },
      { n:'지나친다', t:'', run: api => api.say('대장간을 지나쳤다.') },
    ],
  },
  {
    id:'chorus', n:'비명이 울리는 방', w:11,
    when: api => (api.hasAffix('chain') || api.hasAffix('burst')) && api.depth >= 5,
    t:'소리가 벽을 타고 메아리쳐 돌아오는 방. 당신 무기가 허공을 가르기도 전에 이미 공기가 울린다.',
    opts:[
      { n:'울림에 맞춰 날을 휘두른다', t:'연쇄 확률 +12%p 영구. 명중 −5%.',
        run: api => { api.perm('chain', 0.12); api.perm('hitPctMul', 0.95); api.say('한 번의 휘두름이 두 번의 비명으로 쪼개졌다.', 'level'); } },
      { n:'벽을 쳐서 공명을 깨운다', t:'이 층 몬스터 절반이 깬다. 경험치를 크게 얻는다.',
        run: api => { const n = api.wakeHalf(); api.xp(40 + api.depth * 26); api.say(`${n}마리가 비명 소리에 눈을 떴다.`, 'hit'); } },
    ],
  },

  /* ── 7층 이하: 위험한 내기 (Wagers) ─────────────────────── */
  {
    id:'ashring', n:'재로 그린 원', w:11, when: api => api.depth >= 5,
    t:'누군가 바닥에 재로 원을 그렸다. 안쪽은 아직 따뜻하고, 바깥쪽 재는 오래전에 식었다. 신의 시선을 피하려던 흔적이다.',
    opts:[
      { n:'원 한가운데 선다', odds:0.55, risk:'원 둘레에서 셋이 솟아오른다',
        t:'좌대 위의 유물이 온전히 남아 있다면 챙긴다.',
        run: api => { api.relic(); api.say('재가 붉게 타오르며 손안에 유물이 쥐어졌다.', 'level'); },
        fail: api => { api.surround(3); api.say('원은 피난처가 아니라 미끼였다.', 'hit'); } },
      { n:'바깥의 식은 재만 쓸어 담는다', t:'안전하다. 가루와 정수를 챙긴다.',
        run: api => api.mats({ dust: 3 + api.rnd(4), essence: api.chance(0.35) ? 1 : 0 }) },
      { n:'지나친다', t:'', run: api => api.say('원을 크게 우회하여 걸었다.') },
    ],
  },
  {
    id:'deepstair', n:'끊어진 계단', w:10, when: api => api.depth >= 3,
    t:'아래로 이어지던 계단이 중간에서 뜯겨 나가 있다. 끊긴 자리 너머로 다음 층이 보인다. 뛰면 닿는다. 닿지 못하면 굴 사이로 떨어진다.',
    opts:[
      { n:'도약한다', odds:0.6, risk:'추락 피해와 함께 떨어진 자리를 둘러싼 셋',
        t:'다음 층에 물건이 크게 늘어난 채로 도착한다.',
        run: api => { api.nextFloor({ item: 2, mapped: true });
                      api.say('건너뛰었다. 아래쪽 굴의 구조가 훤히 보인다.', 'level'); },
        fail: api => { api.hurt(pct(api, 0.22), '끊어진 계단'); api.surround(3); } },
      { n:'벽을 더듬어 기어내려간다', t:'안전하지만 시간이 지체된다. 시간 25.',
        run: api => { api.spendClock(25); api.mats({ scrap: 4 + api.rnd(4) });
                      api.say('오랜 시간이 걸려 내려왔다. 바위 틈에서 쓸 만한 것을 주웠다.') } },
      { n:'돌아선다', t:'', run: api => api.say('끊긴 계단 앞에서 돌아섰다.') },
    ],
  },
  {
    id:'gamblerbones', n:'주사위를 쥔 유해', w:10, when: api => api.p.gold >= 120 && api.depth >= 4,
    t:'마른 손 하나가 뼈 주사위 두 개를 쥔 채 굳어 있다. 손가락을 펴면 아직 굴릴 수 있다.',
    opts:[
      { n:'한 번 굴린다', odds:0.5, risk:'건 만큼 사라지고 소문이 돈다',
        t:'가진 금화의 절반을 건다. 이기면 두 배로 돌려받는다.',
        run: api => { const bet = Math.floor(api.p.gold / 2); api.p.gold += bet;
                      api.say(`${bet}닢이 두 배가 되어 돌아왔다.`, 'level'); },
        fail: api => { const bet = Math.floor(api.p.gold / 2); api.p.gold -= bet;
                       api.infamy(0.2); api.say(`${bet}닢을 잃었다.`, 'hit'); } },
      { n:'세 번 연달아 굴린다', odds:0.14, risk:'전 재산과 소리를 듣고 몰려온 넷',
        t:'가진 금화 전부를 건다. 이기면 다섯 배, 그리고 유물 하나.',
        run: api => { const bet = api.p.gold; api.p.gold += bet * 4; api.relic();
                      api.say(`${bet}닢이 다섯 배가 되었다. 유해의 손이 무언가를 내밀었다.`, 'level'); },
        fail: api => { api.p.gold = 0; api.infamy(0.5); api.surround(4);
                       api.say('주사위 구르는 소리가 너무 컸다.', 'hit'); } },
      { n:'손가락을 도로 접어둔다', t:'', run: api => api.say('손을 원래대로 두고 물러났다.') },
    ],
  },
  {
    id:'hungrydoor', n:'배고픈 문', w:10, when: api => api.depth >= 6,
    t:'문 하나가 벽에 박혀 있다. 경첩도 손잡이도 없고, 가운데가 사람 입처럼 벌어져 있다. 더운 숨이 규칙적으로 흘러나온다.',
    opts:[
      { n:'벌어진 입안에 손을 넣는다', odds:0.4, risk:'문에서 쏟아지는 넷',
        t:'이 층보다 네 층 깊은 물건이 나온다. 접두와 접미가 붙은 채로.',
        run: api => { api.gear(4); api.gear(4); api.say('입안 깊은 곳에서 장비 두 개가 잡혔다.', 'level'); },
        fail: api => { api.hurt(pct(api, 0.18), '배고픈 문'); api.surround(4);
                       api.say('문이 살점을 물고 다물렸다. 그리고 뒤쪽 벽이 열렸다.', 'hit'); } },
      { n:'쇳조각으로 입을 틀어막는다', t:'쇳조각 8. 다음 층이 조용해진다.',
        need: api => api.has({ scrap: 8 }),
        run: api => { api.pay({ scrap: 8 }); api.nextFloor({ clock: 1.6, elite: 0.4 });
                      api.say('숨소리가 멎었다.', 'good'); } },
      { n:'지나친다', t:'', run: api => api.say('숨소리를 등지고 걸었다.') },
    ],
  },
  {
    id:'ashenpact', n:'재 속의 약속', w:9, when: api => api.depth >= 9,
    t:'벽에 손자국이 하나 찍혀 있다. 안쪽에서 밀어붙여 만든 자국이다. 크기가 딱 당신 손만 하다.',
    opts:[
      { n:'손을 맞춰 댄다', odds:0.35, risk:'벽에서 나온 넷과 이 층의 절반이 깬다',
        t:'최대 체력이 영구히 크게 오르고, 무기가 두 단계 벼려진다.',
        run: api => { api.permHp(22); api.forge(2, 'weapon');
                      api.say('벽이 뜨거워졌다. 살갗이 융합되며 손목까지 검게 변했다.', 'level'); },
        fail: api => { api.surround(4); api.wakeHalf();
                       api.say('맞춰 댄 손을 벽이 놓아주지 않았다.', 'hit'); } },
      { n:'자국을 재로 덮어버린다', t:'안전하다. 이 층의 상자 위치가 드러난다.',
        run: api => { api.revealChests(false); api.say('자국이 덮였다. 대신 벽 너머 방들의 윤곽이 보였다.', 'good'); } },
    ],
  },
  /* ── 4대 핵심 서사 & 초월 복선 사건 ─────────────────────── */
  {
    id:'shattered_blade', n:'선대 용사의 검흔', w:10, when: api => api.depth >= 3 && api.depth <= 6,
    t:'벽에 깊게 박힌 부러진 대검. 칼자루에 긁힌 글귀: 「4층에서 천사의 날개 뒤를 보았다... 그것은 구원이 아니라 살점의 사슬이다. 그의 축복을 탐하지 마라.」',
    opts:[
      { n:'검흔을 어루만진다', t:'천사에 대한 왜곡된 신앙을 거두고 정신을 차린다. 신앙심 -10.',
        run: api => {
          if (api.p) { api.p.piety = Math.max(0, (api.p.piety || 0) - 10); }
          api.heal(pct(api, 0.12));
          api.say('거짓된 축복의 유혹에서 한 걸음 물러났다. 머리가 맑아진다.', 'good');
        } },
      { n:'부러진 칼날을 뽑아낸다', odds:0.55, risk:'칼날이 부러지는 소리에 몬스터 둘이 깬다',
        t:'선대 용사의 강철 파편과 강화 재료를 수습한다.',
        run: api => {
          api.mats({ scrap: 6 + api.rnd(6), dust: 4 + api.rnd(4) });
          api.forge(1, 'weapon');
          api.say('선대의 부러진 칼날에서 고대의 쇳조각과 벼림의 불씨를 얻었다.', 'level');
        } ,
        fail: api => {
          api.hurt(pct(api, 0.15), '부러진 칼날'); api.surround(2);
          api.say('칼날이 깨지며 비명 같은 소리가 굴에 울려 퍼졌다.', 'bad');
        } },
      { n:'묵묵히 지나친다', t:'', run: api => api.say('부러진 검을 뒤로하고 길을 재촉했다.') },
    ],
  },
  {
    id:'false_shrine', n:'기만당한 성소', w:10, when: api => api.depth >= 7 && api.depth <= 10,
    t:'가면을 쓴 천사의 조각상. 그러나 조각상 뒤편 벽면에는 수많은 붉은 눈과 얽힌 촉수들이 기괴하게 돋아나 있다. 이 성소는 신을 기리는 곳이 아니다.',
    opts:[
      { n:'천사의 가면을 깨뜨린다', odds:0.50, risk:'제단의 기만적인 저주와 피격',
        t:'기만을 꿰뚫고 성소에 갇힌 유물을 해방한다. 신앙심 -15.',
        run: api => {
          if (api.p) { api.p.piety = Math.max(0, (api.p.piety || 0) - 15); }
          api.relic();
          api.say('가면이 깨지며 갇혀 있던 고대 유물이 모습을 드러냈다!', 'level');
        },
        fail: api => {
          api.hurt(pct(api, 0.20), '기만의 저주'); api.rouse(14);
          api.say('조각상의 붉은 눈들이 번뜩이며 영혼을 갉아먹었다.', 'bad');
        } },
      { n:'성소의 잔해를 정화한다', t:'등불 기름 150 소모. 영구 공격력 +2.',
        need: api => api.has({ oil: 150 }),
        run: api => {
          api.pay({ oil: 150 });
          api.forge(1, 'weapon');
          api.say('기괴한 촉수들을 불태웠다. 불길 속에서 무기가 단단해졌다.', 'good');
        } },
      { n:'성소를 우회한다', t:'', run: api => api.say('불경한 기운을 피해 발걸음을 돌렸다.') },
    ],
  },
  {
    id:'seal_runestone', n:'봉인의 붉은 룬석', w:10, when: api => api.depth >= 11,
    t:'흑요석 비석에 붉은 룬으로 쓰인 계시: 「15층의 마왕은 적이 아니다. 스스로 악을 짊어진 자다. 옥좌의 사슬을 끊고 봉인석을 깨뜨려라. 그것만이 윤회를 찢는 유일한 길이다.」',
    opts:[
      { n:'룬의 진실을 가슴에 새긴다', t:'진 엔딩을 향한 결의. 신앙심 -20, 영구 최대 체력 +15.',
        run: api => {
          if (api.p) { api.p.piety = Math.max(0, (api.p.piety || 0) - 20); }
          api.permHp(15);
          api.say('천사의 기만을 꿰뚫었다. 진정한 적이 누구인지 똑똑히 깨달았다.', 'level');
        } },
      { n:'룬석의 마력을 흡수한다', odds:0.48, risk:'봉인의 반동 피해와 적들의 습격',
        t:'모든 스킬 쿨타임 영구 -1 및 보호막 획득.',
        run: api => {
          api.heal(pct(api, 0.30));
          api.say('룬석의 고대 마력이 온몸의 경락을 타고 흘렀다.', 'good');
        },
        fail: api => {
          api.hurt(pct(api, 0.24), '룬석의 반동'); api.surround(3);
          api.say('마력이 폭주하며 뼈를 울렸다!', 'bad');
        } },
      { n:'조용히 묵념한다', t:'최대 체력의 20% 회복.',
        run: api => { api.heal(pct(api, 0.20)); api.say('선대들의 희생에 경의를 표했다.', 'good'); } },
    ],
  },
  {
    id:'ancient_forge', n:'고대 융합의 석판', w:9, when: api => api.depth >= 5 && api.depth <= 13,
    t:'연금술사의 고대 석판. 두 유물이 결속하여 초월(Transcendence)에 이르는 10대 공식이 은은한 빛으로 새겨져 있다.',
    opts:[
      { n:'석판의 공명을 읽는다', t:'유물 강화 재료(먼지 10, 고철 10)를 얻고 장비를 벼린다.',
        run: api => {
          api.mats({ scrap: 10, dust: 10 });
          api.forge(1, 'armor');
          api.say('초월 융합의 이치를 깨달았다. 방어구가 견고해졌다.', 'good');
        } },
      { n:'석판에 피를 바쳐 초월을 기도한다', odds:0.55, risk:'석판의 거부 반응과 피로',
        t:'무작위 유물 1개 획득 및 2단계 무기 강화.',
        run: api => {
          api.relic(); api.forge(2, 'weapon');
          api.say('석판이 피를 마시고 빛을 뿜으며 초월의 비보를 토해냈다!', 'level');
        },
        fail: api => {
          api.hurt(pct(api, 0.18), '석판의 거부');
          api.say('석판이 차갑게 식으며 피만 앗아갔다.', 'bad');
        } },
      { n:'기록만 남긴다', t:'경험치 획득.',
        run: api => { api.say('석판의 룬 문양을 일지에 기록해 두었다.'); } },
    ],
  },
];

function twinDoor(api) {
  if (api.chance(0.5)) { api.relic(); api.say('문 뒤의 좌대에 유물이 놓여 있었다.', 'level'); }
  else { api.spawnElite(2); api.say('문 뒤에서 두 쌍의 붉은 눈이 돌아보았다.', 'hit'); }
}
