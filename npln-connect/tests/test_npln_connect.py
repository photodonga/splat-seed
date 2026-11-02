import unittest

from npln_connect import extract_npln_id


class NplnExtractionTest(unittest.TestCase):
    ID = "u-0123456789abcdefghij"

    def test_extract_plain(self):
        self.assertEqual(extract_npln_id("user: " + self.ID), self.ID)

    def test_extract_json_text(self):
        self.assertEqual(extract_npln_id('{"nplnUserId":"' + self.ID + '"}'), self.ID)

    def test_repeated_same_id(self):
        self.assertEqual(extract_npln_id(self.ID + " " + self.ID), self.ID)

    def test_missing(self):
        with self.assertRaises(ValueError):
            extract_npln_id("no user ID")

    def test_ambiguous(self):
        with self.assertRaises(ValueError):
            extract_npln_id(self.ID + " u-abcdefghij0123456789")

    def test_invalid_extra_character(self):
        with self.assertRaises(ValueError):
            extract_npln_id(self.ID + "z")


if __name__ == "__main__":
    unittest.main()
