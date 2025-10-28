# chatgpt-notes-app

An interactive, chat‑native notes editor which renders inside ChatGPT. It pairs nicely with the “Research Papers” app. Ask ChatGPT to take a paper summary and create a note.

## Prerequisites
Node.js 18+
ngrok (or any HTTPS tunnel) for the MCP server
ChatGPT plus/pro subscription and development mode turned on

### Setup
1. Install dependencies
```bash
# from project root
cd web && npm install && npm run build
cd ../server && npm install
```

2. Run the MCP server
```bash
cd server
npm run dev   # starts on http://127.0.0.1:2092/mcp
```

3. Expose via HTTPS
```bash
#example
ngrok http 2092
```

4. Connect in ChatGPT
In ChatGPT, go to Settings -> Apps & Connectors -> Create
Endpoint: ngrok url with /mcp (e.g. https://<your-subdomain>.ngrok-free.app/mcp)
Auth: No auth
Save

5. Use app in Chat
Open a chat, and add the created app into the chat to use it
