import importlib.util
import json
from pathlib import Path
import hashlib
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("stage_voice",ROOT/"stage-mandarin-model.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ModelStagingTests(unittest.TestCase):
    def test_stages_valid_model_and_matching_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            model=root/"source.onnx";model.write_bytes(b"model-weights-fixture")
            config=root/"source.json"
            config.write_text(json.dumps({"audio":{"sample_rate":22050},"language":{"code":"zh_CN"}}))
            digest=hashlib.sha256(model.read_bytes()).hexdigest()
            result=module.main(["--model",str(model),"--config",str(config),
                                "--expected-sha256",digest,"--destination",str(root/"staged")])
            self.assertEqual(result,0)
            self.assertEqual((root/"staged/mandarin.onnx").read_bytes(),model.read_bytes())
            self.assertTrue((root/"staged/mandarin.onnx.json").exists())
    def test_refuses_bad_checksum(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);model=root/"source.onnx";model.write_bytes(b"fixture")
            config=root/"source.json";config.write_text('{"audio":{"sample_rate":24000},"language":{"code":"zh-TW"}}')
            result=module.main(["--model",str(model),"--config",str(config),
                                "--expected-sha256","0"*64,"--destination",str(root/"staged")])
            self.assertEqual(result,3)
            self.assertFalse((root/"staged/mandarin.onnx").exists())
    def test_refuses_unsupported_language(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);model=root/"source.onnx";model.write_bytes(b"fixture")
            config=root/"source.json";config.write_text('{"audio":{"sample_rate":24000},"language":{"code":"en-US"}}')
            result=module.main(["--model",str(model),"--config",str(config),
                                "--expected-sha256",hashlib.sha256(model.read_bytes()).hexdigest(),
                                "--destination",str(root/"staged")])
            self.assertEqual(result,4)

if __name__=="__main__":unittest.main()
