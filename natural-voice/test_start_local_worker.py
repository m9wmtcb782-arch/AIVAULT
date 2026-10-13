"""Guarded launcher tests: no model, GPU, or network calls."""
import importlib.util
import os
import types
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("voice_launcher", Path(__file__).with_name("start-local-worker.py"))
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)

class LauncherTests(unittest.TestCase):
    def test_tts_only_starts_without_asr_weights(self):
        checks = {key: True for key in ("piper_executable", "piper_model", "piper_config",
                    "voice_token", "tts_supported_rate", "tts_mandarin")}
        checks["asr_model"] = False
        fake_preflight = types.SimpleNamespace(check_environment=lambda: checks)
        fake_uvicorn = types.SimpleNamespace(run=lambda *args, **kwargs: None)
        with patch.object(launcher.importlib.util, "module_from_spec", return_value=fake_preflight), \
             patch.object(launcher.importlib.util, "spec_from_file_location", return_value=types.SimpleNamespace(loader=types.SimpleNamespace(exec_module=lambda module: None))), \
             patch.dict(sys.modules, {"uvicorn": fake_uvicorn}), \
             patch.object(launcher.os, "chdir"), \
             patch.dict(os.environ, {"ASR_MODEL_PATH": "/missing/asr"}):
            self.assertEqual(launcher.main(["--tts-only"]), 0)
            self.assertNotIn("ASR_MODEL_PATH", os.environ)
            self.assertEqual(launcher.main([]), 2)

    def test_missing_models_fail_closed(self):
        with patch.dict(os.environ, {"PIPER_MODEL_PATH":"/nonexistent/model.onnx",
                                     "ASR_MODEL_PATH":"/nonexistent/asr",
                                     "AIVAULT_VOICE_TOKEN":""}):
            self.assertEqual(launcher.main([]), 2)

if __name__ == "__main__":
    unittest.main()
