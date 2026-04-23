const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export async function searchYouTubeVideos({ query, publishedAfter, order }) {
  if (!API_KEY) {
    throw new Error('YouTube API Key is missing. Please add it to your .env file.');
  }

  // Construct URL
  const url = new URL(`${BASE_URL}/search`);
  url.searchParams.append('part', 'snippet');
  url.searchParams.append('q', query);
  url.searchParams.append('maxResults', '50'); // Increased to 50 for better local sorting
  url.searchParams.append('type', 'video');
  url.searchParams.append('key', API_KEY);
  url.searchParams.append('relevanceLanguage', 'en'); // Ensure English results

  if (order) {
    url.searchParams.append('order', order);
  }

  if (publishedAfter) {
    // publishedAfter must be an RFC 3339 formatted date-time value (1970-01-01T00:00:00Z)
    url.searchParams.append('publishedAfter', publishedAfter);
  }

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch YouTube videos.');
  }

  // We also want view counts, but the search endpoint doesn't return statistics.
  // We need to make a second call to videos endpoint to get statistics (viewCount).
  const videoIds = data.items.map(item => item.id.videoId).join(',');
  
  if (!videoIds) {
    return [];
  }

  const statsUrl = new URL(`${BASE_URL}/videos`);
  statsUrl.searchParams.append('part', 'statistics,snippet');
  statsUrl.searchParams.append('id', videoIds);
  statsUrl.searchParams.append('key', API_KEY);

  const statsResponse = await fetch(statsUrl);
  const statsData = await statsResponse.json();

  if (!statsResponse.ok) {
    throw new Error(statsData.error?.message || 'Failed to fetch video statistics.');
  }

  // Map stats back to the items
  return statsData.items.map(item => {
    return {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      viewCount: item.statistics.viewCount || '0'
    };
  });
}
