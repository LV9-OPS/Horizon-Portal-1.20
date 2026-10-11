import os
import tempfile
import unittest
import zipfile
from pathlib import Path

os.environ.setdefault("HORIZON_ENV", "development")

from app.security import hash_password, verify_password, valid_installation_id, issue_installation_credential, hash_credential
from app.workshop_security import validate_filename, validate_zip
from app.ratelimit import enforce_rate_limit

class SecurityV1Tests(unittest.TestCase):
    def test_password_length_and_hash(self):
        hashed = hash_password("A-strong-password-123")
        self.assertTrue(verify_password("A-strong-password-123", hashed))
        self.assertFalse(verify_password("wrong-password", hashed))
        with self.assertRaises(ValueError):
            hash_password("short")

    def test_installation_credential(self):
        installation_id, credential = issue_installation_credential()
        self.assertTrue(valid_installation_id(installation_id))
        self.assertNotEqual(credential, installation_id)
        self.assertEqual(len(hash_credential(credential)), 64)

    def test_unsafe_filenames_rejected(self):
        with self.assertRaises(Exception):
            validate_filename("../evil.zip")
        with self.assertRaises(Exception):
            validate_filename("payload.exe")

    def test_zip_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "bad.zip"
            with zipfile.ZipFile(path, "w") as z:
                z.writestr("../evil.txt", "bad")
            with self.assertRaises(Exception):
                validate_zip(path)

    def test_zip_executable_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "bad.zip"
            with zipfile.ZipFile(path, "w") as z:
                z.writestr("run.exe", "bad")
            with self.assertRaises(Exception):
                validate_zip(path)

    def test_rate_limit(self):
        key = "security-test-rate-limit"
        for _ in range(5):
            enforce_rate_limit(key, "redeem")
        with self.assertRaises(Exception):
            enforce_rate_limit(key, "redeem")

if __name__ == "__main__":
    unittest.main()
