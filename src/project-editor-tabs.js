/* Tab navigation is independent of the project form and preserves field values. */
(function(root){
 function attach(document){
  const editor=document.getElementById('project-editor');
  const tabs=[...editor.querySelectorAll('[role=tab]')];
  function select(name,{focus=false}={}){
   const selected=tabs.find(tab=>tab.id===`editor-tab-${name}`);if(!selected)return;
   for(const tab of tabs){const active=tab===selected;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;}
   editor.querySelector('.editor-body').scrollTop=0;
   if(focus)selected.focus();
  }
  for(const [index,tab] of tabs.entries()){
   tab.addEventListener('click',()=>select(tab.id.replace('editor-tab-','')));
   tab.addEventListener('keydown',event=>{
    const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
    const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):offset?tabs[(index+offset+tabs.length)%tabs.length]:null;
    if(!next)return;event.preventDefault();select(next.id.replace('editor-tab-',''),{focus:true});
   });
  }
  // Native form validation must reveal invalid controls before the browser focuses them.
  let validating=false;
  editor.addEventListener('invalid',event=>{
   if(validating)return;validating=true;queueMicrotask(()=>{validating=false;});
   const panel=event.target.closest('[role=tabpanel]');if(panel)select(panel.id.replace('editor-panel-',''));
  },true);
  return {select};
 }
 if(typeof module==='object'&&module.exports)module.exports={attach};
 else root.projectEditorTabs=attach(root.document);
})(typeof window==='undefined'?globalThis:window);
