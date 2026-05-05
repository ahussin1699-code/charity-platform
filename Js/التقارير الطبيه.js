const sb = createSupabaseClient();
const ADMIN_EMAIL = 'ahussin9125@gmail.com';
let currentUserRole = 'doctor';
let currentUserId   = null;
let currentRoomId   = null;   // room_id للمحادثة الحالية
let realtimeChannel = null;

// ==================== تحميل بيانات المستخدم ====================
async function loadReportsUserProfile() {
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { window.location.href = "تسجيل الدخول .html"; return; }

    currentUserId = user.id;
    const meta = user.user_metadata || {};
    const emailIsAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    let tableSupervisor = false;
    try {
        const { data: supRow } = await sb.from('supervisors').select('id').eq('email', user.email).maybeSingle();
        tableSupervisor = !!supRow;
    } catch (_) {}
    const metaIsAdmin = meta.is_admin === true || meta.role === 'admin'
        || meta.user_type === 'مشرف' || meta.user_type === 'supervisor';
    currentUserRole = (tableSupervisor || metaIsAdmin || emailIsAdmin) ? 'supervisor' : 'doctor';

    // بيانات الاسم والصورة
    const { data: userData } = await sb.from('users').select('name, profile_image, specialty')
        .eq('email', user.email).maybeSingle();

    const fullName = userData?.name || user.user_metadata?.full_name || user.email || '';
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = fullName + (currentUserRole === 'supervisor' ? ' (المشرف)' : ` (${userData?.specialty || 'طبيب'})`);

    const savedImage = userData?.profile_image || localStorage.getItem(`profileImage_${user.id}`);
    const imgEl = document.getElementById('adminProfileImg');
    if (imgEl) {
        if (savedImage) imgEl.src = savedImage;
        imgEl.style.cursor = 'pointer';
        imgEl.addEventListener('click', () => { window.location.href = "الصفحه الشخصية.html"; });
    }

    // الشريط الجانبي
    const sidebar    = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    if (currentUserRole === 'doctor') {
        if (sidebar)    sidebar.style.display = 'none';
        if (menuToggle) menuToggle.style.display = 'none';
    } else {
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
        }
    }

    document.body.classList.remove('is-supervisor', 'is-doctor');
    document.body.classList.add(currentUserRole === 'supervisor' ? 'is-supervisor' : 'is-doctor');

    if (currentUserRole === 'doctor') {
        // الدكتور: غرفته الخاصة
        currentRoomId = `doctor_${currentUserId}`;
        hideDoctorsList();
        await fetchMessages();
        subscribeToMessages();
        await loadCasesPanel();
    } else {
        // الأدمن: يشوف قائمة الأطباء أولاً
        await loadDoctorsList();
        await loadCasesPanel();
    }
}

// ==================== قائمة الأطباء للأدمن ====================
window.loadDoctorsList = async function loadDoctorsList() {    const chatCard = document.querySelector('.chat-card');
    if (!chatCard) return;

    // إخفاء الشات وإظهار قائمة الأطباء
    chatCard.innerHTML = `
        <div class="chat-header">
            <h2>اختر طبيباً للمحادثة</h2>
        </div>
        <div id="doctorsListContainer" style="padding:16px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;max-height:500px;">
            <div style="text-align:center;color:#999;">جاري التحميل...</div>
        </div>
    `;

    const { data: doctors } = await sb.from('users').select('id, name, specialty, profile_image')
        .eq('user_type', 'طبيب').order('name');

    const container = document.getElementById('doctorsListContainer');
    if (!container) return;

    if (!doctors || doctors.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#999;">لا يوجد أطباء مسجلون</div>';
        return;
    }

    container.innerHTML = doctors.map(d => `
        <div onclick="openDoctorChat('${d.id}', '${(d.name||'طبيب').replace(/'/g,"\\'")}', '${d.specialty||''}')"
             style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;
                    border:1.5px solid #e0e0e0;cursor:pointer;transition:.2s;background:#fafafa;"
             onmouseover="this.style.borderColor='#2f6d3f';this.style.background='#f0f9f3'"
             onmouseout="this.style.borderColor='#e0e0e0';this.style.background='#fafafa'">
            <img src="${d.profile_image || '../images/default-avatar.png'}"
                 style="width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid #2f6d3f;"
                 onerror="this.src='../images/default-avatar.png'">
            <div>
                <div style="font-weight:700;font-size:0.95rem;">${d.name || 'طبيب'}</div>
                <div style="font-size:0.78rem;color:#888;">${d.specialty || 'غير محدد'}</div>
            </div>
            <i class="fas fa-chevron-left" style="margin-right:auto;color:#aaa;font-size:0.8rem;"></i>
        </div>
    `).join('');
}

