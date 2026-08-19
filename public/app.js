// Global API URL
window.APP_API_URL = '/api';
const API_URL = '/api';

// Utilities
function showMsg(id, text, isError = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = isError
        ? 'badge-status-429 px-4 py-3 rounded-xl text-sm text-center mb-4 block font-bold'
        : 'badge-status-200 px-4 py-3 rounded-xl text-sm text-center mb-4 block font-bold';
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
        tabLogin.className = 'flex-1 py-2 text-sm font-bold rounded-md shadow transition bg-white/10 text-main';
        tabRegister.className = 'flex-1 py-2 text-sm font-medium rounded-md text-muted hover:text-main transition';
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabRegister.className = 'flex-1 py-2 text-sm font-bold rounded-md shadow transition bg-white/10 text-main';
        tabLogin.className = 'flex-1 py-2 text-sm font-medium rounded-md text-muted hover:text-main transition';
        
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
                const tierTitle = config.tierName.charAt(0) + config.tierName.slice(1).toLowerCase();
                option.textContent = `${tierTitle} (Max ${config.maxTierLimit} req/min | ${config.maxEndpoints} Endpoints)`;
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

// ==========================================
// Dashboard State & Proxy Endpoints Logic
// ==========================================
let metricsChartInstance = null;
let currentEndpoints = [];
let selectedMetricsEndpointSlug = 'ALL';
let currentLogsModalEndpointId = null;
let latestCreatedEndpoint = null;
let activeStressEndpoint = null;
let isStressTesting = false;

async function initDashboard() {
    let user = JSON.parse(localStorage.getItem('user'));
    
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
        const tierHint = document.getElementById('tier-limit-hint');

        if (emailEl) emailEl.textContent = user.email;
        if (tierEl) tierEl.textContent = `${user.tier} PLAN`;
        if (tierHint) {
            const maxLimit = user.tier === 'PRO' ? 1000 : 60;
            tierHint.textContent = `Tier maximum: ${maxLimit} req/min for ${user.tier} plan`;
        }

        if (adminLink) {
            if (user.role === 'ADMIN') {
                adminLink.classList.remove('hidden');
                adminLink.classList.add('inline-flex');
            } else {
                adminLink.classList.add('hidden');
                adminLink.classList.remove('inline-flex');
            }
        }

        updateUpgradeButtonState(user.tier, user.upgradeRequest);
    }

    await checkUserNotifications();
    await fetchEndpoints();
    await fetchMetrics();
}

function fillSampleTargetUrl() {
    const targetInput = document.getElementById('target-url');
    if (targetInput) {
        targetInput.value = `${window.location.origin}/api/data`;
    }
}

