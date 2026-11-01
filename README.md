# SPLAT SEED — Shell-Out Tracker (prototype)

Static single-file HTML tracker for Splatoon 3 Shell-Out Machine. Upload `index.html` to the root of a GitHub repository and enable GitHub Pages (Settings → Pages → Deploy from branch → main / root).

## Available now
- Korean responsive, game-inspired interface with original CSS capsule icons
- Track 6 capsule colors; separate normal and Splatfest histories
- Import a future *color sequence* manually (comma/space-separated)
- Display distance to next gold in the imported sequence and cash estimates
- Advance forecasts one pull at a time; localStorage persistence, JSON backup/restore

## Not yet implemented (important)
- No reverse RNG seed recovery
- No generation of predicted capsules from hexadecimal seed
- No item/reward-level identification for seed recovery
- No game asset redistribution

Never treat an imported sequence as a mathematically verified prediction unless it was obtained from a separately validated tool.

---

# 독립 계산 엔진 (브랜치 `engine/shellout-xorshift128`, 미병합)

`index.html`(운영 UI)은 그대로 두고, 독립 엔진과 실험 페이지 `lab.html`만 추가했다. **실제 게임 대조 검증 전이므로 운영 UI에 예측 기능을 연결하지 않았다.**

## 로비 뽑기 난수 모델

| 항목 | 내용 | 근거 수준 |
|---|---|---|
| 난수 생성기 | Marsaglia xorshift128 (11/8/19), 상태 128비트 | 공개 도구 동작과 일치 확인 |
| 초기 상태 | 워드 i = MurmurHash3_x86_32(`<NPLN유저ID>_<키>_<i>`), i=0..3, 키 `Lot`(일반)·`LotFest`(페스티벌). ID는 실제 형식 `u-` + 영문 소문자·숫자 20자이며 **`u-`까지 포함해 해시** | 공개 도구, nxapi `util splatoon3-seed` 출력과 일치 확인 |
| 등급 결정 | u32 상위 23비트 → [0,100) 실수, 표 순서대로 누적 확률을 처음 넘는 행 | 공개 도구와 일치. 확률 합계는 Inkipedia 공개 확률과 일치 |
| 추가 난수 소비 | 잭팟(금·은) 2회 / 음식·드링크 티켓, 기어 파워 조각 1회 / 그 외 0회 | 공개 도구와 일치. **게임 대조 미검증** |
| 중복 잭팟 | 이번 시즌 잭팟을 모두 가졌으면 금·은 → 동색(10개 조각)으로 바뀌고 추가 소비 0회. 하나라도 없으면 2회 소비 후 하나 획득 | 대체 현상은 Inkipedia와 일치. 소비 횟수는 **미검증** |
| 시즌 경계 | 시즌 시작 시각(3·6·9·12월 1일 00:00 UTC)을 포함해 새 시즌으로 계산 | 공개 도구는 시작 시각을 이전 시즌으로 세므로 **정확한 시작 1ms에서만** 다름. 게임의 실제 보상표 전환 시각은 **미검증** |
| 시즌 잭팟 수 | 시즌 1–8: 종류별 1개, 시즌 9부터 2개 | 공개 도구의 가정. **미검증** |
| 보상표 | 시즌 1–2(v1.1.0)와 3 이후(v3.0.0, 이모트 추가) 2종 | 공개 도구 데이터 |
| 일반/페스티벌 차이 | 별도 스트림(키만 다름), 보상표는 동일하다고 가정 | **추정** |

**기어 파워 난수와 다르다.** PR #1의 xorshift32(13/17/5)는 기어 추가 파워용이며 로비 뽑기에는 적용되지 않는다.

**"시드"의 의미.** 로비 뽑기는 32비트 시드를 색깔에서 역산하는 구조가 아니다. 플레이어 ID로 정해진 하나의 스트림에서 *현재 몇 번째 난수 위치인지*를 찾는다.

**두 능력을 구분한다.**

