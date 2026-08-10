/**
 * ADND2E 角色创建向导（车卡器）
 * 依赖 window.CHARGEN_DATA（assets/chargen-data.js）
 * 视图切换入口：#chargenBtn / #chargenBack（与 app.js 协作）
 */
(function(){
'use strict';

const D = window.CHARGEN_DATA;
const $  = (s, r) => (r||document).querySelector(s);
const $$ = (s, r) => Array.from((r||document).querySelectorAll(s));
const STORE_KEY = 'adnd-chargen-saves';

const state = {
  step: 0,
  hero: null,            // 当前角色对象
  editing: false,        // 是否从存档载入
  equipment: [],         // 已购装备
  weaponsParsed: false,  // 武器表解析完成
};

/* ==================== 工具 ==================== */
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function roll(faces){ return 1 + Math.floor(Math.random()*faces); }
function pickDiceExpr(expr){
  // '5d4x10' / '(1d4+1)x10' -> 解析产生 gp 数量
  const m = expr.match(/\(*(\d*)d(\d+)([+-]\d+)?\)*x(\d+)/);
  if(!m) return 0;
  const n = m[1]? +m[1] : 1, f = +m[2], mod = m[3]? +m[3] : 0, mul = +m[4];
  let s = 0; for(let i=0;i<n;i++) s += roll(f);
  return (s + mod) * mul;
}
function uid(){ return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function diceStr(v, extra){ // 展示一把骰子结果
  return v.join(' + ').replace(/\+ -/g,'- ') + (extra ? ' = ' + extra : '');
}

/* ==================== 存档 ==================== */
function loadSaves(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }catch(e){ return {}; }
}
function writeSaves(s){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(s)); }catch(e){} }
function saveHero(){
  if(!state.hero) return;
  state.hero.updated = Date.now();
  const all = loadSaves();
  if(!state.hero.id) state.hero.id = uid();
  all[state.hero.id] = state.hero;
  writeSaves(all);
  toast('已保存到本地');
}
function loadHero(id){
  const all = loadSaves();
  const h = all[id];
  if(h){
    state.hero = h;
    state.editing = true;
    state.equipment = h.equipment || [];
  }
  return h;
}
function deleteHero(id){
  const all = loadSaves();
  delete all[id];
  writeSaves(all);
}

/* ==================== 新角色初始 ==================== */
function newHero(){
  state.hero = {
    id: null, name:'', gender:'', age:'',
    abilities: {str:0,dex:0,con:0,int:0,wis:0,cha:0},   // 初始(投出未调整)
    abilitiesRaw:null,                                  // 掷点原始数组 [6]
    method:'method3', exceptional:null,                 // 超凡力量百分骰
    race:null, classKey:null, alignment:'',
    level:1, hp:0, hpRaw:0, movement:12,
    saves:null, thac0:0, thac0Bonus:0,
    weaponSlots:[], nonweaponSlots:[], languages:[],
    customWeapons:[], customNonweapons:[],
    thiefSkills:{}, thiefPointsSpent:0, bardMode:false,
    money:0, gpFormulas:null,
    equipment:[],
    notes:''
  };
  state.editing = false;
  state.equipment = [];
}

/* ==================== 视图切换（小窗模式，与 app.js 协调） ==================== */
let scrimEl = null;
function getScrim(){
  if(!scrimEl){
    scrimEl = document.createElement('div');
    scrimEl.id = 'chargenScrim';
    document.body.appendChild(scrimEl);
    scrimEl.addEventListener('click', exitChargen);
  }
  return scrimEl;
}
function enterChargen(){
  const v = $('#chargenView');
  if(!v) return;
  if(v.hidden) render();
  v.hidden = false;
  const s = getScrim();
  s.hidden = false;
  // 通知 app.js 关掉搜索等浮层（若已加载）
  if(window.ADND_APP && window.ADND_APP.setChargenActive){
    window.ADND_APP.setChargenActive(true);
  }
}
function exitChargen(){
  const v = $('#chargenView');
  if(v) v.hidden = true;
  if(scrimEl) scrimEl.hidden = true;
  if(window.ADND_APP && window.ADND_APP.setChargenActive){
    window.ADND_APP.setChargenActive(false);
  }
}

/* ==================== 拖拽移动小窗 ==================== */
function enableDrag(){
  const v = $('#chargenView');
  const top = $('#chargenTop');
  if(!v || !top) return;
  let sx=0, sy=0, ox=0, oy=0, drag=false;
  top.style.userSelect = 'none';
  top.addEventListener('mousedown', (e)=>{
    const btn = e.button;
    if(btn !== 0 && btn !== undefined) return;
    drag = true;
    const r = v.getBoundingClientRect();
    ox = r.left; oy = r.top;
    sx = e.clientX - ox; sy = e.clientY - oy;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e)=>{
    if(!drag) return;
    const r = v.getBoundingClientRect();
    let nx = e.clientX - sx, ny = e.clientY - sy;
    // 限制在可视区域
    nx = Math.max(-r.width+80, Math.min(nx, window.innerWidth-60));
    ny = Math.max(0, Math.min(ny, window.innerHeight-40));
    v.style.top = ny+'px';
    v.style.right = 'auto';
    v.style.left = nx+'px';
  });
  document.addEventListener('mouseup', ()=>{ drag = false; });
  // 触摸支持
  top.addEventListener('touchstart', (e)=>{
    const t = e.touches[0];
    drag = true;
    const r = v.getBoundingClientRect();
    ox = r.left; oy = r.top;
    sx = t.clientX - ox; sy = t.clientY - oy;
  }, {passive:true});
  document.addEventListener('touchmove', (e)=>{
    if(!drag) return;
    const t = e.touches[0];
    let nx = t.clientX - sx, ny = t.clientY - sy;
    nx = Math.max(-v.getBoundingClientRect().width+80, Math.min(nx, window.innerWidth-60));
    ny = Math.max(0, Math.min(ny, window.innerHeight-40));
    v.style.top = ny+'px';
    v.style.right = 'auto';
    v.style.left = nx+'px';
  }, {passive:true});
  document.addEventListener('touchend', ()=>{ drag = false; });
}

/* ==================== 主渲染 ==================== */
const STEPS = [
  {id:'home',   label:'总览'},
  {id:'abil',   label:'属性生成'},
  {id:'race',   label:'选择种族'},
  {id:'class',  label:'选择职业'},
  {id:'align',  label:'选择阵营'},
  {id:'combat', label:'豁免与命中'},
  {id:'hp',     label:'生命值'},
  {id:'move',   label:'移动力'},
  {id:'skills', label:'熟练'},
  {id:'thief',  label:'盗贼技能'},
  {id:'money',  label:'起始资金'},
  {id:'gear',   label:'装备购买'},
  {id:'sheet',  label:'角色卡'}
];

function render(){
  const body = $('#chargenBody');
  if(!body) return;
  const cur = (state.hero && state.hero.race) ? state.hero.race : '';
  // 步骤导航
  let nav = '<div class="cg-steps">';
  for(const s of STEPS){
    const cls = s.id===state.stepId ? 'cur' : '';
    nav += `<button class="cg-step ${cls}" data-step="${s.id}" type="button">${s.label}</button>`;
  }
  nav += '</div>';
  const content = renderStep();
  body.innerHTML = nav + '<div class="cg-body">' + content + '</div>';
  $('#cgStepLabel').textContent = STEPS.find(s=>s.id===state.stepId).label;
  wireNav(body);
}

function renderStep(){
  const s = state.stepId || 'home';
  switch(s){
    case 'home': return stepHome();
    case 'abil': return stepAbilities();
    case 'race': return stepRace();
    case 'class': return stepClass();
    case 'align': return stepAlign();
    case 'combat': return stepCombat();
    case 'hp': return stepHp();
    case 'move': return stepMove();
    case 'skills': return stepSkills();
    case 'thief': return stepThief();
    case 'money': return stepMoney();
    case 'gear': return stepGear();
    case 'sheet': return stepSheet();
  }
  return '';
}

function wireNav(body){
  $$('.cg-step', body).forEach(b=>{
    b.addEventListener('click', ()=> goStep(b.dataset.step));
  });
  // 底部按钮
  const prev = $('#cgPrev', body), next = $('#cgNext', body);
  if(prev) prev.addEventListener('click', ()=> goStep(prev.dataset.step));
  if(next) next.addEventListener('click', ()=> goStep(next.dataset.step));
  if($('#cgFinish', body)) $('#cgFinish', body).addEventListener('click', ()=> render());
}

function navFooter(id, prev, next){
  let h = '<div class="cg-footer">';
  if(prev) h += `<button id="cgPrev" class="btn" data-step="${prev}" type="button">← ${stepLabel(prev)}</button>`;
  if(next) h += `<button id="cgNext" class="btn btn-primary" data-step="${next}" type="button">${stepLabel(next)} →</button>`;
  h += '</div>';
  return h;
}
function stepLabel(id){ const s = STEPS.find(x=>x.id===id); return s? s.label : id; }
function goStep(id){
  state.stepId = id;
  render();
}

