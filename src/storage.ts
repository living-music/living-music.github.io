const FAVORITES_KEY="livingMusic:favorites:v1";
const THEME_KEY="livingMusic:theme";
export type Theme="dark"|"light"|"system";
export function readFavorites():Set<string>{
  try{const value=JSON.parse(localStorage.getItem(FAVORITES_KEY)||"[]");return new Set(Array.isArray(value)?value.filter(item=>typeof item==="string"):[])}
  catch{return new Set()}
}
export function writeFavorites(favorites:Set<string>):boolean{
  try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...favorites]));return true}catch{return false}
}
export function readTheme():Theme{
  try{const theme=localStorage.getItem(THEME_KEY);return theme==="light"||theme==="system"||theme==="dark"?theme:"dark"}catch{return "dark"}
}
export function writeTheme(theme:Theme):void{
  document.documentElement.dataset.theme=theme;try{localStorage.setItem(THEME_KEY,theme)}catch{}
}
