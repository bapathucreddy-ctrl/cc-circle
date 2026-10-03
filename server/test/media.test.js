import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverMedia,extractMedia} from '../src/media.js';
import {loadInstagramMedia} from '../src/instagram.js';
import {fitVideoSize,videoSource,allowVideoNavigation,portfolioMedia} from '../../src/lib/media.ts';

test('video frame fits portrait, landscape and square media within the available screen',()=>{
 for(const [bounds,ratio] of [[{width:360,height:600},9/16],[{width:360,height:600},16/9],[{width:600,height:280},9/16],[{width:360,height:600},1]]){
  const size=fitVideoSize(bounds,ratio);
  assert.ok(size.width<=bounds.width&&size.height<=bounds.height);
  assert.ok(Math.abs(size.width/size.height-ratio)<0.00001);
  assert.ok(size.width===bounds.width||size.height===bounds.height);
 }
 assert.deepEqual(fitVideoSize({width:0,height:0}),{width:0,height:0});
 assert.equal(fitVideoSize({width:320,height:600},NaN).height,180);
});

test('video playback distinguishes provider pages, direct files and unsupported URLs',()=>{
 assert.equal(videoSource({url:'https://youtu.be/M7lc1UVf-VE'}).url,'https://www.youtube.com/embed/M7lc1UVf-VE?playsinline=1');
 assert.equal(videoSource({url:'https://www.youtube.com/shorts/M7lc1UVf-VE'}).kind,'embed');
 assert.equal(videoSource({url:'https://vimeo.com/123456789'}).url,'https://player.vimeo.com/video/123456789');
 assert.equal(videoSource({url:'https://cdn.example.com/work.mp4?signature=abc'}).kind,'direct');
 assert.equal(videoSource({url:'https://scontent.cdninstagram.com/video',source_url:'https://www.instagram.com/p/work/'}).kind,'direct');
 assert.equal(videoSource({url:'https://www.instagram.com/reel/ABC_123-/?igsh=tracking'}).url,'https://www.instagram.com/p/ABC_123-/embed/');
 assert.equal(videoSource({url:'https://instagram.com/p/ABC123/'}).kind,'embed');
 for(const url of ['https://www.youtube.com/channel/UC123','https://youtube.com.evil.example/watch?v=M7lc1UVf-VE','https://www.instagram.com/artist/reels/','https://www.instagram.com/reels/','https://instagram.com.evil.example/reel/ABC123/','javascript:alert(1)','https://user:password@example.com/movie.mp4'])assert.equal(videoSource({url}),null);
});

test('Instagram discovery distinguishes individual Reels from profile video tabs',()=>{
 const result=extractMedia('<a href="https://www.instagram.com/artist/reels/">All reels</a><a href="https://www.instagram.com/reels/">Browse</a><a href="https://help.instagram.com/581066165581870/">Help</a><a href="https://www.instagram.com/artist/reel/ABC123/">Reel</a>','https://www.instagram.com/artist/');
 assert.equal(result.videos.length,1);
 assert.equal(result.videos[0].url,'https://www.instagram.com/artist/reel/ABC123/');
});

const instagramVideoPage=code=>{
 let payload={code,media_type:2,video_versions:[{url:`https://video.cdninstagram.com/${code}.mp4?signature=public`},{url:`https://video.cdninstagram.com/${code}-low.mp4`}],image_versions2:{candidates:[{url:`https://image.cdninstagram.com/${code}.jpg`}]}};
 // Public Instagram bootstrapping nests media deeper than JSON-LD.
 for(let i=0;i<14;i++)payload={data:payload};
 return `<script type="application/json">${JSON.stringify(payload)}</script>`;
};

test('public Instagram JSON yields a direct video URL and profile scans resolve Reel links',async()=>{
 const fetched=[];
 const found=await discoverMedia('https://www.instagram.com/artist/',{fetchPage:async url=>{
  fetched.push(url);
  return {url,html:url.endsWith('/artist/')?'<a href="/artist/reel/ABC123/">Video</a><a href="/reel/ABC123/">Same video</a><a href="/reel/UNAVAILABLE/">Restricted</a>':url.includes('/ABC123/')?instagramVideoPage('ABC123'):'<p>Sign in to view</p>'};
 }});
 assert.equal(fetched.length,3);assert.equal(found.videos.length,1);
 assert.equal(found.videos[0].url,'https://video.cdninstagram.com/ABC123.mp4?signature=public');
 assert.equal(found.videos[0].source_url,'https://www.instagram.com/reel/ABC123/');
 assert.equal(videoSource(found.videos[0]).kind,'direct');
});

