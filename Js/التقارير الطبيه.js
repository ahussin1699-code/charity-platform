const sb = createSupabaseClient();
const ADMIN_EMAIL = 'ahussin9125@gmail.com';
let currentUserRole = 'doctor'; 
let currentUserId = null;

async function loadReportsUserProfile() {
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
        window.location.href = "تسجيل الدخول .html";
        return;
    }

    currentUserId = user.id;
    const meta = user.user_metadata || {};
    const emailIsAdmin = user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    let tableSupervisor = false;
    try {
        const { data: supRow } = await sb
            .from('supervisors')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
        tableSupervisor = !!supRow;
    } catch (_) {}
    const metaIsAdmin = meta.is_admin === true || meta.role === 'admin' || meta.user_type === 'مشرف' || meta.user_type === 'supervisor';
    currentUserRole = (tableSupervisor || metaIsAdmin || emailIsAdmin) ? 'supervisor' : 'doctor';

    const { data: userData } = await sb
        .from('users')
        .select('name, profile_image')
        .eq('email', user.email)
        .maybeSingle();

    const fullName = userData?.name || user.user_metadata?.full_name || user.email || "";
    const nameEl = document.getElementById('adminName');
    if (nameEl) nameEl.textContent = fullName + (currentUserRole === 'supervisor' ? ' (المشرف)' : ' (الطبيب)');

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
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    
    if (currentUserRole === 'doctor') {
        if (sidebar) sidebar.style.display = 'none';
        if (menuToggle) menuToggle.style.display = 'none';
    } else {
        // في حالة المشرف، تأكد من عمل زر القائمة في الموبايل
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
        }
    }

    // تعيين كلاس على البودي حسب الدور
    if (document && document.body) {
        document.body.classList.remove('is-supervisor', 'is-doctor');
        if (currentUserRole === 'supervisor') {
            document.body.classList.add('is-supervisor');
        } else {
            document.body.classList.add('is-doctor');
        }
    }

    // تحميل الرسائل القديمة
    await fetchMessages();
    // تفعيل الاستماع للرسائل الجديدة (Realtime)
    subscribeToMessages();
    // تحميل قائمة الحالات
    await loadCasesPanel();
}

async function fetchMessages() {
    console.log('Fetching messages...');
    const { data, error } = await sb
        .from('medical_messages')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching messages:', error);
        return;
    }

    console.log('Messages fetched:', data);
    const container = document.getElementById('chatMessages');
    if (container) {
        container.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(msg => {
                appendChatMessage(msg.text, msg.sender_role, msg.attachment_url, msg.attachment_name, msg.created_at);
            });
        } else {
            container.innerHTML = '<div style="text-align:center; color:#999; margin-top:20px;">لا توجد رسائل سابقة</div>';
        }
    }
}

function subscribeToMessages() {
    sb.channel('medical_chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'medical_messages' }, payload => {
            const msg = payload.new;
            appendChatMessage(msg.text, msg.sender_role, msg.attachment_url, msg.attachment_name, msg.created_at);
        })
        .subscribe();
}

function appendChatMessage(text, senderRole, attachmentUrl, attachmentName, timestamp) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.classList.add('chat-message');
    
    // تحديد شكل الرسالة بناءً على دور المستخدم الحالي والراسل
    if (senderRole === currentUserRole) {
        wrapper.classList.add('chat-message-doctor'); // رسائلي
    } else {
        wrapper.classList.add('chat-message-supervisor'); // رسائل الطرف الآخر
    }

    if (text) {
        const textEl = document.createElement('div');
        textEl.textContent = text;
        wrapper.appendChild(textEl);
    }

    if (attachmentUrl) {
        const attachEl = document.createElement('div');
        attachEl.classList.add('chat-attachment');
        
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(attachmentUrl) || (attachmentName && /\.(jpg|jpeg|png|gif|webp)$/i.test(attachmentName));
        
        if (isImage) {
            const img = document.createElement('img');
            img.src = attachmentUrl;
            img.alt = attachmentName || 'صورة';
            img.style.cursor = 'pointer';
            img.onclick = () => window.open(attachmentUrl, '_blank');
            attachEl.appendChild(img);
        } else {
            const link = document.createElement('a');
            link.href = attachmentUrl;
            link.target = "_blank";
            link.innerHTML = `<i class="fas fa-file-download"></i> ${attachmentName || 'تحميل الملف'}`;
            attachEl.appendChild(link);
        }
        wrapper.appendChild(attachEl);
    }

    const meta = document.createElement('div');
    meta.classList.add('chat-meta');
    const date = timestamp ? new Date(timestamp) : new Date();
    const timeString = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const senderName = (senderRole === 'doctor' ? 'الطبيب' : 'المشرف');
    meta.textContent = `${senderName} • ${timeString}`;
    wrapper.appendChild(meta);

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

