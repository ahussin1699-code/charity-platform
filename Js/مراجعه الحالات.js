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

            // إشعار للمستفيد صاحب الحالة
            const { data: caseData } = await sb
                .from('cases')
                .select('name, email')
                .eq('id', id)
                .maybeSingle();

            if (caseData?.email) {
                const { data: beneficiary } = await sb
                    .from('users')
                    .select('id')
                    .eq('email', caseData.email)
                    .maybeSingle();

                if (beneficiary?.id) {
                    try {
                        await sb.from('notifications').insert({
                            title: 'تمت الموافقة على حالتك ✅',
                            message: `تمت الموافقة على حالة "${caseData.name}" ونشرها على المنصة.`,
                            type: 'success',
                            is_read: false,
                            user_id: beneficiary.id,
                            created_at: new Date().toISOString()
                        });
                    } catch(e) { console.warn('notification error:', e.message); }
                }
            }

            alert('تمت الموافقة على الحالة بنجاح ✅');
            await fetchCases();
        } catch (error) {
            console.error('Error approving case:', error);
            alert(`حدث خطأ أثناء الموافقة على الحالة: ${error.message || 'غير معروف'}`);
        }
    };

    window.sendToDoctor = async function(id, caseName) {
        // عرض modal اختيار التخصص
        showSpecialtyModal(id, caseName);
    };

    function showSpecialtyModal(caseId, caseName) {
        // إزالة أي modal قديم
        document.getElementById('specialtyModal')?.remove();

        const specialties = [
            { key: 'عام',           icon: 'fa-stethoscope',      label: 'طب عام' },
            { key: 'أسنان',         icon: 'fa-tooth',            label: 'طب الأسنان' },
            { key: 'عظام',          icon: 'fa-bone',             label: 'جراحة العظام' },
            { key: 'مخ وأعصاب',    icon: 'fa-brain',            label: 'المخ والأعصاب' },
            { key: 'قلب',           icon: 'fa-heart-pulse',      label: 'أمراض القلب' },
            { key: 'أطفال',         icon: 'fa-baby',             label: 'طب الأطفال' },
            { key: 'عيون',          icon: 'fa-eye',              label: 'طب العيون' },
            { key: 'جراحة عامة',   icon: 'fa-scalpel',          label: 'جراحة عامة' },
        ];

        const modal = document.createElement('div');
        modal.id = 'specialtyModal';
        modal.style.cssText = `
            position:fixed;inset:0;background:rgba(0,0,0,0.55);
            z-index:9999;display:flex;align-items:center;justify-content:center;
            animation:fadeInM .25s ease;
        `;

        modal.innerHTML = `
            <style>
                @keyframes fadeInM { from{opacity:0} to{opacity:1} }
                @keyframes slideUpM { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
                .spec-modal-box {
                    background:#fff;border-radius:20px;padding:28px 24px;
                    max-width:520px;width:92%;direction:rtl;
                    font-family:'Cairo',sans-serif;
                    animation:slideUpM .25s ease;
                    box-shadow:0 20px 60px rgba(0,0,0,0.2);
                }
                .spec-modal-title {
                    font-size:1.1rem;font-weight:800;color:#2f6d3f;
                    margin-bottom:6px;display:flex;align-items:center;gap:8px;
                }
                .spec-modal-sub {
                    font-size:0.82rem;color:#888;margin-bottom:20px;
                }
                .spec-grid {
                    display:grid;grid-template-columns:repeat(4,1fr);gap:12px;
                    margin-bottom:20px;
                }
                .spec-card {
                    border:2px solid #e0e0e0;border-radius:14px;padding:14px 8px;
                    text-align:center;cursor:pointer;transition:all .2s;
                    background:#fafafa;
                }
                .spec-card:hover { border-color:#2f6d3f;background:#f0f9f3;transform:translateY(-2px); }
                .spec-card.selected { border-color:#2f6d3f;background:#e8f5ec; }
                .spec-card i { font-size:1.6rem;color:#2f6d3f;margin-bottom:8px;display:block; }
                .spec-card span { font-size:0.75rem;font-weight:700;color:#333; }
                .spec-modal-footer { display:flex;gap:10px;justify-content:flex-end; }
                .spec-btn-send {
                    background:#2f6d3f;color:#fff;border:none;padding:10px 24px;
                    border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;
                    font-family:inherit;transition:.2s;
                }
                .spec-btn-send:hover { background:#3a8a50; }
                .spec-btn-send:disabled { background:#aaa;cursor:not-allowed; }
                .spec-btn-cancel {
                    background:#f5f5f5;color:#555;border:none;padding:10px 18px;
                    border-radius:10px;font-size:0.88rem;cursor:pointer;font-family:inherit;
                }
                @media(max-width:480px){
                    .spec-grid{grid-template-columns:repeat(2,1fr);}
                }
            </style>
            <div class="spec-modal-box">
                <div class="spec-modal-title">
                    <i class="fas fa-user-doctor"></i>
                    إرسال للطبيب المختص
                </div>
                <div class="spec-modal-sub">اختر التخصص المناسب لحالة "${caseName}"</div>
                <div class="spec-grid">
                    ${specialties.map(s => `
                        <div class="spec-card" data-key="${s.key}" onclick="selectSpecialty(this)">
                            <i class="fas ${s.icon}"></i>
                            <span>${s.label}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="spec-modal-footer">
                    <button class="spec-btn-cancel" onclick="document.getElementById('specialtyModal').remove()">إلغاء</button>
                    <button class="spec-btn-send" id="specSendBtn" disabled onclick="confirmSendToDoctor('${caseId}')">
                        <i class="fas fa-paper-plane"></i> إرسال
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        // إغلاق بالضغط خارج الـ modal
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    window.selectSpecialty = function(el) {
        document.querySelectorAll('.spec-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        document.getElementById('specSendBtn').disabled = false;
    };

    window.confirmSendToDoctor = async function(id) {
        const selected = document.querySelector('.spec-card.selected');
        if (!selected) return;
        const specialty = selected.dataset.key;
        const btn = document.getElementById('specSendBtn');
        btn.disabled = true;
        btn.textContent = 'جاري الإرسال...';

        try {
            const { data: caseData, error: fetchErr } = await sb
                .from('cases')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchErr) throw fetchErr;

            // رسالة في الشات الطبي
            const msg = `📋 حالة جديدة للمراجعة (${specialty}):\n` +
                `الاسم: ${caseData.name || '-'}\n` +
                `النوع: ${caseData.type || '-'}\n` +
                `الوصف: ${caseData.description || '-'}\n` +
                `الهاتف: ${caseData.phone || '-'}\n` +
                `العنوان: ${caseData.address || '-'}\n` +
                `المبلغ المطلوب: ${caseData.required_amount || 0} جنيه`;

            await sb.from('cases').update({ status: 'قيد المراجعة الطبية' }).eq('id', id);

            // جيب الأطباء بنفس التخصص
            const { data: doctors } = await sb
                .from('users')
                .select('id')
                .eq('user_type', 'طبيب')
                .ilike('specialty', `%${specialty}%`);

            // لو مفيش دكاتره بالتخصص ده، ابعت لكل الأطباء
            const { data: allDoctors } = await sb
                .from('users')
                .select('id')
                .eq('user_type', 'طبيب');

            const targets = (doctors && doctors.length > 0) ? doctors : (allDoctors || []);

            if (targets.length > 0) {
                // ابعت رسالة في غرفة كل دكتور
                try {
                    await sb.from('medical_messages').insert(
                        targets.map(d => ({
                            text: msg,
                            sender_role: 'supervisor',
                            room_id: `doctor_${d.id}`,
                            attachment_url: caseData.image_url || null,
                            attachment_name: caseData.image_url ? 'صورة الحالة' : null,
                            created_at: new Date().toISOString()
                        }))
                    );
                } catch(e) { console.warn('messages error:', e.message); }

                // إشعار لكل دكتور
                try {
                    await sb.from('notifications').insert(
                        targets.map(d => ({
                            title: `حالة تحتاج طبيب ${specialty}`,
                            message: `تم إرسال حالة "${caseData.name}" لمراجعتك. التخصص: ${specialty}.`,
                            type: 'info',
                            is_read: false,
                            user_id: d.id,
                            created_at: new Date().toISOString()
                        }))
                    );
                } catch(e) { console.warn('notification error:', e.message); }
            }

            document.getElementById('specialtyModal')?.remove();
            alert(`✅ تم إرسال الحالة لطبيب ${specialty}`);
            await fetchCases();
        } catch (err) {
            console.error('Error sending to doctor:', err);
            alert('حدث خطأ: ' + (err.message || 'غير معروف'));
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال';
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

            // إشعار للمستفيد صاحب الحالة
            const { data: caseData } = await sb
                .from('cases')
                .select('name, email')
                .eq('id', id)
                .maybeSingle();

            if (caseData?.email) {
                const { data: beneficiary } = await sb
                    .from('users')
                    .select('id')
                    .eq('email', caseData.email)
                    .maybeSingle();

                if (beneficiary?.id) {
                    try {
                        await sb.from('notifications').insert({
                            title: 'تم رفض حالتك ❌',
                            message: `للأسف تم رفض حالة "${caseData.name}". يمكنك التواصل معنا لمزيد من التفاصيل.`,
                            type: 'warning',
                            is_read: false,
                            user_id: beneficiary.id,
                            created_at: new Date().toISOString()
                        });
                    } catch(e) { console.warn('notification error:', e.message); }
                }
            }

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
