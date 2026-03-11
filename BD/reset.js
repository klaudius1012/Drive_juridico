const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbPath = path.join(__dirname, "../BD/database.db");
const uploadDir = path.join(__dirname, "../uploads");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error("Erro ao conectar ao banco de dados:", err.message);
  }
  console.log("Conectado ao banco de dados SQLite para reset.");
});

const tablesToReset = ["processos", "financeiro", "documentos", "usuarios"];

db.serialize(() => {
  console.log("Iniciando a limpeza das tabelas...");

  tablesToReset.forEach((table) => {
    // 1. Apaga todos os registros da tabela
    db.run(`DELETE FROM ${table}`, function (err) {
      if (err) {
        return console.error(`Erro ao limpar a tabela ${table}:`, err.message);
      }
      console.log(`Tabela "${table}" limpa. Linhas afetadas: ${this.changes}`);
    });

    // 2. Reseta o contador de autoincremento
    db.run(`DELETE FROM sqlite_sequence WHERE name='${table}'`, function (err) {
      if (err) {
        // Não retorna erro se a tabela não usa autoincremento
        if (!err.message.includes("no such table")) {
          console.error(
            `Erro ao resetar o autoincremento da tabela ${table}:`,
            err.message,
          );
        }
      } else {
        console.log(`Autoincremento da tabela "${table}" resetado.`);
      }
    });
  });

  // 3. Limpa a pasta de uploads
  fs.readdir(uploadDir, (err, files) => {
    if (err)
      return console.error("Não foi possível ler a pasta de uploads:", err);

    for (const file of files) {
      fs.unlink(path.join(uploadDir, file), (err) => {
        if (err) console.error(`Erro ao deletar o arquivo ${file}:`, err);
      });
    }
    console.log("Pasta de uploads limpa.");
  });

  // Fecha a conexão com o banco de dados
  db.close((err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log("Conexão com o banco de dados fechada. Reset concluído!");
  });
});
