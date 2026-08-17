const API_URL = '/api';

// Utilities
function showMsg(id, text, isError = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = isError
        ? 'bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded text-sm text-center mb-4 block'
        : 'bg-green-900/50 border border-green-500/50 text-green-200 px-4 py-3 rounded text-sm text-center mb-4 block';
}

function hideMsg(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function switchTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    hideMsg('error-msg');

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.className = 'flex-1 py-2 text-sm font-medium rounded-md bg-dark-panel text-white shadow';
        tabRegister.className = 'flex-1 py-2 text-sm font-medium rounded-md text-dark-muted hover:text-white';
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabRegister.className = 'flex-1 py-2 text-sm font-medium rounded-md bg-dark-panel text-white shadow';
        tabLogin.className = 'flex-1 py-2 text-sm font-medium rounded-md text-dark-muted hover:text-white';
    }
}

// Authentication
async function handleAuth(event, type) {
    event.preventDefault();
    hideMsg('error-msg');

    const email = document.getElementById(`${type}-email`).value;
    const password = document.getElementById(`${type}-password`).value;
    const payload = { email, password };

    if (type === 'register') {
        payload.tier = document.getElementById('register-tier').value;
    }

    try {
        const res = await fetch(`${API_URL}/auth/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Authentication failed');

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard.html';
    } catch (err) {
        showMsg('error-msg', err.message);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Dashboard Functions
let metricsChartInstance = null;

async function initDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-tier').textContent = `${user.tier} PLAN`;
    }

    await fetchKeys();
    await fetchMetrics();
}

async function fetchKeys() {
    try {
        const res = await fetch(`${API_URL}/keys`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        const tbody = document.getElementById('keys-tbody');
        tbody.innerHTML = '';

        if (data.keys.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="px-6 py-4 text-center text-sm text-dark-muted">No API keys found. Generate one above.</td></tr>`;
            return;
        }

        data.keys.forEach(key => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-300">${key.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-dark-muted">${new Date(key.createdAt).toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-dark-muted">${key.lastUsed ? new Date(key.lastUsed).toLocaleString() : 'Never'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <button onclick="deleteApiKey('${key.id}')" class="text-red-400 hover:text-red-300 transition-colors">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Failed to fetch keys', err);
    }
}

async function generateApiKey() {
    try {
        const res = await fetch(`${API_URL}/keys`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        const alertBox = document.getElementById('new-key-alert');
        const keyValue = document.getElementById('new-key-value');

        keyValue.textContent = data.key;
        alertBox.classList.remove('hidden');

        // Refresh keys list
        fetchKeys();
    } catch (err) {
        alert(err.message);
    }
}

function copyKey() {
    const keyText = document.getElementById('new-key-value').textContent;
    navigator.clipboard.writeText(keyText).then(() => {
        alert('Copied to clipboard!');
    });
}

async function deleteApiKey(id) {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) return;

    try {
        const res = await fetch(`${API_URL}/keys/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to delete API key');

        // Refresh keys list
        fetchKeys();
    } catch (err) {
        alert(err.message);
    }
}

async function fetchMetrics() {
    try {
        const res = await fetch(`${API_URL}/metrics`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const { data } = await res.json();

        renderChart(data);
    } catch (err) {
        console.error('Failed to fetch metrics', err);
    }
}

function renderChart(metricsData) {
    const ctx = document.getElementById('metricsChart').getContext('2d');

    const labels = [];
    const successes = [];
    const failures = [];

    const now = new Date();
    now.setMinutes(0, 0, 0);
    for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        labels.push(d.getHours() + ':00');
        successes.push(0);
        failures.push(0);
    }

    metricsData.forEach(item => {
        const itemDate = new Date(item.hour);
        const hoursAgo = Math.floor((now - itemDate) / (60 * 60 * 1000));

        if (hoursAgo >= 0 && hoursAgo < 24) {
            const index = 23 - hoursAgo;
            if (item.status === 200) {
                successes[index] += item.count;
            } else if (item.status === 429) {
                failures[index] += item.count;
            }
        }
    });

    if (metricsChartInstance) {
        metricsChartInstance.destroy();
    }

    Chart.defaults.color = '#94a3b8';
    metricsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Successful Requests (200)',
                    data: successes,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Rate Limited (429)',
                    data: failures,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#334155' } },
                x: { grid: { color: '#334155' } }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

async function testApi() {
    const key = document.getElementById('test-api-key').value;
    const resultBox = document.getElementById('test-api-result');
    if (!key) return alert('Please enter an API key');

    resultBox.classList.remove('hidden');
    resultBox.textContent = 'Sending request...';

    try {
        const res = await fetch(`${API_URL}/data`, {
            headers: { 'x-api-key': key }
        });
        const data = await res.json();

        resultBox.textContent = `Status: ${res.status} ${res.statusText}\n\n${JSON.stringify(data, null, 2)}`;


        if (res.status === 429) {
            resultBox.className = 'mt-4 bg-red-900/20 border border-red-500/50 p-4 rounded-lg text-sm text-red-300 font-mono overflow-x-auto block';
        } else if (res.ok) {
            resultBox.className = 'mt-4 bg-green-900/20 border border-green-500/50 p-4 rounded-lg text-sm text-green-300 font-mono overflow-x-auto block';
        } else {
            resultBox.className = 'mt-4 bg-yellow-900/20 border border-yellow-500/50 p-4 rounded-lg text-sm text-yellow-300 font-mono overflow-x-auto block';
        }

        setTimeout(fetchMetrics, 500);
        setTimeout(fetchKeys, 500);
    } catch (err) {
        resultBox.textContent = `Error: ${err.message}`;
    }
}
