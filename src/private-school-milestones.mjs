// Display-only milestones derived from the already verified saved School overview.
// This module has no persistence or write capability.
export function deriveSchoolMilestones({programs,courses}){
 const buckets=new Map();
 for(const course of courses){
  if(!course.term)continue;
  const programKey=course.association==='linked'?course.programReadToken:`${course.association}:${course.programTitle}`,key=`${programKey}\u0000${course.term}`;
  if(!buckets.has(key))buckets.set(key,{programTitle:course.programTitle||'Saved courses',term:course.term,courses:[]});
  buckets.get(key).courses.push(course);
 }
 const completedCourses=courses.filter(course=>course.status==='Completed').map(course=>({title:course.title,programTitle:course.programTitle,term:course.term,credits:course.credits,officialOrder:course.officialOrder,studyOrder:course.studyOrder}));
 const completedTerms=[...buckets.values()].filter(bucket=>bucket.courses.every(course=>course.status==='Completed')).map(bucket=>({programTitle:bucket.programTitle,term:bucket.term,count:bucket.courses.length}));
 const creditsByProgram=new Map();
 for(const course of completedCourses){const key=course.programTitle||'Unassigned';creditsByProgram.set(key,(creditsByProgram.get(key)||0)+course.credits);}
 const completedCredits=[...creditsByProgram].map(([programTitle,credits])=>({programTitle,credits}));
 const creditTargets=programs.filter(program=>program.progressMetric==='credits'&&program.total>0).map(program=>({programTitle:program.title,completed:program.done,target:program.total,reached:program.done>=program.total}));
 return{completedCourses,completedTerms,completedCredits,creditTargets};
}
