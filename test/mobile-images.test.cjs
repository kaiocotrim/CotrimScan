const {test}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {normalizeMobileImage,MAX_IMAGE_BYTES}=require('../src/mobile-images.cjs');
test('recorte automático separa fundo quando a folha toca a borda e preserva tinta',async()=>{
 const {enhancePhoto}=require('../src/mobile-image-enhance.cjs');
 const input=await sharp(Buffer.from('<svg width="600" height="800"><rect width="600" height="800" fill="#802020"/><path d="M70 35 L550 0 L600 790 L0 770 Z" fill="#ddd"/><rect x="200" y="300" width="180" height="40" fill="black"/><path d="M160 500 L400 520" stroke="blue" stroke-width="6"/></svg>')).png().toBuffer();
 const output=await enhancePhoto(input);assert.notDeepEqual(output,input);
 const {data,info}=await sharp(output).removeAlpha().raw().toBuffer({resolveWithObject:true});
 let red=0,black=0,blue=0;
 for(let i=0;i<data.length;i+=3){if(data[i]>data[i+1]*1.8&&data[i]>data[i+2]*1.8)red++;if(data[i]<30&&data[i+1]<30&&data[i+2]<30)black++;if(data[i+2]>150&&data[i]<80)blue++;}
 assert.ok(red<info.width*info.height*.005);assert.ok(black>2000);assert.ok(blue>200);
});
test('folha junto das quatro bordas remove fundo sem apagar o canto superior direito',async()=>{
 const {enhancePhoto}=require('../src/mobile-image-enhance.cjs');
 const image=await sharp(Buffer.from('<svg width="600" height="800"><rect width="600" height="800" fill="#304060"/><path d="M8 4 L592 0 L599 780 L0 798 Z" fill="#ddd"/><rect x="550" y="28" width="24" height="32" fill="black"/><path d="M0 360 L30 390 L0 420 Z" fill="#ef8b40"/><text x="160" y="300" font-size="35">DOCUMENTO</text></svg>')).png().toBuffer();
 const output=await enhancePhoto(image),raw=await sharp(output).removeAlpha().raw().toBuffer({resolveWithObject:true});
 assert.notDeepEqual(output,image);
 let ink=0;for(let y=0;y<raw.info.height*.12;y++)for(let x=Math.floor(raw.info.width*.85);x<raw.info.width;x++){const i=(y*raw.info.width+x)*3;if(raw.data[i]<40&&raw.data[i+1]<40&&raw.data[i+2]<40)ink++;}
 assert.ok(ink>100,'The black marking at the top right must remain');
});
test('recorte por quatro cantos remove fundo e rejeita marcações cruzadas',async()=>{
 const {enhanceImage}=require('../src/mobile-image-rotate.cjs');
 const photo=await sharp(Buffer.from('<svg width="600" height="800"><rect width="600" height="800" fill="red"/><path d="M120 80 L480 120 L500 720 L100 700 Z" fill="white"/></svg>')).png().toBuffer();
 const corners=[{x:125/599,y:85/799},{x:475/599,y:125/799},{x:495/599,y:715/799},{x:105/599,y:695/799}];
 const result=await enhanceImage(photo,corners),meta=await sharp(result.image).metadata(),stats=await sharp(result.image).stats();
 assert.equal(result.cropped,true);assert.ok(meta.width<410&&meta.height<640);
 assert.ok(stats.channels.every(c=>c.mean>220));
 await assert.rejects(enhanceImage(photo,[corners[0],corners[2],corners[1],corners[3]]));
 await assert.rejects(enhanceImage(photo,[{x:-1,y:0},...corners.slice(1)]));
});
test('jscanify recorta documento em perspectiva e mantém foto sem contorno',async()=>{
 const {enhancePhoto}=require('../src/mobile-image-enhance.cjs');
 const scene=Buffer.from('<svg width="800" height="700"><rect width="800" height="700" fill="#303030"/><path d="M160 70 L650 120 L600 630 L110 570 Z" fill="white"/><path d="M220 240 L510 265 M205 310 L495 335" stroke="#333" stroke-width="8"/></svg>');
 const photo=await sharp(scene).png().toBuffer();
 const cropped=await enhancePhoto(photo),meta=await sharp(cropped).metadata();
 assert.ok(meta.width<650&&meta.height<650,`Expected document crop, got ${meta.width}x${meta.height}`);
 const normalized=await normalizeMobileImage(photo);assert.ok((await sharp(normalized).metadata()).width<650);
 const blank=await sharp({create:{width:400,height:300,channels:3,background:'#888'}}).png().toBuffer();
 assert.deepEqual(await enhancePhoto(blank),blank);
});
test('normaliza orientação e remove metadados da foto',async()=>{
 const original=await sharp({create:{width:80,height:120,channels:3,background:'#e04020'}}).withMetadata({orientation:6}).jpeg().toBuffer();
 const output=await normalizeMobileImage(original),metadata=await sharp(output).metadata();
 assert.equal(metadata.format,'jpeg');assert.equal(metadata.width,120);assert.equal(metadata.height,80);assert.equal(metadata.exif,undefined);assert.equal(metadata.orientation,undefined);
});
test('aplica a cor do projeto e aceita PNG/WebP',async()=>{
 const original=await sharp({create:{width:12,height:12,channels:3,background:'#ff0000'}}).png().toBuffer();
 const gray=await sharp(await normalizeMobileImage(original,'Grayscale8')).removeAlpha().toColourspace('srgb').raw().toBuffer();
 assert.equal(gray[0],gray[1]);assert.equal(gray[1],gray[2]);
 const bw=await sharp(await normalizeMobileImage(original,'BlackAndWhite1')).toColourspace('srgb').raw().toBuffer();assert.ok(bw.every(value=>value===0||value===255));
 const webp=await sharp(original).webp().toBuffer();assert.equal((await sharp(await normalizeMobileImage(webp)).metadata()).format,'jpeg');
 const transparent=await sharp({create:{width:12,height:12,channels:4,background:'#00000000'}}).png().toBuffer();
 const white=await sharp(await normalizeMobileImage(transparent)).raw().toBuffer();assert.ok(white.every(value=>value===255));
});
test('recusa arquivos inválidos, formatos ativos e tamanho excessivo',async()=>{
 for(const data of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),Buffer.from('GIF89a'),Buffer.from('texto'),Buffer.alloc(0),Buffer.from([255,216,255,0])])await assert.rejects(normalizeMobileImage(data));
 await assert.rejects(normalizeMobileImage(Buffer.alloc(MAX_IMAGE_BYTES+1)),/20 MB/);
});
