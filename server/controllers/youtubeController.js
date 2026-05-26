const searchYoutube = async (req, res) => {
    try {
        const { title, artist } = req.query;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: "title is required",
            });
        }

        const query = `${artist || ""} ${title} official audio`;

        const url = new URL("https://www.googleapis.com/youtube/v3/search");

        url.searchParams.set("part", "snippet");
        url.searchParams.set("q", query);
        url.searchParams.set("type", "video");
        url.searchParams.set("maxResults", "1");
        url.searchParams.set("key", process.env.YOUTUBE_API_KEY);

        const response = await fetch(url);

        const data = await response.json();

        const item = data.items?.[0];

        if (!item) {
            return res.status(404).json({
                success: false,
                message: "No YouTube result",
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                videoId: item.id.videoId,
                youtubeTitle: item.snippet.title,
                thumbnail:
                    item.snippet.thumbnails?.high?.url ||
                    item.snippet.thumbnails?.medium?.url ||
                    item.snippet.thumbnails?.default?.url,
                channelTitle: item.snippet.channelTitle,
            },
        });
    } catch (error) {
        console.error("YouTube Search Error:", error);

        return res.status(500).json({
            success: false,
            message: "YouTube search failed",
        });
    }
};

module.exports = {
    searchYoutube,
};