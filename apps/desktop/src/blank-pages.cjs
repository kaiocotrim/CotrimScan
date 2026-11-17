const sharp=require('sharp');
function settings(value={}){return {enabled:value?.enabled===true,sensitivity:Math.max(0,Math.min(100,Number.isFinite(Number(value?.sensitivity))?Number(value.sensitivity):50)),action:value?.action==='auto'?'auto':'confirm'};}
async function inspect(buffer,sensitivity=50){
 const {data,info}=await sharp(buffer).flatten({background:'#fff'}).resize({width:900,height:900,fit:'inside',withoutEnlargement:true}).toColourspace('srgb').removeAlpha().raw().toBuffer({resolveWithObject:true});
 let marked=0,colored=0,total=0;const threshold=200-sensitivity*.6;
 for(let y=Math.floor(info.height*.02);y<info.height*.98;y++)for(let x=Math.floor(info.width*.02);x<info.width*.98;x++){
  const offset=(y*info.width+x)*3,r=data[offset],g=data[offset+1],b=data[offset+2];
  const gray=.2126*r+.7152*g+.0722*b;
  if(gray<threshold)marked++;
  if(Math.max(r,g,b)-Math.min(r,g,b)>=16&&Math.min(r,g,b)<245)colored++;
  total++;
 }
 const coverage=total?marked/total*100:100,coloredCoverage=total?colored/total*100:100;
 return {blank:coverage<(.015+sensitivity*.006)&&coloredCoverage<.08,coverage};
}
module.exports={settings,inspect};
