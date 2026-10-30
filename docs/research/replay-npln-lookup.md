# NPLN ID 확보 경로 기술 조사

최초 조사 2026-10-30, 2차 조사 2026-10-30. 브랜치 `research/replay-npln-lookup`. 코드 구현 없음(조사 문서만).

> **실제 닌텐도 서버 조회는 한 번도 성공하지 못했다.** 이 환경에는 닌텐도 계정·NSO 이용권·리플레이 코드가 없고, 닌텐도 서버로 나가는 연결도 막혀 있다. 아래 내용은 공개 소스코드와 문서를 읽고 확인한 **정적 근거**다.

## 결론 요약

| 질문 | 답 | 근거 수준 |
|---|---|---|
| 경로 1: 리플레이 코드 → NPLN ID | 가능. 리플레이 검색 결과 ID가 `Replay-u-<20자>:<코드>` | 두 독립 구현(nxapi, splatoon3-replay-lookup) 소스로 확인 |
| 경로 2: 본인 프로필에서 직접 추출 | 가능하지만 **본인 계정 로그인이 필요**. `splatnet3 user` 명령은 ID를 주지 않음. 내 코디(`MyOutfit-u-…`)나 대전 기록(`VsHistoryDetail-u-…`) ID에서 꺼냄 | nxapi 소스로 확인 |
| 닌텐도 인증 없이 얻는 경로 | **찾지 못함.** NPLN ID는 SplatNet 3 인증 응답 안에서만 확인됨 | 조사 범위 내 |
| 운영자 계정 하나로 다른 사람 코드 조회 | 가능한 구조. 조회 서버가 운영자 계정 하나로 임의의 코드를 조회하도록 설계돼 있음 | 소스 구조로 확인, 실조회 미검증 |
| 최소 백엔드로 통합 | 가능한 구조. "코드 → ID" 엔드포인트 하나 + 운영자 계정 + `f` 생성 접근 | 설계 수준 |
| 2026년 유지보수 오픈소스 | **nxapi**(2026-09-09 커밋, NSO 앱 3.5.0 대응)에 Leanny용 ID 추출 명령까지 있음. nxapi-znca-api(2026-03), s3s(2025-08) | 저장소 커밋 확인 |
| 최종 사용 절차 제약 충족 | **경로 1 + 자체 서버만 충족.** 경로 2는 사용자가 본인 계정 토큰을 넘겨야 해 제약 위반 | 판단 |

## 1. 경로 1 — 리플레이 코드 → NPLN ID

### 구현 두 곳에서 동일한 방식 확인
- **splatoon3-replay-lookup** (`src/index.ts`, 2023-03 이후 갱신 없음): SplatNet 3 `DownloadSearchReplayQuery` → `replay.id`를 base64로 풀어 정규식 `^Replay-(u-[a-z0-9]{20}):([A-Z0-9]{16})$`로 ID 추출
- **nxapi** (`src/cli/util/splatoon3-seed.ts`, 2026-09 기준 최신): 같은 쿼리, 같은 형식 `^Replay-(u-[0-9a-z]{20}):([0-9A-Z]{16})$`. 실제 앱처럼 리플레이 목록 화면 조회를 먼저 호출한 뒤 검색

### 확인된 사실
- 리플레이 코드 하나는 **업로더 한 명**의 ID를 준다. 플레이어 선택 단계가 필요 없다.
- 조회는 **조회하는 계정과 무관한 코드**에 대해 동작하는 구조다(조회 서버가 운영자 계정 하나로 모든 이용자의 코드를 처리). 실제 동작 여부는 실조회로 확인해야 한다.
- 사용자 쪽 준비: 게임에서 자기 대전 리플레이를 업로드해 코드를 받는 것. 게임 안 작업이므로 "외부 사이트 방문·파일 다운로드 없음" 제약과 충돌하지 않는다.

## 2. 경로 2 — 본인 프로필 데이터에서 직접 추출

### `nxapi splatnet3 user`는 답이 아니다
`src/cli/splatnet3/user.ts`는 `HistoryRecordQuery`를 호출해 **이름, 이름 번호, 칭호, 첫 플레이 시각만** 출력한다. 반환 타입(`splatnet3-types`의 `CurrentPlayer`)에도 `id` 필드가 없다.

```
CurrentPlayer { byname, name, nameId, nameplate, userIcon, species, weapon, headGear, clothingGear, shoesGear, … }   // id 없음
```

