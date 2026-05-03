const sb = createSupabaseClient();

async function sendReset() {
  const emailValue = document.getElementById('email')?.value.trim() || '';
  const errorMsg = document.getElementById('errorMsg');
  const successMsg = document.getElementById('successMsg');
  const sendButton = document.getElementById('sendButton');

  if (errorMsg) errorMsg.style.display = 'none';
  if (successMsg) successMsg.style.display = 'none';

  if (!emailValue) {
    if (errorMsg) {
      errorMsg.textContent = "يرجى إدخال البريد الإلكتروني أو رقم الهاتف";
      errorMsg.style.display = 'block';
    }
    return;
  }

  let finalEmail = emailValue;
  let isPhone = false;

  if (!emailValue.includes('@')) {
    // تحقق إن الإدخال رقم هاتف
    const phoneRegex = /^(\+20|0)?1[0125]\d{8}$/;
    const cleaned = emailValue.replace(/\s/g, '');
    if (phoneRegex.test(cleaned)) {
      isPhone = true;
      // تحويل للصيغة الدولية
      finalEmail = cleaned.startsWith('+') ? cleaned : '+2' + (cleaned.startsWith('0') ? cleaned : '0' + cleaned);
    } else {
      if (errorMsg) {
        errorMsg.textContent = "يرجى إدخال بريد إلكتروني صحيح أو رقم هاتف مصري صحيح";
        errorMsg.style.display = 'block';
      }
      return;
    }
  }

  if (sendButton) {
    sendButton.innerHTML = 'جاري الإرسال...';
    sendButton.disabled = true;
  }

  try {
    let error;

    if (isPhone) {
      // SMS — بدون shouldCreateUser عشان يسمح بالإرسال حتى لو الرقم مش مسجل
      ({ error } = await sb.auth.signInWithOtp({
        phone: finalEmail
      }));
      sessionStorage.setItem("otp_phone", finalEmail);
      sessionStorage.setItem("otp_type", "sms");
    } else {
      ({ error } = await sb.auth.signInWithOtp({
        email: finalEmail,
        options: { shouldCreateUser: false, emailRedirectTo: null }
      }));
      sessionStorage.setItem("otp_email", finalEmail);
      localStorage.setItem("reset_email", finalEmail);
      sessionStorage.setItem("otp_type", "email");
    }

    if (error) throw error;

    if (successMsg) {
      successMsg.textContent = isPhone
        ? "تم إرسال رمز التحقق إلى هاتفك عبر SMS."
        : "تم إرسال رمز التحقق إلى بريدك الإلكتروني.";
      successMsg.style.display = 'block';
    }
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.value = '';
    setTimeout(() => {
      window.location.href = "ادخال رمز التحقق.html";
    }, 1500);
  } catch (error) {
    console.error("Error resetting password:", error);
    if (errorMsg) {
      errorMsg.textContent = "حدث خطأ: " + (error.message || "لا يمكن إرسال الطلب حالياً");
      errorMsg.style.display = 'block';
    }
  } finally {
    if (sendButton) {
      sendButton.innerHTML = 'إرسال رابط إعادة التعيين';
      sendButton.disabled = false;
    }
  }
}

function login() {
  window.location.href = "تسجيل الدخول .html";
}

function goBack() {
  history.back();
}

const emailInputEl = document.getElementById('email');
if (emailInputEl) {
  emailInputEl.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendReset();
    }
  });
}
