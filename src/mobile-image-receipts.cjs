const sharp=require('sharp');
// Content-based fallback is restricted to flat, near-white scanner canvases.
// Unlike photo segmentation it retains the union of all ink, including faint
// lines and colored signatures, with a 4 mm safety margin at the capture DPI.
function whiteScannerCanvas(data,width,height){
 let white=0,total=0;
 const step=Math.max(1,Math.floor(Math.max(width,height)/250));
 for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){
  if(x>width*.04&&x<width*.96&&y>height*.04&&y<height*.96)continue;
  const i=(y*width+x)*3,r=data[i],g=data[i+1],b=data[i+2];total++;
  if((r+g+b)/3>235&&Math.max(r,g,b)-Math.min(r,g,b)<22)white++;
 }
 return white/Math.max(1,total)>.92;
}
async function cropReceiptContent(buffer,{dpi=300}={}){
 const metadata=await sharp(buffer).metadata();
 const small=await sharp(buffer).resize({width:1400,height:1400,fit:'inside',withoutEnlargement:true}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
 const {width,height}=small.info;
 if(!whiteScannerCanvas(small.data,width,height))return buffer;
 let left=width,top=height,right=-1,bottom=-1,ink=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*3,r=small.data[i],g=small.data[i+1],b=small.data[i+2];
  if(Math.min(r,g,b)<232||Math.max(r,g,b)-Math.min(r,g,b)>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);ink++;}
 }
 if(ink<12||right-left<5||bottom-top<5)return buffer;
 const sx=metadata.width/width,sy=metadata.height/height,margin=Math.ceil(dpi/25.4*4)+2;
 const x=Math.max(0,Math.floor(left*sx)-margin),y=Math.max(0,Math.floor(top*sy)-margin);
 const endX=Math.min(metadata.width,Math.ceil((right+1)*sx)+margin),endY=Math.min(metadata.height,Math.ceil((bottom+1)*sy)+margin);
 if((endX-x)*(endY-y)>metadata.width*metadata.height*.95)return buffer;
 return sharp(buffer).extract({left:x,top:y,width:endX-x,height:endY-y}).png().toBuffer();
}
module.exports={whiteScannerCanvas,cropReceiptContent};
