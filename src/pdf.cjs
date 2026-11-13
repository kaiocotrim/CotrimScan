const {PDFDocument,StandardFonts,rgb}=require('pdf-lib');
const {pdflibAddPlaceholder}=require('@signpdf/placeholder-pdf-lib');
const {SignPdf}=require('@signpdf/signpdf');
async function correctedOcrPage(jpeg,ocrPdf,text,{dpi=300,name='Documento'}={}){
 const lib=require('pdf-lib');
 const existing=await lib.PDFDocument.load(ocrPdf),doc=await lib.PDFDocument.create();
 const fonts=existing.getPages()[0].node.Resources()?.lookup(lib.PDFName.of('Font'),lib.PDFDict);
 const entry=fonts?.entries().find(([,ref])=>existing.context.lookup(ref,lib.PDFDict).get(lib.PDFName.of('BaseFont'))?.toString()==='/GlyphLessFont');
 if(!entry)throw Error('Execute o OCR novamente antes de editar este documento.');
 const font=lib.PDFObjectCopier.for(existing.context,doc.context).copy(entry[1]);
 const image=await doc.embedJpg(Uint8Array.from(jpeg)),width=image.width*72/dpi,height=image.height*72/dpi;
 const page=doc.addPage([width,height]);page.drawImage(image,{x:0,y:0,width,height});
 const key=lib.PDFName.of('CorrectedOCR');page.node.setFontDictionary(key,font);
 // The edited text is a searchable invisible layer. The photographed document
 // and its signatures remain visually identical. Free edits are laid out by line.
 const columns=90,lines=[];
 for(const line of text.replace(/\r\n?/g,'\n').split('\n')){
  const chars=Array.from(line);if(!chars.length)lines.push('');
  while(chars.length)lines.push(chars.splice(0,columns).join(''));
 }
 const margin=Math.min(18,width*.04),lineHeight=Math.min(12,(height-2*margin)/Math.max(1,lines.length));
 const fontSize=Math.min(lineHeight*.8,(width-2*margin)/(columns*.5));
 page.pushOperators(lib.beginText(),lib.setFontAndSize(key,fontSize),lib.setTextRenderingMode(lib.TextRenderingMode.Invisible),lib.moveText(margin,height-margin));
 for(let i=0;i<lines.length;i++){
  if(i)page.pushOperators(lib.moveText(0,-lineHeight));
  page.pushOperators(lib.showText(lib.PDFHexString.of(Buffer.from(lines[i],'utf16le').swap16().toString('hex'))));
 }
 page.pushOperators(lib.endText());doc.setTitle(name);doc.setCreator('CotrimScan');
 return Buffer.from(await doc.save({useObjectStreams:false}));
}
async function imagePage(jpeg,{dpi=300,name='Documento'}={}){
 const doc=await PDFDocument.create(),image=await doc.embedJpg(Uint8Array.from(jpeg));
 const width=image.width*72/dpi,height=image.height*72/dpi;
 doc.addPage([width,height]).drawImage(image,{x:0,y:0,width,height});
 doc.setTitle(name);doc.setCreator('CotrimScan');
 return Buffer.from(await doc.save({useObjectStreams:false}));
}
async function signedPage(jpeg,{dpi=300,name='Documento',signatureStamp=false},signer,searchablePdf=null){
 if(!signer)throw Error('O certificado não está liberado. Nenhum PDF sem assinatura será exportado.');
 const doc=searchablePdf?await PDFDocument.load(searchablePdf):await PDFDocument.create();
 if(!searchablePdf){
 const image=await doc.embedJpg(Uint8Array.from(jpeg));
 const width=image.width*72/dpi,height=image.height*72/dpi;
 const page=doc.addPage([width,height]);page.drawImage(image,{x:0,y:0,width,height});
 }
 if(signatureStamp){
  const page=doc.getPages()[0],width=page.getWidth(),height=page.getHeight();
  const font=await doc.embedFont(StandardFonts.Helvetica);
  const size=Math.max(6,Math.min(9,width/52)),margin=12,band=46;
  const fit=value=>{
   const clean=String(value||'').replace(/[^\x20-\x7e\xa0-\xff]/g,' ').trim();
   let result=clean;
   while(result&&font.widthOfTextAtSize(result,size)>width-2*margin)result=result.slice(0,-1);
   return result.length<clean.length?result.trimEnd()+'...':result;
  };
  page.setSize(width,height+band);
  page.drawRectangle({x:0,y:height,width,height:band,color:rgb(.96,.97,.98)});
  page.drawText('ASSINADO DIGITALMENTE',{x:margin,y:height+28,size,font,color:rgb(.15,.22,.34)});
  page.drawText(fit(signer.metadata?.subject||'Certificado digital'),{x:margin,y:height+16,size,font,color:rgb(.15,.22,.34)});
  page.drawText(fit(new Date().toLocaleString('pt-BR')),{x:margin,y:height+4,size:Math.max(6,size-1),font,color:rgb(.3,.35,.42)});
 }
 doc.setTitle(name);doc.setCreator('CotrimScan');
 pdflibAddPlaceholder({pdfDoc:doc,reason:'Assinatura do documento digitalizado',name:signer.metadata?.subject||'',contactInfo:'',location:'',signatureLength:32768,appName:'CotrimScan'});
 const unsigned=Buffer.from(await doc.save({useObjectStreams:false}));
 return new SignPdf().sign(unsigned,signer);
}
async function indexedPdf(pdf,indexBuffer){
 const doc=await PDFDocument.load(pdf,{updateMetadata:false});
 await doc.attach(Uint8Array.from(indexBuffer),'cotrimscan-indexacao.json',{mimeType:'application/json',description:'Dados de captura e indexação do CotrimScan'});
 return Buffer.from(await doc.save({useObjectStreams:false}));
}
module.exports={signedPage,imagePage,correctedOcrPage,indexedPdf};
