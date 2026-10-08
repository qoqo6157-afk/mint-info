const form = document.querySelector('#signupForm');
const msg = document.querySelector('#message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.className = 'message';
  msg.textContent = '가입 처리 중...';

  const invite_code = document.querySelector('#inviteCode').value.trim().toUpperCase();
  const nickname = document.querySelector('#nickname').value.trim();
  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { invite_code, nickname }
    }
  });

  if (error) {
    msg.className = 'message error';
    const t = String(error.message || '');
    if (t.toLowerCase().includes('invite')) {
      msg.textContent = '초대 코드가 없거나, 이미 사용되었거나, 만료되었습니다.';
    } else {
      msg.textContent = t;
    }
    return;
  }

  msg.className = 'message success';
  if (data.session) {
    msg.textContent = '가입 완료! 내 페이지로 이동합니다.';
    setTimeout(() => location.href = 'dashboard.html', 700);
  } else {
    msg.textContent = '가입 요청 완료! 이메일 인증이 켜져 있다면 메일함에서 인증 후 로그인해 주세요.';
  }
});
