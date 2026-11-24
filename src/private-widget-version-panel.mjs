import {widgetPage} from './private-widget-pages.mjs';
// Exact earlier arrangements use the shared lazy history lifecycle and original layout writer.
import {escapeHtml as e} from './core.mjs';
import {validatePrivateWidgetLayouts,widgetLayoutDescription} from './private-widget-layout.mjs';
import {createPrivateRecordVersionPanel} from './private-record-version-panel.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
export function verifyWidgetHistoricalDetails(v,{entry,now=Date.now(),maxExpiry=now+300000,page='curation'}={}){
 if(!entry||!exact(v,['readOnly','historical','expiresAt','version','operation','capturedAt','wasDeleted','record',...(Object.hasOwn(v??{},'recoveredAt')?['recoveredAt']:[])])||v.readOnly!==true||v.historical!==true||typeof v.wasDeleted!=='boolean'||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>Math.min(now+300000,maxExpiry)||['version','operation','capturedAt','recoveredAt'].some(k=>v[k]!==entry[k])||!exact(v.record,page==='curation'?['layouts']:['layouts','page','configured'])||page!=='curation'&&(v.record.page!==page||typeof v.record.configured!=='boolean'))throw Error('Earlier widget arrangement could not be verified.');
 return{...v,record:{...v.record,layouts:validatePrivateWidgetLayouts(v.record.layouts)}};
}
export function createPrivateWidgetVersionPanel(options){return createPrivateRecordVersionPanel({...options,kind:'layout',verifyDetails:(v,context)=>verifyWidgetHistoricalDetails(v,{...context,page:widgetPage(options.page??'curation')}),renderDetails:detail=>'<h3>Earlier widget arrangement</h3><p>Read only · Version '+detail.version+(detail.wasDeleted?' · Deleted at capture':'')+(detail.record.configured===false?' · Current default arrangement; page was not configured at capture':'')+'</p><pre class="private-note-body" tabindex="0" aria-label="Earlier widget arrangement">'+e(widgetLayoutDescription(detail.record.layouts))+'</pre>'});}
