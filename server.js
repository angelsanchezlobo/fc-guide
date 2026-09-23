// Servidor mínimo, sin dependencias (solo módulos nativos de Node).
// Guarda cada sección editable (Objetivos, Tácticas...) en su propio archivo JSON.
// Nginx sigue sirviendo el sitio estático tal cual; esto solo atiende /api/*.
//
// Uso: FC_GUIDE_TOKEN=algo-secreto PORT=4322 node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4322;
const AUTH_TOKEN = process.env.FC_GUIDE_TOKEN || 'cambia-esto-por-algo-tuyo';
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB, de sobra para este uso

const STORES = {
  '/api/objetivos': path.join(__dirname, 'objetivos-data.json'),
  '/api/tacticas': path.join(__dirname, 'tacticas-data.json'),
};

const green = s => `\x1b[32m${s}\x1b[0m`;
const red = s => `\x1b[31m${s}\x1b[0m`;

function send(res, status, body){
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const dataFile = STORES[req.url];
  if (!dataFile) return send(res, 404, JSON.stringify({ error: 'not found' }));

  // Leer el progreso guardado
  if (req.method === 'GET') {
    fs.readFile(dataFile, 'utf8', (err, data) => {
      send(res, 200, err ? '{}' : data);
    });
    return;
  }

  // Guardar el progreso (protegido con un token compartido)
  if (req.method === 'POST') {
    if (req.headers['x-auth'] !== AUTH_TOKEN) {
      console.log(red(`POST rechazado en ${req.url}: token inválido`));
      return send(res, 401, JSON.stringify({ error: 'unauthorized' }));
    }
    let body = '';
    let tooBig = false;
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return;
      try {
        JSON.parse(body); // valida que sea JSON antes de escribir
      } catch (e) {
        return send(res, 400, JSON.stringify({ error: 'invalid json' }));
      }
      fs.writeFile(dataFile, body, err2 => {
        if (err2) {
          console.log(red('Error al escribir ' + dataFile + ': ' + err2.message));
          return send(res, 500, JSON.stringify({ error: 'write failed' }));
        }
        console.log(green(`Guardado en ${req.url} (` + body.length + ' bytes)'));
        send(res, 200, JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  send(res, 405, JSON.stringify({ error: 'method not allowed' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(green(`FC Guide API escuchando en 127.0.0.1:${PORT} (${Object.keys(STORES).join(', ')})`));
});
