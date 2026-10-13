"""Host readiness report tests; no models or provider API calls."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("host_readiness",Path(__file__).with_name("host-readiness.py"))
host=importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)

class ReadinessTests(unittest.TestCase):
    def test_missing_models_report_blocked(self):
        with patch.object(host,"load_preflight") as load:
            load.return_value.check_environment.return_value={
                "piper_executable":False,"piper_model":False,"asr_model":False}
            result=host.report({})
        self.assertEqual(result["status"],"BLOCKED")
        self.assertEqual(len(result["missing"]),3)
        self.assertNotIn("READY_FOR_REAL_INFERENCE",result["next_step"])

    def test_tts_only_can_proceed_without_asr_model(self):
        with patch.object(host,"load_preflight") as load:
            load.return_value.check_environment.return_value={
                "piper_executable":True,"piper_model":True,"tts_supported_rate":True,
                "tts_mandarin":True,"voice_token":True,"asr_model":False}
            result=host.report({},tts_only=True)
        self.assertEqual(result["status"],"READY_FOR_REAL_INFERENCE")
        self.assertEqual(result["mode"],"tts_only")
        self.assertFalse(result["checks"]["asr_model"])

    def test_all_checks_pass_only_means_ready_for_inference(self):
        with patch.object(host,"load_preflight") as load:
            load.return_value.check_environment.return_value={
                "piper_executable":True,"piper_model":True,"asr_model":True}
            result=host.report({})
        self.assertEqual(result["status"],"READY_FOR_REAL_INFERENCE")
        self.assertEqual(result["missing"],[])
        self.assertIn("render-local-sample.py",result["next_step"])

if __name__=="__main__":
    unittest.main()
