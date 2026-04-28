const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = require("node-fetch");
const FeedParser = require("feedparser");

module.exports = async (req, res) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // arXiv URL for Astronomy (astro-ph.EP for Exoplanets)
  const arxivUrl = "https://export.arxiv.org/api/query?search_query=cat:astro-ph.EP+OR+cat:astro-ph.IM&sortBy=submittedDate&sortOrder=descending&max_results=5";

  try {
    const response = await fetch(arxivUrl);
    const feedparser = new FeedParser();
    const papers = [];

    response.body.pipe(feedparser);

    feedparser.on("readable", function () {
      let post;
      while ((post = this.read())) {
        papers.push({
          title: post.title,
          link: post.guid.replace("abs", "pdf") + ".pdf",
          summary: post.summary
        });
      }
    });

    feedparser.on("end", async () => {
      // Use Gemini to create a 'Bite-sized' summary for mobile reading
      const enrichedPapers = await Promise.all(papers.map(async (p) => {
        const prompt = `Summarize this astrophysics paper title in 1 sentence for a student: ${p.title}`;
        const result = await model.generateContent(prompt);
        return { ...p, aiSummary: result.response.text() };
      }));

      res.status(200).json(enrichedPapers);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
