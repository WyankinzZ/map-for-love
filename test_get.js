const http = require('http');

const port = 3005;

// We need to set the env vars exactly like the exe does!
process.env.NODE_ENV = 'production';
process.env.PORT = String(port);
process.env.HOSTNAME = '127.0.0.1';
process.env.MAP_OF_US_DESKTOP = '1';
process.env.MAP_OF_US_STORAGE_MODE = 'local';
// Mock data dir
const path = require('path');
const fs = require('fs');
process.env.MAP_OF_US_DATA_DIR = path.join(__dirname, 'mock_data');
process.env.MAP_OF_US_BUNDLED_DATA_DIR = path.join(__dirname, 'data');
process.env.AUTH_COOKIE_SECRET = 'mock_secret';
fs.mkdirSync(process.env.MAP_OF_US_DATA_DIR, { recursive: true });

// Start server
require('./.next/standalone/server.js');

setTimeout(() => {
  http.get(`http://127.0.0.1:${port}/api/city-assets`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('GET /api/city-assets STATUS:', res.statusCode);
      console.log('GET /api/city-assets BODY:', data);
    });
  }).on('error', console.error);

  http.get(`http://127.0.0.1:${port}/api/memories`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('GET /api/memories STATUS:', res.statusCode);
      console.log('GET /api/memories BODY:', data);
      
      // Stop server
      process.exit(0);
    });
  }).on('error', console.error);
}, 2000);
