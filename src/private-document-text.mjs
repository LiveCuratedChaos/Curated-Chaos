import {escapeHtml as e} from './core.mjs';
export const documentTextStatus=Object.freeze({
 unavailable:'Text reading is unavailable on this host. You can download the original file.',
 unreadable:'Text could not be read from this file. You can download the original.',
 busy:'The text reader is busy. Try opening the file again.'
});
export function documentTextQuery(value){
 if(typeof value!=='string'||value.length>150||/[\u0000-\u001f\u007f]/.test(value))throw Error('Invalid document search.');
 return value.trim();
}
export function matchingTextPages(parsed,query){
 const fold=s=>s.normalize('NFKC').toLowerCase(),term=fold(query);
 return term?parsed.pages.flatMap((text,i)=>parsed.methods[i]!=='unavailable'&&fold(text).includes(term)?[i+1]:[]):[];
}
export function verifyDocumentText(result,name,page,query){
 if(!result||result.name!==name||typeof result.status!=='string')throw Error();
 if(Object.hasOwn(documentTextStatus,result.status)){
  if(Object.keys(result).sort().join(',')!=='name,status')throw Error();return result;
 }
 if(result.status!=='ready'||Object.keys(result).sort().join(',')!=='matches,method,name,page,pages,query,status,text,unreadPages'||result.page!==page||result.query!==query||
  !Number.isInteger(result.pages)||result.pages<1||result.pages>80||page<1||page>result.pages||!['text','ocr','unavailable'].includes(result.method)||
  typeof result.text!=='string'||result.text.length>24000||!Array.isArray(result.matches)||result.matches.length>result.pages||
  !Array.isArray(result.unreadPages)||result.unreadPages.length>result.pages||
  result.unreadPages.some((n,i)=>!Number.isInteger(n)||n<1||n>result.pages||i>0&&n<=result.unreadPages[i-1])||
  result.unreadPages.includes(page)!==(result.method==='unavailable')||
  result.matches.some((n,i)=>result.unreadPages.includes(n)||!query||!Number.isInteger(n)||n<1||n>result.pages||(i>0&&n<=result.matches[i-1])))throw Error();
 return result;
}
export function renderDocumentText(result,query,button){
 let html='<legend>'+e(result.name)+'</legend>';
 if(result.status!=='ready')return html+'<p role="status">'+e(documentTextStatus[result.status])+'</p>'+button('text-back','Back to documents');
 html+='<h3>Page '+result.page+' of '+result.pages+'</h3>'+
  (result.method==='ocr'?'<p>Text recognized from an image. Check the original when a word or number is unclear.</p>':'')+
  (result.method==='unavailable'?'<p>Text recognition is unavailable for this page. Download the original to read it.</p>':result.text?'<pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+e(result.text)+'</pre>':'<p>No readable text on this page.</p>')+
  (result.page>1?button('text-prev','Previous page'):'')+(result.page<result.pages?button('text-next','Next page'):'')+
  '<label>Find in this document<input type="search" maxlength="150" data-document-field="textQuery" value="'+e(query)+'"></label>'+button('text-find','Find matching pages');
 if(result.unreadPages.length)html+='<p>Text search could not read '+(result.unreadPages.length===1?'page ':'pages ')+e(result.unreadPages.join(', '))+'.</p>';
 if(result.query)html+=result.matches.length?'<p>Matching pages</p>'+result.matches.map(n=>button('text-page-'+n,'Page '+n)).join(''):'<p>No matching pages.</p>';
 return html+button('text-back','Back to documents');
}
