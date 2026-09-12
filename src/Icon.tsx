import type { JSX } from "preact";
export type IconName="home"|"browse"|"search"|"heart"|"play"|"pause"|"previous"|"next"|"queue"|"close"|"chevron"|"music"|"back"|"more"|"up"|"down"|"repeat"|"trash"|"video"|"add"|"check"|"shuffle"|"download"|"settings";
const paths:Record<IconName,JSX.Element>={
home:<path d="M3.6 10.35 10.55 4.5a2.25 2.25 0 0 1 2.9 0l6.95 5.85a1.7 1.7 0 0 1 .6 1.3v7.15a2.2 2.2 0 0 1-2.2 2.2H14v-5.1a2 2 0 0 0-4 0V21H5.2A2.2 2.2 0 0 1 3 18.8v-7.15a1.7 1.7 0 0 1 .6-1.3Z" fill="currentColor" stroke="none"/>,
browse:<><rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor" stroke="none"/><rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor" stroke="none"/><rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor" stroke="none"/><rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor" stroke="none"/></>,
search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>,
heart:<path d="M20.5 9c0 5.5-8.5 10.5-8.5 10.5S3.5 14.5 3.5 9A4.5 4.5 0 0 1 12 6.9 4.5 4.5 0 0 1 20.5 9Z"/>,
play:<path d="M6.8 5.45c0-1.08 1.2-1.73 2.13-1.14l10.5 6.27a1.65 1.65 0 0 1 0 2.84l-10.5 6.27c-.93.59-2.13-.06-2.13-1.14Z"/>,pause:<><rect x="6.75" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.75" y="5" width="3.5" height="14" rx="1.2" fill="currentColor" stroke="none"/></>,
previous:<><path d="M6 5v14M19 6l-9 6 9 6Z"/></>,next:<><path d="M3.2 6.15c0-.94 1.06-1.5 1.83-.96l7.37 5.11a2.08 2.08 0 0 1 0 3.4l-7.37 5.11c-.77.54-1.83-.02-1.83-.96Z" fill="currentColor" stroke="none"/><path d="M10.6 6.15c0-.94 1.06-1.5 1.83-.96l7.37 5.11a2.08 2.08 0 0 1 0 3.4l-7.37 5.11c-.77.54-1.83-.02-1.83-.96Z" fill="currentColor" stroke="none"/></>,
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