async function fetchEndpoints() {
    const tbody = document.getElementById('endpoints-tbody');
    const quotaBadge = document.getElementById('endpoints-count-badge');
    if (!tbody) return;

    try {
        const res = await fetch(`${API_URL}/endpoints`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        currentEndpoints = data.endpoints || [];

        const user = JSON.parse(localStorage.getItem('user')) || {};
        const maxEndpoints = user.tier === 'PRO' ? 10 : 3;
        if (quotaBadge) {
            quotaBadge.textContent = `${currentEndpoints.length} / ${maxEndpoints} Endpoints`;
        }

        // Sync Metrics Filter dropdown & Playground selector
        syncEndpointDropdowns(currentEndpoints);

        tbody.innerHTML = '';

        if (currentEndpoints.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-10 text-center text-sm text-muted font-medium">
                        No proxy endpoints created yet. Fill out the form above to deploy your first reverse proxy link.
                    </td>
                </tr>
            `;
            return;
        }

        currentEndpoints.forEach(ep => {
            const rawSlug = String(ep.proxySlug || '');
            const rawUrl = String(ep.targetUrl || '');
            const rawId = String(ep.id || '');
            const fullProxyUrl = `${window.location.origin}/proxy/${encodeURIComponent(rawSlug)}`;
            const escapedSlug = escapeHtml(rawSlug);
            const escapedTargetUrl = escapeHtml(rawUrl);
            const escapedId = escapeHtml(rawId);
            const rateLimitNum = Number(ep.customRateLimit || 60);

            const tr = document.createElement('tr');
            tr.className = 'transition-colors';

            const statusBadge = ep.active
                ? `<span class="px-3 py-1 text-xs font-bold rounded-full badge-status-active">Active</span>`
                : `<span class="px-3 py-1 text-xs font-bold rounded-full badge-status-paused">Paused</span>`;

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono">
                    <div class="flex items-center space-x-2">
                        <span class="font-extrabold text-code font-mono text-xs truncate max-w-[180px] sm:max-w-[240px]" title="${fullProxyUrl}">
                            /proxy/${escapedSlug}
                        </span>
                        <button onclick="copyProxyUrl('${fullProxyUrl}', this)" class="p-1.5 btn-action-copy rounded-lg transition cursor-pointer" title="Copy Full Proxy URL">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                    </div>
                </td>
                <td class="px-6 py-4 text-xs font-mono max-w-[220px] truncate" title="${escapedTargetUrl}">
                    <a href="${escapedTargetUrl}" target="_blank" rel="noopener noreferrer" class="hover:underline text-code font-bold flex items-center">
                        <span class="truncate">${escapedTargetUrl}</span>
                        <svg class="w-3.5 h-3.5 ml-1 flex-shrink-0 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-xs">
                    <span class="px-3 py-1 font-bold rounded-lg badge-status-warn font-mono">
                        ${rateLimitNum} req/min
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-xs cursor-pointer" onclick="toggleEndpointActive('${escapedId}')" title="Click to toggle active/pause">
                    ${statusBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                    <button onclick="copyProxyUrl('${fullProxyUrl}', this)" class="btn-action-copy inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer" title="Copy URL">
                        <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        Copy
                    </button>
                    <button onclick="openStressTestModal('${escapedId}')" class="gradient-btn-fire inline-flex items-center text-xs font-extrabold px-3.5 py-1.5 rounded-lg transition shadow cursor-pointer" title="Stress Test Rate Limit">
                        🔥 Stress
                    </button>
                    <button onclick="openEndpointLogsModal('${escapedId}')" class="btn-action-logs inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer" title="View Request Telemetry">
                        <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        Logs
                    </button>
                    <button onclick="deleteEndpoint('${escapedId}')" class="btn-action-delete inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">
                        Delete
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Failed to fetch endpoints', err);
    }
}

function syncEndpointDropdowns(endpoints) {
    const metricsSelect = document.getElementById('metrics-endpoint-select');
    const playgroundSelect = document.getElementById('test-proxy-slug');

    if (metricsSelect) {
        const curVal = selectedMetricsEndpointSlug;
        metricsSelect.innerHTML = '<option value="ALL">All Endpoints (Combined)</option>';
        endpoints.forEach((ep) => {
            const opt = document.createElement('option');
            opt.value = ep.proxySlug;
            opt.textContent = `[${ep.proxySlug}] (${ep.customRateLimit} req/min) - ${ep.targetUrl.substring(0, 30)}...`;
            metricsSelect.appendChild(opt);
        });
        metricsSelect.value = curVal;
    }

    if (playgroundSelect) {
        playgroundSelect.innerHTML = '<option value="">Select Proxy Endpoint...</option>';
        endpoints.forEach(ep => {
            const opt = document.createElement('option');
            opt.value = ep.proxySlug;
            opt.textContent = `/proxy/${ep.proxySlug} (${ep.customRateLimit} req/min)`;
            playgroundSelect.appendChild(opt);
        });
    }
}

async function handleCreateEndpoint(event) {
    event.preventDefault();
    const targetUrlInput = document.getElementById('target-url');
    const rateLimitInput = document.getElementById('custom-rate-limit');
    const submitBtn = document.getElementById('btn-create-endpoint');
    const btnText = document.getElementById('btn-create-endpoint-text');

    if (!targetUrlInput || !rateLimitInput) return;

    const targetUrl = targetUrlInput.value.trim();
    const customRateLimit = parseInt(rateLimitInput.value, 10);

    if (!targetUrl || isNaN(customRateLimit) || customRateLimit < 1) {
        alert('Please provide a valid Target URL and Rate Limit (minimum 1)');
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Generating Gateway Route...';

    try {
        const res = await fetch(`${API_URL}/endpoints`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ targetUrl, customRateLimit })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create endpoint');

        const ep = data.endpoint;
        latestCreatedEndpoint = ep;

        // Reveal Success Alert
        const alertBox = document.getElementById('new-endpoint-alert');
        const valueBox = document.getElementById('new-endpoint-value');
        const fullUrl = `${window.location.origin}/proxy/${ep.proxySlug}`;

        if (valueBox) valueBox.textContent = fullUrl;
        if (alertBox) alertBox.classList.remove('hidden');

        // Reset form
        targetUrlInput.value = '';
        rateLimitInput.value = '';

        await fetchEndpoints();
        await fetchMetrics(selectedMetricsEndpointSlug);
    } catch (err) {
        alert(err.message);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.textContent = 'Generate Proxy Gateway URL';
    }
}

function launchStressFromAlert() {
    if (latestCreatedEndpoint) {
        openStressTestModal(latestCreatedEndpoint.id);
    }
}

function copyProxyUrl(text, btn) {
    let copyText = text;
    if (!copyText) {
        const valBox = document.getElementById('new-endpoint-value');
        if (valBox) copyText = valBox.textContent;
    }
    if (!copyText) return;

    navigator.clipboard.writeText(copyText).then(() => {
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = `
                <svg class="w-4 h-4 mr-1 text-green-500 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                <span class="text-green-500 font-bold">Copied!</span>
            `;
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
        } else {
            alert('Proxy URL copied to clipboard!');
        }
    }).catch(err => {
        console.error('Copy failed: ', err);
    });
}

async function toggleEndpointActive(id) {
    try {
        const res = await fetch(`${API_URL}/endpoints/${id}/toggle`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to toggle status');
        }
        await fetchEndpoints();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteEndpoint(id) {
    if (!confirm('Are you sure you want to delete this proxy endpoint? All incoming traffic to this slug will immediately return 404.')) return;

    try {
        const res = await fetch(`${API_URL}/endpoints/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete endpoint');

        await fetchEndpoints();
        await fetchMetrics(selectedMetricsEndpointSlug);
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================
// Metrics Visualization Logic
// ==========================================
function onMetricsEndpointChange(slug) {
    selectedMetricsEndpointSlug = slug;
    fetchMetrics(slug);
}

async function fetchMetrics(slug = selectedMetricsEndpointSlug) {
    const chartEl = document.getElementById('metricsChart');
    if (!chartEl) return;

    try {
        const url = slug && slug !== 'ALL'
            ? `${API_URL}/metrics?proxySlug=${encodeURIComponent(slug)}`
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

function renderChart(metricsData) {
    const chartCanvas = document.getElementById('metricsChart');
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');

    const totalBuckets = 20;
    const intervalMs = 15 * 60 * 1000;
    const labels = [];
    const bucketStarts = [];
    const successes = new Array(totalBuckets).fill(0);
    const failures = new Array(totalBuckets).fill(0);

    const now = new Date();
    const roundedMinutes = Math.floor(now.getMinutes() / 15) * 15;
    const currentIntervalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), roundedMinutes, 0, 0);

    for (let i = totalBuckets - 1; i >= 0; i--) {
        const bucketTime = new Date(currentIntervalStart.getTime() - i * intervalMs);
        const hours = String(bucketTime.getHours()).padStart(2, '0');
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
    const textColor = isLight ? '#475569' : '#94a3b8';

    Chart.defaults.color = textColor;
    metricsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Successful Forwarded (200 OK)',
                    data: successes,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    borderWidth: 2.5,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Rate Limited (429 Blocked)',
                    data: failures,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderWidth: 2.5,
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } },
                x: { grid: { color: gridColor }, ticks: { color: textColor } }
            },
            plugins: {
                legend: { position: 'top', labels: { color: textColor, font: { weight: 'bold' } } }
            }
        }
    });
}

