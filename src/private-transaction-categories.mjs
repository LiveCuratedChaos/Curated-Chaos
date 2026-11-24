import {manualExpense} from './private-manual-transactions.mjs';

// The immutable source supplies the sign, posting date and total. An allocation
// divides its magnitude across categories for either a debit or a credit.
export function transactionCategories(input,source){
 if(!source||!Number.isSafeInteger(source.amountMinor)||!input||Object.keys(input).some(k=>!['category','splits','receiptReference'].includes(k)))throw Error('Choose categories for a saved transaction.');
 const {category,splits,receiptReference}=manualExpense({...input,day:source.day,amountMinor:Math.abs(source.amountMinor)},source.day,source.day);
 return {category,...(splits?{splits}:{}),...(receiptReference?{receiptReference}:{})};
}
