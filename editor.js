const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const canvas = $('#pageCanvas');
const elementsLayer = $('#elementsLayer');
const fxLayer = $('#fxLayer');
const stageScaler = $('#stageScaler');
const stageViewport = $('#stageViewport');
const layerList = $('#layerList');
const inspector = $('#inspector');
const noSelection = $('#noSelection');
const saveState = $('#saveState');
const toastEl = $('#toast');

let user = null;
let profile = null;
let mode = 'desktop';
let zoom = 0.70;
let selectedId = null;
let history = [];
let future = [];
let autosaveTimer = null;
let uploadingKind = null;
let pageRowExists = false;

const DEFAULT_CONFIG = {
  version: 1,
  canvas: {
    desktop: { width: 1100, height: 760 },
    mobile: { width: 390, height: 780 }
  },
  background: {
    type: 'color', color1: '#effcf8', color2: '#c9f5ea', angle: 135, image: '', fit: 'cover'
  },
  effects: {
    snow: { enabled: false, count: 35, speed: 6, size: 11, drift: 35 },
    petal: { enabled: false, count: 24, speed: 7, size: 14, drift: 55, spin: 540 },
    rain: { enabled: false, count: 70, speed: 1.5, length: 26, angle: 10 },
    sparkle: { enabled: true, count: 8, interval: 900, duration: 2.2, size: 18 }
  },
  elements: []
};

let config = structuredClone(DEFAULT_CONFIG);

function toast(text, error = false) {
  toastEl.textContent = text;
  toastEl.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.className = 'toast', 1800);
}

function clone(v){ return structuredClone(v); }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : `e${Date.now()}${Math.random().toString(16).slice(2)}`; }
function clamp(n,min,max){ return Math.min(max, Math.max(min,n)); }
function selected(){ return config.elements.find(e => e.id === selectedId) || null; }
function layoutOf(el){ return el.layout[mode]; }

const FONT_STACKS = {
  'system-ui': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  'Paperlogy': '"Paperlogy", sans-serif',
  'Jalnan2': '"Jalnan2", sans-serif',
  'Puzzle Sans': '"Puzzle Sans", sans-serif',
  'Wonju': '"Wonju", sans-serif',
  'PyeongChang Peace': '"PyeongChang Peace", sans-serif',
  'BM Jua': '"BM Jua", sans-serif',
  'Arial': 'Arial, sans-serif',
  'Georgia': 'Georgia, serif',
  'Courier New': '"Courier New", monospace',
  'Times New Roman': '"Times New Roman", serif'
};

const CUSTOM_FONT_FILES = {
  'Paperlogy': [
    {file:'Paperlogy-3Light.ttf', weight:'300'},
    {file:'Paperlogy-5Medium.ttf', weight:'500'}
  ],
  'Jalnan2': [{file:'Jalnan2.otf', weight:'400'}],
  'Puzzle Sans': [{file:'Puzzle Sans.ttf', weight:'400'}],
  'Wonju': [{file:'원주체 Regular.otf', weight:'400'}],
  'PyeongChang Peace': [{file:'PyeongChangPeace-Bold.otf', weight:'700'}],
  'BM Jua': [{file:'BMJUA_ttf.ttf', weight:'400'}]
};