### 실제 본인 ID 추출 방법 (nxapi `util splatoon3-seed`, 인자 없이 실행)
1. `MyOutfitsQuery` → 첫 코디의 ID를 base64로 풀어 `^MyOutfit-(u-[0-9a-z]{20}):(\d+)$`에서 추출
2. 코디가 없으면 최근 대전 기록 ID에서 `^VsHistoryDetail-(u-[0-9a-z]{20}):…`로 추출
3. 둘 다 없으면 "코디를 만들거나 온라인 대전을 하라"는 오류

### 이 경로의 한계
- 반드시 **조회 대상 본인의 닌텐도 계정으로 로그인**해야 한다. SPLAT SEED가 이 방식을 쓰려면 사용자에게 세션 토큰을 받아야 하는데, 이는 계정 자격증명과 같아 이번 제약("본계정 비밀번호·인증 토큰 요구 금지")에 정면으로 어긋난다.
- 운영자 본인의 ID를 확인하는 용도로만 쓸 수 있다. 다른 사용자 경로로는 쓸 수 없다.

### 참고: ID 형식
두 경로 모두 `u-` + 영문 소문자·숫자 20자. Leanny와 nxapi 모두 `u-`를 **포함한** 문자열을 해시한다(nxapi도 Leanny용 키를 같은 방식으로 만든다: MurmurHash3 → 하위 8비트로 XOR → base64).

## 3. 인증 없이 얻는 다른 경로

조사 범위 안에서는 없다.
- 게임 화면, 스위치 친구 코드, 리플레이 공유 링크(`s.nintendo.com/…?p=/replay?code=…`)에는 NPLN ID가 드러나지 않는다. 공유 링크는 NSO 앱을 여는 링크라 결국 로그인이 필요하다.
- 확인된 모든 추출 경로(리플레이, 코디, 대전 기록)는 SplatNet 3 **인증 응답** 안의 ID를 푸는 방식이다.
- 검증하지 않은 추가 아이디어: SplatNet 3 친구 목록·대전 상세의 다른 플레이어 ID에도 `u-` 형식이 들어 있을 가능성이 있다(운영자와 친구를 맺게 하는 방식 등). 이 역시 운영자 인증이 필요하고, 형식을 소스로 확인하지 못했으므로 후보에서 제외한다.

## 4. 인증 구조와 외부 의존

SplatNet 3 호출 순서: 닌텐도 계정 `session_token` → `id_token` → **`f` 값 생성** → NSO 앱 로그인 → 게임 웹 토큰(약 6시간) → SplatNet 3 bulletToken(약 2시간).

- `f`는 NSO 앱 내부에서만 계산된다. 구현들은 외부 생성 서비스를 쓴다.
  - nxapi 기본: 작성자가 운영하는 nxapi-znca-api. **2025년 6월부터 OAuth 클라이언트 등록 필수**(client credentials 방식). 등록 화면은 공개돼 있으나 자격 요건·승인 기준·이용 조건은 문서에 없다. 토큰을 저장하지 말라는 등 사용 규칙 있음.
  - s3s 기본: imink API(`api.imink.app/f`).
  - 자체 생성: 안드로이드 기기/에뮬레이터 + Frida(nxapi-znca-api 자체 운영). 상시 가동 기기 필요.
- NSO 앱 버전이 바뀌면 `f` 생성 쪽도 갱신돼야 한다. nxapi는 2026-09에 앱 3.5.0 대응 커밋이 있다.
- 운영자 계정에 NSO 이용권이 필요한 것으로 알려져 있으나 **직접 확인하지 못했다.**

## 5. 최소 백엔드 통합 구조 (경로 1)

```
[GitHub Pages: SPLAT SEED]  --리플레이 코드-->  [조회 서버: 엔드포인트 1개]  --인증 요청-->  [SplatNet 3]
          ^                                          |  (운영자 전용 계정, 비밀 저장소)
          +------------ { npln_user_id } ------------+  (+ f 생성: 외부 서비스 또는 자체)
```

- 서버는 코드 형식 검사, 같은 코드 결과 캐시, 요청 제한, 토큰 만료 시 재발급, 오류 응답(코드 없음/인증 만료/상위 서비스 중단 구분)만 한다. ID는 저장하지 않는다.
- 사이트는 받은 ID로 엔진의 초기 상태를 만들고 위치 탐색을 이어간다.
- nxapi(Node)를 그대로 쓰면 토큰 갱신·캐시를 라이브러리가 처리한다. 상시 실행되는 Node 서버가 필요하며, 단일 서버리스 함수로 가능한지는 미검증.
- GitHub Pages ↔ 서버는 CORS 허용만 하면 연동 가능.

