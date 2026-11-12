// 브라우저 안에서 도는 코드. tsx/esbuild 변환(__name 도우미 등)이 끼지 않도록 문자열로 둔다.
// 역할·이름표 규칙은 template.ts(implicitRole, labelOf)와 같다.

export const STYLE_PROPS = [
  'color',
  'background-color',
  'background-image',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'box-shadow',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'padding',
  'margin',
  'gap',
  'width',
  'height',
  'x',
  'y',
  'opacity',
  'transform',
  'cursor',
] as const;

const COMMON = String.raw`
function __ddCollapse(s){return String(s||'').replace(/\s+/g,' ').trim();}
function __ddRole(el){
  var r=el.getAttribute&&el.getAttribute('role'); if(r) return r;
  var t=el.tagName.toLowerCase();
  if(t==='button'||t==='summary') return 'button';
  if(t==='a') return el.hasAttribute('href')?'link':'';
  if(t==='textarea') return 'textbox';
  if(t==='select') return 'combobox';
  if(t==='input'){var y=(el.getAttribute('type')||'text');return y==='checkbox'?'checkbox':y==='radio'?'radio':(y==='button'||y==='submit')?'button':'textbox';}
  if(/^h[1-6]$/.test(t)) return 'heading';
  return '';
}
function __ddOwn(el){var s='';for(var i=0;i<el.childNodes.length;i++){var c=el.childNodes[i];if(c.nodeType===3)s+=c.nodeValue;}return __ddCollapse(s);}
function __ddLabel(el){
  var o=__ddOwn(el); if(o) return o;
  var walk=function(x){for(var i=0;i<x.children.length;i++){var c=x.children[i];var t=__ddOwn(c);if(t&&!/^\d+$/.test(t))return t;var d=walk(c);if(d)return d;}return '';};
  return walk(el);
}
function __ddVisible(el){
  var r=el.getBoundingClientRect(); if(r.width<=0||r.height<=0) return false;
  var cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none') return false;
  return true;
}
function __ddDesc(el){
  var x=el; while(x&&x.nodeType===1){var l=__ddLabel(x),r=__ddRole(x);if(l||r)return (r||x.tagName.toLowerCase())+'|'+l.slice(0,60);x=x.parentElement;}
  return el&&el.tagName?el.tagName.toLowerCase():'?';
}
`;

/** 단계에 맞는 요소를 찾아 화면 안으로 굴리고 중심 좌표를 돌려준다 */
export const FIND_TARGET = String.raw`(function(step){
${COMMON}
  var list=[];
  if(step.selector){ list=Array.prototype.slice.call(document.querySelectorAll(step.selector)).filter(__ddVisible); }
  else {
    var all=document.querySelectorAll('body *');
    for(var i=0;i<all.length;i++){var el=all[i];
      if(step.role!==undefined && __ddRole(el)!==step.role) continue;
      if(step.role===undefined && !(el.onclick||__ddRole(el))) continue;
      var l=__ddLabel(el);
      if(step.text!==undefined){ if(step.contains? l.indexOf(step.text)<0 : l!==step.text) continue; }
      if(!__ddVisible(el)) continue;
      list.push(el);
    }
  }
  var el=list[step.nth||0];
  if(!el) return {ok:false,count:list.length};
  el.scrollIntoView({block:'center',inline:'center'});
  var r=el.getBoundingClientRect();
  return {ok:true,count:list.length,x:r.left+r.width/2,y:r.top+r.height/2,disabled:!!el.disabled};
})`;

/** 보이는 요소들의 계산된 스타일. 짝짓기 key = 역할|이름표 (#n은 같은 key의 문서 순서) */
export const CAPTURE = String.raw`(function(selectors){
${COMMON}
  var props=${JSON.stringify(STYLE_PROPS)};
  var out=[],seen={};
  var all=document.querySelectorAll('body *');
  for(var i=0;i<all.length;i++){var el=all[i];var tag=el.tagName.toLowerCase();
    if(tag==='script'||tag==='style'||tag==='noscript'||tag==='template') continue;
    var role=__ddRole(el), own=__ddOwn(el);
    if(!role && !own) continue;
    if(!__ddVisible(el)) continue;
    var text=role?__ddLabel(el):own;
    var base=(role||tag)+'|'+text.slice(0,80);
    var n=seen[base]||0; seen[base]=n+1;
    var cs=getComputedStyle(el), r=el.getBoundingClientRect(), st={};
    for(var p=0;p<props.length;p++){var k=props[p];
      if(k==='x') st.x=String(Math.round((r.left+scrollX)*10)/10);
      else if(k==='y') st.y=String(Math.round((r.top+scrollY)*10)/10);
      else if(k==='width') st.width=String(Math.round(r.width*10)/10);
      else if(k==='height') st.height=String(Math.round(r.height*10)/10);
      else st[k]=cs.getPropertyValue(k);
    }
    var m=[]; for(var s=0;s<selectors.length;s++){try{if(el.closest(selectors[s]))m.push(selectors[s]);}catch(e){}}
    out.push({key:base+(n?'#'+(n+1):''),role:role,text:text,tag:tag,styles:st,matches:m});
  }
  return out;
})`;

/** addInitScript로 넣는 훅: 타이머 간격, transition/animation 이벤트, getAnimations 표본 */
export const HOOKS = String.raw`(function(){
  if(window.__dd) return;
${COMMON}
  var dd={on:false,timers:[],events:[],anims:{}};
  var oT=window.setTimeout, oI=window.setInterval;
  window.setTimeout=function(fn,ms){ if(dd.on) dd.timers.push({kind:'timeout',ms:Math.round(Number(ms)||0)}); return oT.apply(window,arguments); };
  window.setInterval=function(fn,ms){ if(dd.on) dd.timers.push({kind:'interval',ms:Math.round(Number(ms)||0)}); return oI.apply(window,arguments); };
  function ev(e){ if(!dd.on) return; dd.events.push({type:e.type,name:e.animationName||e.propertyName||'',target:__ddDesc(e.target)}); }
  ['transitionstart','transitionend','animationstart','animationend'].forEach(function(t){window.addEventListener(t,ev,true);});
  function sample(){
    if(!dd.on||!document.getAnimations) return;
    var as=document.getAnimations();
    for(var i=0;i<as.length;i++){var a=as[i],e=a.effect; if(!e||!e.getTiming) continue; var t=e.getTiming();
      var rec={type:a.constructor&&a.constructor.name||'Animation',name:a.animationName||a.transitionProperty||a.id||'',target:e.target?__ddDesc(e.target):'',
        duration:String(t.duration),delay:String(t.delay),easing:String(t.easing),iterations:String(t.iterations)};
      dd.anims[JSON.stringify(rec)]=rec;
    }
  }
  oI.call(window,sample,40);
  dd.start=function(){dd.on=true;dd.timers=[];dd.events=[];dd.anims={};};
  dd.collect=function(){sample();
    var g={};dd.timers.forEach(function(t){var k=t.kind+':'+t.ms;g[k]=g[k]||{kind:t.kind,ms:t.ms,count:0};g[k].count++;});
    return {animations:Object.keys(dd.anims).map(function(k){return dd.anims[k];}),events:dd.events.slice(0,2000),timers:Object.keys(g).map(function(k){return g[k];})};
  };
  window.__dd=dd;
})();`;
