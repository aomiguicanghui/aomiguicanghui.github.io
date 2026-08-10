/**
 * ADND2E 角色创建向导 —— 内置规则数据
 * 数据来源：content/topics/ 各话题页表格（表格7/8/13/26-31/34/43/53/60）
 * 与《玩家手册》第二章种族/第三章职业章节核对整理
 */
window.CHARGEN_DATA = (function(){

// ---------- 属性 ----------
const ABILITY_NAMES = ['力量','敏捷','体质','智力','灵知','魅力'];
const ABILITY_KEYS  = ['str','dex','con','int','wis','cha'];

// 力量修正表（表格1：命中率/伤害调整/负重/最大负重/开门/弯杆）1-18/25
const STRENGTH_TABLE = [
  {hit:-5,dmg:-4,weight:1,maxpress:10,openDoor:1,bendBar:0}, // 1
  {hit:-3,dmg:-2,weight:1,maxpress:15,openDoor:1,bendBar:0},
  {hit:-3,dmg:-1,weight:5,maxpress:20,openDoor:2,bendBar:0},
  {hit:-2,dmg:-1,weight:10,maxpress:25,openDoor:2,bendBar:0},
  {hit:-2,dmg:-1,weight:15,maxpress:30,openDoor:3,bendBar:0},
  {hit:-1,dmg:0, weight:20,maxpress:35,openDoor:3,bendBar:0},
  {hit:-1,dmg:0, weight:25,maxpress:40,openDoor:4,bendBar:0},
  {hit:0, dmg:0, weight:30,maxpress:45,openDoor:4,bendBar:1},
  {hit:0, dmg:0, weight:35,maxpress:55,openDoor:5,bendBar:1},
  {hit:0, dmg:0, weight:40,maxpress:65,openDoor:5,bendBar:1},
  {hit:0, dmg:0, weight:45,maxpress:75,openDoor:6,bendBar:2},
  {hit:0, dmg:0, weight:55,maxpress:85,openDoor:6,bendBar:2},
  {hit:0, dmg:0, weight:65,maxpress:100,openDoor:7,bendBar:4},
  {hit:0, dmg:0, weight:75,maxpress:115,openDoor:7,bendBar:4},
  {hit:0, dmg:0, weight:85,maxpress:130,openDoor:8,bendBar:7},
  {hit:0, dmg:0, weight:95,maxpress:145,openDoor:8,bendBar:7},
  {hit:+1,dmg:+1,weight:110,maxpress:160,openDoor:9,bendBar:10},
  {hit:+1,dmg:+2,weight:125,maxpress:180,openDoor:10,bendBar:13}
];
// 超凡力量附列（18/01-00），简化合并展示
const EXCEPTIONAL_STRENGTH = [
  {val:'01-50', hit:0, dmg:+3, weight:135, maxpress:185, openDoor:11, bendBar:16},
  {val:'51-75', hit:+1, dmg:+3, weight:160, maxpress:195, openDoor:12, bendBar:20},
  {val:'76-90', hit:+1, dmg:+4, weight:185, maxpress:205, openDoor:13, bendBar:25},
  {val:'91-99', hit:+2, dmg:+4, weight:210, maxpress:220, openDoor:14, bendBar:30},
  {val:'00',   hit:+2, dmg:+5, weight:255, maxpress:235, openDoor:15, bendBar:35}
];

// 通用属性修正（用于属性检定）——首项命中/伤害/等仅用于力量以外的骨架
// 简化：相邻属性修正仅用于豁免/CD；实际属性检定使用下表按键值
const ABILITY_MOD = {
  // 值:检定的奖励(每属性有细微差异，用通用近似 + 专有表)
};
// 通用"属性数值→检定修正"（表格0；多数属性共用，但力量/体质等有专表）。此处给出 PHB 常用值
const GENERIC_ADJUST = {
  1:-5,2:-4,3:-4,4:-3,5:-3,6:-2,7:-2,8:-1,9:-1,10:0,11:0,12:0,13:1,
  14:1,15:1,16:2,17:2,18:2,19:3,20:3,21:3,22:4,23:4,24:4,25:5
};

// ---------- 种族 ----------
const RACES = {
  human:{name:'人类', adjust:{}, levelLimit:{fighter:null, paladin:null, ranger:null, mage:null, specialist:null, cleric:null, druid:null, thief:null, bard:null},
    classes:['战士','圣武士','游侠','巫师','幻术师','牧师','德鲁伊','盗贼','吟游诗人'], note:'可以任意职业、无等级上限。'},
  dwarf:{name:'矮人', adjust:{con:+1, cha:-1},
    req:{str:[8,18],dex:[3,17],con:[11,18],int:[3,18],wis:[3,18],cha:[3,17]},
    classes:['战士','牧师','盗贼'], note:'+1体质,-1魅力。60呎暗视；矮人特性。不可兼职魔法。'},
  elf:{name:'精灵', adjust:{dex:+1, con:-1},
    req:{str:[3,18],dex:[6,18],con:[7,18],int:[8,18],wis:[3,18],cha:[8,18]},
    classes:['战士','游侠','牧师','巫师','盗贼','幻术师'], note:'+1敏捷,-1体质。60呎红外视觉。'},
  gnome:{name:'侏儒', adjust:{int:+1, wis:-1},
    req:{str:[6,18],dex:[3,18],con:[8,18],int:[6,18],wis:[3,18],cha:[3,18]},
    classes:['战士','幻术师','牧师','盗贼'], note:'+1智力,-1灵知。60呎暗视。'},
  halfelf:{name:'半精灵', adjust:{},
    req:{str:[3,18],dex:[6,18],con:[6,18],int:[4,18],wis:[3,18],cha:[3,18]},
    classes:['战士','游侠','牧师','德鲁伊','巫师','盗贼','吟游诗人'], note:'无属性调整。60呎红外视觉；可兼职通才/专精法师。'},
  halfling:{name:'半身人', adjust:{dex:+1, str:-1},
    req:{str:[7,18],dex:[7,18],con:[10,18],int:[6,18],wis:[3,17],cha:[3,18]},
    classes:['战士','牧师','盗贼'], note:'+1敏捷,-1力量。30呎超视觉；无论何种职业都有极好的豁免检定加值。'}
};

// ---------- 职业类别 ----------
const CLASS_GROUPS = {
  warrior:{name:'勇士', hitDie:'d10', thac0:'warrior', saves:'warrior', weapon:{init:4, perLevel:3, penalty:-2}, nonweapon:{init:3, perLevel:3}, money:'5d4x10', classes:['战士','游侠','圣武士']},
  mage:{name:'法师', hitDie:'d4', thac0:'mage', saves:'mage', weapon:{init:1, perLevel:6, penalty:-5}, nonweapon:{init:4, perLevel:3}, money:'(1d4+1)x10', classes:['巫师','幻术师']},
  priest:{name:'祭司', hitDie:'d8', thac0:'priest', saves:'priest', weapon:{init:2, perLevel:4, penalty:-3}, nonweapon:{init:4, perLevel:3}, money:'3d6x10', classes:['牧师','德鲁伊']},
  rogue:{name:'游荡者', hitDie:'d6', thac0:'rogue', saves:'rogue', weapon:{init:2, perLevel:4, penalty:-3}, nonweapon:{init:3, perLevel:4}, money:'2d6x10', classes:['盗贼','吟游诗人']}
};

// ---------- 职业 ----------
const CLASSES = {
  warrior:{group:'warrior', name:'战士', prime:['str'], req:{str:9}, note:'任意阵营。可武器专精。等级18+可武器大师/宗师。'},
  paladin:{group:'warrior', name:'圣武士', prime:['str','cha'], req:{str:12,con:9,wis:13,cha:17}, align:['守序善良'], note:'守序善良。可以驱散不死、治疗疾病。'},
  ranger:{group:'warrior', name:'游侠', prime:['str','wis'], req:{str:13,dex:13,con:14,wis:14}, align:['守序善良','中立善良','混乱善良'], note:'任何善良阵营。对巨人型+4命中。'},
  mage:{group:'mage', name:'巫师', prime:['int'], req:{int:9}, note:'任意阵营。通才法师，可习得法术。'},
  specialist:{group:'mage', name:'专精法师', prime:['int'], req:{int:9}, note:'专精某一学派的法师（幻术师等），获得该学派+1豁免且失去对应反对学派。'},
  illusionist:{group:'mage', name:'幻术师', prime:['int'], req:{int:9}, note:'专精幻术学派的法师。'},
  cleric:{group:'priest', name:'牧师', prime:['wis'], req:{wis:9}, note:'任意阵营，须与信仰符合。可以使用组队疗法与驱散不死。'},
  druid:{group:'priest', name:'德鲁伊', prime:['wis','cha'], req:{wis:12,cha:15}, align:['中立善良','纯粹中立','混乱中立'], note:'中立阵营。与自然合一，擅长野性认同与穿越。'},
  thief:{group:'rogue', name:'盗贼', prime:['dex'], req:{dex:9}, note:'任意阵营。拥有盗贼技能（表格26-29）。'},
  bard:{group:'rogue', name:'吟游诗人', prime:['dex','cha'], req:{dex:12,int:13,cha:15}, align:['中立善良','纯粹中立','混乱中立'], note:'任意中立阵营。拥有吟游诗人技能与法术。'}
};

// ---------- 阵营 ----------
const ALIGNMENTS = [
  '守序善良','中立善良','混乱善良','守序中立','纯粹中立','混乱中立','守序邪恶','中立邪恶','混乱邪恶'
];

// ---------- 豁免表（表格60）----------
// 结构: 类别 -> [ [等级下限,上限, 麻痹/毒/死亡, 权杖/法杖/魔杖, 石化/变形, 喷吐, 法术] ]
const SAVES = {
  priest: [[1,3,10,14,13,16,15],[4,6,9,13,12,15,14],[7,9,7,11,10,13,12],[10,12,6,10,9,12,11],[13,15,5,9,8,11,10],[16,18,4,8,7,10,9],[19,99,2,6,5,8,7]],
  rogue: [[1,4,13,14,12,16,15],[5,8,12,12,11,15,13],[9,12,11,10,10,14,11],[13,16,10,8,9,13,9],[17,20,9,6,8,12,7],[21,99,8,4,7,11,5]],
  warrior: [[0,0,16,18,17,20,19],[1,2,14,16,15,17,17],[3,4,13,15,14,16,16],[5,6,11,13,12,13,14],[7,8,10,12,11,12,13],[9,10,8,10,9,9,11],[11,12,7,9,8,8,10],[13,14,5,7,6,5,8],[15,16,4,6,5,4,7],[17,99,3,5,4,4,6]],
  mage: [[1,5,14,11,13,15,12],[6,10,13,9,11,13,10],[11,15,11,7,9,11,8],[16,20,10,5,7,9,6],[21,99,8,3,5,7,4]]
};
const SAVE_NAMES = ['麻痹、毒素或死亡魔法','权杖、法杖或魔杖攻击','石化或变形','喷吐武器','法术'];

// ---------- THAC0（表格53）----------
const THAC0 = {
  priest: [20,20,20,18,18,18,16,16,16,14,14,14,12,12,12,10,10,10,8,8],
  rogue: [20,20,19,19,18,18,17,17,16,16,15,15,14,14,13,13,12,12,11,11],
  warrior:[20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],
  mage:  [20,20,20,19,19,19,18,18,18,17,17,17,16,16,16,15,15,15,14,14]
};
// 等级0：勇士为20（表内第0级）

// ---------- 熟练槽（表格34）----------
const PROF_SLOTS = {
  warrior:{weapon:{init:4,perLevel:3,penalty:-2}, nonweapon:{init:3,perLevel:3}},
  mage:{weapon:{init:1,perLevel:6,penalty:-5}, nonweapon:{init:4,perLevel:3}},
  priest:{weapon:{init:2,perLevel:4,penalty:-3}, nonweapon:{init:4,perLevel:3}},
  rogue:{weapon:{init:2,perLevel:4,penalty:-3}, nonweapon:{init:3,perLevel:4}}
};

// ---------- 起始资金（表格43）----------
const START_MONEY = {
  warrior:'5d4x10gp', mage:'(1d4+1)x10gp', priest:'3d6x10gp', rogue:'2d6x10gp'
};

// ---------- 盗贼技能（表格26/27/28）----------
const THIEF_SKILLS = [
  {id:'pp', name:'盗窃(扒手)', base:15},
  {id:'ol', name:'开锁', base:10},
  {id:'ft', name:'寻找/解除陷阱', base:5},
  {id:'ms', name:'潜行', base:10},
  {id:'hs', name:'阴影躲藏', base:5},
  {id:'dn', name:'辨声', base:15},
  {id:'cw', name:'爬墙', base:60},
  {id:'rl', name:'解读文书', base:0}
];
const THIEF_RACE_ADJ = {
  dwarf:{pp:0,ol:+10,ft:+15,ms:0,hs:0,dn:0,cw:-10,rl:-5},
  elf:{pp:+5,ol:-5,ft:0,ms:+5,hs:+10,dn:+5,cw:0,rl:0},
  gnome:{pp:0,ol:+5,ft:+10,ms:+5,hs:+5,dn:+10,cw:-15,rl:0},
  halfelf:{pp:+10,ol:0,ft:0,ms:0,hs:+5,dn:0,cw:0,rl:0},
  halfling:{pp:+5,ol:+5,ft:+5,ms:+10,hs:+15,dn:+5,cw:-15,rl:-5}
};
const THIEF_ARMOR_ADJ = {
  none:{pp:+5,ol:0,ft:0,ms:+10,hs:+5,dn:0,cw:+10,rl:0},
  elfinChain:{pp:-20,ol:-5,ft:-5,ms:-10,hs:-10,dn:-5,cw:-20,rl:0},
  padded:{pp:-30,ol:-10,ft:-10,ms:-20,hs:-20,dn:-10,cw:-30,rl:0}
};
// 敏捷调整（表格28，值→数组按 nvSkills 顺序 盗窃/开锁/找除陷/潜行/阴影）
const THIEF_DEX_ADJ = {
  9:[-15,-10,-10,-20,-10],10:[-10,-5,-10,-15,-5],11:[-5,0,-5,-10,0],12:[0,0,0,-5,0],
  13:[0,0,0,0,0],14:[0,0,0,0,0],15:[0,0,0,0,0],16:[0,5,0,0,0],17:[5,10,0,5,5],
  18:[10,15,5,10,10],19:[15,20,10,15,15]
};

// ---------- 属性值调整（用于 HP/豁免/技能等）----------
// 体质：每级生命骰奖励 + 生命值加值（1-25）
const CON_HP = {
  1:-3,2:-2,3:-2,4:-1,5:-1,6:-1,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:0,15:1,
  16:2,17:2,18:2,19:2,20:2,21:2,22:3,23:3,24:4,25:4
};
// 灵知：奖励法术位(牧师) 与 魔法防御调整；简化内置<魔法防御用于豁免法术>：
const WIS_SAVE_BONUS = {13:{rnw:0,clone:0},14:{rnw:0,clone:0},15:{rnw:2,clone:0},16:{rnw:2,clone:1},17:{rnw:2,clone:1},18:{rnw:3,clone:1},19:{rnw:3,clone:2},20:{rnw:3,clone:2},21:{rnw:4,clone:2},22:{rnw:4,clone:3},23:{rnw:5,clone:3},24:{rnw:5,clone:4},25:{rnw:5,clone:4}};
// 魅力：信徒人数与忠诚、NPC反应——写卡器仅展示 表内魅力调整
const CHA_LEADERSHIP = {1:[0,0],2:[0,0],3:[2,0],4:[2,0],5:[3,0],6:[3,0],7:[4,0],8:[4,0],9:[5,0],10:[5,0],11:[5,0],12:[6,0],13:[7,1],14:[8,1],15:[9,1],16:[10,2],17:[11,2],18:[12,3],19:[13,3],20:[14,4],21:[15,5],22:[16,6],23:[17,7],24:[18,8],25:[19,9]};
// 智力：额外语言（0-25）
const INT_LANGUAGE = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:1,10:2,11:2,12:3,13:3,14:4,15:4,16:5,17:6,18:7,19:8,20:9,21:10,22:11,23:12,24:13,25:14};

// ---------- 巫师法术（简化；含通才每级已学法术数）----------
// [级别, 每级法术数1-9]
const MAGE_SPELLS = {
  1:[[1,0,0,0,0,0,0,0,0],[2,0,0,0,0,0,0,0,0]],
  2:[[2,1,0,0,0,0,0,0,0],[2,2,0,0,0,0,0,0,0]],
  3:[[2,2,1,0,0,0,0,0,0],[3,2,2,0,0,0,0,0,0]],
  4:[[3,2,2,1,0,0,0,0,0],[3,3,2,2,0,0,0,0,0]],
  5:[[3,3,2,2,1,0,0,0,0],[4,3,3,2,2,0,0,0,0]],
  6:[[4,3,3,2,2,1,0,0,0],[4,4,3,3,2,2,0,0,0]],
  7:[[4,4,3,3,2,2,1,0,0],[5,4,4,3,3,2,2,0,0]],
  8:[[4,4,4,3,3,2,2,1,0],[5,5,4,4,3,3,2,2,0]],
  9:[[4,4,4,4,3,3,2,2,1],[5,5,5,4,4,3,3,2,2]],
  10:[[5,4,4,4,4,3,3,2,2],[5,5,5,5,4,4,3,3,2]],
  11:[[5,5,4,4,4,4,3,3,2],[5,5,5,5,5,4,4,3,3]],
  12:[[5,5,5,4,4,4,4,3,3],[6,5,5,5,5,4,4,4,3]],
  13:[[5,5,5,5,4,4,4,4,3],[6,5,5,5,5,5,4,4,4]],
  14:[[5,5,5,5,5,4,4,4,4],[6,5,5,5,5,5,5,4,4]],
  15:[[5,5,5,5,5,5,4,4,4],[6,6,5,5,5,5,5,4,4]],
  16:[[6,5,5,5,5,5,5,4,4],[6,6,5,5,5,5,5,5,4]],
  17:[[6,6,5,5,5,5,5,5,4],[6,6,6,5,5,5,5,5,4]],
  18:[[6,6,5,5,5,5,5,5,5],[6,6,6,5,5,5,5,5,5]],
  19:[[6,6,6,5,5,5,5,5,5],[6,6,6,6,5,5,5,5,5]],
  20:[[6,6,6,5,5,5,5,5,5],[7,6,6,6,5,5,5,5,5]]
};

// ---------- 身体特征（表格10-12，简化）----------
const PHYSICAL_SUMMARY = {
  human:{age:[18,40], height:"男子 5'2\"—6'2\" / 女子 5'0\"—6'0\"", weight:"110—200磅(男) / 90—160磅(女)"},
  dwarf:{age:[40,150], height:"3'10\"—4'3\"", weight:"130—180磅", note:'比人类长寿，40岁成年'},
  elf:{age:[110,700], height:"4'5\"—5'4\"", weight:"90—160磅", note:'超过百岁成年'},
  gnome:{age:[60,350], height:"3'0\"—3'7\"", weight:"70—130磅", note:'杂技与工程天赋'},
  halfelf:{age:[22,170], height:"5'0\"—6'0\"", weight:"100—175磅", note:'精灵与人類的混血'},
  halfling:{age:[20,150], height:"3'0\"—3'5\"", weight:"60—80磅", note:'比人類成年略早'}
};

return {
  ABILITY_NAMES, ABILITY_KEYS,
  STRENGTH_TABLE, EXCEPTIONAL_STRENGTH, GENERIC_ADJUST,
  RACES, CLASS_GROUPS, CLASSES, ALIGNMENTS,
  SAVES, SAVE_NAMES, THAC0, PROF_SLOTS, START_MONEY,
  THIEF_SKILLS, THIEF_RACE_ADJ, THIEF_ARMOR_ADJ, THIEF_DEX_ADJ,
  CON_HP, WIS_SAVE_BONUS, CHA_LEADERSHIP, INT_LANGUAGE,
  MAGE_SPELLS, PHYSICAL_SUMMARY
};

})();