"""NPLN CONNECT: early desktop GUI prototype for local nxapi.

This source prototype expects nxapi on PATH. Bundled portable releases are NOT
built yet. User credentials are handled only by nxapi's official auth flow.
"""
from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
import threading
import tkinter as tk
from tkinter import messagebox, ttk

ID_PATTERN = re.compile(r"(?<![a-z0-9-])u-[a-z0-9]{20}(?![a-z0-9])")
SPLAT_SEED = "https://photodonga.github.io/splat-seed/"


def extract_npln_id(output: str) -> str:
    """Accept exactly one distinct valid NPLN ID, never guess between accounts."""
    matches = set(ID_PATTERN.findall(output))
    if len(matches) != 1:
        raise ValueError(
            "조회 결과에서 NPLN ID를 하나만 확인할 수 없습니다. "
            "현재 nxapi 출력 형식을 점검해야 합니다."
        )
    return next(iter(matches))


def resolve_nxapi() -> str | None:
    return shutil.which("nxapi") or shutil.which("nxapi.cmd")


def open_auth_terminal() -> None:
    """Run nxapi's own interactive auth in a real terminal, without token logging."""
    if not resolve_nxapi():
        raise RuntimeError("nxapi 실행 파일을 찾을 수 없습니다. 이 개발용 빌드에는 nxapi가 필요합니다.")
    system = platform.system()
    if system == "Windows":
        subprocess.Popen(
            ["cmd.exe", "/c", "start", "NPLN CONNECT - nxapi login",
             "cmd.exe", "/k", "nxapi nso auth"],
            creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0),
        )
    elif system == "Darwin":
        # AppleScript only starts nxapi in Terminal. It never collects credentials.
        subprocess.run(
            ["osascript", "-e",
             'tell application "Terminal" to do script "nxapi nso auth"'],
            check=True, timeout=15, capture_output=True,
        )
    else:
        raise RuntimeError("현재 시제품은 Windows와 macOS만 지원합니다.")


def fetch_id() -> str:
    command = resolve_nxapi()
    if not command:
        raise RuntimeError("nxapi를 찾을 수 없습니다. 현재 시제품은 nxapi 별도 설치가 필요합니다.")
    # Never show/log raw stdout or stderr: it may contain credentials.
    completed = subprocess.run(
        [command, "splatnet3", "user"], capture_output=True,
        text=True, encoding="utf-8", errors="replace", timeout=90,
        shell=False,
    )
    if completed.returncode != 0:
        raise RuntimeError("계정 조회에 실패했습니다. 로그인 및 네트워크 연결을 확인하세요.")
    return extract_npln_id(completed.stdout)


class Window(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("NPLN CONNECT — SPLAT SEED")
        self.geometry("440x310")
        self.minsize(410, 280)
        self.id_value: str | None = None
        frame = ttk.Frame(self, padding=22)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="NPLN CONNECT", font=("Arial", 20, "bold")).pack(anchor="w")
        ttk.Label(frame, text="SPLAT SEED용 사용자 ID 확인 · 개발용 시제품").pack(anchor="w", pady=(3, 16))
        ttk.Button(frame, text="1. Nintendo Account 로그인", command=self.login).pack(fill="x", pady=4)
        ttk.Button(frame, text="2. NPLN ID 확인", command=self.lookup).pack(fill="x", pady=4)
        self.id_var = tk.StringVar(value="ID를 확인하면 여기에 표시됩니다.")
        entry = ttk.Entry(frame, textvariable=self.id_var, state="readonly")
        entry.pack(fill="x", pady=(14, 5))
        self.copy_button = ttk.Button(frame, text="3. ID 복사", command=self.copy)
        self.copy_button.pack(fill="x")
        self.status = tk.StringVar(value="nxapi 준비됨" if resolve_nxapi() else "nxapi 없음 · 개발용 빌드")
        ttk.Label(frame, textvariable=self.status, wraplength=390).pack(anchor="w", pady=(12, 3))
        ttk.Label(frame, text="로그인 토큰을 이 앱에 붙여넣지 마세요.", wraplength=390).pack(anchor="w")

    def login(self) -> None:
        try:
            open_auth_terminal()
            self.status.set("nxapi 로그인 터미널이 열렸습니다. 완료 후 ID 확인을 누르세요.")
        except Exception as exc:
            messagebox.showerror("로그인 실행 실패", str(exc))

    def lookup(self) -> None:
        self.status.set("nxapi에서 사용자 정보 조회 중...")
        def worker() -> None:
            try:
                result = fetch_id()
            except Exception as exc:
                self.after(0, lambda err=str(exc): self.status.set(err))
                return
            self.after(0, lambda: self.show_id(result))
        threading.Thread(target=worker, daemon=True).start()

    def show_id(self, user_id: str) -> None:
        self.id_value = user_id
        self.id_var.set(user_id)
        self.status.set("ID를 확인했습니다. 복사 후 SPLAT SEED에 붙여넣으세요.")

    def copy(self) -> None:
        if not self.id_value:
            messagebox.showinfo("확인 필요", "먼저 NPLN ID를 확인하세요.")
            return
        self.clipboard_clear()
        self.clipboard_append(self.id_value)
        self.update()
        self.status.set("ID를 복사했습니다. SPLAT SEED의 직접 입력 칸에 붙여넣으세요.")


if __name__ == "__main__":
    Window().mainloop()
