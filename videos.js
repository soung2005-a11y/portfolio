// 큐레이션 영상 목록. 영상은 재생하지 않고 제목과 원본 링크만 보여 줍니다.
// 유튜브 URL의 v= 뒤 값(영상 ID)과 메모를 추가하세요.
// 예: { id: "dQw4w9WgXcQ", source: "Y Combinator", note: "초기 창업팀의 PMF 검증" }
const CURATED_VIDEOS = [];

(() => {
  const section = document.getElementById("videos");
  const grid = document.getElementById("videoGrid");
  if (!section || !grid || CURATED_VIDEOS.length === 0) return;

  section.hidden = false;

  const createCard = (video) => {
    const card = document.createElement("article");
    card.className = "video-card reveal";
    card.dataset.videoId = video.id;

    const body = document.createElement("div");
    body.className = "video-card__body";

    const source = document.createElement("p");
    source.className = "video-card__source";
    source.textContent = video.source || "YouTube";

    const title = document.createElement("h3");
    title.textContent = video.note || video.id;

    const link = document.createElement("a");
    link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "YouTube에서 보기";
    link.className = "video-card__link";

    body.append(source, title, link);
    card.append(body);
    return card;
  };

  const cards = CURATED_VIDEOS.map(createCard);
  cards.forEach((card) => grid.appendChild(card));

  // 영상 제목·썸네일 조회는 서버(/api/videos)가 YouTube API를 대신 호출합니다.
  // API 키는 서버 환경변수(YOUTUBE_API_KEY)에만 있고 클라이언트에는 노출되지 않습니다.
  // 삭제·비공개 영상은 목록에서 제거합니다. 조회 결과는 저장하지 않습니다.
  const fetchVideoInfo = async (ids) => {
    const params = new URLSearchParams({ ids: ids.join(",") });
    const res = await fetch(`/api/videos?${params}`);
    if (!res.ok) throw new Error(`Video API responded with ${res.status}`);
    const data = await res.json();
    return new Map(data.items.map((item) => [item.id, item]));
  };

  fetchVideoInfo(CURATED_VIDEOS.map((video) => video.id))
    .then((videos) => {
      let remaining = 0;
      cards.forEach((card) => {
        const info = videos.get(card.dataset.videoId);
        if (!info) {
          card.remove();
          return;
        }
        remaining += 1;
        card.querySelector(".video-card__body h3").textContent = info.title;
        card.querySelector(".video-card__source").textContent =
          info.channelTitle || card.querySelector(".video-card__source").textContent;
      });
      if (remaining === 0) section.hidden = true;
    })
    .catch((error) => {
      console.warn("[videos] 영상 정보를 불러오지 못했습니다:", error);
    });
})();
