// ===== Notification Badge — يظهر عدد الإشعارات غير المقروءة على أيقونة الإشعارات =====
(async function () {
    try {
        if (typeof createSupabaseClient !== 'function') return;
        const sb = createSupabaseClient();
        if (!sb) return;

        const { count, error } = await sb
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('is_read', false);

        if (error || !count || count === 0) return;

        const notifLinks = document.querySelectorAll('a[href*="الاشعارات"]');
        notifLinks.forEach(link => {
            if (link.querySelector('.notif-badge')) return;

            // نضمن إن الـ link يستوعب الـ badge بدون overflow
            link.style.display = 'flex';
            link.style.alignItems = 'center';
            link.style.overflow = 'hidden';

            const badge = document.createElement('span');
            badge.className = 'notif-badge';
            badge.textContent = count > 99 ? '99+' : count;
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
                margin-right: auto;
                margin-left: 6px;
                flex-shrink: 0;
                pointer-events: none;
            `;
            link.appendChild(badge);
        });

    } catch (_) {}
})();