// ==========================================
// STRESS TESTING MODULE
// ==========================================
function openStressTestModal(endpointId) {
    const ep = currentEndpoints.find(e => e.id === endpointId);
    if (!ep) return alert('Endpoint not found');

    activeStressEndpoint = ep;
    const modal = document.getElementById('stress-test-modal');
    const proxyUrlEl = document.getElementById('stress-proxy-url');
    const targetUrlEl = document.getElementById('stress-target-url');
    const limitBadge = document.getElementById('stress-limit-badge');

    if (proxyUrlEl) proxyUrlEl.textContent = `/proxy/${ep.proxySlug}`;
    if (targetUrlEl) targetUrlEl.textContent = ep.targetUrl;
    if (limitBadge) limitBadge.textContent = `${ep.customRateLimit} req/min`;

    resetStressTestUI();

    if (modal) {
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('.glass-panel')?.classList.remove('scale-95');
        });
    }
}

function closeStressTestModal() {
    const modal = document.getElementById('stress-test-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    modal.querySelector('.glass-panel')?.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        activeStressEndpoint = null;
    }, 200);
}

function setStressCount(num) {
    const input = document.getElementById('stress-request-count');
    if (input) input.value = num;
}

function resetStressTestUI() {
    const progressFill = document.getElementById('stress-progress-fill');
    const progressText = document.getElementById('stress-progress-text');
    const countTotal = document.getElementById('stress-count-total');
    const count200 = document.getElementById('stress-count-200');
    const count429 = document.getElementById('stress-count-429');
    const verdict = document.getElementById('stress-verdict-banner');
    const waterfall = document.getElementById('stress-waterfall-tbody');

    if (progressFill) {
        progressFill.style.width = '0%';
        progressFill.className = 'h-full rounded-full transition-all duration-150 stress-progress-bar';
    }
    if (progressText) progressText.textContent = '0% (0 / 0)';
    if (countTotal) countTotal.textContent = '0';
    if (count200) count200.textContent = '0';
    if (count429) count429.textContent = '0';
    if (verdict) {
        verdict.className = 'hidden p-3 rounded-xl border text-xs font-bold text-center';
        verdict.innerHTML = '';
    }
    if (waterfall) {
        waterfall.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-muted font-sans text-xs font-medium">Ready. Click "FIRE CONCURRENT REQUESTS" to begin.</td></tr>`;
    }
}