/* ==================== 首页 ==================== */
function stepHome(){
  const all = loadSaves();
  const keys = Object.keys(all);
  const list = keys.length ? keys.map(id=>{
    const h = all[id];
    const t = (h.raceName||h.race)||'';
    return `<div class="cg-save-item">
      <div><b>${esc(h.name || '未命名')}</b> <span class="muted">${esc(t)} · Lv.${h.level||1}</span></div>
      <div class="cg-save-actions">
        <button class="btn" data-load="${id}" type="button">载入</button>
        <button class="btn btn-danger" data-del="${id}" type="button">删除</button>
      </div>
    </div>`;
  }).join('') : '<p class="muted">暂无存档，从新建角色开始。</p>';

  let h = `
  <div class="cg-card cg-intro">
    <h2>车卡向导</h2>
    <p>跟随 AD&D 2E 玩家手册第一章至第六章，一步步创建你的角色卡。每步都可在左上角返回阅读规则书原文。</p>
    <button id="cgNew" class="btn btn-primary btn-lg" type="button">＋ 新建角色</button>
  </div>
  <div class="cg-card">
    <h3>我的存档</h3>
    ${list}
  </div>`;
  setTimeout(()=>{
    const n = $('#cgNew'); if(n) n.addEventListener('click', ()=>{ newHero(); state.stepId='abil'; render(); });
    $$('[data-load]').forEach(b=> b.addEventListener('click', ()=>{ loadHero(b.dataset.load); state.stepId='abil'; render(); }));
    $$('[data-del]').forEach(b=> b.addEventListener('click', ()=>{ deleteHero(b.dataset.del); render(); }));
  },0);
  return h;
}

/* ==================== 属性生成 ==================== */
function abilityMod(val, key){
  // 返回属性检定修正（通用），力量用力量表命中
  if(key === 'str'){
    const idx = Math.max(1, Math.min(18, val));
    const t = D.STRENGTH_TABLE[idx-1];
    return {hit:t.hit, dmg:t.dmg, gen: (t.hit)};
  }
  return {gen:(D.GENERIC_ADJUST[val]!==undefined ? D.GENERIC_ADJUST[val] : 0)};
}
function rollMethod(method){
  // method1 4d6去最低 ; method2 3d6 ; method3 3d6x6重掷1(当作单次3d6) ; method4 4d6去最低选高
  const outs=[];
  for(let i=0;i<6;i++){
    if(method==='method1' || method==='method4'){
      const d=[roll(6),roll(6),roll(6),roll(6)].sort((a,b)=>a-b);
      outs.push(d[1]+d[2]+d[3]);
    } else {
      const d1=roll(6),d2=roll(6),d3=roll(6);
      let s = d1+d2+d3;
      if(method==='method3'){ // 3d6 掷两次取高（简化：重掷骰子取高）
        const d4=roll(6),d5=roll(6),d6=roll(6);
        s = Math.max(d1+d2+d3, d4+d5+d6);
      }
      outs.push(s);
    }
  }
  return outs;
}
function stepAbilities(){
  const h = state.hero;
  const m = h.method || 'method3';
  const raws = h.abilitiesRaw || [0,0,0,0,0,0];
  const methodDesc = {
    method1:'方法一：4d6，去掉最低的骰子（强力而均衡）',
    method2:'方法二：3d6 六次（简单直接）',
    method3:'方法三：3d6 掷两组取最高（偏强）',
    method4:'方法四：4d6 去最低，可重掷（强力）'
  };
  let rows = '';
  const KEYS = D.ABILITY_KEYS;
  for(let i=0;i<6;i++){
    const k = KEYS[i], nm = D.ABILITY_NAMES[i];
    const val = h.abilities[k] || 0;
    const mod = abilityMod(val, k);
    const raw = raws[i] || 0;
    rows += `<div class="cg-abil-row" data-key="${k}">
      <div class="cg-abil-name">${nm}</div>
      <div class="cg-abil-val"><input type="number" min="1" max="25" value="${val}" data-val="${k}" class="cg-num"> <span class="cg-raw">(原始 ${raw||'—'})</span></div>
      <div class="cg-abil-mod">修正：${mod.gen>=0?'+':''}${mod.gen}</div>
    </div>`;
  }
  let htm = `
  <div class="cg-card">
    <h2 id="cgAbilStep">步骤1 · 生成属性值</h2>
    <p class="muted">选择生成方式并投掷六项属性（力量、敏捷、体质、智力、灵知、魅力）。也可直接手动填写。</p>
    <div class="cg-methods">
      ${Object.keys(methodDesc).map(k=>`<label class="cg-method"><input type="radio" name="cg-method" value="${k}" ${m===k?'checked':''}> ${methodDesc[k]}</label>`).join('')}
    </div>
    <button id="cgRoll" class="btn btn-primary" type="button">🎲 投掷属性</button>
    ${rows}
  </div>
  ${navFooter('abil', null, 'race')}
  `;
  setTimeout(()=>{
    const radios = $$('input[name="cg-method"]');
    radios.forEach(r=> r.addEventListener('change', ()=>{ h.method=r.value; }));
    $('#cgRoll').addEventListener('click', ()=>{
      const outs = rollMethod(h.method);
      h.abilitiesRaw = outs;
      for(let i=0;i<6;i++) h.abilities[KEYS[i]] = outs[i];
      render();
    });
    $$('.cg-abil-row input[data-val]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        h.abilities[inp.dataset.val] = +inp.value || 0;
        // 只更新该行的修正值显示，避免整块重渲染打断连续输入
        const row = inp.closest('.cg-abil-row');
        const modEl = row.querySelector('.cg-abil-mod');
        const mod = abilityMod(h.abilities[inp.dataset.val], inp.dataset.val);
        if(modEl) modEl.textContent = '修正：' + (mod.gen>=0?'+':'') + mod.gen;
      });
    });
  },0);
  return htm;
}

/* ==================== 种族 ==================== */
function raceOk(h, raceKey){
  // 自定义种族：使用玩家设定的要求；未设定则视为无限制
  if(raceKey==='custom'){
    const rc = h.customRace;
    if(!rc || !rc.req) return {ok:true, reasons:[]};
    const reasons=[];
    for(const k of D.ABILITY_KEYS){
      const v = h.abilities[k] || 0;
      const range = rc.req[k];
      if(!range) continue;
      if(v < range[0] || v > range[1]) reasons.push(`${D.ABILITY_NAMES[ABILITY_KEY_IDX(k)]} ${v} 不在 ${range[0]}–${range[1]}`);
    }
    return {ok: reasons.length===0, reasons};
  }
  const r = D.RACES[raceKey];
  if(raceKey==='human') return {ok:true, reasons:[]};
  const reasons=[];
  for(const k of D.ABILITY_KEYS){
    const v = h.abilities[k] || 0;
    const range = r.req && r.req[k];
    if(!range) continue;
    if(v < range[0] || v > range[1]) reasons.push(`${D.ABILITY_NAMES[ABILITY_KEY_IDX(k)]} ${v} 不在 ${range[0]}–${range[1]}`);
  }
  return {ok: reasons.length===0, reasons};
}
function ABILITY_KEY_IDX(k){ return D.ABILITY_KEYS.indexOf(k); }

