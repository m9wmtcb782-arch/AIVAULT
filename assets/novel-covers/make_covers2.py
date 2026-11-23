# t318：其餘 6 本對照封面（Pillow 程序化、免費）。每張依該書大綱與第一章情節取景。
import math, random, hashlib
from PIL import Image, ImageDraw, ImageFilter
from make_covers import W, H, SERIF_B, SANS_B, grad, glow, text_c

def bolt(d, x, y, r, col, w=5):
    pts = [(x, y)]
    for _ in range(7): x += r.uniform(-40, 40); y += r.uniform(40, 80); pts.append((x, y))
    d.line(pts, fill=col, width=w)

# 星層回聲：星艦「黎明號」駛入六層頻率不同的星層能量雲，追尋古文明「回聲」訊號（蕾娜·星痕與半機械種族塔爾）
def xingceng(out):
    r = random.Random(4); im = grad((4, 6, 30), (40, 20, 80), (120, 30, 70)).convert("RGBA"); d = ImageDraw.Draw(im)
    for _ in range(300): x, y = r.random() * W, r.random() * H; s = r.random() ** 3 * 2.5 + .4; d.ellipse([x - s, y - s, x + s, y + s], fill=(230, 230, 255, int(100 + r.random() * 155)))
    cols = [(255, 80, 120), (255, 150, 60), (250, 230, 90), (80, 230, 160), (70, 170, 255), (170, 110, 255)]
    for i, c in enumerate(cols):  # 六層星層
        lay = Image.new("RGBA", im.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay); rr = 160 + i * 90
        ld.ellipse([W / 2 - rr * 1.25, 1050 - rr * .55, W / 2 + rr * 1.25, 1050 + rr * .55], outline=c + (170,), width=6)
        im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(3)))
    glow(im, (W / 2, 1050), 260, (200, 160, 255), .8)
    d = ImageDraw.Draw(im)
    for k in range(8):  # 回聲波紋
        a = 220 - k * 25; d.arc([W / 2 - 40 - k * 50, 1000 - k * 22, W / 2 + 40 + k * 50, 1100 + k * 22], 200, 340, fill=(220, 240, 255, max(a, 30)), width=2)
    ship = [(600, 1250), (640, 1380), (620, 1370), (600, 1420), (580, 1370), (560, 1380)]  # 黎明號
    d.polygon([(x, y + 120) for x, y in ship], fill=(230, 235, 245, 255)); glow(im, (600, 1550), 40, (120, 200, 255), 1)
    d = ImageDraw.Draw(im)
    text_c(d, 150, "星層回聲", SERIF_B(190), (235, 230, 255), stroke=3, sf=(90, 40, 160), spacing=20)
    text_c(d, 390, "六層星層・古文明回聲・黎明號", SANS_B(42), (200, 190, 255), spacing=4)
    text_c(d, H - 110, "AIVAULT 長篇・科幻", SANS_B(36), (210, 200, 255), spacing=8)
    im.convert("RGB").save(out, "JPEG", quality=90)

# 靈渾天道：十六歲凡塵少年林曦沿苔蘚古石徑登山頂古碑，尋失落的靈渾結晶，踏破九劫（道劫）
def linghun(out):
    r = random.Random(5); im = grad((20, 50, 45), (60, 120, 100), (225, 215, 170)).convert("RGBA"); d = ImageDraw.Draw(im)
    glow(im, (W / 2, 560), 300, (255, 240, 170), .9)
    for k in range(9):  # 九劫雷環
        rr = 120 + k * 34; d = ImageDraw.Draw(im); d.ellipse([W / 2 - rr, 560 - rr * .35, W / 2 + rr, 560 + rr * .35], outline=(200, 230, 255, 150 - k * 12), width=3)
    d.polygon([(600, 450), (650, 560), (600, 680), (550, 560)], fill=(240, 255, 245, 255))  # 靈渾結晶
    for _ in range(4): bolt(d, r.uniform(200, 1000), 300, r, (220, 235, 255, 200), 4)
    for k, (base, col) in enumerate([(1000, (40, 80, 70, 200)), (1150, (25, 55, 50, 235))]):
        pts = [(0, H)] + [(x, base - abs(math.sin(x / (200 + k * 90) + k * 2)) * 330) for x in range(0, W + 30, 30)] + [(W, H)]
        d.polygon(pts, fill=col)
    d.rectangle([560, 690, 640, 900], fill=(110, 115, 105, 255)); d.polygon([(550, 690), (650, 690), (600, 660)], fill=(110, 115, 105, 255))  # 山頂古碑
    path = [(600 + 260 * math.sin(t / 3) * (t / 20), 1700 - t * 40) for t in range(0, 20)]  # 苔蘚石徑
    d.line(path, fill=(150, 170, 120, 255), width=26); d.line(path, fill=(90, 120, 80, 255), width=8)
    d.ellipse([588, 1505, 612, 1530], fill=(20, 20, 20, 255)); d.rectangle([590, 1528, 610, 1570], fill=(20, 20, 20, 255))  # 少年背影
    mist = Image.new("RGBA", im.size, (0, 0, 0, 0)); md = ImageDraw.Draw(mist)
    for _ in range(18): x, y = r.random() * W, 950 + r.random() * 500; md.ellipse([x - 280, y - 40, x + 280, y + 40], fill=(230, 245, 235, 70))
    im.alpha_composite(mist.filter(ImageFilter.GaussianBlur(28))); d = ImageDraw.Draw(im)
    for i, ch in enumerate("靈渾天道"): d.text((W - 260, 140 + i * 210), ch, font=SERIF_B(180), fill=(250, 240, 200), stroke_width=3, stroke_fill=(30, 60, 50))
    d.text((110, 160), "九劫逆天", font=SERIF_B(52), fill=(250, 240, 200))
    text_c(d, H - 110, "AIVAULT 長篇・修仙", SANS_B(36), (240, 235, 210), spacing=8)
    im.convert("RGB").save(out, "JPEG", quality=90)

