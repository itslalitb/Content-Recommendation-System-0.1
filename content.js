/* ============================================================
   ContentHub — content.js
   YouTube Data API v3 Configuration
   ============================================================

   HOW TO GET YOUR API KEY:
   1. Go to https://console.cloud.google.com/
   2. Create a new project (or select existing)
   3. Go to "APIs & Services" → "Enable APIs"
   4. Search for "YouTube Data API v3" and enable it
   5. Go to "APIs & Services" → "Credentials"
   6. Click "Create Credentials" → "API Key"
   7. Copy the key and paste it below replacing YOUR_API_KEY_HERE

   ⚠ NOTE: This key is visible in client-side JS.
   For a demo/mini project this is fine.
   For production, proxy requests through a backend.
============================================================ */

const YOUTUBE_API_KEY = '';

/* Number of videos to fetch per category */
const VIDEOS_PER_CATEGORY = 8;

/* Number of featured videos to fetch (most popular overall) */
const FEATURED_COUNT = 4;

/* ---- Categories with YouTube search queries ---- */
const categories = [
  {
    id:      'technology',
    label:   'Technology',
    icon:    '💻',
    color:   '#6366f1',
    query:   'technology trends 2024',
    featured: true
  },
  {
    id:      'science',
    label:   'Science',
    icon:    '🔬',
    color:   '#06b6d4',
    query:   'science discoveries explained',
    featured: true
  },
  {
    id:      'health',
    label:   'Health',
    icon:    '🌿',
    color:   '#10b981',
    query:   'health wellness tips',
    featured: true
  },
  {
    id:      'business',
    label:   'Business',
    icon:    '📈',
    color:   '#f59e0b',
    query:   'business entrepreneurship success',
    featured: false
  },
  {
    id:      'lifestyle',
    label:   'Lifestyle',
    icon:    '✨',
    color:   '#ec4899',
    query:   'lifestyle motivation inspiration',
    featured: false
  },
  {
    id:      'education',
    label:   'Education',
    icon:    '📚',
    color:   '#8b5cf6',
    query:   'education learning skills',
    featured: false
  }
];

/* ---- YouTube API base URL ---- */
const YT_SEARCH_URL  = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS_URL  = 'https://www.googleapis.com/youtube/v3/videos';

/* ---- Helper: format large numbers e.g. 1200000 → "1.2M" ---- */
function formatCount(n) {
  n = parseInt(n, 10);
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1)     + 'K';
  return n.toString();
}

/* ---- Helper: ISO 8601 duration → "X min" ---- */
function parseDuration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || 0);
  const min = parseInt(m[2] || 0);
  const s = parseInt(m[3] || 0);
  if (h > 0) return `${h}h ${min}m`;
  if (min > 0) return `${min} min`;
  return `${s}s`;
}

/* ---- Helper: format ISO date → "Jan 5, 2024" ---- */
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}
