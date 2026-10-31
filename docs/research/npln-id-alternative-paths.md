# NPLN ID 확보 — 대체 경로 조사 (2차)

조사일 2026-10-31. 공개 소스코드·문서 기준 정적 조사. **닌텐도 서버에 실제 요청은 하지 않았다.**

판정 기준
- **실제 ID 추출 가능**: 공개·무인증 데이터에서 `u-` ID가 나오는 것을 근거로 확인
- **조건부 가능**: 인증된 API 내부에는 있으나 공개 공유물에는 없음, 또는 특정 조건(자기 계정 로그인 등)에서만
- **근거 없음**: ID가 들어 있다는 근거를 찾지 못함

## 요약

| # | 경로 | 판정 | 핵심 근거 |
|---|---|---|---|
| 1 | 오징어링3 대전 상세 공유 링크 | 근거 없음 (공개 링크) / 조건부 (인증 API) | 확인된 앱 공유 링크는 `?p=/replay?code=…`(리플레이 코드만). 공유 기능은 앱 네이티브 공유(문구+이미지 URL). 대전 ID(`VsHistoryDetail-u-…`)는 인증된 API 응답에만 확인 |
| 2 | 마이 코디 공유 이미지 | 근거 없음 (샘플로 확인 가능) | `useShareMyOutfitQuery`는 `image.url` 하나만 반환. URL 형식·이미지 메타데이터에 ID가 있는지 공개 자료 없음. `MyOutfit-u-…` ID는 인증 API 내부 |
| 3 | 닌텐도 대회 서포트(Tournament Manager) | 근거 없음 | 오징어링3/앱에서 여는 서비스. 공개된 것은 도움말 페이지뿐, 공개 프로필·참가자 URL 형식 자료 없음 |
| 4 | stat.ink | 근거 없음 | s3s는 `splatnet_json`(원본 ID 포함)을 보내지만 stat.ink v3 `PostBattleForm`은 이를 받기만 하고 저장·노출하는 코드가 없음. 공개 API는 stat.ink 자체 UUID, 클라이언트 UUID(`<시각>_<uuid>`만 해시, `u-` 제외), 이름#번호만 |
| 5 | ID 없는 상태 복원 (SAT/SMT) | 조건부 (미검증) | 정보량 하한 약 40회(아이템 입력), 현행 선형 방식 57~94회. SAT 실험은 중단되어 결과 없음 |
| 6 | NPLN `Replay.ResolveReplayCode` | 근거 없음 (정상 경로로 사용 불가) | RPC는 존재. 반환 Document에 업로더 ID가 있는지 미확인. 모든 NPLN 토큰(익명 포함)이 스위치 기기 인증 기반 BaaS 토큰을 요구 |

