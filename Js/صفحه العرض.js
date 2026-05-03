const sb = createSupabaseClient();

const menuBtnP = document.getElementById('menuBtn');
const mainNavP = document.querySelector('nav.main-nav');
if (menuBtnP && mainNavP) {
    menuBtnP.addEventListener('click', () => {
        mainNavP.classList.toggle('active');
    });
}

async function logout() {
    if (sb) await sb.auth.signOut();
    window.location.href = "صفحه العرض.html";
}

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await logout();
    });
}

async function checkAuthState() {
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user && loginBtn) {
        loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><span>تسجيل الدخول</span>';
        loginBtn.href = "تسجيل الدخول .html";
        loginBtn.id = "loginBtn";
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
    }
}

window.addEventListener('load', () => {
    checkUserAndImage();
    checkAuthState();
    loadRecentCases();
});

async function loadRecentCases() {
    if (!sb) return;
    
    const { data, error } = await sb
        .from('cases')
        .select('*')
        .gt('remaining_amount', 0)
        .order('created_at', { ascending: false })
        .limit(3);

    if (error || !data || data.length === 0) return;

    const container = document.getElementById('recentCasesContainer');
    const section = document.getElementById('recentCasesSection');
    
    if (!container || !section) return;

    container.innerHTML = '';
    data.forEach(item => {
        const card = `
            <div class="grid-card" style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1); display: flex; flex-direction: column; width: 100%;">
                <img src="${item.image_url || '../صور المشروع/تبرع.jpg'}" alt="${item.name}" style="width: 100%; height: 200px; object-fit: cover;">
                <div style="padding: 20px; flex-grow: 1; display: flex; flex-direction: column; align-items: center; text-align: center;">
                    <h3 style="margin-bottom: 10px; color: #0b5e32; font-size: 1.2rem;">${item.name}</h3>
                    <p style="font-size: 0.9rem; color: #666; margin-bottom: 15px; height: 3em; overflow: hidden;">${item.description?.substring(0, 60)}...</p>
                    <a href="تفاصيل الحاله.html?id=${item.id}" style="display: block; width: 100%; max-width: 200px; background: #fdd835; color: #000; padding: 10px; border-radius: 25px; text-decoration: none; font-weight: bold; transition: 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">عرض التفاصيل</a>
                </div>
            </div>
        `;
        container.innerHTML += card;
    });

    section.style.display = 'block';
}
