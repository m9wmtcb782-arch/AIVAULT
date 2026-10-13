import unittest
import json
import base64
from tts_stream import clauses, audio_events

class StreamTests(unittest.TestCase):
    def test_clauses_preserve_text(self):
        text="你好，暗星！今天繼續測試。"
        self.assertEqual("".join(clauses(text, max_chars=8)),text)
    def test_audio_frames_and_complete(self):
        events=[json.loads(x) for x in audio_events("你好。再見。",lambda text,sample_rate: bytes([0,0])*2400)]
        self.assertEqual([e["type"] for e in events],["audio","audio","complete"])
        self.assertEqual(base64.b64decode(events[0]["pcm_base64"]),bytes([0,0])*2400)
    def test_model_failure_is_error_not_complete(self):
        def fail(text,sample_rate): raise RuntimeError("unavailable")
        events=[json.loads(x) for x in audio_events("你好",fail)]
        self.assertEqual([e["type"] for e in events],["error"])

if __name__=="__main__":unittest.main()
