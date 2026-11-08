const {PDFDocument}=require('pdf-lib');
const {pdflibAddPlaceholder}=require('@signpdf/placeholder-pdf-lib');
const {SignPdf}=require('@signpdf/signpdf');
async function signedPage(jpeg,{dpi=300,name='Documento'},signer){
 if(!signer)throw Error('O certificado não está liberado. Nenhum PDF sem assinatura será exportado.');
 const doc=await PDFDocument.create();
 const image=await doc.embedJpg(jpeg);
 const width=image.width*72/dpi,height=image.height*72/dpi;
 const page=doc.addPage([width,height]);page.drawImage(image,{x:0,y:0,width,height});
 doc.setTitle(name);doc.setCreator('NAPS2 Desktop');
 pdflibAddPlaceholder({pdfDoc:doc,reason:'Assinatura do documento digitalizado',name:signer.metadata?.subject||'',contactInfo:'',location:'',signatureLength:32768,appName:'NAPS2 Desktop'});
 const unsigned=Buffer.from(await doc.save({useObjectStreams:false}));
 return new SignPdf().sign(unsigned,signer);
}
module.exports={signedPage};
