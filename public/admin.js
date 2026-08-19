const ADMIN_API_URL = '/api/admin';

// Utilities
function showAlert(msg, isError = false) {
    const box = document.getElementById('alert-box');
    const msgEl = document.getElementById('alert-msg');
    if (!box || !msgEl) return;
    
    msgEl.textContent = msg;
    box.className = `rounded-xl p-4 mb-4 text-sm font-bold shadow-lg transition-all duration-300 transform translate-y-0 opacity-100 ${
        isError ? 'badge-status-429' : 'badge-status-200'
    }`;
    box.classList.remove('hidden');

    setTimeout(() => {
        box.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => box.classList.add('hidden'), 300);
    }, 4000);
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

function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    };
}

// Initialization
async function initAdmin() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        const emailEl = document.getElementById('admin-email');
        if (emailEl) emailEl.textContent = user.email;
    }
    
    await Promise.all([
        fetchUpgradeRequests(),
        fetchConfigs(),
        fetchUsers()
    ]);
}

// Fetch and Render Pending Upgrade Requests
async function fetchUpgradeRequests() {
    const tbody = document.getElementById('upgrade-requests-tbody');
    const badgeNav = document.getElementById('pending-badge-nav');
    const badgeCount = document.getElementById('upgrade-count-badge');
    if (!tbody) return;

    try {
        const res = await fetch(`${ADMIN_API_URL}/upgrade-requests`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch upgrade requests');
        const data = await res.json();
        const requests = data.requests || [];

        // Update badges
        if (badgeCount) badgeCount.textContent = `${requests.length} Pending`;
        if (badgeNav) {
            badgeNav.textContent = requests.length;
            if (requests.length > 0) {
                badgeNav.classList.remove('hidden');
            } else {
                badgeNav.classList.add('hidden');
            }
        }

        tbody.innerHTML = '';

        if (requests.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-muted font-medium text-sm">No pending upgrade requests.</td></tr>`;
            return;
        }

        requests.forEach(req => {
            const tr = document.createElement('tr');
            tr.id = `upgrade-req-${req.id}`;
            tr.className = 'transition-colors hover:bg-white/5';

            const userEmail = escapeHtml(req.user?.email || 'Unknown');
            const userTier = escapeHtml(req.user?.tier || 'FREE');
            const reqDate = escapeHtml(new Date(req.createdAt).toLocaleString());
            const reqId = escapeHtml(req.id);
            const userId = escapeHtml(req.userId || '');

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-9 w-9 rounded-full badge-quota flex items-center justify-center font-bold text-sm">
                            ${userEmail.charAt(0).toUpperCase()}
                        </div>
                        <div class="ml-3.5">
                            <div class="text-sm font-bold text-main">${userEmail}</div>
                            <div class="text-xs text-muted font-mono font-medium" title="${userId}">User ID: ${userId.substring(0,8)}...</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2.5 py-1 text-xs font-bold rounded-full badge-status-active">${userTier}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-xs text-muted font-mono font-medium">
                    ${reqDate}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button onclick="handleUpgradeRequestAction('${reqId}', 'APPROVE')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all cursor-pointer inline-flex items-center">
                        <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Approve
                    </button>
                    <button onclick="handleUpgradeRequestAction('${reqId}', 'REJECT')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow transition-all cursor-pointer inline-flex items-center">
                        <svg class="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Decline
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        showAlert(error.message, true);
    }
}

async function handleUpgradeRequestAction(requestId, action) {
    const isApprove = action === 'APPROVE';
    const actionLabel = isApprove ? 'approve' : 'decline';

    if (!confirm(`Are you sure you want to ${actionLabel} this upgrade request?`)) return;

    try {
        const res = await fetch(`${ADMIN_API_URL}/upgrade-requests/${requestId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to ${actionLabel} upgrade request`);

        showAlert(data.message || `Upgrade request ${actionLabel}d successfully`);

        const row = document.getElementById(`upgrade-req-${requestId}`);
        if (row) {
            row.remove();
        }

        await Promise.all([
            fetchUpgradeRequests(),
            fetchUsers()
        ]);
    } catch (error) {
        showAlert(error.message, true);
    }
}

// Fetch and Render Configs
async function fetchConfigs() {
    try {
        const res = await fetch(`${ADMIN_API_URL}/config/tiers`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch configs');
        const data = await res.json();
        
        const container = document.getElementById('configs-container');
        if (!container) return;
        container.innerHTML = '';
        
        data.configs.forEach(config => {
            const el = document.createElement('div');
            el.className = 'glass-panel p-6 flex flex-col space-y-4 relative transition-colors duration-300';
            
            const badgeClass = config.tierName === 'PRO' 
                ? 'badge-status-warn' 
                : 'badge-status-active';
            
            el.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <h3 class="font-bold text-lg tracking-tight text-main">${config.tierName} Tier</h3>
                    <span class="px-3 py-1 text-xs font-bold rounded-full border ${badgeClass}">${config.tierName}</span>
                </div>
                
                <div class="space-y-4 flex-grow">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-main">Max Tier Rate Limit (req/min)</label>
                        <input type="number" id="limit-${config.id}" value="${config.maxTierLimit}" class="w-full glass-input rounded-lg px-3.5 py-2 text-sm font-bold">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-main">Max Allowed Proxy Endpoints</label>
                        <input type="number" id="endpoints-${config.id}" value="${config.maxEndpoints || 3}" class="w-full glass-input rounded-lg px-3.5 py-2 text-sm font-bold">
                    </div>
                </div>
                
                <button onclick="updateConfig('${config.id}')" class="mt-4 w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg transition-colors shadow-lg flex justify-center items-center cursor-pointer">
                    <span>Save Changes</span>
                </button>
            `;
            container.appendChild(el);
        });
    } catch (error) {
        showAlert(error.message, true);
    }
}

async function updateConfig(id) {
    const maxTierLimit = document.getElementById(`limit-${id}`).value;
    const maxEndpoints = document.getElementById(`endpoints-${id}`).value;
    
    try {
        const res = await fetch(`${ADMIN_API_URL}/config/tiers/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ maxTierLimit, maxEndpoints })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update tier');
        
        showAlert('Tier configuration updated successfully.');
        fetchConfigs();
    } catch (error) {
        showAlert(error.message, true);
    }
}

let lastUsersStr = '';

// Fetch and Render Users
async function fetchUsers() {
    try {
        const res = await fetch(`${ADMIN_API_URL}/users`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        
        const newStr = JSON.stringify(data.users);
        if (newStr === lastUsersStr && document.getElementById('users-tbody').children.length > 0) return;
        lastUsersStr = newStr;

        const badge = document.getElementById('user-count-badge');
        if (badge) badge.textContent = `${data.users.length} Users Total`;
        
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (data.users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-muted font-medium text-sm">No users found.</td></tr>`;
            return;
        }
        
        data.users.forEach(u => {
            const tr = document.createElement('tr');
            
            const isBanned = u.isBanned;
            const rowClass = isBanned ? 'badge-status-429' : 'transition-colors';
            tr.className = rowClass;
            
            const banBtnClass = isBanned 
                ? 'btn-action-copy font-bold' 
                : 'btn-action-delete font-bold';
                
            const banBtnText = isBanned ? 'Unban User' : 'Ban User';
            const userEmail = escapeHtml(u.email);
            const userId = escapeHtml(u.id);
            const userRole = escapeHtml(u.role);
            const userTier = escapeHtml(u.tier);
            const endpointsCount = Number(u.endpointsCount || 0);
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 rounded-full badge-quota flex items-center justify-center font-bold text-sm">
                            ${userEmail.charAt(0).toUpperCase()}
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-bold text-main ${isBanned ? 'line-through text-red-500' : ''}">${userEmail}</div>
                            <div class="text-xs text-muted font-mono font-medium" title="${userId}">ID: ${userId.substring(0,8)}...</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-bold mb-1 text-main">${userRole}</div>
                    <div class="text-xs text-muted flex items-center font-medium">
                        <svg class="w-3.5 h-3.5 mr-1 text-code" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        ${endpointsCount} Endpoints
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <select onchange="updateRole('${userId}', this.value)" class="glass-input text-xs rounded-lg block px-2.5 py-1.5 cursor-pointer font-bold outline-none mb-1.5" ${isBanned ? 'disabled' : ''}>
                        <option value="USER" ${u.role === 'USER' ? 'selected' : ''}>USER</option>
                        <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                    </select>
                    <select onchange="updateTier('${userId}', this.value)" class="glass-input text-xs rounded-lg block px-2.5 py-1.5 cursor-pointer font-bold outline-none" ${isBanned ? 'disabled' : ''}>
                        <option value="FREE" ${u.tier === 'FREE' ? 'selected' : ''}>FREE PLAN</option>
                        <option value="PRO" ${u.tier === 'PRO' ? 'selected' : ''}>PRO PLAN</option>
                    </select>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="toggleBan('${userId}', ${!isBanned})" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${banBtnClass}">
                        ${banBtnText}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        showAlert(error.message, true);
    }
}

async function updateTier(userId, tier) {
    try {
        const res = await fetch(`${ADMIN_API_URL}/users/${userId}/tier`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tier })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update tier');
        
        showAlert('User tier updated successfully.');
        fetchUsers();
    } catch (error) {
        showAlert(error.message, true);
        fetchUsers();
    }
}

async function updateRole(userId, role) {
    try {
        const res = await fetch(`${ADMIN_API_URL}/users/${userId}/role`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ role })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update role');
        
        showAlert('User role updated successfully.');
        fetchUsers();
    } catch (error) {
        showAlert(error.message, true);
        fetchUsers();
    }
}

async function toggleBan(userId, shouldBan) {
    const action = shouldBan ? 'ban' : 'unban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    
    try {
        const res = await fetch(`${ADMIN_API_URL}/users/${userId}/ban`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ isBanned: shouldBan })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to ${action} user`);
        
        showAlert(data.message);
        fetchUsers();
    } catch (error) {
        showAlert(error.message, true);
    }
}

window.initAdmin = initAdmin;
window.updateConfig = updateConfig;
window.fetchUsers = fetchUsers;
window.updateTier = updateTier;
window.updateRole = updateRole;
window.toggleBan = toggleBan;
window.fetchUpgradeRequests = fetchUpgradeRequests;
window.handleUpgradeRequestAction = handleUpgradeRequestAction;

