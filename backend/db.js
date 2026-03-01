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

const chiefAdmin = {
  nome: 'lazaro furtado carrilho neto',
  email: 'lfurradocarrilhoneto@gmail.com',
  matricula: '09824649166',
  senha: '@LFCNe2025',
  status: 'aprovado',
  role: 'chief'
};

function initializeDatabase() {
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

    db.get(
      'SELECT id FROM admins WHERE matricula = ?',
      [chiefAdmin.matricula],
      async (err, row) => {
        if (err) {
          console.error('Erro ao buscar admin chefe:', err.message);
          return;
        }

        if (!row) {
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
                console.error('Erro ao criar admin chefe:', insertErr.message);
              } else {
                console.log('Admin-chefe inicial criado com sucesso.');
              }
            }
          );
        }
      }
    );
  });
}

module.exports = {
  db,
  initializeDatabase
};
