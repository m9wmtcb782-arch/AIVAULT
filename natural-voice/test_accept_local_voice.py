import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("voice_accept",ROOT/"accept-local-voice.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AcceptanceTests(unittest.TestCase):
    def test_no_model_fails_closed_without_creating_wav(self):
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory)/"voice.wav"
            class Preflight:
                @staticmethod
                def check_environment():
                    return {"piper_executable":False,"piper_model":False,"piper_config":False,
                            "tts_supported_rate":False,"tts_mandarin":False}
            with patch.object(module,"load",return_value=Preflight):
                self.assertEqual(module.main(["--output",str(output)]),2)
            self.assertFalse(output.exists())
    def test_success_requires_actual_rendered_wav(self):
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory)/"voice.wav"
            class Preflight:
                @staticmethod
                def check_environment():
                    return {key:True for key in ("piper_executable","piper_model","piper_config",
                                                 "tts_supported_rate","tts_mandarin")}
            class Renderer:
                @staticmethod
                def main(argv):
                    import wave
                    with wave.open(str(output),"wb") as wav:
                        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(24000)
                        wav.writeframes(b"\x00\x10"*2400)
                    return 0
            with patch.object(module,"load",side_effect=[Preflight,Renderer]):
                self.assertEqual(module.main(["--output",str(output)]),0)

if __name__=="__main__":unittest.main()
