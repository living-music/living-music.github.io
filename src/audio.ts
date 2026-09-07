import type { Recording, Song } from "./types";
const PRIORITY=["AUDIO_VOCAL","AUDIO_VOCAL_YOUTH","AUDIO_VOCAL_CHILDREN","AUDIO_VOCAL_FAMILY","AUDIO_VOCAL_CONGREGATION","AUDIO_INSTRUMENTAL","AUDIO_ACCOMPANIMENT","AUDIO_ACCOMPANIMENT_GUITAR"];
export function chooseRecording(song:Song,preferredType?:string):Recording|undefined{
  if(preferredType){const match=song.recordings.find(item=>item.type===preferredType);if(match)return match}
  return [...song.recordings].sort((a,b)=>{
    const ai=PRIORITY.indexOf(a.type),bi=PRIORITY.indexOf(b.type);
    return (ai<0?Number.MAX_SAFE_INTEGER:ai)-(bi<0?Number.MAX_SAFE_INTEGER:bi);
  })[0];
}
export function formatTime(seconds:number):string{
  if(!Number.isFinite(seconds)||seconds<0)return "0:00";
  const whole=Math.floor(seconds);return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,"0")}`;
}
