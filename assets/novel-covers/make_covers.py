# t313：Grok Bot 在 box 上以 Pillow 程序化繪製的「對照封面」（免費，不呼叫任何圖片 API）。每張依該書大綱與前兩章實際情節取景。
import math, random, hashlib
from PIL import Image, ImageDraw, ImageFilter, ImageFont
W, H = 1200, 1800
def font(path, fam, size):
    for i in range(10):
        try:
            f = ImageFont.truetype(path, size, index=i)
            if f.getname()[0] == fam: return f
        except Exception: break
    return ImageFont.truetype(path, size)
SERIF_B = lambda s: font("/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc", "Noto Serif CJK TC", s)
SANS_B = lambda s: font("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "Noto Sans CJK TC", s)
def grad(c1, c2, c3=None):
    im = Image.new("RGB", (W, H)); d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        if c3: a, b, u = (c1, c2, t * 2) if t < .5 else (c2, c3, (t - .5) * 2)
        else: a, b, u = c1, c2, t
        d.line([(0, y), (W, y)], fill=tuple(int(a[k] + (b[k] - a[k]) * u) for k in range(3)))
    return im
def glow(im, xy, r, color, strength=1.0):
    g = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    for i in range(30, 0, -1):
        rr = r * i / 30; a = int(255 * strength * (1 - i / 30) ** 2 * .6)
        d.ellipse([xy[0] - rr, xy[1] - rr, xy[0] + rr, xy[1] + rr], fill=color + (a,))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(r / 10)))
