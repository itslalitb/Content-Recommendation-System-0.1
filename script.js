/* ============================================================
   ContentHub — script.js
   YouTube Data API v3 Integration
   ============================================================ */

'use strict';

/* ================================================================
   STATE
================================================================ */
const ITEMS_PER_PAGE  = 6;
let   allVideos       = [];        // flat array of all fetched video objects
let   activeFilter    = 'all';
let   visibleCount    = ITEMS_PER_PAGE;
let   searchDebounce  = null;

/* ================================================================
   CAT COLOURS / GRADIENTS
================================================================ */
const CAT_COLORS = {
  technology: '#6366f1',
  science:    '#06b6d4',
  health:     '#10b981',
  business:   '#f59e0b',
  lifestyle:  '#ec4899',
  education:  '#8b5cf6'
};
const CAT_GRADIENTS = {
  technology: 'linear-gradient(135deg,#6366f1,#818cf8)',
  science:    'linear-gradient(135deg,#06b6d4,#38bdf8)',
  health:     'linear-gradient(135deg,#10b981,#34d399)',
  business:   'linear-gradient(135deg,#f59e0b,#fbbf24)',
  lifestyle:  'linear-gradient(135deg,#ec4899,#f472b6)',
  education:  'linear-gradient(135deg,#8b5cf6,#a78bfa)'
};

/* ================================================================
   DOM SHORTCUTS
================================================================ */
const $ = id => document.getElementById(id);

const navbar               = $('navbar');
const hamburger            = $('hamburger');
const navLinks             = $('navLinks');
const searchToggle         = $('searchToggle');
const searchBarWrap        = $('searchBarWrap');
const searchInput          = $('searchInput');
const searchClear          = $('searchClear');
const themeToggle          = $('themeToggle');
const iconSun              = themeToggle.querySelector('.icon-sun');
const iconMoon             = themeToggle.querySelector('.icon-moon');
const categoriesGrid       = $('categoriesGrid');
const featuredGrid         = $('featuredGrid');
const recommendedGrid      = $('recommendedGrid');
const filterChips          = $('filterChips');
const loadMoreBtn          = $('loadMoreBtn');
const searchResultsSection = $('searchResultsSection');
const searchResultsGrid    = $('searchResultsGrid');
const searchResultMeta     = $('searchResultMeta');
const noResults            = $('noResults');
const modalOverlay         = $('modalOverlay');
const modalClose           = $('modalClose');
const backToTop            = $('backToTop');
const newsletterForm       = $('newsletterForm');
const newsletterEmail      = $('newsletterEmail');
const newsletterMsg        = $('newsletterMsg');

/* ================================================================
   THEME
================================================================ */
function initTheme() {
  const saved       = localStorage.getItem('ch-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ch-theme', theme);
  if (theme === 'dark') {
    iconSun.style.display  = 'none';
    iconMoon.style.display = '';
    themeToggle.setAttribute('aria-label', 'Switch to light mode');
  } else {
    iconSun.style.display  = '';
    iconMoon.style.display = 'none';
    themeToggle.setAttribute('aria-label', 'Switch to dark mode');
  }
}

themeToggle.addEventListener('click', () => {
  applyTheme(
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  );
});

/* ================================================================
   NAVBAR — scroll / hamburger / active link
================================================================ */
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
  backToTop.classList.toggle('visible', window.scrollY > 400);
  highlightNavLink();
}, { passive: true });

hamburger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  hamburger.classList.toggle('open', open);
  hamburger.setAttribute('aria-expanded', open);
});

navLinks.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

function highlightNavLink() {
  const ids    = ['home', 'categories', 'featured', 'recommended'];
  const scrollY = window.scrollY + 100;
  let current  = 'home';
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.offsetTop <= scrollY) current = id;
  });
  document.querySelectorAll('.nav-link').forEach(l =>
    l.classList.toggle('active', l.dataset.section === current)
  );
}

backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ================================================================
   SEARCH — calls YouTube search API
