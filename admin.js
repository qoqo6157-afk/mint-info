const codesBody = document.querySelector('#codesBody');
const msg = document.querySelector('#message');
const createBtn = document.querySelector('#createBtn');
const expiresDays = document.querySelector('#expiresDays');

async function getCurrentUser() {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) {
    location.href = 'login.html';
    return null;
  }
  return user;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await db.rpc('is_admin');

  if (error) {
    msg.className = 'message error';
    msg.textContent = `관리자 권한 확인 실패: ${error.message}`;
    return false;
  }

  if (!data) {
    document.querySelector('.card').innerHTML = `
      <div class="eyebrow">ADMIN</div>
      <h1>관리자 권한이 없습니다.</h1>
      <p class="muted">
        최초 관리자용 ADMIN- 초대 코드로 가입한 계정만 이 페이지를 사용할 수 있습니다.
      </p>
      <a class="btn" href="dashboard.html">내 페이지로 돌아가기</a>
    `;
    return false;
  }

  return true;
}

function statusOf(row) {
  if (row.used_at) return '사용 완료';
  if (row.expires_at && new Date(row.expires_at) < new Date()) return '만료';
  return '미사용';
}

async function loadCodes() {
  if (!(await requireAdmin())) return;

  const { data, error } = await db
    .from('invite_codes')
    .select('code, created_at, expires_at, used_at, used_by')
    .order('created_at', { ascending: false });

  if (error) {
    msg.className = 'message error';
    msg.textContent = `초대 코드 목록을 불러오지 못했습니다: ${error.message}`;
    return;
  }

  codesBody.innerHTML = (data || []).map(r => `
    <tr>
      <td class="code">${r.code}</td>
      <td>${statusOf(r)}</td>
      <td>${new Date(r.created_at).toLocaleString()}</td>
      <td>${r.expires_at ? new Date(r.expires_at).toLocaleString() : '-'}</td>
      <td>${r.used_by ? r.used_by.slice(0, 8) + '…' : '-'}</td>
    </tr>
  `).join('');
}

createBtn.addEventListener('click', async () => {
  createBtn.disabled = true;
  msg.className = 'message';
  msg.textContent = '코드 발급 중...';

  try {
    const raw = expiresDays.value;
    const days = raw === '' ? null : Number(raw);

    const { data, error } = await db.rpc('create_invite_code', {
      p_expires_days: days
    });

    if (error) {
      msg.className = 'message error';
      msg.textContent = `코드 발급 실패: ${error.message}`;
      return;
    }

    msg.className = 'message success';
    msg.textContent = `새 초대 코드: ${data}`;
    await loadCodes();
  } finally {
    createBtn.disabled = false;
  }
});

loadCodes();
