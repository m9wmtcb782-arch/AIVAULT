"""Worker contract tests: offline mocks, no GPU or paid API required.
Run from natural-voice/: python -m unittest test_worker.py
Requires fastapi, httpx, pydantic.
"""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location("voice_worker",pathlib.Path(__file__).with_name("worker.py"))
worker=importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class FakeTTS:
    available=True
    def synthesize(self,text,sample_rate=24000):
        return bytes([0,0])*2400

class WorkerTests(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        self.client=TestClient(worker.app)
        self.token=patch.object(worker,"TOKEN","local-test-secret")
        self.token.start()
        self.addCleanup(self.token.stop)

    def test_https_cors_origin_validation(self):
        self.assertTrue(worker._valid_origin("https://voice.example.com"))
        self.assertTrue(worker._valid_origin("https://voice.example.com:8443"))
        for origin in ("*", "http://voice.example.com", "https://",
                       "https://voice.example.com/path", "https://voice.example.com?x=1",
                       "https://user:pass@voice.example.com", "https://voice.example.com:bad"):
            with self.subTest(origin=origin):
                self.assertFalse(worker._valid_origin(origin))

    def test_health_no_model(self):
        with patch.object(worker,"_tts",None):
            r=self.client.get("/health")
            self.assertEqual(r.status_code,200)
            self.assertFalse(r.json()["tts_loaded"])

    def test_tts_requires_auth(self):
        r=self.client.post("/v1/tts",json={"text":"你好","voice_id":"anxing-default"})
        self.assertEqual(r.status_code,401)

    def test_tts_returns_pcm_chunks_with_local_mock(self):
        with patch.object(worker,"_tts",FakeTTS()):
            r=self.client.post("/v1/tts",headers={"Authorization":"Bearer local-test-secret"},
                json={"text":"你好","voice_id":"anxing-default"})
        self.assertEqual(r.status_code,200)
        self.assertEqual(len(r.json()["frames"]),1)

    def test_tts_without_model_returns_503(self):
        with patch.object(worker,"_tts",None):
            r=self.client.post("/v1/tts",headers={"Authorization":"Bearer local-test-secret"},
                json={"text":"你好","voice_id":"anxing-default"})
        self.assertEqual(r.status_code,503)


    def test_tts_stream_requires_auth(self):
        r=self.client.post("/v1/tts/stream",json={"text":"你好","voice_id":"anxing-default"})
        self.assertEqual(r.status_code,401)

    def test_tts_stream_yields_ordered_frames(self):
        import json
        with patch.object(worker,"_tts",FakeTTS()):
            r=self.client.post("/v1/tts/stream",headers={"Authorization":"Bearer local-test-secret"},
                json={"text":"你好。再見。","voice_id":"anxing-default"})
        self.assertEqual(r.status_code,200)
        events=[json.loads(line) for line in r.text.splitlines()]
        self.assertEqual([e["type"] for e in events],["audio","audio","complete"])
        self.assertEqual([e["sequence"] for e in events[:2]],[0,1])

    def test_tts_stream_missing_model_returns_503(self):
        with patch.object(worker,"_tts",None):
            r=self.client.post("/v1/tts/stream",headers={"Authorization":"Bearer local-test-secret"},
                json={"text":"你好","voice_id":"anxing-default"})
        self.assertEqual(r.status_code,503)

if __name__=="__main__":
    unittest.main()
