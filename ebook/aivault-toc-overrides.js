/* ADD-only：只覆寫指定電子書的目次（林昱梅〈食品安全管理措施…〉），其他書與功能不變。
   page_number 為遠端 76 頁版本的頁碼（已依原文標題逐頁比對）；print_page 為原書頁碼。 */
(function () {
  "use strict";
  var E = window.AIVAULTEbook;
  if (!E || typeof E.fetchRemoteToc !== "function") return;
  var OVERRIDES = {
    "9a3a2a12-66c6-4864-9ee3-753c1b1a329a": [
     {
      "ordinal": 0,
      "level": "chapter",
      "title": "壹、前言",
      "page_number": 2,
      "print_page": 66
     },
     {
      "ordinal": 1,
      "level": "chapter",
      "title": "貳、食品法之目標及規範模式",
      "page_number": 3,
      "print_page": 68
     },
     {
      "ordinal": 2,
      "level": "section",
      "title": "一、濫用原則下之食品安全管理措施",
      "page_number": 4,
      "print_page": 69
     },
     {
      "ordinal": 3,
      "level": "section",
      "title": "二、禁止原則之例外許可制",
      "page_number": 7,
      "print_page": 71
     },
     {
      "ordinal": 4,
      "level": "section",
      "title": "三、透明原則下之資訊公開與提供",
      "page_number": 10,
      "print_page": 73
     },
     {
      "ordinal": 5,
      "level": "section",
      "title": "四、本文分析",
      "page_number": 19,
      "print_page": 81
     },
     {
      "ordinal": 6,
      "level": "chapter",
      "title": "參、食品安全管理措施與食品業者之職業自由",
      "page_number": 19,
      "print_page": 81
     },
     {
      "ordinal": 7,
      "level": "section",
      "title": "一、食品安全管理措施涉及職業自由之保障範圍",
      "page_number": 19,
      "print_page": 81
     },
     {
      "ordinal": 8,
      "level": "section",
      "title": "二、食品安全管理措施限制職業自由之正當性",
      "page_number": 26,
      "print_page": 88
     },
     {
      "ordinal": 9,
      "level": "section",
      "title": "三、本文分析",
      "page_number": 34,
      "print_page": 96
     },
     {
      "ordinal": 10,
      "level": "chapter",
      "title": "肆、食品安全管理措施與財產權保障",
      "page_number": 36,
      "print_page": 98
     },
     {
      "ordinal": 11,
      "level": "section",
      "title": "一、食品安全管理措施涉及財產權之保障範圍",
      "page_number": 36,
      "print_page": 98
     },
     {
      "ordinal": 12,
      "level": "section",
      "title": "二、食品安全管理措施限制財產權之正當性",
      "page_number": 41,
      "print_page": 102
     },
     {
      "ordinal": 13,
      "level": "section",
      "title": "三、本文分析",
      "page_number": 46,
      "print_page": 107
     },
     {
      "ordinal": 14,
      "level": "chapter",
      "title": "伍、食品安全管理措施與食品業者之資訊自決權",
      "page_number": 47,
      "print_page": 109
     },
     {
      "ordinal": 15,
      "level": "section",
      "title": "一、食品安全管理措施涉及資訊自決權之保障範圍",
      "page_number": 48,
      "print_page": 109
     },
     {
      "ordinal": 16,
      "level": "section",
      "title": "二、食品安全管理措施干預食品業者資訊自決權之正當性",
      "page_number": 50,
      "print_page": 111
     },
     {
      "ordinal": 17,
      "level": "section",
      "title": "三、本文分析",
      "page_number": 60,
      "print_page": 120
     },
     {
      "ordinal": 18,
      "level": "chapter",
      "title": "陸、德國司法實務見解之啟發與借鏡",
      "page_number": 63,
      "print_page": 123
     },
     {
      "ordinal": 19,
      "level": "section",
      "title": "一、食品法有秩序法及經濟法之功能",
      "page_number": 63,
      "print_page": 123
     },
     {
      "ordinal": 20,
      "level": "section",
      "title": "二、非行使公權力之資訊行為亦可能造成基本權利之嚴重影響",
      "page_number": 64,
      "print_page": 124
     },
     {
      "ordinal": 21,
      "level": "section",
      "title": "三、資訊行政之法治國要求",
      "page_number": 65,
      "print_page": 125
     },
     {
      "ordinal": 22,
      "level": "section",
      "title": "四、立法者有形成自由仍應顧及食品業者之基本權利",
      "page_number": 65,
      "print_page": 126
     },
     {
      "ordinal": 23,
      "level": "section",
      "title": "五、食品安全為食品業者之責任",
      "page_number": 66,
      "print_page": 126
     },
     {
      "ordinal": 24,
      "level": "section",
      "title": "六、限制食品業者基本權利之公益理由擴張",
      "page_number": 67,
      "print_page": 127
     },
     {
      "ordinal": 25,
      "level": "chapter",
      "title": "柒、結語",
      "page_number": 67,
      "print_page": 128
     }
    ]
    ,
    /* 林昱梅〈食品安全管理措施…〉排版版（2026-10-14 重新排版匯入） */
    "7776d706-a26a-40c0-9301-140ee42a33b7": [
     {
      "ordinal": 0,
      "level": "chapter",
      "title": "摘要",
      "page_number": 1
     },
     {
      "ordinal": 1,
      "level": "chapter",
      "title": "壹、前言",
      "page_number": 2
     },
     {
      "ordinal": 2,
      "level": "chapter",
      "title": "貳、食品法之目標及規範模式",
      "page_number": 3
     },
     {
      "ordinal": 3,
      "level": "section",
      "title": "一、濫用原則下之食品安全管理措施",
      "page_number": 4
     },
     {
      "ordinal": 4,
      "level": "section",
      "title": "二、禁止原則之例外許可制",
      "page_number": 8
     },
     {
      "ordinal": 5,
      "level": "section",
      "title": "三、透明原則下之資訊公開與提供",
      "page_number": 11
     },
     {
      "ordinal": 6,
      "level": "article",
      "title": "（一）德國消費者資訊法之資訊公開請求權",
      "page_number": 14
     },
     {
      "ordinal": 7,
      "level": "article",
      "title": "（二）德國食品法之主動公開資訊",
      "page_number": 16
     },
     {
      "ordinal": 8,
      "level": "section",
      "title": "四、本文分析",
      "page_number": 20
     },
     {
      "ordinal": 9,
      "level": "chapter",
      "title": "參、食品安全管理措施與食品業者之職業自由",
      "page_number": 21
     },
     {
      "ordinal": 10,
      "level": "section",
      "title": "一、食品安全管理措施涉及職業自由之保障範圍",
      "page_number": 21
     },
     {
      "ordinal": 11,
      "level": "article",
      "title": "（一）公布葡萄酒含二甘醇檢驗清單案",
      "page_number": 22
     },
     {
      "ordinal": 12,
      "level": "article",
      "title": "（二）基因牛奶宣稱案",
      "page_number": 28
     },
     {
      "ordinal": 13,
      "level": "section",
      "title": "二、食品安全管理措施限制職業自由之正當性",
      "page_number": 30
     },
     {
      "ordinal": 14,
      "level": "article",
      "title": "（一）主觀條件之限制",
      "page_number": 30
     },
     {
      "ordinal": 15,
      "level": "article",
      "title": "（二）執行職業自由之限制",
      "page_number": 31
     },
     {
      "ordinal": 16,
      "level": "article",
      "title": "1. 執行職業規範與立法者形成自由",
      "page_number": 31
     },
     {
      "ordinal": 17,
      "level": "article",
      "title": "2. 強制或禁止措施",
      "page_number": 37
     },
     {
      "ordinal": 18,
      "level": "article",
      "title": "3. 預防義務、良好專業規範、人員資格與設備要求",
      "page_number": 40
     },
     {
      "ordinal": 19,
      "level": "section",
      "title": "三、本文分析",
      "page_number": 41
     },
     {
      "ordinal": 20,
      "level": "chapter",
      "title": "肆、食品安全管理措施與財產權保障",
      "page_number": 43
     },
     {
      "ordinal": 21,
      "level": "section",
      "title": "一、食品安全管理措施涉及財產權之保障範圍",
      "page_number": 43
     },
     {
      "ordinal": 22,
      "level": "section",
      "title": "二、食品安全管理措施限制財產權之正當性",
      "page_number": 49
     },
     {
      "ordinal": 23,
      "level": "article",
      "title": "（一）基因科技法保護相鄰土地之規範",
      "page_number": 49
     },
     {
      "ordinal": 24,
      "level": "article",
      "title": "（二）業者請求抽樣檢驗補償",
      "page_number": 54
     },
     {
      "ordinal": 25,
      "level": "section",
      "title": "三、本文分析",
      "page_number": 55
     },
     {
      "ordinal": 26,
      "level": "chapter",
      "title": "伍、食品安全管理措施與食品業者之資訊自決權",
      "page_number": 57
     },
     {
      "ordinal": 27,
      "level": "section",
      "title": "一、食品安全管理措施涉及資訊自決權之保障範圍",
      "page_number": 57
     },
     {
      "ordinal": 28,
      "level": "section",
      "title": "二、食品安全管理措施干預食品業者資訊自決權之正當性",
      "page_number": 59
     },
     {
      "ordinal": 29,
      "level": "article",
      "title": "（一）基因改造生物種植地登錄規定",
      "page_number": 60
     },
     {
      "ordinal": 30,
      "level": "article",
      "title": "（二）食品業者評價資訊公開",
      "page_number": 63
     },
     {
      "ordinal": 31,
      "level": "article",
      "title": "（三）食品業者違規資訊之網路公開",
      "page_number": 67
     },
     {
      "ordinal": 32,
      "level": "section",
      "title": "三、本文分析",
      "page_number": 73
     },
     {
      "ordinal": 33,
      "level": "chapter",
      "title": "陸、德國司法實務見解之啟發與借鏡",
      "page_number": 75
     },
     {
      "ordinal": 34,
      "level": "section",
      "title": "一、食品法有秩序法及經濟法之功能",
      "page_number": 75
     },
     {
      "ordinal": 35,
      "level": "section",
      "title": "二、非行使公權力之資訊行為亦可能造成基本權利之嚴重影響",
      "page_number": 76
     },
     {
      "ordinal": 36,
      "level": "section",
      "title": "三、資訊行政之法治國要求",
      "page_number": 76
     },
     {
      "ordinal": 37,
      "level": "section",
      "title": "四、立法者有形成自由仍應顧及食品業者之基本權利",
      "page_number": 77
     },
     {
      "ordinal": 38,
      "level": "section",
      "title": "五、食品安全為食品業者之責任",
      "page_number": 77
     },
     {
      "ordinal": 39,
      "level": "section",
      "title": "六、限制食品業者基本權利之公益理由擴張",
      "page_number": 78
     },
     {
      "ordinal": 40,
      "level": "chapter",
      "title": "柒、結語",
      "page_number": 79
     },
     {
      "ordinal": 41,
      "level": "chapter",
      "title": "參考文獻",
      "page_number": 80
     },
     {
      "ordinal": 42,
      "level": "section",
      "title": "1.中文部分",
      "page_number": 80
     },
     {
      "ordinal": 43,
      "level": "section",
      "title": "2.外文部分",
      "page_number": 81
     },
     {
      "ordinal": 44,
      "level": "chapter",
      "title": "English Abstract",
      "page_number": 85
     }
    ]
  };
  var orig = E.fetchRemoteToc;
  E.fetchRemoteToc = function (ebookId) {
    var o = OVERRIDES[String(ebookId)];
    if (o) return Promise.resolve(o.map(function (x) { return Object.assign({ ebook_id: ebookId }, x); }));
    return orig.apply(this, arguments);
  };
})();
