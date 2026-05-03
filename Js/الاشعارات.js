const sb = createSupabaseClient();

let notificationModalBackdrop;

document.addEventListener('DOMContentLoaded', async function () {

    await loadAdminHeaderInfo();
    await loadNotifications();
    setupEventListeners();

});

// ===== تحميل بيانات المستخدم وإظهار الشريط للأدمن فقط =====
async function loadAdminHeaderInfo() {
    if (!sb) return;
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;

        const { data: userData } = await sb
            .from('users')
            .select('name, profile_image, user_type')
            .eq('email', user.email)
            .maybeSingle();

        const adminName = userData?.name || user.user_metadata?.full_name || "المستخدم";
        const adminImg  = userData?.profile_image || localStorage.getItem(`profileImage_${user.id}`) || "../images/default-avatar.png";

        const nameEl = document.getElementById('adminHeaderName');
        const imgEl  = document.getElementById('adminHeaderImg');
        if (nameEl) nameEl.textContent = adminName;
        if (imgEl)  {
            imgEl.src = adminImg;
            imgEl.style.cursor = 'pointer';
            imgEl.addEventListener('click', () => { window.location.href = "الصفحه الشخصية.html"; });
        }

        // الشريط الجانبي للأدمن فقط
        const ADMIN_EMAIL = 'ahussin9125@gmail.com';
        const isAdmin = userData?.user_type === 'admin'
            || user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
            || user.user_metadata?.role === 'admin'
            || user.user_metadata?.is_admin === true;

        const menuToggleBtn = document.getElementById('menuToggle');
        const sideDrawer    = document.getElementById('mobileNav');
        const mainContent   = document.querySelector('.main-content');

        if (isAdmin) {
            if (menuToggleBtn) menuToggleBtn.style.display = 'flex';
            if (sideDrawer)    sideDrawer.classList.add('admin-visible');
            if (mainContent)   mainContent.classList.add('with-sidebar');
        } else {
            if (menuToggleBtn) menuToggleBtn.style.display = 'none';
            if (sideDrawer)    sideDrawer.classList.remove('admin-visible');
            if (mainContent)   mainContent.classList.remove('with-sidebar');
        }

    } catch (err) {
        console.error("loadAdminHeaderInfo:", err);
    }
}

// ===== تحميل الإشعارات =====
async function loadNotifications() {
    if (!sb) return;
    const list       = document.getElementById('notificationsList');
    const emptyState = document.getElementById('emptyState');
    if (!list || !emptyState) return;

    // جلب المستخدم الحالي
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">يرجى تسجيل الدخول أولاً</div>';
        return;
    }

    const { data, error } = await sb
        .from('notifications')
        .select('id, title, message, type, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        list.innerHTML = `<div style="padding:20px;color:red;">خطأ: ${error.message}</div>`;
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    const fmt = (iso) => { try { return new Date(iso).toLocaleString('ar-EG'); } catch { return ''; } };

    const typeInfo = (type) => {
        if (type === 'donation' || type === 'success') return { cls: 'success', icon: 'fa-hand-holding-heart' };
        if (type === 'user'     || type === 'info')    return { cls: 'info',    icon: 'fa-user-plus' };
        if (type === 'warning')                        return { cls: 'warning', icon: 'fa-exclamation-triangle' };
        if (type === 'system'   || type === 'error')   return { cls: 'danger',  icon: 'fa-times-circle' };
        return { cls: 'info', icon: 'fa-bell' };
    };

    list.innerHTML = data.map(row => {
        const t = typeInfo(row.type);
        const unread = row.is_read ? '' : ' unread';
        const badge  = row.is_read ? '' : '<div class="notification-badge"></div>';
        const markBtn = row.is_read ? '' : `<button class="notification-action mark-read"><i class="fas fa-check"></i> تعيين كمقروء</button>`;
        return `
        <div class="notification-item${unread}" data-id="${row.id}">
            ${badge}
            <div class="notification-icon ${t.cls}"><i class="fas ${t.icon}"></i></div>
            <div class="notification-content">
                <div class="notification-title">${row.title || ''}</div>
                <div class="notification-message">${row.message || ''}</div>
                <div class="notification-time"><i class="far fa-clock"></i> ${fmt(row.created_at)}</div>
                <div class="notification-actions">
                    ${markBtn}
                    <button class="notification-action view"><i class="fas fa-eye"></i> عرض التفاصيل</button>
                    <button class="notification-action delete"><i class="fas fa-trash"></i> حذف</button>
                </div>
            </div>
        </div>`;
    }).join('');

    emptyState.style.display = 'none';
}