# 星垂之門：考古學者林曉晨在深海沉船遺骸發現刻星辰符文的銅盤——星門啟動點，十二塊星門碎片、時間支流
def xingchui(out):
    r = random.Random(6); im = grad((0, 40, 60), (0, 20, 40), (0, 6, 14)).convert("RGBA"); d = ImageDraw.Draw(im)
    rays = Image.new("RGBA", im.size, (0, 0, 0, 0)); rd = ImageDraw.Draw(rays)
    for i in range(14):  # 水面透光
        x = r.uniform(0, W); rd.polygon([(x - 30, 0), (x + 30, 0), (x + 160, 900), (x + 60, 900)], fill=(120, 220, 255, 28))
    im.alpha_composite(rays.filter(ImageFilter.GaussianBlur(12)))
    glow(im, (W / 2, 900), 380, (255, 200, 90), .6); d = ImageDraw.Draw(im)
    d.ellipse([W / 2 - 300, 600, W / 2 + 300, 1200], outline=(255, 210, 120, 255), width=14)  # 星門
    for k in range(12):  # 十二塊符文碎片
        a = k / 12 * 2 * math.pi; x, y = W / 2 + 340 * math.cos(a), 900 + 340 * math.sin(a)
        d.polygon([(x, y - 22), (x + 18, y), (x, y + 22), (x - 18, y)], fill=(255, 225, 150, 255))
    for k in range(5): d.arc([W / 2 - 250 + k * 40, 650 + k * 40, W / 2 + 250 - k * 40, 1150 - k * 40], k * 60, k * 60 + 220, fill=(160, 240, 255, 200), width=3)  # 時間支流
    d.polygon([(80, 1500), (500, 1380), (640, 1460), (300, 1620)], fill=(40, 55, 60, 255)); d.line([(250, 1430), (200, 1250)], fill=(40, 55, 60, 255), width=12)  # 沉船
    d.ellipse([760, 1300, 820, 1360], fill=(10, 20, 25, 255)); d.rounded_rectangle([755, 1355, 825, 1500], 20, fill=(10, 20, 25, 255))  # 潛水考古學者
    glow(im, (740, 1400), 40, (255, 200, 100), 1); d = ImageDraw.Draw(im); d.ellipse([725, 1385, 755, 1415], fill=(210, 150, 70, 255))  # 銅盤
    for _ in range(40): x, y = r.random() * W, r.random() * H; d.ellipse([x, y, x + 6, y + 6], outline=(180, 230, 255, 120))  # 氣泡
    text_c(d, 150, "星垂之門", SERIF_B(190), (255, 230, 170), stroke=3, sf=(60, 40, 10), spacing=20)
    text_c(d, 390, "深海星門・十二碎片・時間之謎", SANS_B(42), (170, 230, 245), spacing=4)
    text_c(d, H - 110, "AIVAULT 長篇・穿越", SANS_B(36), (180, 220, 235), spacing=8)
    im.convert("RGB").save(out, "JPEG", quality=90)

