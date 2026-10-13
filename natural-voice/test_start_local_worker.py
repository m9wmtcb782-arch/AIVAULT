"""Guarded launcher tests: no model, GPU, or network calls."""
import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("voice_launcher", Path(__file__).with_name("start-local-worker.py"))
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)

class LauncherTests(unittest.TestCase):
    def test_missing_models_fail_closed(self):
        with patch.dict(os.environ, {"PIPER_MODEL_PATH":"/nonexistent/model.onnx",
                                     "ASR_MODEL_PATH":"/nonexistent/asr",
                                     "AIVAULT_VOICE_TOKEN":""}):
            self.assertEqual(launcher.main(), 2)

if __name__ == "__main__":
    unittest.main()
