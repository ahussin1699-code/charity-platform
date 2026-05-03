const sb = createSupabaseClient();

async function checkUser() {
    if (!sb) return;
    const { data } = await sb.auth.getUser();
    const user = data.user;
    if (!user) {
        window.location.href = "تسجيل الدخول .html";
    } else {
        const loginBtn = document.getElementById("loginNavItem");
        if (loginBtn) loginBtn.style.display = "none";
    }
}

async function checkUserAndImage() {
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
        const { data: userData } = await sb
            .from('users')
            .select('profile_image')
            .eq('email', user.email)
            .maybeSingle();

        const profileImgSrc = userData?.profile_image || localStorage.getItem(`profileImage_${user.id}`);
        if (profileImgSrc) {
            const navProfileImg = document.getElementById("navProfileImg");
            if (navProfileImg) navProfileImg.src = profileImgSrc;
        }

        // إظهار الشريط الجانبي للأدمن فقط
        const ADMIN_EMAIL = 'ahussin9125@gmail.com';
        const meta = user.user_metadata || {};
        const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
            || meta.is_admin === true || meta.role === 'admin'
            || meta.user_type === 'مشرف' || meta.user_type === 'supervisor';

        const sidebar    = document.getElementById('sidebar');
        const menuToggle = document.getElementById('menuToggle');
        const wrapper    = document.getElementById('pageWrapper');

        if (isAdmin && sidebar) {
            sidebar.style.display = 'flex';
            if (wrapper) wrapper.style.marginRight = '260px';

            // زرار القائمة للموبايل فقط
            const updateToggle = () => {
                if (menuToggle) menuToggle.style.display = window.innerWidth < 992 ? 'flex' : 'none';
                if (wrapper) wrapper.style.marginRight = window.innerWidth < 992 ? '0' : '260px';
            };
            updateToggle();
            window.addEventListener('resize', updateToggle);

            // overlay + toggle
            const overlay = document.getElementById('sidebarOverlay');
            if (menuToggle) {
                menuToggle.addEventListener('click', () => {
                    sidebar.classList.toggle('open');
                    if (overlay) overlay.classList.toggle('active');
                });
            }
            if (overlay) overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            });

            // logout sidebar
            const logoutSidebar = document.getElementById('sidebarLogoutBtn');
            if (logoutSidebar) {
                logoutSidebar.addEventListener('click', async () => {
                    await sb.auth.signOut();
                    window.location.href = 'تسجيل الدخول .html';
                });
            }
        }
    }
}

async function logout() {
    if (!sb) return;
    await sb.auth.signOut();
    window.location.href = "صفحه العرض.html";
}

document.getElementById("logoutBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    await logout();
});

window.addEventListener('load', () => {
    checkUserAndImage();
    checkUser();

    // preview صورة/ملف الحالة
    const fileInput = document.getElementById('caseImageFile');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            const preview     = document.getElementById('caseImgPreview');
            const placeholder = document.getElementById('imgPlaceholder');
            const isImage = file.type.startsWith('image/');
            if (isImage) {
                const reader = new FileReader();
                reader.onload = e => {
                    if (preview)     { preview.src = e.target.result; preview.style.display = 'block'; }
                    if (placeholder) placeholder.style.display = 'none';
                };
                reader.readAsDataURL(file);
            } else {
                // ملف غير صورة — اعرض اسم الملف
                if (preview) preview.style.display = 'none';
                if (placeholder) {
                    placeholder.innerHTML = `<i class="fa-solid fa-file-lines" style="font-size:2rem;color:#2f6d3f"></i>
                        <span>${file.name}</span><small>${(file.size/1024).toFixed(0)} KB</small>`;
                }
            }
        });
    }
});

async function submitCase() {
    const name  = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;
    const address = document.getElementById("address")?.value || '';
    const type  = document.getElementById("caseType").value;
    const desc  = document.getElementById("description").value;

    if (!name || !email || !phone || !type || !desc) {
        alert("من فضلك املأ جميع البيانات");
        return;
    }

    // رفع صورة الحالة (مش الصورة الشخصية)
    let imageUrl = "../صور المشروع/تبرع.jpg";
    const imageFile = document.getElementById('caseImageFile')?.files[0];
    if (imageFile) {
        const ext      = imageFile.name.split('.').pop();
        const filePath = `cases/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await sb.storage.from('cases').upload(filePath, imageFile, { upsert: true });
        if (!uploadErr) {
            const { data: pub } = sb.storage.from('cases').getPublicUrl(filePath);
            imageUrl = pub.publicUrl;
        }
    }

    try {
        const { error } = await sb.from('cases').insert([{
            name, email, phone, address, type,
            description: desc,
            status: 'قيد المراجعة',
            required_amount: parseFloat(document.getElementById('requiredAmount')?.value) || 0,
            remaining_amount: parseFloat(document.getElementById('requiredAmount')?.value) || 1,
            image_url: imageUrl
        }]);

        if (error) throw error;

        // إرسال إشعار للأدمن
        try {
            const { data: adminUser } = await sb.from('users').select('id').eq('email', 'ahussin9125@gmail.com').maybeSingle();
            await sb.from('notifications').insert({
                title: 'طلب حالة جديد',
                message: `قدّم ${name} طلب مساعدة جديد. النوع: ${type}. الهاتف: ${phone}.`,
                type: 'user',
                is_read: false,
                user_id: adminUser?.id || null,
                created_at: new Date().toISOString()
            });
        } catch(e) { console.warn('notification error:', e.message); }

        document.getElementById("result").innerText = "تم إرسال الطلب بنجاح ✅ سيتم مراجعته من المشرف.";
        document.getElementById("name").value        = "";
        document.getElementById("email").value       = "";
        document.getElementById("phone").value       = "";
        document.getElementById("description").value = "";
        const prev = document.getElementById('caseImgPreview');
        const plh  = document.getElementById('imgPlaceholder');
        if (prev) { prev.src = ''; prev.style.display = 'none'; }
        if (plh)  plh.style.display = '';
    } catch (error) {
        console.error('Error submitting case:', error);
        alert("حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى.");
    }
}

function sendMessage() {
    const input = document.getElementById("chatInput");
    const message = input.value.trim();

    if (message === "") return;

    const chatBox = document.getElementById("chatBox");

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", "user-msg");
    msgDiv.innerText = message;

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    input.value = "";

    // رد تلقائي من المشرف (تجريبي)
    setTimeout(() => {
        const adminReply = document.createElement("div");
        adminReply.classList.add("message", "admin-msg");
        adminReply.innerText = "تم استلام رسالتك، سيتم الرد بعد مراجعة الحالة.";
        chatBox.appendChild(adminReply);
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 1000);
}
