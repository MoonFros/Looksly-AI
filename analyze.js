import fetch from "node-fetch";
import formidable from "formidable";
import fs from "fs";

// Disable default body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS headers so frontend can call it
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight
  if (req.method === "OPTIONS") return res.status(200).end();

  // Simple GET route for testing
  if (req.method === "GET") {
    return res
      .status(200)
      .json({ message: "API is live! Use POST with a file." });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "Form parse error" });

    const file = files.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const buffer = fs.readFileSync(file.filepath);

      // Call Hugging Face image classification
      const hfResponse = await fetch(
        "https://api-inference.huggingface.co/models/google/vit-base-patch16-224",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.HF_API_KEY}`,
            "Content-Type": "application/octet-stream",
          },
          body: buffer,
        }
      );

      const hfData = await hfResponse.json();

      // Extract top labels
      const labels = hfData?.map((x) => x.label.toLowerCase()) || [];

      // ---------------- Fit scoring logic ----------------
      let score = 5;

      // Example: boost points for key items
      if (labels.includes("jacket")) score += 2;
      if (labels.includes("sneakers")) score += 2;
      if (labels.includes("shirt") || labels.includes("jeans")) score += 1;
      if (labels.length >= 3) score += 1;

      score = Math.max(1, Math.min(10, score));

      // ---------------- Style detection ----------------
      let style = "Casual / Everyday";
      if (labels.includes("suit") || labels.includes("blazer")) style = "Formal / Business";
      if (labels.includes("hoodie") || labels.includes("sneakers")) style = "Streetwear / Urban";
      if (labels.includes("dress") || labels.includes("skirt")) style = "Chic / Fashion-forward";

      // ---------------- Response ----------------
      const response = {
        fitScore: score,
        styleDescription: style,
        detectedLabels: labels,
      };

      res.status(200).json(response);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Hugging Face API error" });
    }
  });
}
