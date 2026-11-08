// M2A: a single, honest source of truth for the developing workspace navigation.
// Every link is a relative, fixed app route. No input-derived external destinations.
export const WORKSPACE_PAGES=Object.freeze([
  Object.freeze({id:'curation',title:'The Curation',group:'featured',symbol:'▦',caption:'Your personal overview',next:'2B',description:'Your detailed overview of what matters across your day.'}),
  Object.freeze({id:'home',title:'Home',group:'chaos',symbol:'⌂',caption:'Household & daily life',next:'2H',description:'Cleaning, grocery lists, maintenance, deliveries, and household essentials.'}),
  Object.freeze({id:'calendar',title:'Calendar',group:'chaos',symbol:'▣',caption:'Your schedule',next:'2D',description:'A dedicated calendar workspace with month, week, and day views.'}),
  Object.freeze({id:'personal',title:'Personal Life',group:'chaos',symbol:'✧',caption:'Personal goals & projects',next:'2G',description:'Goals, selected projects, routines, lists, and personal notes.'}),
  Object.freeze({id:'work',title:'Work',group:'chaos',symbol:'▥',caption:'Work & career development',next:'2F',description:'Work tasks, schedules, projects, and professional development.'}),
  Object.freeze({id:'school',title:'School',group:'chaos',symbol:'▤',caption:'Courses & assessments',next:'2E',description:'Degree progress, WGU courses, study goals, and assessments.'}),
  Object.freeze({id:'finances',title:'Finances',group:'chaos',symbol:'◉',caption:'Financial organization',next:'2I',description:'Budget, bills, and financial organization with privacy controls.'}),
  Object.freeze({id:'account',title:'My Account',group:'account',symbol:'⚙',caption:'Settings & privacy',next:'2K',description:'Your individual settings, integrations, and household permissions.'}),
  Object.freeze({id:'more',title:'More',group:'mobile',symbol:'☰',caption:'Other spaces',next:'2A',description:'Browse all Curated Chaos spaces and development tools.'})
]);
export const QA_PAGES=Object.freeze([
  Object.freeze({id:'tasks',title:'Tasks',symbol:'☑',href:'/dev-tasks.html'}),
  Object.freeze({id:'notes',title:'Notes',symbol:'▤',href:'/dev-notes.html'}),
  Object.freeze({id:'agenda',title:'Seven-day agenda',symbol:'▣',href:'/dev-agenda.html'}),
  Object.freeze({id:'email',title:'Email insights',symbol:'✉',href:'/dev-email.html'}),
  Object.freeze({id:'life',title:'Life sources',symbol:'⌂',href:'/dev-life.html'}),
  Object.freeze({id:'settings',title:'Daily Brief Settings',symbol:'⚙',href:'/dev-settings.html'}),
  Object.freeze({id:'acceptance',title:'Milestone 1 acceptance',symbol:'✓',href:'/dev-acceptance.html'}),
  Object.freeze({id:'integration',title:'Milestone 2 integration',symbol:'✓',href:'/dev-integration.html'})
]);
export const MOBILE_TABS=Object.freeze([
  Object.freeze({id:'brief',title:'Daily Brief',symbol:'◈',href:'/dev-dashboard.html'}),
  Object.freeze({id:'curation',title:'The Curation',symbol:'▦',href:'/dev-workspace.html?page=curation'}),
  Object.freeze({id:'calendar',title:'Calendar',symbol:'▣',href:'/dev-calendar.html'}),
  Object.freeze({id:'home',title:'Home',symbol:'⌂',href:'/dev-workspace.html?page=home'}),
  Object.freeze({id:'more',title:'More',symbol:'☰',href:'/dev-workspace.html?page=more'})
]);
export function safeWorkspacePage(raw){return WORKSPACE_PAGES.some(p=>p.id===raw)?raw:'curation';}
export function workspaceHref(page){return safeWorkspacePage(page)==='calendar'?'/dev-calendar.html':safeWorkspacePage(page)==='school'?'/dev-school.html':safeWorkspacePage(page)==='work'?'/dev-work.html':safeWorkspacePage(page)==='personal'?'/dev-personal.html':safeWorkspacePage(page)==='home'?'/dev-home.html':safeWorkspacePage(page)==='finances'?'/dev-finances.html':safeWorkspacePage(page)==='search'?'/dev-search.html':safeWorkspacePage(page)==='account'?'/dev-account.html':`/dev-workspace.html?page=${safeWorkspacePage(page)}`;}
export function workspacePage(page){return WORKSPACE_PAGES.find(p=>p.id===safeWorkspacePage(page));}

// M3C: safe, account-scoped navigation customization. Core pages remain accessible via direct URLs.
export const CUSTOM_NAV_IDS=Object.freeze(WORKSPACE_PAGES.filter(p=>p.group==='chaos').map(p=>p.id));
export function normalizeNavigation(value){
 const data=value&&typeof value==='object'?value:{};
 const order=Array.isArray(data.order)?data.order:[];
 const hidden=Array.isArray(data.hidden)?data.hidden:[];
 const normalizedOrder=[...new Set(order.filter(id=>CUSTOM_NAV_IDS.includes(id)))];
 for(const id of CUSTOM_NAV_IDS)if(!normalizedOrder.includes(id))normalizedOrder.push(id);
 return {order:normalizedOrder,hidden:[...new Set(hidden.filter(id=>CUSTOM_NAV_IDS.includes(id)))]};
}
export function navigationPages(value){const nav=normalizeNavigation(value);return nav.order.filter(id=>!nav.hidden.includes(id)).map(id=>WORKSPACE_PAGES.find(p=>p.id===id));}
