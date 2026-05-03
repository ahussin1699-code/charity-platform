const sb = createSupabaseClient();
let currentUserRole = 'doctor';

document.addEventListener('DOMContentLoaded', async function() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    await loadAdminHeaderInfo();

    const casesTableBody = document.getElementById('casesTableBody');
    const searchInput = document.querySelector('.search-box input');
    const filterSelects = document.querySelectorAll('.filter-select');
    let allCases = [];

    async function loadAdminHeaderInfo() {
        if (!sb) return;
        try {
            const { data: { user } } = await sb.auth.getUser();
            if (!user) return;

            let tableSupervisor = false;
            try {
                const { data: supRow } = await sb
                    .from('supervisors')
                    .select('id')
                    .eq('email', user.email)
                    .maybeSingle();
                tableSupervisor = !!supRow;
            } catch (_) {}

            const { data: userData } = await sb
                .from('users')
                .select('name, profile_image')
                .eq('email', user.email)
                .maybeSingle();

            const meta = user.user_metadata || {};
            const emailIsAdmin = user.email && user.email.toLowerCase() === 'ahussin9125@gmail.com'.toLowerCase();
            const metaIsAdmin = meta.is_admin === true || meta.role === 'admin' || meta.user_type === 'مشرف' || meta.user_type === 'supervisor';
            currentUserRole = (tableSupervisor || metaIsAdmin || emailIsAdmin) ? 'supervisor' : 'doctor';

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

            if (currentUserRole === 'doctor') {
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

    async function fetchCases() {
        if (!sb) return;
        try {
            const { data, error } = await sb
                .from('cases')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            allCases = data || [];
            renderCases(allCases);
            updateStats(allCases);
        } catch (error) {
            console.error('Error fetching cases:', error);
            if (casesTableBody) {
                casesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">فشل تحميل الحالات. يرجى المحاولة لاحقاً.</td></tr>';
            }
        }
    }

    function renderCases(cases) {
        if (!casesTableBody) return;
        if (cases.length === 0) {
            casesTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">لا توجد حالات متاحة حالياً.</td></tr>';
            return;
        }

        casesTableBody.innerHTML = cases.map(c => {
            let statusClass = 'status-pending';
            let statusText = c.status || 'قيد المراجعة';
            
            if (statusText === 'مقبول' || statusText === 'approved') {
                statusClass = 'status-approved';
                // لو remaining_amount = 0 يعني اكتمل التبرع
                if (c.remaining_amount !== null && c.remaining_amount !== undefined && parseFloat(c.remaining_amount) === 0) {
                    statusClass = 'status-completed-donation';
                    statusText = 'تم اكتمال التبرع ✅';
                } else {
                    statusText = 'نشط (مقبول)';
                }
            } else if (statusText === 'موافق عليها من الطبيب') {
                statusClass = 'status-doctor-approved';
                statusText = 'موافق عليها من الطبيب';
            } else if (statusText === 'مكتمل' || statusText === 'completed') {
                statusClass = 'status-completed';
                statusText = 'منتهي (مكتمل)';
            } else if (statusText === 'مرفوض') {
                statusClass = 'status-rejected';
                statusText = 'مرفوض';
            } else if (statusText === 'مرفوض من الطبيب') {
                statusClass = 'status-doctor-rejected';
                statusText = 'مرفوض من الطبيب';
            } else {
                statusClass = 'status-pending';
                statusText = 'قيد المراجعة';
            }

            const date = c.created_at ? new Date(c.created_at).toLocaleDateString('ar-EG') : 'غير متوفر';

            let approveBtn = '';
            let rejectBtn = '';
            let sendDoctorBtn = '';
            if ((c.status === 'قيد المراجعة' || !c.status) && currentUserRole === 'supervisor') {
                approveBtn    = `<button class="approve-btn" onclick="approveCase('${c.id}')"><i class="fas fa-check"></i> موافقة</button>`;
                rejectBtn     = `<button class="reject-btn"  onclick="rejectCase('${c.id}')"><i class="fas fa-times"></i> رفض</button>`;
                sendDoctorBtn = `<button class="doctor-btn"  onclick="sendToDoctor('${c.id}','${(c.name||'').replace(/'/g,"\\'")}')"><i class="fas fa-user-doctor"></i> إرسال للطبيب</button>`;
            } else if (c.status === 'مرفوض من الطبيب' && currentUserRole === 'supervisor') {
                rejectBtn  = `<button class="reject-btn" onclick="rejectCase('${c.id}')"><i class="fas fa-times"></i> رفض نهائي</button>`;
                approveBtn = `<button class="approve-btn" onclick="approveCase('${c.id}')"><i class="fas fa-check"></i> موافقة</button>`;
            } else if (c.status === 'موافق عليها من الطبيب' && currentUserRole === 'supervisor') {
                approveBtn = `<button class="approve-btn" onclick="approveCase('${c.id}')"><i class="fas fa-check"></i> موافقة نهائية</button>`;
                rejectBtn  = `<button class="reject-btn"  onclick="rejectCase('${c.id}')"><i class="fas fa-times"></i> رفض</button>`;
            }

            return `
                <tr>
                    <td>${c.name || 'بدون اسم'}</td>
                    <td>${c.type || 'إنسانية'}</td>
                    <td>${date}</td>
                    <td><span class="status ${statusClass}">${statusText}</span></td>
                    <td class="actions">
                        ${approveBtn}
                        ${rejectBtn}
                        ${sendDoctorBtn}
                        <button class="view-btn" onclick="viewCase('${c.id}')"><i class="fas fa-eye"></i> عرض</button>
                        <button class="edit-btn" onclick="editCase('${c.id}')"><i class="fas fa-edit"></i> تعديل</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.approveCase = async function(id) {
        if (currentUserRole !== 'supervisor') {
            alert('ليس لديك صلاحية الموافقة على الحالة');
            return;
        }
        if (!confirm('هل أنت متأكد من الموافقة على هذه الحالة ونشرها؟')) return;

        try {
            const { error } = await sb
                .from('cases')
                .update({ status: 'مقبول' })
                .eq('id', id);

            if (error) throw error;

            alert('تمت الموافقة على الحالة بنجاح ✅');
            await fetchCases();
        } catch (error) {
            console.error('Error approving case:', error);
            alert(`حدث خطأ أثناء الموافقة على الحالة: ${error.message || 'غير معروف'}`);
        }
    };

    window.sendToDoctor = async function(id, caseName) {
        if (!confirm(`هل تريد إرسال حالة "${caseName}" للطبيب للمراجعة؟`)) return;

        try {
            // جيب بيانات الحالة كاملة
            const { data: caseData, error: fetchErr } = await sb
                .from('cases')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchErr) throw fetchErr;

            // أرسل رسالة في الشات الطبي
            const msg = `📋 حالة جديدة للمراجعة:\n` +
                `الاسم: ${caseData.name || '-'}\n` +
                `النوع: ${caseData.type || '-'}\n` +
                `الوصف: ${caseData.description || '-'}\n` +
                `الهاتف: ${caseData.phone || '-'}\n` +
                `العنوان: ${caseData.address || '-'}\n` +
                `المبلغ المطلوب: ${caseData.required_amount || 0} جنيه\n` +
                `رابط الحالة: تفاصيل الحاله.html?id=${id}`;

            const { error: msgErr } = await sb.from('medical_messages').insert([{
                text: msg,
                sender_role: 'supervisor',
                attachment_url: caseData.image_url || null,
                attachment_name: caseData.image_url ? 'صورة الحالة' : null,
                created_at: new Date().toISOString()
            }]);

            if (msgErr) throw msgErr;

            // تحديث حالة الكيس
            await sb.from('cases').update({ status: 'قيد المراجعة الطبية' }).eq('id', id);

            alert('✅ تم إرسال بيانات الحالة للطبيب في صفحة التقارير الطبية');
            await fetchCases();
        } catch (err) {
            console.error('Error sending to doctor:', err);
            alert('حدث خطأ: ' + (err.message || 'غير معروف'));
        }
    };

    window.rejectCase = async function(id) {
        if (currentUserRole !== 'supervisor') {
            alert('ليس لديك صلاحية رفض الحالة');
            return;
        }
        if (!confirm('هل أنت متأكد من رفض هذه الحالة؟')) return;

        try {
            const { error } = await sb
                .from('cases')
                .update({ status: 'مرفوض' })
                .eq('id', id);

            if (error) throw error;

            alert('تم رفض الحالة ❌');
            await fetchCases();
        } catch (error) {
            console.error('Error rejecting case:', error);
            alert(`حدث خطأ أثناء رفض الحالة: ${error.message || 'غير معروف'}`);
        }
    };

    function updateStats(cases) {
        const totalCases = cases.length;
        const activeCases = cases.filter(c => c.status === 'مقبول' || c.status === 'approved').length;
        const completedCases = cases.filter(c => c.status === 'مكتمل' || c.status === 'completed').length;

        const totalCasesEl = document.getElementById('totalCasesStat');
        const activeCasesEl = document.getElementById('activeCasesStat');
        const completedCasesEl = document.getElementById('completedCasesStat');

        if (totalCasesEl) totalCasesEl.textContent = totalCases;
        if (activeCasesEl) activeCasesEl.textContent = activeCases;
        if (completedCasesEl) completedCasesEl.textContent = completedCases;
    }

    window.viewCase = function(id) {
        window.location.href = `تفاصيل الحاله.html?id=${id}`;
    };

    window.editCase = function(id) {
        window.location.href = `تعديل الحاله.html?id=${id}`;
    };

    function filterCases() {
        const searchTerm = (searchInput?.value || '').toLowerCase();
        const statusFilter = filterSelects[0]?.value || 'جميع الحالات';
        const sortFilter = filterSelects[1]?.value || 'ترتيب حسب التاريخ';

        let filtered = allCases.filter(c => {
            const matchesSearch = (c.name || '').toLowerCase().includes(searchTerm);
            let matchesStatus = true;
            
            if (statusFilter !== 'جميع الحالات') {
                // نتحقق من الحالة بشكل مرن (مثلاً 'مقبول' تظهر لو الفلتر 'مقبول')
                const caseStatus = c.status || 'قيد المراجعة';
                matchesStatus = (caseStatus === statusFilter);
            }
            return matchesSearch && matchesStatus;
        });

        if (sortFilter === 'ترتيب حسب الأحدث') {
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        renderCases(filtered);
    }

    if (searchInput) searchInput.addEventListener('input', filterCases);
    filterSelects.forEach(select => select.addEventListener('change', filterCases));

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

    await fetchCases();
});
