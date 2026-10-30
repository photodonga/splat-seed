# macOS에서 nxapi로 리플레이 코드 → NPLN ID 직접 조회하기

목적: [`replay-npln-lookup.md`](replay-npln-lookup.md)의 **경로 1(리플레이 코드 → NPLN ID)이 실제로 되는지** 사용자가 직접 증명한다. 서버를 만들기 전 단계다.

> 이 안내는 nxapi 소스(`src/cli/nso/auth.ts`, `src/cli/util/splatoon3-seed.ts`, `src/cli/users.ts`)와 문서(README, `docs/cli.md`, 2026-09 기준)를 읽고 작성했다. **작성자는 실행해 보지 못했다.** 실제 화면이나 오류 문구가 다를 수 있다.

## 보안 규칙 (먼저 읽기)

- 로그인하면 터미널에 **`Session token …`이 출력된다.** 계정 자격증명과 같으므로 복사·캡처·공유하지 않는다. 채팅이나 GitHub에도 붙이지 않는다.
- nxapi는 토큰을 `~/Library/Application Support/nxapi-nodejs`에 저장한다. 이 폴더를 저장소로 옮기거나 `--data-path`를 저장소 안으로 지정하지 않는다. (저장소 `.gitignore`에 실수 방지 패턴을 넣어 두었다.)
- nxapi 디버그 로그에는 토큰이 남을 수 있으므로, 모든 명령 앞에 `NXAPI_DEBUG_FILE=0`을 붙여 파일 로그를 끈다.
- 로그인은 **본계정이 아닌 보조 계정**을 권장한다. SplatNet 3 비공식 접근으로 계정이 차단된 사례가 있다(2023).
- 결과 보고에는 `h`(숫자)와 일치 여부만 있으면 된다. NPLN ID 자체도 개인 식별자이므로 공개 저장소에는 올리지 않는다.

## 준비물

| 항목 | 비고 |
|---|---|
| Mac + 터미널 | zsh 기준 |
| Node.js 20 이상 | `node -v`로 확인 |
| 보조 닌텐도 계정 | NSO 이용권 필요로 알려짐(미확인). 스플래툰 3 플레이 이력이 필요한지도 미확인 |
| 본계정으로 업로드한 리플레이 코드 | 게임 → 로비 → 리플레이 업로드 → `XXXX-XXXX-XXXX-XXXX` |
| (대조용) Leanny 백업 파일 | Leanny 설정에서 내보낸 JSON. 안의 `H` 값만 쓴다 |

## 단계

### 1. Node.js 확인
```sh
node -v
```
`v20` 이상이면 다음 단계. 없으면 https://nodejs.org 의 LTS 설치 파일을 받거나, Homebrew가 있으면 `brew install node`.

### 2. nxapi 설치
```sh
npm install --global nxapi
nxapi --version
```
README에 따르면 npm으로 설치한 CLI는 `f` 생성 서버용 클라이언트 등록(nxapi-auth)을 따로 하지 않아도 된다. 권한 오류가 나면 `sudo`를 쓰지 말고 오류 문구를 알려 줄 것.

### 3. 보조 계정으로 로그인
```sh
NXAPI_DEBUG_FILE=0 nxapi nso auth
```
1. 출력된 URL을 브라우저에서 열고 **보조 계정**으로 로그인한다.
2. "외부 계정 연동(Linking an External Account)" 화면에서 **"이 사람을 선택(Select this person)" 버튼을 우클릭 → 링크 주소 복사.** `npf71b963c1b7b6d119://auth`로 시작해야 한다.
3. 터미널의 `Paste the link:`에 붙여 넣는다.
4. `Session token …` 줄이 출력되면 **그대로 두고 공유하지 않는다.** 이어서 `Authenticated as Nintendo Account …`가 나오면 성공.

확인:
```sh
NXAPI_DEBUG_FILE=0 nxapi nso user
```

