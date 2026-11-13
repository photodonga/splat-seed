"""Stage the same-machine Node executable and the published nxapi npm package.

Requires: Node 22 installed on the developer/build machine and
'npm install --prefix npln-connect/runtime --omit=dev nxapi@1.6.1' already run.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import stat
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime"
NODE_NAME = "node.exe" if os.name == "nt" else "node"
NXAPI_LICENSE_URL = "https://raw.githubusercontent.com/samuelthomas2774/nxapi/v1.6.1/LICENSE"


def stage() -> None:
    node_path = shutil.which("node")
    if not node_path:
        raise SystemExit("Node 22 is required on the build computer.")
    node_src = Path(node_path).resolve()
    npm_pkg = RUNTIME / "node_modules" / "nxapi"
    cli = npm_pkg / "bin" / "nxapi.js"
    if not cli.is_file():
        raise SystemExit("nxapi is missing. Run npm install --prefix npln-connect/runtime nxapi@1.6.1")
    manifest = json.loads((npm_pkg / "package.json").read_text(encoding="utf-8"))
    if manifest.get("version") != "1.6.1":
        raise SystemExit("Wrong nxapi version; expected 1.6.1.")
    RUNTIME.mkdir(parents=True, exist_ok=True)
    dst = RUNTIME / NODE_NAME
    shutil.copy2(node_src, dst)
    if os.name != "nt":
        dst.chmod(dst.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    # Include upstream's complete AGPL license, not just a URL.
    license_dest = RUNTIME / "NXAPI-LICENSE.txt"
    with urlopen(NXAPI_LICENSE_URL, timeout=25) as response:
        license_dest.write_bytes(response.read())
    if license_dest.stat().st_size < 1000:
        raise SystemExit("Unable to obtain complete nxapi license.")

    node_license = next(
        (ancestor / "LICENSE" for ancestor in (node_src.parent, node_src.parent.parent)
         if (ancestor / "LICENSE").is_file()), None
    )
    if node_license:
        shutil.copy2(node_license, RUNTIME / "NODE-LICENSE.txt")

    (RUNTIME / "THIRD-PARTY-NOTICE.txt").write_text(
        "nxapi 1.6.1 - AGPL-3.0-or-later\n"
        "Source: https://github.com/samuelthomas2774/nxapi/tree/v1.6.1\n"
        "Full nxapi license: NXAPI-LICENSE.txt\n"
        "Node.js - https://github.com/nodejs/node\n"
        "This application uses nxapi's published npm build, not a source rebuild.\n",
        encoding="utf-8",
    )
    print("Staged Node and nxapi, including license notice.")


if __name__ == "__main__":
    stage()
