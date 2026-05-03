let sb = null;
let currentUserEmail = null;

const OWNER_EMAIL = 'ahussin9125@gmail.com';

async function init() {
    if (typeof createSupabaseClient === 'function') {
        sb = createSupabaseClient();
    }
    if (!sb) {
        console.error("Supabase client is not initialized");
        return;
    }

    // جلب إيميل المستخدم الحالي
    const { data: { user } } = await sb.auth.getUser();
    currentUserEmail = user?.email || null;

    await loadAdminHeaderInfo();
    await fetchUsers();
}

async function loadAdminHeaderInfo() {
    if (!sb) return;
    try {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;

        const { data: userData } = await sb
            .from('users')
            .select('name, profile_image')
            .eq('email', user.email)
            .maybeSingle();

        const adminName = userData?.name || user.user_metadata?.full_name || "المسؤول";
        const adminImg = userData?.profile_image || localStorage.getItem(`profileImage_${user.id}`) || "../images/default-avatar.png";

        const nameEl = document.getElementById('adminHeaderName');
        const imgEl = document.getElementById('adminHeaderImg');

        if (nameEl) nameEl.textContent = adminName;
        if (imgEl) imgEl.src = adminImg;
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
    } catch (error) {
        console.error("Error loading admin header info:", error);
    }
}

async function fetchUsers() {
    if (!sb) return;
    
    try {
        const { data: users, error } = await sb
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderUsers(users);
    } catch (error) {
        console.error("Error fetching users:", error);
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">لا يوجد مستخدمين مسجلين حالياً</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => {
        const isAdmin = user.user_type === 'مسؤول' || user.user_type === 'admin';
        const isDoctor = user.user_type === 'طبيب';

        const isOwner = currentUserEmail === OWNER_EMAIL;

        const adminBtn = isAdmin
            ? (isOwner
                ? `<button class="type-remove-admin-opt" onclick="removeRole(this, 'admin')"><i class="fas fa-user-minus"></i> إلغاء المسؤول</button>`
                : '')
            : `<button class="type-admin-opt" onclick="updateUserType(this, 'مسؤول')"><i class="fas fa-user-shield"></i> تعيين مسؤول</button>`;

        const doctorBtn = isDoctor
            ? `<button class="type-remove-doctor-opt" onclick="removeRole(this, 'doctor')"><i class="fas fa-user-minus"></i> إلغاء الطبيب</button>`
            : `<button class="type-doctor-opt" onclick="updateUserType(this, 'طبيب')"><i class="fas fa-user-doctor"></i> تعيين طبيب</button>`;

        return `
        <tr data-id="${user.id}">
            <td>${user.name || 'بدون اسم'}</td>
            <td><span class="user-type ${getUserTypeClass(user.user_type)}">${user.user_type || 'غير محدد'}</span></td>
            <td>${user.email || 'بدون بريد'}</td>
            <td>${formatDate(user.created_at)}</td>
            <td><span class="status ${getStatusClass(user.status)}">${user.status || 'انتظار'}</span></td>
            <td class="actions">
                <a href="الصفحه الشخصية.html?userId=${user.id}" style="text-decoration: none;">
                    <button class="view-btn"><i class="fas fa-eye"></i> عرض</button>
                </a>
                ${isDoctor
                    ? `<button class="type-remove-doctor-opt" onclick="removeRole(this, 'doctor')"><i class="fas fa-user-minus"></i> إلغاء الطبيب</button>`
                    : `<button class="type-doctor-opt" onclick="updateUserType(this, 'طبيب')"><i class="fas fa-user-doctor"></i> تعيين طبيب</button>`
                }
                <div class="edit-dropdown">
                    <button class="edit-btn" onclick="toggleDropdown(this)"><i class="fas fa-edit"></i> تعديل</button>
                    <div class="dropdown-content">
                        <button class="status-active-opt" onclick="updateStatus(this, 'نشط')"><i class="fas fa-check-circle"></i> تنشيط</button>
                        <button class="status-banned-opt" onclick="updateStatus(this, 'محظور')"><i class="fas fa-ban"></i> حظر</button>
                        <button class="status-pending-opt" onclick="updateStatus(this, 'انتظار')"><i class="fas fa-clock"></i> انتظار</button>
                        ${adminBtn}
                    </div>
                </div>
            </td>
        </tr>
    `}).join('');
}