# 星曙之境：晨曦界農村少年林曦，稻田晨光、山頂祈禱塔，山洞拾得藍色星辰碎片；七界相疊、古神曙光與暮影光暗之爭
def xingshu(out):
    r = random.Random(7); top = grad((30, 20, 70), (240, 160, 90), (250, 220, 140)).convert("RGBA")
    im = top; d = ImageDraw.Draw(im)
    dark = Image.new("RGBA", im.size, (10, 5, 30, 0)); dd = ImageDraw.Draw(dark); dd.polygon([(0, 0), (W * .5, 0), (W * .3, H * .6), (0, H * .6)], fill=(15, 8, 45, 170))
    im.alpha_composite(dark.filter(ImageFilter.GaussianBlur(60))); d = ImageDraw.Draw(im)  # 暮影（暗）vs 曙光（光）
    glow(im, (W * .72, 520), 220, (255, 240, 200), 1); d = ImageDraw.Draw(im)
    for k in range(7):  # 七界星辰之橋
        rr = 380 - k * 40; d.arc([W / 2 - rr, 700 - rr * .6, W / 2 + rr, 700 + rr * .6], 180, 360, fill=(255, 250, 230, 200 - k * 20), width=4)
    pts = [(0, 1150)] + [(x, 1150 - abs(math.sin(x / 260)) * 220) for x in range(0, W + 30, 30)] + [(W, 1250), (0, 1250)]
    d.polygon(pts, fill=(70, 70, 110, 255)); d.rectangle([820, 830, 850, 980], fill=(50, 45, 80, 255)); d.polygon([(810, 830), (860, 830), (835, 780)], fill=(50, 45, 80, 255))  # 祈禱塔
    d.rectangle([0, 1240, W, H], fill=(200, 160, 60, 255))
    for _ in range(500): x, y = r.random() * W, 1240 + r.random() * 560; d.line([(x, y), (x + r.uniform(-6, 6), y - 30 - r.random() * 30)], fill=(240, 200, 80, 255), width=2)  # 稻田
    d.ellipse([520, 1330, 560, 1370], fill=(30, 25, 40, 255)); d.rounded_rectangle([515, 1365, 565, 1480], 18, fill=(30, 25, 40, 255))  # 少年
    glow(im, (600, 1360), 90, (90, 170, 255), 1); d = ImageDraw.Draw(im); d.polygon([(600, 1320), (622, 1360), (600, 1400), (578, 1360)], fill=(200, 235, 255, 255))  # 藍色星辰碎片
    text_c(d, 150, "星曙之境", SERIF_B(190), (255, 245, 225), stroke=4, sf=(120, 60, 40), spacing=20)
    text_c(d, 390, "七界・星辰碎片・曙光與暮影", SANS_B(42), (255, 235, 210), spacing=4)
    text_c(d, H - 110, "AIVAULT 長篇・奇幻", SANS_B(36), (90, 60, 20), spacing=8)
    im.convert("RGB").save(out, "JPEG", quality=90)

# 暗巷的回聲：台灣東部濃霧山城「靈峽鎮」，老榕樹暗巷、刻古符文的回聲石，午夜山谷回響召喚七位陌生人
def anxiang(out):
    r = random.Random(8); im = grad((25, 30, 30), (12, 15, 15), (0, 0, 0)).convert("RGBA"); d = ImageDraw.Draw(im)
    for side in (0, 1):  # 暗巷兩側老屋
        for k in range(5):
            x0 = (0 if side == 0 else W) + (1 if side == 0 else -1) * (k * 70); top = 520 + k * 110
            poly = [(x0, top), (x0 + (1 if side == 0 else -1) * 70, top + 60), (x0 + (1 if side == 0 else -1) * 70, H), (x0, H)]
            d.polygon(poly, fill=(30 + k * 6, 34 + k * 6, 32 + k * 6, 255))
    for x in (380, 820):  # 紅燈籠
        glow(im, (x, 760), 60, (220, 30, 20), 1); d = ImageDraw.Draw(im); d.ellipse([x - 22, 735, x + 22, 790], fill=(200, 30, 20, 255))
    d.polygon([(470, 1500), (730, 1500), (700, 1300), (500, 1290)], fill=(70, 75, 70, 255))  # 回聲石
    for i, ch in enumerate("ᚱᛟᛞ"): d.text((560 + i * 30, 1360), ch, font=SANS_B(40), fill=(160, 40, 30))
    for k in range(7): d.ellipse([600 - 140 - k * 70, 1400 - 50 - k * 25, 600 + 140 + k * 70, 1400 + 50 + k * 25], outline=(200, 210, 200, max(150 - k * 20, 20)), width=2)  # 回聲聲波
    for k in range(7): x = 380 + k * 70; d.ellipse([x - 12, 1090, x + 12, 1114], fill=(5, 5, 5, 255)); d.rectangle([x - 12, 1112, x + 12, 1190], fill=(5, 5, 5, 255))  # 七位陌生人
    d.line([(1000, 300), (980, 700)], fill=(15, 18, 15, 255), width=40)  # 老榕樹
    for _ in range(40): d.line([(990, 400 + r.random() * 300), (990 + r.uniform(-200, 150), 450 + r.random() * 700)], fill=(15, 18, 15, 200), width=2)
    fog = Image.new("RGBA", im.size, (0, 0, 0, 0)); fd = ImageDraw.Draw(fog)
    for _ in range(20): x, y = r.random() * W, 700 + r.random() * 1000; fd.ellipse([x - 300, y - 50, x + 300, y + 50], fill=(190, 200, 195, 60))
    im.alpha_composite(fog.filter(ImageFilter.GaussianBlur(30))); d = ImageDraw.Draw(im)
    d.ellipse([140, 200, 260, 320], fill=(220, 220, 200, 255))
    text_c(d, 150, "暗巷的回聲", SERIF_B(170), (225, 225, 215), stroke=3, sf=(120, 10, 10), spacing=10)
    text_c(d, 370, "靈峽鎮・午夜回聲祭", SANS_B(44), (200, 60, 50), spacing=8)
    text_c(d, H - 110, "AIVAULT 長篇・恐怖", SANS_B(36), (190, 190, 180), spacing=8)
    im.convert("RGB").save(out, "JPEG", quality=90)