================================================================ */
searchToggle.addEventListener('click', () => {
  const open = searchBarWrap.classList.toggle('open');
  searchToggle.setAttribute('aria-expanded', open);
  searchBarWrap.setAttribute('aria-hidden', !open);
  if (open) setTimeout(() => searchInput.focus(), 150);
  else       clearSearch();
});

searchInput.addEventListener('input', () => {
  const term = searchInput.value.trim();
  searchClear.style.display = term ? '' : 'none';
  clearTimeout(searchDebounce);
  if (term.length >= 3) {
    searchDebounce = setTimeout(() => performYouTubeSearch(term), 500);
  } else {
    hideSearchResults();
  }
});

searchClear.addEventListener('click', clearSearch);

function clearSearch() {
  searchInput.value         = '';
  searchClear.style.display = 'none';
  clearTimeout(searchDebounce);
  hideSearchResults();
}

async function performYouTubeSearch(term) {
  searchResultsSection.classList.remove('hidden');
  searchResultsGrid.innerHTML = buildSkeletons(3);
  noResults.classList.add('hidden');
  searchResultMeta.textContent = `Searching YouTube for "${term}"…`;

  try {
    const videos = await fetchVideos(term, null, 9);
    if (!videos.length) {
      searchResultsGrid.innerHTML = '';
      noResults.classList.remove('hidden');
      searchResultMeta.textContent = `No results for "${term}"`;
    } else {
      noResults.classList.add('hidden');
      searchResultMeta.textContent =
        `${videos.length} result${videos.length !== 1 ? 's' : ''} for "${term}"`;
      searchResultsGrid.innerHTML = videos.map(v => buildVideoCard(v)).join('');
      attachCardListeners(searchResultsGrid);
      observeFadeIns();
    }
  } catch (err) {
    searchResultsGrid.innerHTML = buildApiError(err.message);
    searchResultMeta.textContent = '';
  }
}

function hideSearchResults() {
  searchResultsSection.classList.add('hidden');
  searchResultsGrid.innerHTML = '';
  noResults.classList.add('hidden');
}

/* ================================================================
   YOUTUBE DATA API v3 — FETCH HELPERS
================================================================ */

/**
 * Search videos, then enrich with statistics + contentDetails in one batch.
 * @param {string} query
 * @param {string|null} category  — mapped to content category id
 * @param {number} maxResults
 * @returns {Promise<VideoObject[]>}
 */
