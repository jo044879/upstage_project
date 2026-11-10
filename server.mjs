import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {workflow} from './lib/evaluate.mjs';

import {fileURLToPath} from 'node:url';
if (!process.env.UPSTAGE_API_KEY) process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)));

const assets = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/style.css', ['style.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']]]);
http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && assets.has(req.url)) {
      const [name, type] = assets.get(req.url);
      const body = await readFile(new URL(name, import.meta.url));
      res.writeHead(200, {'Content-Type':type + '; charset=utf-8'}).end(body);
    } else if (['GET', 'POST'].includes(req.method) && req.url === '/api/workflow') {
      const {status, body} = await workflow(req);
      res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'}).end(JSON.stringify(body));
    } else res.writeHead(404).end();
  } catch (error) {
    res.writeHead(400, {'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));
  }
}).listen(Number(process.env.PORT || 8317), '127.0.0.1');
