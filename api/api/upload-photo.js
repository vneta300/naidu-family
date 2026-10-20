// api/upload-photo.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, imageBase64, commitMessage } = req.body;

    if (!fileName || !imageBase64) {
      return res.status(400).json({ error: 'Missing fileName or imageBase64' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO = process.env.GITHUB_REPO || 'vneta300/naidu-family';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return res.status(500).json({ 
        error: 'Server configuration missing: GITHUB_TOKEN or GITHUB_REPO env variable is not set.' 
      });
    }

    const safeFileName = fileName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '.jpg';
    const filePath = `public/photos/${safeFileName}`;
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;

    let existingSha = null;
    const checkRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Vercel-Serverless-Upload'
      }
    });

    if (checkRes.ok) {
      const existingData = await checkRes.json();
      existingSha = existingData.sha;
    }

    const putBody = {
      message: commitMessage || `Upload photo: ${safeFileName}`,
      content: cleanBase64,
      branch: GITHUB_BRANCH
    };

    if (existingSha) {
      putBody.sha = existingSha;
    }

    const uploadRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Serverless-Upload'
      },
      body: JSON.stringify(putBody)
    });

    if (!uploadRes.ok) {
      const errData = await uploadRes.json();
      return res.status(uploadRes.status).json({ error: errData.message || 'GitHub API error' });
    }

    const uploadData = await uploadRes.json();
    const rawUrl = uploadData.content.download_url || `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;

    return res.status(200).json({
      success: true,
      filePath: filePath,
      rawUrl: rawUrl,
      fileName: safeFileName
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
