# ProfEPT IF Goiano - Campus Ceres (Sistema Web Institucional)

Aplicação full-stack pronta para produção com:

- Página pública institucional (one page)
- Upload de planilhas Excel (.xlsx)
- Persistência em SQLite
- Fluxo de aprovação de uploads
- Exibição pública apenas de dados aprovados
- Painel administrativo com controle de usuários

## Estrutura do projeto

```txt
/backend
  server.js
  db.js
  package.json
/frontend
  index.html
  styles.css
  script.js
/admin
  login.html
  panel.html
  admin.css
  admin.js
```

## Tecnologias

- Backend: Node.js, Express, SQLite, Multer, XLSX, bcrypt, CORS, JWT
- Frontend: HTML5, CSS3 (Flexbox/Grid), JavaScript puro, Chart.js

## Como executar localmente

### 1) Instalar dependências

```bash
cd backend
npm install
```

### 2) Iniciar servidor

```bash
node server.js
```

Servidor padrão: `http://localhost:3000`

- Página pública: `http://localhost:3000/`
- Login admin: `http://localhost:3000/admin/login.html`

## Bootstrap opcional do admin-chefe

Para criar um admin-chefe inicial de forma segura em ambientes novos, defina **todas** as variáveis abaixo antes de iniciar o backend:

- `CHIEF_ADMIN_NOME`
- `CHIEF_ADMIN_EMAIL`
- `CHIEF_ADMIN_MATRICULA`
- `CHIEF_ADMIN_SENHA`

Se qualquer uma estiver ausente, nenhum admin-chefe é criado automaticamente.

## API principal

- `POST /login`
- `POST /register-admin`
- `POST /upload`
- `GET /public-data`
- `GET /uploads`
- `POST /approve-upload/:id`
- `GET /admins`
- `POST /approve-admin/:id`

## Deploy no Render (gratuito)

### Opção 1: Sem Docker (Web Service)

1. Suba este projeto para um repositório Git.
2. Crie um **Web Service** no Render apontando para o repositório.
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Variáveis de ambiente:
   - `JWT_SECRET` (obrigatório para iniciar o servidor)
   - `PORT` é gerenciada automaticamente pelo Render

### Opção 2: Usando `render.yaml`

Este repositório inclui arquivo `render.yaml` para deploy Blueprint.

## Observações de produção

- Defina `JWT_SECRET` com um valor forte e único por ambiente.
- O SQLite é salvo em arquivo local (`backend/database.sqlite`).
- Em plano gratuito, ao reiniciar a instância os dados podem ser perdidos dependendo do ambiente; para persistência crítica use banco gerenciado.
