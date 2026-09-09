const http = require('http');
const fs = require('fs');
const path = require('path');

// En ligne, l'hébergeur injecte le port via process.env.PORT. En local, on utilise 3000.
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Créer le dossier /data s'il n'existe pas encore
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Dictionnaire des types MIME pour servir correctement HTML, CSS, JS, etc.
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Configuration des en-têtes CORS pour autoriser l'accès externe (Ngrok, domaine distant, etc.)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Réponse aux requêtes de pré-vérification CORS (Preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Normalisation de l'URL pour supprimer les paramètres éventuels (?v=1...)
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- API 1 : Sauvegarder une matière dans un fichier JSON ---
  if (pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Nom de matière manquant' }));
        }

        // Nettoyage du nom pour éviter les failles de chemin (Directory Traversal)
        const safeName = path.basename(data.name);
        const filePath = path.join(DATA_DIR, `${safeName}.json`);

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Fichier enregistré !' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- API 2 : Charger une matière depuis son fichier JSON ---
  if (pathname.startsWith('/api/load/') && req.method === 'GET') {
    const rawSubjectName = decodeURIComponent(pathname.replace('/api/load/', ''));
    const safeName = path.basename(rawSubjectName);
    const filePath = path.join(DATA_DIR, `${safeName}.json`);

    if (fs.existsSync(filePath)) {
      try {
        const fileData = fs.readFileSync(filePath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(fileData);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erreur lors de la lecture du fichier' }));
      }
    } else {
      // Si le fichier n'existe pas encore, renvoyer une structure par défaut
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ name: safeName, courses: [], methods: [], dictionary: [] }));
    }
    return;
  }

  // --- API 3 : Récupérer la liste de toutes les matières existantes (.json) ---
  if (pathname === '/api/subjects' && req.method === 'GET') {
    try {
      const files = fs.readdirSync(DATA_DIR);
      const subjects = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(subjects));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    }
    return;
  }

  // --- SERVIR LES FICHIERS STATIQUES (index.html, style.css, script.js...) ---
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  const filePath = path.join(__dirname, safePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 : Fichier non trouvé');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`500 : Erreur serveur - ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Serveur actif sur le port : ${PORT}`);
});