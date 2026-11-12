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
function __ddCollapse(s){return String(s||'').replace(/[​-‍﻿]/g,'').replace(/\s+/g,' ').trim();}
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
// 시안 런타임(support.js)은 {{…}} 값마다 스타일 없는 <span class="sc-interp">를 만든다. 그 글자는 부모의 자기 글자로 친다.
function __ddInterp(el){return !!(el&&el.nodeType===1&&el.tagName==='SPAN'&&/(^|\s)sc-interp(\s|$)/.test((el.getAttribute&&el.getAttribute('class'))||''));}
function __ddText(el){var s='';for(var i=0;i<el.childNodes.length;i++){var c=el.childNodes[i];if(c.nodeType===3)s+=c.nodeValue;else if(c.nodeType===1)s+=__ddText(c);}return s;}
// 투명 감싸개: 자기 상자 스타일이 없는(배경 투명·테두리 0·안쪽/바깥 여백 0·display inline) span이 부모의 유일한 요소 자식이고
// 부모의 보이는 글자를 전부 가진 경우. 그 글자는 부모의 자기 글자로 치고 감싸개는 따로 잡지 않는다
// (앱 T124a: <span class=pill><span>글자</span></span> ↔ 시안 <span class=pill><span class=sc-interp>글자</span></span>).
// 시안 sc-interp는 이 규칙의 한 경우로, 스타일·글자 조건 없이 언제나 감싸개다 (글자와 섞여도 문서 순서로 합친다).
function __ddZero(v){v=String(v==null?'':v).trim();return v===''||/^0(px)?( 0(px)?)*$/.test(v);}
function __ddBare(el){
  if(!el||el.nodeType!==1||el.tagName!=='SPAN') return false;
  var p=el.parentElement; if(!p||p.children.length!==1) return false;
  var t=__ddCollapse(__ddText(el)); if(!t||t!==__ddCollapse(__ddText(p))) return false;
  var cs=getComputedStyle(el), g=function(k){return cs.getPropertyValue?cs.getPropertyValue(k):'';};
  var bg=String(g('background-color')||'').replace(/\s+/g,'');
  if(bg&&bg!=='transparent'&&bg!=='rgba(0,0,0,0)') return false;
  var bi=String(g('background-image')||''); if(bi&&bi!=='none') return false;
  var sides=['top','right','bottom','left'];
  for(var i=0;i<4;i++){if(!__ddZero(g('border-'+sides[i]+'-width'))) return false;}
  if(!__ddZero(g('padding'))||!__ddZero(g('margin'))) return false;
  var d=String(g('display')||'');
  if(d!=='inline'){
    // 부모가 flex/grid면 자식 span은 flex item으로 blockify되어 계산값이 block이다 — 그 경우만 허용
    var pcs=getComputedStyle(p), pd=String((pcs.getPropertyValue?pcs.getPropertyValue('display'):'')||'');
    if(!(d==='block'&&/^(inline-)?(flex|grid)$/.test(pd))) return false;
  }
  if(__ddSrSelf(el)) return false;
  return true;
}
function __ddWrap(el){return __ddInterp(el)||__ddBare(el);}
function __ddOwn(el){var s='';for(var i=0;i<el.childNodes.length;i++){var c=el.childNodes[i];if(c.nodeType===3)s+=c.nodeValue;else if(__ddWrap(c))s+=__ddText(c);}return __ddCollapse(s);}
// 화면 읽기 전용(sr-only) 글자: clip-path inset(50%↑) · clip 넓이 0 · 1px 이하 + overflow hidden/clip
function __ddSrSelf(el){
  var cs=getComputedStyle(el), cp=String(cs.clipPath||cs.getPropertyValue&&cs.getPropertyValue('clip-path')||'');
  var m=/inset\(\s*(\d+(?:\.\d+)?)%/.exec(cp); if(m&&Number(m[1])>=50) return true;
  var cl=String(cs.clip||''), n=cl.match(/-?\d*\.?\d+/g);
  if(/^rect\(/.test(cl)&&n&&n.length===4&&(Number(n[2])<=Number(n[0])||Number(n[1])<=Number(n[3]))) return true;
  var r=el.getBoundingClientRect(), ov=String(cs.overflow||'')+' '+String(cs.overflowX||'')+' '+String(cs.overflowY||'');
  if(r.width<=1&&r.height<=1&&/hidden|clip/.test(ov)) return true;
  return false;
}
function __ddSrOnly(el,memo){
  var x=el,chain=[],v=false;
  while(x&&x.nodeType===1&&x.tagName!=='BODY'&&x.tagName!=='HTML'){
    if(memo&&memo.has(x)){v=memo.get(x);break;}
    chain.push(x); if(__ddSrSelf(x)){v=true;break;}
    x=x.parentElement;
  }
  if(memo) for(var i=0;i<chain.length;i++) memo.set(chain[i],v);
  return v;
}
function __ddLabel(el){
  var o=__ddOwn(el); if(o) return o;
  var walk=function(x){for(var i=0;i<x.children.length;i++){var c=x.children[i];var t=__ddOwn(c);if(t&&!/^\d+$/.test(t))return t;var d=walk(c);if(d)return d;}return '';};
  return walk(el);
}
function __ddAlt(el){
  var s='';(function w(x){for(var i=0;i<x.childNodes.length;i++){var c=x.childNodes[i];
    if(c.nodeType===3)s+=c.nodeValue; else if(c.nodeType===1&&c.getAttribute('aria-hidden')!=='true')w(c);}})(el);
  return __ddCollapse(s);
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
  var list=[], all=[];
  if(step.selector){ list=Array.prototype.slice.call(document.querySelectorAll(step.selector)).filter(__ddVisible); }
  else {
    all=document.querySelectorAll('body *');
    for(var i=0;i<all.length;i++){var el=all[i];
      if(step.role!==undefined && __ddRole(el)!==step.role) continue;
      if(step.role===undefined && !(el.onclick||__ddRole(el))) continue;
      var l=__ddLabel(el);
      if(step.text!==undefined){
        // 이름표 후보: 자기 글자(시안 기준) · aria-label · aria-hidden 아닌 자손 글자 전부 (앱의 장식 span 대응)
        var cands=[l,__ddCollapse(el.getAttribute('aria-label')),__ddAlt(el)], hit=false;
        for(var k=0;k<cands.length;k++){ if(cands[k]&&(step.contains? cands[k].indexOf(step.text)>=0 : cands[k]===step.text)){hit=true;break;} }
        if(!hit) continue;
      }
      if(!__ddVisible(el)) continue;
      list.push(el);
    }
  }
  var el=list[step.nth||0];
  if(!el){
    // 실패 진단: 같은 역할(없으면 누를 수 있는) 요소의 이름표와 보임 여부
    var near=[];
    for(var j=0;j<all.length&&near.length<8;j++){var e2=all[j];
      if(step.role!==undefined ? __ddRole(e2)!==step.role : !(e2.onclick||__ddRole(e2))) continue;
      near.push(__ddLabel(e2).slice(0,40)+(__ddVisible(e2)?'':' (안 보임)'));
    }
    return {ok:false,count:list.length,near:near};
  }
  el.scrollIntoView({block:'center',inline:'center'});
  var r=el.getBoundingClientRect();
  return {ok:true,count:list.length,x:r.left+r.width/2,y:r.top+r.height/2,disabled:!!el.disabled};
})`;

/** 보이는 요소들의 계산된 스타일. 짝짓기 key = 역할|이름표 (#n은 같은 key의 문서 순서) */
export const CAPTURE = String.raw`(function(selectors){
${COMMON}
  var props=${JSON.stringify(STYLE_PROPS)};
  var out=[],seen={},memo=new Map();
  var all=document.querySelectorAll('body *');
  for(var i=0;i<all.length;i++){var el=all[i];var tag=el.tagName.toLowerCase();
    if(tag==='script'||tag==='style'||tag==='noscript'||tag==='template') continue;
    if(__ddWrap(el)) continue; // 투명 감싸개(sc-interp 포함): 글자는 부모 쪽 __ddOwn에 들어갔다
    var role=__ddRole(el), own=__ddOwn(el);
    if(!role && !own) continue;
    if(!__ddVisible(el)) continue;
    if(__ddSrOnly(el,memo)) continue;
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
