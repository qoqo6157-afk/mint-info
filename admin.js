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
    await loadCodes();
  }
})();


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
