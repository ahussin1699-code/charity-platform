const sb = createSupabaseClient();
const ADMIN_EMAIL = 'ahussin9125@gmail.com';

async function checkUser() {
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user) {
    window.location.href = "تسجيل الدخول .html";
  } else {
    const userName =
      (user.user_metadata &&
        (user.user_metadata.full_name || user.user_metadata.name)) ||
      user.email;
    const userEmailEl = document.getElementById("userEmail");
    if (userEmailEl) {
      userEmailEl.innerText = "هلا (" + userName + ")";
    }

    const metaIsAdmin =
      user.user_metadata &&
      (user.user_metadata.is_admin === true ||
        user.user_metadata.role === "admin");
    const emailIsAdmin =
      user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const isAdmin = !!(metaIsAdmin || emailIsAdmin);

    const isBeneficiary =
      user.user_metadata &&
      (user.user_metadata.user_type === "beneficiary" ||
        user.user_metadata.user_type === "مستفيد");

    let isDoctor = false;
    let doctorRow = null;
    try {
      const { data: dRow } = await sb
        .from("doctors")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      doctorRow = dRow;
    } catch (_) {}
    const metaIsDoctor =
      user.user_metadata &&
      (user.user_metadata.user_type === "doctor" ||
        user.user_metadata.user_type === "طبيب");
    isDoctor = !!(doctorRow || metaIsDoctor);

    const adminLink = document.getElementById("adminDashboardLink");
    if (adminLink) {
      adminLink.style.display = isAdmin ? "flex" : "none";
    }

    const medicalReportsLink = document.getElementById("medicalReportsLink");
    if (medicalReportsLink) {
      medicalReportsLink.style.display = isDoctor ? "flex" : "none";
    }

    const addCaseLink = document.getElementById("addCaseLink");
    if (addCaseLink) {
      if (isAdmin || isBeneficiary) {
        addCaseLink.style.display = "flex";
        addCaseLink.onclick = function (e) {
          e.preventDefault();
          if (isAdmin) {
            window.location.href = "اضافة حاله جديده.html";
          } else {
            window.location.href = "اضافه حاله العميل .html";
          }
        };
      } else {
        addCaseLink.style.display = "none";
        addCaseLink.onclick = null;
      }
    }
  }
}

async function checkUserAndImage() {
  if (!sb) return;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) {
    const { data: userData } = await sb
      .from("users")
      .select("profile_image")
      .eq("email", user.email)
      .maybeSingle();

    const profileImgSrc =
      userData?.profile_image || localStorage.getItem(`profileImage_${user.id}`);
    if (profileImgSrc) {
      const navProfileImg = document.getElementById("navProfileImg");
      if (navProfileImg) navProfileImg.src = profileImgSrc;
    }
  }
}

async function logout() {
  if (!sb) return;
  await sb.auth.signOut();
  window.location.href = "صفحه العرض.html";
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await logout();
  });
}

const menuBtn = document.getElementById("menuBtn");
const mainNav = document.querySelector("nav.main-nav");
if (menuBtn && mainNav) {
  menuBtn.addEventListener("click", () => {
    mainNav.classList.toggle("active");
  });
}

function donate(name) {
  window.location.href =
    "صفحه التبرع.html?name=" + encodeURIComponent(name);
}

function getFallbackImageHome() {
  return "../صور المشروع/تبرع.jpg";
}

function chooseImageSrcHome(value) {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return getFallbackImageHome();
  if (v.startsWith("data:image/")) return v;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  if (v.startsWith("../") || v.startsWith("./") || v.startsWith("/")) return v;
  return getFallbackImageHome();
}

function createHomeCaseCard(item) {
  const card = document.createElement("div");
  card.className = "card";

  const img = document.createElement("img");
  img.className = "card-avatar";
  img.src = chooseImageSrcHome(item.image_url);
  img.onerror = () => {
    img.src = getFallbackImageHome();
  };
  img.alt = item.name || "حالة";

  const title = document.createElement("h3");
  title.textContent = item.name || "حالة";

  const needP = document.createElement("p");
  needP.textContent =
    "تحتاج إلى " + (item.required_amount || 0) + " جنيه";

  const remainP = document.createElement("p");
  remainP.className = "remaining";
  remainP.textContent =
    "متبقي " + (item.remaining_amount || 0) + " جنيه";

  const btn = document.createElement("button");
  btn.className = "details-btn";
  btn.textContent = "تفاصيل";
  btn.onclick = function () {
    window.location.href =
      "تفاصيل الحاله.html?id=" + encodeURIComponent(item.id);
  };

  card.appendChild(img);
  card.appendChild(title);
  card.appendChild(needP);
  card.appendChild(remainP);
  card.appendChild(btn);

  return card;
}

async function loadRecentCasesHome() {
  const section = document.getElementById("recentCasesSection");
  if (!section) return;

  if (!sb) { displayFallbackHome(section); return; }

  // جيب الحالات المقبولة فقط، غير المكتملة، مرتبة بالأحدث
  const { data, error } = await sb
    .from("cases")
    .select("*")
    .eq("status", "مقبول")
    .or("remaining_amount.is.null,remaining_amount.gt.0")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error || !data || data.length === 0) {
    displayFallbackHome(section);
    return;
  }

  section.innerHTML = "";
  data.forEach(item => section.appendChild(createHomeCaseCard(item)));
}

function displayFallbackHome(section) {
  const fallbackData = [
    {
      id: 1,
      name: "إطعام عائله",
      required_amount: 10000,
      remaining_amount: 5000,
      image_url: "../صور المشروع/تبرع.jpg",
    },
    {
      id: 2,
      name: "إعمار منزل",
      required_amount: 30000,
      remaining_amount: 10000,
      image_url: "../صور المشروع/تبرع.jpg",
    },
    {
      id: 3,
      name: "ريم",
      required_amount: 20000,
      remaining_amount: 7500,
      image_url: "../صور المشروع/تبرع.jpg",
    },
  ];
  section.innerHTML = "";
  fallbackData.forEach((item) => {
    section.appendChild(createHomeCaseCard(item));
  });
}

window.addEventListener("load", () => {
  checkUserAndImage();
  checkUser();
  loadRecentCasesHome();

  // تحديث تلقائي لما تتغير أي حالة (اكتمال أو رفض)
  if (sb) {
    sb.channel('home_cases')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cases' }, () => {
        loadRecentCasesHome();
      })
      .subscribe();
  }
});
