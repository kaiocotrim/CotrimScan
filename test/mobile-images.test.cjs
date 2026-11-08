const {test}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {normalizeMobileImage,MAX_IMAGE_BYTES}=require('../src/mobile-images.cjs');
test('normaliza orientação e remove metadados da foto',async()=>{
 const original=await sharp({create:{width:80,height:120,channels:3,background:'#e04020'}}).withMetadata({orientation:6}).jpeg().toBuffer();
 const output=await normalizeMobileImage(original),metadata=await sharp(output).metadata();
 assert.equal(metadata.format,'jpeg');assert.equal(metadata.width,120);assert.equal(metadata.height,80);assert.equal(metadata.exif,undefined);assert.equal(metadata.orientation,undefined);
});
test('aplica a cor do projeto e aceita PNG/WebP',async()=>{
 const original=await sharp({create:{width:12,height:12,channels:3,background:'#ff0000'}}).png().toBuffer();
 const gray=await sharp(await normalizeMobileImage(original,'Grayscale8')).removeAlpha().toColourspace('srgb').raw().toBuffer();
 assert.equal(gray[0],gray[1]);assert.equal(gray[1],gray[2]);
 const bw=await sharp(await normalizeMobileImage(original,'BlackAndWhite1')).toColourspace('srgb').raw().toBuffer();assert.ok(bw.every(value=>value===0));
 const webp=await sharp(original).webp().toBuffer();assert.equal((await sharp(await normalizeMobileImage(webp)).metadata()).format,'jpeg');
 const transparent=await sharp({create:{width:12,height:12,channels:4,background:'#00000000'}}).png().toBuffer();
 const white=await sharp(await normalizeMobileImage(transparent)).raw().toBuffer();assert.ok(white.every(value=>value===255));
});
test('recusa arquivos inválidos, formatos ativos e tamanho excessivo',async()=>{
 for(const data of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),Buffer.from('GIF89a'),Buffer.from('texto'),Buffer.alloc(0),Buffer.from([255,216,255,0])])await assert.rejects(normalizeMobileImage(data));
 await assert.rejects(normalizeMobileImage(Buffer.alloc(MAX_IMAGE_BYTES+1)),/20 MB/);
});
