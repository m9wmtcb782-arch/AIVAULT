"""Unit tests for local Piper adapter; no model or paid API needed."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("local_piper_tts", pathlib.Path(__file__).with_name("local-piper-tts.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PiperTests(unittest.TestCase):
    def test_unavailable_model_fails_closed(self):
        engine = module.LocalPiperTTS(executable="nonexistent-piper-binary", model_path="/not/installed.onnx")
        self.assertFalse(engine.available)
        with self.assertRaisesRegex(RuntimeError, "TTS_MODEL_UNAVAILABLE"):
            engine.synthesize("你好")

    def test_rejects_non_24k_request(self):
        engine = module.LocalPiperTTS(executable="nonexistent-piper-binary", model_path="/not/installed.onnx")
        with patch.object(type(engine), "available", property(lambda self: True)):
            with self.assertRaisesRegex(ValueError, "UNSUPPORTED_SAMPLE_RATE"):
                engine.synthesize("你好", sample_rate=16000)

if __name__ == "__main__":
    unittest.main()
