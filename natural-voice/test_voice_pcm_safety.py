"""Static regression tests for local Piper output size safeguards (no model needed)."""
import ast
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parent

class LocalPiperSafetyTest(unittest.TestCase):
    def test_piper_checks_frame_count_before_read(self):
        tree=ast.parse((ROOT/"local-piper-tts.py").read_text(encoding="utf-8"))
        source=(ROOT/"local-piper-tts.py").read_text(encoding="utf-8")
        self.assertLess(source.index("frames > original_rate * 60"),source.index("pcm = wav.readframes(frames)"))
        self.assertTrue(any(isinstance(n,ast.FunctionDef) and n.name=="synthesize" for n in ast.walk(tree)))
    def test_worker_checks_pcm_size_before_json_encoding(self):
        source=(ROOT/"worker.py").read_text(encoding="utf-8")
        self.assertLess(source.index("len(pcm) > 2_880_000"),source.index('return {"frames":'))
        ast.parse(source)

    def test_capabilities_are_authenticated_and_fail_closed(self):
        source=(ROOT/"worker.py").read_text(encoding="utf-8")
        tree=ast.parse(source)
        function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=="capabilities")
        function_source=ast.get_source_segment(source,function)
        self.assertIn("authorize(authorization)",function_source)
        self.assertIn('"voice_inference_verified": False',function_source)
        self.assertIn('"gpu_inference_verified": False',function_source)
        self.assertIn('"pool_eligible": False',function_source)

if __name__=="__main__":
    unittest.main()
