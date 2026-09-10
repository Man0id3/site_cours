// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBEXlxtdJOtow7TwR2KiV6NCszorXSFsQ8",
  authDomain: "site-cours-a9eb4.firebaseapp.com",
  databaseURL: "https://site-cours-a9eb4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "site-cours-a9eb4",
  storageBucket: "site-cours-a9eb4.firebasestorage.app",
  messagingSenderId: "610542919440",
  appId: "1:610542919440:web:e5e50daf5bdcca06628f95"
};

// Initialisation de Firebase et de l'Authentification
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth(); // <-- NOUVEAU

let currentSubject = null;
let editingCourseId = null;
let editingMethodId = null;
let currentCourseLinks = [];

// --- OUTILS ÉDITEUR ---
function applyColor(color) {
  document.execCommand('foreColor', false, color);
}

function applyHighlight(color) {
  if (!document.execCommand('hiliteColor', false, color)) {
    document.execCommand('backColor', false, color);
  }
}

function execCmd(command) { 
  document.execCommand(command, false, null); 
}

// --- INITIALISATION & CONNEXION ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();

  // Écouteur pour la soumission du formulaire de connexion
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorElement = document.getElementById('auth-error');

    try {
      await auth.signInWithEmailAndPassword(email, password);
      errorElement.style.display = 'none';
    } catch (error) {
      errorElement.textContent = "Erreur de connexion : " + error.message;
      errorElement.style.display = 'block';
    }
  });

  // Bouton de déconnexion
  document.getElementById('btn-logout').addEventListener('click', () => {
    auth.signOut();
  });

  // Vérifie automatiquement si tu es connecté ou non
  auth.onAuthStateChanged(async (user) => {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    if (user) {
      // Connecté : on masque le formulaire et on affiche l'application
      authContainer.classList.add('hidden');
      appContainer.classList.remove('hidden');

      await loadSubjectNavigation();
      const savedSubject = localStorage.getItem('lastActiveSubject');
      if (savedSubject) {
        await selectSubject(savedSubject);
      }
    } else {
      // Déconnecté : on masque l'application et on affiche le formulaire
      authContainer.classList.remove('hidden');
      appContainer.classList.add('hidden');
    }
  });
});

// --- Reste du code (setupEventListeners, getSubjectData, etc.) inchangé ci-dessous ---

function setupEventListeners() {
  document.getElementById('add-subject-btn').addEventListener('click', createSubject);

  document.getElementById('btn-view-courses').addEventListener('click', () => switchView('courses'));
  document.getElementById('btn-view-method').addEventListener('click', () => switchView('method'));
  document.getElementById('btn-view-dico').addEventListener('click', () => switchView('dico'));

  // Cours
  document.getElementById('btn-show-add-course').addEventListener('click', resetAndShowCourseForm);
  document.getElementById('btn-cancel-course').addEventListener('click', () => {
    document.getElementById('course-form').classList.add('hidden');
  });
  document.getElementById('btn-save-course').addEventListener('click', saveCourse);

  // Méthodes
  document.getElementById('btn-show-add-method').addEventListener('click', resetAndShowMethodForm);
  document.getElementById('btn-cancel-method').addEventListener('click', () => {
    document.getElementById('method-form').classList.add('hidden');
  });
  document.getElementById('btn-save-method').addEventListener('click', saveMethod);

  // Dico & Liens
  document.getElementById('btn-save-notion').addEventListener('click', saveNotion);
  document.getElementById('btn-add-link-item').addEventListener('click', addLinkToForm);
}

// --- SAUVEGARDE & LECTURE FIREBASE ---
async function getSubjectData(subjectName) {
  if (!subjectName) return { name: '', courses: [], methods: [], dictionary: [] };
  try {
    const snapshot = await db.ref(`subjects/${subjectName}`).once('value');
    const data = snapshot.val();
    if (data) {
      return {
        name: data.name || subjectName,
        courses: data.courses || [],
        methods: data.methods || [],
        dictionary: data.dictionary || []
      };
    }
  } catch (err) {
    console.error("Erreur de lecture Firebase :", err);
  }
  return { name: subjectName, courses: [], methods: [], dictionary: [] };
}

