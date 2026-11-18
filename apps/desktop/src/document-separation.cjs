const modes=['none','count','barcode','blank'];
const actions=['discard','keep'];
function normalizeSeparation(input){
 const value=input??{};
 const mode=value.mode??'none';
 if(!modes.includes(mode))throw Error('Modo de separação inválido.');
 const pagesPerDocument=value.pagesPerDocument??1;
 if(mode==='count'&&(!Number.isInteger(pagesPerDocument)||pagesPerDocument<1||pagesPerDocument>200))throw Error('Informe de 1 a 200 páginas por documento.');
 const separatorAction=value.separatorAction??'discard';
 if(!actions.includes(separatorAction))throw Error('Ação do separador inválida.');
 const sensitivity=value.sensitivity??50;
 if(mode==='blank'&&(!Number.isInteger(sensitivity)||sensitivity<0||sensitivity>100))throw Error('Informe uma sensibilidade de 0 a 100.');
 return {mode,pagesPerDocument:mode==='count'?pagesPerDocument:1,separatorAction,sensitivity:mode==='blank'?sensitivity:50};
}
// separators[i] is true when page i carries the separator code.
function groupDocuments(separators,separation){
 const groups=[];
 if(separation.mode==='count'){
  for(let start=0;start<separators.length;start+=separation.pagesPerDocument){
   const end=Math.min(start+separation.pagesPerDocument,separators.length);
   groups.push(Array.from({length:end-start},(_,offset)=>start+offset));
  }
  return groups;
 }
 if(separation.mode==='barcode'||separation.mode==='blank'){
  let current=[];
  separators.forEach((isSeparator,index)=>{
   if(!isSeparator){current.push(index);return;}
   if(current.length)groups.push(current);
   current=separation.separatorAction==='keep'?[index]:[];
  });
  if(current.length)groups.push(current);
  return groups;
 }
 throw Error('Modo de separação inválido.');
}
module.exports={normalizeSeparation,groupDocuments};
