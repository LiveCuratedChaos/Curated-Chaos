export const SCHOOL_SEARCH_LABELS=Object.freeze({
 school:'School programs and courses',
 'school-program':'School programs',
 'school-course':'School courses'
});

export const isSchoolSearchType=type=>typeof type==='string'&&Object.hasOwn(SCHOOL_SEARCH_LABELS,type);

export function matchesSchoolSearchType(type,kind){
 if(kind==='degree')return type==='school'||type==='school-program';
 if(kind==='course')return type==='school'||type==='school-course';
 return false;
}
