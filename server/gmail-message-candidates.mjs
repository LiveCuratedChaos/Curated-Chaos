// Deterministic, local-only email labels. They are clues for owner review, never actions.
const rules=Object.freeze([
 ['Appointment',/\b(?:appointment|reservation|booking|check[- ]?in|visit|scheduled for)\b/i],
 ['Bill',/\b(?:bill|invoice|payment due|amount due|due date|statement ready)\b/i],
 ['Delivery',/\b(?:out for delivery|shipped|shipment|tracking number|delivery update|delivered)\b/i],
 ['Receipt',/\b(?:receipt|order confirmation|purchase confirmation|thanks for your order)\b/i],
 ['Application',/\b(?:job application|application received|interview invitation|interview scheduled|application status)\b/i]
]);

export function suggestGmailMessageCategories({subject='',text=''}={}){
 if(typeof subject!=='string'||subject.length>300||typeof text!=='string'||text.length>65536)throw Error('Email classification input could not be verified.');
 const head=subject.slice(0,300),body=text.slice(0,65536);
 return rules.flatMap(([category,pattern])=>pattern.test(head)?[{category,basis:'subject'}]:pattern.test(body)?[{category,basis:'message text'}]:[]);
}
