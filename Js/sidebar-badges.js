// ===== Sidebar Badges — يُضاف في كل صفحات الأدمن =====
(async function loadSidebarBadges() {
  if (typeof createSupabaseClient === 'undefined') return;
  const sb = createSupabaseClient();
  if (!sb) return;

  try {
    const [casesRes, donationsRes, notifsRes] = await Promise.all([
      sb.from('cases').select('*', { count: 'exact', head: true })
        .or('status.eq.قيد المراجعة,status.eq.مرفوض من الطبيب,status.eq.موافق عليها من الطبيب'),
      sb.from('donations').select('*', { count: 'exact', head: true })
        .eq('status', 'قيد المراجعة'),
      sb.from('notifications').select('*', { count: 'exact', head: true })
        .eq('is_read', false),
    ]);

    const fmt = n => n > 99 ? '99+' : (n > 0 ? String(n) : '');
    const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = fmt(n); };

    set('badge-cases',     casesRes.count     || 0);
    set('badge-donations', donationsRes.count || 0);
    set('badge-notifs',    notifsRes.count    || 0);
  } catch (_) {}
})();
