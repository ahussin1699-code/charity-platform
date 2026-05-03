const menuBtnA = document.getElementById('menuBtn');
const mainNavA = document.querySelector('nav.main-nav');
if (menuBtnA && mainNavA) {
    menuBtnA.addEventListener('click', () => {
        mainNavA.classList.toggle('active');
        const icon = menuBtnA.querySelector('i');
        if (icon) icon.className = mainNavA.classList.contains('active')
            ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    mainNavA.querySelectorAll('.nav-item').forEach(a => {
        a.addEventListener('click', () => {
            mainNavA.classList.remove('active');
            const icon = menuBtnA.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-bars';
        });
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('header') && mainNavA.classList.contains('active')) {
            mainNavA.classList.remove('active');
            const icon = menuBtnA.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-bars';
        }
    });
}

const sb = createSupabaseClient();
const ADMIN_EMAIL = 'ahussin9125@gmail.com';

async function checkUserAndImage() {
    if (!sb) return;
    const { data } = await sb.auth.getUser();
    const user = data && data.user;
    
    if (user) {
        const { data: userData } = await sb
            .from('users')
            .select('profile_image')
            .eq('email', user.email)
            .maybeSingle();

        const profileImgSrc = userData?.profile_image || localStorage.getItem(`profileImage_${user.id}`);
        if (profileImgSrc) {
            const toolbarProfileImg = document.getElementById("toolbarProfileImg");
            if (toolbarProfileImg) toolbarProfileImg.src = profileImgSrc;
            const navProfileImg = document.getElementById("navProfileImg");
            if (navProfileImg) navProfileImg.src = profileImgSrc;
        }

        const metaIsAdmin = user.user_metadata && (user.user_metadata.is_admin === true || user.user_metadata.role === 'admin');
        const emailIsAdmin = user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        const isAdmin = !!(metaIsAdmin || emailIsAdmin);
        const isBeneficiary = user.user_metadata && (user.user_metadata.user_type === 'beneficiary' || user.user_metadata.user_type === 'مستفيد');

        const addCaseLink = document.getElementById('addCaseLink');
        if (addCaseLink) {
            addCaseLink.style.display = (isAdmin || isBeneficiary) ? 'flex' : 'none';
        }
    }
}

async function logout() {
    if (sb) await sb.auth.signOut();
    window.location.href = "صفحه العرض.html";
}

async function checkAuthState() {
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    const authBtn = document.getElementById("authBtn");
    if (!authBtn) return;

    if (user) {
        authBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i><span>خروج</span>';
        authBtn.href = "#";
        authBtn.onclick = async function(e) {
            e.preventDefault();
            await logout();
        };
    } else {
        authBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><span>تسجيل الدخول</span>';
        authBtn.href = "تسجيل الدخول .html";
        authBtn.onclick = null;
    }
}

const toolbarLogoutBtn = document.getElementById("toolbarLogoutBtn");
if (toolbarLogoutBtn) {
    toolbarLogoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await logout();
    });
}

window.addEventListener('load', () => {
    checkUserAndImage();
    checkAuthState();
});

document.getElementById('contactForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!name || !email || !message) {
        alert('يرجى ملء جميع الحقول المطلوبة');
        return;
    }

    if (!sb) {
        alert('حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً');
        return;
    }

    try {
        const { error: msgError } = await sb
            .from('contact_messages')
            .insert({
                name: name,
                email: email,
                message: message
            });

        if (msgError) throw msgError;

        const { error: notifError } = await sb
            .from('notifications')
            .insert({
                title: 'رسالة تواصل جديدة من ' + name,
                message: message,
                type: 'contact',
                is_read: false
            });

        if (notifError) {
            console.warn('خطأ في حفظ إشعار التواصل:', notifError);
        }

        alert('شكراً لتواصلك يا ' + name + '، تم استلام رسالتك بنجاح.');
        this.reset();
    } catch (error) {
        console.error('خطأ في إرسال رسالة التواصل:', error);
        const msg = error && error.message ? error.message : '';
        alert('حدث خطأ أثناء إرسال الرسالة: ' + msg);
    }
});
