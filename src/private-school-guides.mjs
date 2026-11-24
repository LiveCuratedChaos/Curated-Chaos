import {isDocumentId} from './private-document-fields.mjs';

export const guideLabels=Object.freeze({program:'Program guide',course:'Course guide',syllabus:'Syllabus'});
export const schoolGuideKinds=kind=>kind==='degree'?['program']:kind==='course'?['course','syllabus']:[];
export function schoolGuideVersions(payload){
 const guides=Object.hasOwn(payload,'guideDocuments')?payload.guideDocuments:[];
 if(!Array.isArray(guides)||guides.length>50)throw Error('Invalid School Library history.');
 const seen=new Set();
 for(const guide of guides){
  if(!guide||Object.keys(guide).sort().join(',')!=='addedAt,documentId,kind'||
     !schoolGuideKinds(payload.kind).includes(guide.kind)||!isDocumentId(guide.documentId)||
     typeof guide.addedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(guide.addedAt)||
     new Date(guide.addedAt).toISOString()!==guide.addedAt)throw Error('Invalid guide version.');
  const key=guide.kind+'/'+guide.documentId;
  if(seen.has(key))throw Error('This original is already in the guide history.');
  seen.add(key);
 }
 return guides;
}
