"""Offline preflight contract tests."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("preflight",Path(__file__).with_name("model-preflight.py"))
preflight=importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)

class PreflightTests(unittest.TestCase):
    def test_missing_models_report_not_ready(self):
        result=preflight.check_environment({"PIPER_EXECUTABLE":"not-installed-piper","PIPER_MODEL_PATH":"/missing/voice.onnx"})
        self.assertFalse(result["piper_model"])
        self.assertFalse(result["asr_model"])
        self.assertFalse(result["tts_24khz"])
    def test_voice_config_rate_is_checked(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"voice.onnx"
            path.write_bytes(b"test")
            Path(str(path)+".json").write_text(json.dumps({"audio":{"sample_rate":22050}}))
            with patch.object(preflight.shutil,"which",return_value="/bin/piper"):
                result=preflight.check_environment({"PIPER_MODEL_PATH":str(path),"AIVAULT_VOICE_TOKEN":"x"*32})
            self.assertTrue(result["piper_model"])
            self.assertTrue(result["piper_config"])
            self.assertFalse(result["tts_24khz"])
    def test_empty_weights_are_not_ready(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"voice.onnx"
            path.touch()
            result=preflight.check_environment({"PIPER_MODEL_PATH":str(path)})
            self.assertFalse(result["piper_model"])
    def test_asr_requires_model_weights(self):
        with tempfile.TemporaryDirectory() as folder:
            result=preflight.check_environment({"ASR_MODEL_PATH":folder})
            self.assertFalse(result["asr_model"])
            (Path(folder)/"model.bin").write_bytes(b"test")
            result=preflight.check_environment({"ASR_MODEL_PATH":folder})
            self.assertTrue(result["asr_model"])
    def test_matching_rate_is_accepted(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"voice.onnx"
            path.write_bytes(b"test")
            Path(str(path)+".json").write_text(json.dumps({"audio":{"sample_rate":24000}}))
            with patch.object(preflight.shutil,"which",return_value="/bin/piper"):
                result=preflight.check_environment({"PIPER_MODEL_PATH":str(path),"AIVAULT_VOICE_TOKEN":"x"*32})
            self.assertTrue(result["tts_24khz"])

if __name__=="__main__":unittest.main()
