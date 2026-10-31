# 개인용 게임 원본 이미지 UI — SPLAT SEED

개인 테스트 브랜치: `personal/game-art-leanny-20261101`

이 브랜치는 기존 `feature/unified-flow`의 시드 탐색·추적 기능을 유지하면서 원본 게임 아이콘을 **외부 URL로 표시하는 스타일 실험**이다. Nintendo 이미지 파일 자체를 저장소에 복제하지 않는다.

## 바로 사용 (Mac)

```bash
git clone --branch personal/game-art-leanny-20261101 --single-branch https://github.com/photodonga/splat-seed.git "$HOME/splat-seed-art"
open "$HOME/splat-seed-art/personal-preview.html"
```

독립 파일 `personal-preview.html`에는 엔진과 스타일, 로컬 데이터 입력 UI가 들어 있다. **원본 이미지는 인터넷 연결이 있어야 표시**되며, 접근이 막히면 기존 CSS 색상 캡슐이 보인다.

보상·캡슐 원본 파일을 비교하려면 같은 폴더의 `personal-game-art-gallery.html`을 열면 된다.

```bash
open "$HOME/splat-seed-art/personal-game-art-gallery.html"
```

일부 브라우저가 로컬 `file://`의 모듈 또는 Worker를 제한하면 터미널에서 로컬 서버로 열 수 있다.

```bash
cd "$HOME/splat-seed-art"
python3 -m http.server 8765 --bind 127.0.0.1
```

그 뒤 브라우저에서 `http://127.0.0.1:8765/personal-preview.html`로 접속한다. 서버는 로컬 127.0.0.1에서만 접근 가능하며 종료하려면 Ctrl+C.

## 화면 변경

- 일반 / 페스티벌 6단계 캡슐: `LobbyCapsule_Top_0X` + `LobbyCapsule_Bottom_0X`, 페스티벌은 `Fest0X` 파일을 겹침. 실패 시 `CapsuleIcon_0X` → 기존 CSS 캡슐 순서로 표시.
- 보상 카테고리: 식권, 음료 티켓, 기어 파워 조각, 카드 팩, 배너, 칭호, 이모트, 로커 스티커/피규어 등. **확정되지 않은 개별 아이템의 정확한 보상 그림이 아니라 종류를 구별하기 위한 대표 이미지**다.
- 입력 화면, 위치 후보, 현재/다음 뽑기, 기록 영역에서 이미지 사용. 기존 예측·검색 계산과 상태 저장 방식 불변.
- 원본 파일 브라우징: `personal-game-art-gallery.html`에 해당 분야 이미지 목록 142개. 게임의 모든 리소스를 무분별하게 내려받지 않는다.

## 출처와 이용 범위

- 이미지: https://github.com/Leanny/splat3/tree/main/images
- 참고 구현: https://github.com/Leanny/splat3/blob/main/misc.html (`grade_formatter`의 캡슐 상하단 배치)
- 참조 커밋: `7280ff9cde8bb1c5dcef46c700c326471584d2e6`
- 이미지 관련 권리는 Nintendo 또는 개별 권리자에게 있다. Leanny의 공개 저장소에 포함되어 있다는 사실이 제3자 재배포 허가라는 뜻은 아니다.
- 이 브랜치는 **개인 시험용**이지만, 원본 GitHub 저장소가 공개라면 이 브랜치의 코드도 공개된다. 원본 PNG 파일을 커밋하지 않았어도 외부 링크는 누구나 열 수 있다.
- 리소스는 `raw.githubusercontent.com`에서 가져온다. 이미지 호스팅 정책·네트워크 상태에 따라 로딩에 실패할 수 있다. 앱은 NPLN ID, 세션 토큰, geardata 내용 등을 이미지 URL에 넣지 않는다.
- 외부 이미지 트래픽은 IP 주소 등 일반적인 네트워크 접속 정보가 해당 호스팅 제공자에게 보일 수 있다.

## 보존 범위

- `main` 및 운영 페이지 변경 없음
- PR #2 (`engine/shellout-xorshift128`) 변경·병합 없음
- PR #3 (`design/game-capsule-icons-20261031`) 변경·병합 없음
- 이 브랜치는 `feature/unified-flow` 시점에서 독립 분기. 소스 엔진 `engine/`과 테스트 `tests/` 파일은 수정하지 않았다.

## 시험 미완료 항목

GitHub의 이미지 경로 및 JavaScript 구문은 확인했다. **Mac Safari/Chrome 실기기에서 이미지 크기·상하단 겹침·페스티벌 전환·개별 보상 아이콘 표시를 눈으로 확인한 것은 아직 아니다.** 문제가 보이면 화면 캡처로 수정하되 NPLN ID·토큰·개인 기록은 가리고 공유한다.
