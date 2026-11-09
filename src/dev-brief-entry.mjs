// Select the transport before loading a controller. Cookie mode never loads legacy session code.
export async function startDailyBrief({fetcher=fetch,load=path=>import(path),root=document.getElementById('connected-brief')}={}){
 try{const response=await fetcher('/dev-config.json',{cache:'no-store'});if(!response.ok)throw Error();const config=await response.json();if(config.privateWorkspaceReadOnly===true||config.privateWorkspaceCookie===true){const module=await load('./dev-private-brief.mjs');return module.mountPrivateBrief(root,{allowTaskCompletion:config.privateTaskCompletion===true,allowNoteRead:config.privateNoteRead===true,allowNoteEdit:config.privateNoteEdit===true,allowTaskCreate:config.privateTaskCreate===true,allowTaskEdit:config.privateTaskEdit===true,allowNoteCreate:config.privateNoteCreate===true,allowSearch:config.privateTitleSearch===true,allowAppearance:config.privateAppearanceRead===true,allowAppearanceSave:config.privateAppearanceSave===true});}await load('./dev-brief.mjs');}
 catch{root.textContent='The development Daily Brief could not start. Reload this page to try again.';}
}
if(typeof document!=='undefined')void startDailyBrief();
