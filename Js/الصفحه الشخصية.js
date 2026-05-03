const sb = createSupabaseClient();

async function logout() {
  if (sb) await sb.auth.signOut();
  window.location.href = "صفحه العرض.html";
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await logout();
  });
}

const menuBtn2 = document.getElementById("menuBtn");
const mainNav2 = document.querySelector("nav.main-nav");
if (menuBtn2 && mainNav2) {
  menuBtn2.addEventListener("click", () => {
    mainNav2.classList.toggle("active");
    const icon = menuBtn2.querySelector("i");
    if (icon) icon.className = mainNav2.classList.contains("active")
        ? "fa-solid fa-xmark" : "fa-solid fa-bars";
  });
  mainNav2.querySelectorAll(".nav-item").forEach(a => {
    a.addEventListener("click", () => {
      mainNav2.classList.remove("active");
      const icon = menuBtn2.querySelector("i");
      if (icon) icon.className = "fa-solid fa-bars";
    });
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("header") && mainNav2.classList.contains("active")) {
      mainNav2.classList.remove("active");
      const icon = menuBtn2.querySelector("i");
      if (icon) icon.className = "fa-solid fa-bars";
    }
  });
}

function goBack() {
  window.history.back();
}

window.onclick = (e) => {
  if (e.target == modal) modal.style.display = "none";
};

document.querySelector(".popup-btn.delete").onclick = () => {
  if (confirm("هل أنت متأكد من حذف الحساب؟")) {
    alert("تم حذف الحساب");
  }
};

const profileImg = document.getElementById("profileImg");
const navProfileImg = document.getElementById("navProfileImg");
const formProfileImg = document.getElementById("formProfileImg");
const uploadInput = document.getElementById("uploadProfile");
const loadingOverlay = document.getElementById("loadingOverlay");

let currentUser = null;

async function checkAuthAndFetchData() {
  showLoading(true);
  const { data: { user }, error: authError } = await sb.auth.getUser();

  if (authError || !user) {
    window.location.href = "تسجيل الدخول .html";
    return;
  }

  currentUser = user;

  const params = new URLSearchParams(window.location.search);
  const viewedUserId = params.get("userId");
  const isViewingOther = viewedUserId && viewedUserId !== user.id;

  const { data: selfRow, error: selfError } = await sb
    .from("users")
    .select("*")
    .or(`id.eq.${user.id}` + (user.email ? `,email.eq.${user.email}` : ""))
    .maybeSingle();

  let userData = selfRow || null;
  let dbError = selfError || null;

  if (isViewingOther && viewedUserId) {
    const { data: otherRow, error: otherError } = await sb
      .from("users")
      .select("*")
      .eq("id", viewedUserId)
      .maybeSingle();
    if (otherRow) userData = otherRow;
    if (otherError && !dbError) dbError = otherError;
  }

  if (dbError) {
    console.error("خطأ في جلب بيانات قاعدة البيانات:", dbError);
  }

  const fullName =
    userData?.name ||
    (!isViewingOther ? user.user_metadata?.full_name || "" : "");
  const nameParts = fullName.split(" ");

  document.getElementById("firstName").value = nameParts[0] || "";
  document.getElementById("lastName").value = nameParts.slice(1).join(" ") || "";

  const userEmail = userData?.email || (!isViewingOther ? user.email : "");
  const isInternalEmail =
    userEmail && userEmail.endsWith("@charity.internal");
  document.getElementById("email").value = isInternalEmail
    ? "مسجل عبر الهاتف"
    : userEmail;

  document.getElementById("phone").value =
    userData?.phone || (!isViewingOther ? user.user_metadata?.display_phone : "");

  document.getElementById("userNameDisplay").innerText =
    fullName || "مستخدم جديد";

  const savedImage =
    userData?.profile_image ||
    (!isViewingOther ? localStorage.getItem(`profileImage_${user.id}`) : null);

  if (isViewingOther) {
    // صورة الشخص المعروض تروح للـ form بس
    updateAllImages(savedImage || "../images/default-avatar.png", false);

    // صورة الأدمن نفسه تفضل في الـ nav
    const adminImage = selfRow?.profile_image || localStorage.getItem(`profileImage_${user.id}`);
    if (navProfileImg) navProfileImg.src = adminImage || "../images/default-avatar.png";
  } else {
    updateAllImages(savedImage || "../images/default-avatar.png", true);
  }

  if (isViewingOther) {
    const firstNameInput = document.getElementById("firstName");
    const lastNameInput = document.getElementById("lastName");
    const phoneInput = document.getElementById("phone");
    const emailInput = document.getElementById("email");
    const saveBtn = document.getElementById("saveBtn");
    const resetPasswordBtn = document.getElementById("resetPasswordBtn");
    const cancelBtn = document.querySelector(".cancel-btn");

    [firstNameInput, lastNameInput, phoneInput, emailInput].forEach((el) => {
      if (el) el.disabled = true;
    });

    [saveBtn, resetPasswordBtn, cancelBtn].forEach((btn) => {
      if (btn) btn.style.display = "none";
    });

    if (uploadInput) {
      uploadInput.disabled = true;
    }
  }

  showLoading(false);
}

function showLoading(show) {
  if (loadingOverlay) loadingOverlay.style.display = show ? "flex" : "none";
}

function updateAllImages(src, updateNav = true) {
  if (profileImg) profileImg.src = src;
  if (formProfileImg) formProfileImg.src = src;
  if (navProfileImg && updateNav) navProfileImg.src = src;
}

uploadInput.addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    alert(
      "⚠️ حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 2 ميجابايت."
    );
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    const result = e.target.result;

    showLoading(true);
    try {
      updateAllImages(result);

      if (currentUser) {
        localStorage.setItem(`profileImage_${currentUser.id}`, result);

        const { error } = await sb
          .from("users")
          .update({ profile_image: result })
          .or(
            `id.eq.${currentUser.id}` +
              (currentUser.email ? `,email.eq.${currentUser.email}` : "")
          );
        if (error) throw error;
      }
    } catch (error) {
      alert("حدث خطأ أثناء حفظ الصورة: " + error.message);
    } finally {
      showLoading(false);
    }
  };
  reader.readAsDataURL(file);
});

window.addEventListener("load", checkAuthAndFetchData);

async function saveData() {
  const firstName = document.getElementById("firstName").value.trim();
  const lastName = document.getElementById("lastName").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!firstName || !lastName || !phone) {
    alert("من فضلك املأ جميع البيانات المطلوبة");
    return;
  }

  if (!currentUser) {
    alert("خطأ: لم يتم العثور على بيانات المستخدم");
    return;
  }

  showLoading(true);
  const fullName = `${firstName} ${lastName}`;

  try {
    const { error: authUpdateError } = await sb.auth.updateUser({
      data: { full_name: fullName },
    });

    if (authUpdateError) throw authUpdateError;

    const { error: dbUpdateError } = await sb
      .from("users")
      .update({
        name: fullName,
        phone: phone,
      })
      .or(
        `id.eq.${currentUser.id}` +
          (currentUser.email ? `,email.eq.${currentUser.email}` : "")
      );

    if (dbUpdateError) throw dbUpdateError;

    document.getElementById("userNameDisplay").innerText = fullName;
    alert("تم حفظ البيانات بنجاح في قاعدة البيانات ✔");
  } catch (error) {
    alert("حدث خطأ أثناء حفظ البيانات: " + error.message);
  } finally {
    showLoading(false);
  }
}

function cancel() {
  if (confirm("هل أنت متأكد من إلغاء التغييرات؟")) {
    checkAuthAndFetchData();
  }
}
