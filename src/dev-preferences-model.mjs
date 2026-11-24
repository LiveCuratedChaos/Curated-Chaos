// M1F: fictional, owner-private UI preferences. Display controls are NOT authorization policies.
// Never use UI toggles to grant access or revoke RLS, OAuth or database permissions.
import {accessibleAppearance} from './private-accessible-appearance.mjs';
import { QA_PALETTES } from './dev-theme.mjs';
import {normalizeNavigation} from './dev-navigation-model.mjs';
import { INTEGRATION_SOURCES } from './dev-intelligence-model.mjs';
import {normalizeCategoryColors,defaultCategoryColors} from './private-category-colors.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DEFAULT_BRIEF_PREFERENCES=Object.freeze({
  palette:'neutral',density:'balanced',hideAmounts:true,automationMode:'ask',categoryColors:defaultCategoryColors(),
  sources:Object.freeze(Object.fromEntries(INTEGRATION_SOURCES.map(k=>[k,true]))),
  suggestions:Object.freeze({email:true,school:true,household:true}),
  quietHours:Object.freeze({enabled:false,start:'22:00',end:'07:00'})
});
const isBoolean=v=>typeof v==='boolean';
const validTime=x=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x||'');
export function normalizeBriefPreferences(data){
  const d=data&&typeof data==='object'?data:{};
  const sources=Object.fromEntries(INTEGRATION_SOURCES.map(k=>[k,isBoolean(d.sources?.[k])?d.sources[k]:true]));
  const suggestions=Object.fromEntries(['email','school','household'].map(k=>[k,isBoolean(d.suggestions?.[k])?d.suggestions[k]:true]));
  return {
    ...Object.fromEntries(Object.entries(accessibleAppearance(d)).filter(([key])=>Object.hasOwn(d,key))),
    palette:QA_PALETTES.includes(d.palette)?d.palette:'neutral',
    density:['balanced','compact','spacious'].includes(d.density)?d.density:'balanced',
    hideAmounts:isBoolean(d.hideAmounts)?d.hideAmounts:true,
    automationMode:['automatic','ask','disabled'].includes(d.automationMode)?d.automationMode:'ask',
    categoryColors:normalizeCategoryColors(d.categoryColors),
    navigation:normalizeNavigation(d.navigation),
    sources,suggestions,
    quietHours:{enabled:isBoolean(d.quietHours?.enabled)?d.quietHours.enabled:false,
      start:validTime(d.quietHours?.start)?d.quietHours.start:'22:00',
      end:validTime(d.quietHours?.end)?d.quietHours.end:'07:00'}
  };
}
export function makeBriefPreferencesRecord(data,ownerId){
  if(!UUID.test(ownerId||''))throw Error('Verified test account required.');
  const normalized=normalizeBriefPreferences(data);
  // Suggestions never authorize automation of task creation or consequential actions.
  return {owner_id:ownerId,household_id:null,visibility:'private',section:'Personal Life',item_type:'brief_preferences',origin:'M1F_QA_SETTINGS',payload:{fictional:true,source:'M1F_QA_SETTINGS',...normalized}};
}
export function readOwnerBriefPreferences(rows,ownerId){
  const matching=(Array.isArray(rows)?rows:[]).filter(r=>r?.deleted_at==null&&r?.owner_id===ownerId&&r?.household_id===null&&r.visibility==='private'
    &&r.item_type==='brief_preferences'&&r.section==='Personal Life'&&r.payload?.fictional===true&&r.payload.source==='M1F_QA_SETTINGS'
    &&UUID.test(r.id||'')&&Number.isInteger(r.version)&&r.version>=1);
  matching.sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))||String(b.created_at||'').localeCompare(String(a.created_at||''))||String(b.id||'').localeCompare(String(a.id||'')));
  return {record:matching[0]||null,duplicateCount:Math.max(0,matching.length-1),preferences:normalizeBriefPreferences(matching[0]?.payload)};
}
export function maySuggest(suggestion,prefs){
  const p=normalizeBriefPreferences(prefs);
  return !!(p.automationMode!=='disabled'&&suggestion&&p.sources[suggestion.source]&&p.suggestions[suggestion.source]);
}
