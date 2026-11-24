import {CATEGORY_COLOR_TOKENS,normalizeCategoryColors} from '../src/private-category-colors.mjs';

export function sectionColorSettings(colors){
 return {sections:{...colors.sections},items:{}};
}

// An original record reader has already verified the current, owner-private original.
export function recordColorSelection(record,colors){
 return {itemType:record.item_type,title:record.payload.title,section:record.section,itemColor:colors.items[record.id]??'section',sectionColor:colors.sections[record.section]??'inherit'};
}
export function prepareRecordColor(preferences,rows,owner,record,baseTag,choice){
 if(choice!=='section'&&!CATEGORY_COLOR_TOKENS.includes(choice))throw Error('Choose a supported record color.');
 const current=preferences.read(rows,owner),colors=structuredClone(current.preferences.categoryColors);
 const before=colors.items[record.id]??'section';
 if(choice==='section')delete colors.items[record.id];
 else colors.items[record.id]=choice;
 const {palette,density,hideAmounts}=current.preferences;
 const plan=preferences.prepare(rows,owner,{baseTag,changes:{palette,density,hideAmounts,categoryColors:colors}});
 if(plan.record)plan.payload={...plan.record.payload,categoryColors:colors};
 plan.changes=before===choice?[]:[{field:'itemColor',before,after:choice}];
 return plan;
}

// Only a display token travels with a visible original. Identifier mappings stay server-side.
export function withRecordColors(action,rawColors,{inheritSections=false}={}){
 const colors=normalizeCategoryColors(rawColors);
 return row=>{
  const token=['task','note','event','project'].includes(row.item_type)?(colors.items[row.id]??(inheritSections?colors.sections[row.section]:undefined)):null;
  return {...action?.(row),...(token?{displayColor:token}:{})};
 };
}
