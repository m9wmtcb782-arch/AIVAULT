"""No paid provider: benchmark a synthetic local engine."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("tts_benchmark",Path(__file__).with_name("benchmark-local-tts.py"))
benchmark=importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)

class FakeEngine:
    available=True
    def synthesize(self,text,sample_rate):
        return bytes(48000)

class BenchmarkTests(unittest.TestCase):
    def test_reports_audio_duration_and_factor(self):
        with patch.object(benchmark.time,"perf_counter",side_effect=[1,1.2,2,2.1]):
            result=benchmark.benchmark(FakeEngine(),repeats=2)
        self.assertEqual(len(result["runs"]),2)
        self.assertEqual(result["runs"][0]["audio_ms"],1000.0)
        self.assertEqual(result["mean_inference_ms"],150.0)
    def test_refuses_missing_model(self):
        class Missing:available=False
        with self.assertRaisesRegex(RuntimeError,"TTS_MODEL_UNAVAILABLE"):
            benchmark.benchmark(Missing())
    def test_rejects_empty_pcm(self):
        class EmptyEngine:
            available=True
            def synthesize(self,text,sample_rate):return b""
        with self.assertRaisesRegex(RuntimeError,"INVALID_TTS_PCM"):
            benchmark.benchmark(EmptyEngine())
    def test_rejects_odd_pcm(self):
        class OddEngine:
            available=True
            def synthesize(self,text,sample_rate):return b"\\x00"
        with self.assertRaisesRegex(RuntimeError,"INVALID_TTS_PCM"):
            benchmark.benchmark(OddEngine())
    def test_limits_repeats(self):
        with self.assertRaisesRegex(ValueError,"INVALID_REPEATS"):
            benchmark.benchmark(FakeEngine(),repeats=21)

if __name__=="__main__":unittest.main()
