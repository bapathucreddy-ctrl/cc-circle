// A silent, 15-second inspiration montage made only from Circle service artwork.
const path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const ffmpeg=path.resolve(__dirname,'../.local-tools/ffmpeg-extracted/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe');
const names=['bridal-makeup','wedding-photography','party-hair','video-editing','brand-content'];
const inputs=names.flatMap(name=>['-loop','1','-i',path.join(__dirname,'dist/assets',name+'.webp')]);
const clips=names.map((_,i)=>`[${i}:v]scale=1600:1600,crop=1600:900:0:250,zoompan=z='1+0.0006*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=90:s=1280x720:fps=30,trim=duration=3,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.2,fade=t=out:st=2.8:d=0.2,setsar=1,format=yuv420p[v${i}]`);
const filter=clips.join(';')+';'+names.map((_,i)=>`[v${i}]`).join('')+'concat=n=5:v=1:a=0[out]';
execFileSync(ffmpeg,['-hide_banner','-loglevel','error',...inputs,'-filter_complex_threads','1','-filter_complex',filter,'-map','[out]','-t','15','-c:v','libx264','-preset','medium','-crf','24','-movflags','+faststart','-an','-y',path.join(__dirname,'dist/assets/circle-in-motion.mp4')],{stdio:'inherit'});
execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-ss','0.8','-i',path.join(__dirname,'dist/assets/circle-in-motion.mp4'),'-frames:v','1','-q:v','3','-y',path.join(__dirname,'dist/assets/film-poster.jpg')],{stdio:'inherit'});
console.log('Created Circle visual tour:',fs.statSync(path.join(__dirname,'dist/assets/circle-in-motion.mp4')).size,'bytes');
