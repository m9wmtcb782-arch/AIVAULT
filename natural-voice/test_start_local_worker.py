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

    def test_invalid_port_rejected(self):
        with patch.dict(os.environ, {"AIVAULT_VOICE_PORT":"invalid",
                                     "AIVAULT_VOICE_BIND":"127.0.0.1"}):
            with patch.object(launcher, "ROOT", Path(__file__).parent):
                original = importlib.util.spec_from_file_location
                class Ready:
                    @staticmethod
                    def check_environment():
                        return dict.fromkeys(("piper_executable","piper_model","piper_config",
                            "voice_token","tts_24khz","tts_mandarin","asr_model"),True)
                with patch.object(importlib.util, "module_from_spec", return_value=Ready()):
                    with patch.object(importlib.util, "spec_from_file_location", side_effect=lambda *args: original(*args)):
                        self.assertEqual(launcher.main(),4)

if __name__ == "__main__":
    unittest.main()
