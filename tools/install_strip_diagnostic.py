from pathlib import Path
p = Path("technical-dark-star.html")
text = p.read_text(encoding="utf-8")
needle = '<script src="technical-dark-star-strip-diagnostic.js?v=1"></script>'
if needle in text:
    print("already installed")
    raise SystemExit(0)
old = '<script src="technical-dark-star-realtime-voice-v2.js"></script>\n</body>'
new = '<script src="technical-dark-star-realtime-voice-v2.js"></script>\n<script src="technical-dark-star-strip-diagnostic.js?v=1"></script>\n</body>'
if old not in text:
    old = "</body>"
    new = needle + "\n</body>"
    if text.count("</body>") != 1:
        raise SystemExit("cannot find install point")
p.write_text(text.replace(old, new, 1), encoding="utf-8")
print("installed")
