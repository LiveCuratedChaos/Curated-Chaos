const CAREER_KINDS=Object.freeze(['application','goal']);
const keys='certifications,employer,kind,role,skills,stage,targetCompensation';
const text=(value,max,label,{required=false}={})=>{
 if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw Error('Use valid '+label+'.');
 const result=value.trim();if(required&&!result)throw Error('Enter '+label+'.');return result;
};
const entries=(value,max,label)=>{
 if(!Array.isArray(value)||value.length>30)throw Error('Use up to 30 '+label+'.');
 const result=value.map(item=>text(item,80,label,{required:true}));
 if(new Set(result.map(item=>item.normalize('NFKC').toLocaleLowerCase('en-US'))).size!==result.length)throw Error('Remove duplicate '+label+'.');
 return result;
};

// Optional nested metadata stays on its canonical private Work project record.
// A free-text stage lets the owner tailor their own application pipeline.
export function privateCareerFields(value,{requireCanonical=false}={}){
 if(value===undefined||value===null)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys||!CAREER_KINDS.includes(value.kind))throw Error('Career details could not be verified.');
 const result={kind:value.kind,employer:text(value.employer,120,'employer'),role:text(value.role,120,'role',{required:true}),stage:text(value.stage,48,'application stage'),targetCompensation:text(value.targetCompensation,80,'target compensation'),skills:entries(value.skills,30,'skills'),certifications:entries(value.certifications,30,'certifications')};
 if(value.kind==='application'&&(!result.employer||!result.stage))throw Error('Enter an employer and application stage.');
 if(value.kind==='goal'&&(result.employer||result.stage))throw Error('Career goals do not have an employer or application stage.');
 if(requireCanonical&&['employer','role','stage','targetCompensation'].some(key=>value[key]!==result[key])||requireCanonical&&['skills','certifications'].some(key=>value[key].some((item,index)=>item!==result[key][index])))throw Error('Saved career details are not canonical.');
 return result;
}
