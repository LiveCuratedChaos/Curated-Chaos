import {TASK_SECTIONS} from './dev-brief-model.mjs';

// R20 display-only color preferences. No category value grants record access.
export const CATEGORY_COLOR_SECTIONS=Object.freeze([...TASK_SECTIONS,'Calendar','Finances']);
export const CATEGORY_COLOR_TOKENS=Object.freeze(['inherit','accent','positive','warning']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.slice().sort().join(',');

export function defaultCategoryColors(){return{sections:{},items:{}};}
export function normalizeCategoryColors(value){
 if(value===undefined||value===null)return defaultCategoryColors();
 if(!exact(value,['sections','items'])||!value.sections||typeof value.sections!=='object'||Array.isArray(value.sections)||!value.items||typeof value.items!=='object'||Array.isArray(value.items))return defaultCategoryColors();
 const sections={},items={};
 for(const [section,color]of Object.entries(value.sections))if(CATEGORY_COLOR_SECTIONS.includes(section)&&CATEGORY_COLOR_TOKENS.includes(color))sections[section]=color;
 for(const [id,color]of Object.entries(value.items).slice(0,500))if(UUID.test(id)&&CATEGORY_COLOR_TOKENS.includes(color))items[id]=color;
 return{sections,items};
}
export function categoryColorFor({section,recordId,preferences}={}){
 const colors=normalizeCategoryColors(preferences?.categoryColors??preferences),item=UUID.test(recordId||'')?colors.items[recordId]:undefined;
 return item??(CATEGORY_COLOR_SECTIONS.includes(section)?colors.sections[section]:undefined)??'inherit';
}
