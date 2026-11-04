// ==========================================================================
// TLG HRM - APPLICATION LOGIC & PORTAL MANAGEMENT
// ==========================================================================

// Chuyển đổi giao diện giữa ESS, MSS và HRM Admin
function switchPortal(portal) {
    document.querySelectorAll('.portal-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`portal-${portal.toLowerCase()}`).classList.remove('hidden');

    const btnEss = document.getElementById('btn-ess');
    const btnMss = document.getElementById('btn-mss');
    const btnHrm = document.getElementById('btn-hrm');

    const activeClass = 'bg-blue-600 text-white shadow';
    const inactiveClass = 'text-slate-300 hover:text-white';

    btnEss.className = `px-4 py-1.5 rounded-md text-sm font-semibold transition ${portal === 'ESS' ? activeClass : inactiveClass}`;
    btnMss.className = `px-4 py-1.5 rounded-md text-sm font-semibold transition ${portal === 'MSS' ? activeClass : inactiveClass}`;
    btnHrm.className = `px-4 py-1.5 rounded-md text-sm font-semibold transition ${portal === 'HRM' ? activeClass : inactiveClass}`;

    document.getElementById('portal-badge').innerText = `Giao diện: ${portal}`;

    // Nếu vào phân hệ HRM Admin thì load danh sách pháp nhân
    if (portal === 'HRM') {
        loadLegalEntities();
    }
}

// Kiểm tra kết nối Database Supabase khi tải trang
async function checkConnection() {
    try {
        const { data, error } = await _supabase.from('legal_entities').select('*');
        if (error) throw error;

        document.getElementById('db-status').innerText = 'Kết nối HRM thành công!';
        document.getElementById('db-status').className = 'ml-2 font-bold text-emerald-600';
    } catch (err) {
        console.error(err);
        document.getElementById('db-status').innerText = 'Lỗi kết nối Database!';
        document.getElementById('db-status').className = 'ml-2 font-bold text-rose-600';
    }
}

// Truy xuất danh mục pháp nhân (legal_entities) cho trang HRM Admin
async function loadLegalEntities() {
    const tbody = document.getElementById('entities-table-body');
    try {
        const { data, error } = await _supabase.from('legal_entities').select('*').order('entity_id');
        if (error) throw error;

        if (data && data.length > 0) {
            tbody.innerHTML = data.map(item => `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-3 font-mono text-slate-500">${item.entity_id}</td>
                    <td class="p-3 font-bold text-blue-600">${item.entity_code}</td>
                    <td class="p-3 font-medium text-slate-800">${item.entity_name}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-slate-400">Chưa có dữ liệu pháp nhân.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-rose-500">Lỗi khi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

// Khởi chạy khi tải xong DOM
document.addEventListener('DOMContentLoaded', () => {
    checkConnection();
});
