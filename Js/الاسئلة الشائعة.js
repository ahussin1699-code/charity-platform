const sb = createSupabaseClient();
const ADMIN_EMAIL = "ahussin9125@gmail.com";

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

const menuBtnQ = document.getElementById("menuBtn");
const mainNavQ = document.querySelector("nav.main-nav");
if (menuBtnQ && mainNavQ) {
  menuBtnQ.addEventListener("click", () => {
    mainNavQ.classList.toggle("active");
  });
}

async function checkUserAndImage() {
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  const user = data && data.user;
  if (!user) return;

  const { data: userData } = await sb
    .from("users")
    .select("profile_image")
    .eq("email", user.email)
    .maybeSingle();

  const profileImgSrc =
    userData?.profile_image ||
    localStorage.getItem(`profileImage_${user.id}`);
  if (profileImgSrc) {
    const navProfileImg = document.getElementById("navProfileImg");
    if (navProfileImg) navProfileImg.src = profileImgSrc;
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

  const addCaseLink = document.getElementById("addCaseLink");
  if (addCaseLink) {
    addCaseLink.style.display =
      isAdmin || isBeneficiary ? "flex" : "none";
  }
}

window.addEventListener("load", () => {
  checkUserAndImage();
});