window.openDoctorChat = async function(doctorId, doctorName, specialty) {
    currentRoomId = `doctor_${doctorId}`;
    const chatCard = document.querySelector('.chat-card');
    if (!chatCard) return;

    chatCard.innerHTML = `
        <div class="chat-header" style="display:flex;align-items:center;gap:10px;">
            <button onclick="loadDoctorsList()" title="رجوع"
                style="background:#f0f9f3;border:none;cursor:pointer;color:#2f6d3f;
                       font-size:1.1rem;width:34px;height:34px;border-radius:8px;
                       display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas fa-arrow-right"></i>
            </button>
            <h2>${doctorName} ${specialty ? `(${specialty})` : ''}</h2>
            <span class="chat-status" id="chatStatus">متصل</span>
        </div>
        <div class="chat-box" id="chatMessages"></div>
        <form id="chatForm" class="chat-form">
            <div class="chat-inputs">
                <div class="chat-text-wrapper">
                    <textarea id="chatInput" rows="2" placeholder="اكتب رسالتك للطبيب هنا"></textarea>
                </div>
                <div class="chat-actions">
                    <label for="fileInput" class="file-label">
                        <i class="fas fa-paperclip"></i><span>إرفاق ملف</span>
                    </label>
                    <input type="file" id="fileInput" accept="image/*,.pdf,.doc,.docx" hidden>
                    <button type="submit" id="sendBtn" class="send-btn">
                        <i class="fas fa-paper-plane"></i><span>إرسال</span>
                    </button>
                </div>
                <div class="file-preview" id="filePreview"></div>
            </div>
        </form>
    `;

    setupChatForm();
    await fetchMessages();
    subscribeToMessages();
};

function hideDoctorsList() {
    // الدكتور: نعيد بناء الشات بشكل عادي لو مش موجود
    const chatBox = document.getElementById('chatMessages');
    if (!chatBox) {
        const chatCard = document.querySelector('.chat-card');
        if (chatCard) chatCard.innerHTML = `
            <div class="chat-header">
                <h2>غرفة المحادثة</h2>
                <span class="chat-status" id="chatStatus">متصل</span>
            </div>
            <div class="chat-box" id="chatMessages"></div>
            <form id="chatForm" class="chat-form">
                <div class="chat-inputs">
                    <div class="chat-text-wrapper">
                        <textarea id="chatInput" rows="2" placeholder="اكتب رسالتك للمشرف هنا"></textarea>
                    </div>
                    <div class="chat-actions">
                        <label for="fileInput" class="file-label">
                            <i class="fas fa-paperclip"></i><span>إرفاق ملف</span>
                        </label>
                        <input type="file" id="fileInput" accept="image/*,.pdf,.doc,.docx" hidden>
                        <button type="submit" id="sendBtn" class="send-btn">
                            <i class="fas fa-paper-plane"></i><span>إرسال</span>
                        </button>
                    </div>
                    <div class="file-preview" id="filePreview"></div>
                </div>
            </form>
        `;
    }
    setupChatForm();
}

// ==================== جلب الرسائل ====================
async function fetchMessages() {
    if (!currentRoomId) return;
    const { data, error } = await sb
        .from('medical_messages')
        .select('*')
        .eq('room_id', currentRoomId)
        .order('created_at', { ascending: true });

    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = '';

    if (error) { container.innerHTML = '<div style="text-align:center;color:#999;">فشل تحميل الرسائل</div>'; return; }

    if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#999;margin-top:20px;">لا توجد رسائل سابقة</div>';
        return;
    }
    data.forEach(msg => appendChatMessage(msg.text, msg.sender_role, msg.attachment_url, msg.attachment_name, msg.created_at));
}

// ==================== Realtime ====================
function subscribeToMessages() {
    if (realtimeChannel) { sb.removeChannel(realtimeChannel); }
    realtimeChannel = sb.channel(`room_${currentRoomId}`)
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'medical_messages',
            filter: `room_id=eq.${currentRoomId}`
        }, payload => {
            const msg = payload.new;
            // لا تضيف الرسالة لو أنا اللي بعتها (عشان مش تتكرر)
            if (msg.sender_id !== currentUserId) {
                appendChatMessage(msg.text, msg.sender_role, msg.attachment_url, msg.attachment_name, msg.created_at);
            }
        })
        .subscribe();
}

