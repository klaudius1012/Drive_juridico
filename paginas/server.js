const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = 3000;

// Configuração do CORS (permite que o front-end acesse o back-end)
app.use(cors());
// Configuração para entender JSON no corpo das requisições
app.use(express.json());

// --- Configuração de Arquivos Estáticos (Front-end) ---
// Permite que o servidor entregue o CSS e os Scripts corretamente
app.use("/CSS", express.static(path.join(__dirname, "../CSS")));
app.use("/scripts", express.static(path.join(__dirname, "../Scripts")));
app.use(express.static(__dirname)); // Serve arquivos da pasta 'paginas' (onde está o intranet.html)
app.use("/uploads", express.static(path.join(__dirname, "../uploads"))); // Serve os arquivos enviados

// Rota principal: Ao acessar http://localhost:3000/, entrega o dashboard.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

// Configuração do Multer para Uploads
// Cria a pasta 'uploads' se não existir
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Adiciona timestamp para evitar nomes duplicados
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// --- Configuração do Banco de Dados SQLite ---
const dbPath = path.join(__dirname, "../BD/database.db");
// Garantir que a pasta BD existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados:", err.message);
  } else {
    console.log("Conectado ao banco de dados SQLite.");
    
    // Garante a execução sequencial para evitar erros de tabela não encontrada
    db.serialize(() => {
      // Criar tabelas se não existirem
      db.run(`CREATE TABLE IF NOT EXISTS processos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT,
        tipo TEXT,
        parteInteressada TEXT,
        status TEXT
      )`);
      db.run(`CREATE TABLE IF NOT EXISTS financeiro (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descricao TEXT,
        valor REAL,
        tipo TEXT,
        data TEXT
      )`);
      db.run(`CREATE TABLE IF NOT EXISTS documentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        data TEXT,
        tipo TEXT DEFAULT 'arquivo',
        parent_id INTEGER,
        processo_id INTEGER
      )`);

      // Migração para adicionar colunas em bancos existentes (com log de erro)
      const runMigration = (sql) => {
        db.run(sql, (err) => {
          if (err && !err.message.includes("duplicate column")) {
            console.error("Erro na migração:", err.message);
          }
        });
      };

      runMigration("ALTER TABLE documentos ADD COLUMN tipo TEXT DEFAULT 'arquivo'");
      runMigration("ALTER TABLE documentos ADD COLUMN parent_id INTEGER");
      runMigration("ALTER TABLE documentos ADD COLUMN processo_id INTEGER");

      // Tabela de Usuários
      db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE,
        senha TEXT
      )`, () => {
        // Cria usuário admin padrão se não existir
        db.get("SELECT count(*) as count FROM usuarios", (err, row) => {
          if (row && row.count === 0) {
            db.run("INSERT INTO usuarios (usuario, senha) VALUES (?, ?)", ["admin", "1234"]);
            console.log("Usuário padrão 'admin' criado (senha: 1234).");
          }
        });
      });
    });
  }
});

// --- Rotas da API ---

// 1. POST /api/processos - Cadastrar novo processo
app.post("/api/processos", (req, res) => {
  const { numero, tipo, parteInteressada, status } = req.body;
  const sql = `INSERT INTO processos (numero, tipo, parteInteressada, status) VALUES (?, ?, ?, ?)`;

  db.run(sql, [numero, tipo, parteInteressada, status], function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    const processoId = this.lastID;
    console.log("Novo Processo Cadastrado ID:", processoId);

    if (!processoId) {
      return res.status(500).json({ error: "Falha ao obter ID do processo." });
    }

    // Cria automaticamente uma pasta para o processo na raiz dos documentos
    const nomePasta = `Processo ${numero} - ${parteInteressada}`;
    const dataPasta = new Date().toISOString();
    const sqlPasta = `INSERT INTO documentos (nome, data, tipo, parent_id, processo_id) VALUES (?, ?, ?, ?, ?)`;

    db.run(sqlPasta, [nomePasta, dataPasta, 'pasta', null, processoId], function (errPasta) {
      if (errPasta) {
        console.error("Erro ao criar pasta do processo:", errPasta.message);
        return res.status(500).json({ error: "Processo criado, mas falha ao criar pasta associada." });
      }
      res.status(201).json({
        message: "Processo e pasta criados com sucesso",
        data: { id: processoId, numero, tipo, parteInteressada, status },
      });
    });
  });
});

// 1.1. PUT /api/processos/:id - Atualizar processo existente
app.put("/api/processos/:id", (req, res) => {
  const id = req.params.id;
  const { numero, tipo, parteInteressada, status } = req.body;
  const sql = `UPDATE processos SET numero = ?, tipo = ?, parteInteressada = ?, status = ? WHERE id = ?`;

  db.run(sql, [numero, tipo, parteInteressada, status, id], function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    // --- MELHORIA: Atualiza também o nome da pasta vinculada ---
    const novoNomePasta = `Processo ${numero} - ${parteInteressada}`;
    const sqlUpdatePasta = `UPDATE documentos SET nome = ? WHERE processo_id = ? AND tipo = 'pasta'`;
    db.run(sqlUpdatePasta, [novoNomePasta, id], (errPasta) => {
      if (errPasta)
        console.error("Erro ao renomear pasta do processo:", errPasta.message);
    });

    res.json({
      message: "Processo atualizado com sucesso",
      changes: this.changes,
    });
  });
});

// 1.2. DELETE /api/processos/:id - Excluir processo
app.delete("/api/processos/:id", (req, res) => {
  const processoId = req.params.id;

  const deleteProcessRecord = () => {
    const sql = "DELETE FROM processos WHERE id = ?";
    db.run(sql, [processoId], function (procErr) {
      if (procErr) {
        return res.status(400).json({ error: procErr.message });
      }
      res.json({
        message: "Processo e documentos associados foram excluídos",
        changes: this.changes,
      });
    });
  };

  // Primeiro, encontre e exclua a pasta de documentos associada e seu conteúdo
  const findFolderSql =
    "SELECT id FROM documentos WHERE processo_id = ? AND parent_id IS NULL";
  db.get(findFolderSql, [processoId], async (err, folder) => {
    if (err) {
      console.error("Erro ao encontrar pasta do processo:", err.message);
      return deleteProcessRecord(); // Tenta excluir o processo mesmo assim
    }

    if (folder) {
      try {
        const descendants = await getDescendants(folder.id);
        const allIdsToDelete = [
          folder.id,
          ...descendants.folderIds,
          ...descendants.files.map((f) => f.id),
        ];

        if (allIdsToDelete.length > 0) {
          const placeholders = allIdsToDelete.map(() => "?").join(",");
          db.run(
            `DELETE FROM documentos WHERE id IN (${placeholders})`,
            allIdsToDelete,
            deleteProcessRecord,
          );
        } else {
          deleteProcessRecord();
        }
      } catch (delErr) {
        console.error("Falha ao excluir documentos associados:", delErr);
        deleteProcessRecord();
      }
    } else {
      // Nenhuma pasta encontrada, apenas exclui o registro do processo
      deleteProcessRecord();
    }
  });
});

// 2. POST /api/financeiro - Registrar transação
app.post("/api/financeiro", (req, res) => {
  const { descricao, valor, tipo, data } = req.body;
  const sql = `INSERT INTO financeiro (descricao, valor, tipo, data) VALUES (?, ?, ?, ?)`;

  db.run(sql, [descricao, valor, tipo, data], function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    console.log("Nova Transação Financeira ID:", this.lastID);
    res.status(201).json({
      message: "Transação registrada com sucesso",
      data: { id: this.lastID, descricao, valor, tipo, data },
    });
  });
});

// 3. POST /api/upload - Upload de arquivos
app.post("/api/upload", upload.single("arquivo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Nenhum arquivo enviado" });
  }

  const nomeArquivo = req.file.filename;
  const parent_id = req.body.parent_id || null;
  const processo_id = req.body.processo_id || null;
  const dataUpload = new Date().toISOString();
  const sql = `INSERT INTO documentos (nome, data, tipo, parent_id, processo_id) VALUES (?, ?, 'arquivo', ?, ?)`;

  db.run(
    sql,
    [nomeArquivo, dataUpload, parent_id, processo_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.status(200).json({
        message: "Upload realizado com sucesso",
        id: this.lastID,
        filename: nomeArquivo,
      });
    },
  );
});

// 4.1 GET /api/processos/all - Listar todos os processos para dropdown
app.get("/api/processos/all", (req, res) => {
  const sql =
    "SELECT id, numero, parteInteressada FROM processos ORDER BY numero";
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 4. GET /api/processos/:id - Detalhes do processo (Simulação)
app.get("/api/processos/:id", (req, res) => {
  const id = req.params.id;
  const sql = "SELECT * FROM processos WHERE id = ?";
  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: "Processo não encontrado" });
    }
    res.json(row);
  });
});

// 5. GET /api/processos - Listar todos os processos com paginação
app.get("/api/processos", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const status = req.query.status || "Todos";
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push("(numero LIKE ? OR parteInteressada LIKE ?)");
    params.push(`%${search}%`);
    params.push(`%${search}%`);
  }

  if (status && status !== "Todos") {
    conditions.push("status = ?");
    params.push(status);
  }

  const whereClause =
    conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const sqlCount = `SELECT COUNT(*) as total FROM processos ${whereClause}`;
  db.get(sqlCount, params, (err, countRow) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const totalItems = countRow.total;
    const totalPages = Math.ceil(totalItems / limit);

    const sqlSelect = `SELECT * FROM processos ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const selectParams = [...params, limit, offset];

    db.all(sqlSelect, selectParams, (err, rows) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res
        .status(200)
        .json({ items: rows, totalItems, totalPages, currentPage: page });
    });
  });
});

