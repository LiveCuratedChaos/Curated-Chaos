import {escapeHtml as e} from './core.mjs';
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
export function appendContentResults(scan,batch,expiry){
 if(!batch||Object.keys(batch).sort().join(',')!=='continuation,documents,expiresAt,incomplete,query,scanned'||batch.query!==scan.query||batch.expiresAt!==expiry||
    !Number.isInteger(batch.scanned)||batch.scanned<0||batch.scanned>2||!Number.isInteger(batch.incomplete)||batch.incomplete<0||batch.incomplete>batch.scanned||
    batch.continuation!==null&&(!token(batch.continuation)||batch.continuation===scan.continuation||!batch.scanned)||
    !Array.isArray(batch.documents)||batch.documents.length>batch.scanned||scan.hits.length+batch.documents.length>25)throw Error();
 const used=new Set(scan.hits.map(h=>h.choice));
 for(const hit of batch.documents){
  if(!hit||Object.keys(hit).sort().join(',')!=='choice,name,pages'||!token(hit.choice)||used.has(hit.choice)||
     typeof hit.name!=='string'||!hit.name.trim()||hit.name.length>150||!Array.isArray(hit.pages)||!hit.pages.length||hit.pages.length>80||
     hit.pages.some((p,i)=>!Number.isInteger(p)||p<1||p>80||i>0&&p<=hit.pages[i-1]))throw Error();
  used.add(hit.choice);
 }
 return {...scan,scanned:scan.scanned+batch.scanned,incomplete:scan.incomplete+batch.incomplete,hits:[...scan.hits,...batch.documents],continuation:batch.continuation};
}
export function renderContentResults(scan,busy,button){
 let html='<legend>Search document contents</legend><p>Finding “'+e(scan.query)+'” · '+scan.scanned+' files checked</p>';
 if(scan.incomplete)html+='<p>'+scan.incomplete+' files could only be searched in part or could not be read.</p>';
 if(scan.hits.length)html+='<ul>'+scan.hits.map(hit=>'<li><strong>'+e(hit.name)+'</strong> '+
  hit.pages.map(p=>button('content-page-'+hit.choice+'-'+p,'Page '+p,busy)).join(' ')+'</li>').join('')+'</ul>';
 else if(!busy)html+='<p>No matches in the readable pages checked.</p>';
 if(!busy&&scan.continuation)html+=button('content-more','Show more matching files');
 return html+button('list','Back to my documents',busy);
}
