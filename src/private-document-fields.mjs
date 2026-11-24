export const DOCUMENT_LIMIT=8*1024*1024;
export const DOCUMENT_TYPES=Object.freeze(['application/pdf','image/jpeg','image/png','image/webp']);
export const DOCUMENT_CLASSES=Object.freeze(['Receipt','Invoice','Warranty','Insurance policy','Syllabus','Course guide','Program guide']);
export const documentExpiry=value=>typeof value==='string'&&/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const clean=(s,n)=>typeof s==='string'&&s.length>0&&s===s.trim()&&s.length<=n&&!/[\u0000-\u001f\u007f]/.test(s);
export function documentFields(input){
 if(!input||Object.keys(input).filter(k=>!['classification','expiresOn'].includes(k)).sort().join(',')!=='bytes,folder,mime,name,tags'||
    Object.hasOwn(input,'classification')&&!DOCUMENT_CLASSES.includes(input.classification)||Object.hasOwn(input,'expiresOn')&&!documentExpiry(input.expiresOn)||!clean(input.name,150)||/[\\/]/.test(input.name)||
    !DOCUMENT_TYPES.includes(input.mime)||!Number.isSafeInteger(input.bytes)||input.bytes<1||input.bytes>DOCUMENT_LIMIT||
    typeof input.folder!=='string'||input.folder.length>180||input.folder!==input.folder.trim()||
    input.folder&&input.folder.split('/').some(f=>!clean(f,70)||f==='.'||f==='..'||f.includes('\\'))||
    !Array.isArray(input.tags)||input.tags.length>12||input.tags.some(t=>!clean(t,40)||t.includes(','))||
    new Set(input.tags.map(t=>t.toLowerCase())).size!==input.tags.length)throw Error('Check the file, folder and tags.');
 return {name:input.name,mime:input.mime,bytes:input.bytes,folder:input.folder,tags:[...input.tags],...(input.classification?{classification:input.classification}:{}),...(input.expiresOn?{expiresOn:input.expiresOn}:{})};
}
export const isDocumentId=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const DOCUMENT_COLLECTIONS=Object.freeze({all:'All documents',pdf:'PDFs',images:'Images',unfiled:'Unfiled'});
export function documentFilter(value){
 if(!value||Object.keys(value).sort().join(',')!=='collection,text'||typeof value.collection!=='string'||!Object.hasOwn(DOCUMENT_COLLECTIONS,value.collection)||
    typeof value.text!=='string'||value.text.length>150||/[\u0000-\u001f\u007f]/.test(value.text))throw Error('Choose a valid document search.');
 return {collection:value.collection,text:value.text.trim()};
}
export function matchesDocument(fields,filter){
 if(filter.collection==='pdf'&&fields.mime!=='application/pdf'||filter.collection==='images'&&!fields.mime.startsWith('image/')||
    filter.collection==='unfiled'&&fields.folder)return false;
 const term=filter.text.normalize('NFKC').toLowerCase();
 return [fields.name,fields.folder,...fields.tags].some(s=>s.normalize('NFKC').toLowerCase().includes(term));
}

// A shortcut keeps only the owner's query and optional collection.
export function documentShortcutFilters(value){
 if(value?.type==='document-text'&&Object.keys(value).sort().join(',')==='query,type'){
  const {text}=documentFilter({text:value.query,collection:'all'});
  if(text)return{type:'document-text',query:text};
 }
 if(value?.type==='document-library'&&Object.keys(value).sort().join(',')==='collection,query,type'){
  const filter=documentFilter({text:value.query,collection:value.collection});
  return{type:'document-library',query:filter.text,collection:filter.collection};
 }
 throw Error('Choose a supported document search.');
}
export const isDocumentShortcut=filters=>['document-text','document-library'].includes(filters?.type);
