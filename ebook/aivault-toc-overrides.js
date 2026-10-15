/* ADD-only：只覆寫指定電子書的目次（林昱梅、林来梵、姜明安等），其他書與功能不變。
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
    ,
    /* 林来梵《宪法学讲义（第四版）》（2026-10-14 排版匯入，含插圖） */
    "e0bc8c57-646d-474c-988e-d6cb3d4f8972": [
     {
      "ordinal": 0,
      "level": "chapter",
      "title": "作者简介",
      "page_number": 1
     },
     {
      "ordinal": 1,
      "level": "chapter",
      "title": "第四版序",
      "page_number": 1
     },
     {
      "ordinal": 2,
      "level": "chapter",
      "title": "第三版弁言",
      "page_number": 3
     },
     {
      "ordinal": 3,
      "level": "chapter",
      "title": "第二版弁言",
      "page_number": 4
     },
     {
      "ordinal": 4,
      "level": "chapter",
      "title": "第一版弁言",
      "page_number": 5
     },
     {
      "ordinal": 5,
      "level": "part",
      "title": "导论",
      "page_number": 6
     },
     {
      "ordinal": 6,
      "level": "section",
      "title": "一、学科名称：“宪法”还是“宪法学”?",
      "page_number": 18
     },
     {
      "ordinal": 7,
      "level": "section",
      "title": "二、宪法学的研究对象",
      "page_number": 18
     },
     {
      "ordinal": 8,
      "level": "section",
      "title": "三、宪法学的学科体系",
      "page_number": 23
     },
     {
      "ordinal": 9,
      "level": "section",
      "title": "四、宪法学的研究方法",
      "page_number": 30
     },
     {
      "ordinal": 10,
      "level": "part",
      "title": "第一编　宪法总论",
      "page_number": 32
     },
     {
      "ordinal": 11,
      "level": "chapter",
      "title": "第一章　宪法的概念与本质",
      "page_number": 35
     },
     {
      "ordinal": 12,
      "level": "section",
      "title": "一、“宪法”的多义性",
      "page_number": 36
     },
     {
      "ordinal": 13,
      "level": "section",
      "title": "二、一个有争议的概念：宪政",
      "page_number": 43
     },
     {
      "ordinal": 14,
      "level": "section",
      "title": "三、宪法的属性：宪法是“公法”吗？",
      "page_number": 51
     },
     {
      "ordinal": 15,
      "level": "section",
      "title": "四、宪法的地位：宪法是“母法”吗？",
      "page_number": 51
     },
     {
      "ordinal": 16,
      "level": "section",
      "title": "五、宪法的本质：宪法究竟是什么？",
      "page_number": 56
     },
     {
      "ordinal": 17,
      "level": "chapter",
      "title": "第二章　宪法的分类与结构",
      "page_number": 59
     },
     {
      "ordinal": 18,
      "level": "section",
      "title": "一、宪法的分类",
      "page_number": 60
     },
     {
      "ordinal": 19,
      "level": "article",
      "title": "（一）传统的分类学说",
      "page_number": 61
     },
     {
      "ordinal": 20,
      "level": "article",
      "title": "（二）现代的宪法分类",
      "page_number": 64
     },
     {
      "ordinal": 21,
      "level": "section",
      "title": "二、宪法的结构",
      "page_number": 68
     },
     {
      "ordinal": 22,
      "level": "article",
      "title": "（一）宪法存在形式的结构：宪法渊源",
      "page_number": 69
     },
     {
      "ordinal": 23,
      "level": "article",
      "title": "（二）宪法典的一般结构",
      "page_number": 80
     },
     {
      "ordinal": 24,
      "level": "article",
      "title": "（三）宪法规范及其结构",
      "page_number": 82
     },
     {
      "ordinal": 25,
      "level": "chapter",
      "title": "第三章　宪法的制定与修改",
      "page_number": 89
     },
     {
      "ordinal": 26,
      "level": "section",
      "title": "一、宪法的制定",
      "page_number": 89
     },
     {
      "ordinal": 27,
      "level": "article",
      "title": "（一）有关宪法制定的理论：宪法制定权力论",
      "page_number": 90
     },
     {
      "ordinal": 28,
      "level": "article",
      "title": "（二）宪法制定的历史掠影",
      "page_number": 100
     },
     {
      "ordinal": 29,
      "level": "section",
      "title": "二、宪法的修改",
      "page_number": 110
     },
     {
      "ordinal": 30,
      "level": "article",
      "title": "（一）概述",
      "page_number": 110
     },
     {
      "ordinal": 31,
      "level": "article",
      "title": "（二）宪法修改的界限",
      "page_number": 112
     },
     {
      "ordinal": 32,
      "level": "article",
      "title": "（三）宪法修改的形式",
      "page_number": 115
     },
     {
      "ordinal": 33,
      "level": "article",
      "title": "（四）宪法修改的程序",
      "page_number": 117
     },
     {
      "ordinal": 34,
      "level": "chapter",
      "title": "第四章　宪法的解释与运用",
      "page_number": 119
     },
     {
      "ordinal": 35,
      "level": "section",
      "title": "一、宪法解释的含义",
      "page_number": 120
     },
     {
      "ordinal": 36,
      "level": "section",
      "title": "二、宪法解释的功能",
      "page_number": 136
     },
     {
      "ordinal": 37,
      "level": "section",
      "title": "三、宪法解释的类型与方法",
      "page_number": 137
     },
     {
      "ordinal": 38,
      "level": "section",
      "title": "四、宪法解释的原则",
      "page_number": 142
     },
     {
      "ordinal": 39,
      "level": "section",
      "title": "五、宪法解释与宪法运用",
      "page_number": 144
     },
     {
      "ordinal": 40,
      "level": "article",
      "title": "（一）何谓宪法运用？",
      "page_number": 144
     },
     {
      "ordinal": 41,
      "level": "article",
      "title": "（二）宪法解释和宪法运用的关系",
      "page_number": 145
     },
     {
      "ordinal": 42,
      "level": "article",
      "title": "（三）宪法司法适用的条件",
      "page_number": 146
     },
     {
      "ordinal": 43,
      "level": "section",
      "title": "六、我国的宪法解释与宪法运用",
      "page_number": 147
     },
     {
      "ordinal": 44,
      "level": "article",
      "title": "（一）我国的宪法解释",
      "page_number": 147
     },
     {
      "ordinal": 45,
      "level": "article",
      "title": "（二）我国的宪法运用",
      "page_number": 150
     },
     {
      "ordinal": 46,
      "level": "part",
      "title": "第二编　国家组织",
      "page_number": 153
     },
     {
      "ordinal": 47,
      "level": "chapter",
      "title": "第五章　国家的诸观念",
      "page_number": 154
     },
     {
      "ordinal": 48,
      "level": "section",
      "title": "一、关于国家的本质",
      "page_number": 154
     },
     {
      "ordinal": 49,
      "level": "section",
      "title": "二、几种经典的国家观",
      "page_number": 155
     },
     {
      "ordinal": 50,
      "level": "article",
      "title": "（一）政治学的国家观",
      "page_number": 155
     },
     {
      "ordinal": 51,
      "level": "article",
      "title": "（二）哲学的国家观",
      "page_number": 157
     },
     {
      "ordinal": 52,
      "level": "article",
      "title": "（三）近代政治哲学的国家观",
      "page_number": 157
     },
     {
      "ordinal": 53,
      "level": "article",
      "title": "（四）社会学的国家观",
      "page_number": 161
     },
     {
      "ordinal": 54,
      "level": "article",
      "title": "（五）政治经济学的国家观",
      "page_number": 161
     },
     {
      "ordinal": 55,
      "level": "article",
      "title": "（六）法学的国家观",
      "page_number": 162
     },
     {
      "ordinal": 56,
      "level": "section",
      "title": "三、中国的国家观",
      "page_number": 166
     },
     {
      "ordinal": 57,
      "level": "article",
      "title": "（一）中国古代的国家观",
      "page_number": 167
     },
     {
      "ordinal": 58,
      "level": "article",
      "title": "（二）中国近代的国家观",
      "page_number": 170
     },
     {
      "ordinal": 59,
      "level": "article",
      "title": "（三）当今中国人的国家观及其窘境",
      "page_number": 170
     },
     {
      "ordinal": 60,
      "level": "section",
      "title": "四、当今中国人国家观之反思：宪法学的立场",
      "page_number": 173
     },
     {
      "ordinal": 61,
      "level": "article",
      "title": "（一）法学国家观极为不足",
      "page_number": 173
     },
     {
      "ordinal": 62,
      "level": "article",
      "title": "（二）阶级国家论忽视了正当性要素",
      "page_number": 173
     },
     {
      "ordinal": 63,
      "level": "article",
      "title": "（三）国家统合的原理：国家三要素说的盲点",
      "page_number": 176
     },
     {
      "ordinal": 64,
      "level": "section",
      "title": "五、国家的目的",
      "page_number": 182
     },
     {
      "ordinal": 65,
      "level": "chapter",
      "title": "第六章　国家类型学：国体与政体",
      "page_number": 184
     },
     {
      "ordinal": 66,
      "level": "section",
      "title": "一、国家类型学的源流",
      "page_number": 185
     },
     {
      "ordinal": 67,
      "level": "article",
      "title": "（一）政治哲学的经典分类",
      "page_number": 185
     },
     {
      "ordinal": 68,
      "level": "article",
      "title": "（二）一般国家学的经典分类",
      "page_number": 188
     },
     {
      "ordinal": 69,
      "level": "article",
      "title": "（三）法学的经典分类",
      "page_number": 189
     },
     {
      "ordinal": 70,
      "level": "section",
      "title": "二、从国体到国家性质",
      "page_number": 192
     },
     {
      "ordinal": 71,
      "level": "article",
      "title": "（一）国家性质与国家本质",
      "page_number": 192
     },
     {
      "ordinal": 72,
      "level": "article",
      "title": "（二）国体概念的源流",
      "page_number": 192
     },
     {
      "ordinal": 73,
      "level": "article",
      "title": "（三）我国现行宪法中的国体条款",
      "page_number": 193
     },
     {
      "ordinal": 74,
      "level": "section",
      "title": "三、从政体到国家形态",
      "page_number": 203
     },
     {
      "ordinal": 75,
      "level": "article",
      "title": "（一）国家权力组织形态",
      "page_number": 203
     },
     {
      "ordinal": 76,
      "level": "article",
      "title": "（二）国家结合形态",
      "page_number": 213
     },
     {
      "ordinal": 77,
      "level": "article",
      "title": "（三）国家象征形态",
      "page_number": 222
     },
     {
      "ordinal": 78,
      "level": "chapter",
      "title": "第七章　国家机构原理",
      "page_number": 222
     },
     {
      "ordinal": 79,
      "level": "section",
      "title": "一、国家机构的基础理论",
      "page_number": 223
     },
     {
      "ordinal": 80,
      "level": "article",
      "title": "（一）国家机构的定义",
      "page_number": 223
     },
     {
      "ordinal": 81,
      "level": "article",
      "title": "（二）国家机构的原理",
      "page_number": 224
     },
     {
      "ordinal": 82,
      "level": "section",
      "title": "二、民主集中制的理论基础：国家组织的基本原理",
      "page_number": 237
     },
     {
      "ordinal": 83,
      "level": "article",
      "title": "（一）主权原理与代表制原理",
      "page_number": 237
     },
     {
      "ordinal": 84,
      "level": "article",
      "title": "（二）党的领导与国家机构的关系",
      "page_number": 244
     },
     {
      "ordinal": 85,
      "level": "chapter",
      "title": "第八章　国家机构体系",
      "page_number": 247
     },
     {
      "ordinal": 86,
      "level": "section",
      "title": "一、国家机构的宪法地位",
      "page_number": 248
     },
     {
      "ordinal": 87,
      "level": "section",
      "title": "二、各国家机关",
      "page_number": 248
     },
     {
      "ordinal": 88,
      "level": "article",
      "title": "（一）全国人民代表大会",
      "page_number": 250
     },
     {
      "ordinal": 89,
      "level": "article",
      "title": "（二）国家主席",
      "page_number": 256
     },
     {
      "ordinal": 90,
      "level": "article",
      "title": "（三）国务院",
      "page_number": 260
     },
     {
      "ordinal": 91,
      "level": "article",
      "title": "（四）中央军事委员会",
      "page_number": 262
     },
     {
      "ordinal": 92,
      "level": "article",
      "title": "（五）地方各级人大和地方各级人民政府",
      "page_number": 262
     },
     {
      "ordinal": 93,
      "level": "article",
      "title": "（六）民族自治地方的自治机关",
      "page_number": 263
     },
     {
      "ordinal": 94,
      "level": "article",
      "title": "（七）监察委员会",
      "page_number": 265
     },
     {
      "ordinal": 95,
      "level": "article",
      "title": "（八）人民法院和人民检察院",
      "page_number": 268
     },
     {
      "ordinal": 96,
      "level": "section",
      "title": "三、各机关之间的关系：案例分析",
      "page_number": 271
     },
     {
      "ordinal": 97,
      "level": "article",
      "title": "（一）黑龙江恢复强制婚检事件",
      "page_number": 271
     },
     {
      "ordinal": 98,
      "level": "article",
      "title": "（二）李慧娟法官事件",
      "page_number": 274
     },
     {
      "ordinal": 99,
      "level": "article",
      "title": "（三）法院工作报告未获人大通过事件",
      "page_number": 277
     },
     {
      "ordinal": 100,
      "level": "part",
      "title": "第三编　基本权利",
      "page_number": 278
     },
     {
      "ordinal": 101,
      "level": "chapter",
      "title": "第九章　基本权利及其类型",
      "page_number": 280
     },
     {
      "ordinal": 102,
      "level": "section",
      "title": "一、宪法与基本权利",
      "page_number": 280
     },
     {
      "ordinal": 103,
      "level": "article",
      "title": "（一）基本权利的内涵",
      "page_number": 280
     },
     {
      "ordinal": 104,
      "level": "article",
      "title": "（二）基本权利的（基本）性质",
      "page_number": 286
     },
     {
      "ordinal": 105,
      "level": "article",
      "title": "（三）基本权利的享有主体",
      "page_number": 291
     },
     {
      "ordinal": 106,
      "level": "section",
      "title": "二、基本权利的类型",
      "page_number": 299
     },
     {
      "ordinal": 107,
      "level": "article",
      "title": "（一）学理分类",
      "page_number": 299
     },
     {
      "ordinal": 108,
      "level": "article",
      "title": "（二）解释学意义上的分类",
      "page_number": 313
     },
     {
      "ordinal": 109,
      "level": "chapter",
      "title": "第十章　基本权利的保障及规范效力",
      "page_number": 321
     },
     {
      "ordinal": 110,
      "level": "section",
      "title": "一、基本权利的保障与限制",
      "page_number": 321
     },
     {
      "ordinal": 111,
      "level": "article",
      "title": "（一）基本权利的保障",
      "page_number": 321
     },
     {
      "ordinal": 112,
      "level": "article",
      "title": "（二）基本权利的限制",
      "page_number": 329
     },
     {
      "ordinal": 113,
      "level": "section",
      "title": "二、人权规范的效力范围",
      "page_number": 348
     },
     {
      "ordinal": 114,
      "level": "article",
      "title": "（一）传统上：无效力原理",
      "page_number": 348
     },
     {
      "ordinal": 115,
      "level": "article",
      "title": "（二）现代宪法下：有效力原理",
      "page_number": 351
     },
     {
      "ordinal": 116,
      "level": "article",
      "title": "（三）中国的问题",
      "page_number": 355
     },
     {
      "ordinal": 117,
      "level": "chapter",
      "title": "第十一章　平等权与政治权利",
      "page_number": 357
     },
     {
      "ordinal": 118,
      "level": "section",
      "title": "一、平等权",
      "page_number": 358
     },
     {
      "ordinal": 119,
      "level": "article",
      "title": "（一）如何理解平等权？",
      "page_number": 363
     },
     {
      "ordinal": 120,
      "level": "article",
      "title": "（二）两种“平等”原理",
      "page_number": 366
     },
     {
      "ordinal": 121,
      "level": "article",
      "title": "（三）法律适用上的平等与法律内容上的平等",
      "page_number": 371
     },
     {
      "ordinal": 122,
      "level": "article",
      "title": "（四）平等与合理差别",
      "page_number": 373
     },
     {
      "ordinal": 123,
      "level": "article",
      "title": "（五）案例分析",
      "page_number": 377
     },
     {
      "ordinal": 124,
      "level": "section",
      "title": "二、政治权利",
      "page_number": 380
     },
     {
      "ordinal": 125,
      "level": "article",
      "title": "（一）政治权利概述",
      "page_number": 380
     },
     {
      "ordinal": 126,
      "level": "article",
      "title": "（二）政治权利的具体类型",
      "page_number": 381
     },
     {
      "ordinal": 127,
      "level": "chapter",
      "title": "第十二章　精神自由与人身自由",
      "page_number": 385
     },
     {
      "ordinal": 128,
      "level": "section",
      "title": "一、精神自由",
      "page_number": 386
     },
     {
      "ordinal": 129,
      "level": "article",
      "title": "（一）表达自由",
      "page_number": 386
     },
     {
      "ordinal": 130,
      "level": "article",
      "title": "（二）宗教信仰自由",
      "page_number": 390
     },
     {
      "ordinal": 131,
      "level": "article",
      "title": "（三）通信自由和通信秘密",
      "page_number": 394
     },
     {
      "ordinal": 132,
      "level": "article",
      "title": "（四）文化活动的自由",
      "page_number": 394
     },
     {
      "ordinal": 133,
      "level": "section",
      "title": "二、人身自由与人格尊严",
      "page_number": 395
     },
     {
      "ordinal": 134,
      "level": "article",
      "title": "（一）人身自由",
      "page_number": 395
     },
     {
      "ordinal": 135,
      "level": "article",
      "title": "（二）人格尊严",
      "page_number": 400
     },
     {
      "ordinal": 136,
      "level": "chapter",
      "title": "第十三章　社会经济权利与权利救济权",
      "page_number": 405
     },
     {
      "ordinal": 137,
      "level": "section",
      "title": "一、社会经济权利",
      "page_number": 405
     },
     {
      "ordinal": 138,
      "level": "article",
      "title": "（一）社会经济权利的类别",
      "page_number": 406
     },
     {
      "ordinal": 139,
      "level": "article",
      "title": "（二）私有财产权",
      "page_number": 407
     },
     {
      "ordinal": 140,
      "level": "article",
      "title": "（三）劳动权",
      "page_number": 417
     },
     {
      "ordinal": 141,
      "level": "article",
      "title": "（四）休息权",
      "page_number": 418
     },
     {
      "ordinal": 142,
      "level": "article",
      "title": "（五）退休后生活受保障权",
      "page_number": 419
     },
     {
      "ordinal": 143,
      "level": "article",
      "title": "（六）生存权",
      "page_number": 419
     },
     {
      "ordinal": 144,
      "level": "article",
      "title": "（七）受教育权",
      "page_number": 420
     },
     {
      "ordinal": 145,
      "level": "section",
      "title": "二、权利救济权",
      "page_number": 422
     },
     {
      "ordinal": 146,
      "level": "article",
      "title": "（一）诉愿权",
      "page_number": 422
     },
     {
      "ordinal": 147,
      "level": "article",
      "title": "（二）裁判请求权",
      "page_number": 424
     },
     {
      "ordinal": 148,
      "level": "article",
      "title": "（三）合宪性审查建议权",
      "page_number": 425
     },
     {
      "ordinal": 149,
      "level": "part",
      "title": "第四编　宪法保障",
      "page_number": 428
     },
     {
      "ordinal": 150,
      "level": "chapter",
      "title": "第十四章　宪法实施与合宪性审查",
      "page_number": 428
     },
     {
      "ordinal": 151,
      "level": "section",
      "title": "一、宪法实施",
      "page_number": 429
     },
     {
      "ordinal": 152,
      "level": "article",
      "title": "（一）有关宪法实施",
      "page_number": 429
     },
     {
      "ordinal": 153,
      "level": "article",
      "title": "（二）中国转型期宪法的实施形态",
      "page_number": 431
     },
     {
      "ordinal": 154,
      "level": "section",
      "title": "二、宪法的保障",
      "page_number": 432
     },
     {
      "ordinal": 155,
      "level": "article",
      "title": "（一）宪法保障之概述",
      "page_number": 432
     },
     {
      "ordinal": 156,
      "level": "article",
      "title": "（二）合宪性审查：最重要的宪法保障制度",
      "page_number": 435
     },
     {
      "ordinal": 157,
      "level": "article",
      "title": "（三）我国的合宪性审查制度",
      "page_number": 451
     },
     {
      "ordinal": 158,
      "level": "part",
      "title": "附录",
      "page_number": 464
     },
     {
      "ordinal": 159,
      "level": "section",
      "title": "一、法科初学者《宪法学》课程精选推荐书单",
      "page_number": 464
     },
     {
      "ordinal": 160,
      "level": "section",
      "title": "二、《宪法学》课程体系化进阶学习推荐书单",
      "page_number": 465
     }
    ],
    "840b333d-4329-4d47-80e2-a1b9d92aec03": [
      {
        "title": "第一编绪论",
        "level": "part",
        "print_page": 1,
        "page_number": 50,
        "ordinal": 0
      },
      {
        "title": "第一章行政法学的基本概念",
        "level": "chapter",
        "print_page": 1,
        "page_number": 50,
        "ordinal": 1
      },
      {
        "title": "第二章行政法的法源",
        "level": "chapter",
        "print_page": 44,
        "page_number": 93,
        "ordinal": 2
      },
      {
        "title": "第三章行政法的基本原则",
        "level": "chapter",
        "print_page": 63,
        "page_number": 112,
        "ordinal": 3
      },
      {
        "title": "第四章数字行政法和应急行政法",
        "level": "chapter",
        "print_page": 82,
        "page_number": 131,
        "ordinal": 4
      },
      {
        "title": "第二编行政法主体",
        "level": "part",
        "print_page": 93,
        "page_number": 142,
        "ordinal": 5
      },
      {
        "title": "第五章行政法主体概述",
        "level": "chapter",
        "print_page": 93,
        "page_number": 142,
        "ordinal": 6
      },
      {
        "title": "第六章行政机关",
        "level": "chapter",
        "print_page": 101,
        "page_number": 150,
        "ordinal": 7
      },
      {
        "title": "第七章其他行政主体",
        "level": "chapter",
        "print_page": 115,
        "page_number": 164,
        "ordinal": 8
      },
      {
        "title": "第八章公务员",
        "level": "chapter",
        "print_page": 127,
        "page_number": 176,
        "ordinal": 9
      },
      {
        "title": "第九章行政相对人",
        "level": "chapter",
        "print_page": 140,
        "page_number": 189,
        "ordinal": 10
      },
      {
        "title": "第十章行政法制监督主体",
        "level": "chapter",
        "print_page": 148,
        "page_number": 197,
        "ordinal": 11
      },
      {
        "title": "第三编行政行为",
        "level": "part",
        "print_page": 161,
        "page_number": 210,
        "ordinal": 12
      },
      {
        "title": "第十一章行政行为概述",
        "level": "chapter",
        "print_page": 161,
        "page_number": 210,
        "ordinal": 13
      },
      {
        "title": "第十二章行政立法",
        "level": "chapter",
        "print_page": 173,
        "page_number": 222,
        "ordinal": 14
      },
      {
        "title": "第十三章行政规范性文件",
        "level": "chapter",
        "print_page": 187,
        "page_number": 236,
        "ordinal": 15
      },
      {
        "title": "第十四章具体行政行为",
        "level": "chapter",
        "print_page": 198,
        "page_number": 247,
        "ordinal": 16
      },
      {
        "title": "第十五章行政处理(一)依申请行政行为",
        "level": "chapter",
        "print_page": 224,
        "page_number": 273,
        "ordinal": 17
      },
      {
        "title": "第十六章行政处理(二)依职权行政行为",
        "level": "chapter",
        "print_page": 262,
        "page_number": 311,
        "ordinal": 18
      },
      {
        "title": "第十七章行政机关实施的其他行为",
        "level": "chapter",
        "print_page": 312,
        "page_number": 361,
        "ordinal": 19
      },
      {
        "title": "第十八章行政程序",
        "level": "chapter",
        "print_page": 337,
        "page_number": 386,
        "ordinal": 20
      },
      {
        "title": "第四编行政复议",
        "level": "part",
        "print_page": 368,
        "page_number": 417,
        "ordinal": 21
      },
      {
        "title": "第十九章行政救济概述",
        "level": "chapter",
        "print_page": 368,
        "page_number": 417,
        "ordinal": 22
      },
      {
        "title": "第二十章行政复议概述",
        "level": "chapter",
        "print_page": 378,
        "page_number": 427,
        "ordinal": 23
      },
      {
        "title": "第二十一章行政复议范围",
        "level": "chapter",
        "print_page": 385,
        "page_number": 434,
        "ordinal": 24
      },
      {
        "title": "第二十二章行政复议法律关系主体",
        "level": "chapter",
        "print_page": 396,
        "page_number": 445,
        "ordinal": 25
      },
      {
        "title": "第二十三章行政复议的程序",
        "level": "chapter",
        "print_page": 401,
        "page_number": 450,
        "ordinal": 26
      },
      {
        "title": "第五编行政诉讼",
        "level": "part",
        "print_page": 414,
        "page_number": 463,
        "ordinal": 27
      },
      {
        "title": "第二十四章行政诉讼概述",
        "level": "chapter",
        "print_page": 414,
        "page_number": 463,
        "ordinal": 28
      },
      {
        "title": "第二十五章行政诉讼受案范围",
        "level": "chapter",
        "print_page": 427,
        "page_number": 476,
        "ordinal": 29
      },
      {
        "title": "第二十六章行政诉讼管辖",
        "level": "chapter",
        "print_page": 448,
        "page_number": 497,
        "ordinal": 30
      },
      {
        "title": "第二十七章行政诉讼参加人",
        "level": "chapter",
        "print_page": 462,
        "page_number": 511,
        "ordinal": 31
      },
      {
        "title": "第二十八章行政诉讼证据",
        "level": "chapter",
        "print_page": 478,
        "page_number": 527,
        "ordinal": 32
      },
      {
        "title": "第二十九章行政诉讼程序",
        "level": "chapter",
        "print_page": 500,
        "page_number": 549,
        "ordinal": 33
      },
      {
        "title": "第三十章行政诉讼法律适用",
        "level": "chapter",
        "print_page": 524,
        "page_number": 573,
        "ordinal": 34
      },
      {
        "title": "第三十一章行政诉讼的判决、裁定与决定",
        "level": "chapter",
        "print_page": 537,
        "page_number": 586,
        "ordinal": 35
      },
      {
        "title": "第三十二章行政协议诉讼与行政公益诉讼",
        "level": "chapter",
        "print_page": 558,
        "page_number": 607,
        "ordinal": 36
      },
      {
        "title": "第三十三章涉外行政诉讼",
        "level": "chapter",
        "print_page": 571,
        "page_number": 620,
        "ordinal": 37
      },
      {
        "title": "第三十四章行政诉讼一并解决民事争议",
        "level": "chapter",
        "print_page": 578,
        "page_number": 627,
        "ordinal": 38
      },
      {
        "title": "第六编行政赔偿",
        "level": "part",
        "print_page": 589,
        "page_number": 638,
        "ordinal": 39
      },
      {
        "title": "第三十五章行政赔偿与国家赔偿",
        "level": "chapter",
        "print_page": 589,
        "page_number": 638,
        "ordinal": 40
      },
      {
        "title": "第三十六章行政赔偿范围",
        "level": "chapter",
        "print_page": 607,
        "page_number": 656,
        "ordinal": 41
      },
      {
        "title": "第三十七章行政赔偿请求人和赔偿义务机关",
        "level": "chapter",
        "print_page": 622,
        "page_number": 671,
        "ordinal": 42
      },
      {
        "title": "第三十八章行政赔偿方式和计算标准",
        "level": "chapter",
        "print_page": 632,
        "page_number": 681,
        "ordinal": 43
      },
      {
        "title": "第三十九章行政赔偿程序",
        "level": "chapter",
        "print_page": 641,
        "page_number": 690,
        "ordinal": 44
      },
      {
        "title": "第四十章行政补偿",
        "level": "chapter",
        "print_page": 654,
        "page_number": 703,
        "ordinal": 45
      },
      {
        "title": "附录",
        "level": "chapter",
        "print_page": 666,
        "page_number": 715,
        "ordinal": 46
      },
      {
        "title": "索引",
        "level": "chapter",
        "print_page": 682,
        "page_number": 731,
        "ordinal": 47
      }
    ],
    "97a31aa4-8f72-4794-adf7-ee336411c804": [
      {
        "level": "part",
        "title": "第一部分复习笔记",
        "page_number": 3,
        "print_page": 3,
        "ordinal": 0
      },
      {
        "level": "chapter",
        "title": "引论",
        "page_number": 3,
        "print_page": 3,
        "ordinal": 1
      },
      {
        "level": "part",
        "title": "第一编行政法总论",
        "page_number": 4,
        "print_page": 4,
        "ordinal": 2
      },
      {
        "level": "chapter",
        "title": "第一章行政法概述",
        "page_number": 4,
        "print_page": 4,
        "ordinal": 3
      },
      {
        "level": "chapter",
        "title": "第二章行政法的基本原则",
        "page_number": 7,
        "print_page": 7,
        "ordinal": 4
      },
      {
        "level": "chapter",
        "title": "第三章行政主体",
        "page_number": 12,
        "print_page": 12,
        "ordinal": 5
      },
      {
        "level": "chapter",
        "title": "第四章行政公产",
        "page_number": 16,
        "print_page": 16,
        "ordinal": 6
      },
      {
        "level": "chapter",
        "title": "第五章行政行为概述",
        "page_number": 19,
        "print_page": 19,
        "ordinal": 7
      },
      {
        "level": "chapter",
        "title": "第六章行政立法",
        "page_number": 26,
        "print_page": 26,
        "ordinal": 8
      },
      {
        "level": "chapter",
        "title": "第七章行政许可",
        "page_number": 30,
        "print_page": 30,
        "ordinal": 9
      },
      {
        "level": "chapter",
        "title": "第八章行政处罚",
        "page_number": 36,
        "print_page": 36,
        "ordinal": 10
      },
      {
        "level": "chapter",
        "title": "第九章公务行政",
        "page_number": 42,
        "print_page": 42,
        "ordinal": 11
      },
      {
        "level": "chapter",
        "title": "第十章行政合同",
        "page_number": 45,
        "print_page": 45,
        "ordinal": 12
      },
      {
        "level": "chapter",
        "title": "第十一章行政救济",
        "page_number": 48,
        "print_page": 48,
        "ordinal": 13
      },
      {
        "level": "chapter",
        "title": "第十二章行政复议",
        "page_number": 50,
        "print_page": 50,
        "ordinal": 14
      },
      {
        "level": "part",
        "title": "第二编行政诉讼",
        "page_number": 58,
        "print_page": 58,
        "ordinal": 15
      },
      {
        "level": "chapter",
        "title": "第十三章行政诉讼概述",
        "page_number": 58,
        "print_page": 58,
        "ordinal": 16
      },
      {
        "level": "chapter",
        "title": "第十四章行政诉讼受案范围",
        "page_number": 61,
        "print_page": 61,
        "ordinal": 17
      },
      {
        "level": "chapter",
        "title": "第十五章行政诉讼的管辖",
        "page_number": 66,
        "print_page": 66,
        "ordinal": 18
      },
      {
        "level": "chapter",
        "title": "第十六章行政诉讼参加人",
        "page_number": 68,
        "print_page": 68,
        "ordinal": 19
      },
      {
        "level": "chapter",
        "title": "第十七章行政诉讼证据",
        "page_number": 75,
        "print_page": 75,
        "ordinal": 20
      },
      {
        "level": "chapter",
        "title": "第十八章诉讼程序",
        "page_number": 82,
        "print_page": 82,
        "ordinal": 21
      },
      {
        "level": "chapter",
        "title": "第十九章行政诉讼的特殊制度与规则",
        "page_number": 90,
        "print_page": 90,
        "ordinal": 22
      },
      {
        "level": "chapter",
        "title": "第二十章行政诉讼的结案",
        "page_number": 95,
        "print_page": 95,
        "ordinal": 23
      },
      {
        "level": "part",
        "title": "第三编国家赔偿",
        "page_number": 104,
        "print_page": 104,
        "ordinal": 24
      },
      {
        "level": "chapter",
        "title": "第二十一章国家赔偿与国家赔偿法",
        "page_number": 104,
        "print_page": 104,
        "ordinal": 25
      },
      {
        "level": "chapter",
        "title": "第二十二章国家赔偿的范围",
        "page_number": 106,
        "print_page": 106,
        "ordinal": 26
      },
      {
        "level": "chapter",
        "title": "第二十三章国家赔偿主体",
        "page_number": 111,
        "print_page": 111,
        "ordinal": 27
      },
      {
        "level": "chapter",
        "title": "第二十四章国家赔偿程序",
        "page_number": 113,
        "print_page": 113,
        "ordinal": 28
      },
      {
        "level": "chapter",
        "title": "第二十五章国家赔偿方式与计算标准",
        "page_number": 116,
        "print_page": 116,
        "ordinal": 29
      },
      {
        "level": "part",
        "title": "第二部分名校考研真题详解",
        "page_number": 119,
        "print_page": 119,
        "ordinal": 30
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
