import {privateCareerFields} from './private-career-fields.mjs';
import {normalizeHomeAsset} from './private-home-asset.mjs';
export const PROJECT_AREAS=Object.freeze(['Home','Personal Life','Work','School']);
export const PROJECT_STATUSES=Object.freeze(['Planned','Active','On hold','Completed']);
export function projectFields(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).filter(k=>!['separateRecurring','career','homeAsset'].includes(k)).sort().join(',')!=='description,section,status,title'||Object.hasOwn(value,'separateRecurring')&&typeof value.separateRecurring!=='boolean'||typeof value.title!=='string'||!value.title.trim()||value.title.trim().length>140||/[\u0000-\u001f\u007f]/.test(value.title)||typeof value.description!=='string'||value.description.length>10000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.description)||!PROJECT_AREAS.includes(value.section)||!PROJECT_STATUSES.includes(value.status))throw Error('Use a project title up to 140 characters, details up to 10,000 characters, and supported area/status.');
 const career=privateCareerFields(value.career),homeAsset=value.homeAsset==null?null:normalizeHomeAsset(value.homeAsset);if(career&&value.section!=='Work')throw Error('Career details must stay in Work.');if(homeAsset&&value.section!=='Home')throw Error('Home asset details must stay in Home.');
 return{title:value.title.trim(),description:value.description,section:value.section,status:value.status,...(Object.hasOwn(value,'separateRecurring')?{separateRecurring:value.separateRecurring}:{}),...(career?{career}:{}),...(homeAsset?{homeAsset}:{})};
}
