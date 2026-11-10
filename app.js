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
const reasonGuides = new Map([
  ['등기부등본 누락 또는 필수 값 미확인', ['등기부에서 필요한 정보를 확인하지 못했어요', '첨부한 파일에 등기부가 포함돼 있는지, 소유자와 해당 호수가 적힌 부분을 읽을 수 있는지 확인해 주세요.']],
  ['건축물대장 누락 또는 필수 값(호수·공동주택가격) 미확인', ['어느 집인지, 평가에 쓸 가격이 얼마인지 확인이 필요해요', '건축물대장이 포함돼 있는지 먼저 확인해 주세요. 계약할 집의 호수와 그 호수의 공동주택가격을 확인할 자료도 함께 살펴보세요.']],
  ['등기부 열람일이 없거나 계약일보다 7일 넘게 지남', ['등기부를 언제 확인했는지 살펴보세요', '등기부의 열람일과 계약서의 계약일을 비교해 주세요. 이번 평가에서는 열람일을 읽지 못했거나 두 날짜가 7일 넘게 차이 나 재발급이 필요하다고 표시했어요.']],
  ['보증금+근저당이 보증 한도(공동주택가격×126%) 초과', ['평가에 사용한 한도보다 금액의 합이 커요', '계약서의 보증금과 등기부의 근저당 금액을 더한 값이 이 평가에서 사용한 한도를 넘었다는 뜻이에요. 두 금액과 계산에 사용한 공동주택가격을 확인해 주세요.']],
  ['소유권 이전 후 90일 이내 계약', ['집주인이 바뀐 뒤 90일 안에 계약했어요', '등기부에 적힌 소유권 이전일과 계약서의 계약일을 비교해 보세요. 두 날짜가 가깝다는 점을 평가에서 주의 항목으로 표시했어요.']]
]);
function show(data, example = false) {
  const title = document.createElement('strong');
  title.textContent = (example ? '예시 · ' : '') + (decisions.get(data.decision) || data.decision);
  const label = document.createElement('h3');
  label.textContent = '판정 근거';
  const list = document.createElement('ul');
  list.className = 'findings';
  const sources = Array.isArray(data.sourceReferences) ? data.sourceReferences : [];
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = '판정 근거 쉽게 보기';
  details.append(summary);
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
    const body = reason.slice(match?.[0].length || 0);
    item.append(document.createTextNode(body));
    const [finding, ...context] = body.split(/\s+—\s+/);
    const guide = reasonGuides.get(finding);
    const heading = document.createElement('h4');
    heading.textContent = guide?.[0] || finding;
    details.append(heading);
    const explanation = document.createElement('p');
    explanation.textContent = guide?.[1] || (context.length
      ? '함께 확인할 내용 · ' + context.join(' — ')
      : '평가가 확인한 내용이에요. 원문에서 같은 항목의 기재 내용을 살펴보세요.');
    details.append(explanation);
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
  if (list.childElementCount) result.append(label, list, details);
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
    let response = await fetch(API_URL, {
      method: 'POST', headers: {Prefer: 'respond-async', 'x-file-name': encodeURIComponent(file.name)}, body: file
    });
    if (response.status === 202) {
      const job = await response.json();
      const headers = {'x-workflow-id': job.id, 'x-workflow-token': job.token};
      let failures = 0;
      do {
        await new Promise(resolve => setTimeout(resolve, failures ? 5000 : 2500));
        try {
          response = await fetch(API_URL, {headers, cache: 'no-store'});
          if (response.status >= 500 || response.status === 429) throw new Error('작업 조회 실패 (HTTP ' + response.status + ')');
          failures = 0;
        } catch (error) {
          if (++failures >= 5) throw error;
          result.textContent = '연결을 다시 확인하고 있습니다…';
          continue;
        }
        result.textContent = '서류를 분석하고 있습니다…';
        if (response.status !== 202) break;
      } while (true);
    }
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
