# 실제 게임 검증 데이터 (비어 있음 — 수집 필요)

`node validation/run-game-validation.mjs fixtures/real-game`(CI의 `game-validation` 작업)가 이 폴더의 `*.json`을 모두 검사한다. **아래 조건을 전부 만족하기 전까지 이 작업은 실패한다.** 파일이 있다는 것만으로는 통과하지 않는다.

## 통과 조건

1. 모든 파일이 통과: 엔진이 **위치를 찾는 데 쓰지 않은 결과**(최소 10회)를 정확히 예측해야 한다.
2. 커버리지:
   - 일반 뽑기 기록 1건 이상 통과
   - 페스티벌 뽑기 기록 1건 이상 통과
   - **실제 잭팟 지급**(금·은에서 이번 시즌 배너·칭호를 받음) 사건 1건 이상 검증
   - **중복 잭팟 대체**(이미 가진 잭팟이라 동색으로 바뀜) 사건 1건 이상 검증

잭팟 사건은 다음을 모두 만족해야 "검증"으로 센다. 잭팟 없이 일반 캡슐만 나온 기록은 잭팟 규칙을 검증하지 않는다.
- 위치 탐색에 쓰지 않은 구간에서 발생
- 그 뒤로 10회 이상 예측이 맞음
- 경쟁 규칙(추가 난수 0·1·3회, 대체/지급 반대)으로 계산하면 기록과 어긋남

## 상태 세 가지 — 섞지 말 것

| 필드 | 의미 | 처리 |
|---|---|---|
| `startStateBeforeFirstPull` | `pulls`의 **첫 결과를 뽑기 직전** 상태 | 탐색 없이 직접 재현. 모든 결과가 예측 대상 |
| `nplnUserId` 또는 `initialState` | ID 또는 ID에서 만든 **초기 상태** | 처음 `useForSearch`회(기본 20)로 위치 탐색, 나머지로 검증 |
| `currentStateAfterLastPull` | **마지막 결과 직후** 상태 (선택) | 계산 결과와 같아야 함 |

`startStateBeforeFirstPull`, `nplnUserId`, `initialState` 중 **정확히 하나**만 넣는다. 다른 도구가 "현재 상태"로 보여준 값을 쓸 때는 그 값을 확인한 **다음부터** 뽑은 결과를 기록해야 `startStateBeforeFirstPull`이 된다. 기록을 마친 뒤 다시 확인한 값은 `currentStateAfterLastPull`이다.

## 형식

```json
{
  "source": "real-game",
  "recordedAt": "2026-11-01",
  "note": "일반 뽑기, 같은 날 연속",
  "mode": "normal",
  "season": 17,
  "ownershipBeforeFirstPull": { "missingBanners": 2, "missingTitles": 2 },
  "startStateBeforeFirstPull": ["0x........", "0x........", "0x........", "0x........"],
  "currentStateAfterLastPull": ["0x........", "0x........", "0x........", "0x........"],
  "pulls": ["blue", "purple", "red", "gold", "..."],
  "jackpotPullIndices": [3]
}
```

- `ownershipBeforeFirstPull`: 첫 결과 직전 기준, 이번 시즌 잭팟 배너·칭호 중 **아직 갖지 않은** 개수 (시즌 1–8은 0–1, 시즌 9부터 0–2).
- `pulls`: 화면에 나온 캡슐 색 순서. `gold, silver, bronze, red, purple, blue` 또는 0–5. 보상까지 적으려면 `{ "grade": "purple", "type": "Byname", "subType": "None" }`.
- `jackpotPullIndices` (선택): 실제로 잭팟 아이템을 받은 결과의 0부터 센 번호. 엔진 판단과 다르면 실패한다.
- `nplnUserId`는 개인 식별자이므로 공개 저장소에는 상태 4워드를 권장한다.
