// Shared canonical choices used by the organizer and reviewed private task flows.
export const TASK_PRIORITIES=Object.freeze(['Low','Normal','High','Urgent']);
export function validateTaskPriority(value){if(typeof value!=='string'||!TASK_PRIORITIES.includes(value))throw Error('Choose Low, Normal, High or Urgent priority.');return value;}
export function taskPriority(value){return value===undefined||value===null||value===''?'Normal':validateTaskPriority(value);}

export function taskPriorityDisplay(value){try{return{priority:taskPriority(value)};}catch{return{priorityUnavailable:true};}}
