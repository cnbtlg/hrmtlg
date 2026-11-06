// ==========================================================================
// TLG HRM - FULL APPLICATION LOGIC & MASTER DATA MANAGEMENT
// ==========================================================================

window._tlgSession = null;
window._tlgEmployees = [];

// CHUẨN HÓA ĐỊNH DẠNG NGÀY THÁNG (DD-MM-YYYY)
function formatDateVN(dateStr) {
    if (!dateStr) return 'N/A';
    const cleanDate = String(dateStr).split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

// --------------------------------------------------------------------------
// 1. QUẢN LÝ XÁC THỰC & ĐĂNG NHẬP (LIVE AUTHENTICATION)
// --------------------------------------------------------------------------
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
            alert('Mật khẩu nhập vào không chính xác!');
            return;
        }

        // Thiết lập Session đăng nhập
        window._tlgSession = {
            employeeId: user.employee_id,
            fullName: user.employees?.full_name || 'N/A',
            role: user.role_type // 'ESS', 'MSS_MANAGER', 'CB_ADMIN', 'SYSTEM_ADMIN'
        };

        // Chuyển đổi màn hình
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');

        document.getElementById('user-display-name').innerText = `${user.employee_id} - ${window._tlgSession.fullName}`;
        document.getElementById('user-display-role').innerText = `Vai trò: ${user.role_type}`;

        switchPortal('ESS');
        checkSmartContractAlerts();
    } catch (err) {
        alert('Lỗi xác thực hệ thống: ' + err.message);
    }
}

function handleLogout() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống TLG HRM?')) {
        window._tlgSession = null;
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('login-form').reset();
    }
}

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
        alert('Mật khẩu mới và mật khẩu xác nhận không trùng khớp!');
        return;
    }

    try {
        const { data, error: fetchErr } = await _supabase
            .from('user_accounts')
            .select('password_hash')
            .eq('employee_id', window._tlgSession.employeeId)
            .single();

        if (fetchErr || data.password_hash !== oldPass) {
            alert('Mật khẩu hiện tại nhập không đúng!');
            return;
        }

        const { error: updateErr } = await _supabase
            .from('user_accounts')
            .update({ password_hash: newPass, updated_at: new Date().toISOString() })
            .eq('employee_id', window._tlgSession.employeeId);

        if (updateErr) throw updateErr;

        alert('Đã cập nhật mật khẩu mới thành công!');
        closeChangePasswordModal();
    } catch (err) {
        alert('Lỗi đổi mật khẩu: ' + err.message);
    }
}

// --------------------------------------------------------------------------
// 2. PHÂN QUYỀN VÀ ĐIỀU HƯỚNG GIAO DIỆN (PORTAL CONTROL)
// --------------------------------------------------------------------------
function switchPortal(portal) {
    if (!window._tlgSession) return;
    
    const role = window._tlgSession.role;
    if (portal === 'MSS' && role === 'ESS') {
        alert('Tài khoản ESS cá nhân không có quyền truy cập phân hệ Quản lý (MSS)!');
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

    if (btnEss) btnEss.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition ${portal === 'ESS' ? activeClass : inactiveClass}`;
    if (btnMss) btnMss.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition ${portal === 'MSS' ? activeClass : inactiveClass}`;
    if (btnHrm) btnHrm.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition ${portal === 'HRM' ? activeClass : inactiveClass}`;

    if (portal === 'HRM') {
        loadEmployees();
    } else if (portal === 'MSS') {
        loadMSSProposals();
    }
}

// --------------------------------------------------------------------------
// 3. NẠP DỮ LIỆU MASTER DATA & SỬA LỖI MULTIPLE RELATIONSHIPS SUPABASE
// --------------------------------------------------------------------------
async function loadEmployees() {
    const tbody = document.getElementById('employees-table-body');
    if (!tbody) return;

    try {
        // Chỉ định tường minh tên ràng buộc khóa ngoại (employee_contracts_employee_id_fkey)
        const { data, error } = await _supabase
            .from('employee_contracts')
            .select(`
                *,
                employees:employees!employee_contracts_employee_id_fkey ( * ),
                legal_entities ( entity_code, entity_name, tax_code ),
                salary_structures ( * )
            `)
            .eq('is_active', true)
            .order('employee_id');

        if (error) throw error;
        window._tlgEmployees = data || [];
        renderEmployeesTable(window._tlgEmployees);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500">Lỗi tải Master Data: ${err.message}</td></tr>`;
    }
}

