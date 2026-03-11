// --- Sistema de Autenticação ---

/**
 * Verifica as credenciais do usuário e gerencia a sessão.
 */
async function checkLogin() {
  const user = document.getElementById("login-user").value;
  const pass = document.getElementById("login-pass").value;
  const errorDiv = document.getElementById("login-error");
  const API_BASE_URL = "http://localhost:3000/api";

  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ usuario: user, senha: pass }),
    });

    if (response.ok) {
      // Salva o estado de "logado" na sessão do navegador.
      sessionStorage.setItem("isLoggedIn", "true");
      sessionStorage.setItem("currentUser", user);
      // Redireciona para o dashboard após o login bem-sucedido.
      window.location.href = "dashboard.html";
    } else {
      if (errorDiv) errorDiv.style.display = "block";
    }
  } catch (error) {
    console.error("Erro no login:", error);
    if (errorDiv) {
      errorDiv.innerText = "Erro de conexão com o servidor.";
      errorDiv.style.display = "block";
    }
  }
}

/**
 * Faz o logout do usuário, limpando a sessão.
 */
function logout() {
  // Remove o indicador de login da sessão.
  sessionStorage.removeItem("isLoggedIn");
  // Redireciona para a página de dashboard, que por sua vez mostrará a tela de login.
  window.location.href = "dashboard.html";
}

document.addEventListener("DOMContentLoaded", function () {
  const isLoggedIn = sessionStorage.getItem("isLoggedIn") === "true";
  const loginScreen = document.getElementById("login-screen");
  const appContainer = document.getElementById("app-container");

  // Verifica se o usuário está logado na sessão do navegador.
  if (isLoggedIn) {
    // Se estiver logado, esconde a tela de login e mostra o conteúdo da aplicação.
    if (loginScreen) loginScreen.style.display = "none";
    if (appContainer) appContainer.style.display = "block";

    // Adiciona um botão de logout dinamicamente ao cabeçalho.
    const userInfoDiv = document.querySelector(".user-info");
    if (userInfoDiv) {
      const logoutButton = document.createElement("button");
      logoutButton.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
      logoutButton.className = "btn btn-outline-light btn-sm ms-3";
      logoutButton.onclick = logout;
      userInfoDiv.appendChild(logoutButton);
    }
  } else {
    // Se não estiver logado, mostra a tela de login e esconde o conteúdo.
    if (loginScreen) loginScreen.style.display = "flex";
    if (appContainer) appContainer.style.display = "none";
  }

  // --- Lógica para Cadastro de Novos Usuários ---
  const btnNovoUsuarioModal = document.getElementById("btn-novo-usuario-modal");
  const btnSalvarUsuario = document.getElementById("btnSalvarUsuario");
  const API_BASE_URL = "http://localhost:3000/api";

  // Abrir Modal
  if (btnNovoUsuarioModal) {
    btnNovoUsuarioModal.addEventListener("click", (e) => {
      e.preventDefault();
      const modalEl = document.getElementById("modalNovoUsuario");
      const form = document.getElementById("formNovoUsuario");
      if (form) form.reset();
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    });
  }

  // Salvar Usuário
  if (btnSalvarUsuario) {
    btnSalvarUsuario.addEventListener("click", async () => {
      const usuarioInput = document.getElementById("novoUsuarioUser").value;
      const senhaInput = document.getElementById("novoUsuarioPass").value;

      if (usuarioInput && senhaInput) {
        try {
          const response = await fetch(`${API_BASE_URL}/usuarios`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: usuarioInput, senha: senhaInput }),
          });

          if (response.ok) {
            alert("Usuário cadastrado com sucesso!");
            const modalEl = document.getElementById("modalNovoUsuario");
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
          } else {
            const errorData = await response.json();
            alert("Erro: " + (errorData.error || "Falha ao criar usuário"));
          }
        } catch (error) {
          console.error("Erro:", error);
          alert("Erro de conexão.");
        }
      } else {
        alert("Preencha todos os campos.");
      }
    });
  }

  // --- Lógica para Gerenciar Usuários ---
  const btnGerenciarUsuariosModal = document.getElementById("btn-gerenciar-usuarios-modal");
  const listaDeUsuariosContainer = document.getElementById("listaDeUsuarios");

  async function loadUsuariosList() {
    if (!listaDeUsuariosContainer) return;
    try {
      const response = await fetch(`${API_BASE_URL}/usuarios`);
      const usuarios = await response.json();
      listaDeUsuariosContainer.innerHTML = "";

      if (usuarios.length === 0) {
        listaDeUsuariosContainer.innerHTML = '<li class="list-group-item">Nenhum usuário encontrado.</li>';
        return;
      }

      usuarios.forEach(user => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.innerHTML = `
          <span><i class="fas fa-user me-2"></i>${user.usuario}</span>
          <button class="btn btn-sm btn-outline-danger btn-delete-usuario" data-id="${user.id}" title="Excluir ${user.usuario}">
            <i class="fas fa-trash-alt"></i>
          </button>
        `;
        if (user.id === 1) { // Protege o usuário principal (admin)
          li.querySelector('button').disabled = true;
          li.querySelector('button').title = "Não é possível excluir o usuário principal";
        }
        listaDeUsuariosContainer.appendChild(li);
      });
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      listaDeUsuariosContainer.innerHTML = '<li class="list-group-item text-danger">Falha ao carregar lista de usuários.</li>';
    }
  }

  if (btnGerenciarUsuariosModal) {
    btnGerenciarUsuariosModal.addEventListener("click", (e) => {
      e.preventDefault();
      loadUsuariosList();
      const modal = new bootstrap.Modal(document.getElementById("modalGerenciarUsuarios"));
      modal.show();
    });
  }

  if (listaDeUsuariosContainer) {
    listaDeUsuariosContainer.addEventListener("click", async (e) => {
      const target = e.target.closest(".btn-delete-usuario");
      if (target && !target.disabled) {
        const userId = target.dataset.id;
        const userName = target.parentElement.querySelector('span').innerText;
        if (confirm(`Tem certeza que deseja excluir o usuário "${userName}"?`)) {
          try {
            const response = await fetch(`${API_BASE_URL}/usuarios/${userId}`, { method: "DELETE" });
            if (response.ok) {
              loadUsuariosList();
            } else {
              const errorData = await response.json();
              alert("Erro: " + (errorData.error || "Falha ao excluir usuário."));
            }
          } catch (error) {
            console.error("Erro ao excluir usuário:", error);
            alert("Erro de conexão ao tentar excluir.");
          }
        }
      }
    });
  }
});
