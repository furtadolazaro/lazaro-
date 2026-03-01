const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { db, initializeDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('A variável de ambiente JWT_SECRET é obrigatória para iniciar o servidor.');
}

initializeDatabase();

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'tmp_uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx')
    ) {
      cb(null, true);
      return;
    }
    cb(new Error('Apenas arquivos .xlsx são permitidos.'));
  }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  return jwt.verify(token, JWT_SECRET, (err, admin) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado.' });
    }
    req.admin = admin;
    return next();
  });
}

function onlyChief(req, res, next) {
  if (req.admin.role !== 'chief') {
    return res
      .status(403)
      .json({ error: 'Apenas o admin-chefe pode executar esta ação.' });
  }
  return next();
}

function normalizeHeaders(obj) {
  const normalized = {};
  Object.keys(obj).forEach((key) => {
    normalized[key.toString().trim().toLowerCase()] = obj[key];
  });
  return normalized;
}

app.post('/register-admin', authenticateToken, async (req, res) => {
  try {
    const { nome, email, matricula, senha } = req.body;

    if (!nome || !email || !matricula || !senha) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    db.run(
      `INSERT INTO admins (nome, email, matricula, senha, status, role)
       VALUES (?, ?, ?, ?, 'pendente', 'admin')`,
      [nome.trim(), email.trim().toLowerCase(), matricula.trim(), senhaHash],
      function onInsert(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Email ou matrícula já existe.' });
          }
          return res.status(500).json({ error: 'Erro ao cadastrar novo admin.' });
        }

        return res.status(201).json({
          message: 'Cadastro realizado. Aguardando aprovação do admin-chefe.',
          id: this.lastID
        });
      }
    );
  } catch (error) {
    return res.status(500).json({ error: 'Erro interno ao cadastrar admin.' });
  }
});

app.post('/login', (req, res) => {
  const { matricula, senha } = req.body;

  if (!matricula || !senha) {
    return res.status(400).json({ error: 'Matrícula e senha são obrigatórias.' });
  }

  db.get(
    'SELECT id, nome, email, matricula, senha, status, role FROM admins WHERE matricula = ?',
    [matricula],
    async (err, admin) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao realizar login.' });
      }

      if (!admin) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }

      const senhaValida = await bcrypt.compare(senha, admin.senha);
      if (!senhaValida) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }

      if (admin.status !== 'aprovado') {
        return res
          .status(403)
          .json({ error: 'Seu acesso está pendente de aprovação.' });
      }

      const token = jwt.sign(
        {
          id: admin.id,
          nome: admin.nome,
          matricula: admin.matricula,
          role: admin.role
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      return res.json({
        message: 'Login realizado com sucesso.',
        token,
        admin: {
          id: admin.id,
          nome: admin.nome,
          email: admin.email,
          matricula: admin.matricula,
          role: admin.role,
          status: admin.status
        }
      });
    }
  );
});

app.post('/upload', authenticateToken, upload.single('arquivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo .xlsx é obrigatório.' });
  }

  try {
    const workbook = xlsx.readFile(req.file.path);
    const firstSheet = workbook.SheetNames[0];

    if (!firstSheet) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Planilha sem abas válidas.' });
    }

    const worksheet = workbook.Sheets[firstSheet];
    const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rows.length) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Planilha vazia.' });
    }

    const parsed = rows.map((row) => {
      const normalized = normalizeHeaders(row);
      return {
        egressoDe:
          normalized['você é egresso(a) de:'] ||
          normalized['voce e egresso(a) de:'] ||
          normalized['egresso'] ||
          'Não informado',
        autodeclaracao:
          normalized['como você se autodeclara?'] ||
          normalized['como voce se autodeclara?'] ||
          normalized['autodeclaração'] ||
          normalized['autodeclaracao'] ||
          'Não informado',
        raw: row
      };
    });

    db.run(
      'INSERT INTO uploads (data, status) VALUES (?, ?)',
      [JSON.stringify(parsed), 'pendente'],
      function onInsert(err) {
        fs.unlink(req.file.path, () => {});

        if (err) {
          return res.status(500).json({ error: 'Erro ao salvar upload.' });
        }

        return res.status(201).json({
          message: 'Upload recebido. Aguardando aprovação para publicação.',
          uploadId: this.lastID,
          totalRegistros: parsed.length
        });
      }
    );
  } catch (error) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Erro ao processar planilha.' });
  }
});

app.get('/public-data', (_req, res) => {
  db.all(
    "SELECT id, data FROM uploads WHERE status = 'aprovado' ORDER BY id DESC",
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao buscar dados públicos.' });
      }

      const allEntries = rows.flatMap((row) => {
        try {
          return JSON.parse(row.data);
        } catch (e) {
          return [];
        }
      });

      return res.json({ total: allEntries.length, entries: allEntries });
    }
  );
});

app.get('/uploads', authenticateToken, (_req, res) => {
  db.all('SELECT id, status, created_at FROM uploads ORDER BY id DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao listar uploads.' });
    }

    return res.json(rows);
  });
});

app.post('/approve-upload/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run(
    "UPDATE uploads SET status = 'aprovado', approved_by = ? WHERE id = ?",
    [req.admin.id, id],
    function onUpdate(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao aprovar upload.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Upload não encontrado.' });
      }

      return res.json({ message: 'Upload aprovado e publicado com sucesso.' });
    }
  );
});

app.get('/admins', authenticateToken, (_req, res) => {
  db.all(
    'SELECT id, nome, email, matricula, status, role FROM admins ORDER BY id ASC',
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao listar admins.' });
      }
      return res.json(rows);
    }
  );
});

app.post('/approve-admin/:id', authenticateToken, onlyChief, (req, res) => {
  const { id } = req.params;

  db.run(
    "UPDATE admins SET status = 'aprovado' WHERE id = ?",
    [id],
    function onUpdate(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao aprovar admin.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Admin não encontrado.' });
      }

      return res.json({ message: 'Admin aprovado com sucesso.' });
    }
  );
});

app.use('/frontend', express.static(path.join(__dirname, '..', 'frontend')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

app.get('/', (_req, res) => {
  return res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Erro no upload: ${err.message}` });
  }

  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
