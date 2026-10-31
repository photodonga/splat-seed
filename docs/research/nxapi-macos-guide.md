# macOS 실험 안내: nxapi 리플레이 코드 → NPLN ID 검증

최종 수정: 2026-10-31. 목적은 사용자 Mac에서 **SplatNet 3 리플레이 검색이 실제 작동하는지**, 특히 **조회 계정과 업로더가 달라도 조회되는지** 확인하는 것이다. 현재까지 실제 닌텐도 서버 조회 성공 사례는 이 프로젝트에서 확보하지 못했다.

정적 근거: nxapi v1.6.1의 `src/cli/util/splatoon3-seed.ts`, `src/cli/nso/auth.ts`, `src/cli-entry.ts`, `README.md`, `docs/cli.md`. **여기에 나오는 절차 자체를 이 연구 환경에서 실행한 것은 아니다.** Node 26, 계정별 권한, 현재 닌텐도 인증 및 SplatNet 3 호환 여부는 미검증.

## 빠른 실행 — 로그인만 사용자가 직접 진행

GitHub 저장소의 **연구 브랜치 전체**를 Mac에 받으면 `scripts/nxapi-replay-test.sh`가 각 실행마다 경로를 자동 설정하고, 비공개 JSON 파일로 저장하고, 원본 ID·key·h를 화면에 표시하지 않고 검증한다. `D`·`BASE` 환경변수를 미리 설정할 필요가 없다.

아래 명령은 **자신의 macOS 터미널에서만** 실행한다. AI 에이전트 실행 도구에 맡기지 않는다. 인증 도중 nxapi가 세션 토큰을 화면에 출력하기 때문이다.

```sh
git clone --branch research/replay-npln-lookup --single-branch https://github.com/photodonga/splat-seed.git "$HOME/splat-seed-research"
cd "$HOME/splat-seed-research"
bash scripts/nxapi-replay-test.sh prepare
bash scripts/nxapi-replay-test.sh login-a
```

로그인 완료 후 본인이 직접 업로드한 리플레이 코드로 테스트 A를 진행한다. 예시의 `XXXX-XXXX-XXXX-XXXX`는 **본인 업로드가 확인된 코드**로 바꾼다.

```sh
bash scripts/nxapi-replay-test.sh self-a
bash scripts/nxapi-replay-test.sh replay-a XXXX-XXXX-XXXX-XXXX
bash scripts/nxapi-replay-test.sh compare-a
```

- 결과가 `같음`이면 A의 인증으로 A의 리플레이 업로더 키를 조회·복원하는 경로에 대한 근거가 된다. `비교 불가`는 실패·미실행·빈 파일 등으로, `다름`과 구분한다.
- 조회가 실패하면 기존에 남은 동일 이름의 결과 파일을 먼저 제거해 **과거 성공을 새 성공으로 잘못 판정하지 않는다**. 오류는 `~/splat-seed-test/.nxapi-error.*`에 비공개 저장되므로 **파일을 대화에 업로드하지 않는다**.
- 개인용 결과 검증기는 key/h를 역변환해 `u-` ID 형식과 MurmurHash3 일치까지 로컬에서 확인하고, 화면에는 성공/실패·같음/다름만 표시한다. 이 ID는 출력·전송하지 않는다.
- Node 26 및 현재 인증 서비스 호환성은 실제 Mac에서 검증이 필요하다.

테스트 B를 할 수 있다면, **A 계정으로 B 계정이 업로드한 코드**를 먼저 조회한다.

```sh
bash scripts/nxapi-replay-test.sh replay-other BBBB-BBBB-BBBB-BBBB
bash scripts/nxapi-replay-test.sh login-b
bash scripts/nxapi-replay-test.sh self-b
bash scripts/nxapi-replay-test.sh compare-b
```

B 로그인은 B 본인이 승인한 계정으로만 진행한다. A·B 인증 데이터는 서로 다른 저장 폴더다. 공개된 타인 코드만 있는 경우 `replay-other` 성공 여부는 확인할 수 있어도, B 기준값 없이 **업로더 일치**까지 증명할 수 없다.

실험 현황과 로컬 정리:

```sh
bash scripts/nxapi-replay-test.sh status
bash scripts/nxapi-replay-test.sh cleanup
```

`cleanup`은 삭제 확인 후 `~/splat-seed-test`만 지운다. 닌텐도 서버에 이미 발급된 토큰 무효화 또는 npm 캐시 삭제와는 다르다. 저장소 `~/splat-seed-research` 자체는 지우지 않는다.

