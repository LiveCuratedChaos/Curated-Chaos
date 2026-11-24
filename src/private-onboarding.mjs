export const SETUP_DOMAINS=Object.freeze({
 personal:{label:'Personal Life',area:'Personal Life',page:'/dev-personal.html'},
 home:{label:'Home & Household',area:'Home',page:'/dev-home.html'},
 work:{label:'Work & Career',area:'Work',page:'/dev-work.html'},
 school:{label:'School & Learning',area:'School',page:'/dev-school.html'},
 finances:{label:'Finances',area:'Finances',page:'/dev-finances.html'}
});
export const SETUP_PRIORITIES=Object.freeze({
 routines:['personal','Keep up with routines','tasks'],personalProjects:['personal','Move personal projects forward','projects'],
 chores:['home','Keep up with household tasks','tasks'],homeProjects:['home','Plan home projects','projects'],
 workTasks:['work','Stay on top of work tasks','tasks'],workProjects:['work','Move work projects forward','projects'],
 courses:['school','Plan coursework and assessments','courses'],degree:['school','Track degree progress','degree_progress'],
 bills:['finances','Keep up with bills','bills'],budget:['finances','Follow my budget','budget']
});
export const SETUP_PALETTES=Object.freeze({neutral:'Classic Minimal',luxury:'Timeless Luxury',blush:'Blush Pink',coastal:'Coastal Blue',earthy:'Earthy Green',executive:'Modern Executive'});
export const defaultOnboarding=()=>({version:1,status:'new',mode:'',step:'areas',domains:[],priorities:[],widgets:[]});
const distinct=(values,limit,allowed)=>Array.isArray(values)&&values.length<=limit&&new Set(values).size===values.length&&values.every(x=>typeof x==='string'&&allowed(x));
export function validateOnboarding(value){
 const hasPalette=Object.hasOwn(value??{},'palette');
 const exact=['domains','mode',...(hasPalette?['palette']:[]),'priorities','status','step','version','widgets'].join(',');
 if(!value||hasPalette&&(typeof value.palette!=='string'||!Object.hasOwn(SETUP_PALETTES,value.palette)||value.status==='new'||!value.mode)||Object.keys(value).sort().join(',')!==exact||value.version!==1||!['new','paused','complete'].includes(value.status)||!['','quick','guided'].includes(value.mode)||!['areas','priorities','widgets','review'].includes(value.step))throw Error('Choose a supported setup step.');
 const {domains,priorities,widgets}=value;
 if(!distinct(domains,5,id=>Object.hasOwn(SETUP_DOMAINS,id))||!distinct(priorities,3,id=>Object.hasOwn(SETUP_PRIORITIES,id)&&domains.includes(SETUP_PRIORITIES[id][0]))||!distinct(widgets,10,id=>Object.hasOwn(SETUP_PRIORITIES,id)&&domains.includes(SETUP_PRIORITIES[id][0])))throw Error('Choose up to three priorities for your selected areas.');
 if((!value.mode||value.status==='new')&&(value.step!=='areas'||domains.length||priorities.length||widgets.length)||value.status==='new'&&value.mode||value.step!=='areas'&&!domains.length||['widgets','review'].includes(value.step)&&!priorities.length||value.mode==='quick'&&value.step==='widgets'||value.status==='complete'&&(value.step!=='review'||!value.mode))throw Error('Finish choosing your areas and priorities.');
 return{version:1,status:value.status,mode:value.mode,step:value.step,domains:[...domains],priorities:[...priorities],widgets:[...widgets],...(hasPalette?{palette:value.palette}:{})};
}
export function onboardingSuggestions(value){
 const {domains,priorities}=value;
 return [...new Set([...priorities,...domains.filter(id=>!priorities.some(p=>SETUP_PRIORITIES[p][0]===id)).map(id=>Object.keys(SETUP_PRIORITIES).find(key=>SETUP_PRIORITIES[key][0]===id))])];
}
export function onboardingWidgetLayouts(value){
 const setup=validateOnboarding(value);
 if(setup.status!=='complete')return null;
 return Object.fromEntries(['desktop','tablet','phone'].map(device=>[device,setup.widgets.map(id=>{
  const [domain,,type]=SETUP_PRIORITIES[id];
  return{id:'setup-'+device+'-'+id.toLowerCase(),type,width:device==='desktop'?'half':'full',hidden:false,filter:['tasks','projects'].includes(type)?SETUP_DOMAINS[domain].area:'all',...(['tasks','projects'].includes(type)?{title:SETUP_DOMAINS[domain].area+' '+type}:{})};
 })]));
}
