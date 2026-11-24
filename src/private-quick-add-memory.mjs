import {TASK_SECTIONS} from './dev-brief-model.mjs';

// Volatile convenience only: never persists a destination across tabs or sessions.
export function createQuickAddMemory(){
 let rememberedSection='';
 return{
  sectionFor(contextSection=''){
   if(contextSection&&TASK_SECTIONS.includes(contextSection))return contextSection;
   return rememberedSection||'Personal Life';
  },
  remember(section){if(!TASK_SECTIONS.includes(section))return false;rememberedSection=section;return true;},
  clear(){rememberedSection='';}
 };
}
