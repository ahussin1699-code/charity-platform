// ===== Sidebar Badges — التحديث اللحظي للعلامات في القائمة الجانبية =====
(async function initSidebarBadges() {
  if (typeof createSupabaseClient === 'undefined') return;
  const sb = createSupabaseClient();
  if (!sb) return;

  let userId = null;

  async function updateAllBadges() {
    try {
      if (!userId) {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        const { data: pUser } = await sb.from('users').select('id').eq('email', user.email).maybeSingle();
        userId = pUser?.id || user.id;
      }

      const [casesRes, donationsRes, notifsRes] = await Promise.all([
        sb.from('cases').select('*', { count: 'exact', head: true })
          .or('status.eq.قيد المراجعة,status.eq.مرفوض من الطبيب,status.eq.موافق عليها من الطبيب'),
        sb.from('donations').select('*', { count: 'exact', head: true })
          .eq('status', 'قيد المراجعة'),
        sb.from('notifications').select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('user_id', userId),
      ]);

      const fmt = n => n > 99 ? '99+' : (n > 0 ? String(n) : '');
      const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = fmt(n); };

      set('badge-cases',     casesRes.count     || 0);
      set('badge-donations', donationsRes.count || 0);
      set('badge-notifs',    notifsRes.count    || 0);
    } catch (err) {
      console.warn('Error updating sidebar badges:', err);
    }
  }

  // التحديث الأول عند التحميل
  await updateAllBadges();

  // إعداد الاستماع اللحظي (Real-time)
  const channel = sb.channel('sidebar-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, () => updateAllBadges())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => updateAllBadges())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => updateAllBadges())
    .subscribe();

})();
