// Profile choices for the signed-in workspace. The first option is the default.
export const TEXT_SIZES=Object.freeze({system:'System size',large:'Larger (125%)',largest:'Largest (150%)'});
export const MOTION_LEVELS=Object.freeze({system:'Follow Reduce Motion',full:'Full',subtle:'Subtle',minimal:'Minimal'});
const toggles=Object.freeze({off:'Off',on:'On'});
export const ACCESSIBLE_CONTROLS=Object.freeze({
 textSize:{label:'Text size',choices:TEXT_SIZES},
 motion:{label:'Motion',choices:MOTION_LEVELS},
 completionSound:{label:'Task completion sound',choices:toggles},
 completionHaptics:{label:'Task completion vibration',choices:toggles}
});
export const ACCESSIBLE_FIELDS=Object.freeze(Object.keys(ACCESSIBLE_CONTROLS));
export function accessibleAppearance(value){
 return Object.fromEntries(ACCESSIBLE_FIELDS.map(key=>{
  const {choices}=ACCESSIBLE_CONTROLS[key],choice=value?.[key];
  return [key,typeof choice==='string'&&Object.hasOwn(choices,choice)?choice:Object.keys(choices)[0]];
 }));
}
