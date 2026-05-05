// ===== Notification Badge — التحديث اللحظي لعدد الإشعارات غير المقروءة =====
(async function initNotificationBadge() {
    try {
        if (typeof createSupabaseClient !== 'function') return;
        const sb = createSupabaseClient();
        if (!sb) return;

        let userId = null;

        async function updateBadge() {
            try {
                if (!userId) {
                    const { data: { user } } = await sb.auth.getUser();
                    if (!user) return;
                    const { data: publicUser } = await sb.from('users').select('id').eq('email', user.email).maybeSingle();
                    userId = publicUser?.id || user.id;
                }

                const { count, error } = await sb
                    .from('notifications')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .eq('is_read', false);

                if (error) return;

                const notifLinks = document.querySelectorAll('a[href*="الاشعارات"]');
                notifLinks.forEach(link => {
                    let badge = link.querySelector('.notif-badge');

                    if (count > 0) {
                        if (!badge) {
                            link.style.position = 'relative';
                            badge = document.createElement('span');
                            badge.className = 'notif-badge';
                            badge.style.cssText = `
                                background: #e53935;
                                color: #fff;
                                font-size: 10px;
                                font-weight: 700;
                                min-width: 18px;
                                height: 18px;
                                border-radius: 9px;
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                padding: 0 4px;
                                line-height: 1;
                                position: absolute;
                                top: -5px;
                                right: -5px;
                                flex-shrink: 0;
                                pointer-events: none;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                            `;
                            link.appendChild(badge);
                        }
                        badge.textContent = count > 99 ? '99+' : count;
                    } else if (badge) {
                        badge.remove();
                    }
                });
            } catch (err) {
                console.warn('Error updating notification badge:', err);
            }
        }

        // التحديث الأول
        await updateBadge();

        // الاستماع اللحظي للتغييرات في جدول الإشعارات
        sb.channel('notif-badge-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications'
            }, () => updateBadge())
            .subscribe();

    } catch (_) { }
})();
