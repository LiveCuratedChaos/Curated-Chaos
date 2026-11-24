import {validateWidgetPages} from '../src/private-widget-pages.mjs';
// Shared exact original source contract; never repairs or rewrites saved settings.
import {validatePrivateWidgetLayouts} from '../src/private-widget-layout.mjs';
import {safeSavedAt} from './snapshot-freshness.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function privateWidgetLayoutRecord(row,owner){
 const p=row?.payload;
 if(!uuid(owner)||!row||!uuid(row.id)||row.owner_id!==owner||row.household_id!==null||row.visibility!=='private'||row.section!=='Personal Life'||row.item_type!=='dashboard_layout'||row.origin!=='M2B_DEV_WIDGETS'||row.deleted_at!==null||!Number.isInteger(row.version)||row.version<1||![row.created_at,row.updated_at].every(safeSavedAt)||!p||typeof p!=='object'||Array.isArray(p)||p.fictional!==true||p.source!=='M2B_DEV_WIDGETS'||p.layoutVersion!==1||Buffer.byteLength(JSON.stringify(p))>1024*1024)throw Error('Saved widget layout could not be verified.');
 if(Object.hasOwn(p,'pageLayouts'))validateWidgetPages(p.pageLayouts);
 return validatePrivateWidgetLayouts(p.layouts);
}
