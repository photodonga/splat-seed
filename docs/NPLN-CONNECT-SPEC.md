# NPLN CONNECT — Portable Helper Design

Status: design draft  
Target: SPLAT SEED companion utility  
Platforms: Windows 10/11 x64, macOS Apple Silicon + Intel (separate builds initially)  
Distribution: portable packages; no system-wide installation


## Implementation status (2026-11-02)

This design has an experimental implementation at
\`npln-connect/npln_connect.py\` and native build tooling at
\`npln-connect/build_portable.py\`.

- **Chosen implementation:** Python 3.12 / Tkinter + PyInstaller, with a
  bundled Node.js 22 runtime and **published nxapi 1.6.1** package.
  This replaces the earlier Tauri proposal for this prototype.
- **Login UX:** Local nxapi CLI is spawned with piped stdin/stdout, so no
  terminal window is intended. Nintendo's HTTPS login URL is opened by a
  button, and the sensitive npf:// authentication callback URL is forwarded
  to the local nxapi subprocess. The callback is not saved by this GUI.
- **Packaging:** A build script is committed, but Windows/macOS binary
  production and native smoke tests have **not** been completed.
- **nxapi data processing:** nxapi uses remote authentication helper services
  for certain Nintendo-issued tokens. The original local-only description
  was too strong; see upstream documentation.
- **Critical gate:** The exact output of \`nxapi splatnet3 user\` and the
  viability of its login interaction through piped stdio are still unverified
  against an authenticated account.
- **Distribution:** nxapi uses AGPL-3.0-or-later; a public binary release
  needs license/source compliance review. macOS app signing/notarization is
  not yet done.

Do **not** label this as a finished portable release until these checks pass.

## Decision

Build a small cross-platform desktop helper named **NPLN CONNECT**. It is a separate companion to the existing static SPLAT SEED web app, not a rewrite of SPLAT SEED and not a browser extension.

The helper uses the nxapi project locally to authenticate to Nintendo Switch Online/SplatNet 3 and read the authenticated SplatNet 3 user. It displays only the NPLN user ID and provides a **Copy ID** action. The user pastes the ID into the existing SPLAT SEED input.

No automatic browser-to-helper bridge is in scope for v1.

## User flow

1. Download the package matching the user's OS.
2. Run it directly (Windows: portable \`.exe\`; macOS: \`.app\` in a ZIP).
3. Click **Nintendo Account 로그인**. The helper launches nxapi's supported interactive authentication flow.
4. After authentication, click **NPLN ID 확인**.
5. The helper invokes the supported nxapi SplatNet 3 user command and extracts the NPLN ID from the returned user data.
6. Display the ID in a selectable field and a **복사** button.
7. User returns to SPLAT SEED, pastes the ID into its existing NPLN ID field, and continues.

## nxapi integration

Use documented nxapi commands rather than scraping SplatNet 3 pages or using the third-party replay-lookup service:

- Authentication: \`nxapi nso auth\`
- Read authenticated SplatNet 3 user: \`nxapi splatnet3 user\`

The nxapi CLI documentation describes both commands:
https://github.com/samuelthomas2774/nxapi/blob/main/docs/cli.md

The SPLAT SEED engine expects the exact NPLN ID format \`u-\` plus 20 lowercase alphanumeric characters. Preserve the \`u-\` prefix; do not normalize it away.

**Do not assume the CLI's human-readable output field name.** Before implementing extraction, capture and fixture-test the actual output from a currently working nxapi version on Windows and macOS. Prefer a documented JSON output mode if the command supports it; otherwise parse a narrowly scoped, version-tested output format and fail closed when it changes.

## Packaging recommendation

Initial prototype uses Tkinter/PyInstaller (not Tauri), bundling Node.js and the published nxapi npm package as separate subprocess components:

- Windows x64: portable folder/ZIP containing the app executable and bundled nxapi runtime/dependencies.
- macOS: ZIP containing an app bundle and bundled nxapi runtime/dependencies. Initially build/test Apple Silicon and Intel separately; consider a universal build only after dependency compatibility is proven.

The user should not need to install Node.js, npm, Rust, or nxapi separately. Build tooling is developer-only.

Before packaging nxapi, review its current license, redistribution requirements, and upstream update mechanism. Pin a tested nxapi version and expose that version in the helper's About/diagnostics view.

A portable build still needs OS-specific distribution handling. macOS signing/notarization and Gatekeeper behavior must be tested; do not promise that an unsigned downloaded app will open with a simple double-click.

## Security and privacy requirements

- Nintendo login/authentication stays inside nxapi's supported flow.
- Never ask the user to paste a Nintendo password, session token, or access token into SPLAT SEED or NPLN CONNECT.
- Never transmit credentials or tokens to SPLAT SEED, GitHub Pages, analytics, or a project-owned server.
- Keep nxapi's authentication data in its documented local data directory; explain where it is stored and how to remove it.
- Do not log token-bearing stdout/stderr. Redact sensitive output from diagnostic logs.
- Only the validated NPLN ID is displayed/copied to the clipboard.
- Clipboard action is user initiated. No automatic paste or browser injection.

## UI outline

Single compact window:

1. Header: NPLN CONNECT / \`SPLAT SEED companion\`
2. Status: \`nxapi 준비 확인\` / \`Nintendo Account 연결 필요\` / \`연결됨\`
3. Primary action: \`Nintendo Account 로그인\`
4. Secondary action: \`NPLN ID 확인\`
5. Result panel: masked or visible ID field, \`복사\` button
6. Help: \`SPLAT SEED로 돌아가 ID 붙여넣기\`
7. Diagnostics: nxapi version, app version, last operation result; never show secrets

Errors must be actionable and plain-language: nxapi missing/corrupt, login cancelled, NSO/SplatNet 3 access unavailable, network/service error, unexpected output format, invalid ID format.

## SPLAT SEED integration (v1)

Keep the current static web app and its existing ID input/storage behavior. Add a concise help panel beside the manual ID input:

- \`NPLN ID가 없나요?\`
- \`NPLN CONNECT 사용 방법\`
- Download links for Windows and macOS packages (add only after release artifacts exist)
- Steps: launch helper → sign in → copy ID → paste here

Do not add a localhost HTTP server, custom browser protocol, browser extension, or automatic clipboard reader in v1. This avoids local network permissions, origin/CORS issues, and unnecessary credential exposure.

## Acceptance criteria

- A clean Windows test machine with no Node.js/npm/nxapi installed can run the portable package and obtain the current account's NPLN ID.
- A clean macOS test machine with no Node.js/npm/nxapi installed can do the same.
- Both builds preserve the \`u-\` prefix and pass the SPLAT SEED input validator.
- No credential/token is written to app logs or sent to the SPLAT SEED website.
- Copy works; paste into SPLAT SEED succeeds; the seed setup flow continues without changing the engine or saved-state schema.
- Authentication cancellation, offline mode, service failure, and unexpected nxapi output fail safely with a useful message.
- Releasing a new nxapi version requires a fixture/update test before packaging.

## Out of scope for v1

- Automatic browser-to-helper communication.
- Automatic account login inside SPLAT SEED.
- A hosted replay-code lookup service.
- Reimplementing Nintendo authentication or SplatNet 3 API calls.
- Changing the seed engine, local save keys, or checkpoint format.

## Open implementation checks

1. Capture real \`nxapi splatnet3 user\` output and confirm the exact NPLN ID property/format.
2. Verify whether the installed nxapi CLI offers a stable JSON mode for this command.
3. Confirm nxapi redistribution license and package contents.
4. Confirm supported Node runtime and native dependencies for Windows/macOS.
5. Test current authentication flow and SplatNet 3 access on both operating systems.
