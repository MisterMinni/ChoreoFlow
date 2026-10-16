import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
const root = resolve('apps/app/dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.ttf':'font/ttf'};
http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403).end(); return; }
    try { if ((await stat(file)).isDirectory()) file = resolve(file,'index.html'); } catch { file = resolve(root,'index.html'); }
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream'});
    res.end(await readFile(file));
  } catch { res.writeHead(500).end('Datei konnte nicht geladen werden.'); }
}).listen(8082, '127.0.0.1', () => console.log('ChoreoFlow: http://127.0.0.1:8082'));
