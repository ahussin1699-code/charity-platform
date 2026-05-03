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
                <div class="edit-dropdown">
                    <button class="edit-btn" onclick="toggleDropdown(this)"><i class="fas fa-edit"></i> تعديل</button>
                    <div class="dropdown-content">
                        <button class="status-active-opt" onclick="updateStatus(this, 'نشط')"><i class="fas fa-check-circle"></i> تنشيط</button>
                        <button class="status-banned-opt" onclick="updateStatus(this, 'محظور')"><i class="fas fa-ban"></i> حظر</button>
                        <button class="status-pending-opt" onclick="updateStatus(this, 'انتظار')"><i class="fas fa-clock"></i> انتظار</button>
                        ${doctorBtn}
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
    const row = btn.closest('tr');
    const userId = row.getAttribute('data-id');
    const emailCell = row.children[2];
    const nameCell = row.children[0];
    const email = emailCell ? (emailCell.textContent || '').trim() : '';
    const name = nameCell ? (nameCell.textContent || '').trim() : '';
    if (!sb || !userId) return;

    // نحفظ reference للـ dropdown قبل ما نغير btn
    const dropdown = btn.closest('.dropdown-content');

    try {
        // update user_type فقط بدون original_type عشان ميسببش مشكلة لو العمود مش موجود
        const { error } = await sb
            .from('users')
            .update({ user_type: newType })
            .eq('id', userId);
        if (error) throw error;

        // upsert في الجدول المناسب
        if (newType === 'طبيب') {
            const { error: e } = await sb.from('doctors').upsert({ email, user_id: userId, name }, { onConflict: 'email' });
            if (e) console.warn('doctors upsert warning:', e.message);
        } else if (newType === 'مسؤول' || newType === 'admin') {
            const { error: e } = await sb.from('supervisors').upsert({ email, user_id: userId, name }, { onConflict: 'email' });
            if (e) console.warn('supervisors upsert warning:', e.message);
        }

        // تحديث الـ badge
        const typeSpan = row.querySelector('.user-type');
        if (typeSpan) {
            typeSpan.textContent = newType;
            typeSpan.className = `user-type ${getUserTypeClass(newType)}`;
        }

        // تحديث الزر - نغير btn.outerHTML آخر حاجة بعد ما خلصنا من كل references
        if (newType === 'مسؤول' || newType === 'admin') {
            const removeBtn = currentUserEmail === OWNER_EMAIL
                ? `<button class="type-remove-admin-opt" onclick="removeRole(this, 'admin')"><i class="fas fa-user-minus"></i> إلغاء المسؤول</button>`
                : '';
            btn.outerHTML = removeBtn;
        } else if (newType === 'طبيب') {
            btn.outerHTML = `<button class="type-remove-doctor-opt" onclick="removeRole(this, 'doctor')"><i class="fas fa-user-minus"></i> إلغاء الطبيب</button>`;
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
