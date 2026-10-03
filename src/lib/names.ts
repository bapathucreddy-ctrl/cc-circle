export function displayName(name:string){
 return name.trim().replace(/(^|[\s’'-])(\p{L})/gu,(_,separator,letter)=>separator+letter.toLocaleUpperCase());
}