// 6. GET /api/financeiro - Listar transações financeiras
app.get("/api/financeiro", (req, res) => {
  const sql = "SELECT * FROM financeiro ORDER BY data ASC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.status(200).json(rows);
  });
});

// 7. DELETE /api/financeiro/:id - Excluir transação
app.delete("/api/financeiro/:id", (req, res) => {
  const id = req.params.id;
  const sql = "DELETE FROM financeiro WHERE id = ?";
  db.run(sql, [id], function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ message: "Transação excluída", changes: this.changes });
  });
});

// 8. GET /api/dashboard/cards - Dados resumidos para os cards
app.get("/api/dashboard/cards", (req, res) => {
  const response = { processosAtivos: 0, receitaMensal: 0, despesaMensal: 0 };

  // 1. Contar Processos Ativos (Em Andamento)
  db.get(
    "SELECT COUNT(*) as count FROM processos WHERE status = 'Em Andamento'",
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      response.processosAtivos = row ? row.count : 0;

      // 2. Somar Receitas e Despesas do Mês Atual (usando string ISO YYYY-MM)
      const currentMonth = new Date().toISOString().slice(0, 7);

      const sqlFinanceiro = `
      SELECT tipo, SUM(valor) as total 
      FROM financeiro 
      WHERE strftime('%Y-%m', data) = ? 
      GROUP BY tipo
    `;

      db.all(sqlFinanceiro, [currentMonth], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        rows.forEach((r) => {
          if (r.tipo === "Receita") response.receitaMensal = r.total;
          if (r.tipo === "Despesa") response.despesaMensal = r.total;
        });

        res.json(response);
      });
    },
  );
});

