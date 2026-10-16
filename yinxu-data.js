/* 因序小說：示範書（原創，預編譯成規格第五節 JSON + v2 欄位：opening/outline/tts_voice/mood） */
window.YINXU_DEMO_BOOKS = [
 {
  "book_id": "lighthouse-night",
  "title": "燈塔守夜人",
  "part": 1,
  "protagonist": {
   "id": "ayuan",
   "name": "阿遠",
   "voice_type": "male",
   "tts_voice": "Puck",
   "tts_style": "A young man in his twenties, sincere."
  },
  "original_ending": "暴風夜阿遠替受傷的林伯點亮備用燈，魏船長的漁船平安入港；阿遠決定留在島上接任燈守，小雨開始跟他學看星象。",
  "characters": [
   {
    "id": "narrator",
    "name": "說書人",
    "voice_type": "narrator",
    "personality": "沉穩、帶點懸念的說書人",
    "knows_original_ending": false,
    "anti_railroad_constraint": true,
    "tts_voice": "Sulafat",
    "tts_style": "Storyteller narrating an audiobook, warm, measured, slight suspense.",
    "speech_style": "說書"
   },
   {
    "id": "linbo",
    "name": "林伯",
    "voice_type": "old",
    "personality": "守燈四十年的老人，固執、嘴硬心軟，膝蓋舊傷",
    "knows_original_ending": true,
    "anti_railroad_constraint": true,
    "tts_voice": "Algenib",
    "tts_style": "An old man in his seventies, slow, gravelly, a little stubborn but kind.",
    "speech_style": "嘴硬、短句"
   },
   {
    "id": "xiaoyu",
    "name": "小雨",
    "voice_type": "child",
    "personality": "林伯的孫女，九歲，好奇、膽子大、愛問為什麼",
    "knows_original_ending": true,
    "anti_railroad_constraint": true,
    "tts_voice": "Leda",
    "tts_style": "A nine-year-old girl, bright, quick, curious, higher pitch.",
    "speech_style": "童言童語、愛問為什麼"
   },
   {
    "id": "wei",
    "name": "魏船長",
    "voice_type": "male",
    "personality": "粗聲粗氣的漁船船長，重義氣，不信鬼神",
    "knows_original_ending": true,
    "anti_railroad_constraint": true,
    "tts_voice": "Orus",
    "tts_style": "A rough, loud fishing-boat captain in his fifties, shouting over wind.",
    "speech_style": "大嗓門、直來直往"
   }
  ],
  "nodes": [
   {
    "type": "narrator",
    "speaker": "narrator",
    "text": "東引外海的小島上，只有一座白色燈塔。你叫阿遠，搭最後一班補給船上島，來找多年不見的林伯。",
    "sfx": "waves",
    "mood": "calm"
   },
   {
    "type": "character",
    "speaker": "linbo",
    "text": "你就是阿遠？長這麼大了。島上沒什麼好玩的，明天的船你就回去吧。",
    "mood": "calm"
   },
   {
    "type": "character",
    "speaker": "xiaoyu",
    "text": "爺爺騙人！島上有會發光的海，還有燈塔頂可以看到好遠好遠。",
    "mood": "calm"
   },
   {
    "type": "prompt",
    "speaker": "linbo",
    "text": "阿遠，你老實說，你這次上島，到底是想來做什麼？",
    "original_answer": "我想留下來幾天，看看這座燈塔，也看看你。",
    "mood": "calm"
   },
   {
    "type": "narrator",
    "speaker": "narrator",
    "text": "傍晚，天邊的雲壓得很低，海風忽然變了方向。無線電沙沙作響，傳來一個粗啞的聲音。",
    "sfx": "radio",
    "mood": "tense"
   },
   {
    "type": "character",
    "speaker": "wei",
    "text": "燈塔、燈塔，我是順風號魏航！北邊起大浪，我們要繞進你們港口避風，燈要亮著啊！",
    "mood": "tense"
   },
   {
    "type": "narrator",
    "speaker": "narrator",
    "text": "林伯起身要爬塔頂，膝蓋一軟，整個人跌坐在樓梯上。主燈也在這時閃了兩下，熄了。",
    "sfx": "thud",
    "mood": "tense"
   },
   {
    "type": "character",
    "speaker": "xiaoyu",
    "text": "爺爺！阿遠哥哥，燈滅了，船長伯伯看不到路了怎麼辦？",
    "mood": "tense"
   },
   {
    "type": "prompt",
    "speaker": "xiaoyu",
    "text": "阿遠哥哥，你要怎麼辦？",
    "original_answer": "小雨你顧好爺爺，我去塔頂把備用燈點起來。",
    "mood": "tense"
   },
   {
    "type": "narrator",
    "speaker": "narrator",
    "text": "風雨灌進塔裡，每一級鐵梯都在發抖。遠方海面上，一盞微弱的船燈忽明忽滅。",
    "sfx": "storm",
    "mood": "storm"
   },
   {
    "type": "character",
    "speaker": "wei",
    "text": "我看到島的影子了，可是礁石在哪我分不清！燈塔上有人嗎？說句話！",
    "mood": "storm"
   },
   {
    "type": "prompt",
    "speaker": "wei",
    "text": "燈塔上的人，你聽得到嗎？接下來我該怎麼做？",
    "original_answer": "聽得到！朝燈光正對的方向慢慢開，左邊有礁石，千萬別靠左。",
    "mood": "storm"
   },
   {
    "type": "narrator",
    "speaker": "narrator",
    "text": "天亮時，雨停了。港口的水面像一面破碎又重新拼好的鏡子。",
    "sfx": "waves",
    "mood": "warm"
   },
   {
    "type": "character",
    "speaker": "linbo",
    "text": "昨晚的事，我都看在眼裡。這座塔，總要有人接著守。",
    "mood": "warm"
   },
   {
    "type": "prompt",
    "speaker": "linbo",
    "text": "阿遠，明天的補給船，你要上去嗎？",
    "original_answer": "我不走了。林伯，教我守燈吧。",
    "mood": "warm"
   },
   {
    "type": "narrator",
    "speaker": "narrator",
    "text": "這一夜的因，已經種下。之後的故事，會沿著你說過的每一句話，繼續長出來。",
    "sfx": "bell",
    "mood": "warm"
   }
  ],
  "timeline_state": {
   "current_node": 0,
   "decisions": [],
   "irreversible": true
  },
  "opening": "東引外海的小島上，只有一座白色燈塔。你叫阿遠，帶著父親留下的一封信上島。今晚，暴風就要來了。",
  "cover": {
   "emoji": "🗼",
   "from": "#1e3a8a",
   "to": "#0f172a"
  },
  "outline": [
   {
    "act": 1,
    "title": "上島",
    "summary": "阿遠帶著父親的信上島，林伯冷淡、小雨熱情。",
    "mood": "calm"
   },
   {
    "act": 2,
    "title": "燈滅",
    "summary": "暴風將至，魏船長求救，林伯受傷，主燈熄滅。",
    "mood": "tense"
   },
   {
    "act": 3,
    "title": "塔頂",
    "summary": "有人必須設法讓船看見島。",
    "mood": "storm"
   },
   {
    "act": 4,
    "title": "天亮",
    "summary": "暴風過後，父親當年的真相浮現，阿遠要決定去留。",
    "mood": "warm"
   }
  ]
 }
];
