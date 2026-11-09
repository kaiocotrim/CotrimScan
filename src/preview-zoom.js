(function(root){
 'use strict';
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function attach(document){
  const win=document.defaultView,$=id=>document.getElementById(id);
  const viewport=$('document-viewport'),stage=$('zoom-stage'),image=$('document-preview');
  const minus=$('zoom-out'),plus=$('zoom-in'),select=$('zoom-level'),fitButton=$('zoom-fit'),loupeButton=$('zoom-loupe'),lens=$('document-loupe');
  let scale=1,fit=true,loaded=false,locked=false,loupe=false,source='',pan=null;
  const gutter=24,minScale=.1,maxScale=4,lensSize=190,magnification=3;
  function hideLens(){lens.hidden=true;}
  function hasImage(){return loaded&&image.naturalWidth>0&&image.naturalHeight>0;}
  function fitScale(){return Math.max(.001,Math.min((viewport.clientWidth-gutter*2)/image.naturalWidth,(viewport.clientHeight-gutter*2)/image.naturalHeight,1));}
  function scrollTo(left,top){viewport.scrollLeft=clamp(left,0,Math.max(0,parseFloat(stage.style.width)-viewport.clientWidth));viewport.scrollTop=clamp(top,0,Math.max(0,parseFloat(stage.style.height)-viewport.clientHeight));}
  function anchor(point){
   const r=image.getBoundingClientRect(),v=viewport.getBoundingClientRect();
   const x=point?.x??v.left+viewport.clientWidth/2,y=point?.y??v.top+viewport.clientHeight/2;
   return {u:clamp((x-r.left)/Math.max(1,r.width),0,1),v:clamp((y-r.top)/Math.max(1,r.height),0,1),x:x-v.left,y:y-v.top};
  }
  function syncControls(disabled){
   if(typeof disabled==='boolean')locked=disabled;
   const unavailable=locked||!hasImage();
   select.disabled=fitButton.disabled=loupeButton.disabled=unavailable;
   minus.disabled=unavailable||scale<=minScale;plus.disabled=unavailable||scale>=maxScale;
   loupeButton.setAttribute('aria-pressed',String(loupe));
   viewport.classList.toggle('has-loupe',loupe);
   if(unavailable)hideLens();
  }
  function layout(focus){
   if(!hasImage()||!viewport.clientWidth||!viewport.clientHeight)return;
   if(fit)scale=fitScale();
   const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
   const stageWidth=Math.max(viewport.clientWidth,width+gutter*2),stageHeight=Math.max(viewport.clientHeight,height+gutter*2);
   stage.style.width=stageWidth+'px';stage.style.height=stageHeight+'px';
   image.style.width=width+'px';image.style.height=height+'px';
   if(fit)scrollTo(0,0);
   else if(focus)scrollTo((stageWidth-width)/2+focus.u*width-focus.x,(stageHeight-height)/2+focus.v*height-focus.y);
   const percent=Math.round(scale*100);
   select.querySelector('[value="fit"]').textContent=`Ajustar (${Math.round(fitScale()*100)}%)`;
   const value=String(scale),option=[...select.options].find(option=>option.value===value);
   let custom=select.querySelector('[value="custom"]');
   if(!fit&&!option){if(!custom){custom=document.createElement('option');custom.value='custom';select.append(custom);}custom.textContent=percent+'%';}
   select.value=fit?'fit':option?value:'custom';
   $('zoom-status').textContent=fit?`Documento ajustado à tela, ${percent}%.`:`Zoom de ${percent}%.`;
   viewport.classList.toggle('can-pan',stageWidth>viewport.clientWidth+1||stageHeight>viewport.clientHeight+1);
   hideLens();syncControls();
  }
  function zoom(value,point){if(!hasImage()||locked||!Number.isFinite(value))return;const focus=anchor(point);fit=false;scale=clamp(value,minScale,maxScale);layout(focus);}
  function fitToScreen(){if(!hasImage()||locked)return;fit=true;layout();}
  function setImage(url,alt){
   image.alt=alt;
   if(source===url)return;
   source=url;loaded=false;fit=true;pan=null;hideLens();stage.hidden=false;
   viewport.classList.remove('is-panning');image.src=url;image.draggable=false;lens.style.backgroundImage=`url("${url}")`;scrollTo(0,0);syncControls();
  }
  function clear(){source='';loaded=false;fit=true;pan=null;loupe=false;stage.hidden=true;image.style.width='';image.style.height='';lens.style.backgroundImage='none';hideLens();viewport.classList.remove('is-panning','can-pan');syncControls();}
  image.addEventListener('load',()=>{if(!source)return;loaded=true;layout();});
  image.addEventListener('error',()=>{loaded=false;hideLens();syncControls();});
  minus.onclick=()=>zoom(scale/1.25);plus.onclick=()=>zoom(scale*1.25);fitButton.onclick=fitToScreen;
  select.onchange=()=>{if(select.value==='fit')fitToScreen();else if(select.value!=='custom')zoom(Number(select.value));};
  loupeButton.onclick=()=>{if(locked||!hasImage())return;loupe=!loupe;hideLens();syncControls();};
  function moveLens(event){
   if(!loupe||locked||!hasImage()||pan){hideLens();return;}
   const r=image.getBoundingClientRect(),v=viewport.getBoundingClientRect(),x=event.clientX,y=event.clientY;
   if(x<r.left||x>r.right||y<r.top||y>r.bottom||x<v.left||x>v.left+viewport.clientWidth||y<v.top||y>v.top+viewport.clientHeight){hideLens();return;}
   lens.style.backgroundSize=`${r.width*magnification}px ${r.height*magnification}px`;
   lens.style.backgroundPosition=`${(lensSize-4)/2-(x-r.left)*magnification}px ${(lensSize-4)/2-(y-r.top)*magnification}px`;
   lens.style.left=clamp(x+lensSize+24>win.innerWidth?x-lensSize-20:x+20,8,Math.max(8,win.innerWidth-lensSize-8))+'px';
   lens.style.top=clamp(y+20,8,Math.max(8,win.innerHeight-lensSize-8))+'px';lens.hidden=false;
  }
  viewport.addEventListener('pointermove',event=>{
   if(pan){scrollTo(pan.left-(event.clientX-pan.x),pan.top-(event.clientY-pan.y));hideLens();}
   else moveLens(event);
  });
  viewport.addEventListener('pointerleave',hideLens);
  viewport.addEventListener('scroll',hideLens,{passive:true});
  viewport.addEventListener('pointerdown',event=>{
   if(event.button!==0||locked||!hasImage())return;
   viewport.focus({preventScroll:true});
   if(loupe){moveLens(event);return;}
   if(!viewport.classList.contains('can-pan'))return;
   event.preventDefault();pan={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
   viewport.setPointerCapture?.(event.pointerId);viewport.classList.add('is-panning');
  });
  function stopPan(event){if(pan&&viewport.hasPointerCapture?.(event.pointerId))viewport.releasePointerCapture(event.pointerId);pan=null;viewport.classList.remove('is-panning');if(event.pointerType==='touch')hideLens();}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,stopPan);
  viewport.addEventListener('wheel',event=>{if(!(event.ctrlKey||event.metaKey)||!hasImage()||locked)return;event.preventDefault();zoom(scale*Math.exp(-event.deltaY*.002),{x:event.clientX,y:event.clientY});},{passive:false});
  viewport.addEventListener('dblclick',event=>{if(event.target!==image||locked)return;event.preventDefault();if(fit)zoom(1,{x:event.clientX,y:event.clientY});else fitToScreen();});
  viewport.addEventListener('keydown',event=>{
   if(!hasImage()||locked)return;
   if(['+','=','-','0'].includes(event.key)){event.preventDefault();if(event.key==='0')fitToScreen();else zoom(event.key==='-'?scale/1.25:scale*1.25);}
  });
  if(win.ResizeObserver)new win.ResizeObserver(()=>layout(fit?undefined:anchor())).observe(viewport);
  else win.addEventListener('resize',()=>layout(fit?undefined:anchor()));
  syncControls();
  return {setImage,clear,syncControls,fitToScreen,zoom,refresh:()=>layout(fit?undefined:anchor())};
 }
 if(typeof module==='object'&&module.exports)module.exports={attach};
 else root.previewZoom=attach(root.document);
})(typeof window==='object'?window:globalThis);
