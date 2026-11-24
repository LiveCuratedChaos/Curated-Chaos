// One saved-course calculation shared by existing School and protected readers.
export function schoolProgress(program,courses){
 const metric=program.progressMetric||'classes';let done,total;
 if(metric==='classes'){done=courses.filter(c=>c.status==='Completed').length;total=courses.length;}
 else if(metric==='credits'){done=courses.filter(c=>c.status==='Completed').reduce((n,c)=>n+c.credits,0);total=program.totalCredits||courses.reduce((n,c)=>n+c.credits,0);}
 else if(metric==='terms'){const groups=new Map();for(const c of courses)if(c.term){if(!groups.has(c.term))groups.set(c.term,[]);groups.get(c.term).push(c);}done=[...groups.values()].filter(group=>group.every(c=>c.status==='Completed')).length;total=program.totalTerms||groups.size;}
 else throw Error('Supported School progress metric required.');return{done,total,percentage:total?Math.min(100,Math.round(done/total*100)):0};
}