### 4. SplatNet 3 접근 확인
```sh
NXAPI_DEBUG_FILE=0 nxapi splatnet3 user
```
`Player 이름#번호 …`가 나오면 이 계정으로 SplatNet 3를 쓸 수 있다. 오류가 나면 문구를 그대로 기록한다(NSO 이용권·플레이 이력 문제일 수 있음).

### 5. 리플레이 코드로 조회 (핵심)
```sh
NXAPI_DEBUG_FILE=0 nxapi util splatoon3-seed XXXX-XXXX-XXXX-XXXX --json --no-include-gear
```
성공하면 한 줄 JSON이 나온다.
```json
{"key":"…base64…","h":1234567890,"timestamp":1700000000}
```
- `h` = NPLN ID의 MurmurHash3 값
- `key` = NPLN ID를 `h`의 하위 8비트로 XOR한 뒤 base64로 바꾼 값 (Leanny가 저장하는 형식과 같음)

### 6. NPLN ID 확인 (로컬에서만)
```sh
node -e 'const [k,h]=process.argv.slice(1);const b=Buffer.from(k,"base64");for(let i=0;i<b.length;i++)b[i]^=Number(h)&255;console.log(b.toString())' '여기에_key' 여기에_h
```
`u-`로 시작하는 22자가 나오면 경로 1이 **실제로 동작한 것**이다.

### 7. Leanny와 대조
Leanny 백업 JSON의 `H` 값과 5단계의 `h`가 같으면, 리플레이 코드로 얻은 ID가 Leanny에 등록된 본계정 ID와 같다는 뜻이다.

(선택) SPLAT SEED 쪽 연결 확인: 6단계 ID를 `lab.html`(PR #2 브랜치)의 "NPLN 유저 ID" 칸에 넣고, Leanny의 첫 뽑기 직전 상태로 뽑은 결과를 입력해 위치가 찾아지는지 본다.

### 8. 정리
```sh
NXAPI_DEBUG_FILE=0 nxapi users list          # 저장된 계정 ID 확인
NXAPI_DEBUG_FILE=0 nxapi users forget <ID>   # 해당 계정 데이터 삭제
```
더 쓰지 않을 경우 `~/Library/Application Support/nxapi-nodejs`도 지운다.

## 보고 양식

```
- 3단계 로그인: 성공/실패 (실패 시 오류 문구)
- 4단계 SplatNet 3 접근: 성공/실패 (오류 문구)
- 5단계 조회: 성공/실패 (오류 문구)
- 6단계 결과가 u- + 20자 형식인가: 예/아니오
- 7단계 Leanny H 값과 일치: 예/아니오
- 사용한 계정: 보조 계정 / 본계정
```
토큰, 리플레이 코드, NPLN ID 원문은 보내지 않아도 된다.

## 예상 오류 (소스·문서 기준, 미확인)

| 증상 | 가능한 원인 |
|---|---|
| `Invalid argument` | 리플레이 코드 형식 오류(16자, 하이픈 허용) |
| `Replay not found` 계열 | 코드 오타, 리플레이 삭제/만료 |
| 401 `ERROR_INVALID_GAME_WEB_TOKEN` | SplatNet 3 접근 거부(계정 제한 가능성) |
| `f` 생성·로그인 단계 오류 | 외부 `f` 생성 서비스 장애 또는 NSO 앱 버전 변경 |
| `Unable to find NPLN user ID from replay ID` | 응답 ID 형식이 바뀜 — 경로 1 자체에 영향, 즉시 보고 |

## 이 안내로 증명되는 것 / 안 되는 것

- 증명: 리플레이 코드 하나로 **다른 계정(보조 계정)에서** 업로더의 NPLN ID를 얻을 수 있다 → 운영자 계정 하나로 사용자 코드를 처리하는 서버 구조의 핵심 가정.
- 증명 안 됨: 공개 서비스로 운영할 때의 요청 제한·계정 차단 위험, `f` 생성 서비스의 이용 조건, ID로 만든 초기 상태가 실제 게임과 맞는지(별도 실기록 검증).
