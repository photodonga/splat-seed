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