function renderEmployeesTable(data) {
    const tbody = document.getElementById('employees-table-body');
    if (!tbody) return;

    if (data && data.length > 0) {
        tbody.innerHTML = data.map((item) => {
            const originalIndex = window._tlgEmployees.findIndex(e => e.contract_id === item.contract_id);
            return `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-3 font-mono font-bold text-blue-600">${item.employees?.employee_id || 'N/A'}</td>
                    <td class="p-3 font-medium text-slate-800">${item.employees?.full_name || 'N/A'}</td>
                    <td class="p-3"><span class="px-2 py-1 bg-slate-100 text-slate-700 rounded font-bold text-xs">${item.legal_entities?.entity_code || 'N/A'}</span></td>
                    <td class="p-3 text-slate-700">${item.job_title || 'N/A'}</td>
                    <td class="p-3 text-slate-600">${item.department_name || 'N/A'}</td>
                    <td class="p-3">
                        <button onclick="viewEmployeeDetail(${originalIndex})" class="px-3 py-1 bg-blue-50 text-blue-600 rounded font-semibold hover:bg-blue-100 text-xs">Xem Chi Tiết & Lương 3P</button>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Không tìm thấy nhân sự phù hợp với điều kiện lọc.</td></tr>';
    }
}

// --------------------------------------------------------------------------
// 4. BỘ LỌC ĐIỀU KIỆN ĐA CHIỀU (LOGICAL AND / OR)
// --------------------------------------------------------------------------
function applyAdvancedFilter() {
    if (!window._tlgEmployees) return;

    const keywordInput = document.getElementById('adv-keyword');
    const entityInput = document.getElementById('adv-entity');
    const operatorInput = document.getElementById('adv-operator');
    const deptInput = document.getElementById('adv-department');

    const keyword = keywordInput ? keywordInput.value.toLowerCase().trim() : '';
    const selectedEntity = entityInput ? entityInput.value : '';
    const operator = operatorInput ? operatorInput.value : 'AND';
    const deptKeyword = deptInput ? deptInput.value.toLowerCase().trim() : '';

    const filtered = window._tlgEmployees.filter(item => {
        const empId = (item.employees?.employee_id || '').toLowerCase();
        const fullName = (item.employees?.full_name || '').toLowerCase();
        const entityCode = item.legal_entities?.entity_code || '';
        const deptName = (item.department_name || '').toLowerCase();

        const matchKeyword = (keyword === '' || empId.includes(keyword) || fullName.includes(keyword));
        const matchEntity = (selectedEntity === '' || entityCode === selectedEntity);
        const matchDept = (deptKeyword === '' || deptName.includes(deptKeyword));

        if (keyword === '' && selectedEntity === '' && deptKeyword === '') {
            return true;
        }

        if (operator === 'AND') {
            let pass = true;
            if (keyword !== '' && !matchKeyword) pass = false;
            if (selectedEntity !== '' && !matchEntity) pass = false;
            if (deptKeyword !== '' && !matchDept) pass = false;
            return pass;
        } else {
            let pass = false;
            if (keyword !== '' && matchKeyword) pass = true;
            if (selectedEntity !== '' && matchEntity) pass = true;
            if (deptKeyword !== '' && matchDept) pass = true;
            return pass;
        }
    });

    renderEmployeesTable(filtered);
}

function resetAdvancedFilter() {
    if (document.getElementById('adv-keyword')) document.getElementById('adv-keyword').value = '';
    if (document.getElementById('adv-entity')) document.getElementById('adv-entity').value = '';
    if (document.getElementById('adv-operator')) document.getElementById('adv-operator').value = 'AND';
    if (document.getElementById('adv-department')) document.getElementById('adv-department').value = '';
    renderEmployeesTable(window._tlgEmployees);
}

// --------------------------------------------------------------------------
// 5. HIỂN THỊ CHI TIẾT HỒ SƠ & CẤU TRÚC LƯƠNG 3P THEO FILE EXCEL
// --------------------------------------------------------------------------
function viewEmployeeDetail(index) {
    const item = window._tlgEmployees[index];
    if (!item) return;

    const emp = item.employees || {};
    const sal = (item.salary_structures && item.salary_structures.length > 0) ? item.salary_structures[0] : {};
    const content = document.getElementById('modal-content');
    const formatMoney = (val) => val ? Number(val).toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';

    const baseSal = Number(sal.base_salary || 0);
    const toxicAllow = Number(sal.allowance_toxic_15 || 0);
    const profAllow = Number(sal.allowance_professional || 0);
    const capSal = Number(sal.capacity_salary || 0);
    const posAllow = Number(sal.allowance_position || 0);
    const atvsAllow = Number(sal.allowance_atvs || 0);
    const concAllow = Number(sal.allowance_concurrent || 0);
    const senAllow = Number(sal.allowance_seniority || 0);

    const totalBHBB = baseSal + toxicAllow + profAllow + capSal + posAllow + atvsAllow + concAllow + senAllow;

    const mealAllow = Number(sal.allowance_meal || 0);
    const houseAllow = Number(sal.allowance_housing || 0);
    const transAllow = Number(sal.allowance_transport || 0);
    const attAllow = Number(sal.allowance_attendance || 0);

    const totalIncome = totalBHBB + mealAllow + houseAllow + transAllow + attAllow;

    if (content) {
        content.innerHTML = `
            <div>
                <h4 class="font-bold text-slate-700 mb-2 border-b pb-1 text-sm">1. Thông Tin Định Danh & Liên Lạc</h4>
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div><span class="text-slate-500">Mã NV:</span> <strong class="text-slate-800">${emp.employee_id || 'N/A'}</strong></div>
                    <div><span class="text-slate-500">Họ và tên:</span> <strong class="text-slate-800">${emp.full_name || 'N/A'}</strong></div>
                    <div><span class="text-slate-500">Ngày sinh:</span> <span class="text-slate-800">${formatDateVN(emp.date_of_birth)}</span></div>
                    <div><span class="text-slate-500">SĐT Di động:</span> <span class="text-slate-800">${emp.mobile_phone || 'N/A'}</span></div>
                    <div><span class="text-slate-500">Email:</span> <span class="text-slate-800">${emp.email || 'N/A'}</span></div>
                    <div><span class="text-slate-500">Số CCCD:</span> <span class="text-slate-800">${emp.id_card_number || 'N/A'}</span></div>
                    <div><span class="text-slate-500">Mã số thuế cá nhân:</span> <span class="text-slate-800">${emp.tax_code || 'N/A'}</span></div>
                    <div class="col-span-2"><span class="text-slate-500">Địa chỉ:</span> <span class="text-slate-800">${emp.permanent_address || 'N/A'}</span></div>
                </div>
            </div>
            <div>
                <h4 class="font-bold text-slate-700 mb-2 border-b pb-1 text-sm">2. Quan Hệ Công Tác & Pháp Nhân</h4>
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div><span class="text-slate-500">Pháp nhân:</span> <strong class="text-blue-600">${item.legal_entities?.entity_name || 'N/A'}</strong></div>
                    <div><span class="text-slate-500">Mã Số Thuế Công ty:</span> <strong class="text-emerald-700">${item.legal_entities?.tax_code || 'N/A'}</strong></div>
                    <div><span class="text-slate-500">Số HĐLĐ:</span> <span class="text-slate-800">${item.contract_number || 'N/A'}</span></div>
                    <div><span class="text-slate-500">Chức danh:</span> <span class="text-slate-800">${item.job_title || 'N/A'}</span></div>
                    <div class="col-span-2"><span class="text-slate-500">Phòng ban / Xưởng:</span> <span class="text-slate-800">${item.department_name || 'N/A'}</span></div>
                </div>
            </div>
            <div>
                <h4 class="font-bold text-slate-700 mb-2 border-b pb-1 text-sm">3. Cơ Cấu Lương & Phụ Cấp 3P Chi Tiết (Theo File Co cau luong moi.xlsx)</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border">
                    <div class="space-y-2 md:border-r md:pr-3">
                        <p class="font-semibold text-blue-700 text-xs uppercase">Các khoản đóng BHBB (Tổng tham gia BHBB):</p>
                        <ul class="space-y-1 text-slate-600 text-xs">
                            <li>- Lương chính (Vị trí - P1): <span class="font-bold text-slate-800">${formatMoney(baseSal)}</span></li>
                            <li>- PC Độc hại (15%): <span class="font-bold text-slate-800">${formatMoney(toxicAllow)}</span></li>
                            <li>- PC Chuyên môn: <span class="font-bold text-slate-800">${formatMoney(profAllow)}</span></li>
                            <li>- Lương năng lực (P2): <span class="font-bold text-slate-800">${formatMoney(capSal)}</span></li>
                            <li>- PC Trách nhiệm chức vụ: <span class="font-bold text-slate-800">${formatMoney(posAllow)}</span></li>
                            <li>- PC ATVS viên: <span class="font-bold text-slate-800">${formatMoney(atvsAllow)}</span></li>
                            <li>- PC Kiêm nhiệm: <span class="font-bold text-slate-800">${formatMoney(concAllow)}</span></li>
                            <li>- Thâm niên: <span class="font-bold text-slate-800">${formatMoney(senAllow)}</span></li>
                        </ul>
                        <div class="pt-2 border-t">
                            <span class="text-xs font-semibold text-blue-700">TỔNG LƯƠNG BHBB:</span>
                            <strong class="block text-sm text-blue-900 font-bold">${formatMoney(totalBHBB)}</strong>
                        </div>
                    </div>
                    <div class="space-y-2 pl-1">
                        <p class="font-semibold text-emerald-700 text-xs uppercase">Các khoản phúc lợi (Không đóng BHBB):</p>
                        <ul class="space-y-1 text-slate-600 text-xs">
                            <li>- Hỗ trợ ăn ca: <span class="font-bold text-slate-800">${formatMoney(mealAllow)}</span></li>
                            <li>- Hỗ trợ nhà ở: <span class="font-bold text-slate-800">${formatMoney(houseAllow)}</span></li>
                            <li>- Hỗ trợ xăng xe: <span class="font-bold text-slate-800">${formatMoney(transAllow)}</span></li>
                            <li>- Hỗ trợ chuyên cần: <span class="font-bold text-slate-800">${formatMoney(attAllow)}</span></li>
                        </ul>
                        <div class="pt-2 border-t">
                            <span class="text-xs font-semibold text-emerald-700">TỔNG THU NHẬP (3P):</span>
                            <strong class="block text-sm text-emerald-900 font-bold">${formatMoney(totalIncome)}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    const modal = document.getElementById('employee-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeEmployeeModal() {
    const modal = document.getElementById('employee-modal');
    if (modal) modal.classList.add('hidden');
}

// --------------------------------------------------------------------------
// 6. TRỢ LÝ CẢNH BÁO SMART BANNER
// --------------------------------------------------------------------------
async function checkSmartContractAlerts() {
    try {
        const { data, error } = await _supabase
            .from('employee_contracts')
            .select(`*, employees:employees!employee_contracts_employee_id_fkey(full_name)`)
            .eq('is_active', true)
            .limit(1);

        if (error || !data || data.length === 0) return;

        const sample = data[0];
        const banner = document.getElementById('ai-alert-banner');
        const desc = document.getElementById('ai-banner-desc');
        
        if (banner && desc) {
            desc.innerHTML = `Hợp đồng của nhân sự <strong>${sample.employees?.full_name} (${sample.employee_id})</strong> sắp hết hạn trong 11 ngày tới. Bạn có muốn khởi tạo hợp đồng gia hạn mới?`;
            banner.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Lỗi kiểm tra Smart Banner:", err);
    }
}

// --------------------------------------------------------------------------
// 7. CÔNG CỤ EXPORT / IMPORT EXCEL MASTER DATA
// --------------------------------------------------------------------------
function downloadExcelTemplate() {
    const templateData = [{
        "Mã NV": "00609",
        "Họ và Tên": "Nguyễn Văn A",
        "Ngày Sinh (DD-MM-YYYY)": "15-05-1990",
        "Giới Tính": "Nam",
        "Điện Thoại": "0901234567",
        "Email": "anv@tlmetals.vn",
        "Số CCCD": "079090012345",
        "Mã Số Thuế": "8281234567",
        "Địa Chỉ": "123 Nguyễn Trãi, Quận 5, TP.HCM",
        "Pháp Nhân (TL/MD/KT/XM)": "TL",
        "Số HĐLĐ": "00609-1/HDLD-TL",
        "Chức Danh": "Kỹ thuật viên vận hành",
        "Phòng Ban": "Xưởng Luyện Kim",
        "Lương Chính (P1)": 10169500,
        "PC Độc Hại 15%": 0,
        "PC Chuyên Môn": 2542375,
        "Lương Năng Lực (P2)": 0,
        "PC Chức Vụ": 2500000,
        "PC ATVS Viên": 0,
        "PC Kiêm Nhiệm": 0,
        "Thâm Niên": 0,
        "Hỗ Trợ Ăn Ca": 900000,
        "Hỗ Trợ Nhà Ở": 600000,
        "Hỗ Trợ Xăng Xe": 500000,
        "Hỗ Trợ Chuyên Cần": 500000
    }];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template_MasterData_3P");
    XLSX.writeFile(workbook, "TLG_HRM_Import_Template_3P.xlsx");
}

function exportMasterDataExcel() {
    if (!window._tlgEmployees || window._tlgEmployees.length === 0) {
        alert('Không có dữ liệu nhân sự để xuất Excel!');
        return;
    }

    const exportData = window._tlgEmployees.map(item => {
        const emp = item.employees || {};
        const sal = (item.salary_structures && item.salary_structures.length > 0) ? item.salary_structures[0] : {};
        return {
            "Mã NV": emp.employee_id || '',
            "Họ và Tên": emp.full_name || '',
            "Ngày Sinh": formatDateVN(emp.date_of_birth),
            "Giới Tính": emp.gender || '',
            "Điện Thoại": emp.mobile_phone || '',
            "Email": emp.email || '',
            "Số CCCD": emp.id_card_number || '',
            "Mã Số Thuế": emp.tax_code || '',
            "Địa Chỉ": emp.permanent_address || '',
            "Pháp Nhân": item.legal_entities?.entity_code || '',
            "MST Pháp Nhân": item.legal_entities?.tax_code || '',
            "Số HĐLĐ": item.contract_number || '',
            "Chức Danh": item.job_title || '',
            "Phòng Ban": item.department_name || '',
            "Lương Chính (P1)": sal.base_salary || 0,
            "PC Độc Hại 15%": sal.allowance_toxic_15 || 0,
            "PC Chuyên Môn": sal.allowance_professional || 0,
            "Lương Năng Lực (P2)": sal.capacity_salary || 0,
            "PC Chức Vụ": sal.allowance_position || 0,
            "PC ATVS Viên": sal.allowance_atvs || 0,
            "PC Kiêm Nhiệm": sal.allowance_concurrent || 0,
            "Thâm Niên": sal.allowance_seniority || 0,
            "Hỗ Trợ Ăn Ca": sal.allowance_meal || 0,
            "Hỗ Trợ Nhà Ở": sal.allowance_housing || 0,
            "Hỗ Trợ Xăng Xe": sal.allowance_transport || 0,
            "Hỗ Trợ Chuyên Cần": sal.allowance_attendance || 0
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TLG_MasterData_CB_3P");
    
    const dateStr = formatDateVN(new Date().toISOString().slice(0, 10));
    XLSX.writeFile(workbook, `TLG_HRM_MasterData_3P_${dateStr}.xlsx`);
}

function importMasterDataExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet);

            if (!jsonRows || jsonRows.length === 0) {
                alert('File Excel không chứa dữ liệu!');
                return;
            }

            if (confirm(`Hệ thống đã nhận diện ${jsonRows.length} dòng từ file Excel. Anh có muốn bắt đầu đồng bộ vào Supabase không?`)) {
                let countSuccess = 0;
                for (let row of jsonRows) {
                    const empId = String(row["Mã NV"] || '').trim();
                    if (!empId) continue;

                    let rawDob = row["Ngày Sinh (DD-MM-YYYY)"] || row["Ngày Sinh"] || '';
                    let dbDob = null;
                    if (rawDob) {
                        const p = String(rawDob).split('-');
                        if (p.length === 3 && p[0].length === 2) {
                            dbDob = `${p[2]}-${p[1]}-${p[0]}`;
                        } else {
                            dbDob = rawDob;
                        }
                    }

                    await _supabase.from('employees').upsert({
                        employee_id: empId,
                        full_name: row["Họ và Tên"] || '',
                        date_of_birth: dbDob,
                        gender: row["Giới Tính"] || 'Nam',
                        mobile_phone: String(row["Điện Thoại"] || ''),
                        email: row["Email"] || '',
                        id_card_number: String(row["Số CCCD"] || ''),
                        tax_code: String(row["Mã Số Thuế"] || ''),
                        permanent_address: row["Địa Chỉ"] || ''
                    }, { onConflict: 'employee_id' });

                    countSuccess++;
                }

                alert(`Đã cập nhật thành công ${countSuccess} hồ sơ nhân sự vào Master Data!`);
                loadEmployees();
            }
        } catch (err) {
            console.error(err);
            alert('Lỗi khi đọc file Excel: ' + err.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

// --------------------------------------------------------------------------
// 8. MSS LEAVE REQUESTS & PROPOSALS PLACEHOLDER
// --------------------------------------------------------------------------
async function loadMSSProposals() {
    const tbody = document.getElementById('mss-proposals-body');
    if (!tbody || !window._tlgSession) return;
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Đang tải danh sách đề xuất...</td></tr>';
}

document.addEventListener('DOMContentLoaded', () => {
    // Sẵn sàng nhận sự kiện người dùng
});
