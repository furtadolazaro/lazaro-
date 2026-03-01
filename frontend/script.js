const API_BASE = window.location.origin;

let egressoChart;
let autodeclaracaoChart;

function countBy(items, key) {
  return items.reduce((acc, current) => {
    const value = (current[key] || 'Não informado').toString().trim() || 'Não informado';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function renderChart(canvasId, label, counts, palette) {
  const labels = Object.keys(counts);
  const values = Object.values(counts);

  return new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label,
          data: values,
          backgroundColor: palette,
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

async function loadPublicData() {
  const emptyMessage = document.getElementById('emptyMessage');
  const chartsWrapper = document.getElementById('chartsWrapper');

  try {
    const response = await fetch(`${API_BASE}/public-data`);
    if (!response.ok) {
      throw new Error('Erro ao buscar dados públicos');
    }

    const data = await response.json();

    if (!data.entries || data.entries.length === 0) {
      emptyMessage.classList.remove('hidden');
      chartsWrapper.classList.add('hidden');
      return;
    }

    emptyMessage.classList.add('hidden');
    chartsWrapper.classList.remove('hidden');

    const egressoCounts = countBy(data.entries, 'egressoDe');
    const autodeclaracaoCounts = countBy(data.entries, 'autodeclaracao');

    const baseColors = ['#006400', '#008000', '#2e8b57', '#38a169', '#68d391', '#a7f3d0'];

    if (egressoChart) egressoChart.destroy();
    if (autodeclaracaoChart) autodeclaracaoChart.destroy();

    egressoChart = renderChart(
      'egressoChart',
      'Quantidade de egressos',
      egressoCounts,
      Object.keys(egressoCounts).map((_, index) => baseColors[index % baseColors.length])
    );

    autodeclaracaoChart = renderChart(
      'autodeclaracaoChart',
      'Quantidade por autodeclaração',
      autodeclaracaoCounts,
      Object.keys(autodeclaracaoCounts).map((_, index) => baseColors[index % baseColors.length])
    );
  } catch (error) {
    emptyMessage.textContent = 'Não foi possível carregar os dados públicos neste momento.';
    emptyMessage.classList.remove('hidden');
    chartsWrapper.classList.add('hidden');
  }
}

loadPublicData();
