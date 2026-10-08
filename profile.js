async function loadPublicProfile() {
  const params = new URLSearchParams(location.search);
  const u = params.get('u');

  if (!u) {
    nickname.textContent = '프로필을 찾을 수 없습니다.';
    return;
  }

  const { data, error } = await db
    .from('profiles')
    .select('nickname, username, bio, theme')
    .eq('username', u)
    .single();

  if (error || !data) {
    nickname.textContent = '프로필을 찾을 수 없습니다.';
    username.textContent = '';
    bio.textContent = '';
    return;
  }

  document.title = `${data.nickname} · mint info`;
  nickname.textContent = data.nickname;
  username.textContent = '@' + data.username;
  bio.textContent = data.bio || '';

  const theme = data.theme || {};
  if (theme.background) document.body.style.background = theme.background;
  if (theme.accent) document.documentElement.style.setProperty('--accent', theme.accent);
}

loadPublicProfile();
