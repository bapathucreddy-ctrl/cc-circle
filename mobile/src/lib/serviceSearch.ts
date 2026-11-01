import {categoryLabels,type Category} from '../domain';
import {serviceCatalog} from './serviceCatalog';
const aliases:Record<string,string>={
 'bridal-makeup':'wedding marriage shaadi shadi bride bridal dulhan makeup make up mua beautician',
 'groom-makeup':'wedding marriage shaadi shadi groom bridegroom dulha makeup make up',
 'wedding-makeup':'wedding marriage shaadi shadi guest family makeup make up',
 'wedding-photography':'wedding marriage shaadi shadi photographer photography photo photos camera shoot',
 'prewedding-photography':'prewedding pre wedding couple engagement photography photo shoot',
 'wedding-film-editing':'wedding marriage shaadi shadi film video editing editor',
 'bridal-hair':'wedding marriage shaadi shadi bride bridal hair hairstyle stylist styling',
 'groom-styling':'wedding marriage groom bridegroom hair styling',
 'event-reels':'wedding marriage shaadi shadi birthday party celebration event reels reel videographer videography video creator',
 'party-makeup':'party birthday celebration makeup make up mua',
 'party-hair':'party birthday celebration hair hairstyle styling',
 'festive-makeup':'festival festive navratri navaratri garba diwali celebration makeup',
 'event-photography':'party birthday celebration event photographer photography photos',
 'portrait-photography':'portrait headshot photo photographer photography shoot',
 'product-photography':'brand business product food ecommerce photo photographer photography',
 'photo-editing':'photo retouch retouching photoshop lightroom editing editor',
 'video-editing':'video film movie editing editor',
 'reel-editing':'reels reel instagram social video editing editor',
 'brand-content':'brand business advertising ad content creator video',
 'social-content':'social instagram content creator video reels',
 'product-reels':'product brand business reels reel video content creator',
 'haircut':'hair cut haircut barber trim stylist',
 'general-hair':'hair hairstyle stylist styling blowdry',
 'general-makeup':'makeup make up mua beautician general',
};
export function normalizeServiceQuery(value:string){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().slice(0,100);}
function distance(a:string,b:string){if(Math.abs(a.length-b.length)>2)return 3;const rows=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=0;j<=b.length;j++)rows[0]![j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){rows[i]![j]=Math.min(rows[i-1]![j]!+1,rows[i]![j-1]!+1,rows[i-1]![j-1]!+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i]![j]=Math.min(rows[i]![j]!,rows[i-2]![j-2]!+1);}return rows[a.length]![b.length]!;}
export type ServiceSuggestion={key:string;category:Category;label:string;context?:string};
/** Small local catalogue index: typo tolerance + occasion synonyms, with no extra server. */
export function searchServiceSuggestions(query:string,names:Record<string,string>={},limit=8):ServiceSuggestion[]{
 const normalized=normalizeServiceQuery(query);if(normalized.length<2)return [];const tokens=normalized.split(' ').slice(0,8);const wedding=tokens.some(token=>['wedding','wed','marriage','shaadi','shadi'].some(word=>token===word||(token.length>=4&&distance(token,word)<=1)));
 return serviceCatalog.map((service,index)=>{const label=names[service.key]||service.label;const title=normalizeServiceQuery(label);const words=normalizeServiceQuery(label+' '+service.label+' '+categoryLabels[service.category]+' '+(aliases[service.key]||'')).split(' ');
 let score=0;for(const token of tokens){let best=0;for(const word of words){if(word===token)best=Math.max(best,12);else if(word.startsWith(token))best=Math.max(best,9);else if(token.length>=4&&distance(token,word)<=(token.length>=7?2:1))best=Math.max(best,5);}if(!best)return null;score+=best;}
 if(title===normalized)score+=40;else if(title.startsWith(normalized))score+=12;if(wedding&&['wedding-photography','bridal-makeup','groom-makeup','wedding-makeup','event-reels'].includes(service.key))score+=3;
 return {key:service.key,category:service.category,label:!names[service.key]&&wedding&&service.key==='event-reels'?'Wedding reels':label,context:wedding?'For weddings':undefined,score,index};
 }).filter((row):row is NonNullable<typeof row>=>row!==null).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,Math.max(0,Math.min(limit,24))).map(({score,index,...row})=>row);
}
