const API_URL = '/api/admin';

// Utilities
function showAlert(msg, isError = false) {
    const box = document.getElementById('alert-box');
    const msgEl = document.getElementById('alert-msg');
    
    msgEl.textContent = msg;
    box.className = `rounded-lg p-4 mb-4 text-sm font-medium shadow-sm transition-all duration-300 transform translate-y-0 opacity-100 ${
        isError ? 'bg-red-900/50 text-red-200 border border-red-500/50' : 'bg-green-900/50 text-green-200 border border-green-500/50'
    }`;
    box.classList.remove('hidden');

    setTimeout(() => {
        box.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => box.classList.add('hidden'), 300);
    }, 4000);
}

function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    };
}

// Initialization
async function initAdmin() {
    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('admin-email').textContent = user.email;
    
    await Promise.all([
        fetchConfigs(),
        fetchUsers()
    ]);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Fetch and Render Configs
async function fetchConfigs() {
    try {
        const res = await fetch(`${API_URL}/config/tiers`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch configs');
        const data = await res.json();
        
        const container = document.getElementById('configs-container');
        container.innerHTML = '';
        
        data.configs.forEach(config => {
            const el = document.createElement('div');
            el.className = 'bg-slate-800/50 border border-slate-700/50 rounded-lg p-5 flex flex-col space-y-4 relative hover:border-primary/50 transition-colors duration-300';
            
            // Badge for tier
            const badgeColor = config.tierName === 'PRO' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-600/30 text-slate-300 border-slate-500/30';
            
            el.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <h3 class="font-bold text-white text-lg">${config.tierName} Tier</h3>
                    <span class="px-3 py-1 text-xs font-bold rounded-full border ${badgeColor}">${config.tierName}</span>
                </div>
                
                <div class="space-y-4 flex-grow">
                    <div>
                        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Max Requests</label>
                        <input type="number" id="limit-${config.id}" value="${config.requestLimit}" class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Time Window (ms)</label>
                        <input type="number" id="window-${config.id}" value="${config.windowMs}" class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                        <p class="text-xs text-slate-500 mt-1">${config.windowMs / 1000} seconds</p>
                    </div>
                </div>
                
                <button onclick="updateConfig('${config.id}')" class="mt-4 w-full py-2 bg-slate-700 hover:bg-primary text-white text-sm font-semibold rounded-md transition-colors duration-200 shadow-sm flex justify-center items-center">
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
    const limit = document.getElementById(`limit-${id}`).value;
    const windowMs = document.getElementById(`window-${id}`).value;
    
    try {
        const res = await fetch(`${API_URL}/config/tiers/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ requestLimit: limit, windowMs })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update tier');
        
        showAlert('Tier configuration updated successfully. Changes take up to 5 mins.');
        fetchConfigs();
    } catch (error) {
        showAlert(error.message, true);
    }
}

// Fetch and Render Users
async function fetchUsers() {
    try {
        const res = await fetch(`${API_URL}/users`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        
        document.getElementById('user-count-badge').textContent = `${data.users.length} Users Total`;
        
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = '';
        
        if (data.users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-dark-muted">No users found.</td></tr>`;
            return;
        }
        
        data.users.forEach(u => {
            const tr = document.createElement('tr');
            
            const isBanned = u.isBanned;
            const rowClass = isBanned ? 'bg-red-950/20 opacity-80' : 'hover:bg-slate-800/30 transition-colors';
            tr.className = rowClass;
            
            const joinedDate = new Date(u.createdAt).toLocaleDateString();
            
            const banBtnClass = isBanned 
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-red-900/40 hover:bg-red-900/80 text-red-300 border border-red-800/50';
                
            const banBtnText = isBanned ? 'Unban User' : 'Ban User';
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                            ${u.email.charAt(0).toUpperCase()}
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-white ${isBanned ? 'line-through text-red-300' : ''}">${u.email}</div>
                            <div class="text-xs text-dark-muted font-mono" title="${u.id}">ID: ${u.id.substring(0,8)}...</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-slate-300 font-semibold mb-1">${u.role}</div>
                    <div class="text-xs text-slate-500 flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                        ${u.apiKeysCount} Keys
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <select onchange="updateTier('${u.id}', this.value)" class="bg-slate-900 border ${u.tier === 'PRO' ? 'border-amber-500/50 text-amber-300' : 'border-slate-700 text-slate-300'} text-sm rounded focus:ring-primary focus:border-primary block p-2 cursor-pointer font-semibold outline-none transition-colors" ${isBanned ? 'disabled' : ''}>
                        <option value="FREE" ${u.tier === 'FREE' ? 'selected' : ''}>FREE</option>
                        <option value="PRO" ${u.tier === 'PRO' ? 'selected' : ''}>PRO</option>
                    </select>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="toggleBan('${u.id}', ${!isBanned})" class="px-3 py-1.5 rounded text-xs font-bold transition-all shadow-sm ${banBtnClass}">
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
        const res = await fetch(`${API_URL}/users/${userId}/tier`, {
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
        fetchUsers(); // reset select
    }
}

async function toggleBan(userId, shouldBan) {
    const action = shouldBan ? 'ban' : 'unban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    
    try {
        const res = await fetch(`${API_URL}/users/${userId}/ban`, {
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