const reportAvatarInput = document.getElementById('reportAvatarInput');
const reportAvatarPreview = document.getElementById('reportAvatarPreview');
if (reportAvatarInput && reportAvatarPreview) {
    reportAvatarInput.addEventListener('change', function () {
        const file = this.files && this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            reportAvatarPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function logout() {
    if (sb) await sb.auth.signOut();
    window.location.href = "تسجيل الدخول .html";
}

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const fileInput = document.getElementById('fileInput');
const sendBtn = document.getElementById('sendBtn');
const filePreview = document.getElementById('filePreview');

const logoutBtnSidebar = document.getElementById("sidebarLogoutBtn");
if (logoutBtnSidebar) {
    logoutBtnSidebar.addEventListener("click", async (e) => {
        e.preventDefault();
        await logout();
    });
}

if (fileInput && filePreview) {
    fileInput.addEventListener('change', function() {
        const file = this.files && this.files[0];
        filePreview.textContent = file ? "سيتم إرفاق: " + file.name : "";
    });
}

if (chatForm) {
    chatForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const text = chatInput.value.trim();
        const file = fileInput.files[0];

        if (!text && !file) return;

        sendBtn.disabled = true;
        let attachmentUrl = null;
        let attachmentName = null;

        try {
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const filePath = `medical_reports/${fileName}`;

                const { error: uploadError } = await sb.storage
                    .from('cases') // نستخدم نفس الباكت المتاح أو نتأكد من وجود باكت مناسب
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: urlData } = sb.storage.from('cases').getPublicUrl(filePath);
                attachmentUrl = urlData.publicUrl;
                attachmentName = file.name;
            }

            const { error } = await sb.from('medical_messages').insert([{
                text: text,
                sender_id: currentUserId,
                sender_role: currentUserRole,
                attachment_url: attachmentUrl,
                attachment_name: attachmentName
            }]);

            if (error) throw error;

            chatInput.value = '';
            fileInput.value = '';
            filePreview.textContent = '';
        } catch (err) {
            console.error('Error sending message:', err);
            alert('حدث خطأ أثناء إرسال الرسالة');
        } finally {
            sendBtn.disabled = false;
        }
    });
}

window.addEventListener('load', loadReportsUserProfile);

// ================== قائمة الحالات للطبيب ==================
async function loadCasesPanel() {
    const panel = document.getElementById('casesPanel');
    const list  = document.getElementById('casesPanelList');
    const count = document.getElementById('casesPanelCount');
    if (!panel || !list) return;

    // تظهر للطبيب فقط
    if (currentUserRole !== 'doctor') {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'flex';

    const { data, error } = await sb
        .from('cases')
        .select('id, name, type, status, created_at')
        .order('created_at', { ascending: false });

    if (error || !data) { list.innerHTML = '<div class="cases-loading">فشل التحميل</div>'; return; }

    const pending = data.filter(c => !c.status || c.status === 'قيد المراجعة');
    if (count) count.textContent = pending.length;

    if (data.length === 0) { list.innerHTML = '<div class="cases-loading">لا توجد حالات</div>'; return; }

    list.innerHTML = data.map(c => {
        const statusMap = {
            'مقبول':                    { cls: 'cs-approved',  txt: 'مقبول' },
            'موافق عليها من الطبيب':   { cls: 'cs-approved',  txt: 'موافق عليها من الطبيب' },
            'مرفوض':                    { cls: 'cs-rejected',  txt: 'مرفوض' },
            'مرفوض من الطبيب':         { cls: 'cs-rejected',  txt: 'مرفوض من الطبيب' },
            'مكتمل':                    { cls: 'cs-completed', txt: 'مكتمل' },
            'قيد المراجعة':             { cls: 'cs-pending',   txt: 'قيد المراجعة' },
        };
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
          ${isPending ? `
          <div class="case-item-btns">
            <button class="ci-approve" onclick="doctorDecision('${c.id}','approve')">
              <i class="fas fa-check"></i> موافقة
            </button>
            <button class="ci-reject" onclick="doctorDecision('${c.id}','reject')">
              <i class="fas fa-times"></i> رفض
            </button>
          </div>` : ''}
        </div>`;
    }).join('');
}

window.doctorDecision = async function(caseId, decision) {
    const newStatus = decision === 'approve' ? 'موافق عليها من الطبيب' : 'مرفوض من الطبيب';
    const label     = decision === 'approve' ? 'الموافقة على' : 'رفض';

    if (!confirm(`هل أنت متأكد من ${label} هذه الحالة؟`)) return;

    // تحديث الحالة في قاعدة البيانات
    const { error } = await sb.from('cases').update({ status: newStatus }).eq('id', caseId);
    if (error) { alert('حدث خطأ: ' + error.message); return; }

    // إرسال إشعار للأدمن
    const icon = decision === 'approve' ? '✅' : '❌';
    const msg  = `${icon} الطبيب ${decision === 'approve' ? 'وافق على' : 'رفض'} الحالة`;
    await sb.from('notifications').insert([{
        message: msg,
        case_id: caseId,
        type: decision === 'approve' ? 'case_approved_by_doctor' : 'case_rejected_by_doctor',
        is_read: false,
        created_at: new Date().toISOString()
    }]).catch(() => {});

    // إرسال رسالة في الشات تلقائياً
    await sb.from('medical_messages').insert([{
        text: `${icon} قرار الطبيب: ${newStatus} للحالة`,
        sender_id: currentUserId,
        sender_role: currentUserRole,
    }]).catch(() => {});

    // تحديث الـ UI مباشرة
    const item = document.getElementById(`ci-${caseId}`);
    if (item) {
        const statusMap = { 'موافق عليها من الطبيب': 'cs-approved', 'مرفوض من الطبيب': 'cs-rejected' };
        item.querySelector('.case-item-status').textContent = newStatus;
        item.querySelector('.case-item-status').className = `case-item-status ${statusMap[newStatus]}`;
        const btns = item.querySelector('.case-item-btns');
        if (btns) btns.remove();
    }

    // تحديث العداد
    const count = document.getElementById('casesPanelCount');
    if (count) count.textContent = Math.max(0, parseInt(count.textContent || '0') - 1);
};
