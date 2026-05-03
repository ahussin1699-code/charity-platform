// ===== OTP Verification Page =====
(function () {

    const sb = createSupabaseClient();

    // ---- عرض الإيميل أو الهاتف المحفوظ ----
    const savedEmail = sessionStorage.getItem("otp_email") || localStorage.getItem("reset_email") || "";
    const savedPhone = sessionStorage.getItem("otp_phone") || "";
    const otpType    = sessionStorage.getItem("otp_type") || "email";
    const savedContact = otpType === "sms" ? savedPhone : savedEmail;

    if (savedContact) {
        const el = document.getElementById("emailDisplay");
        if (el) el.textContent = savedContact;
    }

    // ---- OTP مولّد محلياً (6 أرقام) ----
    // يُخزَّن في sessionStorage عند إرساله من صفحة نسيت كلمة المرور
    let generatedOtp = sessionStorage.getItem("otp_code") || "";

    // ---- التنقل بين الخانات ----
    const boxes = document.querySelectorAll(".otp-box");

    boxes.forEach((box, i) => {
        box.addEventListener("input", (e) => {
            const val = e.target.value.replace(/\D/g, "");
            e.target.value = val ? val[0] : "";

            if (val && i < boxes.length - 1) {
                boxes[i + 1].focus();
            }

            box.classList.toggle("filled", !!e.target.value);
            clearError();
        });

        box.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !box.value && i > 0) {
                boxes[i - 1].focus();
                boxes[i - 1].value = "";
                boxes[i - 1].classList.remove("filled");
            }
            if (e.key === "Enter") verifyOtp();
        });

        // دعم اللصق
        box.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData)
                .getData("text").replace(/\D/g, "").slice(0, 6);
            pasted.split("").forEach((ch, idx) => {
                if (boxes[idx]) {
                    boxes[idx].value = ch;
                    boxes[idx].classList.add("filled");
                }
            });
            const next = Math.min(pasted.length, boxes.length - 1);
            boxes[next].focus();
        });
    });

    // ---- قراءة الكود المدخل ----
    function getEnteredOtp() {
        return Array.from(boxes).map(b => b.value).join("");
    }

    function clearError() {
        document.getElementById("errorMsg").style.display = "none";
        boxes.forEach(b => b.classList.remove("error-box"));
    }

    function showError(msg) {
        const el = document.getElementById("errorMsg");
        el.textContent = msg || "الرمز غير صحيح، يرجى المحاولة مجدداً";
        el.style.display = "block";
        boxes.forEach(b => b.classList.add("error-box"));
        setTimeout(() => boxes.forEach(b => b.classList.remove("error-box")), 500);
    }

    function showSuccess() {
        document.getElementById("successMsg").style.display = "block";
        document.getElementById("errorMsg").style.display  = "none";
    }

    // ---- التحقق من الكود ----
    window.verifyOtp = async function () {
        const entered = getEnteredOtp();

        if (entered.length < 6) {
            showError("يرجى إدخال الرمز كاملاً (6 أرقام)");
            return;
        }

        const btn = document.getElementById("verifyBtn");
        btn.disabled = true;
        btn.textContent = "جاري التحقق...";

        // مقارنة الكود
        if (generatedOtp && entered === generatedOtp) {
            // كود صحيح — انتقل لصفحة إعادة تعيين كلمة المرور
            showSuccess();
            sessionStorage.setItem("otp_verified", "true");
            setTimeout(() => {
                window.location.href = "اعادة تعين كلمه المرور.html";
            }, 1500);
        } else {
            // محاولة التحقق عبر Supabase (في حال كان الكود مرسلاً من الخادم)
            try {
                let verifyError;
                if (otpType === "sms") {
                    ({ error: verifyError } = await sb.auth.verifyOtp({
                        phone: savedPhone,
                        token: entered,
                        type: "sms"
                    }));
                } else {
                    ({ error: verifyError } = await sb.auth.verifyOtp({
                        email: savedEmail,
                        token: entered,
                        type: "email"
                    }));
                }
                const error = verifyError;

                if (error) {
                    showError("الرمز غير صحيح أو منتهي الصلاحية");
                    btn.disabled = false;
                    btn.textContent = "تحقق من الرمز";
                } else {
                    showSuccess();
                    sessionStorage.setItem("otp_verified", "true");
                    setTimeout(() => {
                        window.location.href = "اعادة تعين كلمه المرور.html";
                    }, 1500);
                }
            } catch (_) {
                showError("حدث خطأ، يرجى المحاولة مجدداً");
                btn.disabled = false;
                btn.textContent = "تحقق من الرمز";
            }
        }
    };

    // ---- العد التنازلي وإعادة الإرسال ----
    let timerInterval;

    function startCountdown(seconds) {
        const countEl  = document.getElementById("countdown");
        const timerRow = document.querySelector(".timer-text");
        const resendBtn = document.getElementById("resendBtn");

        resendBtn.disabled = true;
        timerRow.style.display = "inline";
        let remaining = seconds;

        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            remaining--;
            countEl.textContent = remaining;
            if (remaining <= 0) {
                clearInterval(timerInterval);
                timerRow.style.display = "none";
                resendBtn.disabled = false;
            }
        }, 1000);
    }

    window.resendOtp = async function () {
        const contact = otpType === "sms" ? savedPhone : savedEmail;
        if (!contact) return;

        const resendBtn = document.getElementById("resendBtn");
        resendBtn.disabled = true;

        try {
            let resendError;
            if (otpType === "sms") {
                ({ error: resendError } = await sb.auth.signInWithOtp({
                    phone: savedPhone,
                    options: { shouldCreateUser: false }
                }));
            } else {
                ({ error: resendError } = await sb.auth.signInWithOtp({
                    email: savedEmail,
                    options: { shouldCreateUser: false, emailRedirectTo: null }
                }));
            }

            if (resendError) {
                showError("تعذّر إعادة الإرسال، حاول لاحقاً");
                resendBtn.disabled = false;
            } else {
                clearError();
                startCountdown(60);
            }
        } catch (_) {
            showError("تعذّر إعادة الإرسال");
            resendBtn.disabled = false;
        }
    };

    // ابدأ العد التنازلي عند تحميل الصفحة
    startCountdown(60);
    boxes[0].focus();

})();