test('unavailable Instagram media produces an honest warning without nonplayable videos',async()=>{
 const result=await discoverMedia('https://www.instagram.com/reel/UNAVAILABLE/',{fetchPage:async url=>({url,html:'<a href="/reel/UNAVAILABLE/">Video</a><a href="/reel/RELATED/">Recommended</a>'})});
 assert.equal(result.videos.length,0);assert.match(result.warning,/direct video URLs/);
});

test('public portfolio extraction retains source attribution and playable video URLs',()=>{
 const result=extractMedia('<img src="https://cdn.example.com/work.jpg"><video src="https://cdn.example.com/work.mp4" poster="https://cdn.example.com/poster.jpg"></video>','https://example.com/artist');
 assert.equal(result.images[0].source_url,'https://example.com/artist');
 assert.equal(result.videos[0].url,'https://cdn.example.com/work.mp4');
 assert.equal(result.videos[0].source_url,'https://example.com/artist');
});

test('Behance discovers public project work, skips failed pages and limits requests',async()=>{
 const fetched=[];
 const result=await discoverMedia('https://www.behance.net/artist',{fetchPage:async url=>{
  fetched.push(url);
  if(url.endsWith('/artist'))return {url,html:Array.from({length:8},(_,i)=>`<a href="/gallery/${100+i}/Work">Project</a>`).join('')+'<a href="https://localhost/gallery/999">Unsafe</a>'};
  if(url.includes('/101/'))throw Error('Unavailable');
  return {url,html:`<img src="https://cdn.example.com/${new URL(url).pathname.split('/')[2]}.jpg"><iframe src="https://www.youtube.com/embed/M7lc1UVf-VE"></iframe>`};
 }});
 assert.equal(fetched.length,6);assert.equal(result.images.length,4);assert.equal(result.videos.length,1);
 assert.equal(result.images[0].source_url,'https://www.behance.net/gallery/100/Work');
});

test('Instagram imports each carousel video as playable media with the original post',async t=>{
 t.mock.method(globalThis,'fetch',async url=>({ok:true,json:async()=>String(url).includes('me/media')?{data:[
  {media_type:'CAROUSEL_ALBUM',permalink:'https://www.instagram.com/p/album/',children:{data:[
   {media_type:'IMAGE',media_url:'https://scontent.cdninstagram.com/photo.jpg'},
   {media_type:'VIDEO',media_url:'https://scontent.cdninstagram.com/one.mp4',thumbnail_url:'https://scontent.cdninstagram.com/one.jpg'},
   {media_type:'VIDEO',media_url:'https://scontent.cdninstagram.com/two.mp4'}
  ]}},
  {media_type:'VIDEO',permalink:'https://www.instagram.com/p/missing/'}
 ]}:{id:'17841400000000001',username:'artist'}}));
 const result=await loadInstagramMedia('test-only-token');
 assert.equal(result.images.length,1);assert.equal(result.videos.length,2);
 assert.equal(result.videos[0].url,'https://scontent.cdninstagram.com/one.mp4');
 assert.equal(result.videos[1].source_url,'https://www.instagram.com/p/album/');
 assert.equal(result.images[0].source_url,'https://www.instagram.com/p/album/');
});

