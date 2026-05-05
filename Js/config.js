// ملف التكوينات المشترك لجميع الصفحات
const SUPABASE_URL = "https://rkxyymhrpcexpwvdwwkw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreHl5bWhycGNleHB3dmR3d2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjM2NjgsImV4cCI6MjA4MDUzOTY2OH0.f5YNpBEZl4K7FroQ2C3mHOdgte6FPj3MATvllxG2QM4";

// Singleton — instance واحد بس في الصفحة كلها
let _supabaseInstance = null;

function createSupabaseClient() {
    if (typeof supabase === 'undefined') {
        console.error('مكتبة Supabase غير محملة');
        return null;
    }
    if (!_supabaseInstance) {
        _supabaseInstance = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _supabaseInstance;
}

// ===== التحقق الموحد إذا كان المستخدم أدمن =====
async function checkIfAdmin(user) {
    if (!user) return false;
    const ADMIN_EMAIL = 'ahussin9125@gmail.com';
    
    // 1. التحقق من الإيميل الأساسي
    if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;

    // 2. التحقق من الميتا داتا (Supabase Auth)
    const meta = user.user_metadata || {};
    if (meta.is_admin === true || meta.role === 'admin' || meta.role === 'مسؤول') return true;

    // 3. التحقق من قاعدة البيانات (public.users)
    try {
        const sb = createSupabaseClient();
        if (sb) {
            const { data: userData } = await sb
                .from('users')
                .select('user_type, name')
                .eq('email', user.email)
                .maybeSingle();
            
            if (userData) {
                const type = (userData.user_type || '').toLowerCase();
                const name = (userData.name || '').toLowerCase();
                if (type === 'admin' || type === 'مسؤول' || type === 'المالك' || type === 'owner') return true;
                if (name.includes('admin') || name.includes('المالك')) return true;
            }
        }
    } catch(e) { console.warn('checkIfAdmin DB error:', e.message); }

    return false;
}

// ===== إرسال إشعار لكل الأدمن =====
async function notifyAllAdmins(title, message, type = 'user', attachmentUrl = null) {
    try {
        const sb = createSupabaseClient();
        if (!sb) return;

        // نجلب كل المستخدمين اللي نوعهم أدمن بمختلف المسميات الممكنة
        const { data: admins, error: fetchErr } = await sb
            .from('users')
            .select('id')
            .or('user_type.eq.admin,user_type.eq.مسؤول,user_type.eq.مشرف,user_type.eq.Admin');

        if (fetchErr) {
            console.error('Error fetching admins for notification:', fetchErr.message);
            return;
        }

        if (!admins || admins.length === 0) {
            console.warn('No admins found to notify. Make sure user_type is set to "admin" or "مسؤول" in users table.');
            return;
        }

        const notifications = admins.map(a => ({
            title,
            message,
            type,
            is_read: false,
            user_id: a.id,
            attachment_url: attachmentUrl,
            created_at: new Date().toISOString()
        }));

        const { error: insertErr } = await sb.from('notifications').insert(notifications);
        
        if (insertErr) {
            console.error('Error inserting admin notifications:', insertErr.message);
        } else {
            console.log(`Notifications sent to ${admins.length} admins.`);
        }
    } catch(e) { 
        console.warn('notifyAllAdmins exception:', e.message); 
    }
}
