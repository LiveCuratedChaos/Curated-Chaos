// Selected note versions reuse the shared sparse history contract and original note writer.
import {escapeHtml as e} from './core.mjs';
import {createPrivateRecordVersionPanel} from './private-record-version-panel.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
export function verifyNoteHistoricalDetails(v,{entry,now=Date.now(),maxExpiry=now+300000}={}){
 if(!entry||!exact(v,['readOnly','historical','expiresAt','version','operation','capturedAt','wasDeleted','record',...(Object.hasOwn(v??{},'recoveredAt')?['recoveredAt']:[])])||v.readOnly!==true||v.historical!==true||typeof v.wasDeleted!=='boolean'||!Number.isFinite(v.expiresAt)||v.expiresAt<=now||v.expiresAt>Math.min(now+300000,maxExpiry)||['version','operation','capturedAt','recoveredAt'].some(k=>v[k]!==entry[k])||!exact(v.record,['title','body'])||typeof v.record.title!=='string'||!v.record.title.trim()||v.record.title.length>200||typeof v.record.body!=='string'||v.record.body.length>100000)throw Error('Earlier note could not be verified.');return v;
}
export function createPrivateNoteVersionPanel(options){return createPrivateRecordVersionPanel({...options,kind:'note',verifyDetails:verifyNoteHistoricalDetails,renderDetails:detail=>'<h3>'+e(detail.record.title)+'</h3><p>Read only \u00b7 Version '+detail.version+(detail.wasDeleted?' \u00b7 Deleted at capture':'')+'</p><pre class="private-note-body" tabindex="0" aria-label="Earlier note text">'+('\n'+e(detail.record.body))+'</pre>'});}