// 9. GET /api/dashboard/grafico-processos - Dados para o gráfico de rosca
app.get("/api/dashboard/grafico-processos", (req, res) => {
  const sql = "SELECT status, COUNT(*) as count FROM processos GROUP BY status";
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 10. GET /api/documentos - Listar documentos
app.get("/api/documentos", (req, res) => {
  const parent_id = req.query.parent_id;
  const processo_id = req.query.processo_id;

  if (processo_id) {
    // Se um processo_id é fornecido (vindo da página de processos),
    // encontramos a pasta raiz desse processo e listamos seu conteúdo.
    const findFolderSql =
      "SELECT id FROM documentos WHERE processo_id = ? AND parent_id IS NULL";
    db.get(findFolderSql, [processo_id], (err, folder) => {
      if (err) return res.status(500).json({ error: err.message });

      // Se nenhuma pasta for encontrada, retorna uma lista vazia.
      const folderId = folder ? folder.id : -1; // -1 para garantir que a consulta não retorne nada

      const findContentsSql =
        "SELECT * FROM documentos WHERE parent_id = ? ORDER BY tipo DESC, nome ASC";
      db.all(findContentsSql, [folderId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json(rows);
      });
    });
  } else {
    // Comportamento padrão para navegar pelas pastas na página de documentos.
    const sql =
      parent_id && parent_id !== "null"
        ? "SELECT * FROM documentos WHERE parent_id = ? ORDER BY tipo DESC, nome ASC"
        : "SELECT * FROM documentos WHERE parent_id IS NULL ORDER BY tipo DESC, nome ASC";
    const params = parent_id && parent_id !== "null" ? [parent_id] : [];

    db.all(sql, params, (err, rows) => {
      if (err) return res.status(400).json({ error: err.message });
      res.status(200).json(rows);
    });
  }
});

// 10.1 POST /api/documentos/pasta - Criar Pasta
app.post("/api/documentos/pasta", (req, res) => {
  const { nome, parent_id } = req.body;
  const data = new Date().toISOString();
  const sql =
    "INSERT INTO documentos (nome, data, tipo, parent_id) VALUES (?, ?, 'pasta', ?)";
  db.run(sql, [nome, data, parent_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Pasta criada", id: this.lastID });
  });
});

// Helper function for recursive deletion
const getDescendants = (folderId) => {
  return new Promise((resolve, reject) => {
    let files = [];
    let folderIds = [];

    const find = (id) => {
      return new Promise((res, rej) => {
        db.all(
          "SELECT id, nome, tipo FROM documentos WHERE parent_id = ?",
          [id],
          async (err, children) => {
            if (err) return rej(err);

            for (const child of children) {
              if (child.tipo === "pasta") {
                folderIds.push(child.id);
                await find(child.id); // Recurse
              } else {
                files.push(child);
              }
            }
            res();
          },
        );
      });
    };

    find(folderId)
      .then(() => resolve({ files, folderIds }))
      .catch(reject);
  });
};

// 11. DELETE /api/documentos/:id - Excluir documento ou pasta (recursivamente)
app.delete("/api/documentos/:id", (req, res) => {
  const idToDelete = req.params.id;

  db.get(
    "SELECT id, nome, tipo FROM documentos WHERE id = ?",
    [idToDelete],
    async (err, doc) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!doc) return res.status(404).json({ error: "Item não encontrado." });

      if (doc.tipo === "arquivo") {
        // É um arquivo simples
        const filePath = path.join(uploadDir, doc.nome);
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr)
            console.error(
              `Falha ao deletar arquivo físico ${filePath}:`,
              unlinkErr,
            );
          // Continua para deletar do DB mesmo se o arquivo físico não existir
          db.run(
            "DELETE FROM documentos WHERE id = ?",
            [idToDelete],
            function (dbErr) {
              if (dbErr) return res.status(500).json({ error: dbErr.message });
              res.json({ message: "Arquivo excluído com sucesso." });
            },
          );
        });
      } else {
        // É uma pasta, fazer exclusão recursiva
        try {
          const descendants = await getDescendants(idToDelete);

          // 1. Deletar todos os arquivos físicos
          const unlinkPromises = descendants.files.map((file) => {
            return new Promise((resolve) => {
              const filePath = path.join(uploadDir, file.nome);
              fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr)
                  console.error(
                    `Falha ao deletar arquivo físico ${filePath}:`,
                    unlinkErr,
                  );
                resolve();
              });
            });
          });
          await Promise.all(unlinkPromises);

          // 2. Deletar todos os registros do DB (pasta principal + subpastas + arquivos)
          const allIdsToDelete = [
            idToDelete,
            ...descendants.folderIds,
            ...descendants.files.map((f) => f.id),
          ];
          if (allIdsToDelete.length > 0) {
            const placeholders = allIdsToDelete.map(() => "?").join(",");
            db.run(
              `DELETE FROM documentos WHERE id IN (${placeholders})`,
              allIdsToDelete,
              function (dbErr) {
                if (dbErr)
                  return res.status(500).json({ error: dbErr.message });
                res.json({
                  message: "Pasta e seu conteúdo foram excluídos com sucesso.",
                });
              },
            );
          } else {
            res.json({ message: "Pasta vazia excluída com sucesso." });
          }
        } catch (error) {
          console.error("Erro na exclusão recursiva:", error);
          res
            .status(500)
            .json({ error: "Falha ao excluir a pasta e seu conteúdo." });
        }
      }
    },
  );
});

