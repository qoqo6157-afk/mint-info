const $ = s => document.querySelector(s);
const canvas=$('#publicCanvas'), scaler=$('#publicScaler'), wrap=$('#publicWrap'), layer=$('#elementsLayer'), fxLayer=$('#fxLayer'), loading=$('#loading');
let site=null, mode='desktop';

const PUBLIC_FONT_STACKS = {
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

const PUBLIC_CUSTOM_FONT_FILES={
  'Paperlogy':[
    {file:'Paperlogy-3Light.ttf',weight:'300'},
    {file:'Paperlogy-5Medium.ttf',weight:'500'}
  ],
  'Jalnan2':[{file:'Jalnan2.otf',weight:'400'}],
  'Puzzle Sans':[{file:'Puzzle Sans.ttf',weight:'400'}],
  'Wonju':[{file:'원주체 Regular.otf',weight:'400'}],
  'PyeongChang Peace':[{file:'PyeongChangPeace-Bold.otf',weight:'700'}],
  'BM Jua':[{file:'BMJUA_ttf.ttf',weight:'400'}]
};

function publicSiteFontUrl(filename){
  const encoded=filename.split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/object/public/site-fonts/${encoded}`;
}

async function preloadPublicFonts(){
  for(const [family,items] of Object.entries(PUBLIC_CUSTOM_FONT_FILES)){
    for(const item of items){
      try{
        const response=await fetch(publicSiteFontUrl(item.file),{cache:'force-cache'});
        if(!response.ok) continue;
        const blob=await response.blob();
        const objectUrl=URL.createObjectURL(blob);
        try{
          const face=new FontFace(family,`url("${objectUrl}")`,{weight:item.weight,style:'normal'});
          document.fonts.add(await face.load());
        }finally{
          URL.revokeObjectURL(objectUrl);
        }
      }catch(err){
        console.error('Public font failed',family,err);
      }
    }
  }
}
function normalizePublicFont(value){
  const v=String(value||'system-ui').trim();
  const legacy={
    "'Paperlogy', sans-serif":'Paperlogy',
    "'Jalnan2', sans-serif":'Jalnan2',
    "'Puzzle Sans', sans-serif":'Puzzle Sans',
    "'Wonju', sans-serif":'Wonju',
    "'PyeongChang Peace', sans-serif":'PyeongChang Peace',
    "'BM Jua', sans-serif":'BM Jua',
    "'Arial',sans-serif":'Arial',
    "'Georgia',serif":'Georgia',
    "'Courier New',monospace":'Courier New',
    "'Times New Roman',serif":'Times New Roman'
  };
  return legacy[v]||v;
}
function publicFont(value){
  const key=normalizePublicFont(value);
  return PUBLIC_FONT_STACKS[key]||key||PUBLIC_FONT_STACKS['system-ui'];
}


function requestedName(){
  const q=new URLSearchParams(location.search).get('u');if(q)return q.trim().toLowerCase();
  const parts=location.pathname.split('/').filter(Boolean);const last=decodeURIComponent(parts.at(-1)||'').toLowerCase();
  const known=new Set(['index.html','profile.html','404.html','login.html','signup.html','dashboard.html','admin.html','mint-info']);
  return known.has(last)?'':last;
}
function animClass(el){return el.animation?.type&&el.animation.type!=='none'?`anim-${el.animation.type}`:''}
function publicResponsive(el,targetMode=mode){
  const r=el.responsive?.[targetMode]||{};
  const p=el.props||{};
  if(el.type==='text'){
    const desktop=el.responsive?.desktop||{};
    const dSize=Number(desktop.fontSize??p.fontSize??32);
    return {
      fontSize:Number(r.fontSize??(targetMode==='mobile'?Math.max(8,Math.round(dSize*.62)):dSize)),
      letterSpacing:Number(r.letterSpacing??(targetMode==='mobile'?Number(desktop.letterSpacing??p.letterSpacing??0)*.62:Number(desktop.letterSpacing??p.letterSpacing??0))),
      lineHeight:Number(r.lineHeight??desktop.lineHeight??p.lineHeight??1.2),
      textStroke:Number(r.textStroke??(targetMode==='mobile'?Number(desktop.textStroke??p.textStroke??0)*.62:Number(desktop.textStroke??p.textStroke??0)))
    };
  }
  return r;
}
function publicImagePosition(el,targetMode=mode){
  const r=el.responsive?.[targetMode]||el.responsive?.desktop||{};
  return {x:Number(r.imagePosX??el.props?.imagePosX??50),y:Number(r.imagePosY??el.props?.imagePosY??50)};
}
function publicMessengerScale(el,targetMode=mode){
  const r=publicResponsive(el,targetMode);
  const legacyKey=targetMode==='mobile'?'messengerScaleMobile':'messengerScaleDesktop';
  const value=Number(r.messengerScale??el.props?.[legacyKey]??(targetMode==='mobile'?.82:1));
  return Number.isFinite(value)?value:(targetMode==='mobile'?.82:1);
}
function applyAnim(node,el){const a=el.animation||{};node.style.setProperty('--anim-speed',`${a.speed||3}s`);node.style.setProperty('--anim-delay',`${a.delay||0}s`);node.style.setProperty('--anim-intensity',`${a.intensity||12}px`);node.style.setProperty('--anim-intensity-num',String((a.intensity||12)/100));node.style.setProperty('--anim-iteration',a.loop===false?'1':'infinite')}

function escapePublic(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function splitPublic(v){return String(v||'').split(/\r?\n|,/).map(s=>s.trim()).filter(Boolean)}

function publicWidgetBaseSize(el){
  const kind=el?.props?.kind||'generic';
  const sizes={
    messenger:{w:520,h:520},
    friends:{w:520,h:420},
    preference:{w:500,h:220},
    guestbook:{w:460,h:350},
    dday:{w:380,h:220},
    visits:{w:380,h:220},
    likes:{w:380,h:220},
    tags:{w:380,h:220}
  };
  return sizes[kind]||{w:380,h:220};
}
function publicWidgetAutoScale(el,targetMode=mode){
  const b=publicWidgetBaseSize(el);
  const l=el.layout?.[targetMode]||el.layout?.desktop||b;
  const s=Math.sqrt(Math.max(1,Number(l.w||b.w))*Math.max(1,Number(l.h||b.h))/(b.w*b.h));
  return Math.min(3.2,Math.max(.45,s));
}
function widgetShell(el,inner){
  const p=el.props||{};
  const s=publicWidgetAutoScale(el);
  const messengerScale=p.kind==='messenger'?publicMessengerScale(el):1;
  return `<div class="public-widget" style="background:${escapePublic(p.bg||'#fff')};color:${escapePublic(p.color||'#28423d')};--widget-accent:${escapePublic(p.accent||'#57cdb7')};--messenger-scale:${messengerScale}"><div class="widget-auto-scale" style="transform:scale(${s});width:${100/s}%;height:${100/s}%">${inner}</div></div>`;
}
function publicWidgetMarkup(el){
  const p=el.props||{}, title=escapePublic(p.title||'');
  const head=title?`<div class="widget-head">${title}</div>`:'';
  if(p.kind==='dday'){
    let text='D-Day';
    if(p.date){const now=new Date();now.setHours(0,0,0,0);const t=new Date(p.date+'T00:00:00');const d=Math.ceil((t-now)/86400000);text=d===0?'D-DAY':d>0?`D-${d}`:`D+${Math.abs(d)}`}
    return widgetShell(el,`${head}<div class="dday-preview"><b>${escapePublic(p.label||'기념일')}</b><strong>${text}</strong></div>`);
  }
  if(p.kind==='visits') return widgetShell(el,`${head}<div class="stat-preview"><strong data-visits>0</strong><span>VISITORS</span></div>`);
  if(p.kind==='likes') return widgetShell(el,`${head}<button class="public-like-btn" type="button" data-like>♡ ${escapePublic(p.likeLabel||'좋아요')} <b data-likes>0</b></button>`);
  if(p.kind==='tags') return widgetShell(el,`${head}<div class="tag-preview">${splitPublic(p.tags).map(t=>`<span>#${escapePublic(t.replace(/^#/,''))}</span>`).join('')}</div>`);
  if(p.kind==='preference'){
    const l=splitPublic(p.leftItems).map(x=>`<li>♥ ${escapePublic(x)}</li>`).join('');
    const r=splitPublic(p.rightItems).map(x=>`<li>× ${escapePublic(x)}</li>`).join('');
    return widgetShell(el,`<div class="preference-widget"><div><b>${escapePublic(p.leftTitle||'NOTI')}</b><ul>${l}</ul></div><div><b>${escapePublic(p.rightTitle||'NG')}</b><ul>${r}</ul></div></div>`);
  }
  if(p.kind==='messenger'){
    const msgs=p.messages||[];
    const ms=publicMessengerScale(el);
    return widgetShell(el,`${head}<div class="messenger-preview" style="--messenger-scale:${ms}">${msgs.map(m=>`<div class="msg-row ${m.side==='right'?'right':'left'}">${m.side==='left'?`<div class="msg-avatar">${m.profile?`<img src="${escapePublic(m.profile)}">`:'●'}</div>`:''}<div class="msg-stack"><small>${escapePublic(m.name||'')}</small><div class="msg-bubble">${escapePublic(m.text||'')}${m.image?`<img src="${escapePublic(m.image)}">`:''}</div></div>${m.side==='right'?`<div class="msg-avatar">${m.profile?`<img src="${escapePublic(m.profile)}">`:'●'}</div>`:''}</div>`).join('')}</div>`);
  }
  if(p.kind==='friends'){
    return widgetShell(el,`${head}<div class="friends-preview">${(p.items||[]).map(it=>`<a class="friend-card" href="${escapePublic(it.url||'#')}" target="_blank" rel="noopener noreferrer">${it.image?`<img src="${escapePublic(it.image)}">`:'<div class="friend-noimg"></div>'}<span>${escapePublic(it.label||it.username||'FRIEND')}</span></a>`).join('')}</div>`);
  }
  if(p.kind==='guestbook'){
    return widgetShell(el,`${head}<div class="public-guestbook-list" data-guestbook-list></div><form class="public-guestbook-form" data-guestbook-form><input name="author" maxlength="30" placeholder="이름" required><textarea name="message" maxlength="500" rows="2" placeholder="${escapePublic(p.placeholder||'한마디 남겨주세요')}" required></textarea><button type="submit">남기기</button></form>`);
  }
  return widgetShell(el,head);
}

function publicShapeTextStyle(el,targetMode=mode){
  const r=el.responsive?.[targetMode]||{};
  const fallback=targetMode==='mobile'
    ? Math.max(10,Math.round(Number(el.props?.shapeFontSize||24)*.67))
    : Number(el.props?.shapeFontSize||24);
  return {fontSize:Number(r.shapeFontSize??fallback)};
}

function content(el){const w=document.createElement('div');w.className='canvas-content';if(el.type==='text'){const ts=publicResponsive(el);w.classList.add('text-content');w.textContent=el.props.text||'';Object.assign(w.style,{fontFamily:publicFont(el.props.fontFamily),fontSize:`${ts.fontSize}px`,fontWeight:el.props.fontWeight||'800',color:el.props.color||'#111',background:'transparent',textAlign:el.props.align||'left',letterSpacing:`${ts.letterSpacing}px`,lineHeight:String(ts.lineHeight),display:'flex',alignItems:'center',padding:'8px',textShadow:el.props.textShadow?'0 3px 10px rgba(0,0,0,.22)':'none',WebkitTextStroke:`${ts.textStroke}px rgba(0,0,0,.75)`})}else if(el.type==='image'||el.type==='sticker'){const img=document.createElement('img');img.src=el.props.src||'';img.alt='';img.style.objectFit=el.props.fit||'cover';const ip=publicImagePosition(el);img.style.objectPosition=`${ip.x}% ${ip.y}%`;w.appendChild(img)}else if(el.type==='button'){const a=document.createElement('a');a.className='button-content';a.textContent=el.props.text||'LINK';a.href=el.props.url||'#';a.target='_blank';a.rel='noopener noreferrer';a.style.background=el.props.bg||'#56cfb8';a.style.color=el.props.color||'#fff';w.appendChild(a)}else if(el.type==='shape'){const d=document.createElement('div');d.className='shape-content';d.style.background=el.props.fill||'#fff';d.style.border=`${el.props.borderWidth||0}px solid ${el.props.border||'#000'}`;const ss=publicShapeTextStyle(el);d.style.fontSize=`${ss.fontSize}px`;d.style.fontWeight=el.props.fontWeight||'700';d.style.fontFamily=publicFont(el.props.fontFamily||'system-ui');d.style.color=el.props.textColor||'#173b35';d.style.textAlign=el.props.textAlign||'center';d.style.alignItems=el.props.textVAlign||'center';d.style.justifyContent=el.props.textAlign==='left'?'flex-start':el.props.textAlign==='right'?'flex-end':'center';d.textContent=el.props.text||'';w.appendChild(d)}else if(el.type==='widget'){w.classList.add('widget-content');if(el.props?.kind==='messenger')w.style.setProperty('--messenger-scale',String(publicMessengerScale(el)));w.innerHTML=publicWidgetMarkup(el)}w.style.borderRadius=`${el.borderRadius||0}px`;if(el.boxShadow)w.style.boxShadow='0 12px 30px rgba(25,70,62,.18)';return w}
function applyBackground(c){
  const b=c.background||{};
  const targets=[canvas,document.body,document.documentElement,$('#publicWrap')].filter(Boolean);

  targets.forEach(t=>{
    t.style.backgroundColor=b.color1||'#fff';
    t.style.backgroundImage='none';
    t.style.backgroundPosition='center top';
    t.style.backgroundRepeat='no-repeat';
    t.style.backgroundSize='cover';
  });

  if(b.type==='gradient'){
    const bg=`linear-gradient(${b.angle||0}deg, ${b.color1||'#fff'}, ${b.color2||'#fff'})`;
    targets.forEach(t=>{t.style.backgroundImage=bg;});
  }

  if(b.type==='image'&&b.image){
    const bg=`url("${b.image}")`;
    targets.forEach(t=>{
      t.style.backgroundImage=bg;
      if(b.fit==='repeat'){
        t.style.backgroundRepeat='repeat';
        t.style.backgroundSize='auto';
      }else{
        t.style.backgroundRepeat='no-repeat';
        t.style.backgroundSize=b.fit||'cover';
      }
    });
  }

  // Keep the actual page canvas exactly aligned to its own coordinate system.
  canvas.style.backgroundPosition='center';
}


/* Image protection: best-effort deterrence for the public page.
   Blocks common right-click / drag / mobile long-press save routes. */
function enableImageProtection(){
  document.addEventListener('contextmenu', e=>{
    if(e.target.closest?.('#publicCanvas')) e.preventDefault();
  }, {capture:true});

  document.addEventListener('dragstart', e=>{
    if(e.target instanceof HTMLImageElement && e.target.closest?.('#publicCanvas')){
      e.preventDefault();
    }
  }, {capture:true});

  const lockImages=()=>{
    document.querySelectorAll('#publicCanvas img').forEach(img=>{
      img.draggable=false;
      img.setAttribute('draggable','false');
      img.setAttribute('oncontextmenu','return false;');
    });
  };

  lockImages();
  const canvas=document.getElementById('publicCanvas');
  if(canvas){
    new MutationObserver(lockImages).observe(canvas,{childList:true,subtree:true});
  }
}
enableImageProtection();

function visitorKey(){
  let key=localStorage.getItem('mint_info_visitor_key');
  if(!key){key=(crypto.randomUUID?crypto.randomUUID():`v-${Date.now()}-${Math.random()}`);localStorage.setItem('mint_info_visitor_key',key)}
  return key;
}
async function hydrateWidgets(){
  if(!site)return;
  const username=site.username||requestedName();
  const key=visitorKey();

  if(layer.querySelector('[data-visits]')){
    await db.rpc('record_page_visit',{p_username:username,p_visitor_key:key});
  }
  const {data:stats}=await db.rpc('get_widget_stats',{p_username:username,p_visitor_key:key});
  const stat=Array.isArray(stats)?stats[0]:stats;
  layer.querySelectorAll('[data-visits]').forEach(n=>n.textContent=stat?.visits??0);
  layer.querySelectorAll('[data-likes]').forEach(n=>n.textContent=stat?.likes??0);
  layer.querySelectorAll('[data-like]').forEach(btn=>{
    btn.classList.toggle('liked',!!stat?.liked);
    btn.onclick=async()=>{
      btn.disabled=true;
      const {data}=await db.rpc('toggle_page_like',{p_username:username,p_visitor_key:key});
      const row=Array.isArray(data)?data[0]:data;
      layer.querySelectorAll('[data-likes]').forEach(n=>n.textContent=row?.likes??0);
      btn.classList.toggle('liked',!!row?.liked);
      btn.disabled=false;
    };
  });

  const gbLists=[...layer.querySelectorAll('[data-guestbook-list]')];
  async function refreshGuestbook(){
    if(!gbLists.length)return;
    const {data}=await db.rpc('list_guestbook',{p_username:username});
    gbLists.forEach(box=>{
      box.innerHTML=(data||[]).map(x=>`<div class="guestbook-row"><b>${escapePublic(x.author_name)}</b><span>${escapePublic(x.message)}</span></div>`).join('')||'<div class="widget-empty">아직 방명록이 없어요.</div>';
    });
  }
  await refreshGuestbook();

  layer.querySelectorAll('[data-guestbook-form]').forEach(form=>{
    form.onsubmit=async e=>{
      e.preventDefault();
      const fd=new FormData(form);
      const author=String(fd.get('author')||'').trim(), message=String(fd.get('message')||'').trim();
      if(!author||!message)return;
      const {error}=await db.rpc('add_guestbook_entry',{p_username:username,p_author_name:author,p_message:message});
      if(!error){form.reset();await refreshGuestbook();}
    };
  });
}


let publicShimejiFrame=0;
function clearPublicShimeji(){
  cancelAnimationFrame(publicShimejiFrame);
  publicShimejiFrame=0;
  const root=document.getElementById('publicShimejiLayer');
  if(root)root.innerHTML='';
}
function renderPublicShimeji(){
  clearPublicShimeji();
  const root=document.getElementById('publicShimejiLayer');
  const s=site?.content?.effects?.shimeji||{enabled:false,images:[],size:76,speed:1,bounce:.25};
  if(!root||!s.enabled||!Array.isArray(s.images)||!s.images.length)return;

  const size=Math.max(28,Number(s.size||76));
  const walkSpeed=Math.max(.1,Number(s.speed||1));
  const bounce=Math.max(0,Math.min(1,Number.isFinite(Number(s.bounce))?Number(s.bounce):.25));
  const sprites=[];

  s.images.slice(0,12).forEach((url,i)=>{
    const el=document.createElement('img');
    el.className='public-shimeji';
    el.src=url;
    el.draggable=false;
    el.style.width=size+'px';
    el.style.height=size+'px';

    const initialV=(Math.random()>.5?1:-1)*(.035+Math.random()*.045)*walkSpeed;
    const sp={
      el,
      x:Math.random()*Math.max(0,innerWidth-size),
      y:Math.max(0,innerHeight-size),
      vx:initialV,
      vy:0,

      pointerId:null,
      pressX:0,pressY:0,
      ox:0,oy:0,
      lastX:0,lastY:0,lastT:0,
      dragging:false,

      boingActive:false,
      boingElapsed:0,
      boingDuration:420,
      walkVxBeforeBoing:initialV,
      sx:1,sy:1
    };
    root.appendChild(el);

    const startBoing=()=>{
      // Pure visual squash/stretch + tiny vertical hop.
      // No throw velocity is added here.
      sp.boingActive=true;
      sp.boingElapsed=0;
      sp.walkVxBeforeBoing = Math.abs(sp.vx)>.005 ? sp.vx : ((Math.random()>.5?1:-1)*.05*walkSpeed);
      sp.vy=0;
      sp.sx=1;sp.sy=1;
    };

    el.addEventListener('pointerdown',e=>{
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const rect=el.getBoundingClientRect();

      sp.pointerId=e.pointerId;
      sp.pressX=e.clientX;sp.pressY=e.clientY;
      sp.ox=e.clientX-rect.left;sp.oy=e.clientY-rect.top;
      sp.lastX=e.clientX;sp.lastY=e.clientY;sp.lastT=performance.now();
      sp.dragging=false;

      // Cancel an in-progress boing cleanly, but do NOT launch or shake.
      sp.boingActive=false;
      sp.sx=1;sp.sy=1;
    });

    el.addEventListener('pointermove',e=>{
      if(e.pointerId!==sp.pointerId)return;
      const dist=Math.hypot(e.clientX-sp.pressX,e.clientY-sp.pressY);
      const dragThreshold=(e.pointerType==='touch'||e.pointerType==='pen')?22:10;
      if(!sp.dragging && dist<dragThreshold)return;

      if(!sp.dragging){
        sp.dragging=true;
        sp.vx=0;sp.vy=0;
        el.classList.add('held');
      }

      const now=performance.now(),dt=Math.max(8,now-sp.lastT);
      sp.x=e.clientX-sp.ox;
      sp.y=e.clientY-sp.oy;
      sp.vx=(e.clientX-sp.lastX)/dt;
      sp.vy=(e.clientY-sp.lastY)/dt;
      sp.lastX=e.clientX;sp.lastY=e.clientY;sp.lastT=now;
    });

    const release=e=>{
      if(e.pointerId!==sp.pointerId)return;

      if(sp.dragging){
        // Throw only after a real drag.
        const throwPower=(e.pointerType==='touch'||e.pointerType==='pen')?5:10;
        sp.vx*=throwPower;
        sp.vy*=throwPower;
        el.classList.remove('held');
      }else{
        // Tap/click: stay in the same place and do only the soft squash-hop.
        startBoing();
      }

      sp.pointerId=null;
      sp.dragging=false;
    };

    el.addEventListener('pointerup',release);
    el.addEventListener('pointercancel',e=>{
      if(e.pointerId!==sp.pointerId)return;
      el.classList.remove('held');
      sp.pointerId=null;
      sp.dragging=false;
      sp.sx=1;sp.sy=1;
    });

    sprites.push(sp);
  });

  let last=performance.now();
  let lastViewportH=innerHeight;

  const tick=now=>{
    const dt=Math.min(32,now-last);last=now;
    const viewportH=innerHeight;
    const floor=Math.max(0,viewportH-size);
    const maxX=Math.max(0,innerWidth-size);
    const viewportChanged=Math.abs(viewportH-lastViewportH)>2;

    for(const sp of sprites){
      if(viewportChanged && sp.pointerId===null && !sp.dragging && sp.y>=Math.max(0,lastViewportH-size)-4){
        sp.y=floor;
        sp.vy=0;
      }

      if(sp.boingActive && sp.pointerId===null){
        sp.boingElapsed+=dt;
        const t=Math.min(1,sp.boingElapsed/sp.boingDuration);

        // 0-25%: flatten
        // 25-52%: stretch upward
        // 52-100%: settle back to normal
        if(t<.25){
          const q=t/.25;
          sp.sx=1 + .24*q;
          sp.sy=1 - .30*q;
        }else if(t<.52){
          const q=(t-.25)/.27;
          sp.sx=1.24 - .34*q;
          sp.sy=.70 + .48*q;
        }else{
          const q=(t-.52)/.48;
          const ease=1-Math.pow(1-q,2);
          sp.sx=.90 + .10*ease;
          sp.sy=1.18 - .18*ease;
        }

        // Tiny hop in place, max ~12px, beginning after the squash.
        const hopPhase=Math.max(0,(t-.22)/.78);
        const hop=hopPhase>0 ? Math.sin(Math.PI*hopPhase)*12 : 0;
        sp.y=floor-hop;

        // Keep x fixed during the click animation.
        if(t>=1){
          sp.boingActive=false;
          sp.boingElapsed=0;
          sp.sx=1;sp.sy=1;
          sp.y=floor;
          sp.vy=0;
          sp.vx=sp.walkVxBeforeBoing;
        }
      }else if(sp.pointerId===null || !sp.dragging){
        const onFloor=sp.y>=floor-.5;

        if(onFloor && Math.abs(sp.vy)<.04){
          sp.y=floor;sp.vy=0;

          if(Math.abs(sp.vx)<.018){
            sp.vx=(Math.random()>.5?1:-1)*(.035+Math.random()*.045)*walkSpeed;
          }

          const minWalk=.035*walkSpeed,maxWalk=.08*walkSpeed;
          if(Math.abs(sp.vx)<minWalk)sp.vx=(sp.vx<0?-1:1)*minWalk;
          if(Math.abs(sp.vx)>maxWalk && Math.abs(sp.vy)<.04)sp.vx=(sp.vx<0?-1:1)*maxWalk;
        }else{
          sp.vy+=0.0026*dt;
        }

        sp.x+=sp.vx*dt;
        sp.y+=sp.vy*dt;

        if(sp.x<0){sp.x=0;sp.vx=bounce<.08?0:Math.abs(sp.vx)*bounce}
        if(sp.x>maxX){sp.x=maxX;sp.vx=bounce<.08?0:-Math.abs(sp.vx)*bounce}
        if(sp.y>floor){
          sp.y=floor;
          if(Math.abs(sp.vy)>.08 && bounce>=.08)sp.vy=-Math.abs(sp.vy)*bounce;
          else sp.vy=0;
        }
        if(sp.y<0){sp.y=0;sp.vy=Math.abs(sp.vy)*bounce}
      }

      const face=(sp.vx<0?-1:1);
      sp.el.style.setProperty('--shimeji-x',`${sp.x}px`);
      sp.el.style.setProperty('--shimeji-y',`${sp.y}px`);
      sp.el.style.setProperty('--shimeji-face',String(face));
      sp.el.style.setProperty('--shimeji-sx',String(sp.sx));
      sp.el.style.setProperty('--shimeji-sy',String(sp.sy));
    }

    lastViewportH=viewportH;
    publicShimejiFrame=requestAnimationFrame(tick);
  };

  publicShimejiFrame=requestAnimationFrame(tick);
}
function render(){if(!site)return;const c=site.content;mode=innerWidth<=600?'mobile':'desktop';const size=c.canvas?.[mode]||{width:390,height:780};canvas.style.width=size.width+'px';canvas.style.height=size.height+'px';scaler.style.width=size.width+'px';scaler.style.height=size.height+'px';applyBackground(c);layer.innerHTML='';[...(c.elements||[])].sort((a,b)=>(a.z||0)-(b.z||0)).forEach(el=>{if(el.hidden)return;const l=el.layout?.[mode]||el.layout?.desktop;if(!l)return;const n=document.createElement('div');n.className=`public-element ${animClass(el)}`;Object.assign(n.style,{left:`${l.x}px`,top:`${l.y}px`,width:`${l.w}px`,height:`${l.h}px`,zIndex:String(el.z||1),opacity:String(el.opacity??1),transform:`rotate(${el.rotation||0}deg)`});applyAnim(n,el);n.appendChild(content(el));layer.appendChild(n)});MintEffects.render(fxLayer,c.effects||{});fit(size);hydrateWidgets();renderPublicShimeji()}
function fit(size){const scale=Math.min(1,innerWidth/size.width);scaler.style.transform=`scale(${scale})`;wrap.style.height=(size.height*scale)+'px';}
async function load(){const name=requestedName();if(!name){loading.textContent='프로필 주소가 없습니다.';return}const {data,error}=await db.rpc('get_public_site',{p_username:name});if(error){loading.textContent=`페이지를 불러오지 못했습니다: ${error.message}`;return}const row=Array.isArray(data)?data[0]:data;if(!row){loading.textContent='공개된 페이지를 찾을 수 없습니다.';return}site=row;document.title=`${row.nickname} · mint info`;loading.hidden=true;wrap.hidden=false;render()}
window.addEventListener('resize',()=>site&&render());load();
