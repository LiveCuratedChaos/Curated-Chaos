// Date-only UTC arithmetic avoids daylight-saving and device timezone drift.
const dayMilliseconds=86400000,minimum=Date.parse('2000-01-01T00:00:00Z'),maximum=Date.parse('2100-12-31T00:00:00Z');
const dateString=value=>new Date(value).toISOString().slice(0,10);
export function briefDateRange(anchor,{range,weekStart}={}){
 const invalid=()=>{throw Error('Choose a supported Brief date, range and week start.');};
 if(typeof anchor!=='string'||!/^(?:20\d\d|2100)-\d\d-\d\d$/.test(anchor)||!['rolling','calendar'].includes(range)||!Number.isInteger(weekStart)||weekStart<0||weekStart>6)invalid();
 const timestamp=Date.parse(anchor+'T00:00:00Z');if(!Number.isFinite(timestamp)||dateString(timestamp)!==anchor||timestamp<minimum||timestamp>maximum)invalid();
 const start=range==='rolling'?timestamp:timestamp-((new Date(timestamp).getUTCDay()-weekStart+7)%7)*dayMilliseconds,end=start+6*dayMilliseconds;
 const from=Math.max(start,minimum),to=Math.min(end,maximum),days=[];
 for(let cursor=from;cursor<=to;cursor+=dayMilliseconds)days.push(dateString(cursor));
 return{anchor,range,weekStart,from:days[0],to:days.at(-1),days,clipped:from!==start||to!==end};
}
