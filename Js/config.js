// ملف التكوينات المشترك لجميع الصفحات
const SUPABASE_URL = "https://rkxyymhrpcexpwvdwwkw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJreHl5bWhycGNleHB3dmR3d2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NjM2NjgsImV4cCI6MjA4MDUzOTY2OH0.f5YNpBEZl4K7FroQ2C3mHOdgte6FPj3MATvllxG2QM4";

// دالة لإنشاء اتصال Supabase
function createSupabaseClient() {
    if (typeof supabase === 'undefined') {
        console.error('مكتبة Supabase غير محملة');
        return null;
    }
    return supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
