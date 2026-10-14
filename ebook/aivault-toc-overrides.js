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
  };
  var orig = E.fetchRemoteToc;
  E.fetchRemoteToc = function (ebookId) {
    var o = OVERRIDES[String(ebookId)];
    if (o) return Promise.resolve(o.map(function (x) { return Object.assign({ ebook_id: ebookId }, x); }));
    return orig.apply(this, arguments);
  };
})();
