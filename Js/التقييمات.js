const sb = createSupabaseClient();
let page = 0;
const PAGE_SIZE = 9;
let allLoaded = false;

function starsHtml(n) {
  return '★'.repeat(n) + '☆'.repeat(5-n);
}

async function loadSummary() {
  if (!sb) return;
  const { data } = await sb.from('reviews').select('rating');
  if (!data || data.length === 0) return;

  const total = data.length;
  const avg   = (data.reduce((s,r)=>s+r.rating,0)/total).toFixed(1);
  const counts = {1:0,2:0,3:0,4:0,5:0};
  data.forEach(r => counts[r.rating]++);

  const avgRatingEl = document.getElementById('avgRating');
  const avgStarsEl = document.getElementById('avgStars');
  const totalReviewsEl = document.getElementById('totalReviews');

  if (avgRatingEl) avgRatingEl.textContent = avg;
  if (avgStarsEl) avgStarsEl.textContent = starsHtml(Math.round(avg));
  if (totalReviewsEl) totalReviewsEl.textContent = total + ' تقييم';

  [1,2,3,4,5].forEach(n => {
    const pct = total > 0 ? Math.round((counts[n]/total)*100) : 0;
    const barEl = document.getElementById('bar'+n);
    const cntEl = document.getElementById('cnt'+n);
    if (barEl) barEl.style.width = pct+'%';
    if (cntEl) cntEl.textContent = counts[n];
  });
}

async function loadReviews(reset=false) {
  if (!sb) return;
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;
  
  if (reset) { page = 0; allLoaded = false; grid.innerHTML = ''; }

  const from = page * PAGE_SIZE;
  const { data, error } = await sb.from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error || !data) return;
  if (data.length < PAGE_SIZE) allLoaded = true;

  if (page === 0 && data.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#aaa;padding:20px;">لا توجد تقييمات بعد — كن أول من يقيّم!</div>';
    return;
  }

  data.forEach(r => {
    const date = new Date(r.created_at).toLocaleDateString('ar-EG');
    const card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML = `
      <div class="stars">${starsHtml(r.rating)}</div>
      <div class="text">"${r.comment || ''}"</div>
      <div class="author"><i class="fa-solid fa-user-circle"></i> ${r.name || 'متبرع مجهول'}</div>
      <div class="date">${date}</div>`;
    grid.appendChild(card);
  });

  page++;
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) loadMoreBtn.style.display = allLoaded ? 'none' : 'block';
}

function loadMore() { loadReviews(); }

async function submitReview() {
  const rating = document.querySelector('input[name="rating"]:checked')?.value;
  const name   = document.getElementById('reviewName').value.trim();
  const comment= document.getElementById('reviewText').value.trim();
  const msg    = document.getElementById('formMsg');
  const btn    = document.getElementById('submitReview');

  if (!rating) { if(msg){ msg.textContent = '⚠ اختر عدد النجوم أولاً'; msg.className='form-msg err'; } return; }
  if (!comment){ if(msg){ msg.textContent = '⚠ اكتب تعليقاً قصيراً'; msg.className='form-msg err'; } return; }

  if(btn){ btn.disabled = true; btn.textContent = 'جاري الإرسال...'; }

  const { error } = await sb.from('reviews').insert([{
    rating: parseInt(rating),
    name: name || 'متبرع مجهول',
    comment,
    created_at: new Date().toISOString()
  }]);

  if (error) {
    if(msg){
      msg.textContent = '❌ حدث خطأ، حاول مرة أخرى';
      msg.className = 'form-msg err';
    }
  } else {
    if(msg){
      msg.textContent = '✅ شكراً! تم إضافة تقييمك';
      msg.className = 'form-msg ok';
    }
    const nameInput = document.getElementById('reviewName');
    const textInput = document.getElementById('reviewText');
    const checkedStar = document.querySelector('input[name="rating"]:checked');
    
    if(nameInput) nameInput.value = '';
    if(textInput) textInput.value = '';
    if(checkedStar) checkedStar.checked = false;
    
    loadSummary();
    loadReviews(true);
  }
  if(btn){ btn.disabled = false; btn.textContent = 'إرسال التقييم'; }
}

window.addEventListener('load', () => { loadSummary(); loadReviews(true); });
