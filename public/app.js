// Global API URL
window.APP_API_URL = '/api';
const API_URL = '/api';

// Utilities
function showMsg(id, text, isError = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = isError
        ? 'bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm text-center mb-4 block'
        : 'bg-green-900/50 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg text-sm text-center mb-4 block';
}

function hideMsg(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { isValid: false, error: 'Password is required' };
    }
    if (password.length < 6) {
        return { isValid: false, error: 'Password must be at least 6 characters long' };
    }
    if (!/[a-zA-Z]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one alphabet letter (a-z, A-Z)' };
    }
    if (!/[0-9]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one number (0-9)' };
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one special character (e.g. !@#$%^&*)' };
    }
    return { isValid: true };
}

function switchTab(tab) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    hideMsg('error-msg');

    if (!loginForm || !registerForm || !tabLogin || !tabRegister) return;

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.className = 'flex-1 py-2 text-sm font-medium rounded-md bg-white/10 text-white shadow transition';
        tabRegister.className = 'flex-1 py-2 text-sm font-medium rounded-md opacity-70 hover:opacity-100 hover:text-white transition';
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabRegister.className = 'flex-1 py-2 text-sm font-medium rounded-md bg-white/10 text-white shadow transition';
        tabLogin.className = 'flex-1 py-2 text-sm font-medium rounded-md opacity-70 hover:opacity-100 hover:text-white transition';
        
        // Reset registration 2-step state
        const step2 = document.getElementById('register-step-2');
        if (step2) step2.classList.add('hidden');
        const sendBtnText = document.getElementById('btn-send-otp-text');
        if (sendBtnText) sendBtnText.textContent = 'Send Verification Code';
        
        fetchPublicTiers();
    }
}

