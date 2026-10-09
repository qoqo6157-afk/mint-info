(function(){
  const timers = new WeakMap();
  function clearFx(layer){
    const old = timers.get(layer); if(old) old.forEach(clearInterval); timers.set(layer,[]); layer.innerHTML='';
  }
  function rand(min,max){return Math.random()*(max-min)+min}
  function make(layer,cls,style){const el=document.createElement('span');el.className=cls;Object.assign(el.style,style);layer.appendChild(el);return el}
  function render(layer,effects){
    clearFx(layer); if(!effects) return;
    const activeTimers=[];
    const snow=effects.snow||{};
    if(snow.enabled){
      for(let i=0;i<(snow.count||30);i++){
        const size=rand((snow.size||10)*.55,(snow.size||10)*1.35); const dur=rand((snow.speed||5)*.75,(snow.speed||5)*1.35);
        const el=make(layer,'fx-snow',{left:rand(0,100)+'%',fontSize:size+'px',opacity:rand(.35,.95),animationDuration:dur+'s',animationDelay:-rand(0,dur)+'s','--drift':rand(-(snow.drift||30),snow.drift||30)+'px'}); el.textContent='❄';
      }
    }
    const petal=effects.petal||{};
    if(petal.enabled){
      for(let i=0;i<(petal.count||24);i++){
        const size=rand((petal.size||13)*.7,(petal.size||13)*1.3); const dur=rand((petal.speed||6)*.75,(petal.speed||6)*1.35);
        make(layer,'fx-petal',{left:rand(0,100)+'%',width:size+'px',height:(size*.65)+'px',animationDuration:dur+'s',animationDelay:-rand(0,dur)+'s','--drift':rand(-(petal.drift||55),petal.drift||55)+'px','--spin':(petal.spin||540)+'deg'});
      }
    }
    const rain=effects.rain||{};
    if(rain.enabled){
      for(let i=0;i<(rain.count||70);i++){
        const dur=rand((rain.speed||1.5)*.7,(rain.speed||1.5)*1.25);
        make(layer,'fx-rain',{left:rand(-5,105)+'%',height:(rain.length||24)+'px',opacity:rand(.25,.65),animationDuration:dur+'s',animationDelay:-rand(0,dur)+'s',transform:`rotate(${rain.angle||10}deg)`});
      }
    }
    const sp=effects.sparkle||{};
    if(sp.enabled){
      const spawn=()=>{
        const current=layer.querySelectorAll('.fx-sparkle').length; if(current >= (sp.count||10)) return;
        const el=make(layer,'fx-sparkle',{left:rand(2,98)+'%',top:rand(2,98)+'%',fontSize:rand((sp.size||16)*.55,(sp.size||16)*1.35)+'px',animationDuration:(sp.duration||2)+'s'}); el.textContent=Math.random()>.45?'✦':'✧'; setTimeout(()=>el.remove(),(sp.duration||2)*1000+200);
      };
      for(let i=0;i<Math.min(sp.count||10,8);i++) setTimeout(spawn,i*90);
      const id=setInterval(spawn,Math.max(100,sp.interval||700)); activeTimers.push(id);
    }
    timers.set(layer,activeTimers);
  }
  window.MintEffects={render,clear:clearFx};
})();