def text_c(d, y, s, f, fill, x=W // 2, stroke=0, sf=None, spacing=0):
    if spacing:
        ws = [d.textlength(ch, font=f) for ch in s]; tot = sum(ws) + spacing * (len(s) - 1); cx = x - tot / 2
        for ch, w in zip(s, ws): d.text((cx, y), ch, font=f, fill=fill, stroke_width=stroke, stroke_fill=sf); cx += w + spacing
    else:
        w = d.textlength(s, font=f); d.text((x - w / 2, y), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=sf)

# 1) 星海之戀：火星殖民地塔克西姆城黃昏觀測平台，語言學家蘇曦以量子解碼器追蹤父親日記裡的「星海之聲」訊號
def xinghai(out):
    r = random.Random(1); im = grad((8, 10, 40), (70, 30, 80), (200, 90, 50)).convert("RGBA"); d = ImageDraw.Draw(im)
    for _ in range(420):  # 星海
        x, y = r.random() * W, r.random() * H * .62; s = r.random() ** 3 * 3 + .5; a = int(120 + r.random() * 135)
        d.ellipse([x - s, y - s, x + s, y + s], fill=(255, 245, 230, a))
    glow(im, (W * .5, H * .38), 520, (255, 170, 210), .55)  # 星雲（愛情）
    glow(im, (W * .78, H * .2), 90, (255, 230, 200), .9)
    d = ImageDraw.Draw(im)
    pts = [(0, H * .72)] + [(x, H * .72 - 120 * math.sin(x / 260) ** 2 - r.random() * 30) for x in range(0, W + 40, 40)] + [(W, H), (0, H)]
    d.polygon(pts, fill=(120, 40, 25, 255))  # 火星山脈
    d.rectangle([0, H * .8, W, H], fill=(90, 28, 18, 255))
    for cx, rw in [(180, 160), (420, 110), (930, 200)]:  # 殖民穹頂
        d.pieslice([cx - rw, H * .8 - rw, cx + rw, H * .8 + rw], 180, 360, fill=(220, 150, 110, 110), outline=(255, 210, 170, 200), width=3)
    d.rectangle([380, H * .80, 820, H * .80 + 18], fill=(40, 20, 20, 255))  # 觀測平台
    for x in (420, 780): d.rectangle([x, H * .80, x + 10, H * .87], fill=(40, 20, 20, 255))
    for i in range(3):  # 「星海之聲」訊號波形，從平台射向星空
        pts = [(600 + (y - H * .79) * .0, y) for y in []]
        wave = [(600 + 60 * math.sin((H * .78 - y) / (40 + i * 15)) * (1 - (H * .78 - y) / (H * .55)), y) for y in range(int(H * .78), int(H * .25), -6)]
        d.line(wave, fill=(150, 230, 255, 160 - i * 40), width=4 - i)
    for x, h in [(560, 120), (640, 128)]:  # 兩人剪影（蘇曦與凱爾）
        d.ellipse([x - 16, H * .8 - h - 4, x + 16, H * .8 - h + 28], fill=(20, 10, 15, 255)); d.rounded_rectangle([x - 22, H * .8 - h + 26, x + 22, H * .8], 14, fill=(20, 10, 15, 255))
    d.line([(578, H * .8 - 80), (622, H * .8 - 84)], fill=(20, 10, 15, 255), width=8)  # 牽手
    text_c(d, 150, "星海之戀", SERIF_B(190), (255, 236, 240), stroke=4, sf=(120, 40, 80), spacing=18)
    text_c(d, 390, "火星殖民地・星海之聲", SANS_B(44), (255, 210, 225), spacing=6)
    text_c(d, H - 120, "AIVAULT 長篇・愛情", SANS_B(36), (255, 220, 200), spacing=8)
    im.convert("RGB").save(out, "JPEG", quality=90)

# 2) 雲霧斷魂劍：雲嶺山莊少年沈雲澤與柳如煙走出雲霧古林，藍色魂珠懸空，古石碑刻「斷魂之劍，唯斷者方可拔」
def yunwu(out):
    r = random.Random(2); im = grad((214, 222, 218), (150, 172, 170), (40, 55, 60)).convert("RGBA"); d = ImageDraw.Draw(im)
    glow(im, (W * .5, H * .3), 600, (255, 225, 160), .5)  # 晨光金暈
    for k, (base, col) in enumerate([(H * .48, (120, 140, 140, 150)), (H * .56, (85, 105, 108, 190)), (H * .66, (50, 66, 70, 230))]):  # 水墨群峰
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(layer)
        pts = [(0, H)] + [(x, base - abs(math.sin(x / (180 + k * 70) + k)) * (300 - k * 60) - r.random() * 20) for x in range(0, W + 30, 30)] + [(W, H)]
        ld.polygon(pts, fill=col); im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(2 + k)))
        mist = Image.new("RGBA", im.size, (0, 0, 0, 0)); md = ImageDraw.Draw(mist)
        for _ in range(14): x, y = r.random() * W, base - 40 + r.random() * 120; md.ellipse([x - 260, y - 40, x + 260, y + 40], fill=(235, 240, 238, 70))
        im.alpha_composite(mist.filter(ImageFilter.GaussianBlur(30)))
    d = ImageDraw.Draw(im)
    for _ in range(9):  # 古林樹影
        x = r.random() * W; h = 300 + r.random() * 300
        d.line([(x, H), (x + r.uniform(-20, 20), H - h)], fill=(25, 32, 30, 230), width=int(10 + r.random() * 10))
    d.polygon([(820, H), (840, H * .74), (960, H * .73), (980, H)], fill=(70, 78, 72, 255))  # 古石碑
    for i, ch in enumerate("斷魂之劍"): d.text((885, H * .755 + i * 62), ch, font=SERIF_B(48), fill=(190, 200, 190, 255))
    sw = Image.new("RGBA", im.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sw)  # 斷魂劍（斜插地面）
    sd.polygon([(590, H * .9), (604, H * .9), (626, H * .45), (612, H * .44)], fill=(225, 235, 240, 255))
    sd.rectangle([555, H * .9 - 4, 640, H * .9 + 14], fill=(60, 40, 30, 255)); sd.rectangle([588, H * .9 + 14, 606, H * .97], fill=(80, 30, 25, 255))
    im.alpha_composite(sw.rotate(-8, center=(600, H * .9)))
    glow(im, (600, H * .38), 150, (90, 170, 255), 1.0)  # 藍色魂珠
    d = ImageDraw.Draw(im); d.ellipse([570, H * .38 - 30, 630, H * .38 + 30], fill=(200, 235, 255, 255))
    for i, ch in enumerate("雲霧斷魂劍"):  # 直排書法式書名
        d.text((120, 140 + i * 200), ch, font=SERIF_B(170), fill=(25, 30, 30), stroke_width=2, stroke_fill=(240, 240, 235))
    d.rectangle([128, 1180, 228, 1280], fill=(170, 30, 30)); d.text((140, 1192), "武俠", font=SERIF_B(40), fill=(250, 235, 220))
    d.text((150, 1232), "長篇", font=SERIF_B(32), fill=(250, 235, 220))
    text_c(d, H - 110, "AIVAULT 長篇・雲嶺山莊", SANS_B(34), (230, 230, 220), x=W * .62, spacing=6)
    im.convert("RGB").save(out, "JPEG", quality=90)

