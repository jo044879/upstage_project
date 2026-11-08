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
const fieldNames = {owner_name:'소유자명', unit_no:'호수', last_transfer_date:'최근 소유권 이전일', issued_date:'발급일', official_price:'공동주택가격', lessor_name:'임대인명', contract_date:'계약일', deposit_number:'보증금', agent_name:'중개사명'};
function describeSource(ref) {
  const page = Number.isInteger(ref.page) && ref.page > 0 ? ref.page + '쪽' : '페이지 미확인';
  return (fieldNames[ref.field] || ref.field) + ' · ' + page;
}
function show(data, example = false) {
  const title = document.createElement('strong');
  title.textContent = (example ? '예시 · ' : '') + (decisions.get(data.decision) || data.decision);
  const label = document.createElement('h3');
  label.textContent = '판정 근거';
  const list = document.createElement('ul');
  list.className = 'findings';
  const sources = Array.isArray(data.sourceReferences) ? data.sourceReferences : [];
  for (const rawReason of data.reason) {
    const reason = rawReason.replace(/【\s*[†t]\s*\d+\s*】|\[\s*[†t]\s*\d+\s*\]/gi, '').trim();
    if (!reason) continue;
    const item = document.createElement('li');
    const match = reason.match(/^\[([^\]]+)\]\s*/);
    if (match) {
      const tag = document.createElement('span');
      tag.className = 'finding-tag';
      tag.dataset.level = match[1];
      tag.textContent = match[1];
      item.append(tag);
    }
    item.append(document.createTextNode(reason.slice(match?.[0].length || 0)));
    const ids = [...rawReason.matchAll(/(?:【|\[)\s*[†t]\s*(\d+)\s*(?:】|\])/gi)].map(match => Number(match[1]));
    const linked = sources.filter(ref => ids.includes(ref.index));
    if (linked.length) {
      const note = document.createElement('small');
      note.style.display = 'block';
      note.textContent = '관련 근거 · ' + linked.map(describeSource).join(' / ');
      item.append(note);
    }
    list.append(item);
  }
  result.dataset.state = data.decision;
  result.replaceChildren(title);
  if (list.childElementCount) result.append(label, list);
  if (sources.length) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '문서 근거 ' + sources.length + '개 보기';
    details.append(summary);
    for (const ref of sources) {
      const line = document.createElement('p');
      line.textContent = '근거 ' + ref.index + ' · ' + describeSource(ref);
      details.append(line);
    }
    result.append(details);
  }
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
    if (typeof data?.decision === 'string' && Array.isArray(data.reason) &&
        data.reason.every(reason => typeof reason === 'string')) {
      show(data);
    } else {
      result.replaceChildren(pre);
    }
    result.append(link);
  } catch (error) {
    result.textContent = '평가 실패 · ' + error.message;
  } finally {
    input.disabled = demo.disabled = submit.disabled = false;
  }
};
reset();