function stepRace(){
  const h = state.hero;
  const cur = h.race || '';
  const rc = h.customRace || null;
  let html = `<div class="cg-card">
    <h2>步骤2 · 选择种族</h2>
    <p class="muted">每个种族都有属性最低/最高要求（表格7）与属性调整（表格8）。点击选择。人类无限制。官方种族不足时可用“自定义种族”。</p>
    <div class="cg-grid">`;
  for(const key of Object.keys(D.RACES)){
    const r = D.RACES[key];
    const ok = raceOk(h, key);
    const sel = cur===key ? ' sel' : '';
    const adjStr = Object.keys(r.adjust||{}).length
      ? Object.keys(r.adjust).map(a=>{
          const modv = r.adjust[a];
          return `${D.ABILITY_NAMES[ABILITY_KEY_IDX(a)]} ${modv>0?'+':''}${modv}`;
        }).join(', ')
      : '无调整';
    html += `<div class="cg-race ${sel} ${ok.ok?'':'bad'}" data-key="${key}" tabindex="0">
      <h3>${r.name}</h3>
      <p class="muted">调整：${adjStr}</p>
      <p class="small">${r.note||''}</p>
      ${ok.ok? '<span class="tag ok">✓ 符合</span>' : '<span class="tag bad">✗ 属性不足</span>'}
      ${!ok.ok? '<p class="small warn">'+esc(ok.reasons.join('；'))+'</p>' : ''}
    </div>`;
  }
  // 自定义种族卡片（若已定义则显示可选用）
  if(rc){
    const ok = raceOk(h, 'custom');
    const sel = cur==='custom' ? ' sel' : '';
    const adjStr = Object.keys(rc.adjust||{}).some(a=>rc.adjust[a])
      ? Object.keys(rc.adjust).filter(a=>rc.adjust[a]).map(a=>`${D.ABILITY_NAMES[ABILITY_KEY_IDX(a)]} ${rc.adjust[a]>0?'+':''}${rc.adjust[a]}`).join(', ') || '无调整'
      : '无调整';
    html += `<div class="cg-race ${sel} ${ok.ok?'':'bad'}" data-key="custom" tabindex="0">
      <h3>⭐ ${esc(rc.name||'自定义种族')}</h3>
      <p class="muted">调整：${adjStr}</p>
      <p class="small">${esc(rc.note||'自定义内容，不受原书限制。')}</p>
      ${ok.ok? '<span class="tag ok">✓ 符合</span>' : '<span class="tag bad">✗ 属性不足</span>'}
    </div>`;
  }
  // “新建自定义”卡片（无则为主入口，有则允许再次编辑）
  html += `<div class="cg-race cg-custom-card" data-key="__new" tabindex="0">
      <h3>✏️ ${rc?'编辑自定义种族':'新建自定义种族'}</h3>
      <p class="small muted">自行设计种族：名称、属性调整、可选职业、特性说明。不限原书。</p>
    </div>
    </div>
    <div id="cgCustomRaceForm" class="cg-custom-form" hidden>
      <h3>自定义种族</h3>
      <div class="cg-cf-row"><label>种族名称<input type="text" id="cgCrName" value="${rc?esc(rc.name||''):''}" placeholder="如：龙裔"></label></div>
      <div class="cg-cf-row">属性调整（六项，正负均可）：
        ${D.ABILITY_KEYS.map(k=>`<label class="cg-cf-abil">${D.ABILITY_NAMES[ABILITY_KEY_IDX(k)]}<input type="number" id="cgCrAdj_${k}" value="${rc&&rc.adjust?rc.adjust[k]||0:0}"></label>`).join('')}
      </div>
      <div class="cg-cf-row">属性要求（最低值，0 表示不限）：
        ${D.ABILITY_KEYS.map(k=>`<label class="cg-cf-abil">${D.ABILITY_NAMES[ABILITY_KEY_IDX(k)]}<input type="number" id="cgCrReq_${k}" value="${rc&&rc.req&&rc.req[k]?rc.req[k][0]:0}" min="0" max="25"></label>`).join('')}
      </div>
      <div class="cg-cf-row"><label>可选职业（逗号分隔，留空=任意）<input type="text" id="cgCrClasses" value="${rc&&rc.classes?esc(rc.classes.join('、')):''}" placeholder="如：战士、牧师、盗贼"></label></div>
      <div class="cg-cf-row"><label>特性说明<textarea id="cgCrNote" rows="2" placeholder="种族特征、能力、阵营倾向（可手填，随意发挥）">${rc?esc(rc.note||''):''}</textarea></label></div>
      <div class="cg-cf-actions">
        <button id="cgCrSave" class="btn btn-primary" type="button">确定并使用</button>
        <button id="cgCrCancel" class="btn" type="button">取消</button>
        ${rc?`<button id="cgCrDelete" class="btn btn-danger" type="button">删除自定义</button>`:''}
      </div>
    </div>
  </div>
  ${navFooter('race','abil','class')}
  `;
  setTimeout(()=>{
    $$('.cg-race[data-key]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const k = el.dataset.key;
        if(k==='__new'){
          const f = $('#cgCustomRaceForm');
          f.hidden = !f.hidden;
          return;
        }
        const ok = raceOk(h,k);
        if(!ok.ok) { toast(ok.reasons.join('；')); return; }
        // 应用调整（基于原始投点）
        const r = k==='custom' ? h.customRace : D.RACES[k];
        h.race = k;
        const arr = h.abilitiesRaw;
        const base = Array.isArray(arr)
          ? D.ABILITY_KEYS.reduce((o,a,i)=>{ o[a]=arr[i]||0; return o; }, {})
          : {...h.abilities};
        for(const a of D.ABILITY_KEYS) h.abilities[a] = (base[a]||0) + ((r.adjust&&r.adjust[a])||0);
        h.raceName = r.name;
        render();
      });
    });
    const sv = $('#cgCrSave');
    if(sv) sv.addEventListener('click', ()=>{
      const name = $('#cgCrName').value.trim();
      if(!name){ toast('请输入种族名称'); return; }
      const adjust = {};
      const req = {};
      for(const k of D.ABILITY_KEYS){
        adjust[k] = +$('#cgCrAdj_'+k).value || 0;
        const reqv = +$('#cgCrReq_'+k).value || 0;
        req[k] = reqv>0 ? [reqv, 25] : null;
      }
      const classes = $('#cgCrClasses').value.split(/[,，、\s]+/).filter(Boolean);
      h.customRace = {
        name, adjust, req, classes,
        note: $('#cgCrNote').value.trim()
      };
      // 立即应用
      h.race = 'custom';
      h.raceName = name;
      const arr = h.abilitiesRaw;
      const base = Array.isArray(arr)
        ? D.ABILITY_KEYS.reduce((o,a,i)=>{ o[a]=arr[i]||0; return o; }, {})
        : {...h.abilities};
      for(const a of D.ABILITY_KEYS) h.abilities[a] = (base[a]||0) + ((adjust[a])||0);
      render();
    });
    const cc = $('#cgCrCancel');
    if(cc) cc.addEventListener('click', ()=>{ $('#cgCustomRaceForm').hidden = true; });
    const del = $('#cgCrDelete');
    if(del) del.addEventListener('click', ()=>{
      delete h.customRace;
      if(h.race==='custom'){ h.race=null; h.raceName=''; }
      render();
    });
  },0);
  return html;
}

