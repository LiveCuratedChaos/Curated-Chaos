const dayPattern=/^(?:20\d\d|2100)-\d\d-\d\d$/;
const validDay=value=>typeof value==='string'&&dayPattern.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const minute=value=>{const match=/^(\d{2}):(\d{2})$/.exec(value||'');if(!match||Number(match[1])>23||Number(match[2])>59)throw Error('Use valid 24-hour times.');return Number(match[1])*60+Number(match[2]);};
export function parseStudyAvailability(value,{maxWindows=20,notBefore=''}={}){
 if(typeof value!=='string'||value.length>1200)throw Error('Enter up to 20 available time windows.');
 const lines=value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);if(lines.length>maxWindows)throw Error('Enter up to 20 available time windows.');
 const windows=lines.map(line=>{const match=/^(20\d\d|2100)-(\d\d)-(\d\d)\s+((?:[01]\d|2[0-3]):[0-5]\d)\s*-\s*((?:[01]\d|2[0-3]):[0-5]\d)$/.exec(line);if(!match)throw Error('Use one date and a start-end time per line, for example 2026-11-23 18:00-20:00.');const day=`${match[1]}-${match[2]}-${match[3]}`;if(!validDay(day)||notBefore&&day<notBefore)throw Error('Choose a valid available date today or later.');const start=match[4],end=match[5];if(minute(end)<=minute(start))throw Error('Each available window must end after it starts on the same date.');return{day,start,end,startMinute:minute(start),endMinute:minute(end)};});
 if(new Set(windows.map(window=>`${window.day}:${window.start}:${window.end}`)).size!==windows.length)throw Error('Remove duplicate available windows.');
 windows.sort((a,b)=>a.day.localeCompare(b.day)||a.startMinute-b.startMinute);for(let i=1;i<windows.length;i++)if(windows[i].day===windows[i-1].day&&windows[i].startMinute<windows[i-1].endMinute)throw Error('Available windows must not overlap.');return windows;
}
export function proposeSchoolStudyTimes({courses,availability,sessionMinutes=45,notBefore=''}){
 if(!Array.isArray(courses)||courses.length>2000||!Number.isInteger(sessionMinutes)||![25,30,45,60,90].includes(sessionMinutes))throw Error('Supported School courses and a session length are required.');
 const windows=parseStudyAvailability(availability,{notBefore}),eligible=courses.filter(course=>course.status!=='Completed').filter(course=>typeof course.title==='string'&&course.title.trim()&&(!course.targetDate||validDay(course.targetDate))).sort((a,b)=>{const ad=a.targetDate||'9999-12-31',bd=b.targetDate||'9999-12-31';return ad.localeCompare(bd)||(a.studyOrder??999)-(b.studyOrder??999)||(a.officialOrder??999)-(b.officialOrder??999)||a.title.localeCompare(b.title);});
 if(!eligible.length||!windows.length)return[];
 const proposals=[];for(const window of windows){if(proposals.length>=eligible.length||proposals.length>=20)break;if(window.endMinute-window.startMinute<sessionMinutes)continue;const course=eligible[proposals.length],endMinute=window.startMinute+sessionMinutes,clock=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;proposals.push({...(course.schoolReadToken?{schoolReadToken:course.schoolReadToken}:{}),title:course.title,programTitle:course.programTitle||'Saved School',day:window.day,start:window.start,end:clock(endMinute),targetDate:course.targetDate||'',studyOrder:course.studyOrder,officialOrder:course.officialOrder});}
 return proposals;
}