function getUserTypeClass(type) {
    switch (type) {
        case 'متبرع': return 'user-type-donor';
        case 'مستفيد': return 'user-type-beneficiary';
        case 'طبيب': return 'user-type-doctor';
        case 'admin':
        case 'مسؤول': return 'user-type-admin';
        default: return '';
    }
}

async function removeRole(btn, role) {
    const row = btn.closest('tr');
    const userId = row.getAttribute('data-id');
    const emailCell = row.children[2];
    const email = emailCell ? (emailCell.textContent || '').trim() : '';
    if (!sb || !userId) return;

    // التحقق إن المستخدم الحالي هو المالك فقط
    if (role === 'admin' && currentUserEmail !== OWNER_EMAIL) {
        alert('فقط المالك يمكنه إلغاء صلاحية المسؤول');
        return;
    }

    try {
        // جلب original_type لو موجود، وإلا نرجع متبرع
        let originalType = 'متبرع';
        try {
            const { data: userData } = await sb
                .from('users')
                .select('original_type')
                .eq('id', userId)
                .maybeSingle();
            if (userData?.original_type) originalType = userData.original_type;
        } catch (_) {}

        // تحديث user_type فقط (بدون original_type لو العمود مش موجود)
        let updatePayload = { user_type: originalType };
        const { error: updateError } = await sb
            .from('users')
            .update(updatePayload)
            .eq('id', userId);

        if (updateError) {
            console.error('Update error:', updateError);
            throw updateError;
        }

        // حذف من الجدول المناسب - مش blocking لو فشل
        if (role === 'admin') {
            const { error: delErr } = await sb.from('supervisors').delete().eq('email', email);
            if (delErr) console.warn('supervisors delete warning:', delErr.message);
        } else if (role === 'doctor') {
            const { error: delErr } = await sb.from('doctors').delete().eq('email', email);
            if (delErr) console.warn('doctors delete warning:', delErr.message);
        }

        // تحديث الواجهة
        const typeSpan = row.querySelector('.user-type');
        if (typeSpan) {
            typeSpan.textContent = originalType;
            typeSpan.className = `user-type ${getUserTypeClass(originalType)}`;
        }

        const dropdown = btn.closest('.dropdown-content');
        if (role === 'admin') {
            btn.outerHTML = `<button class="type-admin-opt" onclick="updateUserType(this, 'مسؤول')"><i class="fas fa-user-shield"></i> تعيين مسؤول</button>`;
        } else if (role === 'doctor') {
            btn.outerHTML = `<button class="type-doctor-opt" onclick="updateUserType(this, 'طبيب')"><i class="fas fa-user-doctor"></i> تعيين طبيب</button>`;
        }
        if (dropdown) dropdown.style.display = 'none';

    } catch (error) {
        console.error('Error removing role:', error);
        alert('فشل إلغاء الصلاحية: ' + (error.message || 'خطأ غير معروف'));
    }
}

async function updateUserType(btn, newType) {
    if (newType === 'طبيب') {
        showDoctorSpecialtyModal(btn);
        return;
    }
    await doUpdateUserType(btn, newType, null);
}

