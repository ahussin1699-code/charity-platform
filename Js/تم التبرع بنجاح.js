document.addEventListener('DOMContentLoaded', () => {
    let s = 5;
    const el = document.getElementById('sec');
    const t = setInterval(() => {
        s--;
        if (el) el.textContent = s;
        if (s <= 0) {
            clearInterval(t);
            window.location.href = 'الصفحه الرئسيه.html';
        }
    }, 1000);
});