/* ==================== 职业 ==================== */
function classOk(h, groupKey, clsKey){
  // 自定义职业：仅检查玩家设定的属性要求
  if(clsKey==='custom'){
    const cc = h.customClass;
    if(!cc || !cc.req) return [];
    const reasons=[];
    for(const k of Object.keys(cc.req)){
      const need = cc.req[k];
      if(!need) continue;
      const have = h.abilities[k]||0;
      if(have < need) reasons.push(`${D.ABILITY_NAMES[ABILITY_KEY_IDX(k)]} 需 ${need}，当前 ${have}`);
    }
    return reasons;
  }
  const cls = D.CLASSES[clsKey];
  const req = cls.req || {};
  const reasons=[];
  const c = D.CLASS_GROUPS[groupKey];
  for(const k of Object.keys(req)){
    const need = req[k], have = h.abilities[k]||0;
    if(have < need) reasons.push(`${D.ABILITY_NAMES[ABILITY_KEY_IDX(k)]} 需 ${need}，当前 ${have}`);
  }
  // 种族可选职业限制（自定义种族仅当它定义了 classes 才限制）
  if(h.race && D.RACES[h.race]){
    const avail = D.RACES[h.race].classes || [];
    if(avail.length && !avail.includes(cls.name) && h.race!=='human') reasons.unshift('此种族不能选择该职业');
  } else if(h.race==='custom' && h.customRace && h.customRace.classes && h.customRace.classes.length){
    const avail = h.customRace.classes;
    if(!avail.includes(cls.name)) reasons.unshift('此自定义种族不能选择该职业');
  }
  return reasons;
}
function stepClass(){
  const h = state.hero;
  if(!h.race){ return `<div class="cg-card"><h2>步骤3</h2><p>请先回到上一步选择种族。</p>${navFooter('class','race','align')}</div>`; }
  const cc = h.customClass || null;
  // 判定该种族可选的职业名单（自定义种族未设 classes = 任意）
  function raceAllows(clsName){
    if(h.race==='human') return true;
    if(h.race==='custom'){
      const list = h.customRace && h.customRace.classes;
      if(!list || !list.length) return true;
      return list.includes(clsName);
    }
    const avail = D.RACES[h.race].classes || [];
    return avail.includes(clsName);
  }
  let html = `<div class="cg-card">
    <h2>步骤3 · 选择职业</h2>
    <p class="muted">已选种族：<b>${esc(h.raceName||h.race)}</b>。职业分为四类：勇士(d10)、法师(d4)、祭司(d8)、游荡者(d6)。官方职业不足时可用“自定义职业”。</p>
    <div class="cg-grid cg-classgrid">`;
  for(const gk of Object.keys(D.CLASS_GROUPS)){
    const g = D.CLASS_GROUPS[gk];
    html += `<div class="cg-group">
      <h3>${g.name} <small>生命骰 ${g.hitDie}</small></h3>`;
    const ccList = g.classes.map(cn=>classKeyOfName(cn)).filter(k=>raceAllows(D.CLASSES[k].name));
    for(const k of ccList){
      const cls = D.CLASSES[k];
      const reasons = classOk(h, gk, k);
      const sel = h.classKey===k ? ' sel' : '';
      html += `<div class="cg-class ${sel} ${reasons.length?'bad':''}" data-key="${k}" tabindex="0">
        <h4>${cls.name}</h4>
        <p class="small muted">首要属性：${cls.prime.map(p=>D.ABILITY_NAMES[ABILITY_KEY_IDX(p)]).join('、')}</p>
        ${reasons.length? '<p class="small warn">'+esc(reasons.join('；'))+'</p>' : ''}
      </div>`;
    }
    html += `</div>`;
  }
  // 自定义职业卡片
  if(cc){
    const sel = h.classKey==='custom' ? ' sel' : '';
    const g = D.CLASS_GROUPS[cc.group] || null;
    html += `<div class="cg-class cg-custom-cls ${sel}" data-key="custom" tabindex="0">
      <h4>⭐ ${esc(cc.name||'自定义职业')}</h4>
      <p class="small muted">${g? g.name+' · 生命骰 '+esc(cc.hitDie||g.hitDie) : '生命骰 '+esc(cc.hitDie||'')}</p>
      ${(cc.req? Object.keys(cc.req).filter(k=>cc.req[k]).map(k=>D.ABILITY_NAMES[ABILITY_KEY_IDX(k)]+'≥'+cc.req[k]).join('、'):'')? '<p class="small muted">要求：'+(Object.keys(cc.req).filter(k=>cc.req[k]).map(k=>D.ABILITY_NAMES[ABILITY_KEY_IDX(k)]+'≥'+cc.req[k]).join('、'))+'</p>':''}
    </div>`;
  }
  html += `<div class="cg-class cg-custom-card" data-key="__new" tabindex="0">
      <h4>✏️ ${cc?'编辑自定义职业':'新建自定义职业'}</h4>
      <p class="small muted">自行设计职业：名称、生命骰、所属类别、属性要求、阵营限制。不限原书。</p>
    </div>
    </div>
    <div id="cgCustomClassForm" class="cg-custom-form" hidden>
      <h3>自定义职业</h3>
      <div class="cg-cf-row"><label>职业名称<input type="text" id="cgCcName" value="${cc?esc(cc.name||''):''}" placeholder="如：魔剑士"></label></div>
      <div class="cg-cf-row"><label>所属类别（决定豁免/THAC0/起始资金基础）
        <select id="cgCcGroup">${Object.keys(D.CLASS_GROUPS).map(gk=>`<option value="${gk}" ${cc&&cc.group===gk?'selected':''}>${D.CLASS_GROUPS[gk].name}（${D.CLASS_GROUPS[gk].hitDie}）</option>`).join('')}</select></label></div>
      <div class="cg-cf-row"><label>生命骰
        <select id="cgCcDie">${['d4','d6','d8','d10','d12','d20'].map(d=>`<option value="${d}" ${cc&&cc.hitDie===d?'selected':''}>${d}</option>`).join('')}</select></label></div>
      <div class="cg-cf-row">属性要求（最低值，0 表示不限）：
        ${D.ABILITY_KEYS.map(k=>`<label class="cg-cf-abil">${D.ABILITY_NAMES[ABILITY_KEY_IDX(k)]}<input type="number" id="cgCcReq_${k}" value="${cc&&cc.req&&cc.req[k]?cc.req[k]:0}" min="0" max="25"></label>`).join('')}
      </div>
      <div class="cg-cf-row"><label>阵营限制（可留空）<input type="text" id="cgCcAlign" value="${cc&&cc.align?esc(cc.align.join('、')):''}" placeholder="如：任意中立、守序善良；留空=任意"></label></div>
      <div class="cg-cf-actions">
        <button id="cgCcSave" class="btn btn-primary" type="button">确定并使用</button>
        <button id="cgCcCancel" class="btn" type="button">取消</button>
        ${cc?`<button id="cgCcDelete" class="btn btn-danger" type="button">删除自定义</button>`:''}
      </div>
    </div>
  </div>
  ${navFooter('class','race','align')}`;
  setTimeout(()=>{
    $$('.cg-class[data-key]').forEach(el=>{
      el.addEventListener('click', ()=>{
        const k = el.dataset.key;
        if(k==='__new'){
          const f = $('#cgCustomClassForm');
          f.hidden = !f.hidden;
          return;
        }
        if(k==='custom'){
          h.classKey = 'custom';
          h.className = h.customClass.name;
          state.stepId = 'align';
          render();
          return;
        }
        if(classOk(h, D.CLASSES[k].group, k).length){ toast('不满足要求的职业'); return; }
        h.classKey = k;
        h.className = D.CLASSES[k].name;
        state.stepId = 'align';
        render();
      });
    });
    const sv = $('#cgCcSave');
    if(sv) sv.addEventListener('click', ()=>{
      const name = $('#cgCcName').value.trim();
      if(!name){ toast('请输入职业名称'); return; }
      const req = {};
      for(const k of D.ABILITY_KEYS) req[k] = +$('#cgCcReq_'+k).value || 0;
      const align = $('#cgCcAlign').value.split(/[,，、\s]+/).filter(Boolean);
      h.customClass = {
        name,
        group: $('#cgCcGroup').value,
        hitDie: $('#cgCcDie').value,
        req,
        align: align.length? align : null
      };
      h.classKey = 'custom';
      h.className = name;
      state.stepId = 'align';
      render();
    });
    const ccCancel = $('#cgCcCancel');
    if(ccCancel) ccCancel.addEventListener('click', ()=>{ $('#cgCustomClassForm').hidden = true; });
    const del = $('#cgCcDelete');
    if(del) del.addEventListener('click', ()=>{
      delete h.customClass;
      if(h.classKey==='custom'){ h.classKey=null; h.className=''; }
      render();
    });
  },0);
  return html;
}
function classKeyOfName(n){ // 名->key
  for(const k of Object.keys(D.CLASSES)) if(D.CLASSES[k].name===n) return k;
  return n;
}
/* 自定义职业统一访问 */
function heroClassInfo(h){
  if(!h || !h.classKey) return null;
  if(h.classKey==='custom') return h.customClass || null;
  return D.CLASSES[h.classKey] || null;
}
function heroGroup(h){
  const c = heroClassInfo(h);
  return c ? (c.group || null) : null;
}
function heroHitDie(h){
  const c = heroClassInfo(h);
  if(c && c.hitDie) return c.hitDie;
  const g = heroGroup(h);
  return g ? D.CLASS_GROUPS[g].hitDie : 'd10';
}
function heroProfSlots(h){
  const g = heroGroup(h);
  if(!g) return null;
  return D.PROF_SLOTS[g] || null;
}

/* ==================== 阵营 ==================== */
function stepAlign(){
  const h = state.hero;
  const cls = heroClassInfo(h);
  const custom = (h.classKey==='custom');
  const limit = cls && cls.align ? cls.align : null;
  const allowAll = !limit || limit.some(t=>/任意|任何|不限|均可/.test(t)) || limit.length===0;
  const allowSet = allowAll ? null : D.ALIGNMENTS.filter(a=> limit.some(t=>t.includes(a)|| a.includes(t)));
  const enabled = allowAll ? true : (a)=> allowSet.includes(a);
  let html = `<div class="cg-card">
    <h2>步骤4 · 选择阵营</h2>`;
  if(limit && (custom||!allowAll)){
    html += `<p class="muted">${custom?'自定义职业':'职业'} <b>${esc(cls.name)}</b> 限定的阵营：${limit.map(esc).join(' / ')}${allowAll?'（未匹配到标准阵营，按全阵营开放）':''}</p>`;
  } else {
    html += `<p class="muted">该职业无阵营限制，选择任意阵营。</p>`;
  }
  html += `<div class="cg-align-grid">`;
  for(const a of D.ALIGNMENTS){
    const disabled = !allowAll && !enabled(a);
    const sel = h.alignment===a ? ' sel' : '';
    html += `<div class="cg-align ${sel} ${disabled?'dis':''}" data-a="${a}" ${disabled?'aria-disabled=true':''} tabindex="0">${a}</div>`;
  }
  html += `</div></div>${navFooter('align','class','combat')}`;
  setTimeout(()=>{
    $$('.cg-align[data-a]').forEach(el=>{
      el.addEventListener('click', ()=>{
        if(el.classList.contains('dis')) return;
        h.alignment = el.dataset.a;
        render();
      });
    });
  },0);
  return html;
}

