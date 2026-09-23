// Servidor mínimo, sin dependencias (solo módulos nativos de Node).
// Guarda el progreso de Objetivos en un único archivo objetivos-data.json.
// Nginx sigue sirviendo el sitio estático tal cual; esto solo atiende /api/objetivos.
//
// Uso: FC_GUIDE_TOKEN=algo-secreto PORT=4322 node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4322;
const AUTH_TOKEN = process.env.FC_GUIDE_TOKEN || 'cambia-esto-por-algo-tuyo';
const DATA_FILE = path.join(__dirname, 'objetivos-data.json');
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB, de sobra para este uso

const green = s => `\x1b[32m${s}\x1b[0m`;
const red = s => `\x1b[31m${s}\x1b[0m`;

function send(res, status, body){
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.url !== '/api/objetivos') return send(res, 404, JSON.stringify({ error: 'not found' }));

  // Leer el progreso guardado
  if (req.method === 'GET') {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
      send(res, 200, err ? '{}' : data);
    });
    return;
  }

  // Guardar el progreso (protegido con un token compartido)
  if (req.method === 'POST') {
    if (req.headers['x-auth'] !== AUTH_TOKEN) {
      console.log(red('POST rechazado: token inválido'));
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
      fs.writeFile(DATA_FILE, body, err2 => {
        if (err2) {
          console.log(red('Error al escribir ' + DATA_FILE + ': ' + err2.message));
          return send(res, 500, JSON.stringify({ error: 'write failed' }));
        }
        console.log(green('Progreso guardado (' + body.length + ' bytes)'));
        send(res, 200, JSON.stringify({ ok: true }));
      });
    });
    return;
  }

  send(res, 405, JSON.stringify({ error: 'method not allowed' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(green(`Objetivos API escuchando en 127.0.0.1:${PORT}`));
});
