const API_BASE = window.location.origin;

function getToken() {
  return localStorage.getItem('profept_token');
}

function getAdmin() {
  const raw = localStorage.getItem('profept_admin');
  return raw ? JSON.parse(raw) : null;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`
  };
}

function logout() {
  localStorage.removeItem('profept_token');
  localStorage.removeItem('profept_admin');
  window.location.href = '/admin/login.html';
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Erro na requisição.');
  }

  return data;
}

async function handleLoginPage() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const message = document.getElementById('loginMessage');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const matricula = document.getElementById('matricula').value.trim();
    const senha = document.getElementById('senha').value;

    try {
      const result = await apiRequest('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula, senha })
      });

      localStorage.setItem('profept_token', result.token);
      localStorage.setItem('profept_admin', JSON.stringify(result.admin));
      message.textContent = 'Login realizado com sucesso. Redirecionando...';
      window.location.href = '/admin/panel.html';
    } catch (error) {
      message.textContent = error.message;
    }
  });
}

function ensurePanelAuth() {
  const panel = document.getElementById('adminWelcome');
  if (!panel) return null;

  const token = getToken();
  const admin = getAdmin();

  if (!token || !admin) {
    logout();
    return null;
  }

  panel.textContent = `Olá, ${admin.nome} (${admin.role})`;
  return admin;
}

function statusBadge(status) {
  return `<span class="badge ${status}">${status}</span>`;
}

async function loadUploads() {
  const list = document.getElementById('uploadsList');
  if (!list) return;

  list.innerHTML = 'Carregando uploads...';

  try {
    const uploads = await apiRequest('/uploads', { headers: authHeaders() });

    if (!uploads.length) {
      list.innerHTML = '<p>Nenhum upload enviado até o momento.</p>';
      return;
    }

    list.innerHTML = uploads
      .map(
        (upload) => `
        <div class="list-item">
          <div>
            <strong>Upload #${upload.id}</strong><br />
            <small>Enviado em: ${new Date(upload.created_at).toLocaleString('pt-BR')}</small><br />
            ${statusBadge(upload.status)}
          </div>
          ${
            upload.status !== 'aprovado'
              ? `<button data-approve-upload="${upload.id}">Aprovar e Publicar</button>`
              : '<small>Já publicado</small>'
          }
        </div>
      `
      )
      .join('');
  } catch (error) {
    list.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadAdmins() {
  const list = document.getElementById('adminsList');
  if (!list) return;

  list.innerHTML = 'Carregando admins...';

  try {
    const admins = await apiRequest('/admins', { headers: authHeaders() });
    const current = getAdmin();

    list.innerHTML = admins
      .map(
        (admin) => `
          <div class="list-item">
            <div>
              <strong>${admin.nome}</strong><br />
              <small>${admin.email} | Matrícula: ${admin.matricula}</small><br />
              <small>Perfil: ${admin.role}</small> ${statusBadge(admin.status)}
            </div>
            ${
              current?.role === 'chief' && admin.status === 'pendente'
                ? `<button data-approve-admin="${admin.id}">Aprovar admin</button>`
                : '<small>Sem ação</small>'
            }
          </div>
        `
      )
      .join('');
  } catch (error) {
    list.innerHTML = `<p>${error.message}</p>`;
  }
}

async function handlePanelPage() {
  const admin = ensurePanelAuth();
  if (!admin) return;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  const uploadForm = document.getElementById('uploadForm');
  const uploadMessage = document.getElementById('uploadMessage');

  uploadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];

    if (!file) {
      uploadMessage.textContent = 'Selecione um arquivo .xlsx.';
      return;
    }

    const formData = new FormData();
    formData.append('arquivo', file);

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      uploadMessage.textContent = `${result.message} Registros: ${result.totalRegistros}.`;
      uploadForm.reset();
      loadUploads();
    } catch (error) {
      uploadMessage.textContent = error.message;
    }
  });

  document.getElementById('reloadUploads')?.addEventListener('click', loadUploads);
  document.getElementById('reloadAdmins')?.addEventListener('click', loadAdmins);

  document.getElementById('uploadsList')?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const uploadId = target.getAttribute('data-approve-upload');
    if (!uploadId) return;

    try {
      await apiRequest(`/approve-upload/${uploadId}`, {
        method: 'POST',
        headers: authHeaders()
      });
      loadUploads();
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById('adminsList')?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const adminId = target.getAttribute('data-approve-admin');
    if (!adminId) return;

    try {
      await apiRequest(`/approve-admin/${adminId}`, {
        method: 'POST',
        headers: authHeaders()
      });
      loadAdmins();
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById('newAdminForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      nome: document.getElementById('newNome').value.trim(),
      email: document.getElementById('newEmail').value.trim(),
      matricula: document.getElementById('newMatricula').value.trim(),
      senha: document.getElementById('newSenha').value
    };

    try {
      await apiRequest('/register-admin', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      event.target.reset();
      loadAdmins();
      alert('Novo admin cadastrado com status pendente.');
    } catch (error) {
      alert(error.message);
    }
  });

  await Promise.all([loadUploads(), loadAdmins()]);
}

handleLoginPage();
handlePanelPage();
