# NPLN CONNECT (development prototype)

This is **not** a portable release yet. It is a cross-platform Python Tkinter
prototype for testing the UI, nxapi command execution, ID extraction and copy
workflow on Windows and macOS.

## Start (development)

Requirements: Python 3.10+ with Tkinter, and nxapi installed and available on
PATH. Download/use nxapi from its upstream:
https://github.com/samuelthomas2774/nxapi

From this folder:

\`\`\`sh
python3 npln_connect.py
python3 -m unittest discover -s tests -v
\`\`\`

The **Login** action launches nxapi's interactive authentication in the system
terminal; it does not accept account passwords or authentication URLs.
The **Check ID** action runs \`nxapi splatnet3 user\` without printing raw
output. Only a unique exact \`u-\` plus 20-character ID is accepted.
The **Copy ID** button copies that ID for manual paste into SPLAT SEED.

## Unverified / limitations

- The nxapi user's actual stdout shape and ID availability have **not** been
  tested against an authenticated account. The command may not expose the NPLN
  ID in its output; if so, extraction will correctly reject it.
- nxapi is **not bundled**. This prototype does not satisfy the requested
  "no-install executable" distribution yet.
- Windows/macOS smoke tests and code signing/notarization are pending.
- This prototype uses a terminal for the interactive nxapi login. A
  terminal-free upstream authentication integration is pending research.
- No Nintendo credentials or session tokens are stored by this GUI, but nxapi
  may store authentication data in its own local data directory.
- Do not distribute an executable until nxapi licensing, version pinning,
  authentication UX, real-world output, and clean-machine tests are finished.

See \`../docs/NPLN-CONNECT-SPEC.md\`.
