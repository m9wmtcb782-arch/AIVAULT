import unittest
import json
import base64
from tts_stream import clauses, clauses_with_offsets, audio_events

class StreamTests(unittest.TestCase):
    def test_clauses_preserve_text(self):
        text="你好，暗星！今天繼續測試。"
        self.assertEqual("".join(clauses(text, max_chars=8)),text)
    def test_offsets_reference_original_text(self):
        text="你好，暗星！今天繼續測試。"
        spans=list(clauses_with_offsets(text, max_chars=8))
        self.assertEqual("".join(part for part,_,_ in spans),text)
        for part,start,end in spans:
            self.assertEqual(text[start:end],part)

    def test_newlines_do_not_corrupt_source_offsets(self):
        text="第一段。\n第二段。"
        spans=list(clauses_with_offsets(text))
        self.assertEqual("".join(part for part,_,_ in spans),text)
        for part,start,end in spans:
            self.assertEqual(text[start:end],part)
        self.assertTrue(any("\n" in part for part,_,_ in spans))

    def test_audio_frames_and_complete(self):
        events=[json.loads(x) for x in audio_events("你好。再見。",lambda text,sample_rate: bytes([0,0])*2400)]
        self.assertEqual([e["type"] for e in events],["audio","audio","complete"])
        self.assertEqual(base64.b64decode(events[0]["pcm_base64"]),bytes([0,0])*2400)
        self.assertEqual((events[0]["char_start"],events[0]["char_end"]),(0,3))
        self.assertEqual((events[1]["char_start"],events[1]["char_end"]),(3,6))
        self.assertEqual(events[0]["sample_rate"],24000)
    def test_odd_frame_size_rejected(self):
        with self.assertRaisesRegex(ValueError,"INVALID_FRAME_BYTES"):
            list(audio_events("你好",lambda text,sample_rate: bytes([0,0]),frame_bytes=3))
    def test_model_failure_is_error_not_complete(self):
        def fail(text,sample_rate): raise RuntimeError("unavailable")
        events=[json.loads(x) for x in audio_events("你好",fail)]
        self.assertEqual([e["type"] for e in events],["error"])

if __name__=="__main__":unittest.main()
