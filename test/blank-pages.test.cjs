const {test}=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {inspect}=require('../src/blank-pages.cjs');

test('sensibilidade alta preserva escrita azul clara e ignora folha branca',async()=>{
 const blank=await sharp({create:{width:900,height:900,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
 const lines=Array.from({length:14},(_,i)=>`<path d="M 160 ${120+i*43} Q 270 ${80+i*43} 400 ${130+i*43} T 670 ${120+i*43}"/>`).join('');
 const writing=await sharp(Buffer.from(`<svg width="900" height="900"><rect width="900" height="900" fill="white"/><g fill="none" stroke="#c6d5f4" stroke-width="2">${lines}</g></svg>`)).jpeg().toBuffer();
 for(const sensitivity of [80,100]){
  assert.equal((await inspect(blank,sensitivity)).blank,true);
  assert.equal((await inspect(writing,sensitivity)).blank,false);
  assert.equal((await inspect(await sharp(blank).greyscale().jpeg().toBuffer(),sensitivity)).blank,true);
 }
});