/* ==================== 豁免与命中 ==================== */
function computeSaves(h){
  if(!h.classKey) return null;
  const group = heroGroup(h);
  if(!group) return null;
  const g = D.CLASS_GROUPS[group];
  const lvl = h.level || 1;
  const st = D.SAVES[g.saves];
  const row = st.find(r=> lvl>=r[0] && lvl<=r[1]) || st[st.length-1];
  return {group: g.saves, row, names:D.SAVE_NAMES};
}
function computeThac0(h){
  if(!h.classKey) return 0;
  const group = heroGroup(h);
  if(!group) return 20;
  const g = D.CLASS_GROUPS[group];
  const lvl = h.level || 1;
  const arr = D.THAC0[g.thac0];
  return arr[Math.min(lvl-1, arr.length-1)];
}
function stepCombat(){
  const h = state.hero;
  if(!h.classKey){ return `<div class="cg-card"><h2>步骤5</h2><p>请先选择职业。</p>${navFooter('combat','align','hp')}</div>`; }
  const saves = computeSaves(h);
  const thac0 = computeThac0(h);
  const g = D.CLASS_GROUPS[heroGroup(h)];
  let strows = '';
  if(saves){
    strows = saves.names.map((n,i)=>`
      <div class="cg-save-row">
        <span>${n}</span>
        <b>${saves.row[i+2]}</b>
      </div>`).join('');
  }
  // THAC0 可手动加奖励（如力量/专精）
  let html = `<div class="cg-card">
    <h2>步骤5 · 豁免检定与零级命中值</h2>
    <p class="muted">职业 <b>${esc(h.className||'')}</b>（${g.name}）· 等级 ${h.level||1}</p>
    <h3>豁免检定（表格60）</h3>
    <div class="cg-saves">${strows}</div>
    <h3>命中值 THAC0（表格53）</h3>
    <div class="cg-thac0-line">
      <span>基础 THAC0：<b>${thac0}</b></span>
      <label>力量/专精修正：<input type="number" class="cg-num" id="cgThac0Bonus" value="${h.thac0Bonus||0}"></label>
      <span>最终 THAC0：<b id="cgThac0Final">${thac0 - (h.thac0Bonus||0)}</b></span>
    </div>
  </div>
  ${navFooter('combat','align','hp')}`;
  setTimeout(()=>{
    const inp = $('#cgThac0Bonus');
    if(inp) inp.addEventListener('change', ()=>{
      h.thac0Bonus = +inp.value || 0;
      h.thac0 = thac0 - h.thac0Bonus;
      const f = $('#cgThac0Final'); if(f) f.textContent = h.thac0;
    });
  },0);
  h.saves = saves;
  h.thac0 = thac0 - (h.thac0Bonus||0);
  return html;
}

/* ==================== 生命值 ==================== */
function stepHp(){
  const h = state.hero;
  if(!h.classKey) return `<div class="cg-card"><h2>步骤6</h2><p>请先选择职业。</p>${navFooter('hp','combat','move')}</div>`;
  const g = D.CLASS_GROUPS[heroGroup(h)];
  const hitDie = heroHitDie(h);
  const faces = +hitDie.slice(1);
  const con = h.abilities.con||0;
  const conMod = D.CON_HP[con] || 0;
  let html = `<div class="cg-card">
    <h2>步骤6 · 投掷生命值</h2>
    <p class="muted">职业类别 <b>${g.name}</b> 使用 <b>${hitDie}</b>（1 级角色将获得满值 + 体质修正）。</p>
    <div class="cg-hp-line">
      <span>生命骰：${hitDie}</span>
      <span>体质 ${con} → 每级HP ${conMod>0?'+':''}${conMod}</span>
    </div>
    <div class="cg-hp-line">
      <span>1级生命值（自动满骰）：<b>${faces + conMod}</b></span>
      <label>可手动调整：<input type="number" class="cg-num" id="cgHp" value="${h.hp || faces+conMod}"></label>
    </div>
  </div>
  ${navFooter('hp','combat','move')}`;
  setTimeout(()=>{
    const inp = $('#cgHp');
    inp.addEventListener('change', ()=>{ h.hp = +inp.value || 0; });
  },0);
  if(!h.hp) h.hp = faces + conMod;
  return html;
}

/* ==================== 移动力 ==================== */
function stepMove(){
  const h = state.hero;
  // 基础移动——多数 PC 为12（表格64）
  let html = `<div class="cg-card">
    <h2>步骤7 · 记录基础移动</h2>
    <p class="muted">大多数人类系角色的基础移动为 <b>12</b>。矮人与半身人受到护甲负重影响时减益。基于种族微调：精灵/半身人常为 12(轻) & 6(重甲)。</p>
    <label>移动力：<input type="number" class="cg-num" id="cgMove" value="${h.movement||12}" min="3" max="18"></label>
  </div>
  ${navFooter('move','hp','skills')}`;
  setTimeout(()=>{
    const inp = $('#cgMove');
    inp.addEventListener('change', ()=>{ h.movement = +inp.value || 12; });
  },0);
  return html;
}

/* ==================== 熟练 ==================== */
const NONWEAPON_LIST = [
  '农业','动物处理','动物训练','伪装艺术','航行艺术','阅读书写','工程学','垂钓','博彩','追踪','治疗','驯鹰','氏族勘察','引导','考古','纹章学','骑术','打结','跳跃','语言','本地历史','编织','铸造','观测','心理评估','游泳','登山','酿酒','宗教','读唇','占卜','跑酷','地质','草药','挥剑术','锻造甲胄','造弓','石工','刑侦','仪态','预算','地理','历史','神秘','长生不老','表演'
];
const GENERIC_WEAPONS = [
  '匕首','短剑','长剑','阔剑','弯刀','战斧','手斧','战锤','钉头锤','硬头锤','长矛','短枪','长枪','短弓','长弓','矮人重型十字弓','轻型十字弓','重型十字弓','投石索','短棍','长棍','流星锤','匕首投掷','飞镖'
];

function stepSkills(){
  const h = state.hero;
  if(!h.classKey) return '<div class="cg-card"><h2>步骤8</h2><p>请先选择职业。</p>'+navFooter('skills','move','thief')+'</div>';
  const group = heroGroup(h);
  const slots = D.PROF_SLOTS[group];
  const clsName = heroClassInfo(h).name;
  const wsl = h.weaponSlots || [];
  const nsl = h.nonweaponSlots || [];
  const cw = h.customWeapons || [];
  const cn = h.customNonweapons || [];
  const weaponChips = GENERIC_WEAPONS.concat(cw).map(w=>{
    const on = wsl.includes(w) ? ' on' : '';
    const del = cw.includes(w) ? '<button class="cg-chip-del" data-delw="'+esc(w)+'" title="删除自定义武器" type="button">×</button>' : '';
    return '<span class="cg-chip"><label class="cg-pick'+on+'" data-w="'+esc(w)+'" tabindex="0"><input type="checkbox" data-w="'+esc(w)+'"'+(on?' checked':'')+'>'+esc(w)+'</label>'+del+'</span>';
  }).join('');
  const nwChips = NONWEAPON_LIST.concat(cn).map(n=>{
    const on = nsl.includes(n) ? ' on' : '';
    const del = cn.includes(n) ? '<button class="cg-chip-del" data-deln="'+esc(n)+'" title="删除自定义技能" type="button">×</button>' : '';
    return '<span class="cg-chip"><label class="cg-pick'+on+'" data-n="'+esc(n)+'" tabindex="0"><input type="checkbox" data-n="'+esc(n)+'"'+(on?' checked':'')+'>'+esc(n)+'</label>'+del+'</span>';
  }).join('');
  let html = '<div class="cg-card"><h2>步骤8 · 选择熟练（可选）</h2>'
    + '<p class="muted">'+esc(clsName)+'（'+esc(D.CLASS_GROUPS[group].name)+'）：武器槽初始 '+slots.weapon.init+'（此后每'+slots.weapon.perLevel+'级+1），非武器槽初始 '+slots.nonweapon.init+'（此后每'+slots.nonweapon.perLevel+'级+1）。</p>'
    + '<div class="cg-col2">'
    + '<div><h3>武器熟练</h3>'
    + '<div class="cg-picklist">'+weaponChips+'</div>'
    + '<div class="cg-chip-add"><input type="text" id="cgAddWeapon" placeholder="自定义武器名…" maxlength="24"><button id="cgAddWeaponBtn" class="btn" type="button">＋ 添加</button></div>'
    + '</div>'
    + '<div><h3>非武器熟练与语言</h3>'
    + '<div class="cg-picklist">'+nwChips+'</div>'
    + '<div class="cg-chip-add"><input type="text" id="cgAddSkill" placeholder="自定义技能名…" maxlength="24"><button id="cgAddSkillBtn" class="btn" type="button">＋ 添加</button></div>'
    + '</div>'
    + '</div></div>'
    + navFooter('skills','move','thief');
  setTimeout(()=>{
    $$('input[data-w]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const w = inp.dataset.w;
        const i = wsl.indexOf(w);
        if(inp.checked && i<0) wsl.push(w); else if(!inp.checked && i>=0) wsl.splice(i,1);
        h.weaponSlots = wsl.slice();
        render();
      });
    });
    $$('input[data-n]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const n = inp.dataset.n;
        const i = nsl.indexOf(n);
        if(inp.checked && i<0) nsl.push(n); else if(!inp.checked && i>=0) nsl.splice(i,1);
        h.nonweaponSlots = nsl.slice();
        render();
      });
    });
    const addWd = $('#cgAddWeaponBtn');
    if(addWd) addWd.addEventListener('click', ()=>{
      const v = $('#cgAddWeapon').value.trim();
      if(!v){ toast('请输入武器名'); return; }
      if(cw.includes(v) || GENERIC_WEAPONS.includes(v)){ toast('该武器已在列表中'); return; }
      cw.push(v); h.customWeapons = cw.slice();
      if(h.weaponSlots.indexOf(v)<0){ h.weaponSlots = h.weaponSlots.concat(v); }
      render();
    });
    $('#cgAddWeapon').addEventListener('keydown', e=>{ if(e.key==='Enter') addWd.click(); });
    const addSk = $('#cgAddSkillBtn');
    if(addSk) addSk.addEventListener('click', ()=>{
      const v = $('#cgAddSkill').value.trim();
      if(!v){ toast('请输入技能名'); return; }
      if(cn.includes(v) || NONWEAPON_LIST.includes(v)){ toast('该技能已在列表中'); return; }
      cn.push(v); h.customNonweapons = cn.slice();
      if(h.nonweaponSlots.indexOf(v)<0){ h.nonweaponSlots = h.nonweaponSlots.concat(v); }
      render();
    });
    $('#cgAddSkill').addEventListener('keydown', e=>{ if(e.key==='Enter') addSk.click(); });
    $$('.cg-chip-del').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const w = btn.dataset.delw;
        const n = btn.dataset.deln;
        if(w!==undefined){
          h.customWeapons = h.customWeapons.filter(x=>x!==w);
          h.weaponSlots = h.weaponSlots.filter(x=>x!==w);
        } else if(n!==undefined){
          h.customNonweapons = h.customNonweapons.filter(x=>x!==n);
          h.nonweaponSlots = h.nonweaponSlots.filter(x=>x!==n);
        }
        render();
      });
    });
  },0);
  return html;
}

