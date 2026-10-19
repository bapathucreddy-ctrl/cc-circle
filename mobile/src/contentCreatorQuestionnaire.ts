import type { QuestionSection } from './questionnaires';
export const contentCreatorQuestionnaire: QuestionSection[] = [
 {title:'Your content creation',description:'Help clients book the right creator for reels, events and brand content.',fields:[
  {id:'content-services',label:'Content you create',type:'multi',required:true,options:['Instagram reels','YouTube Shorts','Event reels','Brand and product videos','Lifestyle content','Behind the scenes','Social media photos']},
  {id:'experience',label:'Years of professional experience',type:'number',required:true,min:0,max:70},
  {id:'shooting-kit',label:'Your shooting equipment',type:'multi',required:true,options:['Smartphone','Mirrorless camera','Gimbal','Tripod','Wireless microphone','Portable lighting']},
 ]},
 {title:'Deliverables and workflow',description:'Set clear expectations before a client books.',fields:[
  {id:'deliverables',label:'What is included in a session?',type:'textarea',required:true,hint:'Number of reels, duration, shoot time and whether editing is included.'},
  {id:'turnaround',label:'Usual delivery time',type:'select',required:true,options:['Same day','Within 24 hours','2–3 days','Within a week','Depends on the project']},
  {id:'revisions',label:'Included revision rounds',type:'number',required:true,min:0,max:10},
  {id:'client-preparation',label:'What should the client prepare?',type:'textarea',hint:'Brief, product, location permissions or reference reels.'},
  {id:'usage-rights',label:'Usage rights and raw footage',type:'textarea',required:true,hint:'Explain permitted use, raw footage availability and licensed music.'},
 ]},
];