// 11.1 PUT /api/documentos/:id/rename - Renomear arquivo/pasta
app.put("/api/documentos/:id/rename", (req, res) => {
  const { id } = req.params;
  const { novo_nome } = req.body;

  if (!novo_nome || novo_nome.trim() === "") {
    return res.status(400).json({ error: "O novo nome não pode ser vazio." });
  }

  // 1. Get current document info
  db.get("SELECT * FROM documentos WHERE id = ?", [id], (err, doc) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!doc)
      return res.status(404).json({ error: "Documento não encontrado." });

    const updateDb = (nomeFinal) => {
      const sql = "UPDATE documentos SET nome = ? WHERE id = ?";
      db.run(sql, [nomeFinal || novo_nome, id], function (dbErr) {
        if (dbErr) return res.status(500).json({ error: dbErr.message });
        res.json({ message: "Renomeado com sucesso." });
      });
    };

    // 2. If it's a file, rename on filesystem first
    if (doc.tipo === "arquivo") {
      // --- CORREÇÃO: Preserva a extensão original do arquivo ---
      const ext = path.extname(doc.nome);
      let nomeFinal = novo_nome;
      if (ext && !nomeFinal.endsWith(ext)) {
        nomeFinal += ext;
      }

      const oldPath = path.join(uploadDir, doc.nome);
      const newPath = path.join(uploadDir, nomeFinal);

      if (fs.existsSync(oldPath)) {
        fs.rename(oldPath, newPath, (renameErr) => {
          if (renameErr)
            return res
              .status(500)
              .json({ error: "Falha ao renomear o arquivo físico." });
          updateDb(nomeFinal); // Atualiza o banco com o nome contendo a extensão
        });
      } else {
        console.warn(
          `Arquivo físico não encontrado para renomear: ${oldPath}. Renomeando apenas no banco de dados.`,
        );
        updateDb();
      }
    } else {
      // 3. If it's a folder, just update the DB
      updateDb();
    }
  });
});

