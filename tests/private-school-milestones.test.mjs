import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveSchoolMilestones} from '../src/private-school-milestones.mjs';
import {createPrivateSchoolPanel} from '../src/private-school-panel.mjs';

const token=n=>String(n).repeat(43);
function course(n,title,term,status,credits=3){return{schoolReadToken:token(n),title,code:'',term,status,credits,officialOrder:n,studyOrder:n,targetDate:'',programReadToken:token(9),programTitle:'Saved program',association:'linked'};}
function overview(courses,now){return{readOnly:true,providerRead:false,checkedAt:new Date(now).toISOString(),expiresAt:now+60000,viewId:token(8),programs:[{schoolReadToken:token(9),title:'Saved program',progressMetric:'classes',done:courses.filter(c=>c.status==='Completed').length,total:courses.length,percentage:courses.length?Math.round(courses.filter(c=>c.status==='Completed').length/courses.length*100):0,courseCount:courses.length}],courses};}

test('derived School milestones use saved course completion and all saved courses per term',()=>{
 const courses=[course(1,'Completed course','Fall','Completed',3),course(2,'Open course','Fall','In Progress',3),course(3,'<Spring course>','Spring','Completed',4)];
 const result=deriveSchoolMilestones({programs:[],courses});
 assert.deepEqual(result.completedCourses.map(c=>c.title),['Completed course','<Spring course>']);
 assert.deepEqual(result.completedTerms,[{programTitle:'Saved program',term:'Spring',count:1}]);
 assert.deepEqual(result.completedCredits,[{programTitle:'Saved program',credits:7}]);
});

test('credit targets are derived only from the saved program credit metric',()=>{
 const courses=[course(1,'Completed course','Fall','Completed',7)],programs=[{schoolReadToken:token(9),title:'Saved program',progressMetric:'credits',done:7,total:10}];
 assert.deepEqual(deriveSchoolMilestones({programs,courses}).creditTargets,[{programTitle:'Saved program',completed:7,target:10,reached:false}]);
 assert.deepEqual(deriveSchoolMilestones({programs:[{...programs[0],done:10}],courses}).creditTargets,[{programTitle:'Saved program',completed:10,target:10,reached:true}]);
 assert.deepEqual(deriveSchoolMilestones({programs:[{...programs[0],progressMetric:'classes'}],courses}).creditTargets,[]);
});

test('saved School panel renders escaped, display-only course, term, and credit markers',async t=>{
 const now=Date.parse('2026-11-21T12:00:00Z'),courses=[course(1,'Completed course','Fall','Completed',3),course(2,'Open course','Fall','In Progress',3),course(3,'<Spring course>','Spring','Completed',4)],value=overview(courses,now);
 const panel=createPrivateSchoolPanel({client:{async schoolOverview(){return value;}},clock:()=>now,canUse:()=>true});t.after(()=>panel.dispose());
 panel.click({target:{closest:s=>s==='#private-school-open'?{}:null}});await new Promise(resolve=>setImmediate(resolve));
 const html=panel.render();
 assert.match(html,/Derived School milestones/);assert.match(html,/No milestone records are created/);
 assert.match(html,/Completed course/);assert.match(html,/Saved program · Spring \(1 saved course\)/);assert.match(html,/7 saved credits completed/);
 assert.doesNotMatch(html,/<Spring course>/);assert.match(html,/&lt;Spring course&gt;/);
 assert.doesNotMatch(html,/Fall \(2 saved courses\)/);
});
