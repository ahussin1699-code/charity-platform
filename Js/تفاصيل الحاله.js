const sb = createSupabaseClient();
const ADMIN_EMAIL = 'ahussin9125@gmail.com';

function getFallbackImage() {
  return "../صور المشروع/تبرع.jpg";
}

function chooseImageSrc(value) {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return getFallbackImage();
  if (v.startsWith("data:image/")) return v;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("../") || v.startsWith("./") || v.startsWith("/")) return v;
  return getFallbackImage();
}

const menuBtnD = document.getElementById('menuBtn');
const mainNavD = document.querySelector('nav.main-nav');
if (menuBtnD && mainNavD) {
    menuBtnD.addEventListener('click', () => {
        mainNavD.classList.toggle('active');
        const icon = menuBtnD.querySelector('i');
        if (icon) icon.className = mainNavD.classList.contains('active')
            ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    mainNavD.querySelectorAll('.nav-item').forEach(a => {
        a.addEventListener('click', () => {
            mainNavD.classList.remove('active');
            const icon = menuBtnD.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-bars';
        });
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('header') && mainNavD.classList.contains('active')) {
            mainNavD.classList.remove('active');
            const icon = menuBtnD.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-bars';
        }
    });
}

async function checkUserAndImage() {
    if (!sb) return;
    const { data } = await sb.auth.getUser();
    const user = data && data.user;

    const profileNavItem = document.getElementById("profileNavItem");
    const logoutBtn = document.getElementById("logoutBtn");
    const deleteCaseBtn = document.getElementById("deleteCaseBtn");

    if (!user) {
        if (profileNavItem) {
            profileNavItem.style.display = "none";
        }
        if (logoutBtn) {
            logoutBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><span>تسجيل الدخول</span>';
            logoutBtn.href = "تسجيل الدخول .html";
            logoutBtn.onclick = null;
        }
        if (deleteCaseBtn) {
            deleteCaseBtn.style.display = "none";
        }
        return;
    }

    if (profileNavItem) {
        profileNavItem.style.display = "flex";
    }

    if (logoutBtn) {
        logoutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i><span>خروج</span>';
        logoutBtn.href = "#";
        logoutBtn.onclick = async function(e) {
            e.preventDefault();
            if (sb) await sb.auth.signOut();
            window.location.href = "تسجيل الدخول .html";
        };
    }

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

    const metaIsAdmin = user.user_metadata && (user.user_metadata.is_admin === true || user.user_metadata.role === 'admin');
    const emailIsAdmin = user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const isAdmin = !!(metaIsAdmin || emailIsAdmin);

    if (deleteCaseBtn) {
        deleteCaseBtn.style.display = isAdmin ? "inline-block" : "none";
    }

    const adminOnlyEls = document.querySelectorAll(".admin-only");
    adminOnlyEls.forEach(el => {
        el.style.display = isAdmin ? "flex" : "none";
    });
}

window.addEventListener('load', () => {
    checkUserAndImage();
    loadCaseDetails();
});

async function loadCaseDetails() {
  if (!sb) return;

  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("id");

  const titleEl = document.getElementById("caseTitle");
  const shortEl = document.getElementById("caseShort");
  const descEl = document.getElementById("caseDesc");
  const avatarEl = document.getElementById("caseAvatar");
  const reqEl = document.getElementById("req");
  const colEl = document.getElementById("col");
  const remEl = document.getElementById("rem");
  const donateBtn = document.getElementById("donateBtn");

  if (!caseId) {
    if (titleEl) titleEl.textContent = "خطأ: لم يتم تحديد الحالة";
    if (shortEl) shortEl.textContent = "";
    if (descEl) descEl.textContent = "";
    if (donateBtn) donateBtn.disabled = true;
    return;
  }

  const deleteCaseBtn = document.getElementById("deleteCaseBtn");
  if (deleteCaseBtn) {
    deleteCaseBtn.addEventListener("click", async function () {
      if (!sb) return;

      const paramsInner = new URLSearchParams(window.location.search);
      const idInner = paramsInner.get("id");
      if (!idInner) {
        alert("❌ لا يوجد معرف للحالة في الرابط");
        return;
      }

      const confirmDelete = confirm("هل أنت متأكد من حذف هذه الحالة؟ هذا الإجراء لا يمكن التراجع عنه.");
      if (!confirmDelete) return;

      let hardDeleteError = null;
      try {
        const { error } = await sb
          .from("cases")
          .delete()
          .eq("id", idInner);
        hardDeleteError = error || null;
      } catch (e) {
        hardDeleteError = e;
      }

      if (hardDeleteError) {
        console.warn("لم يتم حذف الصف فعلياً، سيتم إخفاء الحالة بتصفير المبلغ المتبقي.", hardDeleteError);
      }

      const { error: softError } = await sb
        .from("cases")
        .update({ remaining_amount: 0 })
        .eq("id", idInner);

      if (softError) {
        alert("❌ حدث خطأ أثناء حذف الحالة: " + softError.message);
        console.error(softError);
        return;
      }

      alert("✅ تم حذف الحالة بنجاح");
      window.location.href = "عرض الحالات.html";
    });
  }

  try {
    const { data, error } = await sb
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (error) throw error;

    if (!data) {
      if (titleEl) titleEl.textContent = "لم يتم العثور على الحالة";
      if (donateBtn) donateBtn.disabled = true;
      return;
    }

    const name = data.name || "";
    if (titleEl) titleEl.textContent = "تفاصيل حالة " + name;
    if (shortEl) shortEl.textContent = data.category || "";
    if (descEl) descEl.textContent = data.description || "";
    if (avatarEl) avatarEl.src = chooseImageSrc(data.image_url);

    const addressEl = document.getElementById("caseAddress");
    const phoneEl = document.getElementById("casePhone");
    const emailEl = document.getElementById("caseEmail");

    if (addressEl) addressEl.textContent = data.address || "غير متوفر";
    if (phoneEl) phoneEl.textContent = data.phone || "غير متوفر";
    if (emailEl) emailEl.textContent = data.email || "غير متوفر";

    // ---- المبلغ المطلوب وطرق التبرع ----
    const paymentBox      = document.getElementById('paymentInfoBox');
    const targetAmountRow = document.getElementById('targetAmountRow');
    const targetAmountVal = document.getElementById('targetAmountVal');
    const methodsRow      = document.getElementById('paymentMethodsRow');
    const methodsBadges   = document.getElementById('methodsBadges');

    let showBox = false;

    // نقرأ من target_amount أو required_amount (أيهما موجود)
    const targetAmt = parseFloat(data.target_amount) || parseFloat(data.required_amount) || 0;

    if (targetAmt > 0) {
      if (targetAmountRow) targetAmountRow.style.display = 'flex';
      if (targetAmountVal) targetAmountVal.textContent = targetAmt.toLocaleString('ar-EG') + ' جنيه';

      // المبلغ المتبقي
      const remaining = (data.remaining_amount !== null && data.remaining_amount !== undefined)
        ? parseFloat(data.remaining_amount)
        : targetAmt;
      const collected = Math.max(0, targetAmt - remaining);
      const pct = targetAmt > 0
        ? Math.min(100, Math.round((collected / targetAmt) * 100))
        : 0;

      const remainingRow = document.getElementById('remainingRow');
      const remainingVal = document.getElementById('remainingVal');
      const collectedVal = document.getElementById('collectedVal');
      const progressFill = document.getElementById('progressFill');
      const progressPct  = document.getElementById('progressPct');
      const progressWrap = document.getElementById('progressWrap');

      if (remainingRow) remainingRow.style.display = 'flex';
      if (remainingVal) remainingVal.textContent = remaining.toLocaleString('ar-EG') + ' جنيه';
      if (collectedVal) collectedVal.textContent = collected.toLocaleString('ar-EG') + ' جنيه';
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressPct)  progressPct.textContent  = pct + '%';
      if (progressWrap) progressWrap.style.display = 'flex';

      showBox = true;
    }

    if (data.payment_methods) {
      const methods = data.payment_methods.split(',').map(m => m.trim()).filter(Boolean);
      if (methods.length && methodsRow && methodsBadges) {
        methodsRow.style.display = 'flex';
        const icons = {
          visa:   '<i class="fa-brands fa-cc-visa"></i> فيزا / ماستركارد',
          wallet: '<i class="fa-solid fa-wallet"></i> محفظة إلكترونية',
        };
        methodsBadges.innerHTML = methods.map(m =>
          `<span class="method-badge method-${m}">${icons[m] || m}</span>`
        ).join('');
        showBox = true;
      }
    }

    if (paymentBox && showBox) paymentBox.style.display = 'flex';

    if (donateBtn) {
      donateBtn.disabled = false;
      donateBtn.onclick = function () {
        window.location.href = `صفحة الدفع.html?id=${caseId}`;
      };
    }

    document.title = "تفاصيل حالة " + name;
  } catch (e) {
    console.error("Error loading case details:", e);
    if (titleEl) titleEl.textContent = "خطأ في تحميل بيانات الحالة";
    if (donateBtn) donateBtn.disabled = true;
  }
}
