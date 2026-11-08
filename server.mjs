import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

import {fileURLToPath} from 'node:url';
if (!process.env.UPSTAGE_API_KEY) process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)));

const assets = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/style.css', ['style.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']]]);
const limit = 500_000_000;

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', 'Bearer ' + process.env.UPSTAGE_API_KEY);
  headers.set('x-project-id', 'proj_3gApqNHbpMTmJC4QAKUU6X');
  const response = await fetch('https://api.upstage.ai/v2/' + path, {...options, headers, signal: AbortSignal.timeout(300000)});
  if (!response.ok) throw new Error('Upstage 요청 실패 (HTTP ' + response.status + ')');
  return response.json();
}

async function evaluate(req) {
  if (!process.env.UPSTAGE_API_KEY) throw new Error('서버 실행 환경에 UPSTAGE_API_KEY를 설정하세요.');
  const name = decodeURIComponent(req.headers['x-file-name'] || '');
  if (!/\.(pdf|jpe?g|png|bmp|tiff?|heic)$/i.test(name)) throw new Error('PDF, JPEG, PNG, BMP, TIFF, HEIC 파일을 선택하세요.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('파일 크기는 최대 500 MB입니다.');
    chunks.push(chunk);
  }
  if (!size) throw new Error('빈 파일입니다.');
  const form = new FormData();
  form.append('file', new Blob(chunks), name);
  form.append('purpose', 'user_data');
  const file = await api('files', {method:'POST', body:form});
  let job = await api('responses', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
    model:'agt_VzpQMNhFMmhvUchvj8f7Pt', config_id:'31', include:['last'],
    input:[{role:'user', content:[{type:'input_file', file_id:file.id}]}]
  })});
  while (['queued', 'in_progress'].includes(job.status)) {
    await delay(2500);
    job = await api('responses/' + encodeURIComponent(job.id) + '?include[]=last');
  }
  if (job.status !== 'completed') throw new Error('Upstage 작업 상태: ' + job.status);
  const decoded = JSON.parse(job.output_text ?? job.output?.at(-1)?.content?.find(item => item.type === 'output_text')?.text);
  const result = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
  if (!result || typeof result !== 'object') throw new Error('분석 결과의 JSON 형식을 확인하세요.');
  return result;
}

http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && assets.has(req.url)) {
      const [name, type] = assets.get(req.url);
      const body = await readFile(new URL(name, import.meta.url));
      res.writeHead(200, {'Content-Type':type + '; charset=utf-8'}).end(body);
    } else if (req.method === 'POST' && req.url === '/api/workflow' && req.headers['x-file-name']) {
      const value = await evaluate(req);
      res.writeHead(200, {'Content-Type':'application/json'}).end(JSON.stringify(value));
    } else res.writeHead(404).end();
  } catch (error) {
    res.writeHead(400, {'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));
  }
}).listen(Number(process.env.PORT || 8317), '127.0.0.1');
