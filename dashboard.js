const msg = document.querySelector('#message');
let currentUser = null;

async function requireUser() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    location.href = 'login.html';
    return null;
  }
  return user;
}

async function loadProfile() {
  currentUser = await requireUser();
  if (!currentUser) return;

  const { data, error } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
  if (error) {
    msg.className = 'message error';
    msg.textContent = error.message;
    return;
  }

  nickname.value = data.nickname || '';
  username.value = data.username || '';
  bio.value = data.bio || '';
  bgColor.value = data.theme?.background || '#fff3f8';
  accentColor.value = data.theme?.accent || '#ff7bac';
  previewLink.href = `profile.html?u=${encodeURIComponent(data.username)}`;
}

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '저장 중...';
  msg.className = 'message';

  const payload = {
    nickname: nickname.value.trim(),
    username: username.value.trim(),
    bio: bio.value.trim(),
    theme: {
      background: bgColor.value,
      accent: accentColor.value
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await db.from('profiles').update(payload).eq('id', currentUser.id);
  if (error) {
    msg.className = 'message error';
    msg.textContent = error.code === '23505' ? '이미 사용 중인 주소용 아이디입니다.' : error.message;
    return;
  }

  previewLink.href = `profile.html?u=${encodeURIComponent(payload.username)}`;
  msg.className = 'message success';
  msg.textContent = '저장했습니다.';
});

logoutBtn.addEventListener('click', async () => {
  await db.auth.signOut();
  location.href = 'index.html';
});

loadProfile();