// ===== ربط الأحداث =====
function setupEventListeners() {

    // حذف فردي / تعيين كمقروء / عرض تفاصيل
    const listEl = document.getElementById('notificationsList');
    if (listEl) {
        listEl.addEventListener('click', async function (e) {
            const item = e.target.closest('.notification-item');
            if (!item) return;

            if (e.target.closest('.mark-read')) {
                item.classList.remove('unread');
                const badge = item.querySelector('.notification-badge');
                if (badge) badge.remove();
                const btn = item.querySelector('.mark-read');
                if (btn) btn.remove();
                checkEmptyState();
                return;
            }

            if (e.target.closest('.notification-action.delete')) {
                const id = item.dataset.id;
                if (sb && id) await sb.from('notifications').delete().eq('id', id);
                item.style.opacity = '0';
                item.style.transition = 'opacity 0.3s';
                setTimeout(() => { item.remove(); checkEmptyState(); }, 300);
                return;
            }

            if (e.target.closest('.notification-action.view')) {
                const t = item.querySelector('.notification-title')?.textContent.trim()   || '';
                const m = item.querySelector('.notification-message')?.textContent.trim() || '';
                const d = item.querySelector('.notification-time')?.textContent.trim()    || '';
                showNotificationModal(t, m, d);
                return;
            }
        });
    }

    // تعيين الكل كمقروء
    document.getElementById('markAllRead')?.addEventListener('click', function () {
        document.querySelectorAll('.notification-item.unread').forEach(n => {
            n.classList.remove('unread');
            n.querySelector('.notification-badge')?.remove();
            n.querySelector('.mark-read')?.remove();
        });
    });

    // حذف الكل
    document.getElementById('deleteAll')?.addEventListener('click', async function () {
        if (!confirm('هل أنت متأكد من حذف جميع الإشعارات؟')) return;
        if (sb) await sb.from('notifications').delete().neq('id', 0);
        document.querySelectorAll('.notification-item').forEach(n => {
            n.style.opacity = '0';
            n.style.transition = 'opacity 0.3s';
            setTimeout(() => n.remove(), 300);
        });
        setTimeout(checkEmptyState, 500);
    });
}

function checkEmptyState() {
    const list  = document.getElementById('notificationsList');
    const empty = document.getElementById('emptyState');
    if (list && empty) empty.style.display = list.children.length === 0 ? 'block' : 'none';
}

// ===== Modal التفاصيل =====
function showNotificationModal(title, message, timeText) {
    if (!notificationModalBackdrop) {
        notificationModalBackdrop = document.createElement('div');
        notificationModalBackdrop.className = 'notification-modal-backdrop';
        notificationModalBackdrop.innerHTML = `
            <div class="notification-modal">
                <div class="notification-modal-header">
                    <h3 class="notification-modal-title"></h3>
                    <button class="notification-modal-close">&times;</button>
                </div>
                <div class="notification-modal-body"></div>
                <div class="notification-modal-time"></div>
            </div>`;
        document.body.appendChild(notificationModalBackdrop);
        notificationModalBackdrop.addEventListener('click', function (e) {
            if (e.target === notificationModalBackdrop || e.target.classList.contains('notification-modal-close'))
                notificationModalBackdrop.classList.remove('show');
        });
    }
    notificationModalBackdrop.querySelector('.notification-modal-title').textContent = title || 'تفاصيل الإشعار';
    notificationModalBackdrop.querySelector('.notification-modal-body').textContent  = message || '';
    notificationModalBackdrop.querySelector('.notification-modal-time').textContent  = timeText || '';
    notificationModalBackdrop.classList.add('show');
}
