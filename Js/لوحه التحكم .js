const sb = createSupabaseClient();

document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.className = sidebar.classList.contains('active')
                    ? 'fas fa-xmark' : 'fas fa-bars';
            }
        });

        document.addEventListener('click', function(event) {
            if (
                !sidebar.contains(event.target) &&
                !menuToggle.contains(event.target) &&
                sidebar.classList.contains('active')
            ) {
                sidebar.classList.remove('active');
                const icon = menuToggle.querySelector('i');
                if (icon) icon.className = 'fas fa-bars';
            }
        });
    }
});

async function loadAdminProfile() {
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const { data: userData } = await sb
        .from('users')
        .select('name, profile_image')
        .eq('email', user.email)
        .maybeSingle();

    const fullName = userData?.name || user.user_metadata?.full_name || user.email || "";
    const nameEl = document.getElementById('adminName');
    if (nameEl && fullName) nameEl.textContent = fullName;

    const savedImage = userData?.profile_image || localStorage.getItem(`profileImage_${user.id}`);
    const imgEl = document.getElementById('adminProfileImg');
    if (imgEl && savedImage) imgEl.src = savedImage;
    if (imgEl) {
        imgEl.style.cursor = 'pointer';
        imgEl.addEventListener('click', function () {
            window.location.href = "الصفحه الشخصية.html";
        });
    }

    // التحقق من نوع المستخدم لإخفاء الشريط الجانبي إذا كان طبيباً
    if (userData?.user_type === 'طبيب') {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');
        const menuToggle = document.getElementById('menuToggle');
        
        if (sidebar) sidebar.style.display = 'none';
        if (menuToggle) menuToggle.style.display = 'none';
        if (mainContent) {
            mainContent.style.marginRight = '0';
            mainContent.style.width = '100%';
        }
    }
}

async function loadDashboardStats() {
    if (!sb) return;

    try {
        // 1. إجمالي الحالات
        const { count: totalCases } = await sb
            .from('cases')
            .select('*', { count: 'exact', head: true });

        // 2. حالات تم مساعدتها (مكتملة)
        const { count: completedCases } = await sb
            .from('cases')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'مكتمل');

        // 3. حالات نشطة (مقبولة)
        const { count: activeCases } = await sb
            .from('cases')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'مقبول');

        // تحديث الواجهة
        const totalCasesEl = document.getElementById('totalBeneficiaryCases');
        const completedCasesEl = document.getElementById('donatedCasesCount');
        const activeCasesEl = document.getElementById('activeCasesCount');

        if (totalCasesEl) totalCasesEl.textContent = totalCases || 0;
        if (completedCasesEl) completedCasesEl.textContent = completedCases || 0;
        if (activeCasesEl) activeCasesEl.textContent = activeCases || 0;

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadRecentActivity() {
    if (!sb) return;

    const tbody = document.getElementById('recentDonationsBody');
    if (!tbody) return;

    try {
        const { data: cases, error } = await sb
            .from('cases')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!cases || cases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">لا توجد حالات مسجلة حالياً</td></tr>';
            return;
        }

        tbody.innerHTML = cases.map(c => {
            const statusClass = c.status === 'مكتمل' ? 'status-completed'
                : c.status === 'مقبول' ? 'status-approved'
                : 'status-pending';
            return `
            <tr>
                <td>${c.name}</td>
                <td>${c.type || 'إنسانية'}</td>
                <td>${new Date(c.created_at).toLocaleDateString('ar-EG')}</td>
                <td><span class="status-badge ${statusClass}">${c.status || 'قيد المراجعة'}</span></td>
                <td><a href="تفاصيل الحاله.html?id=${c.id}" class="action-view-btn"><i class="fas fa-eye"></i> عرض</a></td>
            </tr>
        `}).join('');

    } catch (error) {
        console.error('Error loading recent activity:', error);
        tbody.innerHTML = '<tr><td colspan="5">حدث خطأ أثناء تحميل البيانات</td></tr>';
    }
}

async function handleLogout() {
    if (!sb) return;
    const { error } = await sb.auth.signOut();
    if (error) {
        console.error('Logout error:', error);
        alert('حدث خطأ أثناء تسجيل الخروج');
    } else {
        window.location.href = "تسجيل الدخول .html";
    }
}

window.addEventListener('load', () => {
    loadAdminProfile();
    loadDashboardStats();
    loadRecentActivity();

    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});
