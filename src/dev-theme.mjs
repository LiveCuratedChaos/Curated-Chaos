// M3A: global, owner-scoped saved theme for fictional development workspaces.
// Palette preview is temporary. Only an authenticated, verified session loads
// private Supabase preferences; neither saved records nor account IDs are cached.
import {readOwnerBriefPreferences} from './dev-preferences-model.mjs';
import {navigationPages} from './dev-navigation-model.mjs';
export const QA_PALETTES=Object.freeze(['neutral','luxury','blush','coastal','earthy','executive','academia']);
export function allowedPreviewPalette(value){return QA_PALETTES.includes(value)?value:'neutral';}
export const SAFE_DENSITIES=Object.freeze(['compact','balanced','spacious']);
export function applyAppearance(body,prefs){
  const palette=allowedPreviewPalette(prefs?.palette);
  const density=SAFE_DENSITIES.includes(prefs?.density)?prefs.density:'balanced';
  if(body?.dataset){body.dataset.theme=palette;body.dataset.density=density;}
  return {palette,density};
}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
  let sequence=0,owner=null,preview=false;
  window.__ccNavigationPrefs=null;
  applyAppearance(document.body,null); // Never show a previous user's theme before verification.
  window.addEventListener('cc-dev-session',async event=>{
    const current=++sequence;preview=false;
    const detail=event.detail;
    owner=detail?.ownerId||null;
    applyAppearance(document.body,null);window.__ccNavigationPrefs=null;
    if(!owner||typeof detail?.readPreferences!=='function')return;
    try{
      const rows=await detail.readPreferences();
      if(current!==sequence||owner!==detail.ownerId||preview)return;
      const preferences=readOwnerBriefPreferences(rows,owner).preferences;
      applyAppearance(document.body,preferences);window.__ccNavigationPrefs=preferences.navigation;
      const chaosNav=document.querySelector('#chaos-nav-label');
      if(chaosNav){let cursor=chaosNav;for(const page of navigationPages(preferences.navigation)){
        const anchor=Array.from(document.querySelectorAll('nav[aria-label="Main navigation"] a.nav-link')).find(a=>a.getAttribute('href')===({calendar:'/dev-calendar.html',school:'/dev-school.html',work:'/dev-work.html',personal:'/dev-personal.html',home:'/dev-home.html',finances:'/dev-finances.html'}[page.id]));
        if(anchor){cursor.after(anchor);cursor=anchor;}
      }
      for(const page of navigationPages({order:[],hidden:preferences.navigation.hidden}).filter(p=>preferences.navigation.hidden.includes(p.id))){}
      document.querySelectorAll('nav[aria-label="Main navigation"] a.nav-link').forEach(a=>{const hidden=preferences.navigation.hidden.some(id=>a.getAttribute('href')===({calendar:'/dev-calendar.html',school:'/dev-school.html',work:'/dev-work.html',personal:'/dev-personal.html',home:'/dev-home.html',finances:'/dev-finances.html'}[id]));if(hidden)a.remove();});
      }
      // Rerender any shared palette-select control to show the loaded value.
      const menu=document.getElementById('cc-preview-palette');
      if(menu)menu.value=document.body.dataset.theme;
    }catch{if(current===sequence&&!preview)applyAppearance(document.body,null);}
  });
  document.addEventListener('change',event=>{
    if(event.target?.id!=='cc-preview-palette')return;
    preview=true;applyAppearance(document.body,{palette:event.target.value,density:document.body.dataset.density});
    // A palette preview never changes private saved account preferences.
  });
}
