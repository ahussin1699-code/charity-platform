const sb = createSupabaseClient();

document.addEventListener('DOMContentLoaded', async function() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    await loadAdminHeaderInfo();

    const searchInput = document.querySelector('.search-box input');
    const tbody = document.getElementById('donationsBody');

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

    async function loadDonations() {
        if (!sb || !tbody) return;

        tbody.innerHTML = '<tr><td colspan="7">جاري تحميل بيانات التبرعات...</td></tr>';

        const { data, error } = await sb
            .from('donations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('خطأ في جلب التبرعات:', error);
            tbody.innerHTML = '<tr><td colspan="7">حدث خطأ في تحميل بيانات التبرعات</td></tr>';
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">لا توجد تبرعات حتى الآن</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        data.forEach((row, index) => {
            const tr = document.createElement('tr');

            const donorName = row.donor_name || 'غير معروف';
            const caseName = row.case_name || '';
            const amount = row.amount != null ? row.amount + ' جنيه' : '';
            const status = row.status || '';
            const createdAt = row.created_at ? new Date(row.created_at) : null;
            const dateStr = createdAt ? createdAt.toLocaleDateString('ar-EG') : '';

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${donorName}</td>
                <td>${caseName}</td>
                <td class="amount">${amount}</td>
                <td>${dateStr}</td>
                <td><span class="status ${status === 'مكتمل' ? 'status-approved' : 'status-pending'}">${status}</span></td>
                <td class="actions">
                    <button class="view-btn"><i class="fas fa-eye"></i> عرض</button>
                </td>
            `;

            const viewBtn = tr.querySelector('.view-btn');
            if (viewBtn) {
                viewBtn.addEventListener('click', () => {
                    if (row.case_id) {
                        window.location.href = "تفاصيل الحاله.html?id=" + encodeURIComponent(row.case_id);
                    } else {
                        alert('لا توجد حالة مرتبطة بهذا التبرع');
                    }
                });
            }

            tbody.appendChild(tr);
        });

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const term = this.value.toLowerCase();
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(r => {
                    const donorCell = r.children[1]?.textContent.toLowerCase() || '';
                    const caseCell = r.children[2]?.textContent.toLowerCase() || '';
                    r.style.display = (donorCell.includes(term) || caseCell.includes(term)) ? '' : 'none';
                });
            });
        }

        const tableRows = tbody.querySelectorAll('tr');
        tableRows.forEach(row => {
            row.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
            });
            
            row.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
        });
    }

    const logoutBtnSidebar = document.getElementById("sidebarLogoutBtn");
    if (logoutBtnSidebar) {
        logoutBtnSidebar.addEventListener("click", async (e) => {
            e.preventDefault();
            if (sb) {
                await sb.auth.signOut();
                window.location.href = "تسجيل الدخول .html";
            }
        });
    }

    await loadDonations();
});
