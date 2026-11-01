'use strict';
(() => {
  const video=document.querySelector('#circle-video'),overlay=document.querySelector('#film-play'),status=document.querySelector('#film-status');
  const buttons=[...document.querySelectorAll('[data-chapter]')];
  const labels=['Makeup artists','Photographers','Hair stylists','Editors','Content creators'];
  let chapter=-1;
  function syncChapter(){const next=Math.min(4,Math.floor(video.currentTime/3));if(next===chapter)return;chapter=next;buttons.forEach((button,index)=>{button.classList.toggle('active',index===chapter);button.setAttribute('aria-pressed',String(index===chapter));});}
  async function play(){try{await video.play();}catch{status.textContent='Use the video’s play control to begin.';}}
  overlay.addEventListener('click',play);
  video.addEventListener('play',()=>{overlay.hidden=true;status.textContent='Playing · Use the video controls to pause or replay.';});
  video.addEventListener('pause',()=>{if(!video.ended)status.textContent='Paused · Continue whenever you’re ready.';});
  video.addEventListener('ended',()=>{overlay.hidden=false;overlay.setAttribute('aria-label','Replay the Artist House visual tour');overlay.querySelector('small').textContent='REPLAY THE VISUAL TOUR · 15 SECONDS';status.textContent='That’s your creative circle. Replay or choose a service.';});
  video.addEventListener('timeupdate',syncChapter);
  video.addEventListener('error',()=>{overlay.hidden=true;status.textContent='The video could not load. You can still explore the service cards.';});
  buttons.forEach((button,index)=>button.addEventListener('click',()=>{const seek=()=>{video.currentTime=index*3+.2;syncChapter();status.textContent='Selected · '+labels[index];play();};if(video.readyState>=1)seek();else{video.addEventListener('loadedmetadata',seek,{once:true});video.load();}}));
  // Playback is always user initiated, and stops when leaving the visible section.
  if('IntersectionObserver' in window){new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&!video.paused)video.pause();},{threshold:.1}).observe(video);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!video.paused)video.pause();});
})();
