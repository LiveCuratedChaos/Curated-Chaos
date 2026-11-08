// Read-only discovery. Never index connected account information or another owner's data.
export const SEARCH_SECTIONS=Object.freeze(['all','Home','Personal Life','Work','School','Finances']);
export function safeSearchRows(rows,owner){
 if(!Array.isArray(rows))return [];
 return rows.filter(r=>r?.owner_id===owner&&r?.visibility==='private'&&r?.household_id===null&&r?.deleted_at==null&&r?.payload?.fictional===true&&['task','project','school_fixture'].includes(r.item_type)&&SEARCH_SECTIONS.includes(r.section));
}
export function searchRecords(rows,owner,query='',section='all'){
 const q=String(query||'').trim().toLocaleLowerCase().slice(0,140);
 if(!q)return [];
 return safeSearchRows(rows,owner).filter(r=>(section==='all'||r.section===section)&&[r.payload?.title,r.payload?.name,r.payload?.code,r.payload?.description].some(x=>String(x||'').toLocaleLowerCase().includes(q))).slice(0,80);
}
export function searchRoute(section){return ({Home:'/dev-home.html','Personal Life':'/dev-personal.html',Work:'/dev-work.html',School:'/dev-school.html',Finances:'/dev-finances.html'})[section]||'/dev-workspace.html?page=curation';}
