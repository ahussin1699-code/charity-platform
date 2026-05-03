const sb = createSupabaseClient();

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const toggleButton = input.parentNode.querySelector(".password-toggle");

    if (input.type === "password") {
        input.type = "text";
        if (toggleButton) toggleButton.textContent = "🔒";
    } else {
        input.type = "password";
        if (toggleButton) toggleButton.textContent = "👁";
    }
}

const resetForm = document.getElementById("resetForm");
if (resetForm) {
    resetForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const newPassword = document.getElementById("newPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const errorMsg = document.getElementById("errorMsg");
        const successMsg = document.getElementById("successMsg");
        const resetButton = document.getElementById("resetButton");

        if (errorMsg) errorMsg.style.display = "none";
        if (successMsg) successMsg.style.display = "none";

        if (newPassword.length < 8) {
            if (errorMsg) {
                errorMsg.textContent = "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
                errorMsg.style.display = "block";
            }
            return;
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(newPassword)) {
            if (errorMsg) {
                errorMsg.textContent =
                    "كلمة المرور يجب أن تحتوي على حرف كبير، حرف صغير، ورقم واحد على الأقل";
                errorMsg.style.display = "block";
            }
            return;
        }

        if (newPassword !== confirmPassword) {
            if (errorMsg) {
                errorMsg.textContent = "كلمتا المرور غير متطابقتين";
                errorMsg.style.display = "block";
            }
            return;
        }

        if (resetButton) {
            resetButton.innerHTML = 'جاري حفظ كلمة المرور <span class="loader"></span>';
            resetButton.disabled = true;
        }

        try {
            const { error } = await sb.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            if (successMsg) {
                successMsg.textContent =
                    "تم إعادة تعيين كلمة المرور بنجاح! سيتم توجيهك الآن.";
                successMsg.style.display = "block";
            }

            const newPasswordInput = document.getElementById("newPassword");
            const confirmPasswordInput = document.getElementById("confirmPassword");
            if (newPasswordInput) newPasswordInput.value = "";
            if (confirmPasswordInput) confirmPasswordInput.value = "";

            const strengthBar = document.getElementById("passwordStrength");
            if (strengthBar) strengthBar.className = "password-strength-bar";

            const requirements = document.querySelectorAll(".requirement");
            requirements.forEach((req) => {
                req.className = "requirement invalid";
            });

            setTimeout(() => {
                window.location.href = "الصفحه الرئسيه.html";
            }, 2000);
        } catch (error) {
            console.error("خطأ في تحديث كلمة المرور:", error);
            if (errorMsg) {
                errorMsg.textContent =
                    "حدث خطأ: " +
                    (error.message || "لا يمكن تحديث كلمة المرور حالياً");
                errorMsg.style.display = "block";
            }
        } finally {
            if (resetButton) {
                resetButton.innerHTML = "حفظ كلمة المرور";
                resetButton.disabled = false;
            }
        }
    });
}

function goBack() {
    history.back();
}
