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
            if (!user) {
                const nameEl = document.getElementById('adminHeaderName');
                if (nameEl) nameEl.textContent = "غير مسجل";
                return;
            }

            const { data: userData, error: userErr } = await sb
                .from('users')
                .select('name, profile_image, user_type')
                .eq('email', user.email)
                .maybeSingle();

            if (userErr) console.warn("User data fetch error:", userErr.message);

            const adminName = userData?.name || user.user_metadata?.full_name || user.email || "المسؤول";
            const adminImg = userData?.profile_image || localStorage.getItem(`profileImage_${user.id}`) || "../images/default-avatar.png";

            const nameEl = document.getElementById('adminHeaderName');
            const imgEl = document.getElementById('adminHeaderImg');

            if (nameEl) nameEl.textContent = adminName;
            if (imgEl) imgEl.src = adminImg;
            
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
            const nameEl = document.getElementById('adminHeaderName');
            if (nameEl) nameEl.textContent = "خطأ في التحميل";
        }
    }

    async function loadDonations() {
        if (!sb || !tbody) return;

        tbody.innerHTML = '<tr><td colspan="7">جاري تحميل بيانات التبرعات...</td></tr>';

        try {
            const { data, error } = await sb
                .from('donations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7">لا توجد تبرعات حتى الآن</td></tr>';
                return;
            }

            tbody.innerHTML = '';

            data.forEach((row, index) => {
                const tr = document.createElement('tr');

                const donorName = row.donor_name || 'غير معروف';
                const caseName = row.case_name || '';
                const amountValue = row.amount || 0;
                const amount = amountValue + ' جنيه';
                const status = row.status || 'قيد المراجعة';
                const createdAt = row.created_at ? new Date(row.created_at) : null;
                const dateStr = createdAt ? createdAt.toLocaleDateString('ar-EG') : '';

                let statusClass = 'status-pending';
                if (status === 'مكتمل' || status === 'مقبول') statusClass = 'status-approved';
                if (status === 'مرفوض') statusClass = 'status-rejected';

                let actionButtons = `
                <button class="view-btn" title="عرض الحالة"><i class="fas fa-eye"></i></button>
            `;

            if (status === 'قيد المراجعة') {
                actionButtons += `
                    <button class="approve-btn" title="موافقة"><i class="fas fa-check"></i></button>
                    <button class="reject-btn" title="رفض"><i class="fas fa-times"></i></button>
                `;
            }

            // تأكد من ظهور زر الإيصال إذا كان هناك مرفق
            if (row.attachment_url) {
                actionButtons += `
                    <a href="${row.attachment_url}" target="_blank" class="receipt-btn" title="عرض الإيصال">
                        <i class="fas fa-receipt"></i> إيصال
                    </a>
                `;
            }

            tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${donorName}</td>
                    <td>${caseName}</td>
                    <td class="amount">${amount}</td>
                    <td>${dateStr}</td>
                    <td><span class="status ${statusClass}">${status}</span></td>
                    <td class="actions">
                        ${actionButtons}
                    </td>
                `;

                // الأحداث
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

                const approveBtn = tr.querySelector('.approve-btn');
                if (approveBtn) {
                    approveBtn.addEventListener('click', () => approveDonation(row.id, row.case_id, amountValue));
                }

                const rejectBtn = tr.querySelector('.reject-btn');
                if (rejectBtn) {
                    rejectBtn.addEventListener('click', () => rejectDonation(row.id));
                }

                tbody.appendChild(tr);
            });

            // تفعيل البحث والتأثيرات بعد تحميل البيانات
            setupTableFeatures();

        } catch (error) {
            console.error('خطأ في جلب التبرعات:', error);
            tbody.innerHTML = `<tr><td colspan="7">حدث خطأ في تحميل البيانات: ${error.message}</td></tr>`;
        }
    }

    function setupTableFeatures() {
        if (searchInput) {
            // إزالة المستمعات القديمة لتجنب التكرار
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            
            newSearchInput.addEventListener('input', function() {
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

    // --- وظائف الموافقة والرفض ---
    async function approveDonation(donationId, caseId, amount) {
        if (!confirm('هل أنت متأكد من الموافقة على هذا التبرع؟')) return;

        try {
            // 1. جلب بيانات الحالة
            let caseData, caseFetchErr;
            
            // محاولة جلب البيانات مع beneficiary_id، إذا فشل نجرب بدونه
            const firstAttempt = await sb
                .from('cases')
                .select('remaining_amount, name, beneficiary_id')
                .eq('id', caseId)
                .single();
            
            if (firstAttempt.error && firstAttempt.error.message.includes('beneficiary_id')) {
                const secondAttempt = await sb
                    .from('cases')
                    .select('remaining_amount, name')
                    .eq('id', caseId)
                    .single();
                caseData = secondAttempt.data;
                caseFetchErr = secondAttempt.error;
            } else {
                caseData = firstAttempt.data;
                caseFetchErr = firstAttempt.error;
            }
            
            if (caseFetchErr) throw caseFetchErr;

            // 2. تحديث حالة التبرع
            const { error: donationErr } = await sb
                .from('donations')
                .update({ status: 'مكتمل' })
                .eq('id', donationId);
            
            if (donationErr) throw donationErr;

            // 3. تحديث المبلغ المتبقي في الحالة
            const newRemaining = (caseData.remaining_amount || 0) - amount;
            const { error: updateErr } = await sb
                .from('cases')
                .update({ remaining_amount: newRemaining })
                .eq('id', caseId);
            
            if (updateErr) throw updateErr;

            // 4. إرسال إشعار للمستفيد
            if (caseData.beneficiary_id) {
                const { data: beneficiary } = await sb
                    .from('beneficiaries')
                    .select('user_id')
                    .eq('id', caseData.beneficiary_id)
                    .single();

                if (beneficiary && beneficiary.user_id) {
                    await sb.from('notifications').insert({
                        title: 'تم تأكيد تبرع جديد!',
                        message: `تمت الموافقة على تبرع بمبلغ ${amount} جنيه لحالتك: ${caseData.name}.`,
                        type: 'user',
                        is_read: false,
                        user_id: beneficiary.user_id,
                        created_at: new Date().toISOString()
                    });
                }
            }

            alert('تمت الموافقة على التبرع بنجاح وتحديث بيانات الحالة.');
            loadDonations(); // إعادة تحميل الجدول
        } catch (error) {
            console.error('Error approving donation:', error);
            alert('حدث خطأ أثناء الموافقة: ' + error.message);
        }
    }

    async function rejectDonation(donationId) {
        if (!confirm('هل أنت متأكد من رفض هذا التبرع؟')) return;

        try {
            const { error } = await sb
                .from('donations')
                .update({ status: 'مرفوض' })
                .eq('id', donationId);
            
            if (error) throw error;
            
            alert('تم رفض التبرع بنجاح.');
            loadDonations(); // إعادة تحميل الجدول
        } catch (error) {
            console.error('Error rejecting donation:', error);
            alert('حدث خطأ أثناء رفض التبرع.');
        }
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
