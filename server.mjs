// Development/demo server only. Binds to loopback by default and never receives study data.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const base=resolve(fileURLToPath(new URL('.',import.meta.url)),process.env.ROOT==='dist'?'dist':'.');
const host=process.env.HOST||'127.0.0.1', port=Number(process.env.PORT||8000);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
const app=createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/')pathname='/index.html';
    const file=resolve(base,'.'+pathname);
    if(!file.startsWith(base+sep)||!types[extname(file)]){res.writeHead(404);res.end();return;}
    const info=await stat(file);if(!info.isFile())throw Error('Not a file');
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
app.listen(port,host,()=>console.log('ResearchOS-CID at http://'+host+':'+port));
