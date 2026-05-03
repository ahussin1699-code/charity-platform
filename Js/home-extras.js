// ===== home-extras.js =====
(async function() {
  const sb = createSupabaseClient();

  // ---- عداد متحرك ----
  function animateCounter(el, target, suffix='') {
    let start = 0;
    const duration = 1800;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { start = target; clearInterval(timer); }
      el.textContent = start.toLocaleString('ar-EG') + suffix;
    }, 16);
  }

  // ---- تحميل الإحصائيات ----
  async function loadStats() {
    if (!sb) return;

    // عدد المتبرعين
    const { count: donors } = await sb.from('users')
      .select('*', { count: 'exact', head: true })
      .eq('user_type', 'متبرع');

    // إجمالي التبرعات
    const { data: donations } = await sb.from('donations').select('amount');
    const totalAmount = (donations || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

    // الحالات المكتملة
    const { count: completed } = await sb.from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('remaining_amount', 0);

    // الحالات النشطة
    const { count: active } = await sb.from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'مقبول')
      .gt('remaining_amount', 0);

    // إجمالي المطلوب
    const { data: allCases } = await sb.from('cases').select('required_amount,remaining_amount');
    const totalRequired  = (allCases||[]).reduce((s,c)=>s+(parseFloat(c.required_amount)||0),0);
    const totalRemaining = (allCases||[]).reduce((s,c)=>s+(parseFloat(c.remaining_amount)||0),0);
    const totalCollected = Math.max(0, totalRequired - totalRemaining);
    const pct = totalRequired > 0 ? Math.min(100, Math.round((totalCollected/totalRequired)*100)) : 0;

    // تشغيل العدادات
    animateCounter(document.getElementById('statDonors'),    donors    || 0);
    animateCounter(document.getElementById('statAmount'),    Math.round(totalAmount) || Math.round(totalCollected));
    animateCounter(document.getElementById('statCompleted'), completed || 0);
    animateCounter(document.getElementById('statActive'),    active    || 0);

    // شريط التقدم
    setTimeout(() => {
      const fill = document.getElementById('overallFill');
      const lbl  = document.getElementById('progressPctLabel');
      if (fill) fill.style.width = pct + '%';
      if (lbl)  lbl.textContent  = pct + '%';
    }, 200);
  }

  // ---- الحالات المكتملة ----
  async function loadCompletedCases() {
    const grid = document.getElementById('completedCasesGrid');
    if (!grid || !sb) return;

    const { data } = await sb.from('cases')
      .select('id,name,type,image_url,required_amount')
      .eq('remaining_amount', 0)
      .eq('status', 'مقبول')
      .order('created_at', { ascending: false })
      .limit(3);

    if (!data || data.length === 0) {
      grid.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px;grid-column:1/-1;">لا توجد حالات مكتملة بعد</div>';
      return;
    }

    grid.innerHTML = data.map(c => `
      <div class="completed-card">
        <img src="${c.image_url || '../صور المشروع/تبرع.jpg'}" alt="${c.name}" onerror="this.src='../صور المشروع/تبرع.jpg'">
        <div class="completed-info">
          <span class="completed-badge"><i class="fa-solid fa-circle-check"></i> مكتملة</span>
          <h4>${c.name || 'حالة'}</h4>
          <p>${c.type || 'إنسانية'} — تم جمع ${(c.required_amount||0).toLocaleString('ar-EG')} جنيه</p>
        </div>
      </div>`).join('');
  }

  // ---- بانر الحالات العاجلة ----
  async function loadUrgentBanner() {
    if (!sb) return;
    const { data } = await sb.from('cases')
      .select('id,name,remaining_amount,required_amount')
      .eq('status', 'مقبول')
      .gt('remaining_amount', 0)
      .order('remaining_amount', { ascending: true })
      .limit(1);

    if (!data || data.length === 0) return;
    const c = data[0];
    const pct = c.required_amount > 0
      ? Math.round(((c.required_amount - c.remaining_amount) / c.required_amount) * 100)
      : 0;

    const banner = document.getElementById('urgentBanner');
    const text   = document.getElementById('urgentText');
    const link   = document.getElementById('urgentLink');
    if (banner && text && link) {
      text.textContent = `⚡ حالة "${c.name}" تحتاج ${c.remaining_amount.toLocaleString('ar-EG')} جنيه فقط لاكتمالها (${pct}% تم جمعه)`;
      link.href = `تفاصيل الحاله.html?id=${c.id}`;
      banner.style.display = 'flex';
    }
  }

  // ---- Intersection Observer للعداد ----
  const statsSection = document.querySelector('.stats-section');
  if (statsSection) {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { loadStats(); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(statsSection);
  }

  loadCompletedCases();
  loadUrgentBanner();

  // ---- تقييمات المتبرعين من قاعدة البيانات ----
  async function loadTestimonials() {
    const grid = document.getElementById('testimonialsGrid');
    if (!grid || !sb) return;

    const { data } = await sb.from('reviews')
      .select('name, rating, comment')
      .order('created_at', { ascending: false })
      .limit(3);

    if (!data || data.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:20px;">لا توجد تقييمات بعد</div>';
      return;
    }

    grid.innerHTML = data.map(r => `
      <div class="testimonial-card">
        <div class="testimonial-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
        <p>"${r.comment}"</p>
        <div class="testimonial-author"><i class="fa-solid fa-user-circle"></i> ${r.name || 'متبرع مجهول'}</div>
      </div>`).join('');
  }

  loadTestimonials();
})();
