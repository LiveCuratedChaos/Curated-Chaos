// Only the explicitly opened note text is copied. No tokens, source IDs, history or reads.
export function noteCopyDraft(view,{now=Date.now(),allowLongNotes=false}={}){
 if(typeof allowLongNotes!=='boolean')throw Error('Explicit note copy limit required.');const limit=allowLongNotes?10000:1000;
 if(!Number.isFinite(now)||!view||view.readOnly!==true||!Number.isFinite(view.expiresAt)||view.expiresAt<=now)throw Error('Open a fresh note view before copying it.');
 if(Object.keys(view).some(k=>!['title','body','readOnly','expiresAt','noteToken'].includes(k))||typeof view.title!=='string'||!view.title.trim()||view.title!==view.title.trim()||view.title.length>120||typeof view.body!=='string'||view.body.length>limit)throw Error('This note cannot be copied completely within the new-note limits. Nothing was copied.');
 return{title:view.title,body:view.body,preserveWhitespace:true};
}
