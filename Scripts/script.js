// --- Inicialização dos Gráficos (Chart.js) ---
document.addEventListener("DOMContentLoaded", function () {
  const API_BASE_URL = "http://localhost:3000/api";

  // Gráfico Financeiro (Linha)
  async function loadFinanceiroChart() {
    const ctxFinance = document.getElementById("financeChart").getContext("2d");

    try {
      // Busca dados do servidor
      const response = await fetch(`${API_BASE_URL}/financeiro`);
      const transacoes = await response.json();

      // Prepara os dados para os últimos 6 meses
      const labels = [];
      const receitasData = [0, 0, 0, 0, 0, 0];
      const despesasData = [0, 0, 0, 0, 0, 0];
      const hoje = new Date();

      // Gera labels dos últimos 6 meses
      for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        labels.push(d.toLocaleString("default", { month: "short" }));
      }

      // Agrega os valores
      transacoes.forEach((t) => {
        const tDate = new Date(t.data);
        // Calcula a diferença em meses para saber onde encaixar no gráfico
        const diffMonths =
          (hoje.getFullYear() - tDate.getFullYear()) * 12 +
          (hoje.getMonth() - tDate.getMonth());

        if (diffMonths >= 0 && diffMonths < 6) {
          const index = 5 - diffMonths;
          if (t.tipo === "Receita") receitasData[index] += t.valor;
          else if (t.tipo === "Despesa") despesasData[index] += t.valor;
        }
      });

      new Chart(ctxFinance, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Receitas",
              data: receitasData,
              borderColor: "#2ecc71",
              tension: 0.3,
            },
            {
              label: "Despesas",
              data: despesasData,
              borderColor: "#e74c3c",
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "top" },
          },
        },
      });
    } catch (error) {
      console.error("Erro ao carregar gráfico financeiro:", error);
    }
  }

  if (document.getElementById("financeChart")) {
    loadFinanceiroChart();
  }

  // --- Carregar Cards do Dashboard ---
  async function loadDashboardCards() {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/cards`);
      const data = await response.json();

      // Atualiza Processos Ativos
      document.getElementById("dash-proc-count").innerText =
        data.processosAtivos;

      // Formatador de Moeda
      const formatCurrency = (value) =>
        new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);

      // Atualiza Financeiro
      document.getElementById("dash-receita").innerText = formatCurrency(
        data.receitaMensal || 0,
      );
      document.getElementById("dash-despesa").innerText = formatCurrency(
        data.despesaMensal || 0,
      );
    } catch (error) {
      console.error("Erro ao carregar cards:", error);
    }
  }
  if (document.getElementById("dash-proc-count")) {
    loadDashboardCards();
  }

  // Gráfico de Processos (Rosca)
  async function loadProcessosChart() {
    const ctxProcess = document.getElementById("processChart").getContext("2d");
    try {
      const response = await fetch(
        `${API_BASE_URL}/dashboard/grafico-processos`,
      );
      const data = await response.json();

      // Prepara dados para o Chart.js
      const labels = data.map((item) => item.status);
      const values = data.map((item) => item.count);
      // Cores fixas baseadas no status (opcional, pode ser aleatório)
      const colors = labels.map((status) => {
        if (status === "Em Andamento") return "#f1c40f";
        if (status === "Concluído") return "#2ecc71";
        if (status === "Suspenso") return "#e74c3c";
        return "#95a5a6"; // Cor padrão
      });

      new Chart(ctxProcess, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors,
            },
          ],
        },
        options: {
          responsive: true,
        },
      });
    } catch (error) {
      console.error("Erro ao carregar gráfico de processos:", error);
    }
  }
  if (document.getElementById("processChart")) {
    loadProcessosChart();
  }
});
