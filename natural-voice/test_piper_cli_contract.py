"""Piper CLI contract test using a fake executable, without voice weights."""
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
import wave

spec=importlib.util.spec_from_file_location("local_piper_tts",Path(__file__).with_name("local-piper-tts.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class PiperCliTests(unittest.TestCase):
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
    def test_rejects_incorrect_voice_rate(self):
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
            with self.assertRaisesRegex(ValueError,"TTS_SAMPLE_RATE_MISMATCH"):
                engine.synthesize("你好")

if __name__=="__main__":unittest.main()
