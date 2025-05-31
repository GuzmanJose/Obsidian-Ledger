import type { TransactionCache } from '../types';
import { Chart, registerables } from 'chart.js';
import type LedgerPlugin from '../main';
import { Modal } from 'obsidian';

Chart.register(...registerables);

export class DashboardModal extends Modal {
  constructor(app: App, private data: TransactionCache, private plugin: LedgerPlugin) {
    super(app);
  }

  onOpen() {
    console.log('[Ledger] 📱 Opening dashboard modal');
    const { contentEl } = this;
    renderDashboard(contentEl, this.data, this.plugin || { settings: { budgets: {} } });
  }

  onClose() {
    console.log('[Ledger] 🔒 Closing dashboard modal');
    const { contentEl } = this;
    contentEl.empty();
    if ((window as any).lineChart) (window as any).lineChart.destroy();
    if ((window as any).pieChart) (window as any).pieChart.destroy();
    if ((window as any).budgetChart) (window as any).budgetChart.destroy();
  }
}

export function renderDashboard(root: HTMLElement, data: TransactionCache, plugin?: LedgerPlugin) {
  console.log('[Ledger] 🖼️ Rendering dashboard');
  root.innerHTML = '';
  if (!data?.transactions?.length) {
    root.createEl('p', { text: 'No transactions found. Add entries to your ledger to see the dashboard.' });
    console.log('[Ledger] ⚠️ No transaction data');
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.classList.add('dashboard-wrapper');
  root.appendChild(wrapper);

  const sidebar = document.createElement('div');
  sidebar.classList.add('dashboard-sidebar');
  wrapper.appendChild(sidebar);

  const yearFilter = document.createElement('select');
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 5; y <= currentYear; y++) {
    const opt = document.createElement('option');
    opt.value = `${y}`;
    opt.textContent = `${y}`;
    if (y === currentYear) opt.selected = true;
    yearFilter.appendChild(opt);
  }
  sidebar.appendChild(yearFilter);

  data.accounts.forEach(acc => {
    const label = document.createElement('label');
    label.classList.add('account-label');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.value = acc;
    chk.addEventListener('change', updateAll);
    label.appendChild(chk);
    label.appendChild(document.createTextNode(` ${acc}`));
    sidebar.appendChild(label);
  });

  const main = document.createElement('div');
  main.classList.add('dashboard-main');
  wrapper.appendChild(main);

  const budgets = plugin?.settings?.budgets || {};
  const budgetContainer = main.createEl('div', { cls: 'budget-progress' });
  Object.entries(budgets).forEach(([category, budget]) => {
    const spent = data.transactions
      .filter(t => new Date(t.date).getFullYear() === currentYear)
      .flatMap(t => t.expenseLines)
      .filter(line => line.category === category)
      .reduce((sum, line) => sum + line.amount, 0);
    const progress = budget ? (spent / budget) * 100 : 0;
    const div = budgetContainer.createEl('div', { cls: 'budget-item' });
    div.createEl('span', { text: `${category}: $${spent.toFixed(2)} / $${budget?.toFixed(2) || '0.00'}` });
    const bar = div.createEl('div', { cls: 'progress-bar' });
    bar.style.width = `${Math.min(progress, 100)}%`;
    bar.style.backgroundColor = progress > 100 ? '#FF6384' : '#4CAF50';
  });

  const charts = document.createElement('div');
  charts.classList.add('dashboard-charts');
  main.appendChild(charts);

  const lineWrapper = document.createElement('div');
  lineWrapper.classList.add('chart-wrapper');
  const lineCanvas = document.createElement('canvas');
  lineCanvas.id = 'ledger-line-canvas';
  lineWrapper.appendChild(lineCanvas);
  charts.appendChild(lineWrapper);

  const pieWrapper = document.createElement('div');
  pieWrapper.classList.add('chart-wrapper');
  const pieCanvas = document.createElement('canvas');
  pieCanvas.id = 'ledger-pie-canvas';
  pieWrapper.appendChild(pieCanvas);
  charts.appendChild(pieWrapper);

  const budgetChartWrapper = document.createElement('div');
  budgetChartWrapper.classList.add('chart-wrapper');
  const budgetCanvas = document.createElement('canvas');
  budgetCanvas.id = 'ledger-budget-canvas';
  budgetChartWrapper.appendChild(budgetCanvas);
  charts.appendChild(budgetChartWrapper);

  const tableContainer = document.createElement('div');
  tableContainer.classList.add('dashboard-table');
  main.appendChild(tableContainer);

  function updateAll() {
    console.log('[Ledger] 🔄 Updating dashboard charts');
    const year = Number(yearFilter.value);
    const selected = Array.from(
      sidebar.querySelectorAll<HTMLInputElement>('input[type=checkbox]:checked')
    )
      .map(i => i.value)
      .slice(0, 2);

    const filteredLines = data.transactions
      .filter(t => new Date(t.date).getFullYear() === year)
      .flatMap(t => t.expenseLines)
      .filter(line => selected.length === 0 || selected.includes(line.account));

    if (!filteredLines.length) {
      tableContainer.innerHTML = '';
      tableContainer.createEl('p', { text: 'No transactions for selected accounts/year.' });
      return;
    }

    const colors = ['#4CAF50', '#FF6384', '#36A2EB', '#FFCE56', '#9966FF'];
    const labels = Array.from(new Set(data.transactions.map(t => t.date.toISODate()))).sort();
    const datasets = selected.map((acc, i) => {
      let balance = 0;
      const balances = labels.map(d => {
        const tx = filteredLines.filter(line => line.account === acc && data.transactions.find(t => t.expenseLines.includes(line))?.date.toISODate() === d);
        balance += tx.reduce((sum, line) => sum + line.amount, 0);
        return balance;
      });
      return {
        label: acc,
        data: balances,
        tension: 0.1,
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '33',
        fill: true,
      };
    });

    if ((window as any).lineChart) (window as any).lineChart.destroy();
    try {
      (window as any).lineChart = new Chart(lineCanvas.getContext('2d')!, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: false, title: { display: true, text: 'Balance', font: { size: 12 } } },
            x: { title: { display: true, text: 'Date', font: { size: 12 } } },
          },
          plugins: {
            legend: { display: true, labels: { font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${ctx.raw} ${filteredLines[0]?.currency || 'USD'}`,
              },
            },
          },
        },
      });
    } catch (err) {
      console.error('[Ledger] ✋ Line chart error:', err);
      lineWrapper.createEl('p', { text: '⚠️ Failed to render line chart.' });
    }

    const firstAcc = selected[0] || data.accounts[0];
    const pieData = filteredLines
      .filter(line => line.account === firstAcc && line.category)
      .reduce(
        (m, line) => ((m[line.category!] = (m[line.category!] || 0) + line.amount), m),
        {} as Record<string, number>
      );

    if ((window as any).pieChart) (window as any).pieChart.destroy();
    try {
      (window as any).pieChart = new Chart(pieCanvas.getContext('2d')!, {
        type: 'pie',
        data: {
          labels: Object.keys(pieData),
          datasets: [{
            data: Object.values(pieData),
            backgroundColor: colors,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.label}: ${ctx.raw} ${filteredLines[0]?.currency || 'USD'}`,
              },
            },
          },
        },
      });
    } catch (err) {
      console.error('[Ledger] ✋ Pie chart error:', err);
      pieWrapper.createEl('p', { text: '⚠️ Failed to render pie chart.' });
    }

    const budgetData = Object.entries(budgets).map(([category, budget]) => {
      const spent = filteredLines
        .filter(line => line.category === category)
        .reduce((sum, line) => sum + line.amount, 0);
      return { category, budget, spent };
    });

    if ((window as any).budgetChart) (window as any).budgetChart.destroy();
    try {
      (window as any).budgetChart = new Chart(budgetCanvas.getContext('2d')!, {
        type: 'bar',
        data: {
          labels: budgetData.map(d => d.category),
          datasets: [
            {
              label: 'Spent',
              data: budgetData.map(d => d.spent),
              backgroundColor: '#FF6384',
            },
            {
              label: 'Budget',
              data: budgetData.map(d => d.budget),
              backgroundColor: '#4CAF50',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Amount', font: { size: 12 } } },
            x: { title: { display: true, text: 'Category', font: { size: 12 } } },
          },
          plugins: {
            legend: { display: true, labels: { font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${ctx.raw} ${filteredLines[0]?.currency || 'USD'}`,
              },
            },
          },
        },
      });
    } catch (err) {
      console.error('[Ledger] ✋ Budget chart error:', err);
      budgetChartWrapper.createEl('p', { text: '⚠️ Failed to render budget chart.' });
    }

    tableContainer.innerHTML = '';
    const tbl = document.createElement('table');
    tbl.classList.add('dashboard-table');
    const thead = tbl.createTHead();
    const headerRow = thead.insertRow();
    ['Date', 'Account', 'Amount', 'Category'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    const tbody = tbl.createTBody();
    filteredLines.forEach(line => {
      const tx = data.transactions.find(t => t.expenseLines.includes(line));
      if (!tx) return;
      const row = tbody.insertRow();
      [tx.date.toISODate(), line.account, line.amount.toString(), line.category || ''].forEach(val => {
        const cell = row.insertCell();
        cell.textContent = val;
      });
    });
    tableContainer.appendChild(tbl);
  }

  updateAll();
}
