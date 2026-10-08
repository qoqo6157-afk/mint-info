const body = document.querySelector('#codesBody');
const msg = document.querySelector('#message');

async function requireAdmin() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    location.href = 'login.html';
    return false;
  }

  const { data, error } = await db.rpc('is_admin');
  if (error || !data) {
    document.querySelector('.card').innerHTML =
      '<h1>접근 권한 없음</h1><p>관리자 계정만 사용할 수 있습니다.</p><a href="dashboard.html">내 페이지로 돌아가기</a>';
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
    msg.textContent = error.message;
    return;
  }

  body.innerHTML = data.map(r => `
    <tr>
      <td class="code">${r.code}</td>
      <td>${statusOf(r)}</td>
      <td>${new Date(r.created_at).toLocaleString()}</td>
      <td>${r.expires_at ? new Date(r.expires_at).toLocaleString() : '-'}</td>
      <td>${r.used_by ? r.used_by.slice(0,8) + '…' : '-'}</td>
    </tr>
  `).join('');
}

createBtn.addEventListener('click', async () => {
  msg.className = 'message';
  msg.textContent = '코드 발급 중...';

  const raw = expiresDays.value;
  const days = raw === '' ? null : Number(raw);

  const { data, error } = await db.rpc('create_invite_code', { p_expires_days: days });

  if (error) {
    msg.className = 'message error';
    msg.textContent = error.message;
    return;
  }

  msg.className = 'message success';
  msg.textContent = `새 코드: ${data}`;
  await loadCodes();
});

loadCodes();
