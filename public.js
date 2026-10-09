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
    {url:'./Paperlogy-3Light.ttf',weight:'300'},
    {url:'./Paperlogy-5Medium.ttf',weight:'500'}
  ],
  'Jalnan2':[{url:'./Jalnan2.otf',weight:'400'}],
  'Puzzle Sans':[{url:'./Puzzle%20Sans.ttf',weight:'400'}],
  'Wonju':[{url:'./%EC%9B%90%EC%A3%BC%EC%B2%B4%20Regular.otf',weight:'400'}],
  'PyeongChang Peace':[{url:'./PyeongChangPeace-Bold.otf',weight:'700'}],
  'BM Jua':[{url:'./BMJUA_ttf.ttf',weight:'400'}]
};
async function preloadPublicFonts(){
  for(const [family,items] of Object.entries(PUBLIC_CUSTOM_FONT_FILES)){
    for(const item of items){
      try{
        const face=new FontFace(family,`url("${item.url}")`,{weight:item.weight,style:'normal'});
        document.fonts.add(await face.load());
      }catch(err){ console.error('Public font failed',family,err); }
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
function applyAnim(node,el){const a=el.animation||{};node.style.setProperty('--anim-speed',`${a.speed||3}s`);node.style.setProperty('--anim-delay',`${a.delay||0}s`);node.style.setProperty('--anim-intensity',`${a.intensity||12}px`);node.style.setProperty('--anim-intensity-num',String((a.intensity||12)/100));node.style.setProperty('--anim-iteration',a.loop===false?'1':'infinite')}
function content(el){const w=document.createElement('div');w.className='canvas-content';if(el.type==='text'){w.classList.add('text-content');w.textContent=el.props.text||'';Object.assign(w.style,{fontFamily:publicFont(el.props.fontFamily),fontSize:`${el.props.fontSize||32}px`,fontWeight:el.props.fontWeight||'800',color:el.props.color||'#111',background:'transparent',textAlign:el.props.align||'left',letterSpacing:`${el.props.letterSpacing||0}px`,lineHeight:String(el.props.lineHeight||1.2),display:'flex',alignItems:'center',padding:'8px',textShadow:el.props.textShadow?'0 3px 10px rgba(0,0,0,.22)':'none',WebkitTextStroke:`${el.props.textStroke||0}px rgba(0,0,0,.75)`})}else if(el.type==='image'||el.type==='sticker'){const img=document.createElement('img');img.src=el.props.src||'';img.alt='';img.style.objectFit=el.props.fit||'cover';w.appendChild(img)}else if(el.type==='button'){const a=document.createElement('a');a.className='button-content';a.textContent=el.props.text||'LINK';a.href=el.props.url||'#';a.target='_blank';a.rel='noopener noreferrer';a.style.background=el.props.bg||'#56cfb8';a.style.color=el.props.color||'#fff';w.appendChild(a)}else if(el.type==='shape'){const d=document.createElement('div');d.className='shape-content';d.style.background=el.props.fill||'#fff';d.style.border=`${el.props.borderWidth||0}px solid ${el.props.border||'#000'}`;w.appendChild(d)}w.style.borderRadius=`${el.borderRadius||0}px`;if(el.boxShadow)w.style.boxShadow='0 12px 30px rgba(25,70,62,.18)';return w}
function applyBackground(c){const b=c.background||{};canvas.style.backgroundColor=b.color1||'#fff';canvas.style.backgroundImage='none';canvas.style.backgroundPosition='center';if(b.type==='gradient')canvas.style.backgroundImage=`linear-gradient(${b.angle||0}deg, ${b.color1}, ${b.color2})`;if(b.type==='image'&&b.image){canvas.style.backgroundImage=`url("${b.image}")`;if(b.fit==='repeat'){canvas.style.backgroundRepeat='repeat';canvas.style.backgroundSize='auto'}else{canvas.style.backgroundRepeat='no-repeat';canvas.style.backgroundSize=b.fit||'cover'}}}
function render(){if(!site)return;const c=site.content;mode=innerWidth<=600?'mobile':'desktop';const size=c.canvas?.[mode]||{width:390,height:780};canvas.style.width=size.width+'px';canvas.style.height=size.height+'px';scaler.style.width=size.width+'px';scaler.style.height=size.height+'px';applyBackground(c);layer.innerHTML='';[...(c.elements||[])].sort((a,b)=>(a.z||0)-(b.z||0)).forEach(el=>{if(el.hidden)return;const l=el.layout?.[mode]||el.layout?.desktop;if(!l)return;const n=document.createElement('div');n.className=`public-element ${animClass(el)}`;Object.assign(n.style,{left:`${l.x}px`,top:`${l.y}px`,width:`${l.w}px`,height:`${l.h}px`,zIndex:String(el.z||1),opacity:String(el.opacity??1),transform:`rotate(${el.rotation||0}deg)`});applyAnim(n,el);n.appendChild(content(el));layer.appendChild(n)});MintEffects.render(fxLayer,c.effects||{});fit(size)}
function fit(size){const scale=Math.min(1,innerWidth/size.width);scaler.style.transform=`scale(${scale})`;wrap.style.height=(size.height*scale)+'px';}
async function load(){const name=requestedName();if(!name){loading.textContent='프로필 주소가 없습니다.';return}const {data,error}=await db.rpc('get_public_site',{p_username:name});if(error){loading.textContent=`페이지를 불러오지 못했습니다: ${error.message}`;return}const row=Array.isArray(data)?data[0]:data;if(!row){loading.textContent='공개된 페이지를 찾을 수 없습니다.';return}site=row;document.title=`${row.nickname} · mint info`;loading.hidden=true;wrap.hidden=false;render()}
window.addEventListener('resize',()=>site&&render());load();
