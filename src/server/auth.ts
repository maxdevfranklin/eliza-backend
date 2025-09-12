import express from "express";
import fetch from "node-fetch";

const app = express();
const port = 4001;

app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("No code received");

  // Exchange code for tokens
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: "http://localhost:4001/oauth2callback",
      grant_type: "authorization_code",
    }),
  });

  const tokens = await response.json();
  console.log("Tokens:", tokens); // access_token + refresh_token
  res.send("Success! You can close this window.");
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});