import type { JSX } from "preact";
export type IconName="home"|"browse"|"search"|"heart"|"play"|"pause"|"previous"|"next"|"queue"|"close"|"chevron"|"music"|"back"|"more"|"up"|"down"|"repeat"|"trash"|"video"|"add"|"check"|"shuffle"|"download"|"settings";
const paths:Record<IconName,JSX.Element>={
home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9.5 20v-6h5v6"/></>,
browse:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>,
heart:<path d="M20.5 9c0 5.5-8.5 10.5-8.5 10.5S3.5 14.5 3.5 9A4.5 4.5 0 0 1 12 6.9 4.5 4.5 0 0 1 20.5 9Z"/>,
play:<path d="m8 5 11 7-11 7Z"/>,pause:<><path d="M8 5v14M16 5v14"/></>,
previous:<><path d="M6 5v14M19 6l-9 6 9 6Z"/></>,next:<><path d="M18 5v14M5 6l9 6-9 6Z"/></>,
queue:<><path d="M4 6h11M4 12h11M4 18h7"/><path d="m17 15 4 3-4 3Z"/></>,
close:<path d="m6 6 12 12M18 6 6 18"/>,chevron:<path d="m9 5 7 7-7 7"/>,
music:<><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></>,
back:<path d="m15 5-7 7 7 7"/>,
more:<><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>,
up:<path d="m6 15 6-6 6 6"/>,down:<path d="m6 9 6 6 6-6"/>,
repeat:<><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></>,
trash:<><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
video:<><rect x="3" y="5" width="14" height="14" rx="3"/><path d="m17 10 4-2v8l-4-2Z"/></>,
add:<path d="M12 5v14M5 12h14"/>,
check:<path d="m5 12 4.5 4.5L19 7"/>,
shuffle:<><path d="M4 7h3c4 0 6 10 10 10h3"/><path d="m17 14 3 3-3 3"/><path d="M4 17h3c1.7 0 3-1.8 4.2-3.9M13.2 8.9C14.4 7.8 15.6 7 17 7h3"/><path d="m17 4 3 3-3 3"/></>,
download:<><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 20h14"/></>,
settings:<><path d="M9.67 4.14a2.34 2.34 0 0 1 4.66 0 2.34 2.34 0 0 0 3.32 1.91 2.34 2.34 0 0 1 2.33 4.03 2.34 2.34 0 0 0 0 3.84 2.34 2.34 0 0 1-2.33 4.03 2.34 2.34 0 0 0-3.32 1.91 2.34 2.34 0 0 1-4.66 0 2.34 2.34 0 0 0-3.32-1.91 2.34 2.34 0 0 1-2.33-4.03 2.34 2.34 0 0 0 0-3.84 2.34 2.34 0 0 1 2.33-4.03 2.34 2.34 0 0 0 3.32-1.91Z"/><circle cx="12" cy="12" r="3"/></>
};
export function Icon({name,filled=false,size=22}:{name:IconName;filled?:boolean;size?:number}){
return <svg aria-hidden="true" class="icon" width={size} height={size} viewBox="0 0 24 24" fill={filled?"currentColor":"none"} stroke="currentColor" stroke-width={filled?1.4:1.8} stroke-linecap="round" stroke-linejoin="round">{paths[name]}</svg>
}
