#!/usr/bin/env bash
# SPLAT SEED / private replay-code NPLN lookup experiment
# Run directly in your own macOS Terminal, never through an AI command runner.
set -euo pipefail
umask 077

BASE="$HOME/splat-seed-test"
AUTH_A="$BASE/nxapi-account-a"
AUTH_B="$BASE/nxapi-account-b"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
VERIFY="$SCRIPT_DIR/verify-nxapi-json.mjs"

help_text() {
  cat <<'HELP'
사용법: bash scripts/nxapi-replay-test.sh <명령> [리플레이코드]

  prepare                   격리 폴더/환경 확인
  login-a                   조회 계정 A 로그인 (토큰 화면 출력 주의)
  self-a                    A의 기준 key/h를 비공개 파일로 저장
  replay-a <CODE>           A가 직접 업로드한 리플레이 조회
  compare-a                 A 기준과 A 리플레이 결과 비교
  replay-other <CODE>       계정 A로 계정 B의 리플레이 조회
  login-b                   계정 B 별도 로그인 (토큰 화면 출력 주의)
  self-b                    B 기준 key/h 별도 저장
  compare-b                 B 기준과 A가 조회한 B 리플레이 결과 비교
  status                    개인 결과 파일 상태 (민감정보 표시 안 함)
  cleanup                   실험 폴더 삭제 (서버 토큰 무효화는 아님)

계정 A/B의 인증 데이터는 서로 다른 --data-path 에 저장됩니다.
NPLN ID, key, h, 인증 토큰은 화면에 출력하지 않습니다.
단, login-a/login-b는 nxapi 자체가 Session token을 표시합니다.
HELP
}

prepare() {
  if [[ -L "$BASE" ]]; then
    echo '오류: 실험 경로가 심볼릭 링크여서 중단합니다.' >&2
    exit 1
  fi
  mkdir -p -- "$AUTH_A" "$AUTH_B"
  chmod 700 -- "$BASE" "$AUTH_A" "$AUTH_B"
  if ! command -v node >/dev/null 2>&1 || ! command -v npx >/dev/null 2>&1; then
    echo 'Node.js 와 npx 가 필요합니다.' >&2
    exit 1
  fi
  if [[ ! -f "$VERIFY" ]]; then
    echo '검증 스크립트가 누락되었습니다. 연구 브랜치 전체를 받아주세요.' >&2
    exit 1
  fi
}

nxapi() {
  local data_path="$1"
  shift
  NXAPI_DEBUG_FILE=0 npx --yes nxapi@1.6.1 --data-path "$data_path" "$@"
}

login() {
  local account="$1" data_path="$AUTH_A"
  if [[ "$account" == 'b' ]]; then data_path="$AUTH_B"; fi
  if [[ ! -t 0 || ! -t 1 ]]; then
    echo '보안상 사용자 본인의 인터랙티브 터미널에서만 로그인할 수 있습니다.' >&2
    exit 1
  fi
  echo '주의: 아래 nxapi 명령이 Session token을 터미널 화면에 출력합니다.'
  echo '이 화면이나 인증 링크를 촬영·공유하지 마세요. AI 실행 도구에서는 진행하지 마세요.'
  nxapi "$data_path" nso auth
}

lookup() {
  local account_path="$1" filename="$2"
  shift 2
  local outfile="$BASE/$filename.json"
  local temp_file error_file
  # A failed retry must never leave a previously successful result in place.
  rm -f -- "$outfile"
  temp_file="$(mktemp "$BASE/.nxapi-output.XXXXXXXX")"
  error_file="$(mktemp "$BASE/.nxapi-error.XXXXXXXX")"
  if nxapi "$account_path" util splatoon3-seed "$@" --json --no-include-gear >"$temp_file" 2>"$error_file"; then
    if node "$VERIFY" validate "$temp_file" >/dev/null 2>&1; then
      mv -f -- "$temp_file" "$outfile"
      rm -f -- "$error_file"
      echo "조회 성공 / 형식 검증 성공: $filename (원본 값 숨김)"
    else
      rm -f -- "$temp_file"
      echo "조회 응답 검증 실패: 비공개 오류 파일 $error_file 확인 (내용 공유 금지)" >&2
      return 1
    fi
  else
    rm -f -- "$temp_file"
    echo "nxapi 조회 실패: 비공개 오류 파일 $error_file 확인 (내용 공유 금지)" >&2
    return 1
  fi
}

check_code() {
  if [[ $# -ne 1 ]]; then
    echo '리플레이 코드 1개가 필요합니다.' >&2
    exit 1
  fi
  local compact="${1^^}"
  compact="${compact//-/}"
  if [[ ! "$compact" =~ ^[A-Z0-9]{16}$ ]]; then
    echo '리플레이 코드는 숫자/영문 16자리여야 합니다 (하이픈 허용).' >&2
    exit 1
  fi
  REPLAY_CODE="$compact"
}

status() {
  local f label
  for label in self-a replay-a replay-b-from-a self-b; do
    f="$BASE/$label.json"
    if [[ ! -f "$f" ]]; then
      printf '%s: 미실행/결과 없음\n' "$label"
    elif node "$VERIFY" validate "$f" >/dev/null 2>&1; then
      printf '%s: 검증된 결과 보유\n' "$label"
    else
      printf '%s: 비교 불가 (손상된 파일)\n' "$label"
    fi
  done
}

cleanup() {
  if [[ ! -t 0 ]]; then
    echo '대화형 터미널에서만 삭제할 수 있습니다.' >&2
    exit 1
  fi
  echo "삭제 대상: $BASE"
  echo '실험 폴더 삭제가 닌텐도 서버에 발급된 토큰을 무효화하지는 않습니다.'
  printf '정말 삭제하려면 DELETE를 입력하세요: '
  local answer
  read -r answer
  if [[ "$answer" != 'DELETE' ]]; then
    echo '삭제 취소'
    return
  fi
  if [[ "$BASE" != "$HOME/splat-seed-test" || ! -d "$BASE" || -L "$BASE" ]]; then
    echo '삭제 경로 검증 실패' >&2
    return 1
  fi
  rm -rf -- "$BASE"
  echo '로컬 실험 폴더 삭제 완료 (원격 인증 토큰과 npm 캐시는 별도)'
}

main() {
  local mode="${1:-help}"
  if [[ "$mode" == 'help' || "$mode" == '--help' ]]; then help_text; return; fi
  if [[ "$mode" == 'cleanup' ]]; then cleanup; return; fi
  prepare
  case "$mode" in
    prepare)
      echo "실험 준비 완료. 파일 위치: $BASE (계정별 인증 폴더 분리)"
      ;;
    login-a) login a ;;
    login-b) login b ;;
    self-a) lookup "$AUTH_A" self-a ;;
    self-b) lookup "$AUTH_B" self-b ;;
    replay-a)
      check_code "${2:-}"
      lookup "$AUTH_A" replay-a "$REPLAY_CODE"
      ;;
    replay-other)
      check_code "${2:-}"
      lookup "$AUTH_A" replay-b-from-a "$REPLAY_CODE"
      ;;
    compare-a)
      node "$VERIFY" compare "$BASE/self-a.json" "$BASE/replay-a.json"
      ;;
    compare-b)
      node "$VERIFY" compare "$BASE/self-b.json" "$BASE/replay-b-from-a.json"
      ;;
    status) status ;;
    *) echo "알 수 없는 명령: $mode" >&2; help_text; exit 2 ;;
  esac
}

main "$@"
