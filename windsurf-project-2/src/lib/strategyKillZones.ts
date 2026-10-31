export type KillZone = "Asian" | "London" | "New York" | "Outside";
export const ZONES: Exclude<KillZone,"Outside">[] = ["Asian","London","New York"];
const fmt = (timeZone:string) => new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
function parts(date:Date,timeZone:string){return Object.fromEntries(fmt(timeZone).formatToParts(date).filter(x=>x.type!=="literal").map(x=>[x.type,Number(x.value)])) as Record<string,number>}
export function moroccoToUtc(date:string,time:string):Date|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;
 const [y,m,d]=date.split("-").map(Number),[h,min]=time.split(":").map(Number);
 if(h>23||min>59||m<1||m>12||d<1||d>31)return null;
 const desired=Date.UTC(y,m-1,d,h,min);let utc=desired;
 for(let i=0;i<4;i++){const p=parts(new Date(utc),"Africa/Casablanca");const actual=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);utc+=desired-actual;}
 const check=parts(new Date(utc),"Africa/Casablanca");return check.year===y&&check.month===m&&check.day===d&&check.hour===h&&check.minute===min?new Date(utc):null;
}
export function getKillZone(instant:Date):KillZone{
 const p=parts(instant,"America/New_York");const minutes=p.hour*60+p.minute;
 if(minutes>=20*60)return "Asian";
 if(minutes>=2*60&&minutes<5*60)return "London";
 if(minutes>=7*60&&minutes<10*60)return "New York";
 return "Outside";
}
export function localZoneWindow(date:string,zone:Exclude<KillZone,"Outside">){
 const [y,m,d]=date.split("-").map(Number);const hours=zone==="Asian"?[20,0]:zone==="London"?[2,5]:[7,10];
 // Use New York wall time as the canonical reference; resolve both ends across DST transitions.
 const startDay=zone==="Asian"?new Date(Date.UTC(y,m-1,d-1)):new Date(Date.UTC(y,m-1,d));
 const endDay=new Date(Date.UTC(y,m-1,d));
 function resolve(day:Date,hour:number){const target=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate(),hour);let ms=target;for(let i=0;i<4;i++){const p=parts(new Date(ms),"America/New_York");ms+=target-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)}return new Date(ms)}
 const a=resolve(startDay,hours[0]),b=resolve(endDay,hours[1]);
 const format=new Intl.DateTimeFormat("fr-FR",{timeZone:"Africa/Casablanca",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
 return `${format.format(a)}–${format.format(b)}`;
}
