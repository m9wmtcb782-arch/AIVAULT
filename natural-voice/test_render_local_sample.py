"""Offline sample rendering tests using a fake local synth, no paid API."""
import importlib.util
import pathlib
import tempfile
import unittest
import wave
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("voice_render", pathlib.Path(__file__).with_name("render-local-sample.py"))
render = importlib.util.module_from_spec(spec)
spec.loader.exec_module(render)

class FakeEngine:
    available = True
    def synthesize(self, text, sample_rate=24000):
        assert sample_rate == 24000
        return bytes([0,0])*24000

class SampleTests(unittest.TestCase):
    def test_missing_model_fails_without_output(self):
        with tempfile.TemporaryDirectory() as directory:
            target=pathlib.Path(directory)/"voice.wav"
            class Missing:
                available=False
            with patch.object(render, "create_engine", return_value=Missing()):
                self.assertEqual(render.main(["--output",str(target)]),2)
            self.assertFalse(target.exists())

    def test_valid_pcm_writes_playable_wave(self):
        with tempfile.TemporaryDirectory() as directory:
            target=pathlib.Path(directory)/"voice.wav"
            with patch.object(render, "create_engine", return_value=FakeEngine()):
                self.assertEqual(render.main(["--output",str(target)]),0)
            with wave.open(str(target),"rb") as audio:
                self.assertEqual(audio.getframerate(),24000)
                self.assertEqual(audio.getnchannels(),1)
                self.assertEqual(audio.getsampwidth(),2)
                self.assertEqual(audio.getnframes(),24000)
            self.assertFalse(target.with_name(target.name+".partial").exists())

    def test_synthesis_failure_does_not_create_wave(self):
        class Broken:
            available=True
            def synthesize(self, text, sample_rate=24000):
                raise RuntimeError("offline model failed")
        with tempfile.TemporaryDirectory() as directory:
            target=pathlib.Path(directory)/"voice.wav"
            with patch.object(render, "create_engine", return_value=Broken()):
                self.assertEqual(render.main(["--output",str(target)]),3)
            self.assertFalse(target.exists())
            self.assertFalse(target.with_name(target.name+".partial").exists())

if __name__ == "__main__":
    unittest.main()
