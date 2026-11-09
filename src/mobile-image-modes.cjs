const MODES=['auto','color','gray','bw'];
function scanMode(mode,colorMode='RGB24'){
 const selected=mode??({Grayscale8:'gray',BlackAndWhite1:'bw'}[colorMode]||'auto');
 if(!MODES.includes(selected))throw Error('Modo de melhoria inválido.');
 return selected;
}
function documentType(value='document'){
 if(!['document','receipt'].includes(value))throw Error('Tipo de documento inválido.');return value;
}
module.exports={MODES,scanMode,documentType};