| 능력 | 상태 |
|---|---|
| Leanny와 **독립적으로 계산**: 기준 상태가 주어지면 결과 재현·위치 탐색·황금까지 횟수 계산 | 구현됨 (게임 대조 미검증) |
| Leanny 도움 **없이 처음부터 시드 확보**: 사용자가 기준 상태를 스스로 얻는 경로 | **미구현.** ID는 공개 도구가 외부 리플레이 조회 API로 얻으며, 이 앱은 서버·API를 쓰지 않음. 현재는 사용자가 ID나 상태를 다른 경로로 알아야 함 |

**세 가지 상태 — 서로 다르다.**

| 상태 | 의미 | 엔진 처리 |
|---|---|---|
| 초기 상태 (`initialState`) | ID에서 만든 스트림 시작점 | 위치 **탐색**의 기준점 |
| 첫 뽑기 직전 상태 (`startStateBeforeFirstPull`) | 입력한 첫 결과를 뽑기 바로 전 상태 | 탐색 없이 **직접 재현** |
| 마지막 뽑기 직후 상태 (`currentStateAfterLastPull`) | 입력한 마지막 결과 바로 뒤 상태 (선택) | 계산 결과와 **비교** |

이미 뽑은 뒤의 상태를 "첫 뽑기 직전"으로 넣으면 엔진이 맞아도 불일치가 나므로, 실험 페이지와 검증 데이터 모두 이 셋을 별도 필드로 받는다.

ID 없이 색깔만으로 128비트 상태를 복원하는 방법은 구현하지 않았다(아래 "남은 문제").

## 구현

- `engine/murmur3.mjs`, `engine/xorshift128.mjs` — 공개 알고리즘의 독립 구현
- `engine/shellout.mjs` — 보상표, 1회 뽑기(`pullOnce`), 시뮬레이션, 위치 전수 탐색(`OffsetSearch`, 조금씩 실행 가능), 추가 결과로 후보 축소(`refineCandidates`), 황금까지 남은 횟수(`pullsUntilGold`)
- `engine/search-worker.mjs` — Web Worker에서 탐색, 진행률·취소. 워커가 안 되면 메인 스레드에서 쪼개 실행
- `engine/shellout.mjs`의 `reproduce` — 첫 뽑기 직전 상태에서 탐색 없이 직접 재현
- `validation/` — 실제 게임 기록 평가기와 검증 게이트(`run-game-validation.mjs`)
- `lab.html` — 실험 페이지(미검증 경고 표시, ID는 저장하지 않음). 기준 상태를 "ID → 위치 탐색"과 "첫 뽑기 직전 상태 → 직접 재현"으로 나누고, 마지막 뽑기 직후 상태를 선택 입력해 비교. 상태가 다르면 경고만 띄우고 이후 예측·황금까지 횟수를 숨기며, 입력 형식이 틀리면 계산하지 않고 오류를 표시

성능: 100만 위치 × 색 20개 탐색 약 0.2–0.4초(데스크톱 Chromium). 아이폰 Safari는 이 환경에서 테스트하지 못했다.

## 검증 상태

CI는 두 작업으로 나뉜다. **병합 조건은 `game-validation` 통과다.**

| 작업 | 명령 | 현재 |
|---|---|---|
| `engine-tests` | `node --test tests/*.test.mjs` | 50개 전부 통과 |
| `game-validation` | `node validation/run-game-validation.mjs fixtures/real-game` | **실패 (의도된 상태)** — 실제 기록 없음 |

### `game-validation` 통과 조건
두 검증을 구분한다. **예측 검증**은 색이 맞는지, **보상 규칙 검증**은 잭팟 지급·중복 대체가 실제로 일어났고 그 뒤 난수 진행까지 맞는지를 본다.

