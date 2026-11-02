"""NPLN CONNECT - portable GUI for nxapi (Windows/macOS).

No Nintendo credential or callback URL is logged, saved, or sent to SPLAT SEED.
nxapi itself may use third-party authentication helpers; see its documentation.
"""
from __future__ import annotations

import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import ttk
from urllib.parse import urlsplit
import webbrowser

NPLN_RE = re.compile(r"(?<![A-Za-z0-9-])u-[a-z0-9]{20}(?![A-Za-z0-9-])")
NINTENDO_URL_RE = re.compile(r"https://accounts\.nintendo\.com/[^\s<>\"'\x1b]+")
APP_URL = "https://photodonga.github.io/splat-seed/"


def extract_npln_id(text: str) -> str:
    """Accept exactly one unique matching user ID and retain its u- prefix."""
    candidates = set(NPLN_RE.findall(text))
    if len(candidates) != 1:
        raise ValueError("NPLN ID를 하나만 확인하지 못했습니다. nxapi 출력 형식을 확인해야 합니다.")
    return candidates.pop()


def login_url(text: str) -> str | None:
    """Only allow Nintendo's official HTTPS login host."""
    for match in NINTENDO_URL_RE.finditer(text):
        url = match.group(0).rstrip(".,);]")
        parsed = urlsplit(url)
        if parsed.scheme == "https" and parsed.hostname == "accounts.nintendo.com":
            return url
    return None


def bundled_runtime_dir() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) / "runtime"


def nxapi_command() -> list[str]:
    """Prefer the bundled Node.js + published nxapi npm package."""
    runtime = bundled_runtime_dir()
    node = runtime / ("node.exe" if os.name == "nt" else "node")
    cli = runtime / "node_modules" / "nxapi" / "bin" / "nxapi.js"
    if node.is_file() and cli.is_file():
        return [str(node), str(cli)]
    if cmd := shutil.which("nxapi"):
        return [cmd]
    # Development-only fallback. Portable builds must provide bundled runtime.
    if os.name == "nt" and (cmd := shutil.which("nxapi.cmd")):
        return [cmd]
    raise FileNotFoundError("nxapi 실행 파일이 없습니다. 포터블 패키지를 확인하세요.")


def nxapi_environment() -> dict[str, str]:
    env = os.environ.copy()
    # Upstream warns that its debug logs can include Nintendo access tokens.
    env["NXAPI_DEBUG_FILE"] = "0"
    env["NXAPI_USER_AGENT"] = "npln-connect/0.2.0 (+https://github.com/photodonga/splat-seed)"
    env.pop("DEBUG", None)
    return env


def popen_flags() -> dict:
    return {"creationflags": getattr(subprocess, "CREATE_NO_WINDOW", 0)} if os.name == "nt" else {}


