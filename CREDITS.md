# 참고한 것

이 저장소에는 여전히 이미지 파일이 한 장도 없습니다. 스프라이트는 전부
`src/pixels.js` 안의 문자 격자이고, 픽셀은 우리 팔레트로 찍혀 있습니다.

다만 **자세·비율·명암 배치**는 눈대중으로 맞히는 대신 공개 에셋을 자로
삼아 쟀습니다. `tools/trace.mjs` 가 그 자입니다.

## Liberated Pixel Cup (LPC)

* Universal LPC Spritesheet Character Generator
  <https://github.com/sanderfrenken/Universal-LPC-Spritesheet-Character-Generator>
* 라이선스: CC-BY-SA 3.0 / GPL 3.0 / OGA-BY 3.0
* 저작자는 저장소의 `CREDITS.csv` 에 자산별로 적혀 있습니다.

`tools/trace.mjs` 는 이 에셋을 읽어 두 가지만 가져옵니다.

1. 실루엣과 명암의 **구조** — 어느 면이 밝고 어느 면이 어두운지
2. 부위별 **덩어리** — 여기가 머리카락이고 여기가 갑옷이라는 구분

원본 픽셀도, 원본 색도 결과물에 남지 않습니다. 색은 전부 `PALETTE` 의
재질 계단으로 다시 찍히고, 비율은 참고본의 사실적 6등신을 버리고 16칸에
맞는 대두로 다시 잡습니다. 얼굴은 축소로는 나오지 않으므로 규칙으로
따로 찍습니다.

참고본 자체는 저장소에 넣지 않습니다. 도구를 돌리려면 위 저장소를 받아
경로를 넘기면 됩니다.

```
LPC=/받아둔/경로 node tools/hero.mjs /tmp/job.py
python3 tools/draw.py /tmp/job.py
```

도구 없이도 게임은 그대로 돌아갑니다 — 결과물이 이미 `src/pixels.js`
안에 문자열로 들어가 있기 때문입니다.
