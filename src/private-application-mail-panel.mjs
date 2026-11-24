import {escapeHtml as e} from './core.mjs';
import {projectFields} from './private-project-model.mjs';

const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const stages=new Set(['Applied','Interviewing','Offer received']);
const exact=(v,keys)=>v&&Object.keys(v).sort().join(',')===keys;

export function verifyApplicationMail(page,offset,now,expiry){
 if(!exact(page,'browseLimitReached,choices,expiresAt,hasMore,offset')||page.offset!==offset||
   !Number.isFinite(page.expiresAt)||page.expiresAt<=now||page.expiresAt>expiry||
   typeof page.hasMore!=='boolean'||typeof page.browseLimitReached!=='boolean'||
   page.hasMore&&offset===495||page.browseLimitReached&&offset!==495||!Array.isArray(page.choices)||
   page.choices.length>5||new Set(page.choices.map(c=>c.choice)).size!==page.choices.length)throw Error();
 for(const c of page.choices){
  if(!exact(c,'choice,receivedAt,stage,subject')||!key(c.choice)||!stages.has(c.stage)||typeof c.subject!=='string'||
     !c.subject.trim()||c.subject.length>300||/[\u0000-\u001f\u007f]/u.test(c.subject)||!Number.isFinite(Date.parse(c.receivedAt)))throw Error();
 }
 return page;
}
export function careerMailFields(draft){
 const {title,description,status,section,career,separateRecurring=true}=draft;
 return projectFields({title,description,status,section,career,separateRecurring});
}
export function verifyApplicationMailReview(result,base,entry,now,expiry){
 const {stageSource,reviewId,expiresAt,action,...fields}=result;
 const {before,subject,receivedAt,stage}=stageSource??{};
 if(!exact(stageSource,'before,receivedAt,stage,subject')||before!==base.career.stage||subject!==entry.subject||
  receivedAt!==entry.receivedAt||stage!==entry.stage||action!=='edit'||!key(reviewId)||
  !Number.isFinite(expiresAt)||expiresAt<=now||expiresAt>expiry)throw Error();
 const expected={...base,career:{...base.career,stage}};
 if(JSON.stringify(careerMailFields(projectFields(fields)))!==JSON.stringify(expected))throw Error();
 return result;
}
const button=(action,label,disabled)=>'<button type="button" class="btn" data-application-mail="'+e(action)+'" '+(disabled?'disabled':'')+'>'+e(label)+'</button>';
export function applicationMailControls(page,busy){
 if(!page)return button('open','Check saved email for stage suggestions',busy);
 let html='<section><h3>Stage suggestions from saved email</h3><p>Checking saved subjects on page '+(page.offset/5+1)+'. Each suggestion matches this employer and role.</p>';
 for(const entry of page.choices)html+='<blockquote>'+e(entry.subject)+'</blockquote><p>Received '+e(entry.receivedAt.slice(0,10))+'</p>'+button('review-'+entry.choice,'Review suggested stage · '+entry.stage,busy);
 if(!page.choices.length)html+='<p>No matching stage suggestions on this page.</p>';
 if(page.offset)html+=button('previous','Previous saved email page',busy);
 if(page.hasMore)html+=button('next','Next saved email page',busy);
 if(page.browseLimitReached)html+='<p>The first 500 saved copies are available here.</p>';
 return html+button('close','Dismiss suggestions',busy)+'</section>';
}
