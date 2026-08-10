(function(){
'use strict';

const CONTENT_BASE = 'content/';
const TOPICS_BASE  = CONTENT_BASE + 'topics/';
const DEFAULT_PAGE = '前序.htm';
// 大陆加速：优先 jsDelivr CDN 镜像（可用），失败自动回退原站
const CDN_PREFIX  = 'https://cdn.jsdelivr.net/gh/aomiguicanghui/aomiguicanghui.github.io@main/';
let contentSource = ''; // ''=未测 'cdn'='CDN可用' 'local'='CDN不可用，固定原站'

function cdnUrl(rel){
  return CDN_PREFIX + rel.split('/').map(encodeURIComponent).join('/');
}
async function fetchWithTimeout(url, ms){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), ms);
  try{
    const res = await fetch(url, {signal:ctrl.signal});
    if(!res.ok) throw new Error('HTTP '+res.status);
    return res;
  } finally {
    clearTimeout(t);
  }
}
async function fetchContent(rel){
  // rel 形如 'webhelpcontents.htm' 或 'topics/xxx.htm'
  if(contentSource === 'local') return fetchWithTimeout(CONTENT_BASE + rel, 12000);
  try{
    const res = await fetchWithTimeout(cdnUrl('content/' + rel), 10000);
    contentSource = 'cdn';
    return res;
  }catch(e){
    console.warn('CDN 不可用，回退原站加载 ', rel, e);
    contentSource = 'local';
    return fetchWithTimeout(CONTENT_BASE + rel, 12000);
  }
}

const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const state = {
  treeReady: false,
  docs: [],
  indexReady: false,
  currentUrl: '',
  lastQuery: '',
};

