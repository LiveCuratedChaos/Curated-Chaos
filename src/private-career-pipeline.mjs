import {privateCareerFields} from './private-career-fields.mjs';
const clean=(value,limit)=>typeof value==='string'&&value.trim()===value&&value.length<=limit&&!/[\u0000-\u001f\u007f]/.test(value);
export const careerFold=value=>value.normalize('NFKC').toLocaleLowerCase('en-US');
export function applicationSummary(value){
 if(!value||Object.keys(value).sort().join(',')!=='employer,role,stage'||!clean(value.employer,120)||!value.employer||
    !clean(value.role,120)||!value.role||!clean(value.stage,48)||!value.stage)throw Error('Invalid application summary.');
 return value;
}
export function pipelineFilters({stage,query,offset}){
 if(typeof query!=='string'||!clean(query.trim(),100)||!clean(stage,48)||!Number.isInteger(offset)||offset<0||offset>1950||offset%50)throw Error('Choose a valid application filter.');
 return {query:query.trim(),stage,offset};
}

export function goalSummary(value){
 if(!value||Object.keys(value).sort().join(',')!=='certifications,role,skills')throw Error('Invalid career goal.');
 const {role,skills,certifications}=privateCareerFields({kind:'goal',employer:'',stage:'',targetCompensation:'',...value},{requireCanonical:true});
 return {role,skills,certifications};
}

export function goalFilters({query,offset}){
 const checked=pipelineFilters({query,offset,stage:''});
 return {query:checked.query,offset:checked.offset};
}