/* ==================== 盗贼技能 ==================== */
const THIEF_ROGUE = { thief:{pts:60, cap:30}, bard:{pts:20, cap:30} };
function stepThief(){
  const h = state.hero;
  const isThief = h.classKey==='thief';
  const isBard = h.classKey==='bard';
  if(!isThief && !isBard){
    return '<div class="cg-card"><h2>步骤9</h2><p class="muted">职业 '+esc(h.className||'—')+' 非盗贼/吟游诗人，跳过。继续购装。</p>'+navFooter('thief','skills','money')+'</div>';
  }
  const cfg = isThief ? THIEF_ROGUE.thief : THIEF_ROGUE.bard;
  const dex = h.abilities.dex||0;
  const dAdj = D.THIEF_DEX_ADJ[dex] || D.THIEF_DEX_ADJ[13];
  const raceAdj = (h.race && D.THIEF_RACE_ADJ[h.race]) || {};
  const skills = h.thiefSkills || {};
  const spent = Object.keys(skills).reduce((a,k)=>a+(skills[k]||0),0);
  const rem = cfg.pts - spent;
  let rows = '';
  D.THIEF_SKILLS.forEach((s,i)=>{
    const d = isThief ? (dAdj[i]||0) : 0;
    const r = raceAdj[s.id]||0;
    const cur = skills[s.id] || 0;
    const total = s.base + d + r + cur;
    rows += '<div class="cg-thief-row">'
      + '<span class="cg-thief-name" title="'+esc(s.name)+'">'+esc(s.name)+'</span>'
      + '<span class="small muted">基础'+s.base+'% 种族'+(r>=0?'+':'')+r+'% 敏捷'+(d>=0?'+':'')+d+'%</span>'
      + '<input type="range" min="0" max="'+cfg.cap+'" value="'+cur+'" data-skill="'+s.id+'">'
      + '<b class="cg-thief-val">'+total+'%</b></div>';
  });
  let html = '<div class="cg-card"><h2>步骤9 · '+esc(isThief?'盗贼':'吟游诗人')+'技能分配</h2>'
    + '<p class="muted">分配 '+cfg.pts+' 点，单项上限 '+cfg.cap+'。已用 <b>'+spent+'</b>，剩余 <b>'+rem+'</b>。</p>'
    + rows + '</div>'
    + navFooter('thief','skills','money');
  setTimeout(()=>{
    $$('input[data-skill]').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        const id = inp.dataset.skill;
        if(skills[id] === undefined) skills[id] = 0;
        // 从当前技能对象实时计算已用点数（避免陈旧闭包）
        const curSpent = Object.keys(skills).reduce((a,k)=>a+(skills[k]||0),0);
        const delta = (+inp.value) - skills[id];
        if(curSpent + delta > cfg.pts){ inp.value = skills[id]; return; }
        skills[id] = +inp.value;
        h.thiefSkills = Object.assign({}, skills);
        // 更新剩余与总%值
        const ns = Object.keys(skills).reduce((a,k)=>a+(skills[k]||0),0);
        const sr = cfg.pts - ns;
        const lbl = $('#cgPtsLeft'); if(lbl) lbl.textContent = sr;
        const idx = D.THIEF_SKILLS.findIndex(x=>x.id===id);
        const d = isThief ? (dAdj[idx]||0) : 0;
        const r = raceAdj[id]||0;
        const tot = D.THIEF_SKILLS[idx].base + d + r + skills[id];
        const cell = inp.closest('.cg-thief-row').querySelector('.cg-thief-val');
        if(cell) cell.textContent = tot+'%';
      });
    });
  },0);
  return html;
}

/* ==================== 起始资金 ==================== */
function stepMoney(){
  const h = state.hero;
  if(!h.classKey) return '<div class="cg-card"><h2>步骤10</h2><p>请先选择职业。</p>'+navFooter('money','thief','gear')+'</div>';
  const group = heroGroup(h);
  const formula = D.START_MONEY[group];
  let html = '<div class="cg-card"><h2>步骤10 · 起始资金</h2>'
    + '<p class="muted">职业类别 <b>'+esc(D.CLASS_GROUPS[group].name)+'</b> 的起始资金公式：<b>'+esc(formula)+' GP</b>。</p>'
    + '<div class="cg-hp-line"><span class="big">当前金钱：<b>'+ (h.money||0) +' GP</b></span>'
    + '<button id="cgRollMoney" class="btn" type="button">🎲 掷资金</button></div>'
    + '<label>手动设置：<input type="number" class="cg-num" id="cgMoney" value="'+(h.money||0)+'"></label>'
    + '</div>' + navFooter('money','thief','gear');
  setTimeout(()=>{
    $('#cgRollMoney').addEventListener('click', ()=>{
      const val = pickDiceExpr(formula);
      h.money = val;
      h.gpFormulas = formula;
      render();
    });
    $('#cgMoney').addEventListener('change', ()=>{ h.money = +$('#cgMoney').value||0; });
  },0);
  return html;
}

/* ==================== 装备 ==================== */
const FALLBACK_EQUIP = [
  {cat:'武器', name:'匕首', price:'2gp'},
  {cat:'武器', name:'短剑', price:'10gp'},
  {cat:'武器', name:'长剑', price:'15gp'},
  {cat:'武器', name:'战斧', price:'7gp'},
  {cat:'武器', name:'手斧', price:'1gp'},
  {cat:'武器', name:'长矛', price:'1gp'},
  {cat:'武器', name:'短弓', price:'30gp'},
  {cat:'武器', name:'长弓', price:'75gp'},
  {cat:'武器', name:'轻型十字弓', price:'35gp'},
  {cat:'武器', name:'投石索', price:'1gp'},
  {cat:'护甲', name:'皮甲', price:'15gp'},
  {cat:'护甲', name:'镶钉皮甲', price:'20gp'},
  {cat:'护甲', name:'锁子甲', price:'75gp'},
  {cat:'护甲', name:'板甲', price:'400gp'},
  {cat:'护甲', name:'木盾', price:'3gp'},
  {cat:'护甲', name:'钢盾', price:'10gp'},
  {cat:'装备', name:'背包', price:'2gp'},
  {cat:'装备', name:'水袋', price:'1gp'},
  {cat:'装备', name:'火把', price:'5cp'},
  {cat:'装备', name:'绳(50呎)', price:'1gp'},
  {cat:'装备', name:'燧石与打火石', price:'5sp'}
];
let parsedCatalog = null; // {weapons:[], gear:[]}

