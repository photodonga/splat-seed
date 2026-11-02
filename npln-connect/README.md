# NPLN CONNECT — Windows / macOS portable companion

**Status: prototype / not tested against a real Nintendo Account.**

NPLN CONNECT is a one-window helper for checking the authenticated SplatNet 3
NPLN user ID with upstream **nxapi** and copying the result to the SPLAT SEED
website. Unlike the website, the helper must run locally on Windows or macOS.

## What the app does

1. **Nintendo 계정 인증 시작** — launches the published nxapi CLI locally, in
   the background, without a terminal window.
2. **Nintendo 로그인 페이지 열기** — opens the Nintendo URL detected from
   nxapi's CLI stdout. Only the official accounts.nintendo.com host is allowed.
3. After the Nintendo login flow, paste the returned
   **npf...://auth callback link** into the masked input. Click
   **인증 링크 전달**. The input is forwarded to the local nxapi child process.
   The helper does not save or log the link.
4. **NPLN ID 확인** — runs nxapi's documented
   \`nxapi splatnet3 user\` command.
5. **ID 복사** — only a unique value matching
   \`u-\` plus 20 lowercase alphanumeric characters is accepted.
6. Paste the ID in SPLAT SEED's existing NPLN ID box.

This does **not** call the third-party replay-lookup server and does not
automatically communicate with a browser.

## What remains unverified

- The exact output of \`nxapi splatnet3 user\` with an actual authenticated
  account. It is *not yet proven* that the CLI returns an NPLN ID in a
  directly parseable form.
- Whether nxapi's interactive CLI correctly accepts an authentication redirect
  URL over the GUI's pipe (instead of a terminal TTY).
- Authentication against current Nintendo services, on Windows and macOS.
- Clean-machine launching, OS signing/notarization and universal support.

Unit tests use synthetic inputs and mock CLI output. They do not prove a real
Nintendo login or NPLN lookup.

## Build a portable ZIP (on a developer machine)

On **Windows 10/11 x64** or **macOS**:

- Python 3.12 with Tkinter
- Node.js 22 and npm
- PyInstaller **6.16.0**
- Internet access for npm packages and the upstream nxapi license

Install PyInstaller for the build machine:

\`\`\`bash
python -m pip install "pyinstaller==6.16.0"
\`\`\`

From the repository root run:

\`\`\`bash
python npln-connect/build_portable.py
\`\`\`

The build script installs **published nxapi 1.6.1** into a temporary staging
directory, copies the local Node binary, verifies the CLI starts, runs tests,
builds a PyInstaller GUI, includes the AGPL license and third-party notice,
then archives the package in \`dist/\`.

**The end user does not have to install Python, Node.js or npm.** The ZIP
contains a runtime and nxapi. However, this packaging process has not yet
been run on real Windows/macOS machines. It must not be called a finished
release until that validation succeeds.

- Windows result: \`NPLN-Connect-Windows-x64.zip\`, containing an executable
  and the accompanying \`_internal\` folder. Keep them together.
- macOS result: \`NPLN-Connect-macOS-arm64.zip\` or
  \`NPLN-Connect-macOS-x64.zip\`, containing an app bundle.

The macOS app is currently **unsigned and not notarized**, so Gatekeeper may
block it. Do not recommend bypassing macOS security settings to casual users;
sign and notarize for a public release.

The GUI source can also be run without building with:

\`\`\`bash
python npln-connect/npln_connect.py
\`\`\`

This development-only route expects an existing nxapi command on PATH.

## Security and privacy

- Nintendo passwords must only be entered on Nintendo's own login site.
- The **npf...://auth** callback is a sensitive credential. Never send it to
  anyone or post it in chat. The helper forwards it only to a locally spawned
  nxapi process.
- NPLN CONNECT does not save passwords, callback URLs or auth tokens and does
  not send them to SPLAT SEED. It disables nxapi's debug file logging.
- **Upstream nxapi is not entirely offline.** Its SplatNet 3 authentication
  flow normally sends certain Nintendo-issued tokens to a third-party
  authentication helper service. Read upstream's privacy/security explanation
  before use: https://github.com/samuelthomas2774/nxapi#why-is-data-sent-to-non-nintendo-servers
- nxapi also stores authentication state locally under its documented
  OS-specific user data path. This is independent of the portable ZIP.
- This tool is unofficial and uses Nintendo's non-public services through
  a third-party implementation. It may stop working when the service changes.

## License and attribution

nxapi is **AGPL-3.0-or-later** and its bundled binary/dependencies must be
distributed with the full license and relevant source/attribution information.
The build includes \`NXAPI-LICENSE.txt\` and
\`THIRD-PARTY-NOTICE.txt\`. Review all combined-distribution obligations
before making a public release.

nxapi source: https://github.com/samuelthomas2774/nxapi  
CLI docs: https://github.com/samuelthomas2774/nxapi/blob/main/docs/cli.md  
SPLAT SEED: https://photodonga.github.io/splat-seed/

Nintendo, Splatoon and their marks belong to their owners.
