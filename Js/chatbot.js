// ===== Smart Chatbot Widget - Powered by Gemini AI =====
(function () {

    const STORAGE_KEY = "cb_history";

    // ---- ردود محلية بدون AI ----
    const LOCAL_REPLIES = [
        { pattern: /كيف.*(تبرع|اتبرع)/,        reply: "للتبرع:\n1️⃣ تصفح الحالات\n2️⃣ اختر الحالة\n3️⃣ اضغط \"تبرع الآن\"\n4️⃣ أدخل المبلغ وبيانات الدفع\n5️⃣ تأكيد التبرع ✅" },
        { pattern: /طرق.*(دفع|الدفع)/,          reply: "نقبل الدفع عبر:\n💳 Visa\n💳 Mastercard\n📱 المحافظ الإلكترونية" },
        { pattern: /آمن|موثوق|ضمان/,            reply: "نعم ✅ جميع الحالات يتم التحقق منها يدوياً قبل النشر، وبياناتك محمية بالكامل." },
        { pattern: /حد.*(أدنى|ادنى)|أقل مبلغ/, reply: "لا يوجد حد أدنى للتبرع، أي مبلغ مهما كان صغيراً له أثر كبير 💚" },
        { pattern: /تواصل|اتصال|بريد|هاتف/,    reply: "يمكنك التواصل معنا:\n📧 ahussin9125@gmail.com\n📞 01020152710" },
        { pattern: /من نحن|عن المنصة|هدف/,      reply: "منصة تبرعات خيرية تربط المتبرعين بالحالات الإنسانية المحتاجة، ونسعى لتوصيل كل تبرع لمستحقيه بشفافية تامة 💚" },
        { pattern: /كلمة.*(مرور|سر)|باسورد/,    reply: "يمكنك إعادة تعيين كلمة المرور من صفحة \"نسيت كلمة المرور\" في صفحة تسجيل الدخول." },
        { pattern: /تسجيل.*(دخول|حساب)|حساب/,  reply: "يمكنك إنشاء حساب جديد أو تسجيل الدخول من الصفحة الرئيسية 👆" },
        { pattern: /شكر|شكراً|ممتاز|رائع/,      reply: "العفو! 😊 يسعدنا خدمتك دائماً." },
        { pattern: /مرحب|أهلاً|هلا|السلام/,     reply: "أهلاً وسهلاً! 👋 كيف يمكنني مساعدتك اليوم؟" },
    ];

    function localReply(text) {
        for (const r of LOCAL_REPLIES) {
            if (r.pattern.test(text)) return r.reply;
        }
        return null;
    }

    // ---- Gemini AI ----
    const GEMINI_API_KEY = "AIzaSyBzxi3YtxBd9gxEIYQvHjXIAKJu-iU5w44";
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    // ---- حالة المستخدم ----
    let currentUser = null;

    async function checkUser() {
        try {
            if (typeof createSupabaseClient === "function") {
                const sb = createSupabaseClient();
                if (sb) {
                    const { data } = await sb.auth.getUser();
                    currentUser = data?.user || null;
                }
            }
        } catch (_) { currentUser = null; }
    }

    // ---- روابط الصفحات ----
    const PAGES = {
        cases:         "عرض الحالات.html",
        login:         "تسجيل الدخول .html",
        register:      "تسجيل حساب جديد.html",
        contact:       "اتصال بنا.html",
        about:         "من نحن.html",
        profile:       "الصفحه الشخصية.html",
        home:          "الصفحه الرئسيه.html",
        faq:           "الاسئلة الشائعة.html",
        forgotPass:    "نسيت كلمة المرور.html",
        changePass:    "تحديث كلمة المرور.html",
        notifications: "الاشعارات.html",
    };

    function getPath(page) {
        const inHtml = /[/\\]html[/\\]/i.test(window.location.pathname);
        return inHtml ? page : "html/" + page;
    }

    function navigate(page) { window.location.href = getPath(page); }
    function actionBtn(label, icon, page) { return { label, icon, page }; }

    function defaultActions() {
        if (currentUser) {
            return [
                actionBtn("ملفي الشخصي", "fa-user", PAGES.profile),
                actionBtn("تصفح الحالات", "fa-heart", PAGES.cases),
            ];
        }
        return [
            actionBtn("تسجيل الدخول", "fa-right-to-bracket", PAGES.login),
            actionBtn("تصفح الحالات", "fa-heart", PAGES.cases),
        ];
    }

    function welcomeMsg() {
        if (currentUser) {
            const name = (currentUser.email || "").split("@")[0];
            return `أهلاً ${name}! 👋 أنا مساعدك الذكي، كيف يمكنني مساعدتك اليوم؟`;
        }
        return "أهلاً وسهلاً! 👋 أنا مساعدك الذكي لمنصة التبرعات الخيرية.\nاكتب سؤالك وسأجيبك فوراً.";
    }

    // ---- Gemini: إرسال الرسالة مع سياق المحادثة ----
    async function askGemini(userText, chatHistory) {
        // جرب الرد المحلي أولاً
        const local = localReply(userText);
        if (local) return local;

        try {
            const userName = currentUser ? (currentUser.email || "").split("@")[0] : "زائر";
            const userStatus = currentUser ? `المستخدم مسجل دخوله باسم: ${userName}` : "المستخدم غير مسجل دخوله";

            const systemContext = `أنت مساعد ذكي لمنصة تبرعات خيرية باللغة العربية.
معلومات المنصة:
- منصة تبرعات خيرية تربط المتبرعين بالحالات الإنسانية
- نقبل الدفع عبر Visa / Mastercard
- البريد الإلكتروني: ahussin9125@gmail.com | الهاتف: 01020152710
- جميع الحالات يتم التحقق منها يدوياً قبل النشر
- لا يوجد حد أدنى للتبرع
- ${userStatus}

تعليمات:
- أجب دائماً باللغة العربية بشكل مختصر وودود
- لا تذكر أنك Gemini أو Google
- قدّم نفسك كمساعد المنصة فقط
- إذا سأل عن التبرع، اشرح الخطوات بإيجاز
- إذا سأل عن مشكلة تقنية، وجّهه للتواصل مع الدعم`;

            const contents = [
                {
                    role: "user",
                    parts: [{ text: systemContext + "\n\nرسالة المستخدم: " + userText }]
                }
            ];

            const res = await fetch(GEMINI_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents })
            });

            const data = await res.json();

            if (!res.ok) {
                const errMsg = data?.error?.message || "";
                // quota error — رد محترم بدون تفاصيل تقنية
                if (res.status === 429 || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
                    return "عذراً، المساعد الذكي مشغول حالياً 😔\nيمكنك التواصل معنا مباشرة:\n📧 ahussin9125@gmail.com\n📞 01020152710";
                }
                console.error("Gemini API error:", res.status, errMsg);
                return "عذراً، حدث خطأ مؤقت. يرجى المحاولة لاحقاً أو التواصل معنا مباشرة. 😔";
            }

            return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (e) {
            console.error("Gemini fetch error:", e.message);
            return "عذراً، تعذّر الاتصال بالمساعد الذكي. يرجى التحقق من اتصالك بالإنترنت. 😔";
        }
    }

    // ---- sessionStorage ----
    function saveHistory(history) {
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (_) {}
    }
    function loadHistory() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (_) { return []; }
    }
    function clearHistory() { sessionStorage.removeItem(STORAGE_KEY); }

    // ---- بناء الـ HTML ----
    function buildWidget() {
        const t = document.createElement("button");
        t.id = "chatbot-toggle";
        t.setAttribute("aria-label", "فتح المحادثة");
        t.innerHTML = `<i class="fa-solid fa-comments"></i><span class="badge" id="cb-badge">1</span>`;

        const w = document.createElement("div");
        w.id = "chatbot-window";
        w.setAttribute("role", "dialog");
        w.setAttribute("aria-label", "نافذة المحادثة");
        w.innerHTML = `
            <div class="cb-header">
                <div class="cb-avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="cb-header-info">
                    <h4>مساعد تبرعات خيرية</h4>
                    <span id="cb-status">🟢 متاح الآن</span>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <button class="cb-close" id="cb-clear-btn" title="مسح المحادثة" aria-label="مسح المحادثة" style="font-size:0.85rem;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <button class="cb-close" id="cb-close-btn" aria-label="إغلاق">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="cb-messages" id="cb-messages"></div>
            <div class="cb-quick-replies" id="cb-quick-replies"></div>
            <div class="cb-input-area">
                <button class="cb-send" id="cb-send-btn" aria-label="إرسال"><i class="fa-solid fa-paper-plane"></i></button>
                <input type="text" id="cb-input" placeholder="اكتب رسالتك..." autocomplete="off" />
            </div>`;

        document.body.appendChild(t);
        document.body.appendChild(w);
    }

    function init() {
        buildWidget();

        const toggle    = document.getElementById("chatbot-toggle");
        const win       = document.getElementById("chatbot-window");
        const closeBtn  = document.getElementById("cb-close-btn");
        const clearBtn  = document.getElementById("cb-clear-btn");
        const messages  = document.getElementById("cb-messages");
        const input     = document.getElementById("cb-input");
        const sendBtn   = document.getElementById("cb-send-btn");
        const badge     = document.getElementById("cb-badge");
        const quickArea = document.getElementById("cb-quick-replies");
        const statusEl  = document.getElementById("cb-status");

        let opened  = false;
        let history = loadHistory();

        if (history.length === 0) {
            setTimeout(() => { badge.style.display = "flex"; }, 2000);
        }

        function updateStatus() {
            if (currentUser && statusEl) {
                const name = (currentUser.email || "").split("@")[0];
                statusEl.textContent = `🟢 مرحباً ${name}`;
            }
        }

        function renderMsg(entry, animate) {
            if (entry.role === "user") {
                const msg = document.createElement("div");
                msg.className = "cb-msg user";
                msg.textContent = entry.text;
                messages.appendChild(msg);
            } else {
                const msg = document.createElement("div");
                msg.className = "cb-msg bot";
                msg.style.whiteSpace = "pre-line";
                if (animate) msg.style.animation = "msgIn 0.25s ease";
                msg.textContent = entry.text;
                messages.appendChild(msg);

                if (entry.actions && entry.actions.length) {
                    const actEl = document.createElement("div");
                    actEl.className = "cb-actions";
                    entry.actions.forEach(a => {
                        const btn = document.createElement("button");
                        btn.className = "cb-action-btn";
                        btn.innerHTML = `<i class="fa-solid ${a.icon}"></i> ${a.label}`;
                        btn.addEventListener("click", () => navigate(a.page));
                        actEl.appendChild(btn);
                    });
                    messages.appendChild(actEl);
                }

                if (entry.quick && entry.quick.length) renderQuick(entry.quick);
            }
        }

        function restoreHistory() {
            messages.innerHTML = "";
            quickArea.innerHTML = "";
            history.forEach(entry => renderMsg(entry, false));
            scrollBottom();
        }

        function renderQuick(items) {
            quickArea.innerHTML = "";
            items.forEach(label => {
                const btn = document.createElement("button");
                btn.className = "cb-quick-btn";
                btn.textContent = label;
                btn.addEventListener("click", () => handleSend(label));
                quickArea.appendChild(btn);
            });
        }

        function scrollBottom() { messages.scrollTop = messages.scrollHeight; }

        function addUserMsg(text) {
            quickArea.innerHTML = "";
            const entry = { role: "user", text };
            history.push(entry);
            saveHistory(history);
            renderMsg(entry, false);
            scrollBottom();
        }

        async function handleSend(text) {
            text = text.trim();
            if (!text) return;

            addUserMsg(text);
            input.value = "";
            input.disabled = true;
            sendBtn.disabled = true;

            // typing indicator
            const typing = document.createElement("div");
            typing.className = "cb-typing";
            typing.innerHTML = "<span></span><span></span><span></span>";
            messages.appendChild(typing);
            scrollBottom();

            const aiReply = await askGemini(text, history.slice(0, -1));
            typing.remove();

            const replyText = aiReply || "عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى أو التواصل معنا مباشرة. 😔";
            const actions = detectActions(text, replyText);
            const quick = detectQuick(text);

            const entry = { role: "bot", text: replyText, actions, quick };
            history.push(entry);
            saveHistory(history);
            renderMsg(entry, true);
            scrollBottom();

            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }

        // اكتشاف الأزرار المناسبة بناءً على موضوع الرسالة
        function detectActions(userText, botReply) {
            const t = userText + " " + botReply;
            if (/تبرع|حالة|حالات|دفع/.test(t)) return [actionBtn("تصفح الحالات", "fa-heart", PAGES.cases)];
            if (/تسجيل|دخول|حساب/.test(t) && !currentUser) return [
                actionBtn("تسجيل الدخول", "fa-right-to-bracket", PAGES.login),
                actionBtn("إنشاء حساب", "fa-user-plus", PAGES.register),
            ];
            if (/تواصل|اتصال|مشكلة|شكوى/.test(t)) return [actionBtn("تواصل معنا", "fa-envelope", PAGES.contact)];
            if (/من نحن|عن المنصة/.test(t)) return [actionBtn("من نحن", "fa-circle-info", PAGES.about)];
            if (/كلمة المرور|باسورد/.test(t)) return [actionBtn("نسيت كلمة المرور", "fa-key", PAGES.forgotPass)];
            return defaultActions();
        }

        function detectQuick(userText) {
            if (/تبرع/.test(userText)) return ["طرق الدفع", "هل التبرع آمن؟", "تصفح الحالات"];
            if (/حساب|تسجيل/.test(userText)) return ["كيف اتبرع", "تصفح الحالات"];
            return ["كيف اتبرع", "تصفح الحالات", "تواصل معنا"];
        }

        async function openChat() {
            opened = true;
            win.classList.add("open");
            badge.style.display = "none";

            await checkUser();
            updateStatus();

            if (history.length === 0) {
                const entry = {
                    role: "bot",
                    text: welcomeMsg(),
                    actions: defaultActions(),
                    quick: currentUser
                        ? ["كيف اتبرع", "تصفح الحالات", "ملفي الشخصي"]
                        : ["كيف اتبرع", "تصفح الحالات", "إنشاء حساب"]
                };
                history.push(entry);
                saveHistory(history);
                renderMsg(entry, true);
                scrollBottom();
            } else {
                restoreHistory();
            }
            setTimeout(() => input.focus(), 300);
        }

        function closeChat() {
            opened = false;
            win.classList.remove("open");
        }

        clearBtn.addEventListener("click", () => {
            clearHistory();
            history = [];
            messages.innerHTML = "";
            quickArea.innerHTML = "";
            const entry = {
                role: "bot",
                text: "تم مسح المحادثة 🗑️\nكيف يمكنني مساعدتك؟",
                actions: defaultActions(),
                quick: ["كيف اتبرع", "تصفح الحالات", "تواصل معنا"]
            };
            history.push(entry);
            saveHistory(history);
            renderMsg(entry, true);
            scrollBottom();
        });

        toggle.addEventListener("click", () => opened ? closeChat() : openChat());
        closeBtn.addEventListener("click", closeChat);
        sendBtn.addEventListener("click", () => handleSend(input.value));
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") handleSend(input.value);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
