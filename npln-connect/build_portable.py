"""Build an unzip-and-run Windows/macOS package for NPLN CONNECT.

Build hosts must be native Windows or macOS, with Python 3.12, npm and Node 22.
Users of the resulting package do NOT need Python, npm or Node installed.

This builds an *experimental* package. Account authentication and user ID output
still require real-world verification. macOS artifact is unsigned/notarized.
"""
from __future__ import annotations

import os
import importlib.util
from pathlib import Path
import platform
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
REPOSITORY = ROOT.parent


def run(*args: str) -> None:
    print("Running build step:", args[0], "(arguments omitted)")
    subprocess.run(args, cwd=REPOSITORY, check=True)


def build() -> Path:
    system = platform.system()
    if system not in ("Windows", "Darwin"):
        raise SystemExit("Only Windows and macOS can build their native packages.")
    if sys.version_info[:2] != (3, 12):
        raise SystemExit("Python 3.12 is required on the build computer.")
    if not shutil.which("node") or not shutil.which("npm"):
        raise SystemExit("Node 22 and npm are required on the build computer.")

    version = subprocess.check_output(["node", "--version"], text=True).strip()
    if not version.startswith("v22."):
        raise SystemExit("Node 22 required; found " + version)
    if importlib.util.find_spec("PyInstaller") is None:
        raise SystemExit("Install PyInstaller 6.16.0 on the build computer first.")

    npm = "npm.cmd" if os.name == "nt" else "npm"
    run(npm, "install", "--prefix", str(ROOT / "runtime"), "--no-save",
        "--omit=dev", "--no-fund", "nxapi@1.6.1")
    run(sys.executable, str(ROOT / "scripts" / "stage_runtime.py"))
    run(sys.executable, str(ROOT / "scripts" / "smoke_nxapi.py"))
    run(sys.executable, "-m", "unittest", "discover", "-s",
        str(ROOT / "tests"), "-v")
    run(sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean",
        "--onedir", "--windowed", "--name", "NPLN-Connect",
        "--add-data", str(ROOT / "runtime") + os.pathsep + "runtime",
        str(ROOT / "npln_connect.py"))
    run(sys.executable, str(ROOT / "scripts" / "check_bundle.py"))

    dist = REPOSITORY / "dist"
    arch = "arm64" if platform.machine().lower() in ("arm64", "aarch64") else "x64"
    target = dist / f"NPLN-Connect-{'Windows' if os.name == 'nt' else 'macOS'}-{arch}.zip"
    if os.name == "nt":
        directory = dist / "NPLN-Connect"
        if not directory.is_dir():
            raise SystemExit("Expected Windows onedir package not found.")
        base = shutil.make_archive(str(target.with_suffix("")), "zip",
                                   root_dir=dist, base_dir="NPLN-Connect")
        target = Path(base)
    else:
        app = dist / "NPLN-Connect.app"
        if not app.is_dir():
            raise SystemExit("Expected macOS application bundle not found.")
        run("ditto", "-c", "-k", "--sequesterRsrc", "--keepParent",
            str(app), str(target))

    print("Built experimental package:", target)
    return target


if __name__ == "__main__":
    build()
