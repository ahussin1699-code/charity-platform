document.addEventListener('DOMContentLoaded', () => {
    const visaMethod = document.getElementById('visa-method');
    const walletMethod = document.getElementById('wallet-method');
    const visaForm = document.getElementById('visa-form');
    const walletForm = document.getElementById('wallet-form');
    const paymentStatus = document.getElementById('payment-status');

    // Donor info fields (Unified)
    const donorNameInput = document.getElementById('donor-name');
    const donorPhoneInput = document.getElementById('donor-phone');
    const donationAmountInput = document.getElementById('donation-amount');

    const sb = createSupabaseClient();

    // Get case ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const caseId = urlParams.get('id');

    // --- Switch between payment methods ---
    visaMethod.addEventListener('click', () => {
        visaMethod.classList.add('active');
        walletMethod.classList.remove('active');
        visaForm.classList.remove('hidden');
        walletForm.classList.add('hidden');
        paymentStatus.classList.add('hidden');
    });

    walletMethod.addEventListener('click', () => {
        walletMethod.classList.add('active');
        visaMethod.classList.remove('active');
        walletForm.classList.remove('hidden');
        visaForm.classList.add('hidden');
        paymentStatus.classList.add('hidden');
    });

    // --- Helper function to complete donation in database ---
    async function completeDonation(method, walletData = null) {
        const name = donorNameInput.value.trim();
        const phone = donorPhoneInput.value.trim();
        const amount = parseFloat(donationAmountInput.value);

        if (!name || !phone || isNaN(amount) || amount <= 0) {
            alert('يرجى ملء كافة بيانات التبرع أولاً (الاسم، الهاتف، المبلغ)');
            return false;
        }

        if (!caseId) {
            alert('خطأ: لم يتم تحديد الحالة');
            return false;
        }

        try {
            // 1. Fetch current case data
            const { data: caseData, error: fetchError } = await sb
                .from('cases')
                .select('remaining_amount, name')
                .eq('id', caseId)
                .single();

            if (fetchError) throw fetchError;

            // 2. Update remaining amount in cases table
            const newRemaining = caseData.remaining_amount - amount;
            const { error: updateError } = await sb
                .from('cases')
                .update({ remaining_amount: newRemaining })
                .eq('id', caseId);

            if (updateError) throw updateError;

            const donationStatus = method === 'wallet' ? 'قيد المراجعة' : (newRemaining <= 0 ? 'مكتمل' : 'مقبول');

            // 3. Upload receipt if it's a wallet payment
            let receiptUrl = null;
            if (method === 'wallet' && walletData && walletData.receiptFile) {
                const file = walletData.receiptFile;
                const fileExt = file.name.split('.').pop();
                const fileName = `receipt_${Date.now()}.${fileExt}`;
                const filePath = `receipts/${fileName}`;

                try {
                    const { error: uploadError } = await sb.storage
                        .from('donations')
                        .upload(filePath, file);

                    if (uploadError) {
                        // الـ bucket غير موجود أو خطأ في الرفع — نكمل بدون صورة
                        console.warn('تعذّر رفع الإيصال:', uploadError.message);
                    } else {
                        const { data: urlData } = sb.storage.from('donations').getPublicUrl(filePath);
                        receiptUrl = urlData.publicUrl;
                    }
                } catch (uploadErr) {
                    console.warn('تعذّر رفع الإيصال:', uploadErr.message);
                }
            }

            // 4. Record the donation
            await sb.from('donations').insert({
                donor_name: name,
                phone: phone,
                amount: amount,
                case_id: caseId,
                case_name: caseData.name,
                payment_method: method,
                status: donationStatus,
                attachment_url: receiptUrl,
                created_at: new Date().toISOString()
            });

            // 5. Send notification to admin
            const notifData = {
                title: 'تبرع جديد (' + (method === 'visa' ? 'فيزا' : 'محفظة') + ')',
                message: `تبرع ${name} بمبلغ ${amount} جنيه لحالة ${caseData.name}. ${method === 'wallet' ? 'يرجى مراجعة الإيصال.' : ''}`,
                type: 'donation',
                created_at: new Date().toISOString()
            };
            // نضيف is_read لو الجدول يدعمه
            try {
                const { error: notifError } = await sb.from('notifications').insert(notifData);
                if (notifError) {
                    // جرب بدون created_at
                    const { error: e2 } = await sb.from('notifications').insert({
                        title: notifData.title,
                        message: notifData.message,
                        type: notifData.type
                    });
                    if (e2) console.error('خطأ في إرسال الإشعار:', e2.message);
                }
            } catch(e) { console.error('notification error:', e); }

            return true;
        } catch (error) {
            console.error('Error completing donation:', error);
            alert('حدث خطأ أثناء الاتصال بقاعدة البيانات: ' + error.message);
            return false;
        }
    }

    // --- Visa Form Submission ---
    visaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = visaForm.querySelector('.pay-btn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري المعالجة...';

        const success = await completeDonation('visa');
        
        if (success) {
            paymentStatus.textContent = 'تمت عملية الدفع بنجاح! شكراً لتبرعك.';
            paymentStatus.className = 'status-message status-success';
            paymentStatus.classList.remove('hidden');
            visaForm.reset();
            showReviewPopup();
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    // --- Wallet Form Submission ---
    walletForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const receiptInput = document.getElementById('transfer-receipt');
        if (!receiptInput.files || receiptInput.files.length === 0) {
            alert('يرجى إرفاق صورة إيصال التحويل');
            return;
        }

        const submitBtn = walletForm.querySelector('.pay-btn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الإرسال...';

        const success = await completeDonation('wallet', {
            receiptFile: receiptInput.files[0]
        });

        if (success) {
            paymentStatus.textContent = 'تم إرسال بيانات التحويل بنجاح. سيتم المراجعة قريباً.';
            paymentStatus.className = 'status-message status-success';
            paymentStatus.classList.remove('hidden');
            walletForm.reset();
            showReviewPopup();
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    // --- Input Formatting for Visa ---
    const cardNumber = document.getElementById('card-number');
    if (cardNumber) {
        cardNumber.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            value = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = value;
        });
    }

    const expiryDate = document.getElementById('expiry-date');
    if (expiryDate) {
        expiryDate.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        });
    }

    const cvv = document.getElementById('cvv');
    if (cvv) {
        cvv.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
});

// ===== Popup التقييم بعد التبرع =====
function showReviewPopup() {
    // إنشاء الـ popup
    const overlay = document.createElement('div');
    overlay.id = 'reviewOverlay';
    overlay.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.55);
        z-index:9999;display:flex;align-items:center;justify-content:center;
        animation:fadeIn .3s ease;
    `;

    overlay.innerHTML = `
        <div style="background:#fff;border-radius:20px;padding:32px 28px;max-width:420px;width:90%;
                    text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);direction:rtl;
                    font-family:'Cairo',sans-serif;animation:slideUp .3s ease;">
            <div style="font-size:2.5rem;margin-bottom:8px;">🎉</div>
            <h2 style="color:#2f6d3f;font-size:1.2rem;margin-bottom:6px;">شكراً لتبرعك!</h2>
            <p style="color:#555;font-size:0.88rem;margin-bottom:20px;">
                تبرعك وصل — كيف كانت تجربتك مع المنصة؟
            </p>

            <!-- نجوم التقييم -->
            <div id="popupStars" style="display:flex;justify-content:center;gap:10px;margin-bottom:16px;flex-direction:row-reverse;">
                ${[5,4,3,2,1].map(n=>`
                    <span data-val="${n}" style="font-size:2rem;color:#ddd;cursor:pointer;transition:color .15s;">★</span>
                `).join('')}
            </div>

            <textarea id="popupComment" placeholder="اكتب تعليقاً (اختياري)..."
                style="width:100%;padding:10px 12px;border:1.5px solid #ddd;border-radius:10px;
                       font-family:inherit;font-size:0.88rem;resize:none;height:80px;
                       margin-bottom:14px;box-sizing:border-box;"></textarea>

            <div style="display:flex;gap:10px;">
                <button id="popupSubmit" onclick="submitPopupReview()"
                    style="flex:1;padding:11px;background:#2f6d3f;color:#fff;border:none;
                           border-radius:10px;font-size:0.95rem;font-weight:700;cursor:pointer;
                           font-family:inherit;">
                    إرسال التقييم
                </button>
                <button onclick="closeReviewPopup(true)"
                    style="padding:11px 18px;background:#f5f5f5;color:#555;border:none;
                           border-radius:10px;font-size:0.88rem;cursor:pointer;font-family:inherit;">
                    تخطي
                </button>
            </div>
            <div id="popupMsg" style="margin-top:10px;font-size:0.85rem;min-height:18px;"></div>
        </div>
        <style>
            @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
            @keyframes slideUp { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
        </style>
    `;

    document.body.appendChild(overlay);

    // تفعيل النجوم
    let selectedRating = 0;
    const stars = overlay.querySelectorAll('#popupStars span');
    stars.forEach(s => {
        s.addEventListener('mouseover', () => {
            stars.forEach(x => x.style.color = parseInt(x.dataset.val) >= parseInt(s.dataset.val) ? '#f59e0b' : '#ddd');
        });
        s.addEventListener('mouseout', () => {
            stars.forEach(x => x.style.color = parseInt(x.dataset.val) >= selectedRating ? '#f59e0b' : '#ddd');
        });
        s.addEventListener('click', () => {
            selectedRating = parseInt(s.dataset.val);
            stars.forEach(x => x.style.color = parseInt(x.dataset.val) >= selectedRating ? '#f59e0b' : '#ddd');
        });
    });

    window._popupRating = () => selectedRating;
}

async function submitPopupReview() {
    const rating  = window._popupRating ? window._popupRating() : 0;
    const comment = document.getElementById('popupComment')?.value.trim();
    const msg     = document.getElementById('popupMsg');
    const btn     = document.getElementById('popupSubmit');
    const name    = document.getElementById('donor-name')?.value.trim() || 'متبرع';

    if (!rating) { msg.style.color='#dc3545'; msg.textContent='⚠ اختر عدد النجوم أولاً'; return; }

    btn.disabled = true; btn.textContent = 'جاري الإرسال...';

    const sb = createSupabaseClient();
    const { error } = await sb.from('reviews').insert([{
        rating, name, comment: comment || '',
        created_at: new Date().toISOString()
    }]);

    if (error) {
        msg.style.color = '#dc3545';
        msg.textContent = '❌ حدث خطأ، سيتم التخطي';
        setTimeout(() => closeReviewPopup(true), 1500);
    } else {
        msg.style.color = '#2f6d3f';
        msg.textContent = '✅ شكراً على تقييمك!';
        setTimeout(() => closeReviewPopup(true), 1200);
    }
}

function closeReviewPopup(redirect = false) {
    const overlay = document.getElementById('reviewOverlay');
    if (overlay) overlay.remove();
    if (redirect) window.location.href = 'تم التبرع بنجاح.html';
}