# 带上她的眼睛（劉慈欣）：「我」帶著一雙「眼睛」去度假，屏幕上穿太空服的年輕女孩在無窗狹小駕駛艙，失重鉛笔在頭頂打轉；她選了草原
def eyes(out):
    r = random.Random(9); im = grad((150, 200, 230), (190, 220, 170), (90, 150, 70)).convert("RGBA"); d = ImageDraw.Draw(im)
    for _ in range(700): x, y = r.random() * W, 1100 + r.random() * 700; c = r.choice([(250, 240, 120), (255, 255, 255), (240, 150, 190), (120, 170, 80)]); d.ellipse([x, y, x + 7, y + 7], fill=c + (255,))  # 草原小花
    d.rounded_rectangle([220, 560, 980, 1080], 30, fill=(20, 26, 36, 255), outline=(200, 210, 220, 255), width=8)  # 屏幕：狹小駕駛艙
    for _ in range(40): x, y = r.uniform(250, 950), r.uniform(590, 1050); c = r.choice([(60, 220, 120), (255, 180, 60), (90, 160, 255)]); d.rectangle([x, y, x + 12, y + 7], fill=c + (220,))
    d.ellipse([540, 700, 660, 820], fill=(235, 235, 240, 255)); d.ellipse([560, 725, 640, 805], fill=(240, 205, 180, 255))  # 太空服女孩
    d.rounded_rectangle([500, 810, 700, 1080], 50, fill=(235, 235, 240, 255))
    d.line([(760, 650), (840, 620)], fill=(250, 210, 60, 255), width=8); d.polygon([(840, 620), (856, 614), (846, 626)], fill=(60, 40, 30, 255))  # 失重鉛笔
    d.arc([730, 600, 870, 680], 190, 330, fill=(255, 255, 255, 160), width=2)
    d.ellipse([430, 1180, 570, 1260], outline=(30, 30, 30, 255), width=10); d.ellipse([630, 1180, 770, 1260], outline=(30, 30, 30, 255), width=10)  # 「眼睛」眼鏡
    d.line([(570, 1215), (630, 1215)], fill=(30, 30, 30, 255), width=10)
    for x in (500, 700): d.ellipse([x - 40, 1195, x + 40, 1245], fill=(120, 200, 255, 110))
    text_c(d, 150, "带上她的眼睛", SERIF_B(150), (255, 255, 255), stroke=4, sf=(40, 70, 100), spacing=8)
    text_c(d, 360, "刘慈欣 著", SANS_B(50), (30, 50, 70), spacing=10)
    text_c(d, H - 110, "AIVAULT 電子書・科幻短篇", SANS_B(36), (255, 255, 240), spacing=8)
    im.convert("RGB").save(out, "JPEG", quality=90)

JOBS = [(xingceng, "c5a8a914-4e0f-426f-a81e-bad021b5cde4"), (linghun, "108e496a-b1db-4f79-b73e-663c565ae856"), (xingchui, "bf7927aa-4da2-4697-84d8-326dd900b79d"),
        (xingshu, "36cfae81-2149-41d0-afd9-8520df504e81"), (anxiang, "42d9ad61-f4ab-4c38-aec8-4efb6467c0c2"), (eyes, "c22c6a4a-4339-4143-a1e9-e48a430ce823")]
if __name__ == "__main__":
    for fn, nid in JOBS: fn(f"{nid}.jpg"); print(nid, hashlib.sha256(open(f"{nid}.jpg", "rb").read()).hexdigest()[:16])
