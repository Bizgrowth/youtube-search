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

  const loadMoreContainer = document.getElementById('load-more-container');
  const loadMoreBtn = document.getElementById('load-more-btn');

  let currentVideos = [];
  let currentNextPageToken = null;
  let displayedCount = 0;
  const itemsPerPage = 10;
  let currentQuery = '';
  let currentOrder = '';
  let currentSecondaryOrder = '';
  let currentPublishedAfter = null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    currentQuery = queryInput.value.trim();
    if (!currentQuery) return;

    currentOrder = primarySortSelect.value;
    currentSecondaryOrder = secondarySortSelect.value;
    currentPublishedAfter = null;

    if (monthYearInput.value) {
      currentPublishedAfter = `${monthYearInput.value}-01T00:00:00Z`;
    }

    // Reset state
    currentVideos = [];
    currentNextPageToken = null;
    displayedCount = 0;
    
    errorMessage.classList.add('hidden');
    resultsGrid.innerHTML = '';
    if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
    loader.classList.remove('hidden');

    await fetchAndProcessVideos(currentNextPageToken);
  });

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async () => {
      if (displayedCount < currentVideos.length) {
        renderNextBatch();
      } else if (currentNextPageToken) {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';
        await fetchAndProcessVideos(currentNextPageToken);
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More';
      }
    });
  }

  async function fetchAndProcessVideos(pageToken) {
    try {
      const response = await searchYouTubeVideos({ 
        query: currentQuery, 
        publishedAfter: currentPublishedAfter, 
        order: currentOrder,
        pageToken
      });
      
      let videos = response.items;
      currentNextPageToken = response.nextPageToken;
      
      const queryLower = currentQuery.toLowerCase();
      const words = queryLower.split(/\s+/).filter(w => w.length > 1);
      
      videos.forEach(video => {
        const title = video.title.toLowerCase();
        const description = (video.description || '').toLowerCase();
        let score = 0;

        if (title.includes(queryLower)) {
          score += 5;
        }

        words.forEach(word => {
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wordRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');

          if (wordRegex.test(title)) {
            score += 1;
          }
          if (wordRegex.test(description)) {
            score += 0.5;
          }
        });
        
        video.matchScore = score;
        
        const views = parseInt(video.viewCount) || 0;
        const likes = parseInt(video.likeCount) || 0;
        video.engagementRate = views > 0 ? (likes / views * 100) : 0;
      });

      if (words.length > 0) {
        const filteredVideos = videos.filter(v => v.matchScore > 0);
        if (filteredVideos.length >= 3) {
          videos = filteredVideos;
        }
      }

      videos.sort((a, b) => {
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore;
        }
        
        if (currentSecondaryOrder === 'mostViewed') {
          return parseInt(b.viewCount) - parseInt(a.viewCount);
        } else if (currentSecondaryOrder === 'newest') {
          return new Date(b.publishedAt) - new Date(a.publishedAt);
        } else if (currentSecondaryOrder === 'highestEngagement') {
          return b.engagementRate - a.engagementRate;
        }
        return 0;
      });

      const previousLength = currentVideos.length;
      currentVideos = currentVideos.concat(videos);
      
      if (currentVideos.length > previousLength) {
          renderNextBatch();
      } else if (displayedCount === 0) {
          errorMessage.textContent = "No videos found for this search.";
          errorMessage.classList.remove('hidden');
      }

    } catch (error) {
      console.error(error);
      errorMessage.textContent = error.message;
      errorMessage.classList.remove('hidden');
    } finally {
      loader.classList.add('hidden');
      updateLoadMoreVisibility();
    }
  }

  function renderNextBatch() {
      const nextVideos = currentVideos.slice(displayedCount, displayedCount + itemsPerPage);
      renderVideos(nextVideos);
      displayedCount += nextVideos.length;
      updateLoadMoreVisibility();
  }

  function updateLoadMoreVisibility() {
      if (!loadMoreContainer) return;
      if (displayedCount < currentVideos.length || currentNextPageToken) {
          loadMoreContainer.classList.remove('hidden');
      } else {
          loadMoreContainer.classList.add('hidden');
      }
  }

  function renderVideos(videos) {
    videos.forEach(video => {
      const date = new Date(video.publishedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      const views = parseInt(video.viewCount).toLocaleString();
      const engagement = video.engagementRate.toFixed(1) + '%';

      const card = document.createElement('div');
      card.className = 'bg-[#1F2328] border border-[#444C56] rounded-xl overflow-hidden hover:border-[#2F81F7] transition-all duration-300 group flex flex-col shadow-lg hover:shadow-[#2F81F7]/10';
      
      card.innerHTML = `
        <div class="relative aspect-video overflow-hidden bg-[#101418]">
          <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" rel="noopener noreferrer" class="block w-full h-full">
            <img src="${video.thumbnail}" alt="${video.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </a>
          <div class="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-[#2F81F7] border border-[#2F81F7]/30 flex items-center gap-1 shadow-lg">
            <span class="material-symbols-outlined text-[12px]">favorite</span>
            ${engagement}
          </div>
        </div>
        <div class="p-4 flex flex-col flex-1">
          <h3 class="text-sm font-semibold text-white mb-1 line-clamp-2 font-['Space_Grotesk'] leading-tight group-hover:text-[#2F81F7] transition-colors">
            <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" rel="noopener noreferrer" class="focus:outline-none">
              ${video.title}
            </a>
          </h3>
          <p class="text-xs text-gray-400 flex items-center gap-1 mb-3">
            <span class="material-symbols-outlined text-[14px]">account_circle</span>
            <span class="truncate">${video.channelTitle}</span>
          </p>
          <div class="flex items-center gap-3 text-xs text-[#8B949E] mt-auto pt-3 border-t border-[#444C56]/50">
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">visibility</span>
              ${views}
            </span>
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">calendar_today</span>
              ${date}
            </span>
          </div>
        </div>
      `;
      
      resultsGrid.appendChild(card);
    });
  }
});