async function runStressTest() {
    if (isStressTesting || !activeStressEndpoint) return;

    const countInput = document.getElementById('stress-request-count');
    let count = parseInt(countInput?.value || '20', 10);
    if (isNaN(count) || count < 1) count = 10;
    if (count > 50) count = 50;
    if (countInput) countInput.value = count;

    isStressTesting = true;
    const fireBtn = document.getElementById('btn-fire-stress');
    const fireBtnText = document.getElementById('btn-fire-stress-text');
    const fireBtnIcon = document.getElementById('btn-fire-stress-icon');

    if (fireBtn) fireBtn.disabled = true;
    if (fireBtnText) fireBtnText.textContent = `FIRING ${count} CONCURRENT REQUESTS...`;
    if (fireBtnIcon) fireBtnIcon.innerHTML = `<svg class="animate-spin h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>`;

    resetStressTestUI();
    const waterfallTbody = document.getElementById('stress-waterfall-tbody');
    if (waterfallTbody) waterfallTbody.innerHTML = '';

    const proxyEndpointUrl = `/proxy/${activeStressEndpoint.proxySlug}`;
    const limit = activeStressEndpoint.customRateLimit;

    let completed = 0;
    let successCount = 0;
    let rateLimitedCount = 0;
    let errorCount = 0;

    const countTotalEl = document.getElementById('stress-count-total');
    const count200El = document.getElementById('stress-count-200');
    const count429El = document.getElementById('stress-count-429');
    const progressFillEl = document.getElementById('stress-progress-fill');
    const progressTextEl = document.getElementById('stress-progress-text');

    const updateCounters = () => {
        if (countTotalEl) countTotalEl.textContent = completed;
        if (count200El) count200El.textContent = successCount;
        if (count429El) count429El.textContent = rateLimitedCount;
        const pct = Math.round((completed / count) * 100);
        if (progressFillEl) progressFillEl.style.width = `${pct}%`;
        if (progressTextEl) progressTextEl.textContent = `${pct}% (${completed} / ${count})`;
    };

    const appendWaterfallRow = (idx, status, latencyMs) => {
        if (!waterfallTbody) return;
        const tr = document.createElement('tr');
        tr.className = 'transition-colors animate-fadeIn';

        let badgeClass = 'badge-status-paused';
        let statusLabel = `${status}`;
        if (status === 200 || (status >= 200 && status < 300)) {
            badgeClass = 'badge-status-200';
            statusLabel = `${status} ALLOWED`;
        } else if (status === 429) {
            badgeClass = 'badge-status-429';
            statusLabel = `429 BLOCKED`;
        } else {
            badgeClass = 'badge-status-warn';
        }

        const timestamp = new Date().toLocaleTimeString();
        tr.innerHTML = `
            <td class="py-2.5 px-3 text-muted">#${idx + 1}</td>
            <td class="py-2.5 px-3 text-main font-medium">${timestamp}</td>
            <td class="py-2.5 px-3 text-latency font-bold font-mono">${latencyMs} ms</td>
            <td class="py-2.5 px-3 text-right">
                <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeClass}">
                    ${statusLabel}
                </span>
            </td>
        `;
        waterfallTbody.insertBefore(tr, waterfallTbody.firstChild);
    };

    const promises = Array.from({ length: count }, async (_, index) => {
        const startTime = performance.now();
        try {
            const res = await fetch(proxyEndpointUrl, {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);

            completed++;
            if (res.status === 200 || (res.status >= 200 && res.status < 300)) {
                successCount++;
            } else if (res.status === 429) {
                rateLimitedCount++;
            } else {
                errorCount++;
            }

            appendWaterfallRow(index, res.status, latency);
            updateCounters();
        } catch (err) {
            const endTime = performance.now();
            const latency = Math.round(endTime - startTime);
            completed++;
            errorCount++;
            appendWaterfallRow(index, 502, latency);
            updateCounters();
        }
    });

    await Promise.all(promises);

    // Render Verdict Banner
    const verdictBanner = document.getElementById('stress-verdict-banner');
    if (verdictBanner) {
        verdictBanner.classList.remove('hidden');
        if (rateLimitedCount > 0) {
            verdictBanner.className = 'p-3.5 rounded-xl border text-xs font-bold text-center badge-status-200 glow-success';
            verdictBanner.innerHTML = `
                <div class="flex items-center justify-center space-x-2">
                    <span class="text-base">🛡️</span>
                    <span>Rate Limiter Verified! Gatekeeper successfully passed ${successCount} requests and throttled ${rateLimitedCount} excess requests with HTTP 429.</span>
                </div>
            `;
        } else {
            verdictBanner.className = 'p-3.5 rounded-xl border text-xs font-bold text-center badge-quota';
            verdictBanner.innerHTML = `
                <div class="flex items-center justify-center space-x-2">
                    <span>⚡ All ${successCount} requests passed within your ${limit} req/min window.</span>
                </div>
            `;
        }
    }

    isStressTesting = false;
    if (fireBtn) fireBtn.disabled = false;
    if (fireBtnText) fireBtnText.textContent = 'FIRE AGAIN';
    if (fireBtnIcon) fireBtnIcon.textContent = '🔥';

    // Auto-refresh Dashboard telemetry
    setTimeout(fetchMetrics, 800);
}

// ==========================================
// Quick Gateway Playground Tester
// ==========================================
async function testProxyGateway() {
    const slugSelect = document.getElementById('test-proxy-slug');
    const methodSelect = document.getElementById('test-http-method');
    const subpathInput = document.getElementById('test-subpath');
    const resultBox = document.getElementById('test-api-result');

    const slug = slugSelect?.value;
    const method = methodSelect?.value || 'GET';
    const subpath = (subpathInput?.value || '').trim();

    if (!slug) return alert('Please select a proxy endpoint from the dropdown.');

    let url = `/proxy/${slug}`;
    if (subpath) {
        if (!subpath.startsWith('/') && !subpath.startsWith('?')) {
            url += `/${subpath}`;
        } else {
            url += subpath;
        }
    }

    if (resultBox) {
        resultBox.classList.remove('hidden');
        resultBox.textContent = `Dispatching [${method}] request to ${url}...`;
    }

    const startTime = performance.now();
    try {
        const res = await fetch(url, { method });
        const latency = Math.round(performance.now() - startTime);
        
        let responseBodyText = '';
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await res.json();
            responseBodyText = JSON.stringify(data, null, 2);
        } else {
            responseBodyText = await res.text();
        }

        const headersObj = {};
        res.headers.forEach((val, key) => { headersObj[key] = val; });

        if (resultBox) {
            resultBox.textContent = `HTTP ${res.status} ${res.statusText} (${latency} ms)\n\n--- Gateway & Target Headers ---\n${JSON.stringify(headersObj, null, 2)}\n\n--- Response Body ---\n${responseBodyText}`;
            if (res.status === 429) {
                resultBox.className = 'mt-4 border p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-60 block badge-status-429';
            } else if (res.ok) {
                resultBox.className = 'mt-4 border p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-60 block badge-status-200';
            } else {
                resultBox.className = 'mt-4 border p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-60 block badge-status-warn';
            }
        }

        setTimeout(fetchMetrics, 500);
    } catch (err) {
        if (resultBox) {
            resultBox.textContent = `Request Failed: ${err.message}`;
            resultBox.className = 'mt-4 border p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-60 block badge-status-429';
        }
    }
}

