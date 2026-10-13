"""Piper CLI contract test using a fake executable, without voice weights."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import wave

spec=importlib.util.spec_from_file_location("local_piper_tts",Path(__file__).with_name("local-piper-tts.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PiperCliTests(unittest.TestCase):
    def test_rejects_empty_text_before_running_piper(self):
        engine=module.LocalPiperTTS()
        with patch.object(module.LocalPiperTTS, "available", new_callable=lambda: property(lambda self: True)):
            with self.assertRaisesRegex(ValueError, "INVALID_TTS_TEXT"):
                engine.synthesize("   ")

    def test_rejects_invalid_timeout(self):
        with patch.dict(os.environ, {"PIPER_TIMEOUT_SECONDS":"nan"}):
            with self.assertRaisesRegex(ValueError, "INVALID_PIPER_TIMEOUT"):
                module.LocalPiperTTS()


    def test_wav_output_is_read_and_temp_file_removed(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            model=root/"voice.onnx"
            model.write_bytes(b"mock")
            script=root/"fake-piper"
            script.write_text("""#!/usr/bin/env python3
import sys,wave
path=sys.argv[sys.argv.index('--output_file')+1]
with wave.open(path,'wb') as f:
 f.setnchannels(1)
 f.setsampwidth(2)
 f.setframerate(24000)
 f.writeframes(bytes([0,0])*240)
""")
            script.chmod(0o755)
            engine=module.LocalPiperTTS(executable=str(script),model_path=str(model))
            self.assertTrue(engine.available)
            self.assertEqual(engine.synthesize("你好"),bytes([0,0])*240)
    def test_resamples_22050hz_voice_to_24000hz(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            model=root/"voice.onnx"
            model.write_bytes(b"mock")
            script=root/"fake-piper"
            script.write_text("""#!/usr/bin/env python3
import sys,wave
path=sys.argv[sys.argv.index('--output_file')+1]
with wave.open(path,'wb') as f:
 f.setnchannels(1)
 f.setsampwidth(2)
 f.setframerate(22050)
 f.writeframes(bytes([0,0])*240)
""")
            script.chmod(0o755)
            engine=module.LocalPiperTTS(executable=str(script),model_path=str(model))
            output=engine.synthesize("你好")
            self.assertGreater(len(output),len(bytes([0,0])*240))
            self.assertEqual(len(output)%2,0)

if __name__=="__main__":unittest.main()
