document.addEventListener("DOMContentLoaded", () => {
  const API_BASE_URL = "http://localhost:3000/api";
  const listaDocumentosContainer = document.getElementById("lista-documentos");
  const breadcrumbContainer = document.getElementById("breadcrumb-container");

  // Modals
  const modalNovaPasta = new bootstrap.Modal(
    document.getElementById("modalNovaPasta"),
  );
  const modalUpload = new bootstrap.Modal(
    document.getElementById("modalUpload"),
  );
  const modalRenomear = new bootstrap.Modal(
    document.getElementById("modalRenomear"),
  );

  // Função para obter parâmetros da URL
  const getUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      processoId: urlParams.get("processo_id"),
      parentId: urlParams.get("parent_id"),
    };
  };

  // Função principal para carregar documentos e pastas
  async function loadDocumentos(parentId, processoId) {
    let url = new URL(`${API_BASE_URL}/documentos`);
    if (processoId) {
      url.searchParams.append("processo_id", processoId);
    } else if (parentId) {
      url.searchParams.append("parent_id", parentId);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Falha ao carregar documentos.");
      const items = await response.json();

      updateBreadcrumb(parentId, processoId);
      renderDocumentos(items);
    } catch (error) {
      console.error("Erro:", error);
      if (listaDocumentosContainer) {
        listaDocumentosContainer.innerHTML = `<p class="text-danger col-12">Não foi possível carregar os documentos.</p>`;
      }
    }
  }

  // Função para renderizar os itens na tela
  function renderDocumentos(items) {
    if (!listaDocumentosContainer) return;
    listaDocumentosContainer.innerHTML = "";

    if (items.length === 0) {
      listaDocumentosContainer.innerHTML =
        '<p class="text-muted col-12">Esta pasta está vazia.</p>';
      return;
    }

    items.forEach((item) => {
      const isFolder = item.tipo === "pasta";
      const icon = isFolder ? "fa-folder" : "fa-file-alt";
      const color = isFolder ? "text-warning" : "text-secondary";
      const safeName = escapeHtml(item.nome);

      const itemHtml = `
        <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-3">
            <div class="card text-center h-100 document-item" data-id="${item.id}" data-type="${item.tipo}" data-name="${safeName}">
                <div class="card-body d-flex flex-column justify-content-center align-items-center p-2">
                    <i class="fas ${icon} ${color} fa-3x mb-2"></i>
                    <p class="card-text small text-truncate w-100" title="${safeName}">${safeName}</p>
                </div>
                <div class="card-footer bg-transparent border-0 p-1">
                    <div class="dropdown">
                        <button class="btn btn-sm btn-light" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <ul class="dropdown-menu">
                            ${!isFolder ? `<li><a class="dropdown-item btn-download" href="#"><i class="fas fa-download fa-fw me-2"></i>Baixar</a></li>` : ""}
                            <li><a class="dropdown-item btn-rename" href="#"><i class="fas fa-edit fa-fw me-2"></i>Renomear</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item btn-delete text-danger" href="#"><i class="fas fa-trash fa-fw me-2"></i>Excluir</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
      `;
      listaDocumentosContainer.insertAdjacentHTML("beforeend", itemHtml);
    });
  }

  function updateBreadcrumb(parentId, processoId) {
    if (!breadcrumbContainer) return;
    breadcrumbContainer.innerHTML = "";
    if (parentId || processoId) {
      breadcrumbContainer.innerHTML = `
        <li class="breadcrumb-item"><a href="documento.html">Raiz</a></li>
        <li class="breadcrumb-item active" aria-current="page">Pasta Atual</li>
      `;
    } else {
      breadcrumbContainer.innerHTML = `
        <li class="breadcrumb-item active" aria-current="page">Raiz</li>
      `;
    }
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- Event Listeners ---

  // Ações nos itens (delegação de evento)
  listaDocumentosContainer?.addEventListener("click", async (e) => {
    const itemCard = e.target.closest(".document-item");
    if (!itemCard) return;

    const id = itemCard.dataset.id;
    const type = itemCard.dataset.type;
    const name = itemCard.dataset.name;

    if (e.target.closest(".btn-rename")) {
      e.preventDefault();
      document.getElementById("renomearId").value = id;
      document.getElementById("novoNome").value = name;
      modalRenomear.show();
    } else if (e.target.closest(".btn-delete")) {
      e.preventDefault();
      if (
        confirm(
          `Tem certeza que deseja excluir "${name}"? ${type === "pasta" ? "Todo o conteúdo será perdido." : ""}`,
        )
      ) {
        const response = await fetch(`${API_BASE_URL}/documentos/${id}`, {
          method: "DELETE",
        });
        if (response.ok) loadDocumentos(getUrlParams().parentId);
        else alert("Erro ao excluir.");
      }
    } else if (e.target.closest(".btn-download")) {
      e.preventDefault();
      window.open(`/uploads/${name}`, "_blank");
    } else if (type === "pasta") {
      // AÇÃO CORRIGIDA: Apenas navega se o clique não for no menu dropdown
      if (!e.target.closest('[data-bs-toggle="dropdown"]')) {
        window.location.href = `documento.html?parent_id=${id}`;
      }
    } else if (type === "arquivo") {
      // AÇÃO CORRIGIDA: Apenas abre o arquivo se o clique não for no menu dropdown
      if (!e.target.closest('[data-bs-toggle="dropdown"]')) {
        // Permite abrir o arquivo ao clicar no corpo do card
        window.open(`/uploads/${name}`, "_blank");
      }
    }
  });

  // Botão Nova Pasta
  document.getElementById("btn-nova-pasta")?.addEventListener("click", () => {
    document.getElementById("formNovaPasta").reset();
    modalNovaPasta.show();
  });

  // Salvar Nova Pasta
  document
    .getElementById("btnSalvarPasta")
    ?.addEventListener("click", async () => {
      const nome = document.getElementById("nomePasta").value;
      if (!nome) return alert("O nome da pasta é obrigatório.");
      const { parentId } = getUrlParams();
      const response = await fetch(`${API_BASE_URL}/documentos/pasta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, parent_id: parentId }),
      });
      if (response.ok) {
        modalNovaPasta.hide();
        loadDocumentos(parentId);
      } else alert("Erro ao criar pasta.");
    });

  // Botão Upload
  document.getElementById("btn-upload")?.addEventListener("click", () => {
    document.getElementById("formUpload").reset();
    modalUpload.show();
  });

  // Salvar Upload
  document
    .getElementById("btnSalvarUpload")
    ?.addEventListener("click", async () => {
      const file = document.getElementById("uploadArquivo").files[0];
      if (!file) return alert("Selecione um arquivo.");
      const { parentId } = getUrlParams();
      const formData = new FormData();
      formData.append("arquivo", file);
      if (parentId) formData.append("parent_id", parentId);

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        modalUpload.hide();
        loadDocumentos(parentId);
      } else alert("Erro ao fazer upload.");
    });

  // Salvar Renomeação
  document
    .getElementById("btnSalvarRenomeacao")
    ?.addEventListener("click", async () => {
      const id = document.getElementById("renomearId").value;
      const novo_nome = document.getElementById("novoNome").value;
      if (!novo_nome) return alert("O novo nome é obrigatório.");
      const response = await fetch(`${API_BASE_URL}/documentos/${id}/rename`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novo_nome }),
      });
      if (response.ok) {
        modalRenomear.hide();
        loadDocumentos(getUrlParams().parentId);
      } else alert("Erro ao renomear.");
    });

  // Inicialização
  const { processoId, parentId } = getUrlParams();
  loadDocumentos(parentId, processoId);
});
