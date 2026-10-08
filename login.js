const form = document.querySelector('#loginForm');
const msg = document.querySelector('#message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.className = 'message';
  msg.textContent = '로그인 중...';

  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    msg.className = 'message error';
    msg.textContent = '이메일 또는 비밀번호를 확인해 주세요.';
    return;
  }

  location.href = 'dashboard.html';
});
