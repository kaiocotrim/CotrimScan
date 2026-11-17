// Read-only QA of supplied photographs. No account or project data is modified.
// node scripts/review-scan-quality.cjs OUTPUT_DIRECTORY PHOTO [PHOTO...]
const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('sharp');
const {enhancePhoto}=require('../src/mobile-image-enhance.cjs');
const {improvePaper}=require('../src/mobile-image-quality.cjs');
const {imagePage}=require('../src/pdf.cjs');
async function metrics(buffer){
 const gray=await sharp(buffer).greyscale().raw().toBuffer(),histogram=new Uint32Array(256);for(const v of gray)histogram[v]++;
 const quantile=p=>{let count=0;for(let i=0;i<256;i++){count+=histogram[i];if(count>=gray.length*p)return i;}return 255;};
 return {median:quantile(.5),paperP90:quantile(.9),paperSpread:quantile(.9)-quantile(.6)};
}
(async()=>{
 const [output,...photos]=process.argv.slice(2);if(!output||!photos.length)throw Error('Specify an output directory and at least one real photograph.');
 await fs.mkdir(output,{recursive:true});const report=[];
 for(let i=0;i<photos.length;i++){
  const original=await sharp(await fs.readFile(photos[i])).rotate().flatten({background:'#fff'}).png().toBuffer(),framed=await enhancePhoto(original);
  const images=[{name:'Original',image:original}],record={sample:i+1,original:await metrics(original),modes:{}};
  for(const mode of ['auto','color','gray','bw']){
   const result=await improvePaper(framed,mode),image=await sharp(result.image).jpeg({quality:97,chromaSubsampling:'4:4:4'}).toBuffer();
   await fs.writeFile(path.join(output,`sample-${i+1}-${mode}.jpg`),image);
   await fs.writeFile(path.join(output,`sample-${i+1}-${mode}.pdf`),await imagePage(image,{dpi:300,name:`CotrimScan QA ${i+1} ${mode}`}));
   images.push({name:{auto:'Automatico profissional',color:'Documento colorido',gray:'Escala de cinza',bw:'Preto e branco'}[mode],image});record.modes[mode]=await metrics(image);
  }
  const tiles=[];
  for(let j=0;j<images.length;j++){
   const tile=await sharp(images[j].image).resize({width:400,height:580,fit:'contain',background:'#eee'}).toBuffer();
   const title=Buffer.from(`<svg width="400" height="40"><rect width="400" height="40" fill="#222"/><text x="12" y="26" fill="white" font-family="Arial" font-size="17">${images[j].name}</text></svg>`);
   tiles.push({input:title,left:j*400,top:0},{input:tile,left:j*400,top:40});
  }
  await sharp({create:{width:2000,height:620,channels:3,background:'#eee'}}).composite(tiles).png().toFile(path.join(output,`comparison-${i+1}.png`));
  report.push(record);console.log(JSON.stringify(record));
 }
 await fs.writeFile(path.join(output,'metrics.json'),JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
