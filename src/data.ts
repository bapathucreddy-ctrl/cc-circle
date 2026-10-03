export const portraits = [
  require('../assets/demo/portrait_01.jpg'), require('../assets/demo/portrait_02.jpg'),
  require('../assets/demo/portrait_03.jpg'), require('../assets/demo/portrait_04.jpg'),
  require('../assets/demo/portrait_05.jpg'), require('../assets/demo/portrait_06.jpg'),
  require('../assets/demo/portrait_07.jpg'), require('../assets/demo/portrait_08.jpg'),
  require('../assets/demo/portrait_09.jpg'), require('../assets/demo/portrait_10.jpg'),
  require('../assets/demo/portrait_11.jpg'), require('../assets/demo/portrait_12.jpg'),
];
export const stills = [
  require('../assets/demo/still_01.jpg'), require('../assets/demo/still_02.jpg'),
  require('../assets/demo/still_03.jpg'), require('../assets/demo/still_04.jpg'),
  require('../assets/demo/still_05.jpg'), require('../assets/demo/still_06.jpg'),
  require('../assets/demo/still_07.jpg'), require('../assets/demo/still_08.jpg'),
  require('../assets/demo/still_09.jpg'), require('../assets/demo/still_10.jpg'),
  require('../assets/demo/still_11.jpg'), require('../assets/demo/still_12.jpg'),
];

export type Category = { name: string; icon: string; photo: number };
export const categories: Category[] = [
  {name:'Acting',icon:'🎭',photo:4},{name:'Direction',icon:'🎬',photo:7},
  {name:'Camera',icon:'📷',photo:2},{name:'Lighting',icon:'💡',photo:11},
  {name:'Art & sets',icon:'🎨',photo:10},{name:'Costume',icon:'🧵',photo:6},
  {name:'Makeup',icon:'💄',photo:1},{name:'Stunts',icon:'🥋',photo:7},
  {name:'Editing',icon:'🎞️',photo:0},{name:'Sound',icon:'🎧',photo:8},
  {name:'Music',icon:'🎹',photo:3},{name:'Voice',icon:'🎙️',photo:4},
  {name:'VFX',icon:'✨',photo:9},{name:'Animation',icon:'🧩',photo:9},
  {name:'Color',icon:'🌈',photo:0},{name:'Subtitles',icon:'💬',photo:0},
  {name:'Production',icon:'🧰',photo:7},{name:'Writing',icon:'✍️',photo:7},
  {name:'Casting',icon:'⭐',photo:4},{name:'Locations',icon:'📍',photo:10},
  {name:'Photography',icon:'📸',photo:5},{name:'Choreography',icon:'🕺',photo:4},
  {name:'Publicity',icon:'📢',photo:5},{name:'Props',icon:'🎪',photo:6},
];
export type Person = { id:string; name:string; role:string; city:string; languages:string; category:string; photo:number; avatarUri?:string; bio:string; links:string[]; demo?:boolean; checked?:boolean };
export const samplePeople: Person[] = [
 {id:'sample-1',name:'Aarav Menon',role:'Film editor · Assistant editor',city:'Hyderabad',languages:'Telugu, Hindi',category:'Editing',photo:0,bio:'Narrative editing across feature films, shorts and branded stories.',links:['https://www.behance.net/'],demo:true},
 {id:'sample-2',name:'Riya Mehta',role:'Makeup artist · Hair stylist',city:'Hyderabad',languages:'Telugu, English',category:'Makeup',photo:1,bio:'Character looks, on-set makeup and editorial hair styling.',links:['https://www.instagram.com/'],demo:true},
 {id:'sample-3',name:'Sana Khan',role:'Cinematographer',city:'Bengaluru',languages:'Hindi, English',category:'Camera',photo:2,bio:'Naturalistic camera work for films and documentary.',links:['https://vimeo.com/'],demo:true},
 {id:'sample-4',name:'Dev Kumar',role:'Music composer · Sound designer',city:'Chennai',languages:'Tamil, Telugu',category:'Music',photo:3,bio:'Original scoring and sound worlds for screen.',links:['https://www.youtube.com/'],demo:true},
 {id:'sample-5',name:'Nisha Rao',role:'Actor · Voice artist',city:'Hyderabad',languages:'Telugu, English',category:'Acting',photo:4,bio:'Screen performance and character voice work.',links:['https://www.instagram.com/'],demo:true},
 {id:'sample-6',name:'Kabir Shah',role:'Photographer · Camera operator',city:'Mumbai',languages:'Hindi, English',category:'Photography',photo:5,bio:'People and set photography with a cinematic eye.',links:['https://www.behance.net/'],demo:true},
 {id:'sample-7',name:'Meera Iyer',role:'Costume designer · Stylist',city:'Chennai',languages:'Tamil, Telugu',category:'Costume',photo:6,bio:'Character-led costumes and styling for film.',links:['https://www.instagram.com/'],demo:true},
 {id:'sample-8',name:'Vikram Das',role:'Assistant director · Writer',city:'Hyderabad',languages:'Telugu, Hindi',category:'Direction',photo:7,bio:'Planning, direction support and screenplay development.',links:['https://www.behance.net/'],demo:true},
 {id:'sample-9',name:'Tara Joseph',role:'Sound recordist · Designer',city:'Bengaluru',languages:'English, Malayalam',category:'Sound',photo:8,bio:'Location recording and detailed post sound.',links:['https://vimeo.com/'],demo:true},
 {id:'sample-10',name:'Ishaan Roy',role:'VFX artist · Compositor',city:'Hyderabad',languages:'Telugu, English',category:'VFX',photo:9,bio:'Compositing and invisible visual effects.',links:['https://www.behance.net/'],demo:true},
];
