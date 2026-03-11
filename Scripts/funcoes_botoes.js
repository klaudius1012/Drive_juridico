document.addEventListener("DOMContentLoaded", () => {
  // URL base do seu backend Node.js
  const API_BASE_URL = "http://localhost:3000/api";

  // Função para carregar a tabela financeira
  async function loadFinanceiroTable() {
    try {
      const response = await fetch(`${API_BASE_URL}/financeiro`);
      if (!response.ok) throw new Error("Erro ao buscar transações");

      const lista = await response.json();
      const tbody = document.querySelector("#financeiro table tbody");

      if (tbody) {
        tbody.innerHTML = ""; // Limpa a tabela atual

        lista.forEach((item) => {
          const tr = document.createElement("tr");

          // Formatação
          const dataFormatada = new Date(item.data).toLocaleDateString("pt-BR");
          const valorFormatado = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(item.valor);
          const isReceita = item.tipo === "Receita";
          const textClass = isReceita ? "text-success" : "text-danger";
          const iconClass = isReceita ? "fa-arrow-up" : "fa-arrow-down";

          tr.innerHTML = `
            <td>${dataFormatada}</td>
            <td>${item.descricao}</td>
            <td class="${textClass}"><i class="fas ${iconClass}"></i> ${item.tipo}</td>
            <td>${valorFormatado}</td>
            <td>
              <button class="btn btn-sm btn-outline-danger btn-delete-transacao" data-id="${item.id}">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    } catch (error) {
      console.error("Erro ao carregar financeiro:", error);
    }
  }

  if (document.querySelector("#financeiro table")) {
    loadFinanceiroTable();
  }

  // --- 2. Botão Nova Transação (POST) ---
  const btnNovaTransacao = document.getElementById("btn-nova-transacao");
  if (btnNovaTransacao) {
    btnNovaTransacao.addEventListener("click", () => {
      // Limpa o formulário e abre o modal
      document.getElementById("formNovaTransacao").reset();
      const modalEl = document.getElementById("modalNovaTransacao");
      // Recupera instância existente ou cria uma nova para evitar erros
      const modal =
        bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.show();
    });
  }

  // --- Salvar Transação (Botão dentro do Modal) ---
  const btnSalvarTransacao = document.getElementById("btnSalvarTransacao");
  if (btnSalvarTransacao) {
    btnSalvarTransacao.addEventListener("click", async () => {
      const descricao = document.getElementById("transacaoDescricao").value;
      const valor = document.getElementById("transacaoValor").value;
      const tipo = document.getElementById("transacaoTipo").value;

      if (descricao && valor) {
        try {
          const response = await fetch(`${API_BASE_URL}/financeiro`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              descricao,
              valor: parseFloat(valor),
              tipo: tipo,
              data: new Date().toISOString(),
            }),
          });

          if (response.ok) {
            alert("Transação registrada com sucesso!");

            // Fecha o modal
            const modalElement = document.getElementById("modalNovaTransacao");
            const modalInstance =
              bootstrap.Modal.getInstance(modalElement) ||
              new bootstrap.Modal(modalElement);
            if (modalInstance) {
              modalInstance.hide();
            }

            loadFinanceiroTable(); // Recarrega a tabela
          } else {
            alert("Erro ao registrar transação.");
          }
        } catch (error) {
          console.error("Erro:", error);
        }
      } else {
        alert("Por favor, preencha todos os campos.");
      }
    });
  }

  // --- 5. Botão Excluir Transação (DELETE) ---
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-delete-transacao");
    if (btn) {
      const id = btn.getAttribute("data-id");
      if (confirm("Tem certeza que deseja excluir esta transação?")) {
        try {
          const response = await fetch(`${API_BASE_URL}/financeiro/${id}`, {
            method: "DELETE",
          });

          if (response.ok) {
            loadFinanceiroTable(); // Recarrega a tabela
          } else {
            alert("Erro ao excluir transação.");
          }
        } catch (error) {
          console.error("Erro ao excluir:", error);
        }
      }
    }
  });
});
