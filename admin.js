const codesBody = document.querySelector('#codesBody');
const msg = document.querySelector('#message');
const createBtn = document.querySelector('#createBtn');
const expiresDays = document.querySelector('#expiresDays');

let currentUser = null;

function setMessage(text, type = '') {
  msg.className = `message ${type}`.trim();
  msg.textContent = text;
}

async function requireAdmin() {
  const { data: { user }, error: userError } = await db.auth.getUser();

  if (userError || !user) {
    location.href = 'login.html';
    return false;
  }

  currentUser = user;

  const { data: adminOk, error: adminError } = await db.rpc('is_admin');

  if (adminError) {
    setMessage(`관리자 확인 실패: ${adminError.message}`, 'error');
    return false;
  }

  if (!adminOk) {
    document.querySelector('.card').innerHTML = `
      <div class="eyebrow">ADMIN</div>
      <h1>관리자 권한이 없습니다.</h1>
      <p class="muted">현재 로그인 계정에 관리자 권한이 연결되지 않았습니다.</p>
      <a class="btn" href="dashboard.html">내 페이지로 돌아가기</a>
    `;
    return false;
  }

  return true;
}

function statusOf(row) {
  if (row.used_at) return '사용 완료';
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return '만료';
  return '미사용';
}

async function loadCodes() {
  if (!currentUser && !(await requireAdmin())) return;

  const { data, error } = await db
    .from('invite_codes')
    .select('code, created_at, expires_at, used_at, used_by')
    .eq('kind', 'user')
    .order('created_at', { ascending: false });

  if (error) {
    setMessage(`초대 코드 목록을 불러오지 못했습니다: ${error.message}`, 'error');
    return;
  }

  codesBody.innerHTML = (data || []).map(row => `
    <tr>
      <td class="code">${row.code}</td>
      <td>${statusOf(row)}</td>
      <td>${new Date(row.created_at).toLocaleString()}</td>
      <td>${row.expires_at ? new Date(row.expires_at).toLocaleString() : '-'}</td>
      <td>${row.used_by ? row.used_by.slice(0, 8) + '…' : '-'}</td>
    </tr>
  `).join('');
}

function makeInviteCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return 'MINT-' + [...bytes]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function insertInviteCode(days) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeInviteCode();
    const expiresAt = days == null
      ? null
      : new Date(Date.now() + days * 86400000).toISOString();

    const { error } = await db.from('invite_codes').insert({
      code,
      kind: 'user',
      created_by: currentUser.id,
      expires_at: expiresAt
    });

    if (!error) return code;

    // Extremely unlikely random collision: just retry.
    if (error.code === '23505') continue;

    throw error;
  }

  throw new Error('초대 코드 생성에 반복적으로 실패했습니다.');
}

createBtn.addEventListener('click', async () => {
  if (!currentUser && !(await requireAdmin())) return;

  createBtn.disabled = true;
  setMessage('코드 발급 중...');

  try {
    const raw = expiresDays.value;
    const days = raw === '' ? null : Number(raw);
    const code = await insertInviteCode(days);

    setMessage(`새 초대 코드: ${code}`, 'success');
    await loadCodes();
  } catch (error) {
    setMessage(`코드 발급 실패: ${error.message || error}`, 'error');
  } finally {
    createBtn.disabled = false;
  }
});

(async () => {
  if (await requireAdmin()) {
    await Promise.all([loadCodes(), loadBlockedDomains()]);
  }
})();



const blockedDomainInput = document.querySelector('#blockedDomainInput');
const addBlockedDomainBtn = document.querySelector('#addBlockedDomainBtn');
const blockedDomainList = document.querySelector('#blockedDomainList');
const blockedDomainMessage = document.querySelector('#blockedDomainMessage');

function normalizeBlockedName(value){
  return String(value||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'');
}
function validBlockedName(value){
  return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(value);
}
function setBlockedMessage(text,type=''){
  if(!blockedDomainMessage)return;
  blockedDomainMessage.className=`message ${type}`.trim();
  blockedDomainMessage.textContent=text||'';
}
async function loadBlockedDomains(){
  if(!blockedDomainList)return;
  const {data,error}=await db
    .from('blocked_site_names')
    .select('name,created_at')
    .order('created_at',{ascending:false});

  if(error){
    setBlockedMessage(`차단 목록을 불러오지 못했어요: ${error.message}`,'error');
    return;
  }

  blockedDomainList.innerHTML='';
  if(!(data||[]).length){
    blockedDomainList.innerHTML='<div class="blocked-domain-empty">현재 차단된 주소 이름이 없습니다.</div>';
    return;
  }

  (data||[]).forEach(row=>{
    const item=document.createElement('div');
    item.className='blocked-domain-item';

    const info=document.createElement('div');
    const name=document.createElement('b');
    name.textContent=row.name;
    const url=document.createElement('small');
    url.textContent=`/${row.name}`;
    info.append(name,url);

    const button=document.createElement('button');
    button.type='button';
    button.className='btn blocked-release-btn';
    button.textContent='차단 해제';
    button.onclick=async()=>{
      button.disabled=true;
      const {error}=await db.from('blocked_site_names').delete().eq('name',row.name);
      if(error){
        setBlockedMessage(`차단 해제 실패: ${error.message}`,'error');
        button.disabled=false;
        return;
      }
      setBlockedMessage(`${row.name} 주소의 사용 금지를 해제했어요.`,'success');
      await loadBlockedDomains();
    };

    item.append(info,button);
    blockedDomainList.appendChild(item);
  });
}

