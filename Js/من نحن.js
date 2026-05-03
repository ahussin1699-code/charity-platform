const sb = createSupabaseClient();

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
            const toolbarProfileImg = document.getElementById("toolbarProfileImg");
            if (toolbarProfileImg) toolbarProfileImg.src = profileImgSrc;
            const navProfileImg = document.getElementById("navProfileImg");
            if (navProfileImg) navProfileImg.src = profileImgSrc;
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
        authBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket" style="font-size:1.3rem;color:#fff;"></i><span style="font-size:clamp(0.7rem,1.5vw,0.85rem);font-weight:600;color:#fff;">خروج</span>';
        authBtn.href = "#";
        authBtn.onclick = async function(e) {
            e.preventDefault();
            await logout();
        };
    } else {
        authBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket" style="font-size:1.3rem;color:#fff;"></i><span style="font-size:clamp(0.7rem,1.5vw,0.85rem);font-weight:600;color:#fff;">تسجيل الدخول</span>';
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

const menuBtn = document.getElementById('menuBtn');
const mainNav = document.querySelector('nav.main-nav');
if (menuBtn && mainNav) {
    menuBtn.addEventListener('click', () => {
        mainNav.classList.toggle('active');
        const icon = menuBtn.querySelector('i');
        if (icon) icon.className = mainNav.classList.contains('active')
            ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    mainNav.querySelectorAll('.nav-item').forEach(a => {
        a.addEventListener('click', () => {
            mainNav.classList.remove('active');
            const icon = menuBtn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-bars';
        });
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('header') && mainNav.classList.contains('active')) {
            mainNav.classList.remove('active');
            const icon = menuBtn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-bars';
        }
    });
}

function goHome() {
    window.location.href = "الصفحه الرئسيه.html";
}

function goContact() {
    window.location.href = "اتصال بنا.html";
}

function featureClick(message) {
    alert(message);
}

