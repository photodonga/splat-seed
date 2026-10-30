# 실제 게임 검증 데이터 (비어 있음 — 수집 필요)

이 폴더의 `*.json` 파일마다 `tests/real-game.test.mjs`가 실행된다. 처음 N개(기본 20) 결과로 위치를 찾고, **입력에 쓰지 않은 나머지 결과**가 예측과 정확히 일치해야 통과한다.

```json
{
  "note": "2026-11-01 일반 뽑기, 같은 날 연속 40회",
  "mode": "normal",
  "season": 17,
  "missingBanners": 2,
  "missingTitles": 2,
  "startState": ["0x........", "0x........", "0x........", "0x........"],
  "pulls": ["blue", "purple", "red", "..."],
  "useForSearch": 20
}
```

- `startState` 대신 `nplnUserId`를 넣어도 되지만, 개인 식별자이므로 공개 저장소에는 **상태 4워드**를 권장한다. (상태 4워드 = 해당 ID의 초기 상태 또는 다른 도구가 표시한 현재 상태)
- `missingBanners`/`missingTitles`: **첫 결과 직전** 기준, 이번 시즌 잭팟 배너·칭호 중 아직 갖지 않은 개수(시즌 1–8은 0–1, 시즌 9부터 0–2).
- `pulls`: 화면에 나온 캡슐 색을 순서대로. `gold, silver, bronze, red, purple, blue` 또는 0–5.
- 최소 30회(검색 20 + 검증 10) 이상. 금·은·동이 섞인 기록, 이미 잭팟을 가진 상태의 기록, 페스티벌 기록이 특히 필요하다.
