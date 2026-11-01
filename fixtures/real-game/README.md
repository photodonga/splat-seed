# 실제 게임 검증 데이터 (비어 있음 — 수집 필요)

`node validation/run-game-validation.mjs fixtures/real-game`(CI의 `game-validation` 작업)가 이 폴더의 `*.json` 기록을 모두 검사한다. **아래 조건을 전부 만족하기 전까지 이 작업은 실패한다.** 파일이 있다는 것만으로는 통과하지 않는다.

## 두 종류의 검증 — 섞지 말 것

| 검증 | 묻는 것 | 근거 |
|---|---|---|
| 예측 검증 | 엔진이 계산한 캡슐 색이 실제 기록과 같은가 | 위치 탐색에 쓰지 않은 결과 10회 이상 일치 |
| 보상 규칙 검증 | 잭팟 지급·중복 대체가 **실제로 일어났고**, 그 뒤 난수 진행까지 맞는가 | 지급은 직접 관측 기록, 대체는 사전 등록 예측 |

## 통과 조건

1. 모든 기록이 통과: 위치 탐색에 쓰지 않은 결과(최소 10회)를 정확히 예측
2. 커버리지:
   - 일반 뽑기 기록 1건 이상
   - 페스티벌 뽑기 기록 1건 이상
   - **잭팟 지급** 1건 이상 검증
   - **중복 잭팟 대체** 1건 이상 검증

모든 잭팟 사건 검증에 공통으로 필요한 조건: 위치 탐색에 쓰지 않은 구간에서 발생, 그 뒤 10회 이상 예측 일치, 경쟁 규칙(추가 난수 0·1·3회, 지급↔대체 반대)으로 계산하면 기록과 어긋남. 일반 캡슐만 나온 기록은 잭팟 규칙을 검증하지 않는다.

### 잭팟 지급 — 직접 관측
금·은에서 이번 시즌 배너·칭호를 실제로 받으면 `observedEvents`에 적는다. **이 칸은 필수**이며, 받은 게 없으면 `[]`. 엔진이 계산한 지급 목록(번호와 종류)과 하나라도 다르면 기록 전체가 실패한다. 엔진 결과를 보고 채우지 말고 화면에서 본 것만 적는다.

### 중복 대체 — 사전 등록으로만 인정
대체로 나온 동색은 일반 동색과 같은 보상(기어 파워 조각 10개)을 주므로 **화면으로는 구별할 수 없다.** 따라서 `observedEvents`에 `substituted`를 적으면 거부된다. 대신 다음 순서를 따른다.

1. 첫 뽑기 직전 상태를 확인하고, 이번 시즌 잭팟을 모두 가진 상태임을 화면으로 남긴다.
2. 엔진으로 "k번째가 대체"라는 예측을 `preregistrations/<이름>.json`에 적어 **먼저 커밋**한다.
3. 그다음 실제로 뽑아 기록을 만들고, 기록에 `"preregistration": "<이름>.json"`을 넣어 **별도의 이후 커밋**으로 올린다.

게이트는 git 기록으로 사전 등록 파일이 기록보다 **엄격히 앞선 커밋**에 들어갔고 **그 뒤로 수정되지 않았는지** 확인한다. 같은 커밋이거나 나중에 고쳤으면 대체 규칙 검증으로 인정하지 않는다. 사전 등록한 대체가 실제 기록에서 일어나지 않으면 기록 전체가 실패한다.

## 상태 세 가지 — 섞지 말 것

| 필드 | 의미 | 처리 |
|---|---|---|
| `startStateBeforeFirstPull` | `pulls`의 **첫 결과를 뽑기 직전** 상태 | 탐색 없이 직접 재현. 모든 결과가 예측 대상 |
| `nplnUserId` 또는 `initialState` | ID 또는 ID에서 만든 **초기 상태** | 처음 `useForSearch`회(기본 20)로 위치 탐색, 나머지로 검증 |
| `currentStateAfterLastPull` | **마지막 결과 직후** 상태 (선택) | 계산 결과와 같아야 함 |

`startStateBeforeFirstPull`, `nplnUserId`, `initialState` 중 **정확히 하나**만 넣는다. 사전 등록은 `startStateBeforeFirstPull` 기록에서만 쓸 수 있다.

## 기록 형식

```json
{
  "source": "real-game",
  "provenance": { "method": "video", "evidence": "https://… 또는 보관 위치", "recordedBy": "이름" },
  "recordedAt": "2026-11-01",
  "mode": "normal",
  "season": 17,
  "ownershipBeforeFirstPull": { "missingBanners": 2, "missingTitles": 2 },
  "startStateBeforeFirstPull": ["0x........", "0x........", "0x........", "0x........"],
  "currentStateAfterLastPull": ["0x........", "0x........", "0x........", "0x........"],
  "pulls": ["blue", "purple", "red", "gold", "..."],
  "observedEvents": [ { "index": 3, "kind": "awarded", "rewardType": "NamePlateBg" } ]
}
```

- `provenance` (필수): `method`는 `video | screenshots | manual`, `evidence`는 원본 화면 기록의 위치. **`source: "real-game"`은 증명이 아니다.** 사람이 원본을 확인할 수 있도록 수집 경위를 남기는 용도다.
- `ownershipBeforeFirstPull`: 첫 결과 직전, 이번 시즌 잭팟 배너·칭호 중 **아직 갖지 않은** 개수 (시즌 1–8은 0–1, 시즌 9부터 0–2).
- `pulls`: 캡슐 색 순서. `gold, silver, bronze, red, purple, blue` 또는 0–5. 보상까지 적으려면 `{ "grade": "purple", "type": "Byname", "subType": "None" }`.
- `observedEvents` (필수): 0부터 센 번호, `kind`는 `awarded`만, `rewardType`은 `NamePlateBg`(배너) 또는 `Byname`(칭호).
- `nplnUserId`는 개인 식별자이므로 공개 저장소에는 상태 4워드를 권장한다.

## 사전 등록 형식 (`preregistrations/<이름>.json`)

```json
{
  "kind": "shellout-preregistration",
  "predictedAt": "2026-11-01T12:00:00+09:00",
  "mode": "normal",
  "season": 17,
  "ownershipBeforeFirstPull": { "missingBanners": 0, "missingTitles": 0 },
  "startStateBeforeFirstPull": ["0x........", "0x........", "0x........", "0x........"],
  "predictedSubstitutions": [12]
}
```

`mode`, `season`, `ownershipBeforeFirstPull`, `startStateBeforeFirstPull`은 기록과 정확히 같아야 한다.
