import {DOCUMENT_COLLECTIONS} from './private-document-fields.mjs';
import {escapeHtml as e} from './core.mjs';
import {parsePrivateSearchIntent} from './private-search-intent.mjs';
import {newYorkTaskDay} from './private-smart-task.mjs';
const display=(key,value)=>({type:{all:'All',task:'Tasks',note:'Notes',event:'Workspace events',project:'Projects',school:'School programs and courses','document-library':'Document names, folders and tags'},status:{all:'All statuses',open:'Open',completed:'Completed'},collection:DOCUMENT_COLLECTIONS,section:{all:'All areas'},priority:{all:'All priorities'},dateStatus:{all:'All dates',dated:'With a due date',undated:'No due date'}}[key]?.[value]||value||({query:'Any title',dateFrom:'No lower date bound',dateTo:'No upper date bound'}[key]||'Any'));
const names={query:'Title phrase',type:'Record type',section:'Area',status:'Task status',priority:'Task priority',dateFrom:'From date',dateTo:'Through date',dateStatus:'Date status',collection:'Document collection'};
export function createSearchIntentPanel({clock=Date.now,canUse=()=>false,options={},onChange=()=>{},onSearch=()=>{}}={}){
 const scope=Object.fromEntries(['allowProjects','allowSchoolRead','allowDocuments','allowPriority','allowDates','allowUndated'].map(key=>[key,options[key]===true]));
 let view=null,phrase='',error='',disposed=false;
 const changed=focus=>{if(!disposed)onChange(canUse()?focus:undefined);};
 function reset(){view=null;phrase='';error='';}
 function fresh(){const now=clock();return view&&Number.isFinite(now)&&Number.isFinite(view.interpretedAt)&&view.interpretedAt<=now&&Number.isFinite(view.expiresAt)&&view.expiresAt>now&&view.expiresAt<=view.interpretedAt+300000&&newYorkTaskDay(now)===view.anchorDay;}
 function expire(){view=null;phrase='';error='This interpreted search expired. Interpret the current search again before searching.';}
 function prepare(text,{weekStart=0}={}){
  if(disposed||!canUse())return false;reset();
  try{
   const parsed=parsePrivateSearchIntent(text,{now:clock(),...scope,weekStart});
   if(!parsed||!parsed.fields||Object.keys(parsed.fields).some(key=>!Object.hasOwn(names,key)))throw Error();
   view=structuredClone(parsed);if(!fresh())throw Error();phrase=text;
  }catch{reset();error='This search could not be interpreted within the available filters. Use explicit search filters or revise the phrase.';}
  changed(view?'#private-search-intent-title':'#private-search-intent-status');return Boolean(view);
 }
 function render(){
  if(disposed)return'';if(!canUse()){reset();return'';}if(view&&!fresh())expire();if(!view&&!error)return'';
  return`<section class="panel" id="private-search-intent-panel" aria-labelledby="private-search-intent-title"><h3 id="private-search-intent-title" tabindex="-1">Interpreted search filters</h3><p id="private-search-intent-status" role="status" tabindex="-1">${e(error)}</p>${view?`<p>Original phrase: <q>${e(phrase)}</q></p><p>Interpreted locally. These proposed filters have not been searched. Existing results may still be visible. Review every proposed filter before searching. Relative phrases become the dates shown here; saved shortcuts keep those dates.</p><dl>${Object.entries(names).filter(([key])=>Object.hasOwn(view.fields,key)).map(([key,label])=>`<dt>${key==='query'&&view.fields.type==='document-library'?'Match in document names, folders or tags':label}</dt><dd>${e(display(key,view.fields[key]))}</dd>`).join('')}</dl><button class="btn" type="button" id="private-search-intent-apply">Search interpreted filters</button>`:''}<button class="btn" type="button" id="private-search-intent-cancel">Cancel interpreted search</button></section>`;
 }
 function click(event){const target=event?.target;if(!target?.closest||disposed)return false;
  if(target.closest('#private-search-intent-cancel')){reset();changed();return true;}
  if(!target.closest('#private-search-intent-apply'))return false;
  if(!canUse()){reset();changed();return true;}
  if(!view)return true;
  if(!fresh()){expire();changed('#private-search-intent-status');return true;}
  const fields=structuredClone(view.fields);reset();changed();onSearch(fields);return true;
 }
 return{prepare,reset,offline(){reset();changed();},dispose(){reset();disposed=true;},render,click};
}
