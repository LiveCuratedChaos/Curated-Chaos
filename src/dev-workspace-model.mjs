// M2A: read-only views of previously verified fictional cloud records.
// No new write operations or genuine WGU, banking, email, calendar connections.
import { escapeHtml as e } from './core.mjs';
import { WORKSPACE_PAGES, QA_PAGES, safeWorkspacePage, workspaceHref, workspacePage } from './dev-navigation-model.mjs';
export const ALLOWED_DEV_DESTINATIONS=Object.freeze(['/dev-dashboard.html','/dev-organize.html',...QA_PAGES.map(x=>x.href)]);
const titleRow=(s)=>`<li class="cc-work-item"><strong>${e(s.title)}</strong><small>${e(s.subtitle||'Fictional test record')}</small></li>`;
const asRows=(rows,limit=5)=>Array.isArray(rows)?rows.slice(0,limit).map(r=>({title:String(r.payload?.title||'Untitled'),subtitle:[r.payload?.day, r.payload?.time].filter(Boolean).join(' · ')})):[];
function card(title,desc,link,linkLabel='Open existing QA workspace'){
  if(!ALLOWED_DEV_DESTINATIONS.includes(link))throw Error('Unapproved destination');
  return `<section class="cc-work-card"><div class="cc-card-heading"><h2>${e(title)}</h2><span class="pill">M1 connected</span></div><p class="muted">${e(desc)}</p><a class="cc-work-action" href="${link}">${e(linkLabel)} →</a></section>`;
}
function recordsCard(title,rows,link,empty='No saved fictional records in this area yet.'){
  if(!ALLOWED_DEV_DESTINATIONS.includes(link))throw Error('Unapproved destination');
  return `<section class="cc-work-card"><div class="cc-card-heading"><h2>${e(title)}</h2><span class="pill">${rows.length} saved</span></div>${rows.length?`<ul class="cc-work-list">${rows.map(titleRow).join('')}</ul>`:`<p class="empty">${e(empty)}</p>`}<a class="cc-work-action" href="${link}">Open existing QA workspace →</a></section>`;
}
export function workspaceCards(page,snapshot){
  page=safeWorkspacePage(page);
  const tasks=snapshot?.tasks||[],notes=snapshot?.notes||[],events=snapshot?.events||[],emails=snapshot?.emails||[],life=snapshot?.life||[];
  const tasksFor=section=>tasks.filter(r=>r.section===section);
  const lifeFor=type=>life.filter(r=>r.item_type===type);
  const many=x=>asRows(x);
  if(page==='curation'){
    return `<div class="cc-work-metrics"><div><strong>${tasks.length}</strong><span>Private test tasks</span></div><div><strong>${events.length}</strong><span>Fictional events</span></div><div><strong>${life.length}</strong><span>Saved life sources</span></div><div><strong>${emails.length}</strong><span>Fictional emails</span></div></div><div class="cc-work-grid">${card('A Glimpse of Your Day','Your working intelligent Daily Brief from Milestone 1.','/dev-dashboard.html','Open Daily Brief')}${recordsCard('Upcoming & saved tasks',many(tasks),'/dev-tasks.html')}${recordsCard('Schedule',many(events),'/dev-agenda.html')}${recordsCard('School reminders',many(lifeFor('school_fixture')),'/dev-life.html')}${recordsCard('Finances · saved bills',many(lifeFor('bill_fixture')),'/dev-life.html')}${recordsCard('Household reminders',many(lifeFor('household_fixture')),'/dev-life.html')}${recordsCard('My notes',many(notes),'/dev-notes.html')}${card('Tasks & Projects','Create or edit fictional tasks, priorities, statuses, subtasks and projects in M2C.','/dev-organize.html','Open Tasks & Projects')}</div>`;
  }
  if(page==='home')return `<div class="cc-work-grid">${recordsCard('Household reminders',many(lifeFor('household_fixture')),'/dev-life.html')}${recordsCard('Home tasks',many(tasksFor('Home')),'/dev-tasks.html')}${card('Tasks & Projects','Open the new 2C organizer to manage household projects and tasks.','/dev-organize.html','Manage tasks & projects')}${card('Home management','Cleaning schedules, grocery lists, deliveries and household hubs are scheduled for 2H.','/dev-life.html','Open current household samples')}</div>`;
  if(page==='calendar')return `<div class="cc-work-grid">${recordsCard('Saved calendar events',many(events,10),'/dev-agenda.html')}${card('Seven-day agenda','Your existing verified fictional cloud calendar and task agenda still works. Month and week views arrive in 2D.','/dev-agenda.html','Open seven-day agenda')}</div>`;
  if(page==='personal')return `<div class="cc-work-grid">${recordsCard('Personal tasks',many(tasksFor('Personal Life')),'/dev-tasks.html')}${recordsCard('My notes',many(notes),'/dev-notes.html')}${card('Tasks & Projects','Fictional personal projects, priorities and subtasks are available in 2C.','/dev-organize.html','Manage tasks & projects')}${card('Goals & selected projects','Personal goals, progress tracking, and projects are planned for 2G.','/dev-tasks.html','Open existing tasks')}</div>`;
  if(page==='work')return `<div class="cc-work-grid">${recordsCard('Work tasks',many(tasksFor('Work')),'/dev-tasks.html')}${card('Tasks & Projects','Use fictional records only; no employer cases or confidential data.','/dev-organize.html','Manage tasks & projects')}${card('Work organization','Work shifts, career development and applications will be added in 2F. Do not enter confidential workplace case records into the fictional test app.','/dev-tasks.html','Open existing work tasks')}</div>`;
  if(page==='school')return `<div class="cc-work-grid">${recordsCard('Saved fictional school reminders',many(lifeFor('school_fixture')),'/dev-life.html')}${recordsCard('School tasks',many(tasksFor('School')),'/dev-tasks.html')}${card('Tasks & Projects','Link fictional study tasks to a project. Real WGU progress arrives in 2E.','/dev-organize.html','Manage tasks & projects')}${card('Degree and course tracker','Official WGU course order and a separate accelerated study plan are planned for 2E. No WGU account is connected.','/dev-life.html','Open current school samples')}</div>`;
  if(page==='finances')return `<div class="cc-work-grid">${recordsCard('Saved fictional bills',many(lifeFor('bill_fixture')),'/dev-life.html')}${card('Financial privacy','Amounts remain hidden on this navigation preview. Detailed budgeting, transaction views, and investments are scheduled for 2I; no bank or brokerage data is connected.','/dev-settings.html','Open privacy settings')}</div>`;
  if(page==='account')return `<div class="cc-work-grid">${card('Personal settings','Your existing account-specific Daily Brief preferences, themes and suggestion controls.','/dev-settings.html','Open Daily Brief Settings')}${card('Milestone 1 acceptance','Review the seven acceptance checks completed with Test Accounts A and B.','/dev-acceptance.html','Open acceptance checklist')}${card('Account privacy','Data stays private to the signed-in fictional test account; household permissions and invitations arrive in 2K.','/dev-dashboard.html','Return to Daily Brief')}</div>`;
  if(page==='more'){
    return `<div class="cc-work-grid">${WORKSPACE_PAGES.filter(x=>x.group!=='mobile').map(p=>`<a class="cc-more-link" href="${workspaceHref(p.id)}"><span aria-hidden="true">${p.symbol}</span><strong>${e(p.title)}</strong><small>${e(p.caption)}</small></a>`).join('')}</div><h2 class="cc-more-heading">Development tools</h2><div class="cc-work-grid">${QA_PAGES.map(p=>`<a class="cc-more-link" href="${p.href}"><span aria-hidden="true">${p.symbol}</span><strong>${e(p.title)}</strong><small>Fictional cloud QA</small></a>`).join('')}</div>`;
  }
  throw Error('Unknown workspace page');
}
export function workspaceHeading(page){return workspacePage(page);}
