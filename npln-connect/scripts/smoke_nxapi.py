"""Check published nxapi CLI can start without an account or external browser."""
from __future__ import annotations

import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime"
node = RUNTIME / ("node.exe" if os.name == "nt" else "node")
cli = RUNTIME / "node_modules" / "nxapi" / "bin" / "nxapi.js"
env = os.environ.copy()
env["NXAPI_SKIP_UPDATE_CHECK"] = "1"
env["NXAPI_DEBUG_FILE"] = "0"
env.pop("DEBUG", None)
if not node.is_file() or not cli.is_file():
    raise SystemExit("Runtime missing.")
p = subprocess.run([str(node), str(cli), "--help"], env=env,
                   capture_output=True, text=True, errors="replace", timeout=60)
if p.returncode:
    raise SystemExit("nxapi CLI failed to start (output suppressed for safety).")
print("nxapi --help smoke test passed (authentication not tested).")