function siteFontUrl(filename){
  const encoded=filename.split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/object/public/site-fonts/${encoded}`;
}

const loadedCustomFonts = new Map();

async function ensureCustomFontLoaded(family){
  if(!CUSTOM_FONT_FILES[family]) return true;
  if(loadedCustomFonts.get(family)===true) return true;

  // If CSS @font-face (GitHub-hosted font) has already loaded, treat it as success.
  try{
    await document.fonts.ready;
    if(document.fonts.check(`24px "${family}"`)){
      loadedCustomFonts.set(family,true);
      return true;
    }
  }catch(_){ }

  // Otherwise try the Supabase site-fonts bucket.
  try{
    for(const item of CUSTOM_FONT_FILES[family]){
      const testUrl=siteFontUrl(item.file);
      const response=await fetch(testUrl,{method:'GET',cache:'no-store'});
      if(!response.ok){
        throw new Error(`${item.file} (${response.status})`);
      }
      const blob=await response.blob();
      const objectUrl=URL.createObjectURL(blob);
      try{
        const face=new FontFace(family,`url("${objectUrl}")`,{weight:item.weight,style:'normal'});
        const loaded=await face.load();
        document.fonts.add(loaded);
      }finally{
        URL.revokeObjectURL(objectUrl);
      }
    }

    await document.fonts.ready;
    const ok=document.fonts.check(`24px "${family}"`);
    loadedCustomFonts.set(family,ok);
    return ok;
  }catch(err){
    console.warn('Supabase font check failed, testing rendered font instead:',family,err);
    try{
      await document.fonts.ready;
      if(document.fonts.check(`24px "${family}"`)){
        loadedCustomFonts.set(family,true);
        return true;
      }
    }catch(_){ }
    loadedCustomFonts.set(family,false);
    const status=$('#fontLoadStatus');
    if(status) status.dataset.error=String(err.message||err);
    return false;
  }
}

async function preloadCustomFonts(){
  await Promise.allSettled(Object.keys(CUSTOM_FONT_FILES).map(ensureCustomFontLoaded));
}

function setFontStatus(text,type=''){
  const el=$('#fontLoadStatus');
  if(!el) return;
  el.textContent=text||'';
  el.className=`font-load-status ${type}`.trim();
}

function normalizeFontFamily(value){
  const v = String(value || 'system-ui').trim();
  const legacy = {
    "'Paperlogy', sans-serif": 'Paperlogy',
    "'Jalnan2', sans-serif": 'Jalnan2',
    "'Puzzle Sans', sans-serif": 'Puzzle Sans',
    "'Wonju', sans-serif": 'Wonju',
    "'PyeongChang Peace', sans-serif": 'PyeongChang Peace',
    "'BM Jua', sans-serif": 'BM Jua',
    "'Arial',sans-serif": 'Arial',
    "'Georgia',serif": 'Georgia',
    "'Courier New',monospace": 'Courier New',
    "'Times New Roman',serif": 'Times New Roman'
  };
  return legacy[v] || v;
}

function cssFontFamily(value){
  const key = normalizeFontFamily(value);
  return FONT_STACKS[key] || key || FONT_STACKS['system-ui'];
}

function warmCustomFonts(){}

function ensureCanvasHeightForElement(el, margin=120){
  const l=layoutOf(el);
  const c=config.canvas[mode];
  const wanted=Math.ceil((l.y+l.h+margin)/50)*50;
  if(wanted>c.height){
    c.height=wanted;
    canvas.style.height=c.height+'px';
    stageScaler.style.height=(c.height*zoom)+'px';
    $('#canvasSizeText').textContent=`${c.width} × ${c.height}`;
  }
}

function autoScrollWorkspace(clientY){
  const rect = stageViewport.getBoundingClientRect();
  const edge = 70;
  if(clientY > rect.bottom - edge){
    stageViewport.scrollTop += 24;
  } else if(clientY < rect.top + edge){
    stageViewport.scrollTop = Math.max(0, stageViewport.scrollTop - 24);
  }
}

function defaultLayout(x=120,y=100,w=260,h=100){
  return {
    desktop:{x,y,w,h},
    mobile:{x:Math.min(x,80),y:Math.min(y,120),w:Math.min(w,300),h}
  };
}

function baseElement(type) {
  const id = uid();
  const z = config.elements.length + 1;
  const common = {
    id, type, name: type === 'text' ? '텍스트' : type === 'button' ? '링크 버튼' : type === 'shape' ? '도형' : type === 'sticker' ? '스티커' : '이미지',
    layout: defaultLayout(), rotation: 0, opacity: 1, borderRadius: 12, boxShadow: false,
    z, hidden: false, locked: false,
    animation: { type:'none', speed:3, intensity:12, delay:0, loop:true },
    props: {}
  };
  if (type === 'text') {
    common.props = { text:'새 텍스트', fontFamily:'system-ui', fontSize:36, fontWeight:'800', color:'#173b35', background:'transparent', align:'left', letterSpacing:0, lineHeight:1.25, textShadow:false, textStroke:0 };
    common.layout = defaultLayout(140,120,320,120);
  } else if (type === 'button') {
    common.props = { text:'MY LINK', url:'https://', bg:'#56cfb8', color:'#ffffff' };
    common.layout = defaultLayout(160,260,220,58);
    common.borderRadius = 18;
  } else if (type === 'shape') {
    common.props = { fill:'#ffffff', border:'#9adfce', borderWidth:2 };
    common.layout = defaultLayout(180,180,260,180);
    common.borderRadius = 24;
  } else if (type === 'widget') {
    common.name = '위젯';
    common.layout = defaultLayout(120,140,380,220);
    common.borderRadius = 18;
    common.props = {
      kind:'tags', title:'WIDGET', bg:'#ffffff', color:'#28423d', accent:'#57cdb7'
    };
  }
  return common;
}

function snapshot(push=true){
  if(push){
    history.push(JSON.stringify(config));
    if(history.length > 60) history.shift();
    future = [];
  }
  markDirty();
}

function markDirty(){
  saveState.textContent = '저장 중…';
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveAll(true), 1500);
}

function undo(){
  if(!history.length) return;
  future.push(JSON.stringify(config));
  config = JSON.parse(history.pop());
  if(selectedId && !selected()) selectedId = null;
  renderAll();
  markDirty();
}
function redo(){
  if(!future.length) return;
  history.push(JSON.stringify(config));
  config = JSON.parse(future.pop());
  if(selectedId && !selected()) selectedId = null;
  renderAll();
  markDirty();
}

function applyBackground(){
  const b = config.background;
  canvas.style.backgroundColor = b.color1 || '#fff';
  canvas.style.backgroundImage = 'none';
  canvas.style.backgroundSize = '';
  canvas.style.backgroundRepeat = '';
  canvas.style.backgroundPosition = 'center';
  if(b.type === 'gradient') canvas.style.backgroundImage = `linear-gradient(${b.angle||0}deg, ${b.color1}, ${b.color2})`;
  if(b.type === 'image' && b.image){
    canvas.style.backgroundImage = `url("${b.image}")`;
    if(b.fit === 'repeat'){ canvas.style.backgroundRepeat='repeat'; canvas.style.backgroundSize='auto'; }
    else { canvas.style.backgroundRepeat='no-repeat'; canvas.style.backgroundSize=b.fit || 'cover'; }
  }
}

function animationClass(el){ return el.animation?.type && el.animation.type !== 'none' ? `anim-${el.animation.type}` : ''; }
function applyAnimationVars(node, el){
  const a = el.animation || {};
  node.style.setProperty('--anim-speed', `${a.speed || 3}s`);
  node.style.setProperty('--anim-delay', `${a.delay || 0}s`);
  node.style.setProperty('--anim-intensity', `${a.intensity || 12}px`);
  node.style.setProperty('--anim-intensity-num', String((a.intensity || 12)/100));
  node.style.setProperty('--anim-iteration', a.loop === false ? '1' : 'infinite');
}


function escapeHtml(v){
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}
function lines(v){
  return String(v||'').split(/\r?\n|,/).map(s=>s.trim()).filter(Boolean);
}
function widgetPreviewMarkup(el){
  const p=el.props||{};
  const title=escapeHtml(p.title||'WIDGET');
  const head=`<div class="widget-head">${title}</div>`;

  if(p.kind==='dday'){
    let d='D-Day';
    if(p.date){
      const today=new Date(); today.setHours(0,0,0,0);
      const target=new Date(p.date+'T00:00:00');
      const diff=Math.ceil((target-today)/86400000);
      d=diff===0?'D-DAY':diff>0?`D-${diff}`:`D+${Math.abs(diff)}`;
    }
    return `${head}<div class="dday-preview"><b>${escapeHtml(p.label||'기념일')}</b><strong>${d}</strong></div>`;
  }
  if(p.kind==='visits') return `${head}<div class="stat-preview"><strong>123</strong><span>VISITORS</span></div>`;
  if(p.kind==='likes') return `${head}<div class="like-preview">♥ ${escapeHtml(p.likeLabel||'좋아요')} <b>24</b></div>`;
  if(p.kind==='guestbook') return `${head}<div class="guestbook-preview"><div>모아 · 너무 예뻐요!</div><div>코드 · 방문하고 갑니다 ♡</div><small>${escapeHtml(p.placeholder||'한마디 남겨주세요')}</small></div>`;
  if(p.kind==='tags'){
    return `${head}<div class="tag-preview">${lines(p.tags||'게임, 그림, 커피').map(t=>`<span>#${escapeHtml(t.replace(/^#/,'') )}</span>`).join('')}</div>`;
  }
  if(p.kind==='preference'){
    const li=lines(p.leftItems||'CODE ONLY\n지인플 ONLY').map(x=>`<li>♥ ${escapeHtml(x)}</li>`).join('');
    const ri=lines(p.rightItems||'겹드림\n타임라인 유입').map(x=>`<li>× ${escapeHtml(x)}</li>`).join('');
    return `<div class="preference-widget"><div><b>${escapeHtml(p.leftTitle||'NOTI')}</b><ul>${li}</ul></div><div><b>${escapeHtml(p.rightTitle||'NG')}</b><ul>${ri}</ul></div></div>`;
  }
  if(p.kind==='messenger'){
    const msgs=(p.messages||[
      {side:'left',name:'친구',text:'안녕!',profile:'',image:''},
      {side:'right',name:'나',text:'반가워 ♡',profile:'',image:''}
    ]);
    return `${head}<div class="messenger-preview">${msgs.map(m=>`
      <div class="msg-row ${m.side==='right'?'right':'left'}">
        ${m.side==='left'?`<div class="msg-avatar">${m.profile?`<img src="${escapeHtml(m.profile)}">`:'●'}</div>`:''}
        <div class="msg-stack"><small>${escapeHtml(m.name||'')}</small><div class="msg-bubble">${escapeHtml(m.text||'')}${m.image?`<img src="${escapeHtml(m.image)}">`:''}</div></div>
        ${m.side==='right'?`<div class="msg-avatar">${m.profile?`<img src="${escapeHtml(m.profile)}">`:'●'}</div>`:''}
      </div>`).join('')}</div>`;
  }
  if(p.kind==='friends'){
    const items=p.items||[];
    return `${head}<div class="friends-preview">${items.length?items.map(it=>`
      <div class="friend-card">${it.image?`<img src="${escapeHtml(it.image)}">`:'<div class="friend-noimg"></div>'}<span>${escapeHtml(it.label||it.username||'FRIEND')}</span></div>`).join(''):'<div class="widget-empty">이웃 링크를 추가해 주세요.</div>'}</div>`;
  }
  return `${head}<div class="widget-empty">위젯</div>`;
}

function buildContent(el){
  const wrap = document.createElement('div');
  wrap.className = 'canvas-content';
  if(el.type === 'text'){
    wrap.classList.add('text-content');
    wrap.textContent = el.props.text || '';
    Object.assign(wrap.style, {
      fontFamily:cssFontFamily(el.props.fontFamily), fontSize:`${el.props.fontSize||32}px`, fontWeight:el.props.fontWeight||'800',
      color:el.props.color||'#111', background:'transparent', textAlign:el.props.align||'left',
      letterSpacing:`${el.props.letterSpacing||0}px`, lineHeight:String(el.props.lineHeight||1.2),
      display:'flex', alignItems:'center', padding:'8px',
      textShadow:el.props.textShadow ? '0 3px 10px rgba(0,0,0,.22)' : 'none',
      WebkitTextStroke:`${el.props.textStroke||0}px rgba(0,0,0,.75)`
    });
  } else if(el.type === 'image' || el.type === 'sticker'){
    const img=document.createElement('img'); img.src=el.props.src||''; img.alt=''; img.draggable=false; img.style.objectFit=el.props.fit||'cover'; wrap.appendChild(img);
  } else if(el.type === 'button'){
    const a=document.createElement('a'); a.className='button-content'; a.textContent=el.props.text||'LINK'; a.href=el.props.url||'#'; a.target='_blank'; a.rel='noopener noreferrer';
    a.style.background=el.props.bg||'#56cfb8'; a.style.color=el.props.color||'#fff'; a.addEventListener('click',e=>e.preventDefault()); wrap.appendChild(a);
  } else if(el.type === 'shape'){
    const d=document.createElement('div'); d.className='shape-content'; d.style.background=el.props.fill||'#fff'; d.style.border=`${el.props.borderWidth||0}px solid ${el.props.border||'#000'}`; wrap.appendChild(d);
  } else if(el.type === 'widget'){
    wrap.classList.add('widget-content',`widget-${el.props.kind||'generic'}`);
    wrap.style.background=el.props.bg||'#fff';
    wrap.style.color=el.props.color||'#28423d';
    wrap.style.setProperty('--widget-accent',el.props.accent||'#57cdb7');
    wrap.innerHTML=widgetPreviewMarkup(el);
  }
  wrap.style.borderRadius=`${el.borderRadius||0}px`;
  return wrap;
}

function renderElements(){
  elementsLayer.innerHTML='';
  const sorted=[...config.elements].sort((a,b)=>(a.z||0)-(b.z||0));
  sorted.forEach(el=>{
    const l=layoutOf(el);
    const node=document.createElement('div');
    node.className=`canvas-element ${selectedId===el.id?'selected ':''}${el.locked?'locked ':''}${el.hidden?'hidden-element ':''}${animationClass(el)}`;
    node.dataset.id=el.id;
    Object.assign(node.style,{left:`${l.x}px`,top:`${l.y}px`,width:`${l.w}px`,height:`${l.h}px`,zIndex:String(el.z||1),opacity:String(el.opacity??1),transform:`rotate(${el.rotation||0}deg)`});
    applyAnimationVars(node,el);
    node.appendChild(buildContent(el));
    const handle=document.createElement('div');handle.className='resize-handle';node.appendChild(handle);
    node.addEventListener('pointerdown', e=>{
      e.stopPropagation();
      selectElementForPointer(el.id,node);
      beginDrag(e,el,node);
    });
    handle.addEventListener('pointerdown', e=>beginResize(e,el,node));
    elementsLayer.appendChild(node);
  });
}

function renderLayers(){
  layerList.innerHTML='';
  [...config.elements].sort((a,b)=>(b.z||0)-(a.z||0)).forEach(el=>{
    const row=document.createElement('div');row.className=`layer-row ${selectedId===el.id?'active':''}`;
    row.innerHTML=`<button title="잠금">${el.locked?'🔒':'◻'}</button><div class="layer-name"></div><button title="표시">${el.hidden?'🙈':'👁'}</button><button title="삭제">×</button>`;
    row.children[1].textContent=el.name;
    row.children[0].onclick=()=>{snapshot();el.locked=!el.locked;renderAll()};
    row.children[1].onclick=()=>selectElement(el.id);
    row.children[2].onclick=()=>{snapshot();el.hidden=!el.hidden;renderAll()};
    row.children[3].onclick=()=>deleteElement(el.id);
    layerList.appendChild(row);
  });
}

function selectElement(id){
  selectedId=id;
  elementsLayer.querySelectorAll('.canvas-element').forEach(n=>{
    n.classList.toggle('selected', n.dataset.id===id);
  });
  renderLayers();
  renderInspector();
}

function selectElementForPointer(id,node){
  selectedId=id;
  elementsLayer.querySelectorAll('.canvas-element.selected').forEach(n=>n.classList.remove('selected'));
  node.classList.add('selected');
  renderLayers();
  renderInspector();
}
function deleteElement(id){snapshot();config.elements=config.elements.filter(e=>e.id!==id);if(selectedId===id)selectedId=null;renderAll()}

function beginDrag(e,el,node){
  if(e.target.classList.contains('resize-handle')) return;
  e.stopPropagation();
  e.preventDefault();

  if(el.locked) return;

  const l=layoutOf(el);
  const startX=e.clientX;
  const startY=e.clientY;
  const ox=l.x;
  const oy=l.y;
  const scale=zoom;

  let lastX=startX;
  let lastY=startY;
  let dx=0;
  let dy=0;
  let raf=0;
  let grew=false;

  snapshot();
  node.classList.add('dragging');

  const paint=()=>{
    raf=0;
    dx=(lastX-startX)/scale;
    dy=(lastY-startY)/scale;

    // GPU-friendly movement: does not reflow the whole canvas.
    node.style.translate=`${dx}px ${dy}px`;

    const candidateY=Math.round(oy+dy);
    const bottom=candidateY+l.h+120;
    const c=config.canvas[mode];

    if(bottom>c.height){
      // Grow in chunks, not on every pointer pixel.
      c.height=Math.ceil((bottom+180)/300)*300;
      canvas.style.height=c.height+'px';
      stageScaler.style.height=(c.height*zoom)+'px';
      $('#canvasSizeText').textContent=`${c.width} × ${c.height}`;
      grew=true;
    }
  };

  const move=ev=>{
    lastX=ev.clientX;
    lastY=ev.clientY;
    autoScrollWorkspace(ev.clientY);
    if(!raf) raf=requestAnimationFrame(paint);
  };

  const up=()=>{
    window.removeEventListener('pointermove',move);
    window.removeEventListener('pointerup',up);

    if(raf){
      cancelAnimationFrame(raf);
      paint();
    }

    l.x=Math.round(ox+dx);
    l.y=Math.round(oy+dy);

    node.style.translate='';
    node.style.left=l.x+'px';
    node.style.top=l.y+'px';
    node.classList.remove('dragging');

    syncPositionFields();
    renderLayers();
    if(grew) renderEffects();
    markDirty();
  };

  window.addEventListener('pointermove',move,{passive:true});
  window.addEventListener('pointerup',up,{once:true});
}

function beginResize(e,el,node){
  e.stopPropagation();
  e.preventDefault();
  if(el.locked)return;

  const l=layoutOf(el);
  const startX=e.clientX,startY=e.clientY,ow=l.w,oh=l.h;
  const scale=zoom;
  let lastX=e.clientX,lastY=e.clientY;
  let raf=0;
  let grew=false;

  snapshot();
  node.classList.add('resizing');

  const paint=()=>{
    raf=0;
    l.w=Math.max(20,Math.round(ow+(lastX-startX)/scale));
    l.h=Math.max(20,Math.round(oh+(lastY-startY)/scale));
    node.style.width=l.w+'px';
    node.style.height=l.h+'px';

    const oldH=config.canvas[mode].height;
    ensureCanvasHeightForElement(el);
    if(config.canvas[mode].height!==oldH) grew=true;
  };

  const move=ev=>{
    lastX=ev.clientX;
    lastY=ev.clientY;
    autoScrollWorkspace(ev.clientY);
    if(!raf) raf=requestAnimationFrame(paint);
  };

  const up=()=>{
    window.removeEventListener('pointermove',move);
    window.removeEventListener('pointerup',up);
    if(raf){ cancelAnimationFrame(raf); paint(); }
    node.classList.remove('resizing');
    syncPositionFields();
    if(grew) renderEffects();
    markDirty();
  };

  window.addEventListener('pointermove',move,{passive:true});
  window.addEventListener('pointerup',up,{once:true});
}

function renderCanvasSize(){
  stageViewport.style.width='';
  stageViewport.style.height='';
  const c=config.canvas[mode];

  canvas.style.width=c.width+'px';
  canvas.style.height=c.height+'px';
  canvas.style.transform=`scale(${zoom})`;

  // The wrapper uses the *visual* scaled size, so margin:auto can truly center it.
  stageScaler.style.width=(c.width*zoom)+'px';
  stageScaler.style.height=(c.height*zoom)+'px';
  stageScaler.style.transform='none';

  $('#modeLabel').textContent=mode==='desktop'?'PC 캔버스':'MOBILE 캔버스';
  $('#canvasSizeText').textContent=`${c.width} × ${c.height}`;
}
function renderEffects(){MintEffects.render(fxLayer,config.effects)}
function renderAll(){renderCanvasSize();applyBackground();renderElements();renderLayers();renderInspector();syncPageControls();renderEffects()}

function renderInspectorCore(){
  const el=selected(); const has=!!el; noSelection.hidden=has; inspector.hidden=!has; if(!has)return;
  $('#elName').value=el.name||'';const l=layoutOf(el);$('#elX').value=l.x;$('#elY').value=l.y;$('#elW').value=l.w;$('#elH').value=l.h;
  $('#rotation').value=el.rotation||0;$('#rotationV').textContent=`${el.rotation||0}°`;$('#opacity').value=el.opacity??1;$('#opacityV').textContent=`${Math.round((el.opacity??1)*100)}%`;$('#borderRadius').value=el.borderRadius||0;$('#radiusV').textContent=`${el.borderRadius||0}px`;
  $('#lockBtn').textContent=el.locked?'잠금 해제':'잠금';$('#hideBtn').textContent=el.hidden?'표시':'숨김';
  $('#textControls').hidden=el.type!=='text';$('#buttonControls').hidden=el.type!=='button';$('#shapeControls').hidden=el.type!=='shape';$('#imageControls').hidden=!(el.type==='image'||el.type==='sticker');$('#widgetControls').hidden=el.type!=='widget';
  if(el.type==='text'){
    $('#textValue').value=el.props.text||'';
    const currentFont=normalizeFontFamily(el.props.fontFamily);
    $('#fontFamily').value=currentFont;
    if(CUSTOM_FONT_FILES[currentFont]){
      const status=loadedCustomFonts.get(currentFont);
      setFontStatus(status===true?'폰트 적용됨':status===false?'폰트 파일 로드 실패':'폰트 확인 중…',status===true?'ok':status===false?'error':'');
    }else setFontStatus('');
    $('#fontSize').value=el.props.fontSize||32;$('#fontWeight').value=el.props.fontWeight||'800';$('#textColor').value=el.props.color||'#173b35';$('#textAlign').value=el.props.align||'left';$('#letterSpacing').value=el.props.letterSpacing||0;$('#lineHeight').value=el.props.lineHeight||1.2;$('#textShadow').checked=!!el.props.textShadow;$('#textStroke').value=el.props.textStroke||0;}
  if(el.type==='button'){$('#buttonText').value=el.props.text||'';$('#buttonUrl').value=el.props.url||'';$('#buttonBg').value=el.props.bg||'#56cfb8';$('#buttonColor').value=el.props.color||'#ffffff';}
  if(el.type==='shape'){$('#shapeFill').value=el.props.fill||'#ffffff';$('#shapeBorder').value=el.props.border||'#9adfce';$('#shapeBorderWidth').value=el.props.borderWidth||0;}
  if(el.type==='image'||el.type==='sticker') $('#imageFit').value=el.props.fit||'cover';
  if(el.type==='widget'){
    const p=el.props||{};
    $('#widgetTitle').value=p.title||'';
    $('#widgetBg').value=normalizeColor(p.bg,'#ffffff');
    $('#widgetColor').value=normalizeColor(p.color,'#28423d');
    $('#widgetAccent').value=normalizeColor(p.accent,'#57cdb7');

    $$('.widget-fields').forEach(n=>n.hidden=true);
    if(p.kind==='dday'){
      $('#widgetDdayFields').hidden=false;$('#widgetDate').value=p.date||'';$('#widgetLabel').value=p.label||'';
    }
    if(p.kind==='tags'){
      $('#widgetTagsFields').hidden=false;$('#widgetTags').value=p.tags||'';
    }
    if(p.kind==='preference'){
      $('#widgetPreferenceFields').hidden=false;
      $('#prefLeftTitle').value=p.leftTitle||'NOTI';$('#prefRightTitle').value=p.rightTitle||'NG';
      $('#prefLeftItems').value=p.leftItems||'';$('#prefRightItems').value=p.rightItems||'';
    }
    if(p.kind==='messenger'){
      $('#widgetMessengerFields').hidden=false;renderMessageEditor(el);
    }
    if(p.kind==='friends'){
      $('#widgetFriendsFields').hidden=false;renderFriendEditor(el);
    }
    if(p.kind==='guestbook'){
      $('#widgetGuestbookFields').hidden=false;$('#guestbookPlaceholder').value=p.placeholder||'';
    }
    if(p.kind==='likes'){
      $('#widgetLikeFields').hidden=false;$('#likeLabel').value=p.likeLabel||'좋아요';
    }
  }
  const a=el.animation||{};$('#animType').value=a.type||'none';$('#animSpeed').value=a.speed||3;$('#animSpeedV').textContent=`${a.speed||3}s`;$('#animIntensity').value=a.intensity||12;$('#animIntensityV').textContent=a.intensity||12;$('#animDelay').value=a.delay||0;$('#animDelayV').textContent=`${a.delay||0}s`;$('#animLoop').checked=a.loop!==false;
}
function normalizeColor(v,fallback){return /^#[0-9a-f]{6}$/i.test(v||'')?v:fallback}

function renderInspector(){
  try{
    renderInspectorCore();
  }catch(err){
    console.error('Inspector render error:',err);
    const el=selected();
    noSelection.hidden=!!el;
    inspector.hidden=!el;
    if(el){
      toast(`설정창 오류: ${err.message}`,true);
    }
  }
}

function syncPositionFields(){const el=selected();if(!el)return;const l=layoutOf(el);$('#elX').value=l.x;$('#elY').value=l.y;$('#elW').value=l.w;$('#elH').value=l.h;}


function rerenderSelectedWidget(){
  renderElements();renderLayers();markDirty();
}

function renderMessageEditor(el){
  const list=$('#messageEditorList'); if(!list)return;
  const msgs=el.props.messages||(el.props.messages=[]);
  list.innerHTML='';
  msgs.forEach((m,i)=>{
    const row=document.createElement('div');row.className='nested-editor-card';
    row.innerHTML=`
      <div class="nested-editor-head"><b>메시지 ${i+1}</b><button type="button" data-del>×</button></div>
      <select data-side><option value="left">왼쪽</option><option value="right">오른쪽</option></select>
      <input data-name placeholder="이름">
      <textarea data-text rows="3" placeholder="메시지"></textarea>
      <input data-profile placeholder="프로필 이미지 URL">
      <button class="mini-btn" type="button" data-profile-upload>프로필 이미지 업로드</button>
      <input data-image placeholder="메시지 사진 URL">
      <button class="mini-btn" type="button" data-image-upload>메시지 사진 업로드</button>`;
    row.querySelector('[data-side]').value=m.side||'left';
    row.querySelector('[data-name]').value=m.name||'';
    row.querySelector('[data-text]').value=m.text||'';
    row.querySelector('[data-profile]').value=m.profile||'';
    row.querySelector('[data-image]').value=m.image||'';
    const sync=()=>{m.side=row.querySelector('[data-side]').value;m.name=row.querySelector('[data-name]').value;m.text=row.querySelector('[data-text]').value;m.profile=row.querySelector('[data-profile]').value;m.image=row.querySelector('[data-image]').value;rerenderSelectedWidget()};
    row.querySelectorAll('input,textarea,select').forEach(n=>n.addEventListener('input',sync));
    row.querySelector('[data-del]').onclick=()=>{snapshot();msgs.splice(i,1);renderMessageEditor(el);rerenderSelectedWidget()};
    row.querySelector('[data-profile-upload]').onclick=()=>uploadWidgetImage(url=>{m.profile=url;renderInspector();rerenderSelectedWidget()});
    row.querySelector('[data-image-upload]').onclick=()=>uploadWidgetImage(url=>{m.image=url;renderInspector();rerenderSelectedWidget()});
    list.appendChild(row);
  });
}
function renderFriendEditor(el){
  const list=$('#friendEditorList'); if(!list)return;
  const items=el.props.items||(el.props.items=[]);list.innerHTML='';
  items.forEach((it,i)=>{
    const row=document.createElement('div');row.className='nested-editor-card';
    row.innerHTML=`
      <div class="nested-editor-head"><b>${escapeHtml(it.auto?'Mint Info':'외부 링크')}</b><button type="button" data-del>×</button></div>
      <input data-label placeholder="표시 이름">
      <input data-url placeholder="링크">
      <input data-image placeholder="배너 이미지 URL">
      <button class="mini-btn" type="button" data-upload>배너 이미지 업로드</button>`;
    row.querySelector('[data-label]').value=it.label||'';
    row.querySelector('[data-url]').value=it.url||'';
    row.querySelector('[data-image]').value=it.image||'';
    const sync=()=>{it.label=row.querySelector('[data-label]').value;it.url=row.querySelector('[data-url]').value;it.image=row.querySelector('[data-image]').value;rerenderSelectedWidget()};
    row.querySelectorAll('input').forEach(n=>n.addEventListener('input',sync));
    row.querySelector('[data-del]').onclick=()=>{snapshot();items.splice(i,1);renderFriendEditor(el);rerenderSelectedWidget()};
    row.querySelector('[data-upload]').onclick=()=>uploadWidgetImage(url=>{it.image=url;renderInspector();rerenderSelectedWidget()});
    list.appendChild(row);
  });
}
function uploadWidgetImage(done){
  const input=document.createElement('input');input.type='file';input.accept='image/*,.gif';
  input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{toast('업로드 중…');const url=await uploadAsset(f);snapshot();done(url);toast('업로드 완료')}catch(err){toast(err.message,true)}};
  input.click();
}
function slugFromMintUrl(raw){
  try{
    const u=new URL(raw,location.origin);
    const parts=u.pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts.at(-1)||'').toLowerCase();
  }catch(_){return ''}
}
async function addFriendFromUrl(){
  const el=selected();if(!el||el.type!=='widget'||el.props.kind!=='friends')return;
  const raw=$('#friendUrlInput').value.trim();if(!raw)return;
  snapshot();
  const slug=slugFromMintUrl(raw);
  let item={url:raw,label:'',image:'',auto:false,username:''};
  if(slug){
    const {data}=await db.rpc('get_site_card',{p_username:slug});
    const row=Array.isArray(data)?data[0]:data;
    if(row){
      item={url:raw,label:row.site_title||row.nickname||row.username,image:row.site_banner||'',auto:true,username:row.username};
    }
  }
  if(!item.label){
    try{item.label=new URL(raw).hostname}catch(_){item.label='FRIEND'}
  }
  el.props.items.push(item);$('#friendUrlInput').value='';renderInspector();rerenderSelectedWidget();
}

function bindInspector(){
  const direct=['elName','elX','elY','elW','elH','rotation','opacity','borderRadius'];
  direct.forEach(id=>$('#'+id).addEventListener('input',()=>{
    const el=selected();if(!el)return; if(!$('#'+id).dataset.liveStarted){snapshot();$('#'+id).dataset.liveStarted='1';setTimeout(()=>delete $('#'+id).dataset.liveStarted,350)}
    const l=layoutOf(el);
    if(id==='elName')el.name=$('#elName').value;if(id==='elX')l.x=+$(`#${id}`).value;if(id==='elY')l.y=+$(`#${id}`).value;if(id==='elW')l.w=Math.max(20,+$(`#${id}`).value);if(id==='elH')l.h=Math.max(20,+$(`#${id}`).value);if(id==='rotation')el.rotation=+$(`#${id}`).value;if(id==='opacity')el.opacity=+$(`#${id}`).value;if(id==='borderRadius')el.borderRadius=+$(`#${id}`).value;
    renderElements();renderLayers();markDirty();renderInspector();
  }));
  const map={textValue:['text','text'],fontSize:['text','fontSize'],fontWeight:['text','fontWeight'],textColor:['text','color'],textAlign:['text','align'],letterSpacing:['text','letterSpacing'],lineHeight:['text','lineHeight'],textShadow:['text','textShadow'],textStroke:['text','textStroke'],buttonText:['button','text'],buttonUrl:['button','url'],buttonBg:['button','bg'],buttonColor:['button','color'],shapeFill:['shape','fill'],shapeBorder:['shape','border'],shapeBorderWidth:['shape','borderWidth'],imageFit:['image','fit']};
  Object.entries(map).forEach(([id])=>$('#'+id).addEventListener('input',()=>{const el=selected();if(!el)return;snapshot();let v=$('#'+id).type==='checkbox'?$('#'+id).checked:$('#'+id).value;if(['fontSize','letterSpacing','lineHeight','textStroke','shapeBorderWidth'].includes(id))v=+v;el.props[map[id][1]]=v;renderElements();markDirty()}));

  $('#fontFamily').addEventListener('change',async()=>{
    const el=selected();
    if(!el || el.type!=='text') return;

    snapshot();
    const family=normalizeFontFamily($('#fontFamily').value);
    el.props.fontFamily=family;

    const recommended={
      'Paperlogy':'500',
      'Jalnan2':'400',
      'Puzzle Sans':'400',
      'Wonju':'400',
      'PyeongChang Peace':'700',
      'BM Jua':'400'
    };

    if(recommended[family]){
      setFontStatus('폰트 불러오는 중…');
      const ok=await ensureCustomFontLoaded(family);
      if(!ok){
        const extra=$('#fontLoadStatus')?.dataset.error||'';
        setFontStatus(`폰트를 적용하지 못했어요${extra?` · ${extra}`:''}`,'error');
      }else{
        setFontStatus('폰트 적용됨','ok');
      }
      el.props.fontWeight=recommended[family];
      $('#fontWeight').value=recommended[family];
    }else{
      setFontStatus('');
    }

    renderElements();
    markDirty();
  });
  
  const widgetMap={
    widgetTitle:'title',widgetBg:'bg',widgetColor:'color',widgetAccent:'accent',
    widgetDate:'date',widgetLabel:'label',widgetTags:'tags',
    prefLeftTitle:'leftTitle',prefRightTitle:'rightTitle',
    prefLeftItems:'leftItems',prefRightItems:'rightItems',
    guestbookPlaceholder:'placeholder',likeLabel:'likeLabel'
  };
  Object.entries(widgetMap).forEach(([id,key])=>{
    const node=$('#'+id); if(!node)return;
    node.addEventListener('input',()=>{
      const el=selected();if(!el||el.type!=='widget')return;
      snapshot();el.props[key]=node.value;rerenderSelectedWidget();
    });
  });
  $('#addMessageBtn').onclick=()=>{
    const el=selected();if(!el||el.type!=='widget'||el.props.kind!=='messenger')return;
    snapshot();(el.props.messages||(el.props.messages=[])).push({side:'left',name:'',text:'',profile:'',image:''});renderInspector();rerenderSelectedWidget();
  };
  $('#addFriendBtn').onclick=addFriendFromUrl;
  $('#friendUrlInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addFriendFromUrl()}});
  
    ['animType','animSpeed','animIntensity','animDelay','animLoop'].forEach(id=>$('#'+id).addEventListener('input',()=>{const el=selected();if(!el)return;snapshot();const a=el.animation||(el.animation={});if(id==='animType')a.type=$('#animType').value;if(id==='animSpeed')a.speed=+$('#animSpeed').value;if(id==='animIntensity')a.intensity=+$('#animIntensity').value;if(id==='animDelay')a.delay=+$('#animDelay').value;if(id==='animLoop')a.loop=$('#animLoop').checked;renderElements();renderInspector();markDirty()}));
  $('#duplicateBtn').onclick=()=>{const el=selected();if(!el)return;snapshot();const n=clone(el);n.id=uid();n.name=el.name+' 복사';n.layout.desktop.x+=20;n.layout.desktop.y+=20;n.layout.mobile.x+=12;n.layout.mobile.y+=12;n.z=Math.max(0,...config.elements.map(x=>x.z||0))+1;config.elements.push(n);selectedId=n.id;renderAll()};
  $('#deleteBtn').onclick=()=>selectedId&&deleteElement(selectedId);
  $('#lockBtn').onclick=()=>{const el=selected();if(!el)return;snapshot();el.locked=!el.locked;renderAll()};
  $('#hideBtn').onclick=()=>{const el=selected();if(!el)return;snapshot();el.hidden=!el.hidden;renderAll()};
  $('#bringFrontBtn').onclick=()=>{const el=selected();if(!el)return;snapshot();el.z=Math.max(0,...config.elements.map(x=>x.z||0))+1;renderAll()};
  $('#sendBackBtn').onclick=()=>{const el=selected();if(!el)return;snapshot();el.z=Math.min(...config.elements.map(x=>x.z||0),1)-1;renderAll()};
}

