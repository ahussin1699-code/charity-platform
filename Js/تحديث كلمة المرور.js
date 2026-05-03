const sb = createSupabaseClient();

function togglePasswordVisibility(inputId, icon) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

async function updatePassword() {
    const passwordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');
    const updateBtn = document.getElementById('updateBtn');

    const password = passwordInput ? passwordInput.value : '';
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

    errorMsg.style.display = 'none';
    successMsg.style.display = 'none';

    if (password.length < 8) {
        errorMsg.textContent = "يجب أن تكون كلمة المرور 8 أحرف على الأقل";
        errorMsg.style.display = 'block';
        return;
    }

    if (password !== confirmPassword) {
        errorMsg.textContent = "كلمتا المرور غير متطابقتين";
        errorMsg.style.display = 'block';
        return;
    }

    updateBtn.disabled = true;
    updateBtn.textContent = "جاري الحفظ...";

    try {
        const { error } = await sb.auth.updateUser({ password: password });
        
        if (error) throw error;

        successMsg.textContent = "تم تحديث كلمة المرور بنجاح! سيتم توجيهك الآن...";
        successMsg.style.display = 'block';
        
        setTimeout(() => {
            window.location.href = "تم اجراء التغير بنجاح.html";
        }, 2000);

    } catch (error) {
        console.error("Update error:", error);
        errorMsg.textContent = "حدث خطأ: " + error.message;
        errorMsg.style.display = 'block';
        updateBtn.disabled = false;
        updateBtn.textContent = "حفظ كلمة المرور";
    }
}
