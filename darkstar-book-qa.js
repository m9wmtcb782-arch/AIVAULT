/* 暗星即時語音 × 書架問答：使用者語音提問後，搜尋電子書書架，把相關段落以文字送給暗星。 */
(function (w, d) {
  "use strict";
  var SUPA = "https://clcddygkaaqqtsbswgdf.supabase.co";
  var INGEST = SUPA + "/functions/v1/dark-star-ebook-ingest";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE";
  /* 修正：私人書（只對登入會員開放）以前用匿名金鑰讀，伺服器回 LOGIN_REQUIRED，暗星學不到。有未過期的登入就帶會員 token。關閉：localStorage.studyAuthListOff='1' */
  function qaTok() { try { if (localStorage.getItem("studyAuthListOff") === "1") return ANON; var j = JSON.parse(localStorage.getItem("sb-clcddygkaaqqtsbswgdf-auth-token") || "null"); j = j && (j.currentSession || j); if (j && j.access_token && (!j.expires_at || j.expires_at * 1000 > Date.now() + 30000)) return j.access_token; } catch (e) {} return ANON; }
  var CACHE = "aivault_bookqa_cache_v1", MAXC = 4500;
  var chunks = null, building = null;
  var PRIORITY = { "e0bc8c57-646d-474c-988e-d6cb3d4f8972": 1.25, "840b333d-4329-4d47-80e2-a1b9d92aec03": 1.2, "97a31aa4-8f72-4794-adf7-ee336411c804": 1.15, "9f20615b-fe5d-4abe-93f3-86c7025a866f": 1.1 }; // 林来梵宪法学讲义；姜明安行政法第八版
  // 繁→簡 單字對照（取自 OpenCC tw→cn），只用於比對；顯示仍用原文
  var T2S_RAW = "丟丢並并么幺乾干亂乱亙亘亞亚佇伫佈布佔占併并來来侖仑侶侣侷局俁俣係系俔伣俠侠俥伡俬私倀伥倆俩倈俫倉仓個个們们倖幸倫伦倲㑈偉伟偑㐽側侧偵侦偽伪傌㐷傑杰傖伧傘伞備备傢家傭佣傯偬傳传傴伛債债傷伤傾倾僂偻僅仅僉佥僑侨僕仆僞伪僥侥僨偾僱雇價价儀仪儁俊儂侬億亿儈侩儉俭儎傤儐傧儔俦儕侪儘尽償偿優优儲储儷俪儸㑩儺傩儻傥儼俨兇凶兌兑兒儿兗兖內内兩两冊册冑胄冪幂凈净凍冻凜凛凱凯別别刪删剄刭則则剋克剎刹剗刬剛刚剝剥剮剐剴剀創创剷铲劃划劄札劇剧劉刘劊刽劌刿劍剑劏㓥劑剂劚㔉勁劲動动務务勛勋勝胜勞劳勢势勩勚勱劢勳勋勵励勸劝勻匀匭匦匯汇匱匮區区協协卹恤卻却卽即厙厍厠厕厤历厭厌厲厉厴厣參参叄叁叢丛吒咤吳吴吶呐呂吕咼呙員员唄呗唸念問问啓启啞哑啟启啢唡喎㖞喚唤喪丧喫吃喬乔單单喲哟嗆呛嗇啬嗊唝嗎吗嗚呜嗩唢嗶哔嘆叹嘍喽嘓啯嘔呕嘖啧嘗尝嘜唛嘩哗嘮唠嘯啸嘰叽嘵哓嘸呒嘽啴噁恶噓嘘噚㖊噝咝噠哒噥哝噦哕噯嗳噲哙噴喷噸吨噹当嚀咛嚇吓嚌哜嚐尝嚕噜嚙啮嚥咽嚦呖嚨咙嚮向嚲亸嚳喾嚴严嚶嘤囀啭囁嗫囂嚣囅冁囈呓囉啰囌苏囑嘱囪囱圇囵國国圍围園园圓圆圖图團团垻坝埡垭埰采執执堅坚堊垩堖垴堝埚堯尧報报場场塊块塋茔塏垲塒埘塗涂塚冢塢坞塤埙塵尘塹堑墊垫墜坠墮堕墰坛墳坟墶垯墻墙墾垦壇坛壋垱壎埙壓压壘垒壙圹壚垆壜坛壞坏壟垄壠垅壢坜壩坝壪塆壯壮壺壶壼壸壽寿夠够夢梦夥伙夾夹奐奂奧奥奩奁奪夺奬奖奮奋奼姹妝妆姍姗姦奸娛娱婁娄婦妇婭娅媧娲媯妫媰㛀媼媪媽妈嫋袅嫗妪嫵妩嫺娴嫻娴嫿婳嬀妫嬃媭嬈娆嬋婵嬌娇嬙嫱嬡嫒嬤嬷嬪嫔嬰婴嬸婶孃娘孋㛤孌娈孫孙學学孿孪宮宫寀采寢寝實实寧宁審审寫写寬宽寵宠寶宝將将專专尋寻對对導导尷尴屆届屍尸屓屃屜屉屢屡層层屨屦屬属岡冈峯峰峴岘島岛峽峡崍崃崑昆崗岗崙仑崢峥崬岽嵐岚嵗岁嵾㟥嶁嵝嶄崭嶇岖嶔嵚嶗崂嶠峤嶢峣嶧峄嶨峃嶮崄嶸嵘嶺岭嶼屿嶽岳巋岿巒峦巔巅巖岩巰巯巹卺帥帅師师帳帐帶带幀帧幃帏幓㡎幗帼幘帻幟帜幣币幫帮幬帱幷并幹干幾几庫库廁厕廂厢廄厩廈厦廎庼廕荫廚厨廝厮廟庙廠厂廡庑廢废廣广廩廪廬庐廳厅弒弑弔吊弳弪張张強强彆别彈弹彌弥彎弯彔录彙汇彠彟彥彦彫雕彲彨彿佛後后徑径從从徠徕復复徵征徹彻恆恒恥耻悅悦悞悮悵怅悶闷悽凄惡恶惱恼惲恽惻恻愛爱愜惬愨悫愴怆愷恺愾忾慄栗態态慍愠慘惨慚惭慟恸慣惯慤悫慪怄慫怂慮虑慳悭慶庆慺㥪慼戚慾欲憂忧憊惫憐怜憑凭憒愦憖慭憚惮憤愤憫悯憮怃憲宪憶忆懇恳應应懌怿懍懔懞蒙懟怼懣懑懤㤽懨恹懲惩懶懒懷怀懸悬懺忏懼惧懾慑戀恋戇戆戔戋戧戗戩戬戰战戱戯戲戏戶户扞捍拋抛拚拼挩捝挱挲挾挟捨舍捫扪捱挨捲卷掃扫掄抡掆㧏掗挜掙挣掛挂採采揀拣揚扬換换揮挥揯搄損损搖摇搗捣搧扇搵揾搶抢摑掴摜掼摟搂摯挚摳抠摶抟摺折摻掺撈捞撏挦撐撑撓挠撝㧑撟挢撣掸撥拨撫抚撲扑撳揿撻挞撾挝撿捡擁拥擄掳擇择擊击擋挡擓㧟擔担據据擠挤擡抬擣捣擬拟擯摈擰拧擱搁擲掷擴扩擷撷擺摆擻擞擼撸擽㧰擾扰攄摅攆撵攏拢攔拦攖撄攙搀攛撺攜携攝摄攢攒攣挛攤摊攪搅攬揽敎教敓敚敗败敘叙敵敌數数斂敛斃毙斆敩斕斓斬斩斷断於于旂旗旣既昇升時时晉晋晝昼暈晕暉晖暘旸暢畅暫暂曄晔曆历曇昙曉晓曏向曖暧曠旷曨昽曬晒書书會会朧胧朮术東东枴拐柵栅柺拐査查桿杆梔栀梘枧條条梟枭梲棁棄弃棊棋棖枨棗枣棟栋棡㭎棧栈棲栖棶梾椏桠椲㭏楊杨楓枫楨桢業业極极榘矩榦干榪杩榮荣榲榅榿桤構构槍枪槓杠槤梿槧椠槨椁槮椮槳桨槶椢槼椝樁桩樂乐樅枞樑梁樓楼標标樞枢樢㭤樣样樧榝樫㭴樳桪樸朴樹树樺桦樿椫橈桡橋桥機机橢椭橫横檁檩檉柽檔档檜桧檟槚檢检檣樯檮梼檯台檳槟檸柠檻槛櫃柜櫓橹櫚榈櫛栉櫝椟櫞橼櫟栎櫥橱櫧槠櫨栌櫪枥櫫橥櫬榇櫱蘖櫳栊櫸榉櫻樱欄栏欅榉權权欏椤欒栾欖榄欞棂欽钦歎叹歐欧歟欤歡欢歲岁歷历歸归歿殁殘残殞殒殤殇殨㱮殫殚殭僵殮殓殯殡殰㱩殲歼殺杀殻壳殼壳毀毁毆殴毿毵氂牦氈毡氌氇氣气氫氢氬氩氳氲氾泛汎泛汙污決决沒没沖冲況况泝溯洩泄洶汹浹浃涇泾涗涚涼凉淒凄淚泪淥渌淨净淩凌淪沦淵渊淶涞淺浅渙涣減减渢沨渦涡測测渾浑湊凑湞浈湧涌湯汤溈沩準准溝沟溫温溮浉溳涢溼湿滄沧滅灭滌涤滎荥滙汇滬沪滯滞滲渗滷卤滸浒滻浐滾滚滿满漁渔漊溇漚沤漢汉漣涟漬渍漲涨漵溆漸渐漿浆潀潨潁颍潑泼潔洁潙沩潚㴋潛潜潤润潯浔潰溃潷滗潿涠澀涩澆浇澇涝澐沄澗涧澠渑澤泽澦滪澩泶澮浍澱淀澾㳠濁浊濃浓濄㳡濕湿濘泞濚溁濛蒙濜浕濟济濤涛濧㳔濫滥濰潍濱滨濺溅濼泺濾滤瀂澛瀅滢瀆渎瀇㲿瀉泻瀋沈瀏浏瀕濒瀘泸瀝沥瀟潇瀠潆瀦潴瀧泷瀨濑瀰弥瀲潋瀾澜灃沣灄滠灑洒灕漓灘滩灝灏灡㳕灣湾灤滦灧滟灩滟災灾為为烏乌烴烃無无煉炼煒炜煙烟煢茕煥焕煩烦煬炀煱㶽熅煴熒荧熗炝熱热熲颎熾炽燁烨燈灯燉炖燒烧燙烫燜焖營营燦灿燬毁燭烛燴烩燶㶶燻熏燼烬燾焘爍烁爐炉爛烂爭争爲为爺爷爾尔牀床牆墙牘牍牴抵牽牵犖荦犛牦犢犊犧牺狀状狹狭狽狈猙狰猶犹猻狲獁犸獃呆獄狱獅狮獎奖獨独獪狯獫猃獮狝獰狞獱㺍獲获獵猎獷犷獸兽獺獭獻献獼猕玀猡現现琱雕琺珐琿珲瑋玮瑒玚瑣琐瑤瑶瑩莹瑪玛瑲玱璉琏璡琎璣玑璦瑷璫珰璯㻅環环璵玙璸瑸璽玺璿璇瓊琼瓏珑瓔璎瓚瓒甌瓯甕瓮產产産产畝亩畢毕畫画異异畵画當当疇畴疊叠痙痉痠酸痺痹痾疴瘂痖瘋疯瘍疡瘓痪瘞瘗瘡疮瘧疟瘮瘆瘲疭瘺瘘瘻瘘療疗癆痨癇痫癉瘅癒愈癘疠癟瘪癡痴癢痒癤疖癥症癧疬癩癞癬癣癭瘿癮瘾癰痈癱瘫癲癫發发皁皂皚皑皰疱皸皲皺皱盃杯盜盗盞盏盡尽監监盤盘盧卢盪荡眞真眥眦眾众睏困睜睁睞睐睪睾瞘眍瞜䁖瞞瞒瞶瞆瞼睑矇蒙矓眬矚瞩矯矫硃朱硜硁硤硖硨砗硯砚碕埼碩硕碭砀碸砜確确碼码碽䂵磑硙磚砖磠硵磣碜磧碛磯矶磽硗磾䃅礄硚礎础礙碍礦矿礪砺礫砾礬矾礱砻祕秘祿禄禍祸禎祯禕祎禡祃禦御禪禅禮礼禰祢禱祷禿秃秈籼稅税稈秆稏䅉稜棱稟禀種种稱称穀谷穇䅟穌稣積积穎颖穠秾穡穑穢秽穩稳穫获穭穞窩窝窪洼窮穷窯窑窵窎窶窭窺窥竄窜竅窍竇窦竈灶竊窃竪竖競竞筆笔筍笋筧笕筴䇲箇个箋笺箏筝箚札節节範范築筑篋箧篔筼篠筿篤笃篩筛篳筚簀箦簍篓簑蓑簞箪簡简簣篑簫箫簷檐簹筜簽签簾帘籃篮籌筹籔䉤籙箓籛篯籜箨籟籁籠笼籤签籩笾籪簖籬篱籮箩籲吁粵粤糉粽糝糁糞粪糧粮糰团糲粝糴籴糶粜糹纟糾纠紀纪紂纣約约紅红紆纡紇纥紈纨紉纫紋纹納纳紐纽紓纾純纯紕纰紖纼紗纱紘纮紙纸級级紛纷紜纭紝纴紡纺紬䌷紮扎細细紱绂紲绁紳绅紵纻紹绍紺绀紼绋紿绐絀绌終终絃弦組组絅䌹絆绊絎绗結结絕绝絛绦絝绔絞绞絡络絢绚給给絨绒絰绖統统絲丝絳绛絶绝絹绢綁绑綃绡綆绠綈绨綉绣綌绤綏绥綐䌼綑捆經经綜综綞缍綠绿綢绸綣绻綫线綬绶維维綯绹綰绾綱纲網网綳绷綴缀綵彩綸纶綹绺綺绮綻绽綽绰綾绫綿绵緄绲緇缁緊紧緋绯緑绿緒绪緓绬緔绱緗缃緘缄緙缂線线緝缉緞缎締缔緡缗緣缘緦缌編编緩缓緬缅緯纬緱缑緲缈練练緶缏緹缇緻致緼缊縈萦縉缙縊缢縋缒縐绉縑缣縕缊縗缞縛缚縝缜縞缟縟缛縣县縧绦縫缝縭缡縮缩縱纵縲缧縳䌸縴纤縵缦縶絷縷缕縹缥總总績绩繃绷繅缫繆缪繒缯織织繕缮繚缭繞绕繡绣繢缋繩绳繪绘繫系繭茧繮缰繯缳繰缲繳缴繸䍁繹绎繼继繽缤繾缱繿䍀纇颣纈缬纊纩續续纍累纏缠纓缨纔才纖纤纘缵纜缆缽钵罃䓨罈坛罌罂罎坛罰罚罵骂罷罢羅罗羆罴羈羁羋芈羣群羥羟羨羡義义羶膻習习翫玩翬翚翹翘翽翙耬耧耮耢聖圣聞闻聯联聰聪聲声聳耸聵聩聶聂職职聹聍聽听聾聋肅肃脅胁脈脉脛胫脣唇脩修脫脱脹胀腎肾腖胨腡脶腦脑腫肿腳脚腸肠膃腽膕腘膚肤膞䏝膠胶膩腻膽胆膾脍膿脓臉脸臍脐臏膑臘腊臚胪臟脏臠脔臢臜臥卧臨临臺台與与興兴舉举舊旧舖铺舘馆艙舱艤舣艦舰艫舻艱艰艷艳芻刍苧苎茲兹荊荆莊庄莖茎莢荚莧苋華华菴庵菸烟萇苌萊莱萬万萴荝萵莴葉叶葒荭著着葤荮葦苇葯药葷荤蒐搜蒓莼蒔莳蒕蒀蒞莅蒼苍蓀荪蓆席蓋盖蓮莲蓯苁蓴莼蓽荜蔔卜蔘参蔞蒌蔣蒋蔥葱蔦茑蔭荫蕁荨蕆蒇蕎荞蕒荬蕓芸蕕莸蕘荛蕢蒉蕩荡蕪芜蕭萧蕷蓣薀蕰薈荟薊蓟薌芗薑姜薔蔷薘荙薟莶薦荐薩萨薳䓕薴苧薵䓓薹苔薺荠藍蓝藎荩藝艺藥药藪薮藭䓖藴蕴藶苈藹蔼藺蔺蘀萚蘄蕲蘆芦蘇苏蘊蕴蘋苹蘚藓蘞蔹蘢茏蘭兰蘺蓠蘿萝虆蔂處处虛虚虜虏號号虧亏虯虬蛺蛱蛻蜕蜆蚬蝕蚀蝟猬蝦虾蝨虱蝸蜗螄蛳螞蚂螢萤螮䗖螻蝼螿螀蟄蛰蟈蝈蟎螨蟣虮蟬蝉蟯蛲蟲虫蟶蛏蟻蚁蠁蚃蠅蝇蠆虿蠍蝎蠐蛴蠑蝾蠔蚝蠟蜡蠣蛎蠨蟏蠱蛊蠶蚕蠻蛮衆众衊蔑術术衕同衚胡衛卫衝冲袞衮袷夹裊袅裏里補补裝装裡里製制複复褌裈褘袆褲裤褳裢褸褛褻亵襇裥襉裥襏袯襖袄襝裣襠裆襤褴襪袜襬摆襯衬襲袭襴襕覈核見见覎觃規规覓觅視视覘觇覡觋覥觍覦觎親亲覬觊覯觏覲觐覷觑覺觉覽览覿觌觀观觴觞觶觯觸触訁讠訂订訃讣計计訊讯訌讧討讨訐讦訒讱訓训訕讪訖讫託托記记訛讹訝讶訟讼訢䜣訣诀訥讷訩讻訪访設设許许訴诉訶诃診诊註注証证詁诂詆诋詎讵詐诈詒诒詔诏評评詖诐詗诇詘诎詛诅詞词詠咏詡诩詢询詣诣試试詩诗詫诧詬诟詭诡詮诠詰诘話话該该詳详詵诜詼诙詿诖誄诔誅诛誆诓誇夸誌志認认誑诳誒诶誕诞誘诱誚诮語语誠诚誡诫誣诬誤误誥诰誦诵誨诲說说説说誰谁課课誶谇誹诽誼谊誾訚調调諂谄諄谆談谈諉诿請请諍诤諏诹諑诼諒谅論论諗谂諛谀諜谍諝谞諞谝諡谥諢诨諤谔諦谛諧谐諫谏諭谕諮咨諱讳諳谙諶谌諷讽諸诸諺谚諼谖諾诺謀谋謁谒謂谓謄誊謅诌謊谎謎谜謐谧謔谑謖谡謗谤謙谦謚谥講讲謝谢謠谣謡谣謨谟謫谪謬谬謭谫謳讴謹谨謾谩譁哗證证譎谲譏讥譖谮識识譙谯譚谭譜谱譟噪譫谵譭毁譯译議议譴谴護护譸诪譽誉譾谫讀读讅谉變变讋詟讌䜩讎雠讒谗讓让讕谰讖谶讚赞讜谠讞谳谿溪豈岂豎竖豐丰豔艳豬猪豶豮貍狸貓猫貙䝙貝贝貞贞貟贠負负財财貢贡貧贫貨货販贩貪贪貫贯責责貯贮貰贳貲赀貳贰貴贵貶贬買买貸贷貺贶費费貼贴貽贻貿贸賀贺賁贲賂赂賃赁賄贿賅赅資资賈贾賊贼賑赈賒赊賓宾賕赇賙赒賚赉賜赐賞赏賠赔賡赓賢贤賣卖賤贱賦赋賧赕質质賫赍賬账賭赌賰䞐賴赖賵赗賺赚賻赙購购賽赛賾赜贄贽贅赘贇赟贈赠贊赞贋赝贍赡贏赢贐赆贓赃贔赑贖赎贗赝贛赣贜赃赬赪趕赶趙赵趨趋趲趱跡迹踐践踰逾踴踊蹌跄蹕跸蹟迹蹠跖蹣蹒蹤踪蹺跷躂跶躉趸躊踌躋跻躍跃躎䟢躑踯躒跞躓踬躕蹰躚跹躡蹑躥蹿躦躜躪躏軀躯車车軋轧軌轨軍军軑轪軒轩軔轫軛轭軟软軤轷軫轸軲轱軸轴軹轵軺轺軻轲軼轶軾轼較较輅辂輇辁輈辀載载輊轾輒辄輓挽輔辅輕轻輛辆輜辎輝辉輞辋輟辍輥辊輦辇輩辈輪轮輬辌輯辑輳辏輸输輻辐輼辒輾辗輿舆轀辒轂毂轄辖轅辕轆辘轉转轍辙轎轿轔辚轟轰轡辔轢轹轤轳辦办辭辞辮辫辯辩農农迴回逕径這这連连週周進进遊游運运過过達达違违遙遥遜逊遞递遠远遡溯適适遲迟遶绕遷迁選选遺遗遼辽邁迈還还邇迩邊边邏逻邐逦郟郏郵邮鄆郓鄉乡鄒邹鄔邬鄖郧鄧邓鄭郑鄰邻鄲郸鄴邺鄶郐鄺邝酇酂酈郦醃腌醖酝醜丑醞酝醟蒏醣糖醫医醬酱醱酦釀酿釁衅釃酾釅酽釋释釐厘釒钅釓钆釔钇釕钌釗钊釘钉釙钋針针釣钓釤钐釦扣釧钏釩钒釵钗釷钍釹钕釺钎釾䥺鈀钯鈁钫鈃钘鈄钭鈅钥鈈钚鈉钠鈍钝鈎钩鈐钤鈑钣鈒钑鈔钞鈕钮鈞钧鈡钟鈣钙鈥钬鈦钛鈧钪鈮铌鈰铈鈳钶鈴铃鈷钴鈸钹鈹铍鈺钰鈽钸鈾铀鈿钿鉀钾鉅巨鉆钻鉈铊鉉铉鉋铇鉍铋鉑铂鉕钷鉗钳鉚铆鉛铅鉞钺鉢钵鉤钩鉦钲鉬钼鉭钽鉳锫鉶铏鉸铰鉺铒鉻铬鉿铪銀银銃铳銅铜銍铚銑铣銓铨銖铢銘铭銚铫銛铦銜衔銠铑銣铷銥铱銦铟銨铵銩铥銪铕銫铯銬铐銱铞銳锐銷销銹锈銻锑銼锉鋁铝鋃锒鋅锌鋇钡鋌铤鋏铗鋒锋鋙铻鋝锊鋟锓鋣铘鋤锄鋥锃鋦锔鋨锇鋩铓鋪铺鋭锐鋮铖鋯锆鋰锂鋱铽鋶锍鋸锯鋼钢錁锞錄录錆锖錇锫錈锩錏铔錐锥錒锕錕锟錘锤錙锱錚铮錛锛錟锬錠锭錡锜錢钱錦锦錨锚錩锠錫锡錮锢錯错録录錳锰錶表錸铼錼镎鍀锝鍁锨鍃锪鍅钫鍆钔鍇锴鍈锳鍊炼鍋锅鍍镀鍔锷鍘铡鍚钖鍛锻鍠锽鍤锸鍥锲鍩锘鍬锹鍰锾鍵键鍶锶鍺锗鍼针鍾钟鎂镁鎄锿鎇镅鎊镑鎌镰鎔镕鎖锁鎘镉鎚锤鎛镈鎡镃鎢钨鎣蓥鎦镏鎧铠鎩铩鎪锼鎬镐鎭镇鎮镇鎰镒鎲镋鎳镍鎵镓鎶鿔鎸镌鎿镎鏃镞鏇旋鏈链鏌镆鏍镙鏐镠鏑镝鏗铿鏘锵鏜镗鏝镘鏞镛鏟铲鏡镜鏢镖鏤镂鏨錾鏰镚鏵铧鏷镤鏹镪鏺䥽鏽锈鐃铙鐋铴鐐镣鐒铹鐓镦鐔镡鐘钟鐙镫鐝镢鐠镨鐥䦅鐦锎鐧锏鐨镄鐫镌鐮镰鐯䦃鐲镯鐳镭鐵铁鐶镮鐸铎鐺铛鐿镱鑄铸鑊镬鑌镔鑑鉴鑒鉴鑔镲鑕锧鑞镴鑠铄鑣镳鑥镥鑭镧鑰钥鑱镵鑲镶鑷镊鑹镩鑼锣鑽钻鑾銮鑿凿钁镢钂镋長长門门閂闩閃闪閆闫閈闬閉闭開开閌闶閎闳閏闰閑闲閒闲間间閔闵閘闸閡阂閣阁閤合閥阀閨闺閩闽閫阃閬阆閭闾閱阅閲阅閶阊閹阉閻阎閼阏閽阍閾阈閿阌闃阒闆板闇暗闈闱闊阔闋阕闌阑闍阇闐阗闒阘闓闿闔阖闕阙闖闯關关闞阚闠阓闡阐闢辟闤阛闥闼陘陉陝陕陞升陣阵陰阴陳陈陸陆陽阳隉陧隊队階阶隕陨際际隨随險险隯陦隱隐隴陇隸隶隻只雋隽雖虽雙双雛雏雜杂雞鸡離离難难雲云電电霑沾霢霡霧雾霽霁靂雳靄霭靆叇靈灵靉叆靚靓靜静靝靔靦腼靨靥鞏巩鞝绱鞦秋鞽鞒韁缰韃鞑韆千韉鞯韋韦韌韧韍韨韓韩韙韪韜韬韝鞲韞韫韻韵響响頁页頂顶頃顷項项順顺頇顸須须頊顼頌颂頎颀頏颃預预頑顽頒颁頓顿頗颇領领頜颌頡颉頤颐頦颏頭头頮颒頰颊頲颋頴颕頷颔頸颈頹颓頻频頽颓顆颗題题額额顎腭顏颜顒颙顓颛顔颜願愿顙颡顛颠類类顢颟顥颢顧顾顫颤顬颥顯显顰颦顱颅顳颞顴颧風风颭飐颮飑颯飒颱台颳刮颶飓颸飔颺飏颻飖颼飕飀飗飄飘飆飙飈飚飛飞飠饣飢饥飣饤飥饦飩饨飪饪飫饫飭饬飯饭飱飧飲饮飴饴飼饲飽饱飾饰飿饳餃饺餄饸餅饼餈糍餉饷養养餌饵餎饹餏饻餑饽餒馁餓饿餕馂餖饾餘余餚肴餛馄餜馃餞饯餡馅館馆餬糊餱糇餳饧餵喂餶馉餷馇餺馎餼饩餾馏餿馊饁馌饃馍饅馒饈馐饉馑饊馓饋馈饌馔饑饥饒饶饗飨饜餍饞馋饢馕馬马馭驭馮冯馱驮馳驰馴驯馹驲駁驳駐驻駑驽駒驹駔驵駕驾駘骀駙驸駛驶駝驼駟驷駡骂駢骈駭骇駰骃駱骆駸骎駿骏騁骋騂骍騅骓騌骔騍骒騎骑騏骐騖骛騙骗騤骙騧䯄騫骞騭骘騮骝騰腾騶驺騷骚騸骟騾骡驀蓦驁骜驂骖驃骠驄骢驅驱驊骅驌骕驍骁驏骣驕骄驗验驚惊驛驿驟骤驢驴驤骧驥骥驦骦驪骊驫骉骯肮髏髅髒脏體体髕髌髖髋髮发鬆松鬍胡鬚须鬢鬓鬥斗鬧闹鬨哄鬩阋鬮阄鬱郁鬹鬶魎魉魘魇魚鱼魛鱽魢鱾魨鲀魯鲁魴鲂魷鱿魺鲄鮁鲅鮃鲆鮊鲌鮋鲉鮍鲏鮎鲇鮐鲐鮑鲍鮒鲋鮓鲊鮚鲒鮜鲘鮝鲞鮞鲕鮣䲟鮦鲖鮪鲔鮫鲛鮭鲑鮮鲜鮳鲓鮶鲪鮺鲝鯀鲧鯁鲠鯇鲩鯉鲤鯊鲨鯒鲬鯔鲻鯕鲯鯖鲭鯗鲞鯛鲷鯝鲴鯡鲱鯢鲵鯤鲲鯧鲳鯨鲸鯪鲮鯫鲰鯰鲇鯴鲺鯷鳀鯽鲫鯿鳊鰁鳈鰂鲗鰃鳂鰆䲠鰈鲽鰉鳇鰌䲡鰍鳅鰏鲾鰐鳄鰒鳆鰓鳃鰛鳁鰜鳒鰟鳑鰠鳋鰣鲥鰥鳏鰧䲢鰨鳎鰩鳐鰭鳍鰮鳁鰱鲢鰲鳌鰳鳓鰵鳘鰷鲦鰹鲣鰺鲹鰻鳗鰼鳛鰾鳔鱂鳉鱅鳙鱈鳕鱉鳖鱒鳟鱔鳝鱖鳜鱗鳞鱘鲟鱝鲼鱟鲎鱠鲙鱣鳣鱤鳡鱧鳢鱨鲿鱭鲚鱯鳠鱷鳄鱸鲈鱺鲡鳥鸟鳧凫鳩鸠鳬凫鳲鸤鳳凤鳴鸣鳶鸢鳾䴓鴆鸩鴇鸨鴉鸦鴒鸰鴕鸵鴛鸳鴝鸲鴞鸮鴟鸱鴣鸪鴦鸯鴨鸭鴯鸸鴰鸹鴴鸻鴷䴕鴻鸿鴿鸽鵁䴔鵂鸺鵃鸼鵐鹀鵑鹃鵒鹆鵓鹁鵜鹈鵝鹅鵠鹄鵡鹉鵪鹌鵬鹏鵮鹐鵯鹎鵰雕鵲鹊鵷鹓鵾鹍鶄䴖鶇鸫鶉鹑鶊鹒鶓鹋鶖鹙鶘鹕鶚鹗鶡鹖鶥鹛鶩鹜鶪䴗鶬鸧鶯莺鶲鹟鶴鹤鶹鹠鶺鹡鶻鹘鶼鹣鶿鹚鷀鹚鷁鹢鷂鹞鷄鸡鷉䴘鷊鹝鷓鹧鷖鹥鷗鸥鷙鸷鷚鹨鷥鸶鷦鹪鷫鹔鷯鹩鷲鹫鷳鹇鷴鹇鷸鹬鷹鹰鷺鹭鷽鸴鸂㶉鸇鹯鸊䴙鸌鹱鸏鹲鸕鸬鸘鹴鸚鹦鸛鹳鸝鹂鸞鸾鹵卤鹹咸鹺鹾鹼碱鹽盐麗丽麥麦麩麸麪面麫面麯曲麴曲麵面麼么麽么黃黄黌黉點点黨党黲黪黴霉黶黡黷黩黽黾黿鼋鼂鼌鼉鼍鼕冬鼴鼹齊齐齋斋齎赍齏齑齒齿齔龀齕龁齗龂齙龅齜龇齟龃齠龆齡龄齣出齦龈齧啮齪龊齬龉齲龋齶腭齷龌龍龙龎厐龐庞龑䶮龔龚龕龛龜龟鿁䜤鿓鿒", T2S = {};
  for (var ti = 0; ti < T2S_RAW.length; ti += 2) T2S[T2S_RAW[ti]] = T2S_RAW[ti + 1];
  function toS(t) { var o = ""; for (var i = 0; i < t.length; i++) { var c = t[i]; o += T2S[c] || c; } return o; }

  function norm(t) { return String(t || "").replace(/\s+/g, "").toLowerCase(); }
  function grams(t) { t = toS(norm(t)).replace(/[，。、！？；：「」『』（）()《》〈〉,.!?;:"'\-—…]/g, ""); var g = {}; for (var i = 0; i < t.length - 1; i++) g[t.substr(i, 2)] = 1; return g; }

  function idbAll() {
    return new Promise(function (res) {
      if (!w.indexedDB) return res({ books: [], pages: [] });
      var r; try { r = indexedDB.open("aivault_flipbook_v1", 1); } catch (e) { return res({ books: [], pages: [] }); }
      r.onupgradeneeded = function () { try { r.transaction.abort(); } catch (e) {} }; // 不建立任何 store
      r.onerror = r.onblocked = function () { res({ books: [], pages: [] }); };
      r.onsuccess = function () {
        var db = r.result, out = { books: [], pages: [] };
        try {
          if (!db.objectStoreNames.contains("books") || !db.objectStoreNames.contains("pages")) { db.close(); return res(out); }
          var tx = db.transaction(["books", "pages"], "readonly");
          tx.objectStore("books").getAll().onsuccess = function (e) { out.books = e.target.result || []; };
          tx.objectStore("pages").getAll().onsuccess = function (e) { out.pages = e.target.result || []; };
          tx.oncomplete = function () { db.close(); res(out); };
          tx.onerror = function () { db.close(); res(out); };
        } catch (e) { res(out); }
      };
    });
  }
  // Keep private-book requests authenticated; refresh expired member tokens before reading.
  var authRefreshing = null;
  async function bookAccessToken(force) {
    var key = "sb-clcddygkaaqqtsbswgdf-auth-token", sess;
    try { sess = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { sess = null; }
    if (!sess) return ANON;
    var cur = sess.currentSession || sess, access = cur.access_token || "", refresh = cur.refresh_token || "";
    var expiry = Number(cur.expires_at || 0);
    if (!force && access && (!expiry || expiry * 1000 > Date.now() + 60000)) return access;
    if (!refresh) return access || ANON;
    if (!authRefreshing) authRefreshing = (async function () {
      try {
        var response = await fetch(SUPA + "/auth/v1/token?grant_type=refresh_token", {
          method: "POST", headers: { "Content-Type": "application/json", apikey: ANON },
          body: JSON.stringify({ refresh_token: refresh })
        });
        if (!response.ok) return access || ANON;
        var fresh = await response.json();
        if (!fresh.access_token) return access || ANON;
        var next = Object.assign({}, cur, fresh);
        var stored = sess.currentSession ? Object.assign({}, sess, { currentSession: next }) : Object.assign({}, sess, next);
        try { localStorage.setItem(key, JSON.stringify(stored)); } catch (e) {}
        return fresh.access_token;
      } catch (e) { return access || ANON; }
      finally { authRefreshing = null; }
    })();
    return authRefreshing;
  }
  async function ingest(body) {
    async function request(tok) {
      var r = await fetch(INGEST, { method: "POST", headers: {
        "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + tok
      }, body: JSON.stringify(body) });
      var data = await r.json().catch(function () { return {}; });
      data.__http = r.status;
      return data;
    }
    try {
      var token = await bookAccessToken(false), result = await request(token);
      if (result.__http === 401) {
        var renewed = await bookAccessToken(true);
        if (renewed !== token) result = await request(renewed);
      }
      return result;
    } catch (e) { return { ok: false, error: "BOOK_NETWORK_ERROR" }; }
  }
  // 快取放在獨立的 IndexedDB（localStorage 只有約 5MB，裝不下 40 萬字的書）
  var qdb = null;
  function cacheDb() {
    if (qdb) return qdb;
    qdb = new Promise(function (res) {
      try { localStorage.removeItem(CACHE); } catch (e) {}
      if (!w.indexedDB) return res(null);
      var r = indexedDB.open("aivault_bookqa_v1", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("books", { keyPath: "key" }); };
      r.onsuccess = function () { res(r.result); }; r.onerror = r.onblocked = function () { res(null); };
    });
    return qdb;
  }
  async function cacheGet(key) { var db = await cacheDb(); if (!db) return null; return new Promise(function (res) { try { var q = db.transaction("books").objectStore("books").get(key); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } }); }
  async function cachePut(row) { var db = await cacheDb(); if (!db) return; try { db.transaction("books", "readwrite").objectStore("books").put(row); } catch (e) {} }

  // 每本書：以伺服器 total_pages 為準驗證完整度；本機（閱讀器快取／索引快取）只當作起點，缺的頁一律補抓
  var studyInfo = null;
  w.addEventListener("darkstar-study-changed", function () { chunks = null; building = null; lastBid = ""; });
  var CVER = "v2", coverage = {}, PROG_KEY = "aivault_bookqa_progress_v1"; // coverage[bid] = [已有頁數, 全書頁數]
  function loadProg() { try { return JSON.parse(localStorage.getItem(PROG_KEY) || "{}"); } catch (e) { return {}; } }
  (function hydrate() { var o = loadProg(); for (var id in o) { var x = o[id]; if (x && x.total) coverage[id] = [Number(x.have) || 0, Number(x.total) || 0]; } })();
  function saveProg() {
    var o = loadProg(), id;
    for (id in coverage) {
      var h = coverage[id][0] || 0, t = coverage[id][1] || 0;
      o[id] = { have: h, total: t, pct: t ? Math.min(100, Math.round(100 * h / t)) : 0, t: Date.now() };
    }
    try { localStorage.setItem(PROG_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function setCoverage(id, have, total) {
    if (!id) return;
    var t = Number(total) || (coverage[id] && coverage[id][1]) || 0;
    var h = Number(have) || 0;
    if (t) h = Math.min(h, t);
    coverage[id] = [h, t];
    saveProg();
    try { w.dispatchEvent(new CustomEvent("darkstar-learn-progress", { detail: { id: id, have: h, total: t, pct: t ? Math.min(100, Math.round(100 * h / t)) : 0 } })); } catch (e) {}
  }
  function progressOf(id) {
    if (id) {
      var c = coverage[id] || (function () { var x = loadProg()[id]; return x ? [x.have, x.total] : null; })();
      if (!c) return null;
      var h = c[0] || 0, t = c[1] || 0;
      return { id: id, have: h, total: t, pct: t ? Math.min(100, Math.round(100 * h / t)) : 0 };
    }
    var out = {}, o = loadProg(), k;
    for (k in o) out[k] = { have: o[k].have || 0, total: o[k].total || 0, pct: o[k].pct || 0 };
    for (k in coverage) out[k] = { have: coverage[k][0], total: coverage[k][1], pct: coverage[k][1] ? Math.min(100, Math.round(100 * coverage[k][0] / coverage[k][1])) : 0 };
    return out;
  }
  var readRun = 0, shownPct = 0, pctTimer = 0, pctTarget = 0;
  function restartReadProgress() {
    readRun++;
    shownPct = 0;
    pctTarget = 1;
    showReadProgress(1, "讀章節");
    if (pctTimer) clearInterval(pctTimer);
    pctTimer = setInterval(function () {
      if (shownPct < pctTarget) {
        shownPct = Math.min(pctTarget, shownPct + 1);
        showReadProgress(shownPct, "讀章節");
      }
      if (shownPct >= 100) clearInterval(pctTimer);
    }, 40);
    return readRun;
  }
  function setReadTarget(pct) {
    pctTarget = Math.max(pctTarget, Math.max(1, Math.min(100, Math.round(pct))));
  }
  function showReadProgress(pct, label) {
    var box = document.getElementById("aivault-darkstar-avatar");
    if (!box) return;
    var el = document.getElementById("dsChapterReadPct");
    if (!el) {
      el = document.createElement("div");
      el.id = "dsChapterReadPct";
      el.style.cssText = "position:fixed;z-index:120;padding:6px 10px;border-radius:10px;background:#171717;color:#fff;font-size:13px;font-weight:700;line-height:1.3;box-shadow:0 4px 14px rgba(0,0,0,.2);pointer-events:none";
      document.body.appendChild(el);
    }
    var min = document.documentElement.classList.contains("ds-panel-min");
    var dawn = document.getElementById("dsMiniDawn");
    var anchor = (min && dawn) ? dawn : box;
    var r = anchor.getBoundingClientRect();
    el.style.top = Math.max(8, r.top + (min ? 18 : 8)) + "px";
    el.style.left = Math.max(8, r.left - (min ? 78 : 92)) + "px";
    var n = Math.max(0, Math.min(100, Math.round(pct)));
    el.textContent = "閱讀 " + n + "%";
    el.style.background = n >= 100 ? "#15803d" : "#171717";
    if (!showReadProgress._follow) {
      showReadProgress._follow = 1;
      setInterval(function () {
        var cur = document.getElementById("dsChapterReadPct");
        if (!cur || cur.style.display === "none") return;
        var b = document.getElementById("aivault-darkstar-avatar");
        if (!b) return;
        var mini = document.documentElement.classList.contains("ds-panel-min");
        var dw = document.getElementById("dsMiniDawn");
        var a = (mini && dw) ? dw : b;
        var rr = a.getBoundingClientRect();
        cur.style.top = Math.max(8, rr.top + (mini ? 18 : 8)) + "px";
        cur.style.left = Math.max(8, rr.left - (mini ? 78 : 92)) + "px";
      }, 200);
    }
  }
  async function fetchPages(id, need, into, total) {
    // need: 缺頁頁碼陣列 → 以 context(radius 10) 視窗補抓，4 路並行，每窗最多重試 3 次
    var starts = [], i = 0;
    while (i < need.length) { var c = Math.min(need[i] + 10, need[need.length - 1]); starts.push(c); while (i < need.length && need[i] <= c + 10) i++; }
    var k = 0;
    if (total) setCoverage(id, Object.keys(into).length, total);
    await Promise.all([0, 1, 2, 3].map(async function () {
      while (k < starts.length) {
        var sp = starts[k++], r = null;
        for (var t = 0; t < 3 && !(r && r.pages && r.pages.length); t++) r = await ingest({ action: "context", ebook_id: id, page_number: sp, radius: 10 });
        ((r && r.pages) || []).forEach(function (x) { var n = Number(x.page_number || 0); if (n && x.content != null) into[n] = String(x.content || ""); });
        if (total) setCoverage(id, Object.keys(into).length, total);
        if (fetchPages._onPct) fetchPages._onPct(Object.keys(into).length, need.length);
      }
    }));
  }
  function missing(have, total) { var m = []; for (var p = 1; p <= total; p++) if (!(p in have)) m.push(p); return m; }
  async function remoteBooks(local, en) {
    var out = [];
    var list = await ingest({ action: "list", limit: 80 });
    var books = ((list && (list.books || list.items)) || []).slice();
    if (!books.length) throw new Error("書目清單取得失敗");
    books.sort(function (a, b) { return (PRIORITY[String(b.id || b.ebook_id)] || 0) - (PRIORITY[String(a.id || a.ebook_id)] || 0); });
    for (var i = 0; i < books.length; i++) {
      var b = books[i], id = String(b.id || b.ebook_id || ""), total = Number(b.total_pages || b.page_count || 0);
      if (!id || (en && !en[id])) continue; // 只讀「暗星學習書籍」
      var key = id + ":" + total + ":" + CVER, row = await cacheGet(key), have = {};
      if (row && row.h) have = row.h;
      // 伺服器有的書一律用伺服器內容（閱讀器本機快取可能只有讀過的頁或舊版本）
      setCoverage(id, Object.keys(have).length, total);
      var need = missing(have, total);
      if (need.length) { await fetchPages(id, need, have, total); need = missing(have, total); }
      var done = Object.keys(have).length;
      cachePut({ key: key, id: id, t: b.title || "未命名", h: have, complete: !need.length });
      setCoverage(id, done, total);
      if (need.length) console.warn("[BookQA] 《" + b.title + "》尚缺 " + need.length + " 頁，下次會補抓");
      out.push({ id: id, title: b.title || "未命名", pages: Object.keys(have).map(function (n) { return [+n, have[n]]; }).sort(function (x, y) { return x[0] - y[0]; }) });
      if (local[id]) local[id].used = 1;
    }
    return out;
  }
  // 結構性提問時：需要的頁若不在索引裡，當場向伺服器補抓並加入索引
  async function ensurePages(list, bid, from, to, title) {
    var have = {}; list.forEach(function (c) { if (c.bid === bid && c.page >= from && c.page <= to) have[c.page] = 1; });
    var need = []; for (var p = from; p <= to; p++) if (!have[p]) need.push(p);
    var span = Math.max(1, to - from + 1), already = span - need.length;
    var run = readRun;
    setReadTarget(1);
    if (!need.length) { setReadTarget(100); return; }
    var tot = (coverage[bid] && coverage[bid][1]) || 0;
    var got = {};
    fetchPages._onPct = function () {
      if (run !== readRun) return;
      var now = already + Object.keys(got).length;
      setReadTarget(Math.min(100, Math.round(100 * now / span)));
    };
    await fetchPages(bid, need, got, tot);
    setReadTarget(100);
    Object.keys(got).forEach(function (n) { addChunks(list, title, +n, got[n], PRIORITY[bid], bid); });
    if (coverage[bid]) setCoverage(bid, Math.min(coverage[bid][1], coverage[bid][0] + Object.keys(got).length), coverage[bid][1]);
  }
  function addChunks(list, title, pageNo, text, boost, bid) {
    text = String(text || "").replace(/\s+/g, " ").trim();
    for (var i = 0; i < text.length; i += 850) {
      var s = text.substr(Math.max(0, i - 0), 1000);
      list.push({ title: title, page: Number(pageNo), text: s, g: grams(s), b: boost || 1, bid: bid || "" });
    }
  }
  function build() {
    if (chunks) return Promise.resolve(chunks);
    if (building) return building;
    building = (async function () {
      var list = [];
      var L = await idbAll(), titles = {}, local = {};
      L.books.forEach(function (bk) { local[bk.id] = { bid: bk.ebook_id || bk.id, title: bk.title || "未命名", pages: {} }; });
      L.pages.forEach(function (p) { var o = local[p.book_id]; if (o) o.pages[p.page_number] = p.content || p.text || ""; });
      var byBid = {}; Object.keys(local).forEach(function (k) { byBid[local[k].bid] = local[k]; });
      var study = null; try { if (w.AIVAULTStudyBooks) study = await w.AIVAULTStudyBooks.get(); } catch (e) {}
      var en = study && study.enabled; studyInfo = study;
      try { (await remoteBooks(byBid, en)).forEach(function (b) { b.pages.forEach(function (p) { addChunks(list, b.title, p[0], p[1], PRIORITY[b.id], b.id); }); }); } catch (e) { console.warn("[BookQA] remote", e); }
      // 只存在本機（未上傳伺服器）的書，或伺服器暫時連不上時：用本機頁面
      Object.keys(byBid).forEach(function (bid) { var o = byBid[bid]; if (o.used || en) return; var n = 0; for (var pg in o.pages) { addChunks(list, o.title, +pg, o.pages[pg], PRIORITY[bid], bid); n++; } if (!coverage[bid]) coverage[bid] = [n, n]; });
      var df = {}; list.forEach(function (c) { for (var k in c.g) df[k] = (df[k] || 0) + 1; });
      list.idf = function (k) { return Math.log(1 + list.length / (1 + (df[k] || 0))); };
      chunks = list; building = null; return list;
    })();
    return building;
  }
  var QWORDS = /(請問|请问|什麼是|什么是|是什麼|是什么|為什麼|为什么|怎麼|怎么|如何|哪些|甚麼|嗎|吗|呢|一下|告訴我|告诉我|根據書上|书上|書上|書架|书架|這本書|这本书|暗星)/g;
  function search(q, list, rg) {
    if (rg) list = Object.assign(list.filter(function (c) { return c.bid === rg.bid && c.page >= rg.from && c.page <= rg.to; }), { idf: list.idf });
    var qg = grams(String(q || "").replace(QWORDS, " ")), keys = Object.keys(qg); if (keys.length < 2) return [];
    var idf = list.idf || function () { return 1; }, tot = 0; keys.forEach(function (k) { tot += idf(k); });
    var qs = toS(norm(String(q || "").replace(QWORDS, " "))).replace(/[，。、！？；：「」『』（）()《》〈〉,.!?;:"'\-—…“”]/g, ""), tri = [];
    for (var ti2 = 0; ti2 < qs.length - 2; ti2++) tri.push(qs.substr(ti2, 3));
    var triW = tri.map(function (t3) { return (idf(t3.substr(0, 2)) + idf(t3.substr(1, 2))) / 2; }), triT = triW.reduce(function (x, y) { return x + y; }, 0) || 1;
    var scored = list.map(function (c) { var s = 0, n = 0; for (var i = 0; i < keys.length; i++) if (c.g[keys[i]]) { s += idf(keys[i]); n++; }
        var sc = s / tot;
        if (n >= 2 && tri.length) { var flat = c.flat || (c.flat = toS(norm(c.text)).replace(/[“”"＂]/g, "")), m = 0; for (var j = 0; j < tri.length; j++) if (flat.indexOf(tri[j]) >= 0) m += triW[j]; sc += 0.6 * m / triT; if (/[【■（]/.test(c.text) && m / triT > 0.5) sc += 0.15; }
        return { c: c, n: n, s: sc * (c.b || 1) }; })
      .filter(function (x) { return x.n >= 2 && x.s >= 0.25; }).sort(function (a, b) { return b.s - a.s; });
    var out = [], used = 0;
    for (var i = 0; i < scored.length && out.length < 5; i++) {
      var c = scored[i].c;
      if (out.some(function (o) { return o.title === c.title && Math.abs(o.page - c.page) < 1 && o.text.substr(0, 40) === c.text.substr(0, 40); })) continue;
      if (used + c.text.length > MAXC && out.length >= 3) break;
      out.push(c); used += c.text.length;
    }
    return out;
  }
  var TRIVIAL = /^(你好|哈囉|嗨|hi|hello|嗯+|喂|好|好的|ok|謝謝|掰掰|再見|對|是|不是|沒有|可以)[啊呀喔哦嗎呢！!。.\s]*$/i;
  function isQuestion(t) { t = String(t || "").trim(); return t.length >= 4 && !TRIVIAL.test(t); }

  function bubble(hits, bid0) {
    var inner = d.getElementById("messagesInner"); if (!inner) return;
    var row = d.createElement("div"); row.className = "message"; row.setAttribute("data-ds-bookqa", "1");
    var av = d.createElement("div"); av.className = "message-avatar"; av.textContent = "📚";
    var body = d.createElement("div"); body.className = "message-body";
    var det = d.createElement("details"); det.style.cssText = "font-size:12px;opacity:.85";
    var sum = d.createElement("summary"); var bs = {}; hits.forEach(function (h) { if (h.bid) bs[h.bid] = 1; }); if (bid0) bs[bid0] = 1; var cov = Object.keys(bs).filter(function (b) { return coverage[b]; }).map(function (b) { return coverage[b][0] + "/" + coverage[b][1] + " 頁"; }).join("，");
    sum.textContent = "書架資料 " + hits.length + " 段（點開查看）" + (cov ? "｜索引 " + cov : ""); det.appendChild(sum);
    hits.forEach(function (h) { var p = d.createElement("div"); p.style.cssText = "margin:6px 0;white-space:pre-wrap"; p.textContent = "《" + h.title + "》p." + h.page + "：" + h.text; det.appendChild(p); });
    body.appendChild(det); row.appendChild(av); row.appendChild(body); inner.appendChild(row);
    try { var m = d.getElementById("messages"); if (m) m.scrollTop = m.scrollHeight; } catch (e) {}
  }
  function compose(q, hits) {
    var msg = "【書架資料】使用者剛才的題目：「" + q + "」\n" + hits.map(function (h, i) { return (i + 1) + ". 《" + h.title + "》p." + h.page + "：" + h.text; }).join("\n") +
      "\n請根據以上書架資料回答題目，並說出書名與頁碼。若你剛才已開始回答，請以書架資料修正或補充剛才的回答。" + EXCERPT_NOTE;
    return withLinHint(withZhangHint(withJiangHint(msg, hits), hits), hits);
  }
  // 書架介紹：每次連線後只送一次，併在第一題的【書架資料】裡（避免開場時讓暗星無故開口）
  var introSent = false, wasConn = false;
  setInterval(function () { var L = w.AIVAULTDarkStarLive, c = !!(L && L.isConnected && L.isConnected()); if (c && !wasConn) { introSent = false; build(); } wasConn = c; }, 1000);
  function bookTitles(list) {
    var seen = {}, out = [];
    list.forEach(function (c) { if (!seen[c.title]) { seen[c.title] = 1; out.push({ t: c.title, b: c.b || 1 }); } });
    out.sort(function (x, y) { return y.b - x.b; });
    return out.map(function (x) { return "《" + x.t.slice(0, 30) + "》"; });
  }
  function intro(list) {
    var t = bookTitles(list);
    return "【系統說明】你已連上 AIVAULT 電子書書架，可以讀到書架上的書，共 " + t.length + " 本：" + t.slice(0, 15).join("、") + (t.length > 15 ? "等" : "") +
      "。每當使用者提問，系統會送來【書架資料】段落，你必須依據這些段落回答並說出書名與頁碼。若使用者問你看不看得到電子書或書架上有什麼書，請回答看得到，簡短說出書名，並表示可以根據這些書回答題目。\n";
  }
  var SHELF_Q = /(看得到|看得見|看到|看見|有哪些書|有什麼書|什麼書|哪些書|書架|电子书|電子書|书架|讀得到|讀到)/;
  // ===== 結構性提問：第X章／編／節、第N頁、目錄、章名 =====
  var DEFAULT_BID = "e0bc8c57-646d-474c-988e-d6cb3d4f8972", lastBid = "", tocs = {}, tocLoading = null;
  function loadTocs() {
    if (tocLoading) return tocLoading;
    tocLoading = fetch("ebook/aivault-toc-overrides.js", { cache: "no-cache" }).then(function (r) { return r.text(); }).then(function (t) {
      var m = t.match(/var OVERRIDES = (\{[\s\S]*?\n  \});/); if (m) { var o = (new Function("return " + m[1]))(); for (var k in o) tocs[k] = o[k]; }
    }).catch(function (e) { console.warn("[BookQA] toc overrides", e); });
    return tocLoading;
  }
  async function tocFor(bid) {
    await loadTocs();
    if (!tocs[bid]) { try { var r = await ingest({ action: "toc", ebook_id: bid }); tocs[bid] = (r && (r.toc || r.items || r.entries)) || []; } catch (e) { tocs[bid] = []; } }
    return tocs[bid];
  }
  var CN = { "零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
  function num(t) {
    t = String(t || ""); if (/^\d+$/.test(t)) return +t;
    var n = 0, cur = 0;
    for (var i = 0; i < t.length; i++) { var c = t[i]; if (c in CN) cur = CN[c]; else if (c === "十") { n += (cur || 1) * 10; cur = 0; } else if (c === "百") { n += (cur || 1) * 100; cur = 0; } }
    return n + cur;
  }
  var NUMRE = "([0-9]+|[零〇一二两兩三四五六七八九十百]+)";
  function parseStruct(q) {
    var s = toS(norm(String(q || ""))).replace(/\s+/g, ""), r = {};
    var chs = [], re = new RegExp("第?" + NUMRE + "章", "g"), m;
    while ((m = re.exec(s))) if (m[1]) chs.push(num(m[1]));
    var joined = s.match(/第?([0-9]+|[二三四五六七八九])[跟和與与及、,，]第?([0-9]+|[二三四五六七八九])章/);
    if (joined) { chs.push(num(joined[1])); chs.push(num(joined[2])); }
    var bareCh = s.match(/([二三四五六七八九])([二三四五六七八九])章/);
    if (bareCh) { chs.push(num(bareCh[1])); chs.push(num(bareCh[2])); }
    chs = chs.filter(function (n, i) { return n > 0 && chs.indexOf(n) === i; });
    if (chs.length) { r.chapters = chs; r.chapter = chs[0]; }
    m = s.match(new RegExp("第" + NUMRE + "编")); if (m) r.part = num(m[1]);
    m = s.match(new RegExp("第" + NUMRE + "节")); if (m) r.section = num(m[1]);
    m = s.match(new RegExp("第" + NUMRE + "页")) || s.match(/(?:^|[^a-z])p\.?([0-9]+)/i); if (m) r.page = num(m[1]);
    if (/目录|有哪些章|有几章|哪几章|几个章|章节|多少章|有哪些编|几编/.test(s)) r.toc = 1;
    if (/重点|大意|讲什么|讲了什么|讲些什么|在讲|内容|概要|摘要|整理|架构|结构/.test(s)) r.overall = 1;
    r.s = s; return r;
  }
  function bare(t) { return toS(norm(String(t || ""))).replace(/^第.+?[章编节]\s*|^[（(][^）)]+[）)]\s*|^[一二三四五六七八九十]+、\s*/, "").replace(/\s+/g, ""); }
  function pickBook(st, list) {
    var seen = {}, best = "";
    list.forEach(function (c) { if (!c.bid || seen[c.bid]) return; seen[c.bid] = 1; var t = toS(norm(c.title)).replace(/[（(｜|].*$/, "").replace(/\s+/g, ""); if (t.length >= 3 && st.s.indexOf(t.slice(0, Math.min(6, t.length))) >= 0) best = c.bid; });
    return best || lastBid || DEFAULT_BID;
  }
  function chunksAt(list, bid, page, n) { return list.filter(function (c) { return c.bid === bid && c.page === page; }).slice(0, n || 2); }
  function lastPage(list, bid) { var m = 0; list.forEach(function (c) { if (c.bid === bid && c.page > m) m = c.page; }); return m; }
  function lv(e) { return e.level === "part" ? 0 : e.level === "chapter" ? 1 : 2; }
  async function structural(q, list) {
    var st = parseStruct(q);
    var bid = pickBook(st, list), toc = (await tocFor(bid)) || [], title = (list.find(function (c) { return c.bid === bid; }) || {}).title || "";
    if (!title) return null;
    var end = lastPage(list, bid), target = null, label = "";
    function rangeOf(i) { var L0 = lv(toc[i]), p0 = +toc[i].page_number; for (var j = i + 1; j < toc.length; j++) if (lv(toc[j]) <= L0 && +toc[j].page_number > p0) return +toc[j].page_number - 1; return end; }
    function findNum(kind, n) { for (var i = 0; i < toc.length; i++) { var t = toS(norm(toc[i].title)); var m = t.match(new RegExp("^第" + NUMRE + kind)); if (m && num(m[1]) === n) return i; } return -1; }
    var idx = -1;
    if (st.chapter) idx = findNum("章", st.chapter);
    if (idx < 0 && st.part) idx = findNum("编", st.part);
    if (idx < 0 && !st.page && !st.toc) {
      // 章名（含簡繁）出現在問題裡
      var bestLen = 0; toc.forEach(function (e, i) { if (lv(e) !== 1) return; var b = bare(e.title); if (b.length >= 4 && st.s.indexOf(b) >= 0 && b.length > bestLen) { bestLen = b.length; idx = i; } });
    }
    if (idx < 0 && !st.page && !st.toc && !st.chapter && !st.part) return null;
    lastBid = bid;
    var out = [], sources = [], budget = 2500, used = 0;
    function add(line) { if (used + line.length > budget) return false; out.push(line); used += line.length; return true; }
    function addChunk(c, tag) { if (!c || sources.indexOf(c) >= 0) return; if (add((tag || "") + "《" + c.title + "》p." + c.page + "：" + c.text)) sources.push(c); }
    if (st.toc && idx < 0) {
      add("《" + title + "》目錄（編、章與起始頁）：");
      toc.forEach(function (e) { if (lv(e) <= 1 && /^第|导论|附录/.test(toS(e.title))) add((lv(e) ? "  " : "") + e.title + " p." + e.page_number); });
      return { st: st, bid: bid, text: out.join("\n"), sources: sources, label: "目錄" };
    }
    if (st.chapters && st.chapters.length > 1) {
      var idxs = st.chapters.map(function (n) { return findNum("章", n); }).filter(function (i) { return i >= 0; });
      if (idxs.length) {
        var ranges = idxs.map(function (i) { return { from: +toc[i].page_number, to: rangeOf(i), title: toc[i].title }; });
        for (var ri = 0; ri < ranges.length; ri++) await ensurePages(list, bid, ranges[ri].from, ranges[ri].to, title);
        label = "第" + st.chapters.join("、") + "章";
        add("《" + title + "》" + label);
        ranges.forEach(function (rg) { add("【" + rg.title + " p." + rg.from + "–" + rg.to + "】"); chunksAt(list, bid, rg.from, 2).forEach(function (c) { addChunk(c); }); });
        return { st: st, bid: bid, text: out.join("\n"), sources: sources, label: label };
      }
    }
    if (idx >= 0) {
      var e = toc[idx], from = +e.page_number, to = rangeOf(idx);
      await ensurePages(list, bid, from, to, title);
      label = e.title + "（p." + from + "–" + to + "）";
      add("《" + title + "》" + label + " 的目次：");
      var subs = []; for (var j = idx + 1; j < toc.length && +toc[j].page_number <= to; j++) { if (lv(toc[j]) <= lv(e)) break; subs.push(toc[j]); add("  " + toc[j].title + " p." + toc[j].page_number); }
      if (st.section && subs[st.section - 1]) { var se = subs[st.section - 1]; from = +se.page_number; label += "／" + se.title; }
      add("【章節開頭】"); chunksAt(list, bid, from, 2).forEach(function (c) { addChunk(c); });
      var words = st.s.replace(new RegExp("第" + NUMRE + "[章编节页]", "g"), "").replace(/重点|大意|讲什么|讲了什么|在讲|内容|概要|摘要|整理|架构|结构|这一章|本章|这章|的|是|有|什么/g, "");
      var hits = words.length >= 2 ? search(words, list, { bid: bid, from: from, to: to }) : [];
      if (hits.length) { add("【章內相關段落】"); hits.forEach(function (c) { addChunk(c); }); }
      if (st.overall || !hits.length) {
        add("【各節開頭】");
        subs.forEach(function (sub) { var b = bare(sub.title), cs = list.filter(function (c) { return c.bid === bid && c.page === +sub.page_number; }); var c = cs.find(function (x) { return toS(norm(x.text)).replace(/\s/g, "").indexOf(b) >= 0; }) || cs[0]; addChunk(c); });
      }
      return { st: st, bid: bid, text: out.join("\n"), sources: sources, label: label };
    }
    if (st.page) {
      await ensurePages(list, bid, st.page, st.page, title);
      var pcs = chunksAt(list, bid, st.page, 4); label = "p." + st.page;
      add("《" + title + "》第 " + st.page + " 頁內容：");
      if (!pcs.length) add("（這一頁沒有文字，或超出全書頁數 " + end + "）");
      pcs.forEach(function (c) { addChunk(c); });
      return { st: st, bid: bid, text: out.join("\n"), sources: sources, label: label };
    }
    return null;
  }

  var JIANG_BID = "840b333d-4329-4d47-80e2-a1b9d92aec03";
  var JIANG_HINT = "【教材解讀指引｜姜明安《行政法与行政诉讼法》第八版】請依書架資料中的姜明安第八版原文回答，並註明編／章與頁碼（電子書頁＝PDF頁）。答題結構優先：概念界定→規範依據／構成要件→學理說明→制度／實例→結論。請清楚區分「行政法（實體／程序）」與「行政訴訟／行政復議／行政賠償」。若題目是考題解題，改採：爭點→通說→規範依據→結論。不得虛構法條；也不得說書中沒有相關內容——若片段不足，請請使用者指定章節或關鍵詞再查。";
  function withJiangHint(msg, hits, bid) {
    var need = bid === JIANG_BID;
    if (!need && hits && hits.length) for (var i = 0; i < hits.length; i++) if (hits[i] && hits[i].bid === JIANG_BID) { need = true; break; }
    if (!need && typeof lastBid !== "undefined" && lastBid === JIANG_BID) need = true;
    return need ? (msg + "\n" + JIANG_HINT) : msg;
  }


  var ZHANG_BID = "97a31aa4-8f72-4794-adf7-ee336411c804";
  var ZHANG_HINT = "【考題／複習筆記解題指引｜张树义《行政法与行政诉讼法学》配套辅导】請依書架資料中的本書原文回答，並註明章／節與頁碼（電子書頁＝原 Word／PDF 渲染頁）。本書含「復習筆記」與「名校考研真題詳解」。答題優先採：爭點→通說→規範依據→結論；複習筆記類問題可輔以概念界定與要點條列。請區分行政法總論、行政訴訟、國家賠償。不得虛構法條或真題原文；若片段不足，請請使用者指定章節、學校／年份真題或關鍵詞再查，不要說書裡沒有這些內容。";
  function withZhangHint(msg, hits, bid) {
    var need = bid === ZHANG_BID;
    if (!need && hits && hits.length) for (var i = 0; i < hits.length; i++) if (hits[i] && hits[i].bid === ZHANG_BID) { need = true; break; }
    if (!need && typeof lastBid !== "undefined" && lastBid === ZHANG_BID) need = true;
    return need ? (msg + "\n" + ZHANG_HINT) : msg;
  }

  var LIN_BID = "9f20615b-fe5d-4abe-93f3-86c7025a866f";
  var LIN_HINT = "【論文解讀指引｜林文舟〈變本加厲的司法行政威權體制〉（2026.3.19，28頁）】這是一篇評論司法院定位與司法行政權的文章（非教科書、非考題書）。請依書架資料中的原文回答，註明章節（壹～伍）與頁碼（電子書頁＝原PDF頁）。答題結構：作者論點→論據（憲法第77、78條、釋字第530號、司法院組織法等規範與制度沿革）→所舉案例（如陳法官行政懲處／職務評定案、周法官懲戒案）→作者結論；請區分作者主張與客觀規範／事實，必要時可補充對立見解但須標明非本文觀點。原文為掃描OCR，少數字可能誤認，引用時以文意為準。不得虛構法條、釋字或案件細節；片段不足時請使用者指定章節或關鍵詞再查，不要說文中沒有這些內容。";
  function withLinHint(msg, hits, bid) {
    var need = bid === LIN_BID;
    if (!need && hits && hits.length) for (var i = 0; i < hits.length; i++) if (hits[i] && hits[i].bid === LIN_BID) { need = true; break; }
    if (!need && typeof lastBid !== "undefined" && lastBid === LIN_BID) need = true;
    return need ? (msg + "\n" + LIN_HINT) : msg;
  }

  var EXCERPT_NOTE = "注意：以上只是從整本書中擷取的片段，書中還有更多內容；若片段不足以回答，請請使用者說得更具體（例如哪一章、哪一節或關鍵詞），不要說書裡沒有這些內容。";
  async function onTurn(ev) {
    var q = ev && ev.detail && ev.detail.text;
    var L = w.AIVAULTDarkStarLive;
    if (!isQuestion(q) || !L || !L.isConnected || !L.isConnected() || !L.sendRawText) return;
    var list = await build(), shelf = SHELF_Q.test(q), sv = null;
    var st0 = parseStruct(q);
    if (st0.chapter || st0.part || st0.section) {
      showReadProgress(0, "讀章節");
      try { L.sendRawText("【系統】使用者指定了章節，正在讀取書架原文。請先不要回答，等資料讀到 100% 再回答，不要說看不到書。"); } catch (e) {}
    }
    var locks = (w.AIVAULTSourceLocks && w.AIVAULTSourceLocks.state) ? w.AIVAULTSourceLocks.state() : { ebook: true, order: ["ebook"], on: ["ebook"] };
    // 勾選電子書時，所有有意義的提問都可以查書；未勾選時不得讀書。
    var bookAsk = locks.ebook === true;
    if (!bookAsk) {
      try {
        var srcs = (locks.order || []).filter(function (id) { return id !== "ebook" && locks[id]; });
        // 僅使用使用者明確勾選的網站；Google 不得自動加入。
        if (!srcs.length) return;
        var site = { baidu: "site:baidu.com ", google: "", yahoo: "site:yahoo.com ", youtube: "site:youtube.com " };
        var name = { baidu: "百度", google: "Google", yahoo: "Yahoo", youtube: "YouTube" };
        var blocks = [];
        for (var si = 0; si < srcs.length; si++) {
          var id = srcs[si];
          var wr = await fetch("https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest?feature=web-search", { method: "POST", headers: { "Content-Type": "application/json", apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE", Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE" }, body: JSON.stringify({ q: (site[id] || "") + q, n: 4 }) });
          var wj = await wr.json();
          var rows = (wj && wj.results) || [];
          if (rows.length) blocks.push((si + 1) + ". " + name[id] + "\n" + rows.slice(0, 3).map(function (x, i) { return "  " + (i + 1) + ") " + x.title + "（" + x.url + "）" + (x.snippet ? "：" + x.snippet : ""); }).join("\n"));
        }
        var srcLabel = srcs.map(function (id, i) { return (i + 1) + "." + name[id]; }).join(" ");
        if (blocks.length) L.sendRawText("【網路資料｜優先 " + srcLabel + "】使用者問：「" + q + "」\n" + blocks.join("\n") + "\n請嚴格依 1、2、3 優先順序採用資料並說來源。沒打勾電子書就不要用書架。");
      } catch (e) { console.warn("[BookQA] web", e); }
      return;
    }
    try { sv = await structural(q, list); } catch (e) { console.warn("[BookQA] structural", e); }
    var hits = sv ? sv.sources : search(q, list);
    if (!sv && hits[0] && hits[0].bid) lastBid = hits[0].bid;
    if (sv && sv.st && (sv.st.chapter || sv.st.part || sv.st.section)) setReadTarget(100);
    var msg = sv ? "【書架資料】使用者剛才的題目：「" + q + "」\n" + sv.text + "\n章節資料已讀到 100%。請現在根據以上書架資料回答，說出書名與頁碼。" + EXCERPT_NOTE
      : hits.length ? compose(q, hits) : shelf ? "【書架資料】使用者在問書架本身：「" + q + "」。" : "";
    if (!msg && shelf) msg = "【書架檢索結果】目前沒有取得可引用的書籍頁面或書目。請如實告知尚未取得原文，不要假裝已讀過。";
    if (!msg) return;
    if (shelf && list.length) msg += "\n已實際索引的書目：" + bookTitles(list).join("、") + "。只能說明已成功讀取的內容，不得宣稱看過未取得的書。";
    msg = withLinHint(withZhangHint(withJiangHint(msg, hits, sv && sv.bid), hits, sv && sv.bid), hits, sv && sv.bid);
    if (L.sendRawText(msg)) { if (hits.length || sv) bubble(hits, sv && sv.bid); }
  }
  // 文字聊天與即時語音共用真實書頁檢索；僅在電子書勾選時提供資料。
  // On-demand book lookup: avoid global fuzzy search for an explicitly named book/page.
  async function getContextForQuery(question) {
    var locks = w.AIVAULTSourceLocks && w.AIVAULTSourceLocks.state ? w.AIVAULTSourceLocks.state() : { ebook: false };
    if (!locks.ebook || !isQuestion(question)) return "";
    var q = String(question || ""), nq = toS(norm(q));
    // Distinguish printed page numbering from PDF page numbering for the verified Yu textbook.
    var yuBookId = "c8743d50-bad5-4ec8-b675-5e64fe7985a9";
    var listing = await ingest({ action: "list", limit: 100 });
    var books = (listing && (listing.books || listing.items)) || [];
    if (listing && (listing.__http >= 400 || listing.error)) return "【電子書讀取失敗】書目服務 HTTP " + (listing.__http || "未知") + "：" + String(listing.error || "授權或服務錯誤") + "。請確認登入，不能引用其他教材。";
    if (!books.length) return "【電子書檢索錯誤】書目 API 沒有回傳可讀書籍；不能冒稱讀到原文。";
    var selected = null, score = 0;
    books.forEach(function (bk) {
      var title = toS(norm(bk.title || "")), stem = title.split(/[（(｜|]/)[0];
      var candidate = stem.slice(0, Math.min(6, stem.length));
      var knownYu = String(bk.id || bk.ebook_id || "") === "c8743d50-bad5-4ec8-b675-5e64fe7985a9";
      var requestedYu = /行政法入门|余凌云/.test(nq);
      if ((candidate.length >= 3 && nq.indexOf(candidate) >= 0 && candidate.length > score) || (knownYu && requestedYu)) { selected = bk; score = knownYu && requestedYu ? 100 : candidate.length; }
    });
    var study = null;
    try { if (w.AIVAULTStudyBooks) study = await w.AIVAULTStudyBooks.get(); } catch (e) {}
    var enabled = study && study.enabled;
    if (!selected && /哪些|書名|书名|清單|列表|幾本|几本|目前.*書|目前.*书/.test(q)) {
      var readable = books.filter(function (bk) { var id = String(bk.id || bk.ebook_id || ""); return !enabled || !!enabled[id]; });
      return "【AIVAULT 書架書目（僅清單，非全文已讀）】" + readable.map(function (bk) { return "《" + bk.title + "》"; }).join("、") + "。不能把書目清單誤稱為已取得正文。";
    }
    if (!selected && /行政法入門|行政法入门|余凌雲|余凌云/.test(q)) return "【電子書檢索錯誤】書目 API 未列出指定的《行政法入門》，可能是登入授權失效或私人書未對此帳號開放；不得引用其他教材替代。";
    if (selected) {
      var id = String(selected.id || selected.ebook_id || "");
      if (enabled && !enabled[id]) return "【電子書權限】《" + selected.title + "》尚未勾選「讓暗星學習」，請先在學習書籍清單啟用；不得越權讀取。";
      var pages = [], matches = q.match(/第\s*(\d{1,4})\s*(?:頁|页)/g) || [];
      matches.forEach(function (m) { var n = Number((m.match(/\d+/) || [0])[0]); if (n && pages.indexOf(n) < 0) pages.push(n); });
      if (pages.length) {
        var yu = id === yuBookId;
        var printed = /原書|印刷|書本頁碼/.test(q) && !/PDF/.test(q);
        if (yu && printed) pages = pages.map(function (n) { return n + 15; });
        var excerpts = [];
        for (var i = 0; i < Math.min(4, pages.length); i++) {
          var n = pages[i], res = await ingest({ action: "context", ebook_id: id, page_number: n, radius: 0 });
          var p = ((res && res.pages) || []).find(function (x) { return Number(x.page_number) === n && x.content; });
          if (p) excerpts.push("《" + selected.title + "》PDF第" + n + "頁" + (yu ? "（原書第" + (n - 15) + "頁）" : "") + "：" + String(p.content).slice(0, 4200));
          else excerpts.push("PDF第" + n + "頁：未取得原文（HTTP " + (res && res.__http || "未知") + "；" + String(res && res.error || "無正文") + "），不可編造。");
        }
        return "【指定書籍逐頁查詢結果】\n" + excerpts.join("\n") + "\n僅依取得的頁面作答，原書印刷頁碼與 PDF 頁碼須區分。";
      }
    }
    var list = await build(), pool = selected ? list.filter(function (c) { return c.bid === String(selected.id || selected.ebook_id); }) : list;
    pool.idf = list.idf;
    var terms = q.match(/比例原[則则]|合理[性]?原[則则]|行政裁量|必要性|妥當性|妥当性|法益相稱性|法益相称性|行政處罰|行政处罚|法律保留|依法行政/g) || [];
    var hits = search(terms.length ? terms.join(" ") : q.replace(/《[^》]+》/g, " ").slice(0, 140), pool);
    if (!hits.length) return "【電子書檢索狀態】未取得" + (selected ? "《" + selected.title + "》" : "書架") + "可引用的正文，請確認學習權限或檢索服務。";
    return "【AIVAULT 電子書實際檢索結果】\n" + hits.slice(0, 4).map(function (h) { return "《" + h.title + "》PDF第" + h.page + "頁：" + h.text.slice(0, 950); }).join("\n") + "\n只能引用以上實際取得的文字，不得編造原文。";
  }
  w.addEventListener("darkstar-live-user-turn", onTurn);
  w.AIVAULTBookQA = { getContextForQuery: getContextForQuery, build: build, search: search, isQuestion: isQuestion, compose: compose, structural: structural, coverage: coverage, progress: progressOf, parseStruct: parseStruct, intro: intro, bookTitles: bookTitles, reset: function () { chunks = null; } };
  setTimeout(function () { build().catch(function () {}); }, 4000); // 預先建索引
})(window, document);
