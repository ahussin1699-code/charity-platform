const sb = createSupabaseClient();

function getQueryParam(key) {
  const search = new URLSearchParams(window.location.search);
  return search.get(key);
}

async function loadCaseData() {
  if (!sb) return;

  const id = getQueryParam('id');
  if (!id) {
    alert('لا يوجد معرف للحالة في الرابط');
    window.location.href = 'عرض الحالات.html';
    return;
  }

  const nameInput = document.getElementById('caseName');
  const descInput = document.getElementById('caseDescription');
  const phoneInput = document.getElementById('phone');
  const statusInput = document.getElementById('caseStatus');

  try {
    const { data, error } = await sb
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      alert('لم يتم العثور على الحالة المطلوبة');
      window.location.href = 'عرض الحالات.html';
      return;
    }

    if (nameInput) nameInput.value = data.name || '';
    if (descInput) descInput.value = data.description || '';
    if (phoneInput) phoneInput.value = data.phone || '';
    if (statusInput) statusInput.value = data.status || 'قيد المراجعة';

    // عرض الصورة الحالية
    if (data.image_url) {
      const preview = document.getElementById('imagePreview');
      const label   = document.getElementById('imageUploadLabel');
      if (preview) { preview.src = data.image_url; preview.style.display = 'block'; }
      if (label)   label.style.display = 'none';
    }

    // المبلغ المطلوب
    const targetAmountInput = document.getElementById('targetAmount');
    if (targetAmountInput) targetAmountInput.value = data.target_amount || '';

    // طرق التبرع
    const methods = data.payment_methods ? data.payment_methods.split(',') : [];
    document.querySelectorAll('input[name="paymentMethod"]').forEach(cb => {
        cb.checked = methods.includes(cb.value);
    });
  } catch (e) {
    console.error('خطأ في تحميل بيانات الحالة:', e);
    alert('تعذر تحميل بيانات الحالة، حاول مرة أخرى لاحقاً');
    window.location.href = 'عرض الحالات.html';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadCaseData();

  // preview الصورة عند الاختيار
  const caseImageInput = document.getElementById('caseImage');
  if (caseImageInput) {
    caseImageInput.addEventListener('change', function() {
      const file = this.files[0];
      if (!file) return;
      const preview = document.getElementById('imagePreview');
      const label   = document.getElementById('imageUploadLabel');
      const reader  = new FileReader();
      reader.onload = e => {
        if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
        if (label)   label.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });
  }

  const form = document.getElementById('editForm');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const id = getQueryParam('id');
      if (!id) {
        alert('لا يوجد معرف للحالة في الرابط');
        return;
      }

      const selectedMethods = [...document.querySelectorAll('input[name="paymentMethod"]:checked')]
        .map(cb => cb.value).join(',');

      // رفع الصورة لو في صورة جديدة
      let imageUrl = null;
      const imageFile = document.getElementById('caseImage')?.files[0];
      if (imageFile) {
        const ext      = imageFile.name.split('.').pop();
        const filePath = `cases/${id}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await sb.storage.from('cases').upload(filePath, imageFile, { upsert: true });
        if (uploadErr) {
          alert('فشل رفع الصورة: ' + uploadErr.message);
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'حفظ التعديلات'; }
          return;
        }
        const { data: urlData } = sb.storage.from('cases').getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }

      const formData = {
        name: document.getElementById('caseName')?.value,
        description: document.getElementById('caseDescription')?.value,
        phone: document.getElementById('phone')?.value,
        status: document.getElementById('caseStatus')?.value,
        target_amount: parseFloat(document.getElementById('targetAmount')?.value) || null,
        payment_methods: selectedMethods || null,
        ...(imageUrl && { image_url: imageUrl }),
      };

      const submitBtn = document.querySelector('.submit-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الحفظ...';
      }

      try {
        const { error } = await sb
          .from('cases')
          .update(formData)
          .eq('id', id);

        if (error) throw error;

        alert('تم حفظ التعديلات بنجاح ✅');
        window.location.href = 'تفاصيل الحاله.html?id=' + encodeURIComponent(id);
      } catch (err) {
        console.error('خطأ أثناء حفظ التعديلات:', err);
        alert('حدث خطأ أثناء حفظ التعديلات: ' + (err.message || 'حاول مرة أخرى'));
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'حفظ التعديلات';
        }
      }
    });
  }

  // زر الحذف
  const deleteBtn = document.getElementById('deleteCaseBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async function() {
      const id = getQueryParam('id');
      if (!id) return;

      if (!confirm('هل أنت متأكد من حذف هذه الحالة؟ لا يمكن التراجع عن هذا الإجراء.')) return;

      deleteBtn.disabled = true;
      deleteBtn.textContent = 'جاري الحذف...';

      try {
        const { data, error } = await sb
          .from('cases')
          .delete()
          .eq('id', id)
          .select();

        console.log('Delete result:', { data, error });

        if (error) throw error;

        // لو data فاضية يعني RLS منعت الحذف
        if (!data || data.length === 0) {
          alert('لم يتم الحذف - تأكد من صلاحيات الحذف في Supabase RLS');
          deleteBtn.disabled = false;
          deleteBtn.textContent = 'حذف الحالة';
          return;
        }

        alert('تم حذف الحالة بنجاح 🗑️');
        window.location.href = 'مراجعه الحالات.html';
      } catch (err) {
        console.error('خطأ أثناء حذف الحالة:', err);
        alert('حدث خطأ أثناء الحذف: ' + (err.message || 'حاول مرة أخرى'));
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'حذف الحالة';
      }
    });
  }
});
