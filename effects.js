(function(){
  const state = new WeakMap();

  function cleanup(layer){
    const prev = state.get(layer);
    if(prev){
      (prev.intervals || []).forEach(clearInterval);
      (prev.timeouts || []).forEach(clearTimeout);
    }
    layer.replaceChildren();
    state.set(layer,{intervals:[],timeouts:[]});
  }

  function rand(min,max){ return Math.random()*(max-min)+min; }

  function make(layer, cls, styles = {}){
    const el = document.createElement('span');
    el.className = cls;
    Object.assign(el.style, styles);
    layer.appendChild(el);
    return el;
  }

  function animateFall(el, keyframes, duration){
    const delay = -rand(0,duration);
    el.animate(keyframes,{
      duration,
      delay,
      iterations:Infinity,
      easing:'linear'
    });
  }

  function render(layer,effects){
    cleanup(layer);
    if(!effects) return;

    const st = state.get(layer);
    const width = Math.max(layer.clientWidth || layer.parentElement?.clientWidth || 0, 390);
    const height = Math.max(layer.clientHeight || layer.parentElement?.clientHeight || 0, 760);
    const fall = height + 150;

    const snow = effects.snow || {};
    if(snow.enabled){
      const count = Math.max(1, Number(snow.count) || 35);
      const speed = Math.max(.5, Number(snow.speed) || 6);
      const baseSize = Math.max(4, Number(snow.size) || 11);
      const drift = Math.max(0, Number(snow.drift) || 0);

      for(let i=0;i<count;i++){
        const size = rand(baseSize*.65, baseSize*1.35);
        const dx = rand(-drift, drift);
        const duration = rand(14000/speed, 22000/speed);
        const el = make(layer,'fx-snow',{
          left:rand(0,100)+'%',
          top:'-40px',
          fontSize:size+'px',
          opacity:String(rand(.55,1))
        });
        el.textContent = Math.random()>.5 ? '❄' : '❅';

        animateFall(el,[
          { transform:'translate3d(0,0,0) rotate(0deg)' },
          { transform:`translate3d(${dx*.45}px,${fall*.5}px,0) rotate(150deg)` },
          { transform:`translate3d(${dx}px,${fall}px,0) rotate(320deg)` }
        ],duration);
      }
    }

    const petal = effects.petal || {};
    if(petal.enabled){
      const count = Math.max(1, Number(petal.count) || 24);
      const speed = Math.max(.5, Number(petal.speed) || 7);
      const baseSize = Math.max(5, Number(petal.size) || 14);
      const drift = Math.max(0, Number(petal.drift) || 0);
      const spin = Number(petal.spin) || 540;

      for(let i=0;i<count;i++){
        const size = rand(baseSize*.7, baseSize*1.35);
        const dx = rand(-drift, drift);
        const duration = rand(17000/speed, 26000/speed);
        const el = make(layer,'fx-petal',{
          left:rand(0,100)+'%',
          top:'-36px',
          width:size+'px',
          height:(size*.68)+'px',
          opacity:String(rand(.65,1))
        });

        animateFall(el,[
          { transform:'translate3d(0,0,0) rotate(0deg)' },
          { transform:`translate3d(${dx*.55}px,${fall*.5}px,0) rotate(${spin*.45}deg)` },
          { transform:`translate3d(${dx}px,${fall}px,0) rotate(${spin}deg)` }
        ],duration);
      }
    }

    const rain = effects.rain || {};
    if(rain.enabled){
      const count = Math.max(1,Number(rain.count)||70);
      const speed = Math.max(.2,Number(rain.speed)||1.5);
      const angle = Number(rain.angle)||0;
      const length = Math.max(8,Number(rain.length)||26);
      const dx = Math.tan(angle*Math.PI/180)*fall;

      for(let i=0;i<count;i++){
        const duration = rand(900/speed,1500/speed);
        const el = make(layer,'fx-rain',{
          left:rand(-8,108)+'%',
          top:'-70px',
          height:length+'px',
          opacity:String(rand(.3,.75)),
          transform:`rotate(${angle}deg)`
        });

        animateFall(el,[
          { translate:'0 0' },
          { translate:`${dx}px ${fall}px` }
        ],duration);
      }
    }

    const sp = effects.sparkle || {};
    if(sp.enabled){
      const spawn = ()=>{
        const max = Math.max(1,Number(sp.count)||8);
        if(layer.querySelectorAll('.fx-sparkle').length >= max) return;

        const durationSec = Math.max(.25,Number(sp.duration)||2.2);
        const duration = durationSec*1000;
        const baseSize = Math.max(4,Number(sp.size)||18);

        const el = make(layer,'fx-sparkle',{
          left:rand(2,98)+'%',
          top:rand(2,98)+'%',
          fontSize:rand(baseSize*.55,baseSize*1.35)+'px'
        });
        el.textContent = Math.random()>.45 ? '✦' : '✧';

        el.animate([
          { opacity:0, transform:'scale(.25) rotate(0deg)' },
          { opacity:1, transform:'scale(1.15) rotate(18deg)', offset:.35 },
          { opacity:.85, transform:'scale(.9) rotate(-8deg)', offset:.72 },
          { opacity:0, transform:'scale(.4) rotate(35deg)' }
        ],{duration,easing:'ease-in-out',fill:'forwards'});

        const tid=setTimeout(()=>el.remove(),duration+80);
        st.timeouts.push(tid);
      };

      for(let i=0;i<Math.min(Number(sp.count)||8,8);i++){
        const tid=setTimeout(spawn,i*80);
        st.timeouts.push(tid);
      }
      const iid=setInterval(spawn,Math.max(100,Number(sp.interval)||900));
      st.intervals.push(iid);
    }
  }

  window.MintEffects={render,clear:cleanup};
})();
