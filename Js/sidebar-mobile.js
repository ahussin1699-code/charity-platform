// ===== Sidebar Mobile Handler =====
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        const sidebar  = document.getElementById('sidebar');
        const toggle   = document.getElementById('menuToggle');
        if (!sidebar || !toggle) return;

        // أضف زر إغلاق داخل الـ sidebar header لو مش موجود
        const header = sidebar.querySelector('.sidebar-header');
        if (header && !sidebar.querySelector('.sidebar-close-btn')) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'sidebar-close-btn';
            closeBtn.setAttribute('aria-label', 'إغلاق القائمة');
            closeBtn.innerHTML = '<i class="fas fa-xmark"></i>';
            header.appendChild(closeBtn);
            closeBtn.addEventListener('click', closeSidebar);
        }

        // overlay
        let overlay = document.getElementById('sidebarSharedOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sidebarSharedOverlay';
            overlay.style.cssText = `
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.5);
                z-index: 1050;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', closeSidebar);
        }

        function openSidebar() {
            sidebar.classList.add('active');
            overlay.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }

        function closeSidebar() {
            sidebar.classList.remove('active');
            overlay.style.display = 'none';
            document.body.style.overflow = '';
        }

        toggle.addEventListener('click', function () {
            sidebar.classList.contains('active') ? closeSidebar() : openSidebar();
        });

        // إغلاق عند الضغط على أي link
        sidebar.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', function () {
                if (window.innerWidth <= 992) closeSidebar();
            });
        });
    });
})();
