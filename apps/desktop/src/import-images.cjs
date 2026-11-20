const fs=require('node:fs/promises');
const path=require('node:path');
const {normalizeMobileImage,MAX_IMAGE_BYTES}=require('./mobile-images.cjs');

// Paths come exclusively from the main-process native file picker.
async function importImages(files,{projects,projectId,onPage,normalize=normalizeMobileImage}){
 const project=await projects.info(projectId),warnings=[];
 let imported=0;
 for(const file of files){
  let original,image;
  try{
   const stat=await fs.stat(file);
   if(!stat.isFile()||stat.size>MAX_IMAGE_BYTES)throw Error('Selecione uma foto de até 20 MB.');
   original=await fs.readFile(file);
   image=await normalize(original,project.colorMode,project.processingMode,{documentType:project.documentType,dpi:project.dpi});
  }catch(error){warnings.push(`${path.basename(file)}: ${error.message}`);continue;}
  let page;
  try{page=await projects.append(projectId,image,original,project.processingMode);}
  catch{warnings.push(`${path.basename(file)}: não foi possível salvar a imagem no projeto. A importação foi interrompida.`);break;}
  imported++;
  onPage(image);
  try{const result=await projects.sendPage(projectId,page,image);if(result.warning)warnings.push(result.warning);}
  catch(error){warnings.push(error.message);}
 }
 return {imported,warnings:[...new Set(warnings)]};
}
module.exports={importImages};