// 12. POST /api/login - Autenticação de usuário
app.post("/api/login", (req, res) => {
  const { usuario, senha } = req.body;

  // Nota: Em produção, recomenda-se usar hash de senha (ex: bcrypt)
  const sql = "SELECT * FROM usuarios WHERE usuario = ? AND senha = ?";

  db.get(sql, [usuario, senha], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      res.json({ message: "Login realizado com sucesso", user: row.usuario });
    } else {
      res.status(401).json({ message: "Usuário ou senha inválidos" });
    }
  });
});

// 13. POST /api/usuarios - Cadastrar novo usuário
app.post("/api/usuarios", (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha) {
    return res.status(400).json({ error: "Usuário e senha são obrigatórios." });
  }

  const sql = "INSERT INTO usuarios (usuario, senha) VALUES (?, ?)";
  db.run(sql, [usuario, senha], function (err) {
    if (err)
      return res
        .status(500)
        .json({ error: "Erro ao criar usuário. Talvez o nome já exista." });
    res
      .status(201)
      .json({ message: "Usuário criado com sucesso", id: this.lastID });
  });
});

// 14. GET /api/usuarios - Listar todos os usuários
app.get("/api/usuarios", (req, res) => {
  // Excluir a senha da consulta por segurança
  const sql = "SELECT id, usuario FROM usuarios ORDER BY usuario";
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 15. DELETE /api/usuarios/:id - Excluir um usuário
app.delete("/api/usuarios/:id", (req, res) => {
  const { id } = req.params;

  // Medida de segurança: não permitir excluir o usuário 'admin' (ID 1)
  if (id === "1") {
    return res.status(403).json({
      error: "Não é permitido excluir o usuário administrador principal.",
    });
  }

  const sql = "DELETE FROM usuarios WHERE id = ?";
  db.run(sql, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0)
      return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ message: "Usuário excluído com sucesso." });
  });
});

// Iniciar Servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log(`API disponível em http://localhost:${port}/api`);
});