// ==========================================
// Endpoint Request Logs Modal
// ==========================================
async function openEndpointLogsModal(endpointId) {
    currentLogsModalEndpointId = endpointId;
    const modal = document.getElementById('key-logs-modal');
    const subtitle = document.getElementById('modal-key-subtitle');
    const totalEl = document.getElementById('modal-stat-total');
    const successEl = document.getElementById('modal-stat-success');
    const limitedEl = document.getElementById('modal-stat-limited');
    const tbody = document.getElementById('modal-logs-tbody');

    if (!modal) return;

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('.glass-panel')?.classList.remove('scale-95');
    });

    if (subtitle) subtitle.textContent = `Loading endpoint logs...`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-muted font-medium">Fetching telemetry logs...</td></tr>`;

    try {
        const res = await fetch(`${API_URL}/endpoints/${endpointId}/logs`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch logs');

        const { endpoint, stats, logs } = data;

        if (subtitle) subtitle.textContent = `/proxy/${endpoint.proxySlug} -> ${endpoint.targetUrl}`;
        if (totalEl) totalEl.textContent = stats.totalRequests || 0;
        if (successEl) successEl.textContent = stats.successCount || 0;
        if (limitedEl) limitedEl.textContent = stats.rateLimitedCount || 0;

        if (tbody) {
            tbody.innerHTML = '';
            if (!logs || logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-muted font-medium">No requests recorded for this proxy endpoint yet.</td></tr>`;
                return;
            }

            logs.forEach(log => {
                const tr = document.createElement('tr');
                tr.className = 'transition-colors';

                let badgeClass = 'badge-status-paused';
                if (log.status === 200 || (log.status >= 200 && log.status < 300)) {
                    badgeClass = 'badge-status-200';
                } else if (log.status === 429) {
                    badgeClass = 'badge-status-429';
                } else if (log.status >= 400) {
                    badgeClass = 'badge-status-warn';
                }

                const logTime = escapeHtml(new Date(log.timestamp).toLocaleString());
                const logMethod = escapeHtml(log.method || 'GET');
                const logEndpoint = escapeHtml(log.endpoint || '');
                const logStatus = Number(log.status || 200);

                tr.innerHTML = `
                    <td class="py-3 px-3 font-mono text-xs text-muted font-medium">${logTime}</td>
                    <td class="py-3 px-3 font-mono text-xs font-bold text-main">${logMethod}</td>
                    <td class="py-3 px-3 font-mono text-xs text-main truncate max-w-xs font-medium">${logEndpoint}</td>
                    <td class="py-3 px-3 text-right">
                        <span class="px-2.5 py-1 text-xs font-bold rounded-full ${badgeClass}">${logStatus}</span>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-red-500 font-bold">${err.message}</td></tr>`;
    }
}

function refreshCurrentKeyLogs() {
    if (currentLogsModalEndpointId) {
        openEndpointLogsModal(currentLogsModalEndpointId);
    }
}

function closeKeyLogsModal() {
    const modal = document.getElementById('key-logs-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    modal.querySelector('.glass-panel')?.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        currentLogsModalEndpointId = null;
    }, 200);
}

// ==========================================
// Account Settings & Profile
// ==========================================
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
    
    if (!confirm('Are you ABSOLUTELY sure? This will delete all proxy endpoints and permanently delete your account.')) return;

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

    document.querySelectorAll('[data-theme]').forEach(btn => {
        if (btn.getAttribute('data-theme') === themeName) {
            btn.classList.add('ring-2', 'ring-blue-500', 'scale-[1.02]');
        } else {
            btn.classList.remove('ring-2', 'ring-blue-500', 'scale-[1.02]');
        }
    });

    if (metricsChartInstance) {
        const isLight = themeName.includes('light');
        const gridColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
        const textColor = isLight ? '#475569' : '#94a3b8';

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
                btn.classList.add('bg-white/10', 'border-b-2', 'border-primary', 'text-main');
                btn.classList.remove('text-muted', 'border-transparent');
            } else {
                btn.classList.remove('bg-white/10', 'border-b-2', 'border-primary', 'text-main');
                btn.classList.add('text-muted', 'border-transparent');
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

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'theme-liquid-dark';
    applyTheme(savedTheme);

    const fab = document.getElementById('settings-fab');
    if (fab) {
        fab.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSettingsPopover();
        });
    }

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

// Upgrade and Notification Utilities
function updateUpgradeButtonState(tier, upgradeRequest) {
    const upgradeBtn = document.getElementById('btn-upgrade-pro');
    if (!upgradeBtn) return;

    if (tier === 'PRO') {
        upgradeBtn.classList.add('hidden');
        upgradeBtn.classList.remove('inline-flex');
    } else {
        upgradeBtn.classList.remove('hidden');
        upgradeBtn.classList.add('inline-flex');

        if (upgradeRequest && upgradeRequest.status === 'PENDING') {
            upgradeBtn.disabled = true;
            upgradeBtn.innerHTML = '<span id="btn-upgrade-text">⏳ Upgrade Pending Review</span>';
            upgradeBtn.className = 'inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed opacity-80';
        } else {
            upgradeBtn.disabled = false;
            upgradeBtn.innerHTML = '<span id="btn-upgrade-text">⭐ Upgrade to Pro</span>';
            upgradeBtn.className = 'inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md transition-all cursor-pointer';
        }
    }
}

async function handleUpgradeRequest() {
    const btn = document.getElementById('btn-upgrade-pro');
    if (!btn || btn.disabled) return;

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Submitting...</span>';

    try {
        const res = await fetch(`${API_URL}/user/upgrade-request`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit upgrade request');

        showNotificationBanner({
            type: 'info',
            title: 'Upgrade Request Submitted',
            message: data.message || 'Your request to upgrade to the PRO plan has been submitted for admin approval.'
        });

        updateUpgradeButtonState('FREE', { status: 'PENDING' });
    } catch (err) {
        showNotificationBanner({
            type: 'error',
            title: 'Upgrade Request Failed',
            message: err.message
        });
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

async function checkUserNotifications() {
    try {
        const res = await fetch(`${API_URL}/user/notifications`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.hasNotification && data.message) {
            const isApproved = data.message.toLowerCase().includes('approved');
            showNotificationBanner({
                type: isApproved ? 'success' : 'warning',
                title: isApproved ? 'Plan Upgrade Approved! 🎉' : 'Upgrade Request Update',
                message: data.message
            });

            if (data.tier) {
                let user = JSON.parse(localStorage.getItem('user')) || {};
                user.tier = data.tier;
                localStorage.setItem('user', JSON.stringify(user));

                const tierEl = document.getElementById('user-tier');
                if (tierEl) tierEl.textContent = `${data.tier} PLAN`;

                const tierHint = document.getElementById('tier-limit-hint');
                if (tierHint) {
                    const maxLimit = data.tier === 'PRO' ? 1000 : 60;
                    tierHint.textContent = `Tier maximum: ${maxLimit} req/min for ${data.tier} plan`;
                }

                updateUpgradeButtonState(data.tier, null);
            }
        }
    } catch (err) {
        console.error('Failed to check notifications:', err);
    }
}

function showNotificationBanner({ type = 'info', title, message }) {
    const banner = document.getElementById('notification-banner');
    const iconEl = document.getElementById('notification-icon');
    const titleEl = document.getElementById('notification-title');
    const msgEl = document.getElementById('notification-message');
    if (!banner || !titleEl || !msgEl) return;

    titleEl.textContent = title;
    msgEl.textContent = message;

    if (type === 'success') {
        if (iconEl) iconEl.textContent = '🎉';
        banner.className = 'rounded-xl p-4 transition-all duration-300 shadow-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    } else if (type === 'warning' || type === 'error') {
        if (iconEl) iconEl.textContent = '⚠️';
        banner.className = 'rounded-xl p-4 transition-all duration-300 shadow-lg border border-rose-500/40 bg-rose-500/10 text-rose-300';
    } else {
        if (iconEl) iconEl.textContent = 'ℹ️';
        banner.className = 'rounded-xl p-4 transition-all duration-300 shadow-lg border border-blue-500/40 bg-blue-500/10 text-blue-300';
    }

    banner.classList.remove('hidden');
}

function dismissNotification() {
    const banner = document.getElementById('notification-banner');
    if (banner) banner.classList.add('hidden');
}

// Google Authentication Integration
let currentGoogleClientId = '';

async function initGoogleAuth() {
    try {
        const res = await fetch(`${API_URL}/auth/config`);
        if (!res.ok) return;
        const data = await res.json();
        currentGoogleClientId = data.googleClientId || '';

        if (currentGoogleClientId) {
            const setupGsi = () => {
                if (window.google && window.google.accounts && window.google.accounts.id) {
                    window.google.accounts.id.initialize({
                        client_id: currentGoogleClientId,
                        callback: handleGoogleCredentialResponse,
                        auto_select: false,
                        cancel_on_tap_outside: true
                    });

                    const container = document.getElementById('g_id_signin_container');
                    if (container) {
                        container.innerHTML = '';
                        window.google.accounts.id.renderButton(container, {
                            theme: 'filled_black',
                            size: 'large',
                            shape: 'pill',
                            width: 320,
                            text: 'continue_with'
                        });
                    }
                } else {
                    setTimeout(setupGsi, 100);
                }
            };
            setupGsi();
        }
    } catch (err) {
        console.warn('Google Auth config fetch failed:', err);
    }
}

function triggerGoogleSignIn() {
    if (currentGoogleClientId && window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
    } else {
        showMsg(
            'error-msg',
            'Google Sign-In is ready! To activate in your environment, add GOOGLE_CLIENT_ID to your .env file.',
            true
        );
    }
}

async function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
        showMsg('error-msg', 'Failed to retrieve Google authentication credentials.');
        return;
    }

    hideMsg('error-msg');

    try {
        const res = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Google authentication failed');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        window.location.href = '/dashboard.html';
    } catch (err) {
        showMsg('error-msg', err.message);
    }
}

// Window exports
window.applyTheme = applyTheme;
window.toggleSettingsPopover = toggleSettingsPopover;
window.switchSettingsTab = switchSettingsTab;
window.handleAuth = handleAuth;
window.sendRegisterOtp = sendRegisterOtp;
window.sendEmailUpdateOtp = sendEmailUpdateOtp;
window.switchTab = switchTab;
window.logout = logout;
window.initDashboard = initDashboard;
window.fetchEndpoints = fetchEndpoints;
window.handleCreateEndpoint = handleCreateEndpoint;
window.copyProxyUrl = copyProxyUrl;
window.toggleEndpointActive = toggleEndpointActive;
window.deleteEndpoint = deleteEndpoint;
window.fillSampleTargetUrl = fillSampleTargetUrl;
window.onMetricsEndpointChange = onMetricsEndpointChange;
window.openStressTestModal = openStressTestModal;
window.closeStressTestModal = closeStressTestModal;
window.setStressCount = setStressCount;
window.runStressTest = runStressTest;
window.launchStressFromAlert = launchStressFromAlert;
window.openEndpointLogsModal = openEndpointLogsModal;
window.closeKeyLogsModal = closeKeyLogsModal;
window.refreshCurrentKeyLogs = refreshCurrentKeyLogs;
window.testProxyGateway = testProxyGateway;
window.updateEmail = updateEmail;
window.updatePassword = updatePassword;
window.deleteAccount = deleteAccount;
window.validatePassword = validatePassword;
window.fetchPublicTiers = fetchPublicTiers;
window.handleUpgradeRequest = handleUpgradeRequest;
window.checkUserNotifications = checkUserNotifications;
window.dismissNotification = dismissNotification;
window.updateUpgradeButtonState = updateUpgradeButtonState;
window.showNotificationBanner = showNotificationBanner;
window.initGoogleAuth = initGoogleAuth;
window.triggerGoogleSignIn = triggerGoogleSignIn;
window.handleGoogleCredentialResponse = handleGoogleCredentialResponse;