async function fetchVideos(query, category, maxResults = VIDEOS_PER_CATEGORY) {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('no_key');
  }

  // Step 1: search
  const searchParams = new URLSearchParams({
    part:       'snippet',
    q:          query,
    type:       'video',
    maxResults: maxResults,
    order:      'relevance',
    safeSearch: 'moderate',
    key:        YOUTUBE_API_KEY
  });

  const searchRes = await fetch(`${YT_SEARCH_URL}?${searchParams}`);
  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${searchRes.status}`);
  }
  const searchData = await searchRes.json();
  const items      = searchData.items || [];
  if (!items.length) return [];

  // Step 2: batch enrich with statistics + contentDetails
  const videoIds = items.map(i => i.id.videoId).join(',');
  const videoParams = new URLSearchParams({
    part:  'statistics,contentDetails',
    id:    videoIds,
    key:   YOUTUBE_API_KEY
  });

  const videoRes  = await fetch(`${YT_VIDEOS_URL}?${videoParams}`);
  const videoData = videoRes.ok ? await videoRes.json() : { items: [] };

  // Build a lookup map id → stats/details
  const details = {};
  (videoData.items || []).forEach(v => { details[v.id] = v; });

  // Step 3: merge into unified VideoObject
  return items.map((item, idx) => {
    const id       = item.id.videoId;
    const snippet  = item.snippet;
    const detail   = details[id] || {};
    const stats    = detail.statistics    || {};
    const content  = detail.contentDetails || {};

    return {
      id,
      uid:          `${category || 'search'}_${id}`,
      title:        snippet.title,
      category:     category || guessCategory(snippet.title + ' ' + snippet.description),
      description:  snippet.description || 'No description available.',
      channelName:  snippet.channelTitle,
      channelInitials: initials(snippet.channelTitle),
      thumbnail:    snippet.thumbnails?.maxres?.url
                    || snippet.thumbnails?.high?.url
                    || snippet.thumbnails?.medium?.url || '',
      publishedAt:  formatDate(snippet.publishedAt),
      duration:     parseDuration(content.duration),
      viewCount:    formatCount(stats.viewCount),
      likeCount:    formatCount(stats.likeCount),
      featured:     idx < 2   // first 2 from each query flagged featured
    };
  });
}

/** Very rough category guesser for search results */
function guessCategory(text) {
  text = text.toLowerCase();
  if (/tech|code|program|software|ai|machine|robot|cyber|web|app/.test(text)) return 'technology';
  if (/science|space|mars|physics|biology|chemistry|nasa/.test(text))         return 'science';
  if (/health|fitness|wellness|diet|nutrition|mental|yoga/.test(text))        return 'health';
  if (/business|startup|finance|money|invest|entrepreneur/.test(text))        return 'business';
  if (/travel|lifestyle|fashion|food|cooking|home/.test(text))                return 'lifestyle';
  if (/education|learn|study|school|university|course/.test(text))            return 'education';
  return 'technology';
}

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

/* ================================================================
   LOAD ALL CATEGORIES
================================================================ */
async function loadAllContent() {
  // Show skeletons in every section while loading
  featuredGrid.innerHTML     = buildSkeletons(4, 'featured');
  recommendedGrid.innerHTML  = buildSkeletons(6);

  try {
    // Fetch all categories in parallel
    const results = await Promise.allSettled(
      categories.map(cat => fetchVideos(cat.query, cat.id))
    );

    allVideos = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        allVideos.push(...result.value);
      } else {
        console.warn(`Category "${categories[i].id}" failed:`, result.reason?.message);
      }
    });

    if (!allVideos.length) throw new Error('no_results');

    buildCategoriesGrid();
    buildFeaturedGrid();
    buildFilterChips();
    renderRecommended();
    observeFadeIns();

  } catch (err) {
    const msg = err.message;
    featuredGrid.innerHTML    = buildApiError(msg);
    recommendedGrid.innerHTML = '';
    categoriesGrid.innerHTML  = buildCategorySkeletons(); // still show static cats
  }
}

/* ================================================================
   CATEGORIES GRID
================================================================ */
function buildCategoriesGrid() {
  categoriesGrid.innerHTML = categories.map(cat => {
    const count = allVideos.filter(v => v.category === cat.id).length;
    return `
      <div class="category-card fade-in" data-cat="${cat.id}" role="listitem"
           tabindex="0" aria-label="Browse ${cat.label}, ${count} videos"
           style="--cat-color:${cat.color}">
        <div class="category-icon-wrap" style="background:${cat.color}1a">
          <span aria-hidden="true">${cat.icon}</span>
        </div>
        <span class="category-name">${cat.label}</span>
        <span class="category-count">${count} video${count !== 1 ? 's' : ''}</span>
      </div>`;
  }).join('');

  categoriesGrid.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click',   ()  => scrollToFilteredRecommended(card.dataset.cat));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollToFilteredRecommended(card.dataset.cat);
      }
    });
  });
}

function scrollToFilteredRecommended(catId) {
  setActiveFilter(catId);
  document.getElementById('recommended').scrollIntoView({ behavior: 'smooth' });
}

/* ================================================================
   FEATURED GRID
================================================================ */
function buildFeaturedGrid() {
  const featured = allVideos.filter(v => v.featured).slice(0, 4);
  if (!featured.length) {
    featuredGrid.innerHTML = '<p style="color:var(--color-text-2);text-align:center;padding:40px 0">No featured videos available.</p>';
    return;
  }

  featuredGrid.innerHTML = featured.map(v => `
    <article class="featured-card fade-in" data-vid="${v.uid}" tabindex="0"
             role="article" aria-label="${escHtml(v.title)}">
      <div class="featured-image-wrap">
        <img class="featured-image" src="${v.thumbnail}" alt="${escHtml(v.title)}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
        <div class="featured-image-placeholder" style="background:${CAT_GRADIENTS[v.category]};display:none">
          ${getCategoryIcon(v.category)}
        </div>
        <span class="featured-badge" aria-label="Featured">★ Featured</span>
        <span class="featured-cat-badge" style="background:${CAT_COLORS[v.category]}">${v.category}</span>
        <div class="play-overlay" aria-hidden="true">
          <div class="play-btn-large">▶</div>
        </div>
      </div>
      <div class="featured-body">
        <div class="featured-meta">
          <span>${v.publishedAt}</span>
          <span class="dot" aria-hidden="true">•</span>
          <span>${v.duration || 'Video'}</span>
          <span class="dot" aria-hidden="true">•</span>
          <span>👁 ${v.viewCount}</span>
        </div>
        <h3 class="featured-title">${escHtml(v.title)}</h3>
        <p class="featured-desc">${escHtml(v.description)}</p>
        <div class="featured-footer">
          <div class="card-author">
            <div class="author-avatar" aria-hidden="true">${v.channelInitials}</div>
            <span class="card-author-name">${escHtml(v.channelName)}</span>
          </div>
          <button class="btn-read-more watch-btn" aria-label="Watch: ${escHtml(v.title)}">
            ▶ Watch
          </button>
        </div>
      </div>
    </article>`).join('');

  attachCardListeners(featuredGrid);
}

/* ================================================================
   FILTER CHIPS
================================================================ */
function buildFilterChips() {
  filterChips.innerHTML =
    `<button class="chip active" data-filter="all" aria-pressed="true">All</button>` +
    categories.map(cat =>
      `<button class="chip" data-filter="${cat.id}" aria-pressed="false">${cat.icon} ${cat.label}</button>`
    ).join('');

  filterChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => setActiveFilter(chip.dataset.filter));
  });
}

function setActiveFilter(filter) {
  activeFilter = filter;
  visibleCount = ITEMS_PER_PAGE;

  filterChips.querySelectorAll('.chip').forEach(chip => {
    const active = chip.dataset.filter === filter;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', active);
  });

  categoriesGrid.querySelectorAll('.category-card').forEach(card => {
    card.classList.toggle('active-cat', card.dataset.cat === filter);
  });

  renderRecommended();
}

function getFilteredVideos() {
  return activeFilter === 'all'
    ? allVideos
    : allVideos.filter(v => v.category === activeFilter);
}

function renderRecommended() {
  const filtered = getFilteredVideos();
  const slice    = filtered.slice(0, visibleCount);

  recommendedGrid.innerHTML = slice.length
    ? slice.map(v => buildVideoCard(v)).join('')
    : `<p style="color:var(--color-text-2);grid-column:1/-1;text-align:center;padding:40px 0">No videos in this category yet.</p>`;

  loadMoreBtn.style.display = visibleCount >= filtered.length ? 'none' : '';
  attachCardListeners(recommendedGrid);
  observeFadeIns();
}

loadMoreBtn.addEventListener('click', () => {
  visibleCount += ITEMS_PER_PAGE;
  renderRecommended();
});

/* ================================================================
   VIDEO CARD BUILDER
================================================================ */
function buildVideoCard(v) {
  return `
    <article class="content-card fade-in" data-vid="${v.uid}" tabindex="0"
             role="article" aria-label="${escHtml(v.title)}">
      <div class="card-image-wrap">
        <img class="card-image" src="${v.thumbnail}" alt="${escHtml(v.title)}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
        <div class="card-image-placeholder" style="background:${CAT_GRADIENTS[v.category]};display:none">
          ${getCategoryIcon(v.category)}
        </div>
        <span class="card-category-badge" style="background:${CAT_COLORS[v.category]}">${v.category}</span>
        <div class="play-overlay" aria-hidden="true">
          <div class="play-btn-small">▶</div>
        </div>
        ${v.duration ? `<span class="duration-badge">${v.duration}</span>` : ''}
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span>${v.publishedAt}</span>
          <span class="dot" aria-hidden="true">•</span>
          <span>👁 ${v.viewCount}</span>
          ${v.likeCount !== '—' ? `<span class="dot" aria-hidden="true">•</span><span>👍 ${v.likeCount}</span>` : ''}
        </div>
        <h3 class="card-title">${escHtml(v.title)}</h3>
        <p class="card-desc">${escHtml(v.description)}</p>
        <div class="card-footer">
          <div class="card-author">
            <div class="author-avatar" aria-hidden="true">${v.channelInitials}</div>
            <span class="card-author-name">${escHtml(v.channelName)}</span>
          </div>
          <button class="btn-read-more watch-btn" aria-label="Watch: ${escHtml(v.title)}">
            ▶ Watch
          </button>
        </div>
      </div>
    </article>`;
}

/* ================================================================
   CARD EVENT DELEGATION
================================================================ */
function attachCardListeners(container) {
  container.querySelectorAll('[data-vid]').forEach(card => {
    const openModal = () => {
      const uid   = card.dataset.vid;
      // Search results use plain video id, stored videos use uid
      const video = allVideos.find(v => v.uid === uid)
                 || allVideos.find(v => v.id  === uid);
      if (video) openVideoModal(video);
    };

    card.addEventListener('click', e => {
      if (e.target.closest('.watch-btn') || !e.target.closest('button')) openModal();
    });
    card.addEventListener('keydown', e => { if (e.key === 'Enter') openModal(); });
  });
}

/* ================================================================
   VIDEO MODAL
================================================================ */
function openVideoModal(v) {
  // Inject iframe player
  $('modalPlayer').innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1"
      title="${escHtml(v.title)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      loading="lazy">
    </iframe>`;

  $('modalCategoryBadge').textContent        = v.category;
  $('modalCategoryBadge').style.background   = CAT_COLORS[v.category];
  $('modalDate').textContent                 = v.publishedAt;
  $('modalReadTime').textContent             = v.duration || 'Video';
  $('modalAuthor').textContent               = v.channelName;
  $('modalTitle').textContent                = v.title;
  $('modalDescription').textContent         = v.description;

  $('modalStats').innerHTML = `
    <span class="modal-stat">👁 ${v.viewCount} views</span>
    ${v.likeCount !== '—' ? `<span class="modal-stat">👍 ${v.likeCount} likes</span>` : ''}`;

  $('modalTags').innerHTML = '';  // YouTube search doesn't return tags via search endpoint

  const avatar = $('modalAuthorAvatar');
  avatar.textContent       = v.channelInitials;
  avatar.style.background  = `linear-gradient(135deg,${CAT_COLORS[v.category]},${CAT_COLORS[v.category]}99)`;
  $('modalAuthorName').textContent = v.channelName;

  $('modalYtLink').href = `https://www.youtube.com/watch?v=${v.id}`;

  modalOverlay.classList.add('active');
  modalOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('modalClose').focus();
}

