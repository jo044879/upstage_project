import {evaluate} from '../lib/evaluate.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({error: 'POST 요청이 필요합니다.'});
  }
  try {
    res.status(200).json(await evaluate(req));
  } catch (error) {
    res.status(400).json({error: error.message});
  }
}
