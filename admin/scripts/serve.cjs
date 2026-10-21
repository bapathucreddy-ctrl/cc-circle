const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../dist'),types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
 try {const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)||name.split('/').some(part=>part.startsWith('.'))||!fs.statSync(file).isFile())throw Error('Not found');
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"});fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(8090,'127.0.0.1',()=>console.log('Circle banner admin: http://localhost:8090'));