function closeModal() {
  // Stop video by clearing iframe src before hiding
  $('modalPlayer').innerHTML = '';
  modalOverlay.classList.remove('active');
  modalOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

$('modalClose').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
});

/* ================================================================
   NEWSLETTER
================================================================ */
newsletterForm.addEventListener('submit', e => {
  e.preventDefault();
  const email      = newsletterEmail.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  newsletterMsg.classList.remove('hidden', 'success', 'error');
  if (!email || !emailRegex.test(email)) {
    newsletterMsg.textContent = '⚠ Please enter a valid email address.';
    newsletterMsg.classList.add('error');
    return;
  }
  newsletterMsg.textContent = '🎉 Thanks for subscribing! Check your inbox soon.';
  newsletterMsg.classList.add('success');
  newsletterEmail.value = '';
  setTimeout(() => newsletterMsg.classList.add('hidden'), 5000);
});

/* ================================================================
   FOOTER CATEGORY LINKS
================================================================ */
document.querySelectorAll('[data-filter]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    scrollToFilteredRecommended(link.dataset.filter);
  });
});

/* ================================================================
   INTERSECTION OBSERVER — fade-in
================================================================ */
let fadeObserver;
function observeFadeIns() {
  if (fadeObserver) fadeObserver.disconnect();
  fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => fadeObserver.observe(el));
}

