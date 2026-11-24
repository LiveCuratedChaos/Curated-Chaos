// Bounded optional grocery quantity/favorite metadata for canonical private Home tasks.
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
export function normalizeHomeGrocery(value){if(!exact(value,['favorite','quantity'])||typeof value.favorite!=='boolean'||typeof value.quantity!=='string'||value.quantity!==value.quantity.trim()||value.quantity.length>40||/[\u0000-\u001f\u007f]/.test(value.quantity))throw Error('Enter a quantity of up to 40 characters and a valid favorite selection.');return{quantity:value.quantity,favorite:value.favorite};}
export function readHomeGrocery(value){try{return normalizeHomeGrocery(value)}catch{return null}}