function showDoctorSpecialtyModal(btn) {
    document.getElementById('doctorSpecialtyModal')?.remove();

    const specialties = [
        { key: 'طب عام',          icon: 'fa-stethoscope' },
        { key: 'طب الأسنان',      icon: 'fa-tooth' },
        { key: 'جراحة العظام',    icon: 'fa-bone' },
        { key: 'المخ والأعصاب',   icon: 'fa-brain' },
        { key: 'أمراض القلب',     icon: 'fa-heart-pulse' },
        { key: 'طب الأطفال',      icon: 'fa-baby' },
        { key: 'طب العيون',       icon: 'fa-eye' },
        { key: 'جراحة عامة',      icon: 'fa-scalpel' },
    ];

    const modal = document.createElement('div');
    modal.id = 'doctorSpecialtyModal';
    modal.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.55);
        z-index:9999;display:flex;align-items:center;justify-content:center;
    `;

    modal.innerHTML = `
        <style>
            .ds-box {
                background:#fff;border-radius:20px;padding:28px 24px;
                max-width:500px;width:92%;direction:rtl;
                font-family:'Cairo',sans-serif;
                box-shadow:0 20px 60px rgba(0,0,0,0.2);
                animation:dsSlide .25s ease;
            }
            @keyframes dsSlide { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
            .ds-title { font-size:1.1rem;font-weight:800;color:#2f6d3f;margin-bottom:4px;display:flex;align-items:center;gap:8px; }
            .ds-sub   { font-size:0.82rem;color:#888;margin-bottom:18px; }
            .ds-grid  { display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px; }
            .ds-card  {
                border:2px solid #e0e0e0;border-radius:14px;padding:14px 6px;
                text-align:center;cursor:pointer;transition:all .2s;background:#fafafa;
            }
            .ds-card:hover  { border-color:#2f6d3f;background:#f0f9f3;transform:translateY(-2px); }
            .ds-card.sel    { border-color:#2f6d3f;background:#e8f5ec; }
            .ds-card i      { font-size:1.5rem;color:#2f6d3f;margin-bottom:7px;display:block; }
            .ds-card span   { font-size:0.72rem;font-weight:700;color:#333; }
            .ds-footer      { display:flex;gap:10px;justify-content:flex-end; }
            .ds-send {
                background:#2f6d3f;color:#fff;border:none;padding:10px 22px;
                border-radius:10px;font-size:0.88rem;font-weight:700;cursor:pointer;
                font-family:inherit;transition:.2s;
            }
            .ds-send:disabled { background:#aaa;cursor:not-allowed; }
            .ds-cancel {
                background:#f5f5f5;color:#555;border:none;padding:10px 16px;
                border-radius:10px;font-size:0.85rem;cursor:pointer;font-family:inherit;
            }
            @media(max-width:480px){ .ds-grid{grid-template-columns:repeat(2,1fr);} }
        </style>
        <div class="ds-box">
            <div class="ds-title"><i class="fas fa-user-doctor"></i> تعيين طبيب</div>
            <div class="ds-sub">اختر تخصص الطبيب</div>
            <div class="ds-grid">
                ${specialties.map(s => `
                    <div class="ds-card" data-key="${s.key}" onclick="this.closest('.ds-grid').querySelectorAll('.ds-card').forEach(c=>c.classList.remove('sel'));this.classList.add('sel');document.getElementById('dsSendBtn').disabled=false;">
                        <i class="fas ${s.icon}"></i>
                        <span>${s.key}</span>
                    </div>
                `).join('')}
            </div>
            <div class="ds-footer">
                <button class="ds-cancel" onclick="document.getElementById('doctorSpecialtyModal').remove()">إلغاء</button>
                <button class="ds-send" id="dsSendBtn" disabled>
                    <i class="fas fa-check"></i> تعيين
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('dsSendBtn').addEventListener('click', async () => {
        const sel = modal.querySelector('.ds-card.sel');
        if (!sel) return;
        const specialty = sel.dataset.key;
        modal.remove();
        await doUpdateUserType(btn, 'طبيب', specialty);
    });
}

async function doUpdateUserType(btn, newType, specialty) {
    const row = btn.closest('tr');
    const userId = row.getAttribute('data-id');
    const emailCell = row.children[2];
    const nameCell = row.children[0];
    const email = emailCell ? (emailCell.textContent || '').trim() : '';
    const name = nameCell ? (nameCell.textContent || '').trim() : '';
    if (!sb || !userId) return;

    const dropdown = btn.closest('.dropdown-content');

    try {
        const updateData = { user_type: newType };
        if (specialty) updateData.specialty = specialty;
        const { error } = await sb
            .from('users')
            .update(updateData)
            .eq('id', userId);
        if (error) throw error;

        if (newType === 'طبيب') {
            const doctorData = { email, user_id: userId, name };
            if (specialty) doctorData.specialty = specialty;
            const { error: e } = await sb.from('doctors').upsert(doctorData, { onConflict: 'email' });
            if (e) console.warn('doctors upsert warning:', e.message);
        } else if (newType === 'مسؤول' || newType === 'admin') {
            const { error: e } = await sb.from('supervisors').upsert({ email, user_id: userId, name }, { onConflict: 'email' });
            if (e) console.warn('supervisors upsert warning:', e.message);
        }

        const typeSpan = row.querySelector('.user-type');
        if (typeSpan) {
            typeSpan.textContent = newType + (specialty ? ` (${specialty})` : '');
            typeSpan.className = `user-type ${getUserTypeClass(newType)}`;
        }

        if (newType === 'مسؤول' || newType === 'admin') {
            const removeBtn = currentUserEmail === OWNER_EMAIL
                ? `<button class="type-remove-admin-opt" onclick="removeRole(this, 'admin')"><i class="fas fa-user-minus"></i> إلغاء المسؤول</button>`
                : '';
            btn.outerHTML = removeBtn;
        } else if (newType === 'طبيب') {
            btn.outerHTML = `<button class="type-remove-doctor-opt actions" onclick="removeRole(this, 'doctor')"><i class="fas fa-user-minus"></i> إلغاء الطبيب</button>`;
        }

        if (dropdown) dropdown.style.display = 'none';

    } catch (error) {
        console.error("Error updating user type:", error);
        alert("فشل تغيير نوع المستخدم: " + (error.message || 'خطأ غير معروف'));
    }
}

function getStatusClass(status) {
    switch (status) {
        case 'نشط': return 'status-active';
        case 'محظور': return 'status-banned';
        case 'انتظار': return 'status-pending';
        default: return 'status-pending';
    }
}

function formatDate(dateString) {
    if (!dateString) return '---';
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`;
}

function toggleDropdown(btn) {
    // إغلاق أي قوائم أخرى مفتوحة
    document.querySelectorAll('.dropdown-content').forEach(dropdown => {
        if (dropdown !== btn.nextElementSibling) {
            dropdown.style.display = 'none';
        }
    });
    
    const dropdown = btn.nextElementSibling;
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

async function updateStatus(btn, newStatus) {
    const row = btn.closest('tr');
    const userId = row.getAttribute('data-id');
    
    if (!sb || !userId) return;

    try {
        const { error } = await sb
            .from('users')
            .update({ status: newStatus })
            .eq('id', userId);

        if (error) throw error;
        
        // تحديث الواجهة
        const statusSpan = row.querySelector('.status');
        statusSpan.textContent = newStatus;
        statusSpan.className = `status ${getStatusClass(newStatus)}`;
        
        // إغلاق القائمة
        btn.closest('.dropdown-content').style.display = 'none';
    } catch (error) {
        console.error("Error updating status:", error);
        alert("فشل تحديث الحالة");
    }
}

// إغلاق القوائم عند الضغط في أي مكان آخر
document.addEventListener('click', function (event) {
    if (!event.target.closest('.edit-dropdown')) {
        document.querySelectorAll('.dropdown-content').forEach(dropdown => {
            dropdown.style.display = 'none';
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    init();

    const searchInput = document.getElementById('userSearchInput');
    const typeFilter = document.getElementById('userTypeFilter');

    function filterTable() {
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const selectedType = typeFilter ? typeFilter.value.toLowerCase() : 'all';
        const rows = document.querySelectorAll('#usersTableBody tr');

        rows.forEach(row => {
            const rowText = row.textContent.toLowerCase();
            const typeCell = row.querySelector('.user-type');
            const rowType = typeCell ? typeCell.textContent.toLowerCase() : '';
            
            // التحقق من البحث النصي
            const matchesSearch = rowText.includes(searchTerm);
            
            // التحقق من نوع المستخدم
            let matchesType = (selectedType === 'all');
            if (selectedType === 'admin') {
                matchesType = rowType.includes('admin') || rowType.includes('مسؤول');
            } else if (!matchesType) {
                matchesType = rowType === selectedType;
            }

            if (matchesSearch && matchesType) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', filterTable);
    }

    if (typeFilter) {
        typeFilter.addEventListener('change', filterTable);
    }
});
