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
| 초기 상태 | 워드 i = MurmurHash3_x86_32(`<NPLN유저ID>_<키>_<i>`), i=0..3, 키 `Lot`(일반)·`LotFest`(페스티벌) | 공개 도구 동작과 일치 확인 |
| 등급 결정 | u32 상위 23비트 → [0,100) 실수, 표 순서대로 누적 확률을 처음 넘는 행 | 공개 도구와 일치. 확률 합계는 Inkipedia 공개 확률과 일치 |
| 추가 난수 소비 | 잭팟(금·은) 2회 / 음식·드링크 티켓, 기어 파워 조각 1회 / 그 외 0회 | 공개 도구와 일치. **게임 대조 미검증** |
| 중복 잭팟 | 이번 시즌 잭팟을 모두 가졌으면 금·은 → 동색(10개 조각)으로 바뀌고 추가 소비 0회. 하나라도 없으면 2회 소비 후 하나 획득 | 대체 현상은 Inkipedia와 일치. 소비 횟수는 **미검증** |
| 시즌 잭팟 수 | 시즌 1–8: 종류별 1개, 시즌 9부터 2개 | 공개 도구의 가정. **미검증** |
| 보상표 | 시즌 1–2(v1.1.0)와 3 이후(v3.0.0, 이모트 추가) 2종 | 공개 도구 데이터 |
| 일반/페스티벌 차이 | 별도 스트림(키만 다름), 보상표는 동일하다고 가정 | **추정** |

**기어 파워 난수와 다르다.** PR #1의 xorshift32(13/17/5)는 기어 추가 파워용이며 로비 뽑기에는 적용되지 않는다.

**"시드"의 의미.** 로비 뽑기는 32비트 시드를 색깔에서 역산하는 구조가 아니다. 플레이어 ID로 정해진 하나의 스트림에서 *현재 몇 번째 난수 위치인지*를 찾는다. 따라서 엔진에는 다음 중 하나가 필요하다.
- NPLN 유저 ID (공개 도구는 리플레이 코드 조회 API로 얻는다. 이 앱은 서버·API를 쓰지 않으므로 직접 입력해야 한다)
- 또는 다른 도구가 보여준 현재 상태 4워드

ID 없이 색깔만으로 128비트 상태를 복원하는 방법은 구현하지 않았다(아래 "남은 문제").

## 구현

- `engine/murmur3.mjs`, `engine/xorshift128.mjs` — 공개 알고리즘의 독립 구현
- `engine/shellout.mjs` — 보상표, 1회 뽑기(`pullOnce`), 시뮬레이션, 위치 전수 탐색(`OffsetSearch`, 조금씩 실행 가능), 추가 결과로 후보 축소(`refineCandidates`), 황금까지 남은 횟수(`pullsUntilGold`)
- `engine/search-worker.mjs` — Web Worker에서 탐색, 진행률·취소. 워커가 안 되면 메인 스레드에서 쪼개 실행
- `lab.html` — 실험 페이지(미검증 경고 표시, ID는 저장하지 않음)

성능: 100만 위치 × 색 20개 탐색 약 0.2–0.4초(데스크톱 Chromium). 아이폰 Safari는 이 환경에서 테스트하지 못했다.

## 검증 상태

`node --test tests/*.test.mjs` (Node 20+, 의존성 없음) — 20 통과 / 1 보류(todo)

**통과 — 증명하는 것**
1. MurmurHash3 공개 테스트 벡터, xorshift128 Marsaglia 기준 수열
2. 공개 도구 로직과의 차분 대조: 무작위 ID 200개 × 일반/페스티벌 × 7가지 시즌·보유 조건 × 3,000회 = **840만 회 뽑기의 등급·보상 종류·능력치·내부 상태 전부 일치** (대조용 원본 코드는 저장소에 넣지 않았고, 결과 벡터만 `fixtures/leanny-parity.json`에 저장)
3. float32/double 경계: 2^23개 전체에서 분류가 달라지는 값은 표당 1–2개이며, 모두 같은 색·같은 소비 횟수의 행끼리라 결과에 영향 없음
4. 합성 데이터 왕복: 알려진 ID로 수백~수천 회 진행 후 색 30개만으로 원래 위치를 유일하게 복구, 입력에 쓰지 않은 다음 60회 일치 (일반·페스티벌 각각)
5. 관측이 적으면 후보 여러 개로 남고 "확정"이라 표시하지 않음, 추가 결과로 정확히 축소
6. 잭팟 보유 시 동색 대체·소비 0회, 미보유 시 소비 2회·보유 수 감소
7. 실험 페이지 E2E(헤드리스 Chromium): 22회 입력 → 후보 1개, 황금까지 횟수와 이후 30회 예측 일치, 취소 동작

**증명하지 못하는 것**
- 위 2는 *공개 도구와 같다*는 것이지 *게임과 같다*는 것이 아니다. 실제 게임 기록과의 대조(`tests/real-game.test.mjs`)는 데이터가 없어 보류 상태다.
- 위 4는 엔진 자기 일관성 검증이다.

## 남은 문제 / 필요한 자료

1. **실제 게임 연속 뽑기 기록** (가장 중요): 현재 상태 4워드 또는 ID + 30회 이상 색 순서 + 첫 뽑기 직전 잭팟 보유 수. 형식은 `fixtures/real-game/README.md`. 일반·페스티벌, 잭팟 보유/미보유, 금·은·동이 나온 기록이 각각 필요하다.
2. 잭팟 보유 수 입력이 틀리면 색 예측은 맞아도 황금 위치가 틀린다(테스트 중 실제로 145회 vs 없음으로 갈린 사례 확인). 보유 상태 입력 UI·안내가 핵심이다.
3. 페스티벌 보상표가 일반과 같은지, 시즌 9 이후 잭팟 2종 규칙이 맞는지 확인할 기록.
4. ID 획득: 서버 없이 ID를 얻는 방법이 없다. 사용자가 직접 입력하는 흐름 외 대안은 미정.
5. ID 없이 색만으로 상태 복원: xorshift128이 GF(2) 선형이라 이론상 시도 가능하나, 색 관측이 주는 확정 비트가 적고 종류별 소비 횟수가 갈려 미구현.
6. 아이폰 Safari 실기 테스트.

검증이 끝나기 전까지 PR은 병합하지 않으며, 운영 UI는 "준비 중" 상태를 유지한다.

## 출처

- Leanny Seed Checker 공개 빌드 및 소스맵(제3자 미러 `ToeMunchEnja/splat3seedchecker`) — 동작 분석용으로만 열람, 코드 복제 없음
- [Inkipedia: Shell-Out Machine](https://splatoonwiki.org/wiki/Shell-Out_Machine) — 등급별 확률, 잭팟 대체
- MurmurHash3(Austin Appleby, 퍼블릭 도메인), xorshift(Marsaglia, 2003)

Game graphics/trademarks belong to their owners. This unofficial fan project is not affiliated with Nintendo.