// ==================== إضافة رسالة للشات ====================
function appendChatMessage(text, senderRole, attachmentUrl, attachmentName, timestamp) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.classList.add('chat-message');
    wrapper.classList.add(senderRole === currentUserRole ? 'chat-message-doctor' : 'chat-message-supervisor');

    if (text) {
        const textEl = document.createElement('div');
        textEl.textContent = text;
        wrapper.appendChild(textEl);
    }

    if (attachmentUrl) {
        const attachEl = document.createElement('div');
        attachEl.classList.add('chat-attachment');
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(attachmentUrl) ||
            (attachmentName && /\.(jpg|jpeg|png|gif|webp)$/i.test(attachmentName));
        if (isImage) {
            const img = document.createElement('img');
            img.src = attachmentUrl; img.alt = attachmentName || 'صورة';
            img.style.cursor = 'pointer';
            img.onclick = () => window.open(attachmentUrl, '_blank');
            attachEl.appendChild(img);
        } else {
            const link = document.createElement('a');
            link.href = attachmentUrl; link.target = '_blank';
            link.innerHTML = `<i class="fas fa-file-download"></i> ${attachmentName || 'تحميل الملف'}`;
            attachEl.appendChild(link);
        }
        wrapper.appendChild(attachEl);
    }

    const meta = document.createElement('div');
    meta.classList.add('chat-meta');
    const timeStr = timestamp
        ? new Date(timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        : '';
    meta.textContent = `${senderRole === 'doctor' ? 'الطبيب' : 'المشرف'} • ${timeStr}`;
    wrapper.appendChild(meta);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

// ==================== إعداد نموذج الإرسال ====================
function setupChatForm() {
    const chatForm   = document.getElementById('chatForm');
    const chatInput  = document.getElementById('chatInput');
    const fileInput  = document.getElementById('fileInput');
    const sendBtn    = document.getElementById('sendBtn');
    const filePreview= document.getElementById('filePreview');

    if (fileInput && filePreview) {
        fileInput.addEventListener('change', function () {
            filePreview.textContent = this.files[0] ? 'سيتم إرفاق: ' + this.files[0].name : '';
        });
    }

    if (!chatForm) return;
    chatForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!currentRoomId) return;
        const text = chatInput?.value.trim();
        const file = fileInput?.files[0];
        if (!text && !file) return;

        if (sendBtn) sendBtn.disabled = true;
        let attachmentUrl = null, attachmentName = null;

        try {
            if (file) {
                const filePath = `medical_reports/${Date.now()}.${file.name.split('.').pop()}`;
                const { error: upErr } = await sb.storage.from('cases').upload(filePath, file);
                if (!upErr) {
                    const { data: urlData } = sb.storage.from('cases').getPublicUrl(filePath);
                    attachmentUrl = urlData.publicUrl;
                    attachmentName = file.name;
                }
            }

            const { error } = await sb.from('medical_messages').insert([{
                text: text || null,
                sender_id: currentUserId,
                sender_role: currentUserRole,
                room_id: currentRoomId,
                attachment_url: attachmentUrl,
                attachment_name: attachmentName
            }]);

            if (error) throw error;

            // أضف الرسالة محلياً فوراً
            appendChatMessage(text, currentUserRole, attachmentUrl, attachmentName, new Date().toISOString());

            if (chatInput)  chatInput.value = '';
            if (fileInput)  fileInput.value = '';
            if (filePreview) filePreview.textContent = '';
        } catch (err) {
            console.error('Error sending message:', err);
            alert('حدث خطأ أثناء إرسال الرسالة');
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    });
}

// ==================== logout ====================
async function logout() {
    if (sb) await sb.auth.signOut();
    window.location.href = "تسجيل الدخول .html";
}

const logoutBtnSidebar = document.getElementById('sidebarLogoutBtn');
if (logoutBtnSidebar) {
    logoutBtnSidebar.addEventListener('click', async (e) => { e.preventDefault(); await logout(); });
}

window.addEventListener('load', loadReportsUserProfile);