def read_id() -> str:
    try:
        result = subprocess.run(
            nxapi_command() + ["splatnet3", "user"],
            input="", capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=120, shell=False,
            env=nxapi_environment(), **popen_flags()
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("조회 시간이 초과됐습니다. 네트워크를 확인하세요.") from exc
    if result.returncode:
        # Never display raw stdout/stderr: they may contain secrets.
        raise RuntimeError("nxapi 조회 실패. 로그인과 SplatNet 3 이용 가능 여부를 확인하세요.")
    return extract_npln_id(result.stdout)


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("NPLN CONNECT · SPLAT SEED")
        self.geometry("500x420")
        self.minsize(460, 390)
        self._auth: subprocess.Popen | None = None
        self._auth_link: str | None = None
        self._id: str | None = None
        self._busy = False
        self.protocol("WM_DELETE_WINDOW", self.close)

        panel = ttk.Frame(self, padding=(22, 18))
        panel.pack(fill="both", expand=True)
        ttk.Label(panel, text="NPLN CONNECT", font=("Arial", 22, "bold")).pack(anchor="w")
        ttk.Label(panel, text="SPLAT SEED 사용자 ID 연결", foreground="#666666").pack(anchor="w", pady=(0, 17))
        self.start_btn = ttk.Button(panel, text="1. Nintendo 계정 인증 시작", command=self.start_auth)
        self.start_btn.pack(fill="x", pady=4)
        self.open_btn = ttk.Button(panel, text="Nintendo 로그인 페이지 열기", command=self.open_auth_link, state="disabled")
        self.open_btn.pack(fill="x", pady=4)
        ttk.Label(panel, text="Nintendo 인증 후 반환된 npf...://auth 링크를 아래에 붙여넣으세요.", wraplength=450).pack(anchor="w", pady=(7, 3))
        self.callback_entry = ttk.Entry(panel, show="●")
        self.callback_entry.pack(fill="x")
        self.send_btn = ttk.Button(panel, text="인증 링크 전달 (로컬 nxapi)", command=self.submit_auth, state="disabled")
        self.send_btn.pack(fill="x", pady=(5, 12))
        self.query_btn = ttk.Button(panel, text="2. NPLN ID 확인", command=self.lookup)
        self.query_btn.pack(fill="x", pady=4)
        self.id_var = tk.StringVar(value="조회 후 ID가 나타납니다")
        ttk.Entry(panel, textvariable=self.id_var, state="readonly").pack(fill="x", pady=(7, 4))
        self.copy_btn = ttk.Button(panel, text="3. ID 복사", command=self.copy_id, state="disabled")
        self.copy_btn.pack(fill="x")
        ttk.Button(panel, text="SPLAT SEED 열기", command=lambda: webbrowser.open(APP_URL)).pack(fill="x", pady=(10, 4))
        try:
            nxapi_command()
            status = "준비 완료"
        except FileNotFoundError:
            status = "nxapi 실행 파일을 찾지 못했습니다."
        self.status = tk.StringVar(value=status)
        ttk.Label(panel, textvariable=self.status, wraplength=450, foreground="#444444").pack(anchor="w", pady=(7, 0))

    def _status(self, value: str) -> None:
        self.after(0, lambda: self.status.set(value))

    def start_auth(self) -> None:
        if self._auth and self._auth.poll() is None:
            self.status.set("이미 인증 진행 중입니다.")
            return
        try:
            self._auth = subprocess.Popen(
                nxapi_command() + ["nso", "auth"], stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                encoding="utf-8", errors="replace", bufsize=1,
                shell=False, env=nxapi_environment(), **popen_flags()
            )
        except OSError:
            self.status.set("nxapi 실행 실패. 실행 파일과 권한을 확인하세요.")
            return
        self._auth_link = None
        self.open_btn.config(state="disabled")
        self.send_btn.config(state="normal")
        self.status.set("인증 준비 중입니다. 로그인 링크가 나타나면 열어주세요.")
        threading.Thread(target=self._watch_auth, args=(self._auth,), daemon=True).start()

    def _watch_auth(self, process: subprocess.Popen) -> None:
        # Read without exposing secret-bearing upstream output.
        history = ""
        try:
            assert process.stdout is not None
            while chunk := process.stdout.read(1):
                history = (history + chunk)[-12000:]
                # Wait for the URL delimiter so a partial URL is never opened.
                if not self._auth_link and (chunk.isspace() or chunk in "\"'<>\x1b"):
                    link = login_url(history)
                    if link:
                        self._auth_link = link
                        self.after(0, lambda: self.open_btn.config(state="normal"))
                        self._status("Nintendo 로그인 페이지를 열고 인증 링크를 붙여넣으세요.")
            code = process.wait()
            if process is self._auth:
                self._status("인증 완료. ID 확인을 누르세요." if code == 0 else
                             "인증이 완료되지 않았습니다. 다시 시도하세요.")
        except (OSError, ValueError):
            self._status("인증 프로세스가 종료됐습니다.")
        finally:
            if process is self._auth:
                self.after(0, lambda: self.send_btn.config(state="disabled"))

    def open_auth_link(self) -> None:
        if self._auth_link:
            webbrowser.open(self._auth_link)

    def submit_auth(self) -> None:
        redirect = self.callback_entry.get().strip()
        self.callback_entry.delete(0, tk.END)
        if not redirect.startswith("npf") or "://auth" not in redirect or len(redirect) > 8192:
            self.status.set("Nintendo가 반환한 npf...://auth 링크인지 확인하세요.")
            return
        if not self._auth or self._auth.poll() is not None or self._auth.stdin is None:
            self.status.set("먼저 계정 인증 시작을 눌러주세요.")
            return
        try:
            self._auth.stdin.write(redirect + "\n")
            self._auth.stdin.flush()
            self.send_btn.config(state="disabled")
            self.status.set("로컬 nxapi에 인증 링크 전달 완료. 확인 중...")
        except OSError:
            self.status.set("nxapi가 종료됐습니다. 인증을 다시 시작하세요.")

    def lookup(self) -> None:
        if self._busy:
            return
        self._busy = True
        self.query_btn.config(state="disabled")
        self.status.set("SplatNet 3 사용자 정보 조회 중...")

        def worker() -> None:
            try:
                value = read_id()
            except (OSError, ValueError, RuntimeError) as exc:
                msg = str(exc)
                self.after(0, lambda: self._lookup_done(None, msg))
            else:
                self.after(0, lambda: self._lookup_done(value, None))
        threading.Thread(target=worker, daemon=True).start()

    def _lookup_done(self, value: str | None, error: str | None) -> None:
        self._busy = False
        self.query_btn.config(state="normal")
        self._id = value
        self.id_var.set(value if value else "조회 후 ID가 나타납니다")
        self.copy_btn.config(state="normal" if value else "disabled")
        self.status.set(error or "ID 확인 완료. 복사한 뒤 SPLAT SEED에 붙여넣으세요.")

    def copy_id(self) -> None:
        if self._id:
            self.clipboard_clear()
            self.clipboard_append(self._id)
            self.update()
            self.status.set("ID를 복사했습니다. SPLAT SEED에 붙여넣으세요.")

    def close(self) -> None:
        if self._auth and self._auth.poll() is None:
            self._auth.terminate()
        self.destroy()


if __name__ == "__main__":
    App().mainloop()
