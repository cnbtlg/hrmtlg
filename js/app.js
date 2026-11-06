// ==========================================================================
// TLG HRM - AUTHENTICATION & LIVE SESSION MANAGEMENT
// ==========================================================================

window._tlgSession = null;

function formatDateVN(dateStr) {
    if (!dateStr) return 'N/A';
    const cleanDate = String(dateStr).split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
}

// XỬ LÝ ĐĂNG NHẬP THỰC TẾ TỪ BẢNG user_accounts
async function handleLogin(event) {
    event.preventDefault();
    const empId = document.getElementById('login-emp-id').value.trim();
    const pass = document.getElementById('login-password').value.trim();

    try {
        const { data: userAccount, error } = await _supabase
            .from('user_accounts')
            .select(`*, employees ( full_name )`)
            .eq('employee_id', empId)
            .eq('is_active', true)
            .limit(1);

        if (error || !userAccount || userAccount.length === 0) {
            alert('Mã nhân viên không tồn tại hoặc tài khoản đang bị khóa!');
            return;
        }

        const user = userAccount[0];
        if (user.password_hash !== pass) {
            alert('Mật khẩu không chính xác!');
            return;
        }

        // Thiết lập phiên làm việc thực tế
        window._tlgSession = {
            employeeId: user.employee_id,
            fullName: user.employees?.full_name || 'N/A',
            role: user.role_type // 'ESS', 'MSS_MANAGER', 'CB_ADMIN', 'SYSTEM_ADMIN'
        };

        // Chuyển màn hình
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');

        document.getElementById('user-display-name').innerText = `${user.employee_id} - ${window._tlgSession.fullName}`;
        document.getElementById('user-display-role').innerText = `Vai trò: ${user.role_type}`;

        switchPortal('ESS');
    } catch (err) {
        alert('Lỗi kết nối xác thực: ' + err.message);
    }
}

function handleLogout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
        window._tlgSession = null;
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('login-form').reset();
    }
}

// QUẢN LÝ ĐỔI MẬT KHẨU
function openChangePasswordModal() {
    document.getElementById('change-pass-modal').classList.remove('hidden');
}

function closeChangePasswordModal() {
    document.getElementById('change-pass-modal').classList.add('hidden');
    document.getElementById('change-pass-form').reset();
}

async function handleChangePassword(event) {
    event.preventDefault();
    const oldPass = document.getElementById('old-password').value.trim();
    const newPass = document.getElementById('new-password').value.trim();
    const confirmPass = document.getElementById('confirm-password').value.trim();

    if (newPass !== confirmPass) {
        alert('Mật khẩu mới không trùng khớp!');
        return;
    }

    try {
        const { data, error: fetchErr } = await _supabase
            .from('user_accounts')
            .select('password_hash')
            .eq('employee_id', window._tlgSession.employeeId)
            .single();

        if (fetchErr || data.password_hash !== oldPass) {
            alert('Mật khẩu hiện tại không đúng!');
            return;
        }

        const { error: updateErr } = await _supabase
            .from('user_accounts')
            .update({ password_hash: newPass, updated_at: new Date().toISOString() })
            .eq('employee_id', window._tlgSession.employeeId);

        if (updateErr) throw updateErr;

        alert('Đổi mật khẩu thành công!');
        closeChangePasswordModal();
    } catch (err) {
        alert('Lỗi đổi mật khẩu: ' + err.message);
    }
}

// KIỂM SOÁT PHÂN QUYỀN TRUY CẬP CÁC PORTAL
function switchPortal(portal) {
    if (!window._tlgSession) return;
    
    const role = window._tlgSession.role;
    
    if (portal === 'MSS' && role === 'ESS') {
        alert('Tài khoản cá nhân (ESS) không có quyền truy cập phân hệ Quản lý (MSS)!');
        return;
    }
    if (portal === 'HRM' && role !== 'CB_ADMIN' && role !== 'SYSTEM_ADMIN') {
        alert('Chỉ tài khoản C&B Admin mới có quyền truy cập phân hệ Quản trị hệ thống!');
        return;
    }

    document.querySelectorAll('.portal-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`portal-${portal.toLowerCase()}`).classList.remove('hidden');

    const btnEss = document.getElementById('btn-ess');
    const btnMss = document.getElementById('btn-mss');
    const btnHrm = document.getElementById('btn-hrm');

    const activeClass = 'bg-blue-600 text-white shadow';
    const inactiveClass = 'text-slate-300 hover:text-white';

    btnEss.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition ${portal === 'ESS' ? activeClass : inactiveClass}`;
    btnMss.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition ${portal === 'MSS' ? activeClass : inactiveClass}`;
    btnHrm.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition ${portal === 'HRM' ? activeClass : inactiveClass}`;

    if (portal === 'HRM') {
        loadEmployees();
    }
}

async function loadEmployees() {
    const tbody = document.getElementById('employees-table-body');
    try {
        const { data, error } = await _supabase
            .from('employee_contracts')
            .select(`*, employees ( * ), legal_entities ( entity_code, entity_name )`)
            .eq('is_active', true)
            .order('employee_id');

        if (error) throw error;
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(item => `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-3 font-mono font-bold text-blue-600">${item.employees?.employee_id || 'N/A'}</td>
                    <td class="p-3 font-medium text-slate-800">${item.employees?.full_name || 'N/A'}</td>
                    <td class="p-3"><span class="px-2 py-1 bg-slate-100 text-slate-700 rounded font-bold text-xs">${item.legal_entities?.entity_code || 'N/A'}</span></td>
                    <td class="p-3 text-slate-700">${item.job_title || 'N/A'}</td>
                    <td class="p-3 text-slate-600">${item.department_name || 'N/A'}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Không có dữ liệu nhân sự.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-rose-500">Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}