- 예측: 모든 실제 기록에서 위치를 찾는 데 쓰지 않은 결과(최소 10회)를 정확히 예측. 일반·페스티벌 각각 1건 이상
- 잭팟 지급: 기록자가 화면에서 본 지급을 `observedEvents`에 적는 것이 **필수**이며, 엔진이 계산한 지급(번호·종류)과 정확히 같아야 함
- 중복 대체: 화면으로는 일반 동색과 구별할 수 없으므로 관측 기록으로 받지 않음. **사전 등록**(뽑기 전에 "k번째는 대체"라는 예측 파일을 먼저 커밋)이 적중한 경우만 인정. 게이트가 git 기록으로 사전 등록이 기록보다 엄격히 앞선 커밋인지, 이후 수정되지 않았는지 확인
- 사건 공통: 탐색에 쓰지 않은 구간에서 발생, 이후 10회 이상 예측 일치, 경쟁 규칙(추가 난수 0·1·3회, 지급↔대체 반대)으로는 기록과 어긋남. 일반 캡슐만 나온 기록은 잭팟 규칙 검증으로 세지 않음
- 모든 기록에 수집 경위(`provenance`: 방법·원본 위치·기록자) 필수. `source: "real-game"`은 증명이 아니며 원본 확인용 경위를 남기는 것
- 파일 존재만으로는 통과하지 않음. 형식은 `fixtures/real-game/README.md`

### `engine-tests`가 증명하는 것
1. MurmurHash3 공개 테스트 벡터, xorshift128 Marsaglia 기준 수열
2. 공개 도구 로직과의 차분 대조: 실제 형식(`u-…`)의 무작위 ID 200개 × 일반/페스티벌 × 7가지 시즌·보유 조건 × 3,000회 = **840만 회 뽑기의 등급·보상 종류·능력치·내부 상태 전부 일치** (대조용 원본 코드는 저장소에 넣지 않았고, 결과 벡터만 `fixtures/leanny-parity.json`에 저장)
   - ID 처리 대조(`fixtures/npln-id-vectors.json`, ID 40개): 해시가 nxapi `util splatoon3-seed`가 쓰는 라이브러리(npm `murmurhash` 2.0.1) 결과와 같고, nxapi 형식 키가 같은 ID로 되돌아가며, 초기 상태(일반·페스티벌)가 공개 도구와 같음. `u-`를 떼면 다른 스트림이 됨을 확인. 실제 형식이 아닌 입력은 거부
3. float32/double 경계: 2^23개 전체에서 분류가 달라지는 값은 표당 1–2개이며, 모두 같은 색·같은 소비 횟수의 행끼리라 결과에 영향 없음
4. 합성 데이터 왕복: 색 30개만으로 원래 위치 복구, 입력에 쓰지 않은 다음 60회 일치 (일반·페스티벌 각각)
5. 관측이 적으면 "확정"이라 표시하지 않음, 추가 결과로 정확히 축소
6. 잭팟 보유 시 동색 대체·소비 0회, 미보유 시 소비 2회·보유 수 감소
7. 시즌 경계: 시작 시각 정각은 새 시즌, 1ms 전은 이전 시즌
8. **검증기가 틀리면 실패하는지** (메타 테스트, 합성 데이터만 사용): 결과 하나만 바뀌어도 실패, 초기 상태를 첫 뽑기 직전 상태로 잘못 넣으면 실패, 마지막 상태 불일치·보유 수 오입력 시 실패, 상태 필드 중복·누락 거부, 직접 재현 모드는 위치 탐색 0회, 잭팟 사건 뒤 결과가 짧으면 규칙 미검증 처리, 커버리지가 모자라면 게이트 실패
9. **보상 규칙 검증의 독립성** (메타 테스트): 관측 지급이 빠지거나·남거나·종류가 다르면 실패, 화면 관측으로 대체를 적으면 거부, 색만 맞는 대체는 미검증, 사전 등록이 빗나가면 실패, 사전 등록이 다른 상태·스트림·보유 수를 가리키면 실패, 임시 git 저장소에서 사전 등록이 같은 커밋·나중 수정·기록 미커밋인 경우 게이트 실패

