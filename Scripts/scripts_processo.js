document.addEventListener("DOMContentLoaded", () => {
  const API_BASE_URL = "http://localhost:3000/api";

  // Variáveis de estado para filtros e paginação de processos
  let currentSearchTerm = "";
  let currentStatus = "Todos";
  let currentPage = 1;

  // Função para carregar a lista de processos do servidor
  async function loadProcessos(
    page = 1,
    search = currentSearchTerm,
    status = currentStatus,
  ) {
    currentPage = page;
    currentSearchTerm = search;
    currentStatus = status;
    try {
      const url = new URL(`${API_BASE_URL}/processos`);
      url.searchParams.append("page", page);
      if (search) {
        url.searchParams.append("search", search);
      }
      if (status && status !== "Todos") {
        url.searchParams.append("status", status);
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao buscar processos");

      const data = await response.json();
      const lista = data.items;
      const tbody = document.querySelector("#processos table tbody");

      if (tbody) {
        tbody.innerHTML = ""; // Limpa a tabela atual

        lista.forEach((proc) => {
          const tr = document.createElement("tr");
          // Define a cor do badge baseada no status
          let badgeClass = "bg-secondary";
          if (proc.status === "Em Andamento") badgeClass = "bg-warning";
          else if (proc.status === "Concluído") badgeClass = "bg-success";
          else if (proc.status === "Suspenso") badgeClass = "bg-danger";

          tr.innerHTML = `
            <td>${proc.numero}</td>
            <td>${proc.tipo}</td>
            <td>${proc.parteInteressada}</td>
            <td><span class="badge ${badgeClass}">${proc.status}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary btn-edit-process me-1" data-id="${proc.id}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger btn-delete-process me-1" data-id="${proc.id}">
                <i class="fas fa-trash"></i>
              </button>
              <button class="btn btn-sm btn-outline-secondary btn-view-process" data-id="${proc.id}" title="Ver Documentos">
                <i class="fas fa-eye"></i>
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });
        // Renderiza a paginação
        renderPagination(data.totalPages, data.currentPage);
      }
    } catch (error) {
      console.error("Erro ao carregar processos:", error);
    }
  }

  // Função para renderizar os controles de paginação
  function renderPagination(totalPages, currentPage) {
    const container = document.getElementById("pagination-container");
    if (!container) return;

    container.innerHTML = ""; // Limpa a paginação anterior

    if (totalPages <= 1) return; // Não mostra paginação se só tem 1 página

    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Navegação de página de processos");
    const ul = document.createElement("ul");
    ul.className = "pagination justify-content-center mb-0";

    let liItems = "";
    // Botão "Anterior"
    liItems += `<li class="page-item ${currentPage === 1 ? "disabled" : ""}">
                  <a class="page-link" href="#" data-page="${
                    currentPage - 1
                  }" aria-label="Anterior">
                    <i class="fas fa-chevron-left"></i>
                  </a>
                </li>`;

    // Botões das páginas
    for (let i = 1; i <= totalPages; i++) {
      liItems += `<li class="page-item ${i === currentPage ? "active" : ""}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                  </li>`;
    }

    // Botão "Próximo"
    liItems += `<li class="page-item ${
      currentPage === totalPages ? "disabled" : ""
    }">
                  <a class="page-link" href="#" data-page="${
                    currentPage + 1
                  }" aria-label="Próximo">
                    <i class="fas fa-chevron-right"></i>
                  </a>
                </li>`;

    ul.innerHTML = liItems;
    nav.appendChild(ul);
    container.appendChild(nav);
  }

  // Carrega os processos assim que a página abre
  if (document.querySelector("#processos table")) {
    loadProcessos();
  }

  // --- Listeners para filtros e paginação ---
  const searchInput = document.getElementById("search-processo");
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("keyup", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const searchTerm = e.target.value;
        // Volta para a primeira página ao fazer uma nova pesquisa
        loadProcessos(1, searchTerm, currentStatus);
      }, 300); // Debounce de 300ms para não sobrecarregar o servidor
    });
  }

  const filterStatus = document.getElementById("filter-status");
  if (filterStatus) {
    filterStatus.addEventListener("change", (e) => {
      const status = e.target.value;
      loadProcessos(1, currentSearchTerm, status);
    });
  }

  const paginationContainer = document.getElementById("pagination-container");
  if (paginationContainer) {
    paginationContainer.addEventListener("click", (e) => {
      e.preventDefault();
      const link = e.target.closest("a.page-link");
      // Não processa o clique se for um item desabilitado
      if (link && !link.parentElement.classList.contains("disabled")) {
        const page = link.getAttribute("data-page");
        if (page) {
          loadProcessos(parseInt(page), currentSearchTerm, currentStatus);
        }
      }
    });
  }

  // --- 1. Botão Novo Processo (POST) ---
  const btnNovoProcesso = document.getElementById("btn-novo-processo");
  if (btnNovoProcesso) {
    btnNovoProcesso.addEventListener("click", () => {
      // Limpa o formulário e abre o modal
      const form = document.getElementById("formNovoProcesso");
      if (form) form.reset();
      document.getElementById("processoId").value = ""; // Limpa o ID para garantir que é um novo cadastro
      document.querySelector("#modalNovoProcesso .modal-title").innerText =
        "Novo Processo";

      const modalEl = document.getElementById("modalNovoProcesso");
      // Recupera instância existente ou cria uma nova para evitar erros
      const modal =
        bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.show();
    });
  }

  // --- Salvar Processo (Botão dentro do Modal) ---
  const btnSalvarProcesso = document.getElementById("btnSalvarProcesso");
  if (btnSalvarProcesso) {
    btnSalvarProcesso.addEventListener("click", async () => {
      const id = document.getElementById("processoId").value;
      const numero = document.getElementById("processoNumero").value;
      const parte = document.getElementById("processoParte").value;
      const tipo = document.getElementById("processoTipo").value;
      const status = document.getElementById("processoStatus").value;

      if (numero && parte) {
        const payload = {
          numero: numero,
          parteInteressada: parte,
          tipo: tipo,
          status: status,
        };

        // Decide se é POST (Novo) ou PUT (Edição)
        const method = id ? "PUT" : "POST";
        const url = id
          ? `${API_BASE_URL}/processos/${id}`
          : `${API_BASE_URL}/processos`;

        try {
          const response = await fetch(url, {
            method: method,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            // Fecha o modal
            const modalEl = document.getElementById("modalNovoProcesso");
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) {
              modal.hide();
            }
            loadProcessos(currentPage, currentSearchTerm, currentStatus); // Recarrega a tabela na página atual
          } else {
            alert("Erro ao salvar processo.");
          }
        } catch (error) {
          console.error("Erro de conexão:", error);
          alert("Não foi possível conectar ao servidor.");
        }
      } else {
        alert(
          "Por favor, preencha o número do processo e a parte interessada.",
        );
      }
    });
  }

  // --- 4. Botões de Visualizar (GET com ID) ---
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-view-process");
    if (btn) {
      const id = btn.getAttribute("data-id");
      window.location.href = `documento.html?processo_id=${id}`;
    }
  });

  // --- 6. Botão Editar Processo (Preencher Modal) ---
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-edit-process");
    if (btn) {
      const id = btn.getAttribute("data-id");

      try {
        // Busca os dados atuais do processo
        const response = await fetch(`${API_BASE_URL}/processos/${id}`);
        if (response.ok) {
          const proc = await response.json();

          // Preenche o modal
          document.getElementById("processoId").value = proc.id;
          document.getElementById("processoNumero").value = proc.numero;
          document.getElementById("processoParte").value =
            proc.parteInteressada;
          document.getElementById("processoTipo").value = proc.tipo;
          document.getElementById("processoStatus").value = proc.status;

          // Ajusta título e abre modal
          document.querySelector("#modalNovoProcesso .modal-title").innerText =
            "Editar Processo";
          const modalEl = document.getElementById("modalNovoProcesso");
          const modal =
            bootstrap.Modal.getInstance(modalEl) ||
            new bootstrap.Modal(modalEl);
          modal.show();
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes para edição:", error);
      }
    }
  });

  // --- 7. Botão Excluir Processo (DELETE) ---
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-delete-process");
    if (btn) {
      const id = btn.getAttribute("data-id");
      if (confirm("Tem certeza que deseja excluir este processo?")) {
        try {
          const response = await fetch(`${API_BASE_URL}/processos/${id}`, {
            method: "DELETE",
          });

          if (response.ok) {
            loadProcessos(currentPage, currentSearchTerm, currentStatus); // Recarrega a tabela
          } else {
            alert("Erro ao excluir processo.");
          }
        } catch (error) {
          console.error("Erro ao excluir:", error);
        }
      }
    }
  });
});
