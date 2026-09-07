import {describe,expect,it} from "vitest";
import {chooseRecording,formatTime} from "./audio";
import type {Song} from "./types";
const song:Song={id:"c:s",slug:"s",title:"Song",artworkUrl:null,artists:[],authors:[],composers:[],arrangers:[],tags:[],recordings:[
{id:"a",type:"AUDIO_ACCOMPANIMENT",label:"Accompaniment",url:"https://example.com/a.mp3",language:"eng"},
{id:"v",type:"AUDIO_VOCAL",label:"Vocal",url:"https://example.com/v.mp3",language:"eng"}]};
describe("chooseRecording",()=>{
it("prefers vocal",()=>expect(chooseRecording(song)?.id).toBe("v"));
it("honors preference",()=>expect(chooseRecording(song,"AUDIO_ACCOMPANIMENT")?.id).toBe("a"));
});
describe("formatTime",()=>it("formats safely",()=>{expect(formatTime(125.9)).toBe("2:05");expect(formatTime(NaN)).toBe("0:00")}));
