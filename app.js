const API_URL = '/api/workflow';
const form = document.querySelector('form');
const submit = document.querySelector('#submit');
const result = document.querySelector('#result');
const demo = document.querySelector('#demo');
const decisions = new Map(Object.entries({safe:'위험 신호 없음', caution:'주의', danger:'위험', 검토필요:'검토 필요'}));
const input = document.querySelector('#file');
let downloadUrl;
function clearDownload() {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = undefined;
}
function reset() {
  clearDownload();
  submit.disabled = !input.files.length;
  result.removeAttribute('data-state');
  result.textContent = '평가를 실행하면 이곳에 판정과 근거가 표시됩니다.';
}
function show(data, example = false, target = result) {
  if (!data || !decisions.has(data.decision) || !Array.isArray(data.reason) || !data.reason.every(item => typeof item === 'string')) {
    throw new Error('API 응답의 decision과 reason 형식을 확인하세요.');
  }
  const title = document.createElement('strong');
  title.textContent = (example ? 'C03 예시 · ' : '') + decisions.get(data.decision);
  const list = document.createElement('ul');
  for (const reason of data.reason) {
    const item = document.createElement('li');
    item.textContent = reason;
    list.append(item);
  }
  target.dataset.state = data.decision;
  target.replaceChildren(title, list);
}
form.addEventListener('change', reset);
demo.onclick = () => show({decision:'danger',reason:['[위험] 보증금+근저당이 보증 한도(공동주택가격×126%) 초과 — 등기부·건축물대장·계약서','[주의] 소유권 이전 후 90일 이내 계약 — 등기부 갑구·계약서']}, true);
form.onsubmit = async event => {
  event.preventDefault();
  if (submit.disabled) return;
  const file = input.files[0];
  clearDownload();
  input.disabled = demo.disabled = submit.disabled = true;
  result.removeAttribute('data-state');
  result.textContent = '분석 중…';
  try {
    const response = await fetch(API_URL, {
      method: 'POST', headers: {'x-file-name': encodeURIComponent(file.name)}, body: file
    });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('평가 API에서 JSON 응답을 받지 못했습니다 (HTTP ' + response.status + ').');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'HTTP ' + response.status);
    const json = JSON.stringify(data, null, 2);
    const pre = document.createElement('pre');
    pre.textContent = json;
    const link = document.createElement('a');
    downloadUrl = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
    link.href = downloadUrl;
    link.download = file.name.replace(/\.[^.]+$/, '') + '-결과.json';
    link.textContent = '결과 JSON 다운로드';
    result.replaceChildren(link, pre);
  } catch (error) {
    result.textContent = '평가 실패 · ' + error.message;
  } finally {
    input.disabled = demo.disabled = submit.disabled = false;
  }
};
reset();