/* ============================ utils ============================ */
function normPath(p){ return String(p||'').replace(/\\/g,'/'); }
function normUrl(u){
  // normalize "topics//foo.htm" or "topics\foo.htm" or "foo.htm" -> "topics/foo.htm"
  u = normPath(u).trim();
  u = u.replace(/^topics([/\\]+)?/, 'topics/');
  if(!/^topics\//.test(u)) u = 'topics/' + u.replace(/^\/+/,'');
  return u;
}
function encodePath(p){ return p.split('/').map(encodeURIComponent).join('/'); }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escReg(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function decodeEntities(s){
  return (s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&nbsp;/g,' ');
}
function debounce(fn, ms){ let t; return function(){ const a=arguments,c=this; clearTimeout(t); t=setTimeout(()=>fn.apply(c,a),ms); }; }
function tokenizeQuery(q){
  const cjkChunks = (q.match(/[\u3400-\u9fff]+/g) || []);
  const latWords  = q.split(/[^\u3400-\u9fff\w±./-]+/g).filter(Boolean);
  return { cjk: cjkChunks.join(''), cjkChunks, latWords };
}

/* =====================================================================
 * 1. TOC — parse webhelpcontents.htm; fallback: flat list from data.js
 * ===================================================================== */
function isUsableEl(el){
  return el && el instanceof HTMLElement && !/^(script|style|noscript|meta|link)$/i.test(el.tagName);
}

function walkToc(els){
  const out = [];
  let i = 0;
  while(i < els.length){
    const el = els[i];
    if(!isUsableEl(el)){ i++; continue; }
    if(/^d\d+$/.test(el.id || '')){ i++; continue; }
    const a = $$('a[href]', el).find(a => a.getAttribute('href') !== '#') || null;
    let title='', url='';
    if(a && a.getAttribute('href') !== '#'){
      const sp = $('span', a);
      title = ((sp ? sp.textContent : a.textContent) || '').trim();
      url = normUrl(a.getAttribute('href') || '');
    }
    if(!title) title = (el.textContent || '').trim();
    const item = { title, url, children: [] };
    const nxt = i+1 < els.length ? els[i+1] : null;
    if(nxt && /^d\d+$/.test(nxt.id || '')){
      item.children = rowsToc(Array.from(nxt.children).filter(isUsableEl));
      i += 2;
    } else {
      i += 1;
    }
    if(item.title || item.children.length) out.push(item);
  }
  return out;
}
function rowsToc(els){ return walkToc(els); }

function buildTocDom(tree, container){
  container.textContent = '';
  const conv = (nodes, parent) => {
    for(const node of nodes){
      const row = document.createElement('div');
      row.className = 'toc-item';
      const hasKids = node.children && node.children.length > 0;
      if(hasKids){
        const b = document.createElement('button');
        b.className = 'toc-toggle'; b.textContent = '▸'; b.type = 'button';
        b.addEventListener('click', e=>{
          e.stopPropagation();
          const box = row.querySelector(':scope > .toc-children');
          const open = box.classList.toggle('open');
          b.textContent = open ? '▾' : '▸';
        });
        row.appendChild(b);
      } else {
        const pad = document.createElement('span');
        pad.className = 'toc-toggle pad';
        row.appendChild(pad);
      }
      const link = document.createElement('a');
      link.textContent = node.title;
      link.title = node.title;
      link.dataset.url = node.url || '';
      if(hasKids) link.classList.add('toc-folder');
      if(node.url){
        link.href = '#' + encodePath(node.url);
        link.addEventListener('click', e=>{ e.preventDefault(); closeNav(); navigate(node.url); });
      } else {
        link.href = 'javascript:void(0)';
      }
      row.appendChild(link);
      if(hasKids){
        const box = document.createElement('div');
        box.className = 'toc-children';
        conv(node.children, box);
        row.appendChild(box);
      }
      parent.appendChild(row);
    }
  };
  conv(tree, container);
}

function renderToc(tree){
  const wrap = $('#tocTree');
  if(!wrap) return;
  buildTocDom(tree, wrap);
  state.treeReady = true;
}

async function loadToc(){
  try{
    const res = await fetchContent('webhelpcontents.htm');
    const txt = await res.text();
    const doc = new DOMParser().parseFromString(txt, 'text/html');
    if(!doc.body) throw new Error('no body');
    const tree = walkToc(Array.from(doc.body.children).filter(isUsableEl));
    renderToc(tree);
  }catch(e){
    console.warn('TOC 加载失败', e);
    showTocError();
  }
}

function showTocError(){
  const wrap = $('#tocTree');
  if(!wrap) return;
  wrap.textContent = '';
  const box = document.createElement('div');
  box.className = 'toc-error';
  const p = document.createElement('p');
  p.textContent = '目录加载失败';
  const hint = document.createElement('p');
  hint.className = 'small';
  hint.textContent = '可通过上方搜索直接检索内容。';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '重试';
  btn.addEventListener('click', ()=>{
    wrap.textContent = '加载目录…';
    loadToc();
  });
  box.appendChild(p);
  box.appendChild(hint);
  box.appendChild(btn);
  wrap.appendChild(box);
}

function buildFallbackTree(){
  const groups = new Map();
  for(const d of state.docs){
    const seg = (d.crumb && d.crumb.trim()) || d.title;
    if(!groups.has(seg)) groups.set(seg, {title:seg, children:[]});
    groups.get(seg).children.push({title:d.title, url:d.url});
  }
  renderToc(Array.from(groups.values()));
}

function markCurrentToc(url){
  $$('#tocTree a').forEach(a=>{
    const same = a.dataset.url === url;
    a.classList.toggle('active', same);
    if(same && !isMobile()) a.scrollIntoView({block:'center'});
  });
}
function isMobile(){ return window.innerWidth <= 860; }

/* =====================================================================
 * 2. Content viewer
 * ===================================================================== */
async function navigate(url, query){
  if(!url) url = DEFAULT_PAGE;
  url = normUrl(url);
  state.currentUrl = url;
  state.lastQuery = (query || '').trim();

  const h = '#' + encodePath(url);
  if(location.hash !== h){
    if(/^#topics\//.test(location.hash)) history.replaceState(null,'',h);
    else location.hash = h;
  }

  const article = $('#article');
  article.innerHTML = '<div id="contentLoading">加载中…</div>';
  const relFile = url.replace(/^topics\//,'');
  try{
    const res = await fetchContent('topics/' + relFile);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    $$('script', doc).forEach(s=>s.remove());
    const titleNode = $('#winchm_template_title', doc);
    const title = titleNode ? titleNode.textContent.trim()
                           : (($('title', doc)||{}).textContent || '').trim();
    const content = $('#winchm_template_content', doc) || doc.body;

    // relative paths are relative to the topics folder
    $$('img', content).forEach(im => makeAbs(im, 'src'));
    $$('a[href]', content).forEach(a => {
      const href = (a.getAttribute('href')||'').trim();
      if(!href || /^(#|https?:|mailto:|javascript:|data:)/i.test(href)) return;
      if(/\.(htm|html)$/i.test(href)){ a.dataset.internal = '1'; }
      else addAbs(a, 'href');
    });

    const frag = document.createDocumentFragment();
    const h1 = document.createElement('h1');
    h1.id = 'docTitle'; h1.textContent = title;
    frag.appendChild(h1);
    const box = document.createElement('div');
    box.className = 'winchm-content';
    const inner = document.createElement('div');
    inner.appendChild(content);
    box.appendChild(inner);
    frag.appendChild(box);

    article.textContent = '';
    article.appendChild(frag);

    $$('a[data-internal]', article).forEach(a=>{
      a.addEventListener('click', e=>{
        e.preventDefault();
        closeNav();
        navigate(a.getAttribute('href'), state.lastQuery);
      });
    });

    if(state.lastQuery) highlightTerms(article, state.lastQuery);
    markCurrentToc(url);
    scrollView();
  }catch(err){
    article.innerHTML = '<p id="loadError" style="padding:30px;color:#a33">无法加载「'+esc(state.currentUrl)+'」<br>该文件可能不在 content/topics/ 中。</p>';
    console.error(err);
  }
}

function makeAbs(el, attr){
  const v = el.getAttribute(attr);
  if(!v) return;
  if(/^(#|https?:|data:|javascript:|mailto:|tel:|\/)/i.test(v)) return;
  const target = v.replace(/^\.\/+/, '').replace(/^topics\/+/, '');
  el.setAttribute(attr, resolveTopicRel(target));
}
function addAbs(el, attr){
  makeAbs(el, attr);
}
// topic 文档内的相对资源统一基于当前生效的内容源解析（相对 topics/ 目录）
function resolveTopicRel(rel){
  if(contentSource === 'cdn') return cdnUrl('content/topics/' + rel);
  return TOPICS_BASE + rel;
}

function scrollView(){
  window.scrollTo(0,0);
  const c = $('#content'); if(c) c.scrollTop = 0;
}

/* =====================================================================
 * 3. Highlight
 * ===================================================================== */
function highlightTerms(root, query){
  if(!root || !query) return;
  const { cjkChunks, latWords } = tokenizeQuery(query);
  const words = cjkChunks.concat(latWords).filter(w=>w.length>0);
  if(!words.length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      const p = n.parentElement;
      if(!p || /^(script|style|h1|mark)$/i.test(p.tagName)) return NodeFilter.FILTER_REJECT;
      if(p.closest && p.closest('mark')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes=[]; let n;
  while((n=walker.nextNode())) nodes.push(n);
  for(const node of nodes){
    const txt = node.nodeValue;
    if(!txt) continue;
    let best=null, bi=-1;
    for(const w of words){
      const idx = txt.indexOf(w);
      if(idx!==-1 && (best===null || idx<bi)){ best=w; bi=idx; }
    }
    if(!best) continue;
    const be = bi + best.length;
    const frag = document.createDocumentFragment();
    if(bi>0) frag.appendChild(document.createTextNode(txt.slice(0,bi)));
    const mk = document.createElement('mark');
    mk.textContent = txt.slice(bi,be);
    frag.appendChild(mk);
    if(be<txt.length) frag.appendChild(document.createTextNode(txt.slice(be)));
    node.parentNode.replaceChild(frag, node);
  }
}

/* =====================================================================
 * 4. Search index (data.js runtime parse)
 * ===================================================================== */
async function loadIndex(){
  if(state.indexBusy || state.indexReady) return;
  state.indexBusy = true;
  const count = $('#searchResultsCount');
  try{
    const res = await fetchContent('data.js');
    const src = await res.text();
    const arr = parseContentsArray(src);
    const docs = [];
    for(let i=0; i < arr.length; i += 3){
      const text = decodeEntities(arr[i]);
      const title = (arr[i+1] || '').replace(/\s+/g,' ').trim();
      const url = normUrl(arr[i+2] || '');
      let crumb='';
      const m = text.match(/Help\s*[>:]\s*([^\n<]*)/);
      if(m) crumb = m[1].trim();
      docs.push({title, url, text, crumb});
    }
    state.docs = docs.filter(d=>d.url);
    state.indexReady = true;
    count.textContent = state.docs.length + ' 个文档可检索';
  }catch(e){
    console.error('索引加载失败', e);
    count.textContent = '索引加载失败';
  }finally{
    state.indexBusy = false;
  }
}

function parseContentsArray(src){
  const m = src.match(/new\s+Array\s*\(([\s\S]*)\)\s*;?\s*$/);
  if(!m) throw new Error('data.js 解析失败');
  const list = m[1].replace(/\r/g,'');
  return new Function('return [' + list + ']')();
}

function doSearch(query, titleOnly){
  const docs = state.docs;
  if(!docs.length) return [];
  const q = query.trim();
  if(!q) return [];
  const { cjk, cjkChunks, latWords } = tokenizeQuery(q);
  const out = [];
  for(let di=0; di<docs.length; di++){
    const d = docs[di];
    const title = d.title;
    const hay = titleOnly ? title : (title+'\n'+d.crumb+'\n'+d.text);
    let score = 0;
    if(cjk){
      const ph = new RegExp(escReg(cjk),'g');
      const mt = hay.match(ph);
      if(mt) score += mt.length * 200;
      else if(cjk.length >= 2){
        let s=0;
        for(let i=0;i<cjk.length-1;i++){
          const big = cjk.substr(i,2);
          if(hay.indexOf(big)!==-1) s += 25;
        }
        if(s===0) continue;
        score += s;
      } else {
        if(hay.indexOf(cjk)===-1) continue;
        score += 50;
      }
    }
    for(const w of latWords){
      const mt = hay.match(new RegExp(escReg(w),'gi'));
      if(mt) score += mt.length * 40;
    }
    if(score===0) continue;
    if(new RegExp(escReg(q),'i').test(title)) score += 400;
    if(cjk && new RegExp(escReg(cjk),'i').test(d.crumb)) score += 80;
    out.push({di, title, url:d.url, text:d.text, crumb:d.crumb, score});
  }
  out.sort((a,b)=>b.score-a.score);
  return out.slice(0,120);
}

/* =====================================================================
 * 5. Search UI
 * ===================================================================== */
function snipAround(text, start, len, width){
  const s = Math.max(0, start-width);
  const e = Math.min(text.length, start+len+width);
  return (s>0?'…':'') + text.slice(s,e).replace(/[ \t]+/g,' ').trim() + (e<text.length?'…':'');
}
function snippetFrom(text, query, width){
  width = width || 70;
  const q = (query||'').trim();
  if(!text) return '';
  if(q && text.indexOf(q)!==-1) return snipAround(text, text.indexOf(q), q.length, width);
  const { cjkChunks, latWords } = tokenizeQuery(q);
  let best=-1, bl=0;
  for(const w of cjkChunks.concat(latWords)){
    const i = text.indexOf(w);
    if(i!==-1 && (best===-1 || i<best)){ best=i; bl=w.length; }
  }
  if(best===-1) return text.slice(0, width*2).replace(/\s+/g,' ').trim();
  return snipAround(text, best, bl, width);
}
function mark(text, query){
  const { cjkChunks, latWords } = tokenizeQuery(query);
  const words = cjkChunks.concat(latWords).filter(Boolean);
  if(!words.length) return esc(text);
  let s = esc(text);
  for(const w of words){
    s = s.replace(new RegExp(escReg(w),'gi'), m => '<mark>'+m+'</mark>');
  }
  return s;
}

function runSearch(){
  const input = $('#searchInput');
  const panel = $('#searchResults');
  const list  = $('#searchResultsList');
  const count = $('#searchResultsCount');
  const query = input.value;
  if(!query.trim()){
    panel.setAttribute('hidden','');
    return;
  }
  if(!state.indexReady){
    count.textContent = '索引加载中…';
    panel.removeAttribute('hidden');
    loadIndex().then(()=>{
      if(state.indexReady && input.value.trim()) runSearch();
    });
    return;
  }
  const t0 = performance.now();
  const results = doSearch(query, $('#titleOnly').checked);
  const elapsed = Math.round(performance.now()-t0);
  list.textContent = '';
  if(!results.length){
    const li = document.createElement('li');
    li.textContent = '没有找到匹配结果';
    list.appendChild(li);
  } else {
    for(const r of results){
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + encodePath(r.url);
      const title = document.createElement('div');
      title.className = 'searchTitle';
      title.innerHTML = mark(r.title, query);
      const crumb = document.createElement('div');
      crumb.className = 'searchCrumb';
      crumb.textContent = r.crumb;
      const snip = document.createElement('div');
      snip.className = 'searchSnippet';
      snip.innerHTML = mark(esc(snippetFrom(r.text, query)), query);
      a.appendChild(title); a.appendChild(crumb); a.appendChild(snip);
      a.addEventListener('click', e=>{
        e.preventDefault();
        closeNav();
        closeSearch();
        navigate(r.url, query);
      });
      li.appendChild(a);
      list.appendChild(li);
    }
  }
  count.textContent = results.length + ' 条结果（'+elapsed+'ms）';
  panel.removeAttribute('hidden');
}

/* =====================================================================
 * 6. Wiring
 * ===================================================================== */
function closeNav(){ document.body.classList.remove('navOpen'); }
function closeSearch(){ $('#searchResults').setAttribute('hidden',''); }

/* =====================================================================
 * 7. Theme
 * ===================================================================== */
const THEMES = ['parchment','elven','arcane','dungeon','dragon'];
function applyTheme(key){
  if(!THEMES.includes(key)) key = 'parchment';
  document.documentElement.dataset.theme = key;
  try{ localStorage.setItem('adnd-theme', key); }catch(e){}
  $$('#themeMenu [data-key]').forEach(o=>o.classList.toggle('is-active', o.dataset.key === key));
}
function initTheme(){
  let saved = 'parchment';
  try{ saved = localStorage.getItem('adnd-theme') || 'parchment'; }catch(e){}
  applyTheme(saved);
  $('#themeBtn').addEventListener('click', e=>{
    e.stopPropagation();
    const menu = $('#themeMenu');
    menu.hidden = !menu.hidden;
  });
  $$('#themeMenu [data-key]').forEach(o=>{
    o.addEventListener('click', ()=>{
      applyTheme(o.dataset.key);
      $('#themeMenu').hidden = true;
    });
  });
  document.addEventListener('click', e=>{
    if(!e.target.closest('#themeWrap')) $('#themeMenu').hidden = true;
  });
}

window.ADND_APP = window.ADND_APP || {};
window.ADND_APP.fetchContent = fetchContent;
window.ADND_APP.setChargenActive = function(on){
  // 小窗模式：保持底层阅读可见，仅清掉搜索浮层
  if(on) closeSearch();
};

function init(){
  const input = $('#searchInput');
  const titleOnly = $('#titleOnly');

  loadToc();
  initTheme();

  window.addEventListener('hashchange', ()=>{
    const h = decodeURIComponent(location.hash.replace(/^#/,''));
    if(/^topics\//.test(h)) navigate(h);
  });

  if(location.hash && /^#topics/.test(location.hash)){
    navigate(decodeURIComponent(location.hash.slice(1)));
  } else {
    navigate(DEFAULT_PAGE);
  }

  $('#menuBtn').addEventListener('click', ()=>{
    document.body.classList.toggle('navOpen');
  });

  input.addEventListener('input', debounce(runSearch, 120));
  input.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){
      const first = $('#searchResultsList a');
      if(first){ e.preventDefault(); first.click(); }
    }
    if(e.key === 'Escape') closeSearch();
  });
  titleOnly.addEventListener('change', ()=>{ if(input.value.trim()) runSearch(); });
  document.addEventListener('click', e=>{
    if(!e.target.closest('#searchBox') && !e.target.closest('#searchResults')) closeSearch();
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();