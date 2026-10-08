const nicknameEl = document.querySelector('#nickname');
const usernameEl = document.querySelector('#username');
const bioEl = document.querySelector('#bio');

async function loadPublicProfile() {
  const params = new URLSearchParams(location.search);
  const requested = (params.get('u') || '').trim().toLowerCase();

  if (!requested) {
    nicknameEl.textContent = '프로필을 찾을 수 없습니다.';
    usernameEl.textContent = '';
    bioEl.textContent = '';
    return;
  }

  const { data, error } = await db
    .from('profiles')
    .select('nickname, username, bio, theme')
    .eq('username', requested)
    .maybeSingle();

  if (error) {
    nicknameEl.textContent = '프로필을 불러오지 못했습니다.';
    usernameEl.textContent = '';
    bioEl.textContent = error.message;
    return;
  }

  if (!data) {
    nicknameEl.textContent = '프로필을 찾을 수 없습니다.';
    usernameEl.textContent = '@' + requested;
    bioEl.textContent = '';
    return;
  }

  document.title = `${data.nickname} · mint info`;
  nicknameEl.textContent = data.nickname || data.username;
  usernameEl.textContent = '@' + data.username;
  bioEl.textContent = data.bio || '';

  const theme = data.theme || {};
  if (theme.background) document.body.style.background = theme.background;
  if (theme.accent) {
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--accent-deep', theme.accent);
  }
}

loadPublicProfile();
