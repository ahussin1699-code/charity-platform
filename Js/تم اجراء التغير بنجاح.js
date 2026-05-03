function createConfetti() {
    const colors = ['#215732', '#2e7d32', '#4caf50', '#81c784', '#a5d6a7'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        const color = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.backgroundColor = color;
        
        const size = Math.random() * 10 + 5;
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        
        const left = Math.random() * 100;
        confetti.style.left = `${left}%`;
        
        const delay = Math.random() * 2;
        confetti.style.animationDelay = `${delay}s`;
        
        const duration = Math.random() * 2 + 2;
        confetti.style.animationDuration = `${duration}s`;
        
        document.body.appendChild(confetti);
        
        setTimeout(() => {
            confetti.remove();
        }, (duration + delay) * 1000);
    }
}

let countdown = 3;
const countdownElement = document.getElementById('countdown-number');
const countdownInterval = setInterval(() => {
    countdown--;
    if (countdownElement) countdownElement.textContent = countdown;
    
    if (countdown <= 0) {
        clearInterval(countdownInterval);
        redirectToLogin();
    }
}, 1000);

function redirectToLogin() {
    window.location.href = "تسجيل الدخول .html";
}

function goBack() {
    history.back();
}

function goHome() {
    window.location.href = "تسجيل الدخول .html";
}

window.onload = function() {
    createConfetti();
};
