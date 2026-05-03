const sb = createSupabaseClient();

async function logout() {
  if (sb) await sb.auth.signOut();
  window.location.href = "صفحه العرض.html";
}

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');

if (menuToggle && sidebar) {
  menuToggle.addEventListener('click', function() {
    sidebar.classList.toggle('active');
  });
}

const logoutBtnSidebar = document.getElementById("logoutBtnSidebar");
if (logoutBtnSidebar) {
  logoutBtnSidebar.addEventListener("click", async (e) => {
    e.preventDefault();
    if (sb) {
      await sb.auth.signOut();
      window.location.href = "تسجيل الدخول .html";
    }
  });
}

async function checkUserAndImage() {
  if (!sb) return;
  const { data: { user } } = await sb.auth.getUser();
  
  if (user) {
    const { data: userData } = await sb
      .from('users')
      .select('profile_image')
      .eq('email', user.email)
      .maybeSingle();

    const profileImgSrc = userData?.profile_image || localStorage.getItem(`profileImage_${user.id}`);
    if (profileImgSrc) {
      const navProfileImg = document.getElementById("navProfileImg");
      if (navProfileImg) navProfileImg.src = profileImgSrc;
    }
  }
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

window.addEventListener('load', () => {
  checkUserAndImage();
  loadAdminHeaderInfo();
});

document.addEventListener('DOMContentLoaded', () => {
  const menu = document.querySelector('.case-type-menu');
  const toggle = document.querySelector('.case-type-toggle');
  const label = toggle ? toggle.querySelector('.case-type-label') : null;
  const hiddenInput = document.getElementById('caseType');
  if (!menu || !toggle || !label || !hiddenInput) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) {
      menu.classList.remove('open');
    }
  });

  const options = menu.querySelectorAll('.case-type-list button');
  options.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const typeValue = btn.getAttribute('data-type') || btn.textContent.trim();
      hiddenInput.value = typeValue;
      label.textContent = typeValue;
      menu.classList.remove('open');
    });
  });
});

document.getElementById('caseForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const submitBtn = this.querySelector('.submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'جاري الإضافة...';

  async function getImageUrlToSave() {
    const fileInput = document.getElementById('caseImage');
    const file = fileInput?.files?.[0];
    if (!file) return "../صور المشروع/تبرع.jpg";
    try {
      const ext = file.name.split('.').pop();
      const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `cases/${name}`;
      const { error: uploadError } = await sb.storage.from('cases').upload(filePath, file, { contentType: file.type, upsert: true });
      if (!uploadError) {
        const { data: pub } = sb.storage.from('cases').getPublicUrl(filePath);
        const { data: signed } = await sb.storage.from('cases').createSignedUrl(filePath, 31536000);
        return signed?.signedUrl || pub?.publicUrl;
      }
    } catch (e) {}
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const imageUrlToSave = await getImageUrlToSave();
  const caseTypeValue = document.getElementById('caseType') ? document.getElementById('caseType').value : '';
  const requiredAmount = parseFloat(document.getElementById('requiredAmount')?.value) || 0;
  const formData = {
    name: document.getElementById('caseName').value,
    description: document.getElementById('caseDescription').value,
    required_amount: requiredAmount,
    remaining_amount: requiredAmount > 0 ? requiredAmount : 1,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    image_url: imageUrlToSave
  };
  if (caseTypeValue) {
    formData.type = caseTypeValue;
  }

  try {
    if (!sb) throw new Error("فشل الاتصال بقاعدة البيانات");

    const { data, error } = await sb
      .from('cases')
      .insert([formData])
      .select();

    if (error) throw error;

    // إرسال إشعار للأدمن
    const caseName = formData.name || 'حالة جديدة';
    const { data: adminUser } = await sb.from('users').select('id').eq('email', 'ahussin9125@gmail.com').maybeSingle();
    await sb.from('notifications').insert({
        title: 'تم إضافة حالة جديدة',
        message: `تمت إضافة حالة "${caseName}" وهي قيد المراجعة الآن.`,
        type: 'user',
        is_read: false,
        user_id: adminUser?.id || null,
        created_at: new Date().toISOString()
    }).catch(e => console.warn('notification error:', e.message));

    alert('تم إضافة الحالة بنجاح! ✅');
    window.location.href = "عرض الحالات.html";

  } catch (error) {
    console.error('خطأ في إضافة الحالة:', error);
    alert('حدث خطأ أثناء إضافة الحالة: ' + (error.message || 'خطأ غير معروف'));
    submitBtn.disabled = false;
    submitBtn.textContent = 'إضافة الحالة';
  }
});

document.querySelectorAll('input:not([type="file"])').forEach(input => {
  input.addEventListener('focus', function() {
    this.parentElement.style.transform = 'scale(1.02)';
  });

  input.addEventListener('blur', function() {
    this.parentElement.style.transform = 'scale(1)';
  });
});

const caseImageInput = document.getElementById('caseImage');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewBox = document.getElementById('imagePreviewBox');
if (caseImageInput && imagePreview && imagePreviewBox) {
  caseImageInput.addEventListener('change', function() {
    const file = this.files && this.files[0];
    const placeholder = imagePreviewBox.querySelector('.placeholder');
    if (file) {
      const url = URL.createObjectURL(file);
      imagePreview.src = url;
      imagePreviewBox.classList.add('has-image');
      if (placeholder) placeholder.style.display = 'none';
      imagePreview.onload = () => URL.revokeObjectURL(url);
    } else {
      imagePreview.src = '';
      imagePreviewBox.classList.remove('has-image');
      if (placeholder) placeholder.style.display = '';
    }
  });
}
