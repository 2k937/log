const fetch = require("node-fetch");

const url = process.env.RENDER_EXTERNAL_URL || "https://your-app.onrender.com"; 
// ^ Replace "your-app.onrender.com" with your Render app URL if needed

function ping() {
  fetch(url)
    .then(res => console.log(`Pinged ${url} - Status: ${res.status}`))
    .catch(err => console.error(`Error pinging ${url}:`, err));
}

// Ping every 5 minutes
setInterval(ping, 300000);

// Initial ping
ping();