async function preloadEquipment(){
  if(parsedCatalog) return;
  parsedCatalog = {weapons:[], gear:[]};
  const fc = (window.ADND_APP && window.ADND_APP.fetchContent) || (p => fetch(p));
  try{
    const t0=performance.now();
    const res = await fc('content/topics/\u6b66\u5668\u8868\u683c.htm');
    const txt = await res.text();
    const doc = new DOMParser().parseFromString(txt,'text/html');
    const allRows = $$('table tr', doc);
    // 找表头行：通常含“武器”“速度”。没有则默认第一数据行是表头
    let start = 0;
    for(let i=0;i<allRows.length;i++){
      const t = allRows[i].textContent.replace(/\s+/g,' ').trim();
      if(t.indexOf('速度')>=0 || t.indexOf('重量')>=0){ start = i+1; if(t.indexOf('武器')>=0) start = i+1; break; }
    }
    if(start===0){
      const t0row = allRows[0].textContent.replace(/\s+/g,' ').trim();
      if(/速度|武器名|名字/i.test(t0row)) start = 1;
    }
    let count=0;
    for(const tr of allRows.slice(start)){
      const cells = $$('th,td', tr).map(td=>td.textContent.replace(/\s+/g,' ').trim()||'');
      if(cells.length>=2 && cells[0]){
        const name = cells[0];
        if(name.length>50 || name==='武器' || name==='短/中/长' || !/[一-鿿]|[a-zA-Z]/.test(name)) continue;
        parsedCatalog.weapons.push({
          name,
          weight: cells[1]||'',
          size: cells[2]||'',
          dmgType: cells[3]||'',
          speed: cells[4]||'',
          reach: cells[5]||'',
          dmgSM: cells[8]||'',   // 对抗小型/中型
          dmgL: cells[9]||'',    // 对抗大型
          knockdown: cells[10]||''
        });
        count++;
        if(count>200) break;
      }
    }
    const res2 = await fc('content/topics/\u88c5\u5907\u5217\u8868.htm');
    const txt2 = await res2.text();
    const doc2 = new DOMParser().parseFromString(txt2,'text/html');
    let count2=0;
    for(const tbl of $$('table', doc2)){
      const rows = $$('tr', tbl);
      for(const tr of rows.slice(1)){
        const cells = $$('th,td', tr).map(td=>td.textContent.replace(/\s+/g,' ').trim()||'');
        if(cells.length>=2 && !/^装备/.test(cells[0]) && count2<200){
          parsedCatalog.gear.push({name:cells[0], price:cells[1]});
          count2++;
        }
      }
    }
    console.log('[chargen] 武器解析', parsedCatalog.weapons.length, '装备', parsedCatalog.gear.length, (performance.now()-t0).toFixed(0)+'ms');
    console.log('[chargen] 武器样例', JSON.stringify(parsedCatalog.weapons.slice(0,3)));
    console.log('[chargen] 装备样例', JSON.stringify(parsedCatalog.gear.slice(0,3)));
  }catch(e){
    parsedCatalog = null;
    console.warn('[chargen] 装备表解析失败，使用内置精简表', e);
  }
  // 若当前正停在装备步，重渲染以显示完整表
  if(state.stepId === 'gear') render();
}

function priceNum(p){
  // '5cp' -> 0.05gp ; '2gp' -> 2 ; '5sp'->0.5 ; 也兼容 '5 gp'
  const m = String(p||'').match(/([\d.]+)(gp|sp|cp)?/i);
  if(!m) return 0;
  const n = parseFloat(m[1]);
  const u = (m[2]||'gp').toLowerCase();
  return n * (u==='sp'?0.1 : u==='cp'?0.01 : 1);
}

function stepGear(){
  const h = state.hero;
  const equipped = h.equipment || [];
  preloadEquipment();
  const source = (parsedCatalog && parsedCatalog.weapons.length) ? parsedCatalog : null;
  // 合并目录：武器 + 护甲（内置）+ 装备（解析的有则用之）
  const weapons = source ? source.weapons : FALLBACK_EQUIP.filter(e=>e.cat==='武器');
  // 内置价格表，用于给解析到的武器补价格
  const priceMap = {};
  for(const e of FALLBACK_EQUIP) priceMap[e.name] = e.price;
  const gear = (source && parsedCatalog.gear.length)
    ? parsedCatalog.gear.map(g=>({cat:'装备', name:g.name, price:g.price, cost:g.price}))
    : FALLBACK_EQUIP.filter(e=>e.cat!=='武器');
  const fits = equipped.filter(i=>i.cat==='护甲'||i.cat==='装备');
  let spent = 0;
  for(const it of equipped) spent += priceNum(it.price||it.cost);
  const money = h.money||0;
  let html = '<div class="cg-card"><h2>步骤11 · 装备购买</h2>'
    + '<p class="muted">金钱 <b>'+money+' GP</b>，已花 <b>'+spent.toFixed(2)+' GP</b>，剩余 <b>'+(money-spent).toFixed(2)+' GP</b>。'
    + (source? '<span class="tag ok">已载入完整武器/装备表</span>' : '<span class="tag bad">内置精简表</span>')
    + '</p>'
    + '<div class="cg-gear-col"><h3>武器</h3><div class="cg-picklist cg-gear">'
    + weapons.map(w=>{
      const nm = w.name||'';
      const on = equipped.some(i=>i.name===nm && i.cat==='武器');
      const price = priceMap[nm] || '';
      const bits = [];
      if(price) bits.push(price);
      if(w.speed) bits.push('速'+w.speed.replace(/[()]/g,''));
      if(w.size) bits.push(w.size);
      if(w.weight) bits.push(w.weight+'磅');
      if(w.dmgSM) bits.push('伤'+w.dmgSM);
      const label = nm + (bits.length? ' · '+bits.join('/') : '');
      return '<label class="cg-pick'+(on?' on':'')+'" data-cat="武器" data-name="'+esc(nm)+'" data-price="'+esc(price)+'" tabindex="0"><input type="checkbox" data-cat="武器" data-name="'+esc(nm)+'" data-price="'+esc(price)+'"'+(on?' checked':'')+'>'+esc(label)+'</label>';
    }).join('')
    + '</div></div>'
    + '<div class="cg-gear-col"><h3>护甲与装备</h3><div class="cg-picklist cg-gear">'
    + gear.map(g=>{
      const nm = g.name||'';
      const on = equipped.some(i=>i.name===nm && i.cat===g.cat);
      const price = g.price||'';
      return '<label class="cg-pick'+(on?' on':'')+'" data-cat="'+esc(g.cat)+'" data-name="'+esc(nm)+'" data-price="'+esc(price)+'" tabindex="0"><input type="checkbox" data-cat="'+esc(g.cat)+'" data-name="'+esc(nm)+'" data-price="'+esc(price)+'"'+(on?' checked':'')+'>'+esc(nm+' · '+price)+'</label>';
    }).join('')
    + '</div></div></div>'
    + navFooter('gear','money','sheet');
  setTimeout(()=>{
    $$('.cg-gear input[type=checkbox]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const cat = inp.dataset.cat, name = inp.dataset.name, price = inp.dataset.price||'—';
        const i = equipped.findIndex(x=>x.cat===cat && x.name===name);
        if(inp.checked && i<0){
          const newCost = totalCost() + priceNum(price);
          if(money < newCost){ inp.checked=false; toast('金钱不足'); return; }
          equipped.push({cat, name, price});
        } else if(!inp.checked && i>=0){
          equipped.splice(i,1);
        }
        h.equipment = equipped.slice();
        render();
      });
    });
  },0);
  return html;
}
function totalCost(){
  const h = state.hero;
  if(!h) return 0;
  return (h.equipment||[]).reduce((a,i)=>a+priceNum(i.price),0);
}

