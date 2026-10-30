# SPLAT SEED 글꼴 출처 및 라이선스

이 프로젝트는 Nintendo 또는 Splatoon 3의 실제 게임 글꼴 파일을 포함하지 않습니다. 게임의 역동적인 분위기를 구현하기 위해 공개 웹폰트를 사용합니다.

| 역할 | 글꼴 | 공급처 | 라이선스 |
|---|---|---|---|
| 영문 로고, 황금 캡슐 횟수, 숫자 | [Lilita One](https://fonts.google.com/specimen/Lilita+One) | Google Fonts | SIL OFL 1.1 |
| 한국어 큰 제목 | [Black Han Sans (검은고딕)](https://fonts.google.com/specimen/Black+Han+Sans) | Google Fonts | SIL OFL 1.1 |
| 게임풍 한국어 버튼 및 카드 제목 | [Jua (주아)](https://fonts.google.com/specimen/Jua) | Google Fonts | SIL OFL 1.1 |
| 작은 설명, 일반 영문 UI | [Nunito](https://fonts.google.com/specimen/Nunito) 및 시스템 한글 글꼴 | Google Fonts / OS | SIL OFL 1.1 (Nunito) |

원문 라이선스:
- [Lilita One OFL](https://github.com/google/fonts/blob/main/ofl/lilitaone/OFL.txt)
- [Black Han Sans OFL](https://github.com/google/fonts/blob/main/ofl/blackhansans/OFL.txt)
- [Jua OFL](https://github.com/google/fonts/blob/main/ofl/jua/OFL.txt)
- [Nunito OFL](https://github.com/google/fonts/blob/main/ofl/nunito/OFL.txt)

## 구현 사항

- Google Fonts CSS를 원격 로드합니다. 저장소에 폰트 파일을 추가하거나 재배포하지 않습니다.
- 폰트 로드 실패 시 시스템 기본 글꼴로 대체됩니다.
- 본문 설명은 읽기 쉬운 기존 글꼴 체계를 유지하고 제목, 버튼, 숫자에만 장식용 글꼴을 적용합니다.
- SPLAT SEED는 Nintendo의 공식 제품이 아닙니다. Google Fonts의 글꼴을 사용한다고 Nintendo의 게임 글꼴 사용 허가가 생기는 것은 아닙니다.


## 개인용 실제 게임 폰트 적용 (PR #3)

스플래툰3의 실제 게임용 글꼴 파일은 저작권 및 별도 사용 조건의 적용을 받으므로, 본 저장소에서 파일을 제공하거나 원본을 복제·재배포하지 않습니다.

### 적용 경로

1. 방문자 컴퓨터에 해당 글꼴이 적법하게 설치돼 있다면 CSS `local(...)`을 통해 사용을 시도합니다. 브라우저 개인정보 보호 설정과 글꼴의 실제 내부 이름에 따라 인식되지 않을 수 있습니다.
2. 폰트 파일을 이미 적법하게 보유한 사용자는 SPLAT SEED 하단의 **개인용 게임 원본 폰트 적용** 메뉴에서 4개 영역별로 해당 파일을 직접 선택할 수 있습니다.
3. 선택한 파일은 JavaScript FontFace API로 페이지에 로드하고, 현재 브라우저의 IndexedDB에만 저장해 다음 방문 때 다시 적용합니다. 외부 업로드·네트워크 전송·GitHub 커밋은 수행하지 않습니다.
4. **내 폰트 초기화** 버튼은 저장된 개인용 글꼴만 삭제합니다. 뽑기 기록은 변경하지 않습니다.

| 파일 선택 영역 | 실제 게임 글꼴 표기(참고) | 우선 적용 영역 |
|---|---|---|
| 영문 제목 | BlitzBold | 로고, 잭팟·숫자, 영문 강조 |
| 영문 일반 | BlitzMain | 일반 문구 중 라틴 글자 |
| 한글 제목 | AsiaKCUBE | 제목, 카드, 버튼 |
| 한글 본문 | AsiaKERIN | 설명과 본문 |

**참고:** 위 이름은 기존 게임 글꼴 분석에서 알려진 명칭입니다. 실제 파일 내부 패밀리명이 다를 수 있으므로 설치 글꼴 자동 인식은 보장하지 않습니다. 파일 직접 불러오기 기능이 더 확실한 경로입니다.

파일당 30MB 제한, OTF·TTF·WOFF·WOFF2 형식 지원. 브라우저 저장 정책에 따라 글꼴이 유지되지 않을 수 있습니다. 사용자가 가진 게임 사본만으로 글꼴 추출·재사용·재배포 권한까지 자동으로 생기는 것은 아닙니다.

사용자가 원본 폰트를 제공하지 않거나 설치하지 않은 환경에서는 오픈소스 대체 글꼴이 표시됩니다.