function syncPageControls(){
  const b=config.background;$('#bgType').value=b.type;$('#bgColor1').value=b.color1;$('#bgColor2').value=b.color2;$('#bgAngle').value=b.angle;$('#bgAngleValue').textContent=`${b.angle}°`;$('#bgFit').value=b.fit||'cover';
  const e=config.effects;
  const defs={snow:['enabled','count','speed','size','drift'],petal:['enabled','count','speed','size','drift','spin'],rain:['enabled','count','speed','length','angle'],sparkle:['enabled','count','interval','duration','size']};
  Object.entries(defs).forEach(([k,keys])=>keys.forEach(prop=>{const id=k+prop[0].toUpperCase()+prop.slice(1);const input=$('#'+id);if(!input)return;if(input.type==='checkbox')input.checked=!!e[k][prop];else input.value=e[k][prop];const v=$('#'+id+'V');if(v)v.textContent=e[k][prop];}));
}

function openEffectPanels(){}

function bindPageControls(){
  ['bgType','bgColor1','bgColor2','bgAngle','bgFit'].forEach(id=>$('#'+id).addEventListener('input',()=>{snapshot();const b=config.background;if(id==='bgType')b.type=$('#bgType').value;if(id==='bgColor1')b.color1=$('#bgColor1').value;if(id==='bgColor2')b.color2=$('#bgColor2').value;if(id==='bgAngle')b.angle=+$('#bgAngle').value;if(id==='bgFit')b.fit=$('#bgFit').value;applyBackground();syncPageControls();markDirty()}));
  const defs={snow:['Enabled','Count','Speed','Size','Drift'],petal:['Enabled','Count','Speed','Size','Drift','Spin'],rain:['Enabled','Count','Speed','Length','Angle'],sparkle:['Enabled','Count','Interval','Duration','Size']};
  Object.entries(defs).forEach(([k,props])=>props.forEach(cap=>{const id=k+cap;$('#'+id).addEventListener('input',()=>{snapshot();const prop=cap[0].toLowerCase()+cap.slice(1);const inp=$('#'+id);config.effects[k][prop]=inp.type==='checkbox'?inp.checked:+inp.value;syncPageControls();renderEffects();markDirty()})}));
  $('#bgImageBtn').onclick=()=>$('#bgImageInput').click();

  $('#bgImageRemoveBtn').onclick=()=>{
    snapshot();
    config.background.image='';
    if(config.background.type==='image') config.background.type='color';
    renderAll();
    markDirty();
    toast('배경 이미지를 제거했어요');
  };
    $('#bgImageInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const url=await uploadAsset(f);snapshot();config.background.image=url;config.background.type='image';renderAll();toast('배경 이미지 업로드 완료')}catch(err){toast(err.message,true)}e.target.value=''};
}

async function uploadAsset(file){
  if(!user)throw new Error('로그인이 필요합니다.');
  const safe=(file.name||'asset').replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${user.id}/${Date.now()}-${safe}`;
  const {error}=await db.storage.from('user-assets').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});if(error)throw error;
  const {data}=db.storage.from('user-assets').getPublicUrl(path);return data.publicUrl;
}

async function addElement(type){
  if(type==='image'||type==='sticker'){uploadingKind=type;$('#assetInput').click();return;}
  snapshot();
  let el;
  if(type.startsWith('widget-')){
    el=baseElement('widget');
    const kind=type.replace('widget-','');
    el.props.kind=kind;
    const defs={
      dday:{name:'D-Day',title:'D-DAY',date:'',label:'기념일'},
      visits:{name:'방문자 수',title:'VISITORS'},
      likes:{name:'좋아요',title:'LIKE',likeLabel:'좋아요'},
      guestbook:{name:'방명록',title:'GUESTBOOK',placeholder:'한마디 남겨주세요'},
      tags:{name:'취향 태그',title:'TAGS',tags:'게임, 그림, 커피'},
      preference:{name:'성향표',title:'',leftTitle:'NOTI',rightTitle:'NG',leftItems:'CODE ONLY\n지인플 ONLY',rightItems:'겹드림\n타임라인 유입'},
      messenger:{name:'메신저',title:'MESSENGER',messages:[{side:'left',name:'친구',text:'안녕!',profile:'',image:''},{side:'right',name:'나',text:'반가워 ♡',profile:'',image:''}]},
      friends:{name:'이웃/배너',title:'FRIENDS',items:[]}
    };
    Object.assign(el.props,defs[kind]||{});
    el.name=(defs[kind]?.name)||'위젯';
    if(kind==='messenger')el.layout=defaultLayout(100,120,520,520);
    if(kind==='friends')el.layout=defaultLayout(100,120,520,420);
    if(kind==='preference')el.layout=defaultLayout(100,120,500,220);
    if(kind==='guestbook')el.layout=defaultLayout(100,120,460,350);
  }else{
    el=baseElement(type);
  }
  config.elements.push(el);selectedId=el.id;renderAll();
}

async function saveAll(silent=false){
  if(!user)return;
  clearTimeout(autosaveTimer);saveState.textContent='저장 중…';
  const profilePayload={
    nickname:$('#profileNickname').value.trim(),
    bio:$('#profileBio').value.trim(),
    site_title:$('#siteTitle').value.trim(),
    site_description:$('#siteDescription').value.trim(),
    site_banner:$('#siteBannerPreview').dataset.url||'',
    updated_at:new Date().toISOString()
  };
  const [{error:pe},{error:ce}] = await Promise.all([
    db.from('profiles').update(profilePayload).eq('id',user.id),
    db.from('page_configs').upsert({user_id:user.id,content:config,is_public:true,updated_at:new Date().toISOString()},{onConflict:'user_id'})
  ]);
  if(pe||ce){saveState.textContent='저장 실패';if(!silent)toast((pe||ce).message,true);return;}
  pageRowExists=true;saveState.textContent='저장됨';if(!silent)toast('저장했어요');
}

async function loadData(){
  const {data:{user:u}}=await db.auth.getUser();if(!u){location.href='login.html';return;}user=u;
  const {data:p,error:pe}=await db.from('profiles').select('nickname,username,bio,site_title,site_description,site_banner').eq('id',user.id).maybeSingle();if(pe||!p){toast('프로필을 불러오지 못했어요',true);return;}profile=p;
  $('#profileNickname').value=p.nickname||'';$('#profileBio').value=p.bio||'';$('#profileUsername').value=p.username||'';
  $('#siteTitle').value=p.site_title||p.nickname||'';
  $('#siteDescription').value=p.site_description||'';
  setSiteBanner(p.site_banner||'');
  const base=location.href.replace(/dashboard\.html.*$/,'');const pub=`${base}${encodeURIComponent(p.username)}`;$('#publicUrl').textContent=pub;$('#previewLink').href=pub;
  const {data:pc,error}=await db.from('page_configs').select('content').eq('user_id',user.id).maybeSingle();
  if(!error&&pc?.content){config=mergeConfig(pc.content);pageRowExists=true}else{config=clone(DEFAULT_CONFIG);seedDefaultElements();}
  renderAll();
}
function mergeConfig(c){
  const n=clone(DEFAULT_CONFIG);
  Object.assign(n,c);
  n.canvas={...n.canvas,...(c.canvas||{})};
  n.background={...n.background,...(c.background||{})};
  n.effects={
    snow:{...n.effects.snow,...(c.effects?.snow||{})},
    petal:{...n.effects.petal,...(c.effects?.petal||{})},
    rain:{...n.effects.rain,...(c.effects?.rain||{})},
    sparkle:{...n.effects.sparkle,...(c.effects?.sparkle||{})}
  };
  n.elements=Array.isArray(c.elements)?c.elements:[];
  n.elements.forEach(el=>{
    if(el.type==='text'){
      el.props=el.props||{};
      el.props.fontFamily=normalizeFontFamily(el.props.fontFamily);
      el.props.background='transparent';
      el.boxShadow=false;
    }
  });
  return n;
}
function seedDefaultElements(){const t=baseElement('text');t.name='닉네임';t.props.text=profile.nickname||'MY PAGE';t.props.fontSize=54;t.layout.desktop={x:110,y:110,w:520,h:100};t.layout.mobile={x:30,y:80,w:330,h:90};const b=baseElement('text');b.name='소개';b.props.text=profile.bio||'나만의 페이지를 꾸며보세요.';b.props.fontSize=20;b.props.fontWeight='500';b.layout.desktop={x:115,y:225,w:500,h:140};b.layout.mobile={x:30,y:190,w:330,h:150};config.elements=[t,b];}


function setSiteBanner(url){
  const box=$('#siteBannerPreview');
  box.dataset.url=url||'';
  box.innerHTML=url?`<img src="${escapeHtml(url)}" alt="">`:'배너 없음';
}
$('#siteBannerBtn').onclick=()=>$('#siteBannerInput').click();
$('#siteBannerRemoveBtn').onclick=()=>{snapshot();setSiteBanner('');markDirty()};
$('#siteBannerInput').onchange=async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{const url=await uploadAsset(f);snapshot();setSiteBanner(url);markDirty();toast('사이트 배너 업로드 완료')}catch(err){toast(err.message,true)}
  e.target.value='';
};
['siteTitle','siteDescription'].forEach(id=>$('#'+id).addEventListener('input',markDirty));


// mode / zoom / global events
$('#desktopModeBtn').onclick=()=>switchMode('desktop');$('#mobileModeBtn').onclick=()=>switchMode('mobile');
function switchMode(m){mode=m;$('#desktopModeBtn').classList.toggle('active',m==='desktop');$('#mobileModeBtn').classList.toggle('active',m==='mobile');zoom=m==='mobile'?.85:.70;$('#zoomRange').value=Math.round(zoom*100);$('#zoomText').textContent=Math.round(zoom*100)+'%';renderAll()}
$('#zoomRange').oninput=e=>{zoom=+e.target.value/100;$('#zoomText').textContent=e.target.value+'%';renderCanvasSize()};
$('#pageCanvas').addEventListener('pointerdown',e=>{
  if(e.target!==canvas && e.target!==elementsLayer && !e.target.classList.contains('fx-layer')) return;
  selectedId=null;
  elementsLayer.querySelectorAll('.canvas-element.selected').forEach(n=>n.classList.remove('selected'));
  renderLayers();
  renderInspector();
});
$$('[data-add]').forEach(b=>b.onclick=()=>addElement(b.dataset.add));
$('#assetInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const url=await uploadAsset(f);snapshot();const el=baseElement(uploadingKind||'image');el.props={src:url,fit:uploadingKind==='sticker'?'contain':'cover'};if(uploadingKind==='sticker'){el.layout=defaultLayout(180,150,180,180);el.borderRadius=0;}config.elements.push(el);selectedId=el.id;renderAll();toast('업로드 완료')}catch(err){toast(err.message,true)}e.target.value=''};
$('#saveBtn').onclick=()=>saveAll(false);$('#undoBtn').onclick=undo;$('#redoBtn').onclick=redo;
$('#logoutBtn').onclick=async()=>{await db.auth.signOut();location.href='index.html'};
$('#profileNickname').addEventListener('input',markDirty);$('#profileBio').addEventListener('input',markDirty);
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}if(e.key==='Delete'&&selectedId&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName))deleteElement(selectedId)});

warmCustomFonts();openEffectPanels();bindInspector();bindPageControls();loadData();
