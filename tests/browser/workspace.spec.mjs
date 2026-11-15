import {test,expect} from '@playwright/test';
const origin='http://127.0.0.1:5316';
test.beforeEach(async({context,page})=>{
 const external=[];test.info()._externalAttempts=external;expect((await context.request.post('/__test/reset',{headers:{'X-CC-Fictional-Test':'reset-in-memory-only'}})).status()).toBe(204);await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();external.push(u.origin);return route.abort();});
 page.on('pageerror',error=>{throw error;});
 await page.goto('/dev-dashboard.html');await page.getByRole('textbox',{name:'Email',exact:true}).fill('demo@example.test');await page.getByRole('textbox',{name:'Password',exact:true}).fill('fictional-only');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeVisible();
 test.info()._externalAttempts=external;
});
test.afterEach(async({page})=>{if(await page.getByRole('button',{name:'Sign out',exact:true}).count()){await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();}expect(test.info()._externalAttempts).toEqual([]);});
test('sign-out clears private views and a narrow screen has no horizontal overflow',async({page})=>{
 await expect(page.getByText('Fictional plan for today',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByText('Fictional plan for today',{exact:true})).toHaveCount(0);
 const response=await page.request.get('/auth/workspace/brief');expect([401,403]).toContain(response.status());
});
test('task creation needs review and approval, then completion needs another review',async({page},info)=>{
 const title='Fictional browser task '+info.project.name;let saves=0;page.on('request',r=>{if(r.url().endsWith('/tasks/create-save'))saves++;});
 await page.locator('#private-task-new').click();await page.locator('[name="create-title"]').fill(title);await page.locator('[name="create-day"]').fill('');await page.locator('[name="create-description"]').fill('Fictional browser description');await page.locator('[name="create-subtaskText"]').fill('Fictional first step\nFictional second step');
 await page.getByRole('button',{name:'Review new task',exact:true}).click();await expect(page.getByRole('heading',{name:'Create this private task?',exact:true})).toBeVisible();expect(saves).toBe(0);
 await page.getByRole('button',{name:'Approve task creation',exact:true}).click();await expect(page.locator('#private-task-create-form')).toHaveCount(0);expect(saves).toBe(1);
 await page.goto('/dev-tasks.html');const row=page.locator('li').filter({has:page.getByText(title,{exact:true})});await expect(row).toHaveCount(1);await row.getByRole('button',{name:'Review completion',exact:true}).click();await expect(page.getByRole('button',{name:'Approve completion',exact:true})).toBeVisible();await page.getByRole('button',{name:'Approve completion',exact:true}).click();await expect(page.getByRole('button',{name:'Approve completion',exact:true})).toHaveCount(0);
});
test('note creation preserves literal markup and multiline text after approval',async({page},info)=>{
 const title='Fictional browser note '+info.project.name,body='Fictional line one\n<script>window.fixtureScriptRan=true</script>\nFictional line three';let saves=0;page.on('request',r=>{if(r.url().endsWith('/notes/create-save'))saves++;});
 await page.locator('#private-note-new').click();await page.getByLabel('Note title',{exact:true}).fill(title);await page.getByLabel('Note text',{exact:true}).fill(body);await page.getByRole('button',{name:'Review new note',exact:true}).click();await expect(page.getByLabel('Reviewed note text')).toContainText('<script>');expect(saves).toBe(0);await page.getByRole('button',{name:'Approve note creation',exact:true}).click();await expect(page.locator('#private-note-editor')).toHaveCount(0);expect(saves).toBe(1);expect(await page.evaluate(()=>typeof window.fixtureScriptRan)).toBe('undefined');
 await page.goto('/dev-notes.html');await expect(page.getByText(title,{exact:true})).toBeVisible();
});
test('all-day calendar event is reviewed before being saved',async({page},info)=>{
 const title='Fictional browser event '+info.project.name;let saves=0;page.on('request',r=>{if(r.url().endsWith('/events/create-save'))saves++;});
 await page.locator('#private-event-new').click();await page.locator('[name="create-title"]').fill(title);await page.locator('[name="create-all_day"]').check();await page.getByRole('button',{name:'Review event creation',exact:true}).click();await expect(page.getByRole('heading',{name:'Create this workspace event?',exact:true})).toBeVisible();expect(saves).toBe(0);await page.getByRole('button',{name:'Approve event creation',exact:true}).click();await expect(page.locator('#private-task-create-form')).toHaveCount(0);expect(saves).toBe(1);await expect(page.getByText(title,{exact:true})).toBeVisible();
});
test('saved source panels read only when manually opened and clear on hide',async({page})=>{
 const reads=[];page.on('request',r=>{if(/\/auth\/workspace\/(saved-mail|saved-finance-accounts|saved-finance-transactions)$/.test(r.url()))reads.push(new URL(r.url()).pathname);});
 expect(reads).toEqual([]);await page.getByRole('button',{name:'View saved transactions',exact:true}).click();await expect(page.getByText('No saved copies on this page.',{exact:true})).toBeVisible();expect(reads).toEqual(['/auth/workspace/saved-finance-transactions']);await page.getByRole('button',{name:'Hide saved transactions',exact:true}).click();await expect(page.getByText('Saved transactions have not been opened.',{exact:true})).toBeVisible();
});
