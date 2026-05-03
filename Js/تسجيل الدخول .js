const sb = createSupabaseClient();

const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

if (togglePassword && passwordInput) {
  togglePassword.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.textContent = type === 'password' ? '👁️' : '🔒';
  });
}

const googleLoginIcon = document.getElementById('googleLoginIcon');
if (googleLoginIcon) {
  const startGoogleLogin = async () => {
    if (!sb) return;
    try {
      const isHttp = /^https?:\/\//i.test(window.location.origin);
      const redirectUrl = isHttp
        ? (window.location.origin + '/html/الصفحه الرئسيه.html')
        : 'http://localhost:3000/html/الصفحه الرئسيه.html';
      await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });
    } catch (err) {
      const errorMsg = document.getElementById('errorMsg');
      if (errorMsg) {
        errorMsg.textContent = 'تعذر بدء تسجيل الدخول عبر جوجل';
        errorMsg.style.display = 'block';
      }
      console.error('Google OAuth error:', err);
    }
  };
  googleLoginIcon.addEventListener('click', startGoogleLogin);
  googleLoginIcon.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' || e.key === ' ') startGoogleLogin();
  });
}
document.addEventListener('DOMContentLoaded', async () => {
  if (!sb) return;
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    try {
      const { data: userData } = await sb
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      const role = userData?.user_type ? userData.user_type.trim() : (user.user_metadata?.user_type || '').trim();
      if (role === 'admin' || role === 'مسؤول') {
        window.location.href = "لوحه التحكم .html";
        return;
      }
      if (role === 'doctor' || role === 'طبيب') {
        window.location.href = "التقارير الطبيه.html";
        return;
      }
    } catch (_) {}
    window.location.href = "الصفحه الرئسيه.html";
  } catch (err) {
    console.warn('OAuth session check failed:', err);
  }
});
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const contact = document.getElementById('contact').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    const loginButton = document.getElementById('loginButton');

    errorMsg.style.display = 'none';

    const isEmail = contact.includes("@");
    const isPhone = /^\d+$/.test(contact.replace(/[+\-() ]/g, '')) && contact.length >= 10;

    if (!isEmail && !isPhone) {
      errorMsg.textContent = "يرجى إدخال بريد إلكتروني صحيح أو رقم هاتف صالح";
      errorMsg.style.display = 'block';
      return;
    }

    let authParams = {};
    if (isEmail) {
      authParams = { email: contact, password: password };
    } else {
      let formattedPhone = contact.replace(/[+\-() ]/g, '');
      if (formattedPhone.startsWith('01') && formattedPhone.length === 11) {
        formattedPhone = '+2' + formattedPhone;
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      const dummyEmail = formattedPhone.replace('+', '') + "@charity.internal";
      authParams = { email: dummyEmail, password: password };
    }

    if (password.length < 6) {
      errorMsg.textContent = "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
      errorMsg.style.display = 'block';
      return;
    }

    loginButton.innerHTML = 'جاري تسجيل الدخول <span class="loader"></span>';
    loginButton.disabled = true;

    if (!sb) {
      errorMsg.textContent = "خطأ في الاتصال بالخادم";
      errorMsg.style.display = 'block';
      loginButton.innerHTML = 'تسجيل الدخول';
      loginButton.disabled = false;
      return;
    }

    const { data, error } = await sb.auth.signInWithPassword(authParams);

    loginButton.innerHTML = 'تسجيل الدخول';
    loginButton.disabled = false;

    function showGreeting(name) {
      if (name) {
        alert('هلا ' + name);
      }
    }

    if (error) {
      errorMsg.textContent = error.message;
      errorMsg.style.display = 'block';
    } else {
      const currentUserId = data.user.id;
      const adminId = '22f2417c-e985-4aec-a2d1-9d77a2922f3f';

      try {
        const { data: userData, error: userError } = await sb
          .from('users')
          .select('*')
          .eq('id', currentUserId)
          .maybeSingle();

        if (currentUserId === adminId) {
          if (!userData) {
            await sb.from('users').insert([{
              id: adminId,
              user_type: 'admin',
              status: 'نشط',
              name: 'الآدمن الرئيسي',
              email: data.user.email,
              created_at: new Date().toISOString()
            }]).select();
          }

          window.location.href = "لوحه التحكم .html";
          return;
        }

        if (userError) throw userError;

        if (!userData) {
          await sb.auth.signOut();
          errorMsg.textContent = "هذا الحساب غير موجود أو تم حذفه من النظام.";
          errorMsg.style.display = 'block';
          return;
        }

        const currentStatus = userData.status ? userData.status.trim() : "";
        const currentRole = userData.user_type ? userData.user_type.trim() : (userData.role ? userData.role.trim() : "user");
        
        if (currentStatus === "محظور" || currentStatus === "محذوف") {
          await sb.auth.signOut();
          errorMsg.textContent = "عذراً، هذا الحساب محظور أو تم حذفه من دخول المنصة.";
          errorMsg.style.display = 'block';
          return;
        }

        if (currentRole === "admin" || currentRole === "مسؤول") {
          window.location.href = "لوحه التحكم .html";
          return;
        }

        if (currentRole === "doctor" || currentRole === "طبيب") {
          window.location.href = "التقارير الطبيه.html";
          return;
        }

        showGreeting(userData?.name || data.user.user_metadata?.full_name || data.user.email);
        window.location.href = "الصفحه الرئسيه.html";

      } catch (err) {
        console.error("خطأ في التحقق من البيانات:", err);
        window.location.href = "الصفحه الرئسيه.html";
      }
    }
  });
}
