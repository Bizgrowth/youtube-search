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
      
      // Calculate an advanced "Match Score" for each video
      const queryLower = query.toLowerCase();
      const words = queryLower.split(/\s+/).filter(w => w.length > 1); // Ignore single letters
      
      videos.forEach(video => {
        const title = video.title.toLowerCase();
        const description = (video.description || '').toLowerCase();
        const channelTitle = (video.channelTitle || '').toLowerCase();
        let score = 0;

        // 1. Exact Phrase Match in Title gets a massive boost
        if (title.includes(queryLower)) {
          score += 50;
        }

        words.forEach(word => {
          // Escape word for regex
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wordRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');

          // 2. Exact word match in Title
          if (wordRegex.test(title)) {
            score += 10;
          } 
          // 3. Partial word match in Title (e.g. "car" in "cardboard")
          else if (title.includes(word)) {
            score += 2;
          }

          // 4. Exact word match in Channel Name
          if (wordRegex.test(channelTitle)) {
            score += 5;
          }

          // 5. Exact word match in Description
          if (wordRegex.test(description)) {
            score += 1;
          }
        });
        
        video.matchScore = score;
      });

      // Filter out videos that have a score of 0 (no relevance at all)
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
      card.className = 'bg-[#1F2328] border border-[#444C56] rounded-xl overflow-hidden hover:border-[#2F81F7] transition-all duration-300 group flex flex-col shadow-lg hover:shadow-[#2F81F7]/10';
      
      card.innerHTML = `
        <div class="relative aspect-video overflow-hidden bg-[#101418]">
          <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" rel="noopener noreferrer" class="block w-full h-full">
            <img src="${video.thumbnail}" alt="${video.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </a>
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
