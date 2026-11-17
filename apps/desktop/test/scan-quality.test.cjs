const {test}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {improvePaper,processScan}=require('../src/mobile-image-quality.cjs');
test('módulos pretos e áreas brancas de QR Code continuam separados no automático',async()=>{
 const qr=await require('qrcode').toBuffer('CotrimScan quality regression',{width:240,margin:2});
 const input=await sharp({create:{width:500,height:600,channels:3,background:'#d7caa4'}}).composite([{input:qr,left:100,top:180}]).png().toBuffer();
 const output=(await improvePaper(input,'auto')).image;
 const before=await sharp(await sharp(input).extract({left:100,top:180,width:240,height:240}).toBuffer()).greyscale().raw().toBuffer();
 const after=await sharp(await sharp(output).extract({left:100,top:180,width:240,height:240}).toBuffer()).greyscale().raw().toBuffer();
 let black=0,preserved=0;for(let i=0;i<before.length;i++)if(before[i]<15){black++;if(after[i]<65)preserved++;}
 assert.ok(preserved/black>.995);assert.ok(after[0]>235);
});
async function sample(image,region){return (await sharp(await sharp(image).extract(region).toBuffer()).stats()).channels.map(c=>c.mean);}
test('iluminação desigual e papel amarelado ficam uniformes sem perder caneta azul ou linhas finas',async()=>{
 const image=await sharp(Buffer.from('<svg width="1000" height="1200"><defs><linearGradient id="s"><stop stop-color="#a89b78"/><stop offset="1" stop-color="#eee4c5"/></linearGradient></defs><rect width="1000" height="1200" fill="url(#s)"/><text x="80" y="200" font-family="Arial" font-size="24">Texto pequeno 12345</text><path d="M80 500 L900 500" stroke="#555" stroke-width="1"/><path d="M200 800 Q300 700 400 820 T700 780" fill="none" stroke="#204caa" stroke-width="3"/></svg>')).png().toBuffer();
 const output=(await improvePaper(image,'auto')).image;
 const beforeLeft=await sample(image,{left:40,top:300,width:100,height:100}),beforeRight=await sample(image,{left:850,top:300,width:100,height:100});
 const left=await sample(output,{left:40,top:300,width:100,height:100}),right=await sample(output,{left:850,top:300,width:100,height:100});
 assert.ok(left.every(v=>v>235));assert.ok(Math.abs(left[0]-right[0])<Math.abs(beforeLeft[0]-beforeRight[0])*.4);
 assert.ok(Math.abs(left[0]-left[2])<12);
 const raw=await sharp(output).removeAlpha().raw().toBuffer();let blue=0,dark=0;
 for(let i=0;i<raw.length;i+=3){if(raw[i+2]>raw[i]+30&&raw[i+2]>raw[i+1]+15)blue++;if(raw[i]<100&&raw[i+1]<100&&raw[i+2]<100)dark++;}
 assert.ok(blue>700);assert.ok(dark>500);
 const line=await sample(output,{left:100,top:500,width:700,height:1});assert.ok(line[0]<220,'Thin line must remain visible');
});
test('colorido preserva cor, cinza é neutro e preto e branco usa saída binária',async()=>{
 const image=await sharp(Buffer.from('<svg width="700" height="900"><rect width="700" height="900" fill="#ded1aa"/><rect x="200" y="200" width="200" height="150" fill="#2054ad"/><text x="100" y="600" font-size="35">DOCUMENTO 12345</text></svg>')).png().toBuffer();
 const color=(await improvePaper(image,'color')).image,gray=(await improvePaper(image,'gray')).image,bw=(await improvePaper(image,'bw')).image;
 const ink=await sample(color,{left:230,top:230,width:100,height:100});assert.ok(ink[2]>ink[0]+60);
 const neutral=await sample(gray,{left:230,top:230,width:100,height:100});assert.ok(Math.abs(neutral[0]-neutral.at(-1))<1);
 const binary=await sharp(bw).greyscale().raw().toBuffer();assert.ok(binary.every(v=>v===0||v===255));assert.ok(binary.includes(0)&&binary.includes(255));
 await assert.rejects(improvePaper(image,'invalid'),/Modo/);
});
test('a imagem de alta resolução não é reduzida para 3000 pixels',async()=>{
 const image=await sharp({create:{width:3201,height:200,channels:3,background:'#ddd'}}).png().toBuffer();
 const result=await processScan(image,{detect:false}),meta=await sharp(result.image).metadata();assert.equal(meta.width,3201);assert.equal(meta.height,200);
});
