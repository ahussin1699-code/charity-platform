document.getElementById('donateForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const name = document.getElementById('donorName').value;
    const amount = parseFloat(document.getElementById('donationAmount').value);
    const phone = document.getElementById('donorNumber').value;
    
    const urlParams = new URLSearchParams(window.location.search);
    const caseId = urlParams.get('id');

    if (!caseId) {
        alert('خطأ: لم يتم تحديد الحالة المراد التبرع لها');
        return;
    }

    if (name && amount && phone) {
        const submitBtn = this.querySelector('.donate-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري تنفيذ التبرع...';

        try {
            // جلب البيانات الحالية للحالة
            const { data: caseData, error: fetchError } = await sb
                .from('cases')
                .select('remaining_amount, name')
                .eq('id', caseId)
                .single();

            if (fetchError) throw fetchError;

            if (amount > caseData.remaining_amount) {
                alert('عذراً، مبلغ التبرع أكبر من المبلغ المتبقي للحالة (' + caseData.remaining_amount + ' جنيه)');
                submitBtn.disabled = false;
                submitBtn.textContent = 'تبرع الآن';
                return;
            }

            // تحديث المبلغ المتبقي في قاعدة البيانات
            const newRemaining = caseData.remaining_amount - amount;
            const { error: updateError } = await sb
                .from('cases')
                .update({ remaining_amount: newRemaining })
                .eq('id', caseId);

            if (updateError) throw updateError;

            const donationStatus = newRemaining <= 0 ? 'مكتمل' : 'قيد المعالجة';

            try {
                const { error: donationError } = await sb
                    .from('donations')
                    .insert({
                        donor_name: name,
                        phone: phone,
                        amount: amount,
                        case_id: caseId,
                        case_name: caseData.name,
                        status: donationStatus,
                        created_at: new Date().toISOString()
                    });

                if (donationError) {
                    console.warn('خطأ في حفظ سجل التبرع:', donationError);
                }

                const notificationTitle = 'تبرع جديد';
                const notificationMessage = 'تبرع ' + name + ' بمبلغ ' + amount + ' جنيه لحالة ' + caseData.name;
                const { error: notificationError } = await sb
                    .from('notifications')
                    .insert({
                        title: notificationTitle,
                        message: notificationMessage,
                        type: 'donation',
                        is_read: false
                    });

                if (notificationError) {
                    console.warn('خطأ في حفظ الإشعار:', notificationError);
                }
            } catch (logError) {
                console.warn('استثناء أثناء حفظ سجل التبرع:', logError);
            }

            alert('شكراً لك يا ' + name + '! \nتم التبرع بنجاح لمصلحة: ' + caseData.name);
            window.location.href = "عرض الحالات.html";

        } catch (error) {
            console.error('خطأ في عملية التبرع:', error);
            alert('حدث خطأ أثناء عملية التبرع، يرجى المحاولة لاحقاً');
            submitBtn.disabled = false;
            submitBtn.textContent = 'تبرع الآن';
        }
    } else {
        alert('الرجاء تعبئة جميع الحقول المطلوبة');
    }
});

// وظيفة جلب بيانات الحالة عند تحميل الصفحة
async function loadCaseDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const caseId = urlParams.get('id');

    if (!caseId) {
        document.getElementById('caseNameDisplay').textContent = 'خطأ: لم يتم اختيار حالة';
        return;
    }

    try {
        if (!sb) {
            console.error('Supabase client not initialized');
            return;
        }

        const { data, error } = await sb
            .from('cases')
            .select('*')
            .eq('id', caseId)
            .single();

        if (error) throw error;

        if (data) {
            document.getElementById('caseNameDisplay').textContent = 'تبرع لحالة: ' + data.name;
            document.getElementById('requiredAmountDisplay').textContent = data.required_amount + ' جنيه';
            document.getElementById('remainingAmountDisplay').textContent = data.remaining_amount + ' جنيه';
            
            // تحديث عنوان الصفحة
            document.title = 'تبرع لحالة ' + data.name + ' - تبرعات خيرية';
        }
    } catch (error) {
        console.error('Error loading case details:', error);
        document.getElementById('caseNameDisplay').textContent = 'خطأ في تحميل بيانات الحالة';
    }
}

// تشغيل جلب البيانات عند التحميل
document.addEventListener('DOMContentLoaded', loadCaseDetails);