test('Instagram resolves video posts using /p links and JSON-only shortcodes, retaining carousel sources',async()=>{
 const fetched=[];const found=await discoverMedia('https://www.instagram.com/artist/',{fetchPage:async url=>{fetched.push(url);if(url.endsWith('/artist/'))return {url,html:'<a href="/artist/p/POST123/">Video post</a><script type="application/json">'+JSON.stringify({data:{shortcode:'REEL123',media_type:2}})+'</script>'};return {url,html:instagramVideoPage(url.includes('POST123')?'POST123':'REEL123')}}});
 assert.equal(found.videos.length,2);assert.ok(fetched.includes('https://www.instagram.com/p/POST123/'));assert.ok(fetched.includes('https://www.instagram.com/reel/REEL123/'));
 const carousel=extractMedia('<script type="application/json">'+JSON.stringify({code:'ALBUM',media_type:8,children:[{media_type:2,video_url:'https://video.cdninstagram.com/album.mp4'}]})+'</script>','https://www.instagram.com/artist/');
 assert.equal(carousel.videos[0].source_url,'https://www.instagram.com/p/ALBUM/');
});

 test('embedded videos keep player navigation internal and block browser/app handoffs',()=>{
 const player='https://www.youtube.com/embed/M7lc1UVf-VE?playsinline=1';
 assert.ok(allowVideoNavigation({url:player},player));
 assert.ok(allowVideoNavigation({url:player+'&controls=1'},player));
 assert.ok(allowVideoNavigation({url:'about:blank'},player));
 assert.ok(allowVideoNavigation({url:'https://www.youtube.com/player-resource',isTopFrame:false},player));
 for(const url of ['youtube://M7lc1UVf-VE','intent://watch','instagram://media','https://www.youtube.com/watch?v=M7lc1UVf-VE','https://evil.example/embed/M7lc1UVf-VE','javascript:alert(1)'])assert.equal(allowVideoNavigation({url},player),false);
 assert.equal(allowVideoNavigation({url:'intent://watch',isTopFrame:false},player),false);
 const instagram=videoSource({url:'https://www.instagram.com/artist/reel/ABC123/'});
 assert.equal(instagram.url,'https://www.instagram.com/p/ABC123/embed/');
 assert.ok(allowVideoNavigation({url:instagram.url},instagram.url));
 assert.equal(allowVideoNavigation({url:'https://www.instagram.com/p/ABC123/'},instagram.url),false);
 });

test('profile galleries show actual unique counts without filling empty image slots',()=>{
 const image=(id,url,hidden=false)=>({id,kind:'image',url,hidden});
 const first=image('a','https://cdn.example.com/a.jpg');
 const second=image('b','https://cdn.example.com/b.jpg');
 const third=image('c','https://cdn.example.com/c.jpg');
 assert.deepEqual(portfolioMedia([], 'image'),[]);
 assert.deepEqual(portfolioMedia([first,second,image('duplicate',first.url),third,image('hidden',second.url,true)],'image'),[first,second,third]);
 assert.deepEqual(portfolioMedia([image('hidden',first.url,true),first],'image'),[first]);
 assert.equal(portfolioMedia(Array.from({length:12},(_,i)=>image(String(i),`https://cdn.example.com/${i}.jpg`)),'image').length,10);
 assert.equal(portfolioMedia([{kind:'video',url:first.url},first],'image').length,1);
});

test('profile imports collapse image sizes and CDN signatures, exclude avatars, and retain distinct photos',()=>{
 const base='https://scontent.cdninstagram.com/v/t51.82787-15/photo_n.jpg';
 const variants=[`${base}?stp=s150x150&oh=old`,`${base}?stp=s640x640&oh=new`];
 const images=variants.map((url,i)=>({kind:'image',id:String(i),url}));
 images.push({kind:'image',id:'avatar',url:'https://scontent.cdninstagram.com/v/t51.2885-19/avatar_n.jpg'});
 images.push({kind:'image',id:'second',url:base.replace('photo_n','other_n')});
 assert.equal(portfolioMedia(images,'image').length,2);
 const result=extractMedia(`<img src="${variants[0]}" srcset="${variants[0]} 150w, ${variants[1]} 640w"><img src="${variants[0]}">`,'https://www.instagram.com/artist/');
 assert.equal(result.images.length,1);
 assert.equal(result.images[0].url,variants[1]);
 assert.equal(extractMedia(`<img src="${images[2].url}">`,'https://www.instagram.com/artist/').images.length,0);
 assert.equal(portfolioMedia([{kind:'image',url:'https://cdn.example.com/photo.jpg?w=100'},{kind:'image',url:'https://cdn.example.com/photo.jpg?w=600'}],'image').length,1);
 assert.equal(portfolioMedia([{kind:'image',url:'https://example.com/image?id=1'},{kind:'image',url:'https://example.com/image?id=2'}],'image').length,2);
});
