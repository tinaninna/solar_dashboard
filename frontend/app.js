// ---- Simulation state ----
let solarKw = 4.0;
let loadKw = 4.0;
let batterySoc = 50.0; // percent, 0-100
const BATTERY_CAPACITY_KWH = 10;
const INVERTER_MAX_KW = 10;
const MAX_TICKS_SHOWN = 20;

let history = { labels: [], solar: [], load: [], soc: [] };

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function stepSolar() {
  // Smooth wandering value between roughly 2 and 9 kW, simulating
  // passing clouds / changing sun angle rather than pure randomness.
  const drift = (Math.random() - 0.5) * 2.2;
  solarKw = clamp(solarKw + drift, 1.5, 9.5);
  return Math.round(solarKw * 10) / 10;
}

function stepLoad() {
  // New target load every tick, cycling within 1-10 kW.
  loadKw = clamp(1 + Math.random() * 9, 1, 10);
  return Math.round(loadKw * 10) / 10;
}

function stepBattery(solar, load) {
  const net = solar - load; // kW surplus (+) or deficit (-)
  // Convert kW over a 3s tick into a tiny kWh delta, scaled up
  // for a visibly-moving demo (real version will use real timing).
  const socDelta = (net / BATTERY_CAPACITY_KWH) * 8; // demo-scaled

  let status = 'idle';
  if (net > 0.15) status = 'charging';
  else if (net < -0.15) status = 'discharging';

  batterySoc = clamp(batterySoc + socDelta, 0, 100);

  // Inverter output: what's actually delivered to the load,
  // limited by inverter capacity and by battery availability.
  let inverterOut = load;
  if (net < 0 && batterySoc <= 0) {
    inverterOut = solar; // battery empty, can't cover deficit
  }
  inverterOut = clamp(inverterOut, 0, INVERTER_MAX_KW);

  return { status, inverterOut: Math.round(inverterOut * 10) / 10 };
}

function tick() {
  const solar = stepSolar();
  const load = stepLoad();
  const { status, inverterOut } = stepBattery(solar, load);
  const soc = Math.round(batterySoc * 10) / 10;
  const now = new Date();
  const timeLabel = now.toLocaleTimeString();

  // Update instrument cards
  document.getElementById('solarVal').innerHTML = solar.toFixed(1) + '<span class="unit">kW</span>';
  document.getElementById('loadVal').innerHTML = load.toFixed(1) + '<span class="unit">kW</span>';
  document.getElementById('inverterVal').innerHTML = inverterOut.toFixed(1) + '<span class="unit">kW</span>';
  document.getElementById('clockVal').textContent = timeLabel;
  document.getElementById('updateSub').textContent = 'tick received';
  document.getElementById('socVal').textContent = soc.toFixed(1) + '%';
  document.getElementById('batteryFill').style.height = soc + '%';

  const chip = document.getElementById('batteryStatusChip');
  chip.textContent = status;
  chip.className = 'status-chip ' + status;

  // Update history + charts
  history.labels.push(timeLabel);
  history.solar.push(solar);
  history.load.push(load);
  history.soc.push(soc);
  if (history.labels.length > MAX_TICKS_SHOWN) {
    history.labels.shift();
    history.solar.shift();
    history.load.shift();
    history.soc.shift();
  }
  powerChart.update();
  batteryChart.update();
}

// ---- Charts ----
const chartGrid = '#1E2A42';
const chartText = '#7C8AA8';

Chart.defaults.font.family = "'IBM Plex Mono', monospace";
Chart.defaults.font.size = 11;

const powerChart = new Chart(document.getElementById('powerChart'), {
  type: 'line',
  data: {
    labels: history.labels,
    datasets: [
      {
        label: 'Solar (kW)',
        data: history.solar,
        borderColor: '#F5A623',
        backgroundColor: 'rgba(245,166,35,0.08)',
        tension: 0.35,
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Load (kW)',
        data: history.load,
        borderColor: '#E6EDF5',
        backgroundColor: 'transparent',
        tension: 0.35,
        fill: false,
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [4, 3],
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    scales: {
      y: { min: 0, max: 10, grid: { color: chartGrid }, ticks: { color: chartText } },
      x: { grid: { color: chartGrid }, ticks: { color: chartText, maxTicksLimit: 6 } },
    },
    plugins: {
      legend: { labels: { color: '#C9D6E8', boxWidth: 12, usePointStyle: true } },
    },
  },
});

const batteryChart = new Chart(document.getElementById('batteryChart'), {
  type: 'line',
  data: {
    labels: history.labels,
    datasets: [
      {
        label: 'SoC (%)',
        data: history.soc,
        borderColor: '#34D8C6',
        backgroundColor: 'rgba(52,216,198,0.1)',
        tension: 0.35,
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    scales: {
      y: { min: 0, max: 100, grid: { color: chartGrid }, ticks: { color: chartText } },
      x: { grid: { color: chartGrid }, ticks: { color: chartText, maxTicksLimit: 6 } },
    },
    plugins: { legend: { display: false } },
  },
});

// First tick immediately, then every 3 seconds
tick();
setInterval(tick, 3000);