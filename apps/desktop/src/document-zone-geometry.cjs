const normalize=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function wordsFrom(data,width,height){
 const words=[];
 for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){
  const lineId=words.length;
  for(const w of line.words||[]){const b=w.bbox;if(!b||!w.text)continue;words.push({text:w.text,key:normalize(w.text),confidence:w.confidence,line:lineId,x:b.x0/width,y:b.y0/height,width:(b.x1-b.x0)/width,height:(b.y1-b.y0)/height});}
 }
 return words;
}
function referenceFrom(words,aspect){
 const counts=new Map();for(const w of words)counts.set(w.key,(counts.get(w.key)||0)+1);
 const points=words.filter(w=>/^[a-z]{3,80}$/.test(w.key)&&w.confidence>=45&&counts.get(w.key)===1).slice(0,150).map(w=>({key:w.key,x:w.x+w.width/2,y:(w.y+w.height/2)*aspect}));
 if(points.length<3||Math.hypot(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)))<.15)throw Error('A amostra precisa de pelo menos três palavras distintas, bem distribuídas, para alinhar.');
 return {aspect,points};
}
const apply=(t,p)=>({x:t.a*p.x-t.b*p.y+t.tx,y:t.b*p.x+t.a*p.y+t.ty});
function inverse(t,p){const scale=t.a*t.a+t.b*t.b,x=p.x-t.tx,y=p.y-t.ty;return {x:(t.a*x+t.b*y)/scale,y:(-t.b*x+t.a*y)/scale};}
function fit(pairs){
 const n=pairs.length,mean=key=>pairs.reduce((s,p)=>s+p[key].x,0)/n,my=key=>pairs.reduce((s,p)=>s+p[key].y,0)/n;
 const sx=mean('s'),sy=my('s'),dx=mean('d'),dy=my('d');let den=0,a=0,b=0;
 for(const p of pairs){const x=p.s.x-sx,y=p.s.y-sy,u=p.d.x-dx,v=p.d.y-dy;den+=x*x+y*y;a+=x*u+y*v;b+=x*v-y*u;}
 if(den<.0001)return null;a/=den;b/=den;return {a,b,tx:dx-a*sx+b*sy,ty:dy-b*sx-a*sy};
}
function plausible(t){return t&&Math.hypot(t.a,t.b)>.8&&Math.hypot(t.a,t.b)<1.25&&Math.abs(Math.atan2(t.b,t.a))<Math.PI/12&&Math.abs(t.tx)<.25&&Math.abs(t.ty)<.25;}
function alignment(reference,words,aspect){
 const buckets=new Map();for(const w of words){if(w.confidence<45)continue;const list=buckets.get(w.key)||[];list.push(w);buckets.set(w.key,list);}
 const pairs=reference.points.flatMap(s=>{const ws=buckets.get(s.key);if(ws?.length!==1)return [];const w=ws[0];return [{s,d:{x:w.x+w.width/2,y:(w.y+w.height/2)*aspect}}];}).slice(0,80);
 let best=[];
 for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++){
  if(Math.hypot(pairs[i].s.x-pairs[j].s.x,pairs[i].s.y-pairs[j].s.y)<.1)continue;
  const t=fit([pairs[i],pairs[j]]);if(!plausible(t))continue;
  const inliers=pairs.filter(p=>{const q=apply(t,p.s);return Math.hypot(q.x-p.d.x,q.y-p.d.y)<.012;});
  if(inliers.length>best.length)best=inliers;
 }
 if(best.length<3||best.length<Math.ceil(pairs.length*.4))return null;
 const transform=fit(best);if(!plausible(transform))return null;
 return {...transform,matches:best.length,angle:Math.atan2(transform.b,transform.a)*180/Math.PI};
}
function expand(region,margin=0){const x=Math.max(0,region.x-margin),y=Math.max(0,region.y-margin);return {x,y,width:Math.min(1,region.x+region.width+margin)-x,height:Math.min(1,region.y+region.height+margin)-y};}
function findAnchor(words,text){
 const keys=String(text).trim().split(/\s+/).map(normalize).filter(Boolean),found=[];
 for(let i=0;i<words.length;i++){
  const group=words.slice(i,i+keys.length);if(!keys.length||group.length!==keys.length||group.some((w,j)=>w.key!==keys[j]||w.line!==group[0].line||w.confidence<40))continue;
  const x=Math.min(...group.map(w=>w.x)),y=Math.min(...group.map(w=>w.y));found.push({x,y,width:Math.max(...group.map(w=>w.x+w.width))-x,height:Math.max(...group.map(w=>w.y+w.height))-y});
 }
 return found;
}
function anchoredRegion(region,anchor,box){
 const gap=anchor.gap||0;
 if(anchor.direction==='right')return {x:box.x+box.width+gap,y:box.y+box.height/2-region.height/2,width:region.width,height:region.height};
 return {x:box.x,y:box.y+box.height+gap,width:region.width,height:region.height};
}
function bounds(points){const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return {x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};}
function corners(r){return [{x:r.x,y:r.y},{x:r.x+r.width,y:r.y},{x:r.x+r.width,y:r.y+r.height},{x:r.x,y:r.y+r.height}];}
module.exports={normalize,wordsFrom,referenceFrom,alignment,apply,inverse,expand,findAnchor,anchoredRegion,bounds,corners};
