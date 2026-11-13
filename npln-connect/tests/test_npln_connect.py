"""Pure tests with synthetic data. Never require a Nintendo account."""
import os
from pathlib import Path
import sys
import subprocess
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from npln_connect import extract_npln_id, login_url, nxapi_environment, read_id


class ExtractTests(unittest.TestCase):
    USER_ID = "u-0123456789abcdefghij"

    def test_plain_id(self):
        self.assertEqual(extract_npln_id("user: " + self.USER_ID), self.USER_ID)

    def test_json_style(self):
        self.assertEqual(extract_npln_id('{"nplnUserId":"' + self.USER_ID + '"}'), self.USER_ID)

    def test_same_id_twice(self):
        self.assertEqual(extract_npln_id(self.USER_ID + " " + self.USER_ID), self.USER_ID)

    def test_missing(self):
        with self.assertRaises(ValueError):
            extract_npln_id("no user ID")

    def test_two_players_fail_closed(self):
        with self.assertRaises(ValueError):
            extract_npln_id(self.USER_ID + " u-abcdefghij0123456789")

    def test_malformed_longer_id(self):
        with self.assertRaises(ValueError):
            extract_npln_id(self.USER_ID + "X")

    def test_uppercase_id_rejected(self):
        with self.assertRaises(ValueError):
            extract_npln_id("u-ABCDEFGHIJ0123456789")

    def test_nintendo_login_url(self):
        s = "Open https://accounts.nintendo.com/connect/1.0.0/authorize?client_id=x now"
        self.assertEqual(
            login_url(s),
            "https://accounts.nintendo.com/connect/1.0.0/authorize?client_id=x",
        )

    def test_non_nintendo_host_rejected(self):
        self.assertIsNone(login_url("https://evil.accounts.nintendo.com/login"))
        self.assertIsNone(login_url("http://accounts.nintendo.com/login"))

    def test_debug_log_disabled(self):
        self.assertEqual(nxapi_environment()["NXAPI_DEBUG_FILE"], "0")

    @patch("npln_connect.nxapi_command", return_value=["fake-nxapi"])
    @patch("npln_connect.subprocess.run")
    def test_read_id_from_successful_cli(self, mocked_run, mocked_command):
        mocked_run.return_value = subprocess.CompletedProcess(
            args=["fake-nxapi"], returncode=0,
            stdout="User info: " + self.USER_ID, stderr="sensitive output"
        )
        self.assertEqual(read_id(), self.USER_ID)
        args, kwargs = mocked_run.call_args
        self.assertEqual(args[0], ["fake-nxapi", "splatnet3", "user"])
        self.assertEqual(kwargs["shell"], False)
        self.assertEqual(kwargs["env"]["NXAPI_DEBUG_FILE"], "0")

    @patch("npln_connect.nxapi_command", return_value=["fake-nxapi"])
    @patch("npln_connect.subprocess.run")
    def test_cli_error_never_displays_secrets(self, mocked_run, mocked_command):
        mocked_run.return_value = subprocess.CompletedProcess(
            args=["fake-nxapi"], returncode=1, stdout="SECRET_TOKEN",
            stderr="SECRET_TOKEN"
        )
        with self.assertRaises(RuntimeError) as result:
            read_id()
        self.assertNotIn("SECRET_TOKEN", str(result.exception))


if __name__ == "__main__":
    unittest.main()
