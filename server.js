const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const Xcomfort = require('./xcomfort-patch');

const config = {
  baseUrl: process.env.SHC_BASE_URL,
  username: process.env.SHC_USERNAME,
  password: process.env.SHC_PASSWORD,
  autoSetup: true
};

if (!config.baseUrl || !config.username || !config.password) {
  throw new Error('Missing SHC config. Set SHC_BASE_URL, SHC_USERNAME and SHC_PASSWORD in .env');
}

const publicDir = path.join(__dirname, 'public');
const xapi = new Xcomfort(config);
let appState = {
  ready: false,
  error: null,
  devices: [],
  scenes: []
};

function buildState() {
  const devices = [];
  const scenes = [];

  for (const [name, info] of xapi.deviceMap.entries()) {
    devices.push({
      name,
      type: info.type,
      zoneId: info.zoneId,
      value: info.value,
      dimmable: info.type === 'DimActuator'
    });
  }

  for (const [name, info] of xapi.sceneMap.entries()) {
    scenes.push({
      name,
      zoneId: info.zoneId
    });
  }

  devices.sort((a, b) => a.name.localeCompare(b.name));
  scenes.sort((a, b) => a.name.localeCompare(b.name));

  appState = {
    ready: true,
    error: null,
    devices,
    scenes
  };
}

xapi.on('ready', () => {
  buildState();
  console.log('Xcomfort ready');
});

xapi.on('error', (error) => {
  appState.error = error && error.message ? error.message : String(error);
  appState.ready = false;
  console.error(error);
});

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function serveStatic(res, fileName, contentType) {
  const filePath = path.join(publicDir, fileName);
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/state') {
    sendJson(res, 200, appState);
    return;
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/devices/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const deviceName = decodeURIComponent(parts[2] || '');
    const action = parts[3];
    const body = await readBody(req);
    const payload = body ? JSON.parse(body) : {};

    if (action === 'on' || action === 'off') {
      const result = await xapi.setDeviceState(deviceName, action);
      sendJson(res, 200, { ok: result });
      return;
    }

    if (action === 'dim') {
      const level = Number(payload.level);
      const result = await xapi.setDimState(deviceName, level);
      sendJson(res, 200, { ok: result });
      return;
    }

    sendJson(res, 404, { error: 'Unknown device action' });
    return;
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/scenes/')) {
    const sceneName = decodeURIComponent(url.pathname.split('/').pop() || '');
    const result = await xapi.triggerScene(sceneName);
    sendJson(res, 200, { ok: result });
    return;
  }

  sendJson(res, 404, { error: 'Unknown API route' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (req.method === 'GET' && url.pathname === '/') {
    serveStatic(res, 'index.html', 'text/html; charset=utf-8');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/app.js') {
    serveStatic(res, 'app.js', 'application/javascript; charset=utf-8');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/styles.css') {
    serveStatic(res, 'styles.css', 'text/css; charset=utf-8');
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, url);
    } catch (error) {
      sendJson(res, 500, { error: error.message || String(error) });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});
