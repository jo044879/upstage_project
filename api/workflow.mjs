import {workflow} from '../lib/evaluate.mjs';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({error: 'GET 또는 POST 요청이 필요합니다.'});
  }
  try {
    const {status, body} = await workflow(req);
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(body);
  } catch (error) {
    res.status(400).json({error: error.message});
  }
}
