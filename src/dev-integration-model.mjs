// M2L: limited, read-only integration smoke checks. No customer data is collected here.
export const CHECK_ROUTES = Object.freeze([
  Object.freeze({name:'Daily Brief',href:'/dev-dashboard.html',area:'Overview'}),
  Object.freeze({name:'The Curation',href:'/dev-workspace.html?page=curation',area:'Overview'}),
  Object.freeze({name:'Tasks & Projects',href:'/dev-organize.html',area:'Overview'}),
  Object.freeze({name:'Calendar',href:'/dev-calendar.html',area:'Planning'}),
  Object.freeze({name:'School',href:'/dev-school.html',area:'Planning'}),
  Object.freeze({name:'Work & Career',href:'/dev-work.html',area:'Planning'}),
  Object.freeze({name:'Personal Life',href:'/dev-personal.html',area:'Planning'}),
  Object.freeze({name:'Home & Household',href:'/dev-home.html',area:'Planning'}),
  Object.freeze({name:'Finances',href:'/dev-finances.html',area:'Planning'}),
  Object.freeze({name:'Universal Search',href:'/dev-search.html',area:'Find'}),
  Object.freeze({name:'My Account',href:'/dev-account.html',area:'Account'})
]);
export const ACCEPTANCE_STEPS=Object.freeze([
  Object.freeze({id:'routes',label:'All 11 workspace routes respond successfully (automated local check)'}),
  Object.freeze({id:'search',label:'Account A: Search finds records from at least two workspaces'}),
  Object.freeze({id:'navigation',label:'Open a Search result; destination workspace loads with its existing records'}),
  Object.freeze({id:'school',label:'School: Outline and Focus show the same completed subtask after refresh'}),
  Object.freeze({id:'finance',label:'Finances: saved task completion remains checked after refresh'}),
  Object.freeze({id:'settings',label:'My Account: an existing preference remains selected after refresh'}),
  Object.freeze({id:'isolation',label:'Account B: Search does not show Account A records; Account A data remains intact'})
]);
export function safeRouteStatus(response){return !!response && response.status===200 && response.ok===true;}