# 3) 暗鏡之城：建於舊礦坑、永不見光的十層地下都市；光源維護站警報響起，鏡面「鏡魂」留下死者痕跡，七位偵探追查十宗謀殺
def anjing(out):
    r = random.Random(3); im = grad((2, 4, 10), (8, 18, 30), (2, 3, 6)).convert("RGBA"); d = ImageDraw.Draw(im)
    for lv in range(10):  # 十層地下城（層層往下）
        y = 520 + lv * 118; inset = 40 + lv * 26
        d.line([(inset, y), (W - inset, y)], fill=(40, 90, 110, 200), width=3)
        for _ in range(12):
            x = r.uniform(inset, W - inset); c = (120, 220, 255) if r.random() > .15 else (255, 60, 50)
            d.rectangle([x, y - 26, x + 14, y - 8], fill=c + (int(90 + r.random() * 120),))
        d.text((inset + 6, y - 40), f"L{lv + 1}", font=SANS_B(22), fill=(80, 150, 170, 220))
    glow(im, (W / 2, 1060), 420, (60, 200, 255), .45)
    d = ImageDraw.Draw(im)
    d.ellipse([370, 640, 830, 1480], fill=(10, 25, 35, 255), outline=(170, 230, 255, 255), width=10)  # 暗鏡
    ghost = Image.new("RGBA", im.size, (0, 0, 0, 0)); gd = ImageDraw.Draw(ghost)  # 鏡魂人影
    gd.ellipse([545, 800, 655, 920], fill=(200, 240, 255, 150)); gd.polygon([(520, 1300), (680, 1300), (650, 930), (550, 930)], fill=(200, 240, 255, 110))
    im.alpha_composite(ghost.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(im)
    crack = [(700, 700)]
    for _ in range(9): x, y = crack[-1]; crack.append((x - r.uniform(10, 50), y + r.uniform(50, 90)))
    d.line(crack, fill=(230, 250, 255, 255), width=4)  # 鏡面裂痕
    d.ellipse([480, 1380, 720, 1420], fill=(150, 10, 10, 200))  # 血跡（謀殺案）
    glow(im, (1080, 560), 70, (255, 40, 30), 1.0)  # 警報紅燈
    d = ImageDraw.Draw(im)
    text_c(d, 120, "暗鏡之城", SERIF_B(200), (220, 245, 255), stroke=3, sf=(30, 120, 160), spacing=26)
    text_c(d, 380, "十層地下都市・十宗謀殺・鏡魂", SANS_B(42), (140, 210, 235), spacing=4)
    text_c(d, H - 110, "AIVAULT 長篇・推理", SANS_B(36), (150, 200, 220), spacing=8)
    im.convert("RGB").save(out, "JPEG", quality=90)

if __name__ == "__main__":
  for fn, nid in [(xinghai, "9d6c6eb2-4be2-4466-a26f-4a499ecceb18"), (yunwu, "fcd413e3-28a4-4533-bf1e-e191b4258e2e"), (anjing, "b18378c0-91c9-433d-8640-1de7066ed340")]:
    fn(f"{nid}.jpg"); print(nid, hashlib.sha256(open(f"{nid}.jpg", "rb").read()).hexdigest()[:16])
