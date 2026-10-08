const nicknameEl = document.querySelector('#nickname');
const usernameEl = document.querySelector('#username');
const bioEl = document.querySelector('#bio');

async function loadPublicProfile() {
  const params = new URLSearchParams(location.search);
  let requested = (params.get('u') || '').trim().toLowerCase();

  if (!requested) {
    const parts = location.pathname.split('/').filter(Boolean);
    const knownFiles = new Set([
      'index.html','login.html','signup.html','dashboard.html',
      'admin.html','profile.html','404.html'
    ]);
    const last = parts[parts.length - 1] || '';
    if (last && !knownFiles.has(last) && !last.includes('.')) {
      requested = decodeURIComponent(last).trim().toLowerCase();
    }
  }

  if (!requested) {
    nicknameEl.textContent = '프로필을 찾을 수 없습니다.';
    usernameEl.textContent = '';
    bioEl.textContent = '';
    return;
  }

  const { data, error } = await db.rpc('get_public_profile', {
    p_username: requested
  });

  if (error) {
    nicknameEl.textContent = '프로필을 불러오지 못했습니다.';
    usernameEl.textContent = '@' + requested;
    bioEl.textContent = error.message;
    return;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    nicknameEl.textContent = '프로필을 찾을 수 없습니다.';
    usernameEl.textContent = '@' + requested;
    bioEl.textContent = '';
    return;
  }

  document.title = `${row.nickname} · mint info`;
  nicknameEl.textContent = row.nickname || row.username;
  usernameEl.textContent = '@' + row.username;
  bioEl.textContent = row.bio || '';

  const theme = row.theme || {};
  if (theme.background) document.body.style.background = theme.background;
  if (theme.accent) {
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--accent-deep', theme.accent);
  }
}

loadPublicProfile();