if(blockedDomainInput){
  blockedDomainInput.addEventListener('input',e=>{
    const normalized=normalizeBlockedName(e.target.value);
    if(e.target.value!==normalized)e.target.value=normalized;
  });
  blockedDomainInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();addBlockedDomainBtn?.click();}
  });
}
if(addBlockedDomainBtn){
  addBlockedDomainBtn.addEventListener('click',async()=>{
    if(!currentUser && !(await requireAdmin()))return;
    const name=normalizeBlockedName(blockedDomainInput.value);

    if(!validBlockedName(name)){
      setBlockedMessage('영문 소문자/숫자/하이픈(-)만 사용해 3~30자로 입력해 주세요.','error');
      return;
    }

    addBlockedDomainBtn.disabled=true;
    setBlockedMessage('사용 금지 처리 중…');

    const {error}=await db.from('blocked_site_names').insert({
      name,
      created_by:currentUser.id
    });

    addBlockedDomainBtn.disabled=false;

    if(error){
      if(error.code==='23505')setBlockedMessage(`${name}은(는) 이미 차단되어 있어요.`,'error');
      else setBlockedMessage(`사용 금지 실패: ${error.message}`,'error');
      return;
    }

    blockedDomainInput.value='';
    setBlockedMessage(`${name} 주소를 회원가입에서 사용할 수 없게 막았어요.`,'success');
    await loadBlockedDomains();
  });
}

const SITE_FONT_FILES = [
  'Paperlogy-5Medium.ttf',
  'Paperlogy-3Light.ttf',
  'Jalnan2.otf',
  'Puzzle Sans.ttf',
  '원주체 Regular.otf',
  'PyeongChangPeace-Bold.otf',
  'BMJUA_ttf.ttf'
];

const siteFontInput = document.querySelector('#siteFontInput');
const uploadFontsBtn = document.querySelector('#uploadFontsBtn');
const fontUploadMessage = document.querySelector('#fontUploadMessage');
const fontStatusGrid = document.querySelector('#fontStatusGrid');

function fontPublicUrl(filename){
  const encoded = filename.split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/object/public/site-fonts/${encoded}`;
}

async function renderFontStatus(){
  if(!fontStatusGrid) return;
  fontStatusGrid.innerHTML = '';

  for(const filename of SITE_FONT_FILES){
    let ok = false;
    try{
      const res = await fetch(fontPublicUrl(filename), {method:'HEAD', cache:'no-store'});
      ok = res.ok;
    }catch(_){}

    const row = document.createElement('div');
    row.className = `font-status-row ${ok ? 'ok' : 'missing'}`;
    row.innerHTML = `<span>${filename}</span><b>${ok ? '업로드됨' : '없음'}</b>`;
    fontStatusGrid.appendChild(row);
  }
}

if(uploadFontsBtn){
  uploadFontsBtn.addEventListener('click', async()=>{
    if(!(await requireAdmin())) return;

    const files = [...(siteFontInput.files || [])];
    if(!files.length){
      fontUploadMessage.className = 'message error';
      fontUploadMessage.textContent = '폰트 파일을 먼저 선택해 주세요.';
      return;
    }

    uploadFontsBtn.disabled = true;
    fontUploadMessage.className = 'message';
    fontUploadMessage.textContent = '업로드 중...';

    let success = 0;
    const failures = [];

    for(const file of files){
      const { error } = await db.storage
        .from('site-fonts')
        .upload(file.name, file, {
          upsert: true,
          contentType: file.type || undefined,
          cacheControl: '3600'
        });

      if(error) failures.push(`${file.name}: ${error.message}`);
      else success++;
    }

    uploadFontsBtn.disabled = false;

    if(failures.length){
      fontUploadMessage.className = 'message error';
      fontUploadMessage.textContent = `${success}개 업로드 성공 / 실패: ${failures.join(' | ')}`;
    }else{
      fontUploadMessage.className = 'message success';
      fontUploadMessage.textContent = `${success}개 폰트 업로드 완료`;
    }

    await renderFontStatus();
  });
}

renderFontStatus();