/* ================================================================
   SKELETON / ERROR BUILDERS
================================================================ */
function buildSkeletons(n, type = 'card') {
  if (type === 'featured') {
    return Array.from({ length: n }, () => `
      <div class="featured-card skeleton-card">
        <div class="skeleton skeleton-img"></div>
        <div class="featured-body">
          <div class="skeleton skeleton-line w60"></div>
          <div class="skeleton skeleton-line w90"></div>
          <div class="skeleton skeleton-line w75"></div>
        </div>
      </div>`).join('');
  }
  return Array.from({ length: n }, () => `
    <div class="content-card skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="card-body">
        <div class="skeleton skeleton-line w40"></div>
        <div class="skeleton skeleton-line w90"></div>
        <div class="skeleton skeleton-line w70"></div>
      </div>
    </div>`).join('');
}

function buildCategorySkeletons() {
  return categories.map(cat => `
    <div class="category-card fade-in" data-cat="${cat.id}" role="listitem"
         tabindex="0" style="--cat-color:${cat.color}">
      <div class="category-icon-wrap" style="background:${cat.color}1a">
        <span aria-hidden="true">${cat.icon}</span>
      </div>
      <span class="category-name">${cat.label}</span>
      <span class="category-count">— videos</span>
    </div>`).join('');
}

