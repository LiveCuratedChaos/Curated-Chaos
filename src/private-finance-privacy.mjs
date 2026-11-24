// The device marker contains only the concealment choice, never an account or a value.
const marker='curated-chaos.finance-concealed';
export function createFinancePrivacy(host,onChange){
 let hidden=false;
 try{hidden=host.localStorage?.getItem(marker)==='1';}catch{}
 function apply(value){
  if(hidden===value)return;
  hidden=value;
  onChange();
 }
 function conceal(){
  try{host.localStorage?.setItem(marker,'1');}catch{}
  apply(true);
 }
 function resume(){
  try{host.localStorage?.removeItem(marker);}catch{}
  apply(false);
 }
 // A reveal in one window must never reveal another window's open review.
 function storage(event){if(event.key===marker&&event.newValue==='1')apply(true);}
 host.addEventListener('storage',storage);
 return {get hidden(){return hidden;},conceal,resume,peerConceal:()=>apply(true),
  dispose:()=>host.removeEventListener('storage',storage)};
}
