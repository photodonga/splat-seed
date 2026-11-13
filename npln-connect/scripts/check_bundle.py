"""Check that PyInstaller bundled node, nxapi CLI, and licenses."""
from __future__ import annotations
from pathlib import Path
import os

dist = Path("dist")
if not dist.is_dir():
    raise SystemExit("Missing dist/")
names = ["node.exe" if os.name == "nt" else "node", "nxapi.js",
         "NXAPI-LICENSE.txt", "THIRD-PARTY-NOTICE.txt"]
for name in names:
    matches = list(dist.rglob(name))
    if not matches:
        raise SystemExit("Missing packaged file: " + name)
    print(name, "OK", len(matches))
print("Static package structure validated; account/login still unverified.")