function buildApiError(msg) {
  const isNoKey   = msg === 'no_key';
  const isQuota   = msg?.toLowerCase().includes('quota');
  const isInvalid = msg?.toLowerCase().includes('api key') || msg?.toLowerCase().includes('invalid');

  let heading, detail, fix;
  if (isNoKey) {
    heading = 'API Key Not Set';
    detail  = 'You need a YouTube Data API v3 key to load videos.';
    fix     = `Open <code>js/content.js</code> and replace <code>YOUR_API_KEY_HERE</code> with your key.`;
  } else if (isQuota) {
    heading = 'Daily Quota Exceeded';
    detail  = 'The YouTube API free quota (10,000 units/day) has been reached.';
    fix     = 'Wait until midnight Pacific Time for the quota to reset, or use a different API key.';
  } else if (isInvalid) {
    heading = 'Invalid API Key';
    detail  = 'Google rejected the API key provided.';
    fix     = 'Check that you copied the key correctly in <code>js/content.js</code>.';
  } else {
    heading = 'Could Not Load Videos';
    detail  = msg || 'An unknown error occurred while fetching from YouTube.';
    fix     = 'Check your internet connection and API key, then refresh the page.';
  }

  return `
    <div class="api-error" role="alert">
      <div class="api-error-icon">⚠️</div>
      <h3>${heading}</h3>
      <p>${detail}</p>
      <p class="api-error-fix">${fix}</p>
      <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer"
         class="btn btn-primary" style="margin-top:16px;display:inline-flex">
        Get API Key →
      </a>
    </div>`;
}

/* ================================================================
   HELPERS
================================================================ */
function getCategoryIcon(cat) {
  return { technology:'💻', science:'🔬', health:'🌿',
           business:'📈', lifestyle:'✨', education:'📚' }[cat] || '📹';
}

/** Escape HTML to safely render untrusted strings in innerHTML */
function escHtml(str = '') {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

/* ================================================================
   INIT
================================================================ */
function init() {
  initTheme();
  // Show static category skeletons immediately
  categoriesGrid.innerHTML = buildCategorySkeletons();
  buildFilterChips();
  observeFadeIns();
  // Kick off API load
  loadAllContent();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
