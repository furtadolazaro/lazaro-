const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar no SQLite:', err.message);
  } else {
    console.log('Banco SQLite conectado em', dbPath);
  }
});

function getChiefAdminFromEnv() {
  const nome = process.env.CHIEF_ADMIN_NOME;
  const email = process.env.CHIEF_ADMIN_EMAIL;
  const matricula = process.env.CHIEF_ADMIN_MATRICULA;
  const senha = process.env.CHIEF_ADMIN_SENHA;

  if (!nome && !email && !matricula && !senha) {
    return null;
  }

  if (!nome || !email || !matricula || !senha) {
    console.error(
      'Bootstrap do admin-chefe ignorado: defina CHIEF_ADMIN_NOME, CHIEF_ADMIN_EMAIL, CHIEF_ADMIN_MATRICULA e CHIEF_ADMIN_SENHA.'
    );
    return null;
  }

  return {
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    matricula: matricula.trim(),
    senha,
    status: 'aprovado',
    role: 'chief'
  };
}

function ensureChiefAdmin(chiefAdmin) {
  if (!chiefAdmin) {
    return;
  }

  db.get(
    'SELECT id FROM admins WHERE matricula = ? OR email = ?',
    [chiefAdmin.matricula, chiefAdmin.email],
    async (err, row) => {
      if (err) {
        console.error('Erro ao buscar admin-chefe:', err.message);
        return;
      }

      if (!row) {
        try {
          const hash = await bcrypt.hash(chiefAdmin.senha, 10);
          db.run(
            `INSERT INTO admins (nome, email, matricula, senha, status, role)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              chiefAdmin.nome,
              chiefAdmin.email,
              chiefAdmin.matricula,
              hash,
              chiefAdmin.status,
              chiefAdmin.role
            ],
            (insertErr) => {
              if (insertErr) {
                console.error('Erro ao criar admin-chefe via variáveis de ambiente:', insertErr.message);
              } else {
                console.log('Admin-chefe inicial criado com sucesso via variáveis de ambiente.');
              }
            }
          );
        } catch (hashErr) {
          console.error('Erro ao gerar hash para o admin-chefe:', hashErr.message);
        }
      }
    }
  );
}

function initializeDatabase() {
  const chiefAdmin = getChiefAdminFromEnv();

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        matricula TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente',
        role TEXT NOT NULL DEFAULT 'admin'
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        approved_by INTEGER,
        FOREIGN KEY (approved_by) REFERENCES admins(id)
      )
    `);

    ensureChiefAdmin(chiefAdmin);
  });
}

module.exports = {
  db,
  initializeDatabase
};