async function saveSubjectData(subjectName, data) {
  if (!subjectName) return;
  try {
    await db.ref(`subjects/${subjectName}`).set(data);
  } catch (err) {
    console.error("Erreur de sauvegarde Firebase :", err);
    alert("Erreur lors de la sauvegarde sur le serveur.");
  }
}

// --- MATIÈRES ---
async function createSubject() {
  const input = document.getElementById('new-subject-name');
  const name = input.value.trim().toUpperCase().replace(/[.#$\[\]]/g, "_"); // Nettoyage des caractères interdits Firebase
  if (!name) return alert("Entrez un nom de matière.");

  const initialData = { name: name, courses: [], methods: [], dictionary: [] };
  await saveSubjectData(name, initialData);

  input.value = '';
  await loadSubjectNavigation();
  await selectSubject(name);
}

async function loadSubjectNavigation() {
  const nav = document.getElementById('subject-nav');
  nav.innerHTML = '';
  
  try {
    const snapshot = await db.ref('subjects').once('value');
    const subjectsData = snapshot.val();
    
    if (subjectsData) {
      const subjects = Object.keys(subjectsData);
      subjects.sort().forEach(sub => {
        const btn = document.createElement('button');
        btn.textContent = sub;
        if (sub === currentSubject) btn.classList.add('active');
        btn.onclick = () => selectSubject(sub);
        nav.appendChild(btn);
      });
    }
  } catch (err) {
    console.error("Erreur lors du chargement des matières :", err);
  }
}

async function selectSubject(subjectName) {
  currentSubject = subjectName;
  localStorage.setItem('lastActiveSubject', subjectName);
  
  await loadSubjectNavigation();
  document.getElementById('current-subject-title').textContent = `Matière : ${subjectName}`;
  document.getElementById('view-toggle').classList.remove('hidden');
  await switchView('courses');
}

async function switchView(viewName) {
  const btnCourses = document.getElementById('btn-view-courses');
  const btnMethod = document.getElementById('btn-view-method');
  const btnDico = document.getElementById('btn-view-dico');
  
  const secCourses = document.getElementById('section-courses');
  const secMethod = document.getElementById('section-method');
  const secDico = document.getElementById('section-dico');

  btnCourses.classList.remove('active');
  btnMethod.classList.remove('active');
  btnDico.classList.remove('active');
  secCourses.classList.add('hidden');
  secMethod.classList.add('hidden');
  secDico.classList.add('hidden');

  if (viewName === 'courses') {
    btnCourses.classList.add('active');
    secCourses.classList.remove('hidden');
    await renderCourses();
  } else if (viewName === 'method') {
    btnMethod.classList.add('active');
    secMethod.classList.remove('hidden');
    await renderMethods();
  } else {
    btnDico.classList.add('active');
    secDico.classList.remove('hidden');
    await renderDictionary();
  }
}

// --- LIENS ASSOCIÉS COURS ---
function addLinkToForm() {
  const titleInput = document.getElementById('link-title-input');
  const urlInput = document.getElementById('link-url-input');

  if (!titleInput.value.trim() || !urlInput.value.trim()) return alert("Complétez le titre et l'URL du lien.");

  currentCourseLinks.push({ title: titleInput.value.trim(), url: urlInput.value.trim() });
  titleInput.value = '';
  urlInput.value = '';
  renderFormLinksList();
}

function renderFormLinksList() {
  const list = document.getElementById('links-preview-list');
  list.innerHTML = '';
  currentCourseLinks.forEach((link, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${link.title} (${link.url})</span> <button type="button" class="btn-danger" style="padding:2px 6px;" onclick="removeFormLink(${idx})">&times;</button>`;
    list.appendChild(li);
  });
}

function removeFormLink(idx) {
  currentCourseLinks.splice(idx, 1);
  renderFormLinksList();
}

// --- COURS ---
function resetAndShowCourseForm() {
  if (!currentSubject) return alert("Veuillez d'abord sélectionner ou créer une matière.");
  editingCourseId = null;
  currentCourseLinks = [];
  document.getElementById('form-course-title').textContent = "Ajouter un cours";
  document.getElementById('course-title-input').value = '';
  document.getElementById('editor-content').innerHTML = '';
  document.getElementById('image-input').value = '';
  document.getElementById('pdf-input').value = '';
  document.getElementById('audio-input').value = '';
  document.getElementById('video-input').value = '';
  renderFormLinksList();
  document.getElementById('course-form').classList.remove('hidden');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

async function saveCourse() {
  if (!currentSubject) return alert("Sélectionnez d'abord une matière.");

  const titleInput = document.getElementById('course-title-input');
  const editor = document.getElementById('editor-content');

  const title = titleInput.value.trim();
  const htmlContent = editor.innerHTML.trim();

  if (!title || !htmlContent) return alert("Remplissez le titre et le contenu du cours.");

  const data = await getSubjectData(currentSubject);

  const imageInput = document.getElementById('image-input');
  const pdfInput = document.getElementById('pdf-input');
  const audioInput = document.getElementById('audio-input');
  const videoInput = document.getElementById('video-input');

  let imageData = (imageInput.files && imageInput.files[0]) ? await fileToBase64(imageInput.files[0]) : null;
  let pdfData = (pdfInput.files && pdfInput.files[0]) ? await fileToBase64(pdfInput.files[0]) : null;
  let pdfName = (pdfInput.files && pdfInput.files[0]) ? pdfInput.files[0].name : null;
  let audioData = (audioInput.files && audioInput.files[0]) ? await fileToBase64(audioInput.files[0]) : null;
  let videoData = (videoInput.files && videoInput.files[0]) ? await fileToBase64(videoInput.files[0]) : null;

  if (editingCourseId) {
    const course = data.courses.find(c => c.id === editingCourseId);
    if (course) {
      course.title = title;
      course.htmlContent = htmlContent;
      course.links = [...currentCourseLinks];
      if (imageData) course.image = imageData;
      if (pdfData) { course.pdf = pdfData; course.pdfName = pdfName; }
      if (audioData) course.audio = audioData;
      if (videoData) course.video = videoData;
    }
  } else {
    data.courses.push({
      id: Date.now(),
      title: title,
      htmlContent: htmlContent,
      links: [...currentCourseLinks],
      image: imageData,
      pdf: pdfData,
      pdfName: pdfName,
      audio: audioData,
      video: videoData
    });
  }

  await saveSubjectData(currentSubject, data);
  document.getElementById('course-form').classList.add('hidden');
  await renderCourses();
}

async function renderCourses() {
  const container = document.getElementById('courses-list');
  container.innerHTML = '';
  if (!currentSubject) return;

  const data = await getSubjectData(currentSubject);

  if (!data.courses || data.courses.length === 0) {
    container.innerHTML = '<p>Aucun cours enregistré pour le moment.</p>';
    return;
  }

  data.courses.forEach(course => {
    const card = document.createElement('div');
    card.className = 'course-card-compact';
    card.innerHTML = `
      <span class="course-title-click" onclick="openCourseModal(${course.id}, 'course')">📖 ${course.title}</span>
      <div class="card-actions">
        <button class="btn-secondary" onclick="editCourse(${course.id})">✏️ Modifier</button>
        <button class="btn-danger" onclick="deleteCourse(${course.id})">🗑️ Supprimer</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function editCourse(courseId) {
  const data = await getSubjectData(currentSubject);
  const course = data.courses.find(c => c.id === courseId);
  if (!course) return;

  editingCourseId = courseId;
  currentCourseLinks = course.links || [];
  document.getElementById('form-course-title').textContent = "Modifier le cours";
  document.getElementById('course-title-input').value = course.title;
  document.getElementById('editor-content').innerHTML = course.htmlContent;
  renderFormLinksList();
  document.getElementById('course-form').classList.remove('hidden');
}

async function deleteCourse(courseId) {
  if (!confirm("Supprimer ce cours ?")) return;
  const data = await getSubjectData(currentSubject);
  data.courses = data.courses.filter(c => c.id !== courseId);
  await saveSubjectData(currentSubject, data);
  await renderCourses();
}

// --- FICHES MÉTHODES ---
function resetAndShowMethodForm() {
  if (!currentSubject) return alert("Veuillez d'abord sélectionner ou créer une matière.");
  editingMethodId = null;
  document.getElementById('form-method-title').textContent = "Ajouter une fiche méthode";
  document.getElementById('method-title-input').value = '';
  document.getElementById('method-editor-content').innerHTML = '';
  document.getElementById('method-form').classList.remove('hidden');
}

async function saveMethod() {
  if (!currentSubject) return alert("Sélectionnez d'abord une matière.");

  const titleInput = document.getElementById('method-title-input');
  const editor = document.getElementById('method-editor-content');

  const title = titleInput.value.trim();
  const htmlContent = editor.innerHTML.trim();

  if (!title || !htmlContent) return alert("Remplissez le titre et le contenu.");

  const data = await getSubjectData(currentSubject);

  if (editingMethodId) {
    const method = data.methods.find(m => m.id === editingMethodId);
    if (method) {
      method.title = title;
      method.htmlContent = htmlContent;
    }
  } else {
    data.methods.push({
      id: Date.now(),
      title: title,
      htmlContent: htmlContent
    });
  }

  await saveSubjectData(currentSubject, data);
  document.getElementById('method-form').classList.add('hidden');
  await renderMethods();
}

async function renderMethods() {
  const container = document.getElementById('methods-list');
  container.innerHTML = '';
  if (!currentSubject) return;

  const data = await getSubjectData(currentSubject);

  if (!data.methods || data.methods.length === 0) {
    container.innerHTML = '<p>Aucune fiche méthode enregistrée.</p>';
    return;
  }

  data.methods.forEach(method => {
    const card = document.createElement('div');
    card.className = 'course-card-compact';
    card.innerHTML = `
      <span class="course-title-click" onclick="openCourseModal(${method.id}, 'method')">📌 ${method.title}</span>
      <div class="card-actions">
        <button class="btn-secondary" onclick="editMethod(${method.id})">✏️ Modifier</button>
        <button class="btn-danger" onclick="deleteMethod(${method.id})">🗑️ Supprimer</button>
      </div>
    `;
    container.appendChild(card);
  });
}

async function editMethod(methodId) {
  const data = await getSubjectData(currentSubject);
  const method = data.methods.find(m => m.id === methodId);
  if (!method) return;

  editingMethodId = methodId;
  document.getElementById('form-method-title').textContent = "Modifier la fiche méthode";
  document.getElementById('method-title-input').value = method.title;
  document.getElementById('method-editor-content').innerHTML = method.htmlContent;
  document.getElementById('method-form').classList.remove('hidden');
}

async function deleteMethod(methodId) {
  if (!confirm("Supprimer cette méthode ?")) return;
  const data = await getSubjectData(currentSubject);
  data.methods = data.methods.filter(m => m.id !== methodId);
  await saveSubjectData(currentSubject, data);
  await renderMethods();
}

// --- MODALES DE LECTURE ---
async function openCourseModal(id, type = 'course') {
  const data = await getSubjectData(currentSubject);
  const item = type === 'course' 
    ? (data.courses ? data.courses.find(c => c.id === id) : null)
    : (data.methods ? data.methods.find(m => m.id === id) : null);

  if (!item) return;

  document.getElementById('modal-course-title').textContent = item.title;
  document.getElementById('modal-course-body').innerHTML = parseWikiLinks(item.htmlContent, data.dictionary || []);

  let mediaHtml = '';
  if (item.image) mediaHtml += `<br><img src="${item.image}" style="max-width:100%; border-radius:8px;">`;
  if (item.pdf) mediaHtml += `<br><a href="${item.pdf}" download="${item.pdfName || 'document.pdf'}" class="btn-secondary" style="display:inline-block; margin-top:10px;">📄 PDF : ${item.pdfName || 'Télécharger'}</a>`;
  if (item.audio) mediaHtml += `<br><audio controls class="media-player" src="${item.audio}"></audio>`;
  if (item.video) mediaHtml += `<br><video controls class="media-player" src="${item.video}"></video>`;
  document.getElementById('modal-course-media').innerHTML = mediaHtml;

  let linksHtml = '';
  if (item.links && item.links.length > 0) {
    linksHtml = '<ul class="links-list-styled">';
    item.links.forEach(l => {
      linksHtml += `<li><a href="${l.url}" target="_blank">${l.title}</a></li>`;
    });
    linksHtml += '</ul>';
  } else {
    linksHtml = '<p style="color:var(--text-muted); font-size:0.85rem;">Aucun lien joint.</p>';
  }
  document.getElementById('modal-course-links').innerHTML = linksHtml;

  document.getElementById('course-modal').classList.remove('hidden');
}

function closeCourseModal() { 
  document.getElementById('course-modal').classList.add('hidden'); 
}

function parseWikiLinks(html, dictionary) {
  if (!dictionary || dictionary.length === 0) return html;
  let formattedHtml = html;
  const sortedDict = [...dictionary].sort((a, b) => b.term.length - a.term.length);

  sortedDict.forEach(item => {
    const regex = new RegExp(`\\b(${item.term})\\b`, 'gi');
    formattedHtml = formattedHtml.replace(regex, `<span class="wiki-link" onclick="openNotionModal('$1')">$1</span>`);
  });

  return formattedHtml;
}

async function openNotionModal(term) {
  const data = await getSubjectData(currentSubject);
  const item = data.dictionary ? data.dictionary.find(d => d.term.toLowerCase() === term.toLowerCase()) : null;

  document.getElementById('notion-modal-term').textContent = term;
  document.getElementById('notion-modal-def').textContent = item ? item.definition : "Définition non renseignée.";

  const encodedTerm = encodeURIComponent(term);
  document.getElementById('link-robert').href = `https://dictionnaire.lerobert.com/definition/${encodedTerm}`;
  document.getElementById('link-larousse').href = `https://www.larousse.fr/dictionnaires/francais/${encodedTerm}`;
  document.getElementById('link-wiki').href = `https://fr.wikipedia.org/wiki/${encodedTerm}`;

  document.getElementById('notion-modal').classList.remove('hidden');
}

function closeNotionModal() { 
  document.getElementById('notion-modal').classList.add('hidden'); 
}

// --- DICTIONNAIRE ---
async function saveNotion() {
  if (!currentSubject) return alert("Sélectionnez d'abord une matière.");

  const termInput = document.getElementById('notion-term-input');
  const defInput = document.getElementById('notion-def-input');
  const term = termInput.value.trim();
  const definition = defInput.value.trim();

  if (!term || !definition) return alert("Complétez le mot et la définition.");

  const data = await getSubjectData(currentSubject);

  const existingIndex = data.dictionary.findIndex(d => d.term.toLowerCase() === term.toLowerCase());

  if (existingIndex >= 0) {
    data.dictionary[existingIndex].definition = definition;
  } else {
    data.dictionary.push({ term, definition });
  }

  await saveSubjectData(currentSubject, data);
  termInput.value = '';
  defInput.value = '';
  await renderDictionary();
}

async function renderDictionary() {
  const container = document.getElementById('dico-list');
  container.innerHTML = '';
  if (!currentSubject) return;

  const data = await getSubjectData(currentSubject);

  if (!data.dictionary || data.dictionary.length === 0) {
    container.innerHTML = '<p>Aucune notion enregistrée.</p>';
    return;
  }

  data.dictionary.forEach(item => {
    const div = document.createElement('div');
    div.className = 'dico-item';
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:start;">
        <h5>${item.term}</h5>
        <div class="card-actions">
          <button class="btn-secondary" onclick="editNotion('${item.term}')">✏️</button>
          <button class="btn-danger" onclick="deleteNotion('${item.term}')">🗑️</button>
        </div>
      </div>
      <p style="margin-top:0.5rem; color:var(--text-muted);">${item.definition}</p>
    `;
    container.appendChild(div);
  });
}

async function editNotion(term) {
  const data = await getSubjectData(currentSubject);
  const item = data.dictionary ? data.dictionary.find(d => d.term.toLowerCase() === term.toLowerCase()) : null;
  if (!item) return;

  document.getElementById('notion-term-input').value = item.term;
  document.getElementById('notion-def-input').value = item.definition;
}

async function deleteNotion(term) {
  if (!confirm(`Supprimer "${term}" ?`)) return;
  const data = await getSubjectData(currentSubject);
  data.dictionary = data.dictionary.filter(d => d.term.toLowerCase() !== term.toLowerCase());
  await saveSubjectData(currentSubject, data);
  await renderDictionary();
}