async function fetchPublicTiers() {
    const select = document.getElementById('register-tier');
    if (!select) return;

    try {
        const res = await fetch(`${API_URL}/auth/tiers`);
        if (!res.ok) return;
        const { configs } = await res.json();

        if (configs && configs.length > 0) {
            select.innerHTML = '';
            configs.forEach(config => {
                const option = document.createElement('option');
                option.value = config.tierName;
                option.className = 'bg-slate-800 text-white';
                const windowStr = config.windowMs >= 60000 
                    ? `${Math.round(config.windowMs / 60000)}min` 
                    : `${config.windowMs / 1000}s`;
                const tierTitle = config.tierName.charAt(0) + config.tierName.slice(1).toLowerCase();
                option.textContent = `${tierTitle} (${config.requestLimit} req/${windowStr})`;
                select.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Failed to fetch dynamic tiers:', err);
    }
}

// Send OTP for User Registration
async function sendRegisterOtp() {
    hideMsg('error-msg');
    const emailEl = document.getElementById('register-email');
    const btnEl = document.getElementById('btn-send-register-otp');
    const btnTextEl = document.getElementById('btn-send-otp-text');

    if (!emailEl) return;
    const email = emailEl.value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        showMsg('error-msg', 'Please enter a valid email address');
        return;
    }

    const originalText = btnTextEl ? btnTextEl.textContent : 'Send Verification Code';
    if (btnEl) btnEl.disabled = true;
    if (btnTextEl) btnTextEl.textContent = 'Sending Verification Code...';

    try {
        const res = await fetch(`${API_URL}/auth/send-register-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send verification code');

        showMsg('error-msg', data.message || 'Verification code sent to your email!', false);
        
        // Reveal Step 2 in Registration Form
        const step2 = document.getElementById('register-step-2');
        if (step2) step2.classList.remove('hidden');

        if (btnTextEl) btnTextEl.textContent = 'Resend Verification Code';

        const otpEl = document.getElementById('register-otp');
        if (otpEl) otpEl.focus();
    } catch (err) {
        showMsg('error-msg', err.message);
        if (btnTextEl) btnTextEl.textContent = originalText;
    } finally {
        if (btnEl) btnEl.disabled = false;
    }
}

// Authentication
async function handleAuth(event, type) {
    event.preventDefault();
    hideMsg('error-msg');

    const emailEl = document.getElementById(`${type}-email`);
    const passwordEl = document.getElementById(`${type}-password`);
    if (!emailEl || !passwordEl) return;

    const email = emailEl.value.trim().toLowerCase();
    const password = passwordEl.value;
    const payload = { email, password };

    if (type === 'register') {
        const otpEl = document.getElementById('register-otp');
        const otp = otpEl ? otpEl.value.trim() : '';
        if (!otp || otp.length !== 6) {
            showMsg('error-msg', 'Please enter the 6-digit verification code sent to your email');
            return;
        }
        payload.otp = otp;

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.isValid) {
            showMsg('error-msg', passwordValidation.error);
            return;
        }
        const tierEl = document.getElementById('register-tier');
        if (tierEl) payload.tier = tierEl.value;

        const submitBtn = document.getElementById('btn-complete-register');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';
        }
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
    } finally {
        if (type === 'register') {
            const submitBtn = document.getElementById('btn-complete-register');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Complete Registration';
            }
        }
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
    let user = JSON.parse(localStorage.getItem('user'));
    
    // Sync with backend to get latest tier/role
    try {
        const res = await fetch(`${API_URL}/user/me`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            const data = await res.json();
            user = data.user;
            localStorage.setItem('user', JSON.stringify(user));
        }
    } catch (e) {
        console.error('Failed to sync user data', e);
    }

    if (user) {
        const emailEl = document.getElementById('user-email');
        const tierEl = document.getElementById('user-tier');
        const adminLink = document.getElementById('admin-link');

        if (emailEl) emailEl.textContent = user.email;
        if (tierEl) tierEl.textContent = `${user.tier} PLAN`;
        if (adminLink) {
            if (user.role === 'ADMIN') {
                adminLink.classList.remove('hidden');
                adminLink.classList.add('inline-flex');
            } else {
                adminLink.classList.add('hidden');
                adminLink.classList.remove('inline-flex');
            }
        }
    }

    await fetchKeys();
    await fetchMetrics();
}

let selectedMetricsKeyId = 'ALL';
let currentLogsModalKeyId = null;

async function fetchKeys() {
    const tbody = document.getElementById('keys-tbody');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/keys`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        tbody.innerHTML = '';

        // Also sync the metrics key dropdown selector
        const select = document.getElementById('metrics-key-select');
        if (select) {
            const currentVal = selectedMetricsKeyId;
            select.innerHTML = '<option value="ALL" class="bg-slate-800 text-white">All Keys (Combined)</option>';
            if (data.keys && data.keys.length > 0) {
                data.keys.forEach((k, idx) => {
                    const opt = document.createElement('option');
                    opt.value = k.id;
                    opt.className = 'bg-slate-800 text-white';
                    const shortKey = k.id.substring(0, 8);
                    opt.textContent = `Key ${idx + 1} (${shortKey}...)`;
                    select.appendChild(opt);
                });
                select.value = currentVal;
            }
        }

        if (!data.keys || data.keys.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-6 text-center text-sm opacity-60">No API keys found. Generate one above.</td></tr>`;
            return;
        }

        data.keys.forEach(key => {
            const fullApiKey = key.key || key.id;
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-white/5 transition-colors';
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono opacity-90">
                    <div class="flex items-center space-x-2">
                        <span class="max-w-[240px] sm:max-w-[300px] truncate font-mono text-xs opacity-90" title="${fullApiKey}">${fullApiKey}</span>
                        <button onclick="copyKey('${fullApiKey}', this)" class="p-1 opacity-60 hover:opacity-100 hover:bg-white/10 rounded transition" title="Copy API Key">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm opacity-70">${new Date(key.createdAt).toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm opacity-70">${key.lastUsed ? new Date(key.lastUsed).toLocaleString() : 'Never'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                    <button onclick="copyKey('${fullApiKey}', this)" class="inline-flex items-center text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all shadow-sm" title="Copy Key">
                        <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        <span>Copy</span>
                    </button>
                    <button onclick="openKeyLogsModal('${key.id}')" class="inline-flex items-center text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 transition-all shadow-sm" title="View Request Logs">
                        <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        <span>Logs</span>
                    </button>
                    <button onclick="deleteApiKey('${key.id}')" class="inline-flex items-center text-red-400 hover:text-red-300 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors">
                        Revoke
                    </button>
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

        if (keyValue) keyValue.textContent = data.key;
        if (alertBox) alertBox.classList.remove('hidden');

        // Refresh keys list and metrics
        fetchKeys();
        fetchMetrics(selectedMetricsKeyId);
    } catch (err) {
        alert(err.message);
    }
}

function copyKey(text, btn) {
    let keyText = text;
    if (!keyText) {
        const keyValue = document.getElementById('new-key-value');
        if (keyValue) keyText = keyValue.textContent;
    }
    if (!keyText) return;

    navigator.clipboard.writeText(keyText).then(() => {
        if (btn) {
            const originalContent = btn.innerHTML;
            btn.innerHTML = `
                <svg class="w-3.5 h-3.5 mr-1 text-green-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <span class="text-green-400">Copied!</span>
            `;
            setTimeout(() => {
                btn.innerHTML = originalContent;
            }, 1500);
        } else {
            alert('API Key copied to clipboard!');
        }
    }).catch(err => {
        console.error('Could not copy text: ', err);
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

        if (selectedMetricsKeyId === id) {
            selectedMetricsKeyId = 'ALL';
        }

        fetchKeys();
        fetchMetrics(selectedMetricsKeyId);
    } catch (err) {
        alert(err.message);
    }
}

function onMetricsKeyChange(keyId) {
    selectedMetricsKeyId = keyId;
    fetchMetrics(keyId);
}

async function fetchMetrics(keyId = selectedMetricsKeyId) {
    const chartEl = document.getElementById('metricsChart');
    if (!chartEl) return;

    try {
        const url = keyId && keyId !== 'ALL' 
            ? `${API_URL}/metrics?apiKeyId=${encodeURIComponent(keyId)}`
            : `${API_URL}/metrics`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const { data } = await res.json();

        renderChart(data);
    } catch (err) {
        console.error('Failed to fetch metrics', err);
    }
}

// ==========================================
// Key Request Logs Modal Logic
// ==========================================

async function openKeyLogsModal(keyId) {
    currentLogsModalKeyId = keyId;
    const modal = document.getElementById('key-logs-modal');
    const subtitle = document.getElementById('modal-key-subtitle');
    const totalEl = document.getElementById('modal-stat-total');
    const successEl = document.getElementById('modal-stat-success');
    const limitedEl = document.getElementById('modal-stat-limited');
    const tbody = document.getElementById('modal-logs-tbody');

    if (!modal) return;

    // Open modal with loading state
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('.glass-panel')?.classList.remove('scale-95');
    });

    if (subtitle) subtitle.textContent = `Loading key: ${keyId}...`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="py-8 text-center opacity-60">Fetching request logs...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}/keys/${keyId}/logs`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to fetch logs');

        const { apiKey, stats, logs } = data;

        if (subtitle) subtitle.textContent = `Key: ${apiKey.key} (Created: ${new Date(apiKey.createdAt).toLocaleDateString()})`;
        if (totalEl) totalEl.textContent = stats.totalRequests || 0;
        if (successEl) successEl.textContent = stats.successCount || 0;
        if (limitedEl) limitedEl.textContent = stats.rateLimitedCount || 0;

        if (tbody) {
            tbody.innerHTML = '';
            if (!logs || logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" class="py-8 text-center opacity-60">No requests recorded for this API key yet.</td></tr>`;
                return;
            }

            logs.forEach(log => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-white/5 transition-colors';
                
                let badgeClass = 'bg-slate-700 text-slate-200';
                if (log.status === 200 || (log.status >= 200 && log.status < 300)) {
                    badgeClass = 'bg-green-900/40 text-green-300 border border-green-500/40';
                } else if (log.status === 429) {
                    badgeClass = 'bg-red-900/40 text-red-300 border border-red-500/40';
                } else if (log.status >= 400) {
                    badgeClass = 'bg-yellow-900/40 text-yellow-300 border border-yellow-500/40';
                }

                tr.innerHTML = `
                    <td class="py-3 font-mono text-xs opacity-80">${new Date(log.timestamp).toLocaleString()}</td>
                    <td class="py-3 font-mono text-xs opacity-90">${log.endpoint}</td>
                    <td class="py-3 text-right">
                        <span class="px-2.5 py-1 text-xs font-semibold rounded-full ${badgeClass}">${log.status}</span>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-red-400">${err.message}</td></tr>`;
    }
}

function refreshCurrentKeyLogs() {
    if (currentLogsModalKeyId) {
        openKeyLogsModal(currentLogsModalKeyId);
    }
}

function closeKeyLogsModal() {
    const modal = document.getElementById('key-logs-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    modal.querySelector('.glass-panel')?.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        currentLogsModalKeyId = null;
    }, 200);
}

function renderChart(metricsData) {
    const chartCanvas = document.getElementById('metricsChart');
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');

    const totalBuckets = 20; // 5 hours / 15 mins = 20 intervals
    const intervalMs = 15 * 60 * 1000; // 15 minutes in ms
    const labels = [];
    const bucketStarts = [];
    const successes = new Array(totalBuckets).fill(0);
    const failures = new Array(totalBuckets).fill(0);

    const now = new Date();
    // Round current time down to the nearest 15-minute mark (0, 15, 30, 45)
    const roundedMinutes = Math.floor(now.getMinutes() / 15) * 15;
    const currentIntervalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0, 0);

    for (let i = totalBuckets - 1; i >= 0; i--) {
        const bucketTime = new Date(currentIntervalStart.getTime() - i * intervalMs);
        const hours = bucketTime.getHours();
        const mins = String(bucketTime.getMinutes()).padStart(2, '0');
        labels.push(`${hours}:${mins}`);
        bucketStarts.push(bucketTime.getTime());
    }

    if (metricsData && Array.isArray(metricsData)) {
        metricsData.forEach(item => {
            const itemMs = new Date(item.timestamp || item.hour).getTime();
            const count = item.count || 1;

            for (let k = 0; k < totalBuckets; k++) {
                const bStart = bucketStarts[k];
                const bEnd = bStart + intervalMs;
                if (itemMs >= bStart && itemMs < bEnd) {
                    if (item.status === 200 || (item.status >= 200 && item.status < 300)) {
                        successes[k] += count;
                    } else if (item.status === 429) {
                        failures[k] += count;
                    }
                    break;
                }
            }
        });
    }

    if (metricsChartInstance) {
        metricsChartInstance.destroy();
    }

    const currentTheme = localStorage.getItem('theme') || 'theme-liquid-dark';
    const isLight = currentTheme.includes('light');
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    Chart.defaults.color = textColor;
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
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { color: gridColor }, ticks: { color: textColor } }
            },
            plugins: {
                legend: { position: 'top', labels: { color: textColor } }
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

// Account Settings Functions
async function sendEmailUpdateOtp() {
    const newEmailEl = document.getElementById('new-email');
    const btnEl = document.getElementById('btn-send-email-otp');
    const btnTextEl = document.getElementById('btn-send-email-otp-text');

    if (!newEmailEl) return;
    const newEmail = newEmailEl.value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmail || !emailRegex.test(newEmail)) {
        alert('Please enter a valid new email address');
        return;
    }

    const originalText = btnTextEl ? btnTextEl.textContent : 'Send OTP to New Email';
    if (btnEl) btnEl.disabled = true;
    if (btnTextEl) btnTextEl.textContent = 'Sending OTP...';

    try {
        const res = await fetch(`${API_URL}/user/email/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ newEmail })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

        // Reveal Step 2
        const step2 = document.getElementById('email-step-2');
        if (step2) step2.classList.remove('hidden');

        if (btnTextEl) btnTextEl.textContent = 'Resend OTP';
        alert(data.message || 'Verification code sent to your new email!');

        const otpEl = document.getElementById('email-otp');
        if (otpEl) otpEl.focus();
    } catch (err) {
        alert(err.message);
        if (btnTextEl) btnTextEl.textContent = originalText;
    } finally {
        if (btnEl) btnEl.disabled = false;
    }
}

async function updateEmail(event) {
    event.preventDefault();
    const newEmail = document.getElementById('new-email')?.value.trim().toLowerCase();
    const otp = document.getElementById('email-otp')?.value.trim();
    const currentPassword = document.getElementById('email-password')?.value;
    const confirmBtn = document.getElementById('btn-confirm-email');
    const confirmBtnText = document.getElementById('btn-confirm-email-text');

    if (!newEmail || !otp || !currentPassword) {
        alert('Please enter your new email, 6-digit OTP code, and current password');
        return;
    }

    if (otp.length !== 6) {
        alert('Please enter a valid 6-digit verification code');
        return;
    }

    if (confirmBtn) confirmBtn.disabled = true;
    if (confirmBtnText) confirmBtnText.textContent = 'Updating Email...';

    try {
        const res = await fetch(`${API_URL}/user/email`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({ newEmail, currentPassword, otp })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update email');

        localStorage.setItem('user', JSON.stringify(data.user));
        const emailEl = document.getElementById('user-email');
        if (emailEl) emailEl.textContent = data.user.email;

        // Reset form
        document.getElementById('new-email').value = '';
        if (document.getElementById('email-otp')) document.getElementById('email-otp').value = '';
        document.getElementById('email-password').value = '';
        const step2 = document.getElementById('email-step-2');
        if (step2) step2.classList.add('hidden');
        const sendBtnText = document.getElementById('btn-send-email-otp-text');
        if (sendBtnText) sendBtnText.textContent = 'Send OTP to New Email';

        alert('Email updated successfully!');
        toggleSettingsPopover();
    } catch (err) {
        alert(err.message);
    } finally {
        if (confirmBtn) confirmBtn.disabled = false;
        if (confirmBtnText) confirmBtnText.textContent = 'Confirm Email Update';
    }
}

async function updatePassword(event) {
    event.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const currentPassword = document.getElementById('password-password').value;

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
        alert(passwordValidation.error);
        return;
    }

    try {
        const res = await fetch(`${API_URL}/user/password`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({ newPassword, currentPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        document.getElementById('new-password').value = '';
        document.getElementById('password-password').value = '';
        alert('Password updated successfully!');
        toggleSettingsPopover();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteAccount(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('delete-password').value;
    
    if (!confirm('Are you ABSOLUTELY sure? This will revoke all API keys and permanently delete your account.')) return;

    try {
        const res = await fetch(`${API_URL}/user/account`, {
            method: 'DELETE',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}` 
            },
            body: JSON.stringify({ currentPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        alert('Account deleted successfully.');
        logout();
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================
// Theme Management & Popover UI Logic
// ==========================================

const ALL_THEMES = ['theme-liquid-dark', 'theme-liquid-light', 'theme-solarized-dark', 'theme-solarized-light'];

function applyTheme(themeName) {
    ALL_THEMES.forEach(t => document.body.classList.remove(t));
    document.body.classList.add(themeName);
    localStorage.setItem('theme', themeName);

    // Sync active highlight on buttons
    document.querySelectorAll('[data-theme]').forEach(btn => {
        if (btn.getAttribute('data-theme') === themeName) {
            btn.classList.add('ring-2', 'ring-blue-400', 'scale-[1.02]');
        } else {
            btn.classList.remove('ring-2', 'ring-blue-400', 'scale-[1.02]');
        }
    });
    
    // Sync chart colors
    if (metricsChartInstance) {
        const isLight = themeName.includes('light');
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
        const textColor = isLight ? '#64748b' : '#94a3b8';

        metricsChartInstance.options.scales.x.grid.color = gridColor;
        metricsChartInstance.options.scales.y.grid.color = gridColor;
        metricsChartInstance.options.scales.x.ticks.color = textColor;
        metricsChartInstance.options.scales.y.ticks.color = textColor;
        if (metricsChartInstance.options.plugins.legend.labels) {
            metricsChartInstance.options.plugins.legend.labels.color = textColor;
        }
        Chart.defaults.color = textColor;
        metricsChartInstance.update();
    }
}

function toggleSettingsPopover() {
    const popover = document.getElementById('settings-popover');
    if (!popover) return;

    if (popover.classList.contains('hidden')) {
        popover.classList.remove('hidden');
        popover.classList.add('flex');
        // trigger animation
        requestAnimationFrame(() => {
            popover.classList.remove('opacity-0', 'scale-95');
            popover.classList.add('opacity-100', 'scale-100');
        });
    } else {
        popover.classList.remove('opacity-100', 'scale-100');
        popover.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            popover.classList.remove('flex');
            popover.classList.add('hidden');
        }, 150);
    }
}

function switchSettingsTab(tabName) {
    const tabs = ['theme', 'profile', 'security', 'danger'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const content = document.getElementById(`tab-content-${t}`);
        if (btn) {
            if (t === tabName) {
                btn.classList.add('bg-white/10', 'border-b-2', 'border-primary', 'opacity-100');
                btn.classList.remove('opacity-70', 'border-transparent');
            } else {
                btn.classList.remove('bg-white/10', 'border-b-2', 'border-primary', 'opacity-100');
                btn.classList.add('opacity-70', 'border-transparent');
            }
        }
        if (content) {
            if (t === tabName) {
                content.classList.remove('hidden');
                content.classList.add('block');
            } else {
                content.classList.remove('block');
                content.classList.add('hidden');
            }
        }
    });
}

// Global DOM Content Loaded Setup
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Saved Theme
    const savedTheme = localStorage.getItem('theme') || 'theme-liquid-dark';
    applyTheme(savedTheme);

    // 2. Settings FAB listener
    const fab = document.getElementById('settings-fab');
    if (fab) {
        fab.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSettingsPopover();
        });
    }

    // 3. Close popover on outside click
    document.addEventListener('click', (e) => {
        const popover = document.getElementById('settings-popover');
        const fabBtn = document.getElementById('settings-fab');
        if (popover && !popover.classList.contains('hidden')) {
            if (!popover.contains(e.target) && (!fabBtn || !fabBtn.contains(e.target))) {
                toggleSettingsPopover();
            }
        }
    });
});

// Export functions to window for explicit inline invocation
window.applyTheme = applyTheme;
window.toggleSettingsPopover = toggleSettingsPopover;
window.switchSettingsTab = switchSettingsTab;
window.handleAuth = handleAuth;
window.sendRegisterOtp = sendRegisterOtp;
window.sendEmailUpdateOtp = sendEmailUpdateOtp;
window.switchTab = switchTab;
window.logout = logout;
window.initDashboard = initDashboard;
window.generateApiKey = generateApiKey;
window.copyKey = copyKey;
window.deleteApiKey = deleteApiKey;
window.testApi = testApi;
window.updateEmail = updateEmail;
window.updatePassword = updatePassword;
window.deleteAccount = deleteAccount;
window.validatePassword = validatePassword;
window.fetchPublicTiers = fetchPublicTiers;
window.onMetricsKeyChange = onMetricsKeyChange;
window.openKeyLogsModal = openKeyLogsModal;
window.closeKeyLogsModal = closeKeyLogsModal;
window.refreshCurrentKeyLogs = refreshCurrentKeyLogs;