## 1. 대전 상세 공유 링크
- 앱 공유 링크 형식: `https://s.nintendo.com/av5ja-lp1/znca/game/4834290508791808?p=<앱 내부 경로>`. 문서로 확인된 경로는 리플레이(`/replay?code=…`)뿐 (nxapi Discussion #11, splatoon3-replay-lookup).
- 오징어링3 웹앱의 공유는 `invokeNativeShare({text, image_url, hashtags})`(이미지 공유)와 `invokeNativeShareUrl({url, text})` 두 가지 (nxapi `znca-js-api.ts`). 대전 상세가 어느 쪽을 쓰는지, URL에 대전 ID가 들어가는지는 자료 없음.
- **확인 방법**: 앱에서 대전 상세 → 공유 → 나온 문구/링크를 그대로 확인.

## 2. 마이 코디 공유 이미지
- `useShareMyOutfitQuery` → `myOutfitShare.image.url`만 반환 (splatnet3-types). 공유 시 앱이 이미지를 내려받아 공유 시트로 넘김.
- 이미지 URL에 ID가 들어가는지, PNG/JPEG 메타데이터에 남는지 공개 자료 없음.
- **확인 방법**: 코디 공유로 받은 이미지 원본 파일을 받아 메타데이터 검사.

## 3. 대회 서포트
- Inkipedia·닌텐도 도움말: 오징어링3 홈의 버튼과 전용 웹으로 접근. 대회 검색은 앱에서만.
- 공개 URL은 `c.nintendo.com/splatoon3-tournament/help/…` 도움말만 확인. 참가자 식별자 노출 자료 없음.

## 4. stat.ink
- s3s: `payload["uuid"] = uuid5(NAMESPACE, full_id[-52:])` — `<YYYYMMDD>T<HHMMSS>_<uuid>` 부분만 사용, `u-` 제외. `payload["splatnet_json"] = json.dumps(battle)`(원본 ID 포함)도 전송.
- stat.ink (`fetus-hina/stat.ink` HEAD): `models/api/v3/PostBattleForm.php`에서 `splatnet_json`은 속성 선언과 `'safe'` 검증 규칙에만 등장. 저장하는 코드 없음. 공개 API 포매터(`BattleApiFormatter`, `BattlePlayerApiFormatter`)는 `uuid`, `client_uuid`, `number`(이름 뒤 번호)만 출력.
- 과거 버전에서 저장했는지, 내부 DB에 남는지는 확인하지 않음(공개 노출 근거 없음).

## 5. ID 없는 상태 복원
- 정보량: 보상 행의 엔트로피 약 3.26비트/회(아이템 입력 시) → 128비트에 **최소 약 40회**. 기어 파워 종류(14가지)까지 쓰면 +약 0.9비트 → 약 31회(단, 번호→기어 파워 대응표 미검증). 색만 입력하면 약 1.5비트/회이고 추가 난수 소비가 갈려 훨씬 불리.
- 현행 선형 방식(확정 상위 비트만 사용): 시뮬레이션 300회, 57~94회(중간값 77), 복원 상태 전부 일치.
- SAT/SMT: 구간 제약(`lo ≤ 상위 23비트 ≤ hi`)을 그대로 넣으면 버리던 정보까지 쓰므로 50회 전후 가능성. 비슷한 사례(브라우저 xorshift128+ 상태를 잘린 출력에서 z3로 복원)는 알려져 있으나 이 문제에서 **실험하지 못함**(실행 중단).
- 브라우저 실행: z3 wasm은 수십 MB로 아이폰에 무거움. 자체 "추측 후 결정" 탐색이 현실적이나 미구현.

## 6. NPLN `ResolveReplayCode`
- `nn.npln.toyohr.v1.Replay`에 `RegisterDocument`, `ResolveReplayCode`, `FulfillReservations` 존재 (NPLN-Protocols `latest/proto/toyohr/v1/replay.proto`). `latest` 폴더는 **수동 디컴파일**이라 필드 의미는 추정 포함.
- 요청: `string name` 하나(형식 미확인 — 코드 자체인지 리소스 경로인지 모름). 응답: `ugcstore.v1.Document {name, fields(MapValue), create_time, update_time}`. 업로더 ID 포함 여부 **미확인**. (오징어링3 리플레이 ID가 `Replay-u-…:코드`인 점은 서버가 업로더로 색인한다는 정황일 뿐.)
- 인증(NintendoClients wiki): 모든 요청에 `npln-tenant-id`(스플래툰3 `t-dce9377b-lp1`). 토큰은 Auth 서비스에서 발급되며 **익명 토큰(`IssueAnonymousUserToken`)조차 `nsa_id_token`을 요구**. `nsa_id_token`은 BaaS 로그인으로 얻고, BaaS 로그인은 스위치 기기 인증(dauth) 토큰과 기기 계정이 필요. 21.0.0 이후 BaaS는 유효한 클라이언트 인증서만 허용.
- 결론: 일반 PC 서버에서 정상 절차로 접근할 방법이 없음. 실제 스위치의 기기 인증 정보를 꺼내 쓰는 방식은 기기 정지 위험과 인증 우회 문제로 **검토 대상에서 제외**. f 생성 서비스를 피할 수는 있어도, 닌텐도 인증은 오징어링3 경로보다 더 어렵다.

## 다음 확인 (사용자 휴대폰으로 가능)
1. 앱에서 대전 상세 공유 → 공유 문구/링크 형태
2. 마이 코디 공유 이미지 원본 파일 → 메타데이터 검사

## 출처
- https://github.com/kinnay/NintendoClients/wiki/NPLN-Servers , Auth-Service, Switch-Tokens, BAAS-Server
- https://github.com/kinnay/NPLN-Protocols (latest/proto/toyohr/v1/replay.proto, ugcstore/v1/resources.proto, auth/v1/auth.proto)
- https://github.com/samuelthomas2774/nxapi (src/app/preload-webservice/znca-js-api.ts, Discussion #11)
- https://www.npmjs.com/package/splatnet3-types (useShareMyOutfitQuery, PhotoAlbum)
- https://github.com/frozenpandaman/s3s (s3s.py)
- https://github.com/fetus-hina/stat.ink (models/api/v3/PostBattleForm.php, components/formatters/api/v3/*)
- https://splatoonwiki.org/wiki/Tournament_Manager , https://c.nintendo.com/splatoon3-tournament/help
