from pathlib import Path
HTML = Path('technical-dark-star.html')
SCRIPT = '<script src="technical-dark-star-realtime-voice-v2.js"></script>'
text = HTML.read_text(encoding='utf-8')
if SCRIPT not in text:
    text = text.replace('</body>', SCRIPT + '\n</body>')
    HTML.write_text(text, encoding='utf-8')
print('Dark Star realtime voice v2 installed')