/* ==================== 角色卡（可编辑，支持扩展规则手工修正） ==================== */
function stepSheet(){
  const h = state.hero;
  if(!h) return '';
  const hc = h.custom || {};
  const eqCost = totalCost().toFixed(2);
  const equipList = h.equipment || [];
  const customEquip = (hc.customEquip || []).filter(Boolean);
  const allEquip = equipList.map(i=>i.name).concat(customEquip);
  let savesHtml = '';
  if(h.saves && h.saves.row){
    savesHtml = h.saves.names.map((n,i)=>{
      const v = hc.saves && Array.isArray(hc.saves) ? (hc.saves[i]!==undefined? hc.saves[i] : h.saves.row[i+2]) : h.saves.row[i+2];
      return '<div class="sh-save"><span>'+esc(n)+'</span><input type="number" data-save="'+i+'" value="'+v+'"></div>';
    }).join('');
  }
  const thiefHtml = Object.keys(h.thiefSkills||{}).length
    ? '<div class="sh-field">'+Object.keys(h.thiefSkills).map(k=>{
        const s = D.THIEF_SKILLS.find(x=>x.id===k);
        const base = s? s.base : 0;
        const v = (hc.thief && hc.thief[k]!==undefined) ? hc.thief[k] : Math.min(99, base+(h.thiefSkills[k]||0));
        return '<label>'+esc(s?s.name:k)+'<input type="number" data-thief="'+k+'" value="'+v+'">%</label>';
      }).join('') + '</div>'
    : '';
  const weaponTxt = (h.weaponSlots||[]).join('、');
  const nonweaponTxt = (h.nonweaponSlots||[]).join('、');

  let html = '<div class="cg-card sh-sheet">'
    + '<h2>角色卡 <span class="sh-edit-note">（全部数值可直接修改——扩展规则请自行调整）</span></h2>'

    + '<div class="sh-head">'
    + '<div class="sh-name">'
    + '<div class="sh-name-input"><input type="text" data-field="name" value="'+esc(h.name||'')+'" placeholder="姓名" id="cgSheetName">'
    + '<span class="muted">'+esc(h.raceName||h.race||'—')+' · '+esc(h.className||'—')+'</span></div>'
    + '<div class="sh-name-meta">'
    + '<label>等级<input type="number" data-field="level" value="'+(h.level||1)+'" min="1" max="40"></label>'
    + '<label>性别<input type="text" data-field="gender" value="'+esc(h.gender||'')+'" style="width:54px"></label>'
    + '<label>年龄<input type="number" data-field="age" value="'+(h.age||'')+'" style="width:54px"></label>'
    + '<label>身高<input type="text" data-field="height" value="'+esc(hc.height||'')+'" style="width:54px"></label>'
    + '<label>体重<input type="text" data-field="weight" value="'+esc(hc.weight||'')+'" style="width:54px"></label>'
    + '</div>'
    + '</div>'
    + '<div class="sh-name-right">'
    + '<div class="sh-ac">生命值<input type="number" data-field="hp" value="'+(h.hp||0)+'"></div>'
    + '<div class="sh-ac">移动<input type="number" data-field="movement" value="'+(h.movement||12)+'"></div>'
    + '<div class="sh-ac">THAC0<input type="number" data-field="thac0" value="'+(h.thac0||20)+'"></div>'
    + '<div class="sh-ac">生命骰<input type="text" data-field="hitDice" value="'+esc(hc.hitDice||guessHitDice(h))+'" style="width:64px"></div>'
    + '</div></div>'

    + '<h3>属性 <span class="muted small">（手动输入可支持 19+ / 超凡力量等扩展）</span></h3>'
    + '<div class="sh-abils">'+D.ABILITY_KEYS.map((k,i)=>{
      const v = h.abilities[k]||0;
      const m = abilityMod(v,k);
      const str2 = (k==='str' && (hc.exceptionalStr!==undefined)) ? ('<small class="sh-exstr">'+hc.exceptionalStr+'%</small>') : '';
      return '<div class="sh-abil"><b>'+D.ABILITY_NAMES[i]+'</b><input type="number" data-abil="'+k+'" value="'+v+'">'+str2+'<small data-mod="'+k+'">'+(m.gen>=0?'+':'')+m.gen+'</small></div>';
    }).join('')+'</div>'

    + '<h3>豁免检定 <span class="muted small">（可直接修改，适应扩展）</span></h3>'
    + '<div class="sh-saves">'+savesHtml+'</div>'

    + '<div class="sh-cols">'
    + '<div>'
    + '<h3>命中与防护 <span class="muted small">（可直接修改）</span></h3>'
    + '<div class="sh-field">'
    + '<label>护甲等级 AC<input type="number" data-field="ac" value="'+(hc.ac||10)+'"></label>'
    + '<label>伤害加成<input type="number" data-field="dmgBonus" value="'+(hc.dmgBonus||0)+'"></label>'
    + '<label>攻击次数<input type="text" data-field="attacks" value="'+esc(hc.attacks||'')+'"></label>'
    + '<label>力量伤害<input type="number" data-field="strDmg" value="'+(hc.strDmg||0)+'"></label>'
    + '</div>'
    + '<h3>金钱</h3>'
    + '<div class="sh-field"><label>持有金钱<input type="number" data-field="money" value="'+(h.money||0)+'"> GP</label></div>'
    + '<h3>盗贼技能 <span class="muted small">（最终百分比，可改）</span></h3>'
    + (thiefHtml || '<p class="small muted">此职业不使用盗贼技能</p>')
    + '</div>'
    + '<div>'
    + '<h3>熟练与语言</h3>'
    + '<div class="sh-field"><label>武器熟练<input type="text" data-field="weaponSlots" value="'+esc(weaponTxt)+'" placeholder="逗号分隔"></label></div>'
    + '<div class="sh-field"><label>非武器熟练<input type="text" data-field="nonweaponSlots" value="'+esc(nonweaponTxt)+'" placeholder="逗号分隔"></label></div>'
    + '<h3>装备 <span class="small muted">已选：'+esc((equipList.length+customEquip.length)+' 项')+'</span></h3>'
    + '<p class="small">'+esc(allEquip.join('、')||'—')+'</p>'
    + '<div class="sh-field sh-custom-equip"><label>额外装备 / 魔法物品<input type="text" data-field="customEquip" value="'+esc(hc.customEquip? hc.customEquip.join('、') : '')+'" placeholder="逗号分隔，可补充书外物品"></label></div>'
    + '<h3>备注 / 扩展规则说明</h3>'
    + '<div class="sh-field"><textarea data-field="notes" placeholder="记录扩展规则带来的调整、背景与战役设定…">'+esc(h.notes||'')+'</textarea></div>'
    + '</div></div>'

    + '<div class="cg-footer sh-actions"><button id="cgSaveSheet" class="btn btn-primary" type="button">💾 保存</button>'
    + '<button id="cgPrintSheet" class="btn" type="button">🖨 打印</button>'
    + '<button id="cgRecalc" class="btn" type="button">↺ 按已选规则重算</button></div>';

  setTimeout(()=>{
    // 通用字段
    $$('[data-field]', $('#chargenBody')).forEach(inp=>{
      const set = (v)=>{
        const f = inp.dataset.field;
        if(f==='name'){ h.name=v; }
        else if(f==='gender'){ h.gender=v; }
        else if(f==='age'){ h.age=+v||''; }
        else if(f==='level'){ h.level=Math.max(1, +v||1); }
        else if(f==='hp'){ h.hp=+v||0; }
        else if(f==='movement'){ h.movement=+v||0; }
        else if(f==='thac0'){ h.thac0=+v||20; }
        else if(f==='money'){ h.money=+v||0; }
        else if(f==='weaponSlots'){ h.weaponSlots = String(v).split(/[,，、\s]+/).filter(Boolean); }
        else if(f==='nonweaponSlots'){ h.nonweaponSlots = String(v).split(/[,，、\s]+/).filter(Boolean); }
        else if(f==='customEquip'){ h.custom = h.custom||{}; h.custom.customEquip = String(v).split(/[,，、]/).map(s=>s.trim()).filter(Boolean); }
        else if(f==='notes'){ h.notes=v; }
        else { h.custom = h.custom||{}; h.custom[f] = (f==='height'||f==='weight'||f==='attacks'||f==='hitDice') ? v : (+v||0); }
      };
      inp.addEventListener('change', ()=> set(inp.value));
      inp.addEventListener('input',  ()=> set(inp.value));
    });
    // 属性
    $$('[data-abil]').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        const k = inp.dataset.abil;
        h.abilities[k] = +inp.value || 0;
        const m = abilityMod(h.abilities[k], k);
        const modEl = inp.closest('.sh-abil').querySelector('[data-mod="'+k+'"]');
        if(modEl) modEl.textContent = (m.gen>=0?'+':'')+m.gen;
      });
    });
    // 豁免 —— 存自定义覆盖
    $$('[data-save]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        h.custom = h.custom||{};
        if(!Array.isArray(h.custom.saves)) h.custom.saves = h.saves? h.saves.row.slice(2) : [0,0,0,0,0];
        h.custom.saves[+inp.dataset.save] = +inp.value||0;
      });
    });
    // 盗贼技能 —— 存最终百分比
    $$('[data-thief]').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        h.custom = h.custom||{};
        h.custom.thief = h.custom.thief||{};
        h.custom.thief[inp.dataset.thief] = Math.max(0, Math.min(99, +inp.value||0));
      });
    });
    const sv = $('#cgSaveSheet'); if(sv) sv.addEventListener('click', saveHero);
    const pr = $('#cgPrintSheet'); if(pr) pr.addEventListener('click', ()=>{ document.body.classList.add('printing'); window.print(); setTimeout(()=>document.body.classList.remove('printing'),200); });
    const rc = $('#cgRecalc'); if(rc) rc.addEventListener('click', ()=>{
      // 清空手工覆盖，按已选种族/职业数据重算
      h.custom = {};
      h.saves = computeSaves(h);
      h.thac0 = computeThac0(h);
      h.hp = (state.hero? 0 : 0);
      render();
    });
  },0);
  return html;
}
function guessHitDice(h){
  if(!h.classKey) return '';
  return heroHitDie(h) || '';
}

/* ==================== toast ==================== */
function thiefSkillLabel(k){
  const s = D.THIEF_SKILLS.find(x=>x.id===k);
  if(!s) return k;
  const cur = state.hero.thiefSkills[k]||0;
  return s.name+' '+Math.min(99, s.base+cur)+'%';
}
let toastEl=null;
function toast(msg){
  if(!toastEl){ toastEl = document.createElement('div'); toastEl.id='cgToast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(()=>toastEl.classList.remove('show'), 1800);
}

/* ==================== 初始化 ==================== */
function init(){
  $('#chargenBtn').addEventListener('click', enterChargen);
  $('#chargenBack').addEventListener('click', exitChargen);
  const cgSave = $('#cgSave'); if(cgSave) cgSave.addEventListener('click', saveHero);
  const cgPrint = $('#cgPrint'); if(cgPrint) cgPrint.addEventListener('click', ()=>{
    if(state.stepId !== 'sheet'){ state.stepId = 'sheet'; render(); }
    document.body.classList.add('printing');
    setTimeout(()=>{ window.print(); setTimeout(()=>document.body.classList.remove('printing'),200); }, 50);
  });
  if(!state.hero) newHero();
  state.stepId = 'home';
  enableDrag();
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();