아래는 스크립트를 사용하지 않고 **직접 명령을 하나씩 실행하고 싶은 사람을 위한 상세 절차**다.

## 절대 보안 규칙

- `nso auth`는 성공 시 **`Session token`을 터미널에 그대로 출력**한다. 로그인 도중 복사하는 `npf71b963c1b7b6d119://auth...` 링크 역시 인증 자격증명이다. 두 값 모두 ChatGPT·Claude·GitHub·스크린샷·공개 채팅으로 전달하지 말 것.
- 로그인은 **사용자만 직접 연 터미널**에서 할 것. Claude Code의 실행 도구나 공유 셸 로그를 통해 진행하지 말 것. `clear` 또는 터미널의 ⌘K는 화면·스크롤백 노출을 줄이지만 이미 저장된 외부 로그나 유출된 인증 정보까지 되돌리지는 못한다.
- 모든 nxapi 명령에는 `NXAPI_DEBUG_FILE=0` 사용. 이는 **nxapi 디버그 로그 파일을 끌 뿐, 터미널 표준 출력의 토큰을 숨기지는 않는다.**
- 아래 예시는 `--data-path`로 nxapi 저장 위치를 격리한다. 이 안에는 세션 토큰이 들어갈 수 있다. 저장소·클라우드 동기화 폴더·공유 화면에는 두지 않는다.
- `self.json`, `replay.json` 역시 `key`, `h`에 의해 **NPLN ID를 복원할 수 있는 개인정보**이다. 파일 내용이나 `h` 값 자체를 굳이 대화에 붙이지 말 것. 성공/실패 또는 같음/다름만 보고한다.
- 비공식 접속에는 계정 제한 위험이 있다. 본계정이 중요한 경우 별도 실험 계정을 우선 고려한다. 계정 소유자 본인의 승인 없이 로그인하지 말 것.

## 준비

- macOS 터미널(zsh 기준), Node.js와 npm. `node -v`, `npm -v`로 확인.
- npm 전역 설치, `sudo`, `~/.npm-global`, `~/.zshrc` 변경은 **불필요**. `npx --yes nxapi@1.6.1`로 버전을 고정해 실행.
- **본인 리플레이 코드** A: 본인 계정으로 올린 것이 확인된 유효한 코드. 예시로 전달된 `R63Y-EJTM-MPBY-6DXK`가 본인 것인지는 **확인되지 않았다**. 임의로 본인 코드로 간주하지 말 것.
- **다른 계정의 리플레이 코드** B: 가능하면 협조받은 다른 계정이 업로드한 코드와 그 계정의 기준값. 공개된 코드만으로는 타인 업로더 ID가 정확한지까지 검증하지 못한다.
- 새 계정은 NSO 및 SplatNet 3 접근 조건을 충족해야 할 수 있으며 실제 요구 조건은 테스트 전 미확인.

## 0. 실험용 폴더 준비

아래는 사용자 본인의 터미널에서 실행한다. 이 폴더에는 인증 자격증명과 NPLN ID로 복원 가능한 정보가 저장될 수 있다.

```sh
umask 077
BASE="$HOME/splat-seed-test"
D="$BASE/nxapi-data"
mkdir -p "$D"
node -v
npm -v
```

**새 터미널 창이나 새 탭을 열면 `BASE`와 `D` 같은 셸 변수가 사라진다.** 이후 단계의 예제는 해당 경로를 다시 설정하므로 아래 블록을 통째로 실행한다. 명령을 일부만 복사해 `--data-path "$D"`로 실행하지 말 것. `--data-path`를 빈 문자열로 지정했을 때 nxapi가 어디에 토큰을 저장할지는 이 문서에서 확인하지 않았으므로 절대 빈 값으로 실행하지 않는다.

Node 26에서의 호환성은 검증되지 않았다. npm이 외부 패키지를 임시로 받아 실행하므로 nxapi 개발자·npm 공급망을 신뢰해야 한다. `npx` 캐시에는 패키지가 남을 수 있지만 토큰 저장 경로와는 별개다.

## 1. 사용자 본인이 nxapi 로그인 (Claude Code 실행 금지)

```sh
umask 077
BASE="$HOME/splat-seed-test"
D="$BASE/nxapi-data"
mkdir -p "$D"
NXAPI_DEBUG_FILE=0 npx --yes nxapi@1.6.1 --data-path "$D" nso auth
```

1. 터미널에 표시된 로그인 URL을 사용자가 직접 열어 자기 닌텐도 계정으로 로그인.
2. 계정 선택 페이지에서 요구하는 `npf71b963c1b7b6d119://auth...` 리디렉션 링크를 복사해 터미널 프롬프트에 붙여넣음. **이 링크 자체가 자격증명**이다.
3. 성공 시 `Session token`이 터미널에 출력되므로 인증 단계의 전체 출력이나 화면을 공유하지 않음.
4. 필요하면 터미널 스크롤백을 지우되, 화면 지우기가 토큰 폐기·로그 완전 삭제는 아님을 인지할 것.

세션 파일은 `$D`에만 저장하도록 시도한다. 인증 실패 시에도 **링크·토큰·계정 식별자를 가린 오류 종류**만 전달한다.

## 2. SplatNet 3 접근 검사

```sh
umask 077
BASE="$HOME/splat-seed-test"
D="$BASE/nxapi-data"
mkdir -p "$D"
NXAPI_DEBUG_FILE=0 npx --yes nxapi@1.6.1 --data-path "$D" splatnet3 user
```

성공 시 접속 가능성을 확인한 것일 뿐, 리플레이 검색 성공이나 타인 코드 조회 성공을 뜻하지 않는다.

## 3. 테스트 A — 내 계정 ID 대 내 리플레이 업로더 ID

**중요: 본인 업로드임이 확인된 코드만 이 테스트의 자기 리플레이로 사용.** 아래 `XXXX-XXXX-XXXX-XXXX`는 실제로 본인이 발급받은 코드로 교체한다.

```sh
umask 077
BASE="$HOME/splat-seed-test"
D="$BASE/nxapi-data"
mkdir -p "$D"
NXAPI_DEBUG_FILE=0 npx --yes nxapi@1.6.1 --data-path "$D" util splatoon3-seed --json --no-include-gear > "$BASE/self.json"
NXAPI_DEBUG_FILE=0 npx --yes nxapi@1.6.1 --data-path "$D" util splatoon3-seed XXXX-XXXX-XXXX-XXXX --json --no-include-gear > "$BASE/replay.json"
```

- 인자 없는 첫 명령은 내 코디(없으면 대전 기록)에서 **현재 로그인된 계정**의 ID를 얻는다. 코디와 대전 기록이 모두 없으면 실패할 수 있다.
- 두 번째 명령은 해당 리플레이의 업로더 ID를 가져오려고 시도한다.
- 정상 `--json` 출력은 `{ "key": "…", "h": 123, "timestamp": 123 }`과 유사하다. **원본 `u-` 문자열을 출력하지 않는다.**
- `--no-include-gear`에서는 `gear`가 빠질 수 있어 결과를 그대로 Leanny 전체 백업 JSON으로 간주해서는 안 된다.
- 셸의 `>` 출력 리디렉션은 nxapi를 실행하기 **전에 파일을 생성하거나 기존 파일을 비운다**. 따라서 조회 명령이 실패해도 `self.json`·`replay.json`이 빈 파일로 남을 수 있다. **파일의 존재만으로 성공을 판정하지 말 것.** 오류 원인은 조회 명령의 종료 상태와 표준 오류를 확인하되, 민감한 인증 출력은 공유하지 않는다.
- 유효한 `key`·`h` 한 쌍이 양쪽 파일에 모두 있을 때만 아래 비교가 `같음` 또는 `다름`을 출력한다. 빈 파일·깨진 JSON·필드 누락은 `비교 불가`로 처리하고, **값이 다르다는 판정과 구분**한다.

**민감한 결과 내용을 출력하지 않는 비교** (새 터미널이라면 `BASE` 재설정 포함):

```sh
BASE="$HOME/splat-seed-test"
node -e 'const fs=require("node:fs");try{const [a,b]=process.argv.slice(1).map(p=>JSON.parse(fs.readFileSync(p,"utf8")));const valid=x=>x&&typeof x.key==="string"&&x.key.length>0&&Number.isInteger(x.h);if(!valid(a)||!valid(b))throw Error();console.log(a.key===b.key&&a.h===b.h?"같음":"다름")}catch{console.error("비교 불가: 결과 파일이 비었거나 유효한 JSON/key/h가 아닙니다");process.exitCode=1}' "$BASE/self.json" "$BASE/replay.json"
```

'같음'은 **내 계정의 기준값과 해당 리플레이 응답의 업로더 식별값이 일치한다**는 근거다. 이 결과만으로 **다른 사람 리플레이 조회**나 **실제 미래 뽑기 예측**이 검증되지는 않는다.

## 4. 테스트 B — 서로 다른 계정의 리플레이 조회 (핵심)

서로 다른 **계정 A(조회자)**와 **계정 B(업로더)**를 분리해서 검증해야 한다.

1. 계정 B로 본인이 직접 리플레이를 업로드하거나, 협조받은 사람의 공개 코드 사용에 동의받는다.
2. 계정 A 로그인 상태의 위 `$D`로, B가 발급한 리플레이 코드를 조회한다. 별도 파일 `"$BASE/other-replay.json"`에 저장.
3. 계정 B의 기준 `key/h`는 **계정 B 자신이 별도로 인증된 환경**에서 인자 없는 `splatoon3-seed`로 획득한다. 이때 A와 B는 **서로 다른 `--data-path`**를 사용한다. B의 원본 토큰은 A의 실험 폴더에 두지 않는다.
4. B의 기준 `key/h`와 A가 B의 코드를 조회해 얻은 `key/h`를 개인정보 노출 없이 비교한다. **일치해야 업로더 검증까지 충족한다.**
5. 다른 사람의 공개 코드만 조회해 형식에 맞는 `key/h`를 얻었다면 '교차 계정 조회 응답 성공'까지만 확인할 수 있다. B의 정답을 모르면 **업로더 ID 일치까지 증명했다고 보고하지 않는다.**

A/B 로그인 및 기준 수집 명령은 1·3단계를 각 계정에 맞게 반복하면 된다. 세션 토큰 자체는 비교·공유하지 않는다.

## 5. 일회성 테스트 정리

실험 결과를 복사·백업할 필요가 없다면, 해당 폴더의 자격증명과 변환된 ID 파일을 안전하게 정리한다. `rm`은 복구가 어려우므로 경로를 먼저 확인한다.

```sh
printf '%s\n' "$BASE"
# 위 출력이 정확히 /Users/<내 계정>/splat-seed-test 인 경우에만:
rm -r -- "$HOME/splat-seed-test"
```

계정 B에 별도 위치를 설정했다면 그 데이터 경로도 직접 확인 후 정리한다. 실험 폴더 삭제가 닌텐도 서버에서 이미 발급된 인증 토큰을 무효화하는 것은 아니다. **설치된 npm 패키지 캐시는 별도로 남을 수 있다.**

## 보고 양식 — 비밀값 공개 금지

```text
- Node / nxapi 실행: 성공 또는 실패(민감 정보 제거한 오류 종류)
- 로그인: 성공 또는 실패
- SplatNet 3 user 조회: 성공 또는 실패
- 테스트 A (자기 기준값과 자기 리플레이): 같음 / 다름 / 미실행
- 테스트 B (타인 리플레이에 대한 다른 계정 조회): 조회 성공 / 실패 / 미실행
- 테스트 B (B 업로더 기준값과 정확히 일치): 같음 / 다름 / 정답 미확보
- 실제 게임 뽑기 예측과 비교: 아직 미검증 / 별도로 검증
```

## 결과 해석과 한계

- 테스트 A에서 일치하더라도 타인 코드 조회 가능성을 증명하지 않는다.
- 테스트 B에서 **조회 성공 + 업로더 B 기준값과 일치**하면, A의 인증으로 다른 계정의 리플레이를 조회할 수 있다는 첫 실증 근거가 된다.
- **이 테스트를 통과해도 공개 서비스 운영 가능성, 닌텐도 이용 조건, 계정 정지·요청 제한, nxapi 인증 장기 유지, 게임 예측 정확도는 별도 검토 대상**이다.
- nxapi 실행 시 `f` 서비스 접근·닌텐도 인증 문제와 Node 버전 문제가 발생할 수 있다. 오류가 발생하면 민감한 출력 대신 오류 *종류*만 보고한다.
- Node 26이 호환되지 않으면 지원되는 Node LTS 환경을 별도로 검토한다. `npx -p node@22 -p nxapi@1.6.1` 형태는 별도 확인 전까지 검증된 대체 명령이라고 안내하지 않는다.

## 참고 소스

- https://github.com/samuelthomas2774/nxapi/blob/main/src/cli/util/splatoon3-seed.ts
- https://github.com/samuelthomas2774/nxapi/blob/main/src/cli/nso/auth.ts
- https://github.com/samuelthomas2774/nxapi/blob/main/src/cli-entry.ts
- https://github.com/samuelthomas2774/nxapi/blob/main/README.md
- https://github.com/samuelthomas2774/nxapi/blob/main/docs/cli.md