또한 엔진 규칙을 일부러 바꾼 상태(잭팟 소비 2→1회, 대체 소비 0→1회, 음식 티켓 소비 1→0회, 대체 없음)에서 정상 엔진이 만든 합성 기록(관측 지급·사전 등록 포함)을 돌리면 게이트가 모두 실패하고, 정상 엔진에서는 통과하는 것을 수동으로 확인했다(저장소 밖 실험).

### 증명하지 못하는 것
- 위 2는 *공개 도구와 같다*는 것이지 *게임과 같다*는 것이 아니다.
- 위 4·8·9는 엔진 자기 일관성과 검증기의 민감도 확인이다. 게임과의 일치는 `game-validation`만 증명한다.
- `provenance`와 `source`는 기록이 실제 게임에서 왔다는 증명이 아니다. 원본 화면 기록을 사람이 확인해야 한다.

### 알려진 한계 (이번 PR에서 수정하지 않음)
- **위상 이동 쌍둥이 후보**: 위치 t의 첫 뽑기가 난수를 2개 쓰고, t+1에서 읽은 값이 같은 색의 추가 소비 0회 행이면 두 위치가 이후 같은 상태로 합쳐진다. 지금은 이를 "후보 2개 · 확정 아님"으로 보고한다. 틀린 예측을 내는 방향이 아니라 확정을 보류하는 방향이며, 검증 게이트에서도 실패로 처리된다. 같은 미래를 갖는 후보를 하나로 볼지는 별도 논의가 필요하다.
  - 생각보다 자주 생긴다: 합성 ID 12개로 300회 진행 후 색 20개 탐색 시 2개에서 발생.
- **재정렬되는 잭팟 사건**: 같은 원리로, 대체 사건 뒤 "추가 난수 1회" 같은 경쟁 규칙이 실제 흐름과 다시 맞물리면 그 사건으로는 규칙을 검증할 수 없다. 검증기는 이런 사건을 사전 등록이 있어도 미검증으로 처리한다(메타 테스트 포함).

## 남은 문제 / 필요한 자료

1. **실제 게임 연속 뽑기 기록** (가장 중요): 첫 뽑기 직전 상태 4워드(또는 ID) + 색 순서 + 첫 뽑기 직전 잭팟 미보유 수. 형식은 `fixtures/real-game/README.md`. 일반·페스티벌 기록, 그리고 **실제 금·은 지급 사건과 중복 대체 사건이 들어간 기록**이 각각 필요하다.
2. 잭팟 보유 수 입력이 틀리면 색 예측은 맞아도 황금 위치가 틀린다(테스트 중 실제로 145회 vs 없음으로 갈린 사례 확인). 보유 상태 입력 UI·안내가 핵심이다.
3. 페스티벌 보상표가 일반과 같은지, 시즌 9 이후 잭팟 2종 규칙이 맞는지 확인할 기록.
4. Leanny 없이 처음부터 시드 확보: 서버 없이 ID를 얻는 방법이 없다. 사용자가 직접 입력하는 흐름 외 대안은 미정.
5. 역방향 탐색(입력 상태 이전 위치 탐색)은 보류 — 실제 기록으로 정방향 엔진을 검증한 뒤 별도 PR에서 검토.
6. ID 없이 색만으로 상태 복원: xorshift128이 GF(2) 선형이라 이론상 시도 가능하나, 색 관측이 주는 확정 비트가 적고 종류별 소비 횟수가 갈려 미구현.
7. 아이폰 Safari 실기 테스트.

`game-validation`이 통과하기 전까지 PR은 병합하지 않으며, 운영 UI는 "준비 중" 상태를 유지한다.

## 출처

- Leanny Seed Checker 공개 빌드 및 소스맵(제3자 미러 `ToeMunchEnja/splat3seedchecker`) — 동작 분석용으로만 열람, 코드 복제 없음
- [Inkipedia: Shell-Out Machine](https://splatoonwiki.org/wiki/Shell-Out_Machine) — 등급별 확률, 잭팟 대체
- MurmurHash3(Austin Appleby, 퍼블릭 도메인), xorshift(Marsaglia, 2003)

Game graphics/trademarks belong to their owners. This unofficial fan project is not affiliated with Nintendo.