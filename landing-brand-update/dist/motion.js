'use strict';
(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer=matchMedia('(hover: hover) and (pointer: fine)');
  const animations=new Set();
  function animate(element,keyframes,options){
    if(reduced.matches||!element.animate)return;
    const animation=element.animate(keyframes,options);animations.add(animation);
    animation.finished.then(()=>animations.delete(animation),()=>animations.delete(animation));
  }
  const progress=document.createElement('div');progress.className='scroll-progress';progress.setAttribute('aria-hidden','true');document.body.append(progress);
  const topButton=document.createElement('button');topButton.className='back-to-top';topButton.textContent='↑';topButton.setAttribute('aria-label','Back to top');topButton.tabIndex=-1;document.body.append(topButton);
  topButton.addEventListener('click',()=>{window.scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'});document.querySelector('.brand').focus({preventScroll:true});});
  const header=document.querySelector('.header'),hero=document.querySelector('.hero'),heroContent=document.querySelector('.hero-content');
  let frame=0;
  function updateScroll(){frame=0;const y=window.scrollY,total=document.documentElement.scrollHeight-window.innerHeight;progress.style.transform=`scaleX(${total>0?Math.min(1,y/total):0})`;header.classList.toggle('is-scrolled',y>70);const show=y>800;topButton.classList.toggle('is-visible',show);topButton.tabIndex=show?0:-1;heroContent.style.setProperty('--hero-shift',!reduced.matches&&finePointer.matches?`${Math.min(y,hero.offsetHeight)*.13}px`:'0px');}
  function queueScroll(){if(!frame)frame=requestAnimationFrame(updateScroll);}
  window.addEventListener('scroll',queueScroll,{passive:true});window.addEventListener('resize',queueScroll,{passive:true});updateScroll();

  // A moving creative-services strip, with a persistent pause control.
  const ticker=document.createElement('section');ticker.className='talent-ticker';ticker.setAttribute('aria-label','Creative services on Circle');
  ticker.innerHTML='<div class="ticker-window"><div class="ticker-track"><div class="ticker-copy"><span>Makeup that feels like you</span><i aria-hidden="true">✳</i><span>Moments worth capturing</span><i aria-hidden="true">✳</i><span>Hair for your big plans</span><i aria-hidden="true">✳</i><span>Stories that stand out</span><i aria-hidden="true">✳</i><span>Content with character</span><i aria-hidden="true">✳</i></div></div></div><button class="ticker-pause" aria-label="Pause moving service strip" aria-pressed="false">Ⅱ</button>';
  const copy=ticker.querySelector('.ticker-copy').cloneNode(true);copy.setAttribute('aria-hidden','true');ticker.querySelector('.ticker-track').append(copy);hero.after(ticker);
  const pause=ticker.querySelector('.ticker-pause');let paused=false;
  pause.addEventListener('click',()=>{paused=!paused;ticker.classList.toggle('is-paused',paused);pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',paused?'Resume moving service strip':'Pause moving service strip');pause.setAttribute('aria-pressed',String(paused));});

  // Content stays visible if IntersectionObserver is unavailable.
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in-view');if(entry.target.matches('.steps article'))entry.target.classList.add('step-visible');observer.unobserve(entry.target);}});},{threshold:.08,rootMargin:'0px 0px -24px 0px'});
    document.querySelectorAll('.section-heading,.how-intro,.steps article,.pro-image,.pro-copy,.app-copy,.phone-scene,.faq>div,.closing>*,.occasion').forEach((element,index)=>{element.classList.add('reveal');if(element.matches('.occasion'))element.style.setProperty('--reveal-delay',`${index%3*90}ms`);observer.observe(element);});
    document.documentElement.classList.add('motion-enabled');
    const tickerObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>ticker.classList.toggle('is-visible',entry.isIntersecting));});tickerObserver.observe(ticker);
  }else ticker.classList.add('is-visible');

  document.querySelectorAll('.hero-content>*').forEach((element,index)=>animate(element,[{opacity:0,transform:'translateY(22px)'},{opacity:1,transform:'translateY(0)'}],{duration:850,delay:120+index*110,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'}));

  const serviceGrid=document.querySelector('#service-grid');
  let cardsVisible=false;
  if('IntersectionObserver' in window){const cardObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){cardsVisible=true;revealCards();cardObserver.disconnect();}});},{threshold:.05});cardObserver.observe(serviceGrid);}else cardsVisible=true;
  function revealCards(){if(!cardsVisible)return;serviceGrid.querySelectorAll('.service-card').forEach((card,index)=>animate(card,[{opacity:0,transform:'translateY(20px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:450,delay:Math.min(index,7)*45,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'}));}
  serviceGrid.addEventListener('services:rendered',revealCards);
  serviceGrid.addEventListener('pointermove',event=>{if(reduced.matches||!finePointer.matches)return;const image=event.target.closest('.service-image');if(!image)return;const r=image.getBoundingClientRect(),x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;image.style.setProperty('--tilt-x',`${(y-.5)*-5}deg`);image.style.setProperty('--tilt-y',`${(x-.5)*5}deg`);image.style.setProperty('--shine-x',`${x*100}%`);image.style.setProperty('--shine-y',`${y*100}%`);});
  serviceGrid.addEventListener('pointerout',event=>{const card=event.target.closest('.service-card');if(card&&!card.contains(event.relatedTarget)){const image=card.querySelector('.service-image');image.style.setProperty('--tilt-x','0deg');image.style.setProperty('--tilt-y','0deg');}});

  // A tappable, explicitly illustrative phone preview instead of a static mockup.
  const scene=document.querySelector('.phone-scene'),phone=scene.querySelector('.phone'),phoneHero=scene.querySelector('.phone-hero');
  const previews=[{label:'Makeup',image:'bridal-makeup',heading:'A moment<br><em>made for you.</em>'},{label:'Photos',image:'wedding-photography',heading:'Your story.<br><em>Beautifully framed.</em>'},{label:'Hair',image:'party-hair',heading:'Good hair.<br><em>Great plans.</em>'},{label:'Editing',image:'video-editing',heading:'Every frame.<br><em>A little magic.</em>'},{label:'Content',image:'brand-content',heading:'Your idea.<br><em>Made real.</em>'}];
  const controls=document.createElement('div');controls.className='phone-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Change illustrative app preview');
  const hint=document.createElement('p');hint.className='phone-hint';hint.textContent='Tap a service. Find your inspiration.';scene.querySelector('.preview-label').before(hint,controls);
  phoneHero.setAttribute('aria-live','polite');let previewIndex=0;
  previews.forEach((preview,index)=>{const button=document.createElement('button');button.textContent=preview.label;button.setAttribute('aria-pressed',String(index===0));button.classList.toggle('selected',index===0);button.addEventListener('click',()=>{if(previewIndex===index)return;previewIndex=index;controls.querySelectorAll('button').forEach((item,i)=>{item.classList.toggle('selected',i===index);item.setAttribute('aria-pressed',String(i===index));});const image=phoneHero.querySelector('img');image.src=`assets/${preview.image}.webp`;image.alt=`${preview.label} service inspiration`;phoneHero.querySelector('span').innerHTML=preview.heading;animate(phoneHero,[{opacity:.4,transform:'scale(.97)'},{opacity:1,transform:'scale(1)'}],{duration:380,easing:'ease-out'});});controls.append(button);});
  scene.addEventListener('pointermove',event=>{if(reduced.matches||!finePointer.matches)return;const r=phone.getBoundingClientRect();phone.style.setProperty('--phone-y',`${((event.clientX-r.left)/r.width-.5)*8}deg`);phone.style.setProperty('--phone-x',`${((event.clientY-r.top)/r.height-.5)*-5}deg`);});
  scene.addEventListener('pointerleave',()=>{phone.style.setProperty('--phone-x','0deg');phone.style.setProperty('--phone-y','0deg');});
  document.querySelectorAll('[data-audience]').forEach(button=>button.addEventListener('click',()=>animate(document.querySelector('#audience-description'),[{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,easing:'ease-out'})));
  function handleMotionPreference(){if(reduced.matches){animations.forEach(animation=>animation.cancel());heroContent.style.setProperty('--hero-shift','0px');document.querySelectorAll('.reveal').forEach(element=>element.classList.add('in-view'));serviceGrid.querySelectorAll('.service-image').forEach(image=>{image.style.setProperty('--tilt-x','0deg');image.style.setProperty('--tilt-y','0deg');});phone.style.setProperty('--phone-x','0deg');phone.style.setProperty('--phone-y','0deg');}updateScroll();}
  reduced.addEventListener('change',handleMotionPreference);
  document.addEventListener('visibilitychange',()=>{ticker.classList.toggle('is-paused',paused||document.hidden);});
})();
