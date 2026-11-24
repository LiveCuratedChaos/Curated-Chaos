import {escapeHtml as e} from './core.mjs';
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const label=v=>typeof v==='string'&&v.trim()===v&&v.length>0&&v.length<=150;
export function verifyReceiptPicker(v,offset,expiresAt){
 if(!v||Object.keys(v).sort().join(',')!=='attachedName,expiresAt,files,hasMore,offset'||v.offset!==offset||v.expiresAt!==expiresAt||
    typeof v.hasMore!=='boolean'||v.attachedName!==null&&!label(v.attachedName)||!Array.isArray(v.files)||v.files.length>25||
    v.hasMore&&v.files.length!==25||new Set(v.files.map(f=>f.choice)).size!==v.files.length||
    v.files.some(f=>!f||Object.keys(f).sort().join(',')!=='choice,name'||!token(f.choice)||!label(f.name)))throw Error('Invalid receipt choices.');
 return v;
}
export function renderReceiptPicker(p,button,backLabel='Back to transaction'){
 return '<h3>Receipt file</h3>'+(p.attachedName?'<p>Attached document · '+e(p.attachedName)+'</p>'+button('receipt-download','Download attached receipt')+
  button('receipt-unlink','Review removing link'):'<p>No file attached.</p>')+
  (p.files.length?'<ul>'+p.files.map(f=>'<li>'+button('receipt-choose-'+f.choice,'Choose '+f.name)+'</li>').join('')+'</ul>':'<p>No documents on this page. Add a file to your Document Library first.</p>')+
  (p.offset?button('receipt-prev','Previous documents'):'')+(p.hasMore?button('receipt-next','Next documents'):'')+button('receipt-close',backLabel);
}
