import { searchYouTubeVideos } from './youtube-api.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('search-form');
  const queryInput = document.getElementById('search-query');
  const monthYearInput = document.getElementById('month-year');
  const primarySortSelect = document.getElementById('primary-sort');
  const secondarySortSelect = document.getElementById('secondary-sort');
  const resultsGrid = document.getElementById('results-grid');
  const loader = document.getElementById('loader');
  const errorMessage = document.getElementById('error-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const query = queryInput.value.trim();
    if (!query) return;

    const order = primarySortSelect.value;
    const secondaryOrder = secondarySortSelect.value;
    let publishedAfter = null;

    if (monthYearInput.value) {
      // monthYearInput.value is in "YYYY-MM" format
      // We need RFC 3339 "YYYY-MM-01T00:00:00Z"
      publishedAfter = `${monthYearInput.value}-01T00:00:00Z`;
    }

    // UI Updates
    errorMessage.classList.add('hidden');
    resultsGrid.innerHTML = '';
    loader.classList.remove('hidden');

    try {
      let videos = await searchYouTubeVideos({ query, publishedAfter, order });
      
      // Calculate a "Match Score" for each video based on how many query words appear in the title
      const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1); // Ignore single letters
      
      videos.forEach(video => {
        const title = video.title.toLowerCase();
        let score = 0;
        words.forEach(word => {
          if (title.includes(word)) score += 1;
        });
        video.matchScore = score;
      });

      // Filter out videos that have a score of 0 (no words matched the title at all)
      if (words.length > 0) {
        const filteredVideos = videos.filter(v => v.matchScore > 0);
        if (filteredVideos.length >= 3) {
          videos = filteredVideos;
        }
      }

      // Sort locally: First by matchScore, THEN by the secondary sort (e.g. viewCount)
      videos.sort((a, b) => {
        // Primary Local Sort: Keyword Relevance in Title
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }
        
        // Secondary Local Sort: User's selected filter
        if (secondaryOrder === 'mostViewed') {
          return parseInt(b.viewCount) - parseInt(a.viewCount);
        } else if (secondaryOrder === 'newest') {
          return new Date(b.publishedAt) - new Date(a.publishedAt);
        }
        return 0; // fallback if no secondary order
      });

      // Display top 12 results for a nice grid
      renderVideos(videos.slice(0, 12));
    } catch (error) {
      console.error(error);
      errorMessage.textContent = error.message;
      errorMessage.classList.remove('hidden');
    } finally {
      loader.classList.add('hidden');
    }
  });

  function renderVideos(videos) {
    if (videos.length === 0) {
      errorMessage.textContent = "No videos found for this search.";
      errorMessage.classList.remove('hidden');
      return;
    }

    videos.forEach(video => {
      const date = new Date(video.publishedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      const views = parseInt(video.viewCount).toLocaleString();

      const card = document.createElement('div');
      card.className = 'video-card';
      
      card.innerHTML = `
        <div class="video-thumbnail">
          <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" rel="noopener noreferrer">
            <img src="${video.thumbnail}" alt="${video.title}">
          </a>
        </div>
        <div class="video-info">
          <h3 class="video-title">
            <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">
              ${video.title}
            </a>
          </h3>
          <p class="video-channel">${video.channelTitle}</p>
          <div class="video-meta">
            <span>${views} views</span>
            <span>${date}</span>
          </div>
        </div>
      `;
      
      resultsGrid.appendChild(card);
    });
  }
});