## 6. 위험

| 구분 | 내용 |
|---|---|
| 인증·약관 | SplatNet 3 비공식 접근은 닌텐도 약관상 회색지대. 운영자 계정은 본계정이 아닌 전용 계정 |
| 계정 정지 | nxapi 문서: 2023-09 일부 계정 SplatNet 3 차단 사례(401 `ERROR_INVALID_GAME_WEB_TOKEN`). 운영 계정이 막히면 조회 전체 중단 |
| 외부 서비스 의존 | `f` 생성 서비스(등록제·조건 미공개)가 멈추거나 정책을 바꾸면 중단. 완전 독립은 자체 `f` 생성 시에만 가능 |
| 유지보수 | NSO 앱·SplatNet 3 업데이트마다 대응 필요. 갱신이 멈춘 splatoon3-replay-lookup은 현재 상태 페이지에 중단으로 표시 |
| 라이선스 | nxapi **AGPL-3.0**(서버로 운영 시 소스 공개 — 우리 저장소 공개로 충족 가능). s3s GPL. splatoon3-replay-lookup은 **라이선스 없음 → 코드 재사용 불가** |
| 타인 API | splatoon3-replay-lookup 공개 엔드포인트는 "Leanny 전용" 명시 → 허가 없이 사용 불가 |
| 보안 | 운영 계정 세션 토큰·OAuth 클라이언트 비밀은 서버 비밀 저장소에만. nxapi 디버그 로그에 토큰이 남을 수 있어 로그 설정 필요 |
| 개인정보 | NPLN ID는 계정 식별자. 서버·사이트 모두 저장하지 않음 |

## 7. 엔진 통합 문제 (PR #2, 수정 안 함)

PR #2의 `initialState()`는 영문·숫자만 허용해 실제 형식 `u-…`를 거부한다.

```
initialState('u-abcdefghij0123456789')  → RangeError: NPLN user ID must be 6-64 ASCII letters/digits
```

입력 검사를 `^u-[0-9a-z]{20}$`로 바꾸고 `u-` 포함 키로 대조 벡터를 추가해야 한다. 엔진 변경이므로 승인 후 진행.

## 8. 검증하지 못한 것

- 실제 리플레이 코드 조회와 ID 추출 (계정·코드·네트워크 없음)
- 운영자 계정 하나로 타인 코드 조회가 지금도 되는지
- 운영 계정의 NSO 이용권 필요 여부
- nxapi-auth 클라이언트 등록 승인 기준·이용 조건(공개 웹 서비스 허용 여부)
- 조회한 ID의 초기 상태가 실제 게임과 맞는지(별도 실기록 검증)

## 9. 경로를 증명하기 위한 다음 단계

서버 구축 전에 아래 1–3만으로 "경로 1이 실제로 된다"를 증명할 수 있다.

1. **준비(사용자):** 전용 닌텐도 계정(NSO 이용권), 본인 계정으로 업로드한 리플레이 코드 1개
2. **로컬 실증(사용자 맥에서):** 전용 계정으로 nxapi 로그인 → `nxapi util splatoon3-seed <리플레이코드> --json`. 같은 계정으로 인자 없이 실행하면 본인 ID도 확인 가능(경로 2 교차 확인)
3. **대조:** 얻은 ID를 Leanny에 등록된 키와 비교 → 일치하면 경로 1 증명. 이어서 그 ID로 엔진 초기 상태를 만들어 Leanny 상태 4워드와 비교
4. 증명 후: nxapi-auth 등록 조건 확인 → 최소 서버 설계 → PR #2 `u-` 수정 → 사이트 연결

## 출처

- nxapi (AGPL-3.0): https://github.com/samuelthomas2774/nxapi — `src/cli/util/splatoon3-seed.ts`, `src/cli/splatnet3/user.ts`, `src/api/splatnet3.ts`
- nxapi-znca-api API·인증 문서: https://github.com/samuelthomas2774/nxapi-znca-api/blob/main/docs/api.md , https://github.com/samuelthomas2774/nxapi-znca-api/blob/docs/docs/api-auth.md
- splatnet3-types (npm): https://www.npmjs.com/package/splatnet3-types
- splatoon3-replay-lookup: https://github.com/samuelthomas2774/splatoon3-replay-lookup
- s3s (GPL): https://github.com/frozenpandaman/s3s
- nxapi 상태 페이지: https://nxapi-status.fancy.org.uk/
- Leanny Seed Checker 공개 빌드 소스맵(미러): https://github.com/ToeMunchEnja/splat3seedchecker