// ==================== قائمة الحالات للطبيب ====================
async function loadCasesPanel() {
    const panel = document.getElementById('casesPanel');
    const list  = document.getElementById('casesPanelList');
    const count = document.getElementById('casesPanelCount');
    if (!panel || !list) return;

    panel.style.display = 'flex';

    let queryBuilder = sb.from('cases').select('id, name, type, status, created_at')
        .order('created_at', { ascending: false });

    // الأدمن يشوف المعلقة بس، الطبيب يشوف الكل
    if (currentUserRole === 'supervisor') {
        queryBuilder = queryBuilder.or('status.eq.قيد المراجعة,status.eq.قيد المراجعة الطبية,status.is.null');
    }

    const { data, error } = await queryBuilder;

    if (error || !data) { list.innerHTML = '<div class="cases-loading">فشل التحميل</div>'; return; }

    const pending = data.filter(c => !c.status || c.status === 'قيد المراجعة');
    if (count) count.textContent = pending.length;
    if (data.length === 0) { list.innerHTML = '<div class="cases-loading">لا توجد حالات</div>'; return; }

    const statusMap = {
        'مقبول':                  { cls: 'cs-approved',  txt: 'مقبول' },
        'موافق عليها من الطبيب': { cls: 'cs-approved',  txt: 'موافق عليها من الطبيب' },
        'مرفوض':                  { cls: 'cs-rejected',  txt: 'مرفوض' },
        'مرفوض من الطبيب':       { cls: 'cs-rejected',  txt: 'مرفوض من الطبيب' },
        'مكتمل':                  { cls: 'cs-completed', txt: 'مكتمل' },
        'قيد المراجعة':           { cls: 'cs-pending',   txt: 'قيد المراجعة' },
    };

    list.innerHTML = data.map(c => {
        const s = statusMap[c.status] || { cls: 'cs-pending', txt: 'قيد المراجعة' };
        const isPending = !c.status || c.status === 'قيد المراجعة';
        const date = c.created_at ? new Date(c.created_at).toLocaleDateString('ar-EG') : '';
        return `
        <div class="case-item" id="ci-${c.id}">
            <div class="case-item-info">
                <span class="case-item-name">${c.name || 'بدون اسم'}</span>
                <span class="case-item-type">${c.type || 'إنسانية'} • ${date}</span>
            </div>
            <span class="case-item-status ${s.cls}">${s.txt}</span>
            ${isPending && currentUserRole === 'doctor' ? `
            <div class="case-item-btns">
                <button class="ci-approve" onclick="doctorDecision('${c.id}','approve')"><i class="fas fa-check"></i> موافقة</button>
                <button class="ci-reject"  onclick="doctorDecision('${c.id}','reject')"><i class="fas fa-times"></i> رفض</button>
            </div>` : ''}
        </div>`;
    }).join('');
}

window.doctorDecision = async function (caseId, decision) {
    const newStatus = decision === 'approve' ? 'موافق عليها من الطبيب' : 'مرفوض من الطبيب';
    if (!confirm(`هل أنت متأكد من ${decision === 'approve' ? 'الموافقة على' : 'رفض'} هذه الحالة؟`)) return;

    const { error } = await sb.from('cases').update({ status: newStatus }).eq('id', caseId);
    if (error) { alert('حدث خطأ: ' + error.message); return; }

    const icon = decision === 'approve' ? '✅' : '❌';
    const msg  = `${icon} الطبيب ${decision === 'approve' ? 'وافق على' : 'رفض'} الحالة`;

    try {
        await notifyAllAdmins('قرار الطبيب', msg,
            decision === 'approve' ? 'case_approved_by_doctor' : 'case_rejected_by_doctor'
        );
    } catch(e) { console.warn('notification error:', e.message); }
    // رسالة في الشات الخاص
    if (currentRoomId) {
        try {
            await sb.from('medical_messages').insert([{
                text: `${icon} قرار الطبيب: ${newStatus}`,
                sender_id: currentUserId, sender_role: currentUserRole,
                room_id: currentRoomId
            }]);
            appendChatMessage(`${icon} قرار الطبيب: ${newStatus}`, currentUserRole, null, null, new Date().toISOString());
        } catch(e) {}
    }

    const item = document.getElementById(`ci-${caseId}`);
    if (item) {
        const sm = { 'موافق عليها من الطبيب': 'cs-approved', 'مرفوض من الطبيب': 'cs-rejected' };
        item.querySelector('.case-item-status').textContent = newStatus;
        item.querySelector('.case-item-status').className = `case-item-status ${sm[newStatus]}`;
        item.querySelector('.case-item-btns')?.remove();
    }
    const countEl = document.getElementById('casesPanelCount');
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent || '0') - 1);
};
