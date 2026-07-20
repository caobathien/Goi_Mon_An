// --- STATE MANAGEMENT (Mock DB) ---
const NUM_TABLES = 12;
let tables = []; 
let orders = []; 
let currentActiveTable = null; 
let menuItems = [];
let currentLang = localStorage.getItem('pos_lang') || 'vi';

function formatPrice(price) {
    if (typeof currentLang !== 'undefined' && currentLang === 'ko') {
        // Tỉ giá giả định: 1 VND = 0.05 KRW -> 20 VND = 1 KRW
        const converted = Math.round(price / 20);
        return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(converted);
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// Initialize Data
async function initData() {
    checkAndReset6AM();
    const storedTables = localStorage.getItem('pos_tables');
    const storedOrders = localStorage.getItem('pos_orders');
    
    if (storedTables) {
        tables = JSON.parse(storedTables);
    } else {
        for(let i = 1; i <= NUM_TABLES; i++) {
            tables.push({ id: i, status: 'EMPTY', currentOrderId: null });
        }
        saveData();
    }
    
    if (storedOrders) {
        orders = JSON.parse(storedOrders);
    }
    
    await loadMenu();
    renderTables();
}

function saveData() {
    localStorage.setItem('pos_tables', JSON.stringify(tables));
    localStorage.setItem('pos_orders', JSON.stringify(orders));
}

function checkAndReset6AM() {
    const lastResetStr = localStorage.getItem('pos_last_reset');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
    
    if (lastResetStr !== todayStr && now.getHours() >= 6) {
        console.log("6 AM Reset Triggered! Cleaning tables state.");
        localStorage.removeItem('pos_tables'); 
        localStorage.setItem('pos_last_reset', todayStr);
    }
}

async function loadMenu() {
    try {
        const response = await fetch('menu.json');
        menuItems = await response.json();
    } catch (e) {
        console.error("Lỗi tải menu:", e);
    }
}

// --- UI LOGIC ---
let currentTimezone = localStorage.getItem('pos_timezone') || 'Asia/Ho_Chi_Minh';

function updateClock() {
    const now = new Date();
    document.getElementById('current-time').innerText = now.toLocaleTimeString(currentLang === 'ko' ? 'ko-KR' : 'vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: currentTimezone });
}
setInterval(updateClock, 60000);
updateClock();

function changeTimezone(tz) {
    currentTimezone = tz;
    localStorage.setItem('pos_timezone', tz);
    updateClock();
    if (document.getElementById('reports-view') && document.getElementById('reports-view').classList.contains('active-view')) {
        renderReports();
    }
}

function renderTables() {
    const container = document.getElementById('tables-container');
    container.innerHTML = '';
    
    tables.forEach(table => {
        const div = document.createElement('div');
        div.className = `table-card ${table.status === 'EMPTY' ? 'table-empty' : 'table-open'}`;
        div.onclick = () => handleTableClick(table.id);
        
        div.innerHTML = `
            <h3>${tDict()['nav-tables'] || 'Bàn'} ${table.id}</h3>
            <span class="status">${table.status === 'EMPTY' ? (tDict()['empty-table'] || 'TRỐNG') : (tDict()['open-table'] || 'ĐANG PHỤC VỤ')}</span>
        `;
        container.appendChild(div);
    });
}

function showTablesView() {
    currentActiveTable = null;
    document.getElementById('tables-view').classList.add('active-view');
    document.getElementById('tables-view').classList.remove('hidden-view');
    document.getElementById('menu-view').classList.add('hidden-view');
    document.getElementById('menu-view').classList.remove('active-view');
    const reportsView = document.getElementById('reports-view');
    if (reportsView) {
        reportsView.classList.add('hidden-view');
        reportsView.classList.remove('active-view');
    }
    const settingsView = document.getElementById('settings-view');
    if (settingsView) {
        settingsView.classList.add('hidden-view');
        settingsView.classList.remove('active-view');
    }
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.getElementById('nav-tables').classList.add('active');
    
    document.getElementById('page-title').innerText = tDict()['page-title-tables'] || 'Sơ đồ bàn';
    
    document.getElementById('current-table-badge').innerText = tDict()['no-table-selected'] || 'Chưa chọn bàn';
    document.getElementById('current-table-badge').style.background = 'var(--text-muted)';
    document.getElementById('current-order-id').innerText = '#---';
    document.getElementById('btn-checkout').disabled = true;
    document.getElementById('subtotal').innerText = '0 ₫';
    document.getElementById('total-amount').innerText = '0 ₫';
    
    const syncBtn = document.getElementById('btn-sync');
    if (syncBtn) syncBtn.style.display = 'none';
    
    document.getElementById('cart-items-container').innerHTML = `
        <div class="empty-cart">
            <i class="ri-shopping-cart-line"></i>
            <p>${tDict()['cart-empty-init'] || 'Vui lòng chọn bàn để gọi món'}</p>
        </div>
    `;
    renderTables();
}

function showMenuView(tableId) {
    document.getElementById('tables-view').classList.remove('active-view');
    document.getElementById('tables-view').classList.add('hidden-view');
    document.getElementById('menu-view').classList.remove('hidden-view');
    document.getElementById('menu-view').classList.add('active-view');
    document.getElementById('nav-tables').classList.remove('active');
    document.getElementById('page-title').innerText = `${tDict()['order-title'] || 'Gọi món - Bàn'} ${tableId}`;
}

function showReportsView() {
    currentActiveTable = null;
    document.getElementById('tables-view').classList.remove('active-view');
    document.getElementById('tables-view').classList.add('hidden-view');
    document.getElementById('menu-view').classList.remove('active-view');
    document.getElementById('menu-view').classList.add('hidden-view');
    
    const reportsView = document.getElementById('reports-view');
    if (reportsView) {
        reportsView.classList.remove('hidden-view');
        reportsView.classList.add('active-view');
    }
    
    const settingsView = document.getElementById('settings-view');
    if (settingsView) {
        settingsView.classList.add('hidden-view');
        settingsView.classList.remove('active-view');
    }
    
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.getElementById('nav-reports').classList.add('active');
    
    document.getElementById('page-title').innerText = tDict()['page-title-reports'] || 'Báo cáo doanh thu';
    
    document.getElementById('current-table-badge').innerText = '';
    document.getElementById('current-order-id').innerText = '';
    document.getElementById('btn-checkout').disabled = true;
    document.getElementById('subtotal').innerText = '0 ₫';
    document.getElementById('total-amount').innerText = '0 ₫';
    const syncBtn = document.getElementById('btn-sync');
    if (syncBtn) syncBtn.style.display = 'none';
    
    document.getElementById('cart-items-container').innerHTML = `
        <div class="empty-cart">
            <i class="ri-bar-chart-2-line"></i>
            <p>${tDict()['reports-hint'] || 'Xem báo cáo doanh thu bên trái'}</p>
        </div>
    `;
    
    renderReports();
}

function renderReports() {
    const paidOrders = orders.filter(o => o.status === 'PAID');
    let totalRevenue = 0;
    
    const listContainer = document.getElementById('transaction-list');
    listContainer.innerHTML = '';
    
    if (paidOrders.length === 0) {
        listContainer.innerHTML = `<div class="tx-empty">${tDict()['no-transactions'] || 'Chưa có giao dịch nào hoàn tất.'}</div>`;
    } else {
        // Sắp xếp đơn mới nhất lên đầu
        paidOrders.sort((a,b) => b.createdAt - a.createdAt).forEach(order => {
            const orderTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            totalRevenue += orderTotal;
            
            const date = new Date(order.createdAt);
            const locale = currentLang === 'ko' ? 'ko-KR' : 'vi-VN';
            const timeStr = date.toLocaleTimeString(locale, {hour: '2-digit', minute:'2-digit', timeZone: currentTimezone});
            const dateStr = date.toLocaleDateString(locale, {timeZone: currentTimezone});
            
            // Render chi tiết từng món ăn
            const itemsListHtml = order.items.map(item => `
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: var(--text-muted); margin-top: 6px; padding-left: 10px; border-left: 2px solid var(--border);">
                    <span>${item.quantity}x ${item.name}</span>
                    <span>${formatPrice(item.price * item.quantity)}</span>
                </div>
            `).join('');
            
            const div = document.createElement('div');
            div.className = 'transaction-item';
            div.style.flexDirection = 'column';
            div.style.alignItems = 'stretch';
            
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="tx-info">
                        <h4>${tDict()['invoice'] || 'Hóa đơn'} #${order.id} - ${tDict()['table'] || 'Bàn'} ${order.tableId}</h4>
                        <p><i class="ri-time-line"></i> ${timeStr} - ${dateStr} &bull; <b>${order.items.length} ${tDict()['items'] || 'món'}</b></p>
                    </div>
                    <div class="tx-amount" style="display: flex; flex-direction: column; align-items: flex-end;">
                        <div>+${formatPrice(orderTotal)}</div>
                        <button onclick="toggleTxDetails('${order.id}')" style="background: none; border: none; color: var(--primary); font-size: 0.85rem; cursor: pointer; margin-top: 6px; font-weight: 600; display: flex; align-items: center; gap: 2px;">${tDict()['view-details'] || 'Xem chi tiết'} <i class="ri-arrow-down-s-line" style="font-size: 1.1rem"></i></button>
                    </div>
                </div>
                <div id="tx-details-${order.id}" class="tx-items-list" style="display: none; margin-top: 0.75rem; border-top: 1px dashed var(--border); padding-top: 0.5rem; max-height: 140px; overflow-y: auto; padding-right: 5px;">
                    ${itemsListHtml}
                </div>
            `;
            listContainer.appendChild(div);
        });
    }
    
    document.getElementById('report-total-revenue').innerText = formatPrice(totalRevenue);
    document.getElementById('report-total-orders').innerText = paidOrders.length;
}

function toggleTxDetails(orderId) {
    const detailsDiv = document.getElementById(`tx-details-${orderId}`);
    const btn = detailsDiv.previousElementSibling.querySelector('button');
    if (detailsDiv.style.display === 'none') {
        detailsDiv.style.display = 'block';
        btn.innerHTML = `${tDict()['collapse'] || 'Thu gọn'} <i class="ri-arrow-up-s-line" style="font-size: 1.1rem"></i>`;
    } else {
        detailsDiv.style.display = 'none';
        btn.innerHTML = `${tDict()['view-details'] || 'Xem chi tiết'} <i class="ri-arrow-down-s-line" style="font-size: 1.1rem"></i>`;
    }
}

function renderMenu(category = 'Tất cả') {
    const container = document.getElementById('menu-container');
    if (!container) return;
    container.innerHTML = '';
    
    const filteredMenu = category === 'Tất cả' ? menuItems : menuItems.filter(item => item.category === category);
        
    filteredMenu.forEach(item => {
        const div = document.createElement('div');
        div.className = 'menu-card';
        div.onclick = () => addToCart(item);
        
        div.innerHTML = `
            <img src="${item.img}" alt="${item.name}" class="menu-img">
            <div class="menu-info">
                <h4>${item.name}</h4>
                <p>${formatPrice(item.price)}</p>
            </div>
        `;
        container.appendChild(div);
    });
}

function handleTableClick(tableId) {
    let table = tables.find(t => t.id === tableId);
    currentActiveTable = tableId;
    
    if (table.status === 'EMPTY') {
        const newOrderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
        table.status = 'OPEN';
        table.currentOrderId = newOrderId;
        
        const newOrder = {
            id: newOrderId,
            tableId: table.id,
            status: 'OPEN',
            items: [],
            isSynced: true, // Mặc định true vì chưa có món gì
            createdAt: new Date().getTime()
        };
        orders.push(newOrder);
        saveData();
    }
    
    showMenuView(table.id);
    const badge = document.getElementById('current-table-badge');
    badge.innerText = `${tDict()['table'] || 'Bàn'} ${table.id}`;
    badge.style.background = 'var(--danger)'; 
    document.getElementById('current-order-id').innerText = `${tDict()['order-id-label'] || 'Mã'}: #${table.currentOrderId}`;
    
    renderMenu();
    renderCart();
    
    // Tự động mở Cart trên mobile nếu vừa chọn bàn
    const currentOrder = orders.find(o => o.id === table.currentOrderId);
    if (window.innerWidth <= 1024 && currentOrder && currentOrder.items.length > 0) {
        document.getElementById('cart-pane').classList.add('open');
        document.getElementById('mobile-cart-overlay').classList.add('active');
    }
}

// --- MOBILE TOGGLE ---
function toggleMobileCart() {
    const pane = document.getElementById('cart-pane');
    const overlay = document.getElementById('mobile-cart-overlay');
    if (pane.classList.contains('open')) {
        pane.classList.remove('open');
        overlay.classList.remove('active');
    } else {
        pane.classList.add('open');
        overlay.classList.add('active');
    }
}

// --- CART LOGIC ---
function addToCart(menuItem) {
    if (!currentActiveTable) return;
    const table = tables.find(t => t.id === currentActiveTable);
    const order = orders.find(o => o.id === table.currentOrderId);
    
    if (order) {
        const existingItem = order.items.find(i => i.id === menuItem.id);
        if (existingItem) {
            existingItem.quantity += 1;
            existingItem.isSynced = false;
        } else {
            order.items.push({
                id: menuItem.id,
                name: menuItem.name,
                price: menuItem.price,
                quantity: 1,
                isSynced: false
            });
        }
        order.isSynced = false; // Có sự thay đổi => Chưa gửi bếp
        saveData();
        renderCart();
    }
}

function updateQuantity(itemId, delta) {
    if (!currentActiveTable) return;
    const table = tables.find(t => t.id === currentActiveTable);
    const order = orders.find(o => o.id === table.currentOrderId);
    
    if (order) {
        const itemIndex = order.items.findIndex(i => i.id === itemId);
        if (itemIndex > -1) {
            order.items[itemIndex].quantity += delta;
            if (order.items[itemIndex].quantity <= 0) {
                order.items.splice(itemIndex, 1);
            } else {
                order.items[itemIndex].isSynced = false;
            }
            order.isSynced = false; // Có sự thay đổi => Chưa gửi bếp
            saveData();
            renderCart();
        }
    }
}

function syncOrder() {
    if (!currentActiveTable) return;
    const table = tables.find(t => t.id === currentActiveTable);
    const order = orders.find(o => o.id === table.currentOrderId);
    if(order && !order.isSynced) {
        order.isSynced = true;
        order.items.forEach(item => item.isSynced = true);
        saveData();
        renderCart();
    }
}

let currentCheckoutTotal = 0;

function checkoutOrder() {
    if (!currentActiveTable) return;
    const table = tables.find(t => t.id === currentActiveTable);
    const order = orders.find(o => o.id === table.currentOrderId);
    
    if (order) {
        if (!order.isSynced && order.items.length > 0) {
            showConfirmModal(
                tDict()['alert-wait'] || "Khoan đã!", 
                tDict()['alert-unsynced'] || "Bạn có món <b>CHƯA GỬI BẾP!</b><br>Bạn vẫn muốn tiếp tục thanh toán chứ?", 
                tDict()['btn-continue'] || "Vẫn tiếp tục", 
                () => { processCheckoutOrder(); }
            );
            return;
        }
        
        processCheckoutOrder();
    }
}

let confirmCallback = null;
function showConfirmModal(title, message, okText, callback) {
    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-message').innerHTML = message;
    document.getElementById('confirm-modal-ok-btn').innerText = okText;
    confirmCallback = callback;
    document.getElementById('confirm-modal').classList.add('active');
}

function handleConfirmOk() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
}

function processCheckoutOrder() {
    closeConfirmModal();
    if (!currentActiveTable) return;
    const table = tables.find(t => t.id === currentActiveTable);
    const order = orders.find(o => o.id === table.currentOrderId);
    
    if (order) {
        currentCheckoutTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Cài đặt dữ liệu lên Modal
        document.querySelector('.modal-header h2').innerHTML = `${tDict()['payment-title'] || 'Thanh Toán Bàn'} <span id="modal-table-id">${table.id}</span>`;
        document.getElementById('modal-total-amount').innerText = formatPrice(currentCheckoutTotal);
        
        // Tạo URL VietQR (Dùng thông tin giả lập cho bản Demo)
        // Bank ID 970415 = VietinBank
        const bankId = "970415"; 
        const accountNo = "113366668888"; 
        const accountName = "AURA POS";
        const description = `Thanh toan ban ${table.id}`;
        
        // Sử dụng API VietQR
        const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${currentCheckoutTotal}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;
        document.getElementById('vietqr-img').src = qrUrl;
        
        // Trạng thái mặc định là tab Tiền mặt
        switchPaymentMethod('cash');
        
        // Hiển thị Modal
        document.getElementById('checkout-modal').classList.add('active');
    }
}

function closeCheckoutModal() {
    document.getElementById('checkout-modal').classList.remove('active');
}

function switchPaymentMethod(method) {
    document.getElementById('btn-method-cash').classList.remove('active');
    document.getElementById('btn-method-qr').classList.remove('active');
    document.getElementById('panel-cash').classList.remove('active');
    document.getElementById('panel-qr').classList.remove('active');
    
    if (method === 'cash') {
        document.getElementById('btn-method-cash').classList.add('active');
        document.getElementById('panel-cash').classList.add('active');
    } else {
        document.getElementById('btn-method-qr').classList.add('active');
        document.getElementById('panel-qr').classList.add('active');
    }
}

function confirmPayment() {
    if (!currentActiveTable) return;
    const table = tables.find(t => t.id === currentActiveTable);
    const order = orders.find(o => o.id === table.currentOrderId);
    
    if (order) {
        order.status = 'PAID';
        table.status = 'EMPTY';
        table.currentOrderId = null;
        saveData();
        closeCheckoutModal();
        showTablesView();
        showAlertModal(
            tDict()['alert-success-title'] || 'Thành công!', 
            tDict()['alert-checkout-success'] || 'Thanh toán thành công!<br>Bàn đã được dọn dẹp sạch sẽ.', 
            'success'
        );
    }
}

function showAlertModal(title, message, type = 'success') {
    document.getElementById('alert-title').innerHTML = title;
    document.getElementById('alert-message').innerHTML = message;
    
    const icon = document.getElementById('alert-icon');
    if (type === 'success') {
        icon.className = 'ri-checkbox-circle-fill';
        icon.style.color = 'var(--success)';
    } else if (type === 'warning') {
        icon.className = 'ri-error-warning-fill';
        icon.style.color = 'var(--warning)';
    } else {
        icon.className = 'ri-information-fill';
        icon.style.color = 'var(--primary)';
    }
    
    document.getElementById('alert-modal').classList.add('active');
}

function closeAlertModal() {
    document.getElementById('alert-modal').classList.remove('active');
}

// --- SETTINGS & I18N ---
function showSettingsView() {
    currentActiveTable = null;
    document.getElementById('tables-view').classList.add('hidden-view');
    document.getElementById('tables-view').classList.remove('active-view');
    document.getElementById('menu-view').classList.add('hidden-view');
    document.getElementById('menu-view').classList.remove('active-view');
    
    const reportsView = document.getElementById('reports-view');
    if (reportsView) {
        reportsView.classList.add('hidden-view');
        reportsView.classList.remove('active-view');
    }
    
    const settingsView = document.getElementById('settings-view');
    if (settingsView) {
        settingsView.classList.remove('hidden-view');
        settingsView.classList.add('active-view');
    }
    
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.getElementById('nav-settings').classList.add('active');
    
    document.getElementById('page-title').innerText = tDict()['page-title-settings'] || 'Cài đặt';
    
    // Clear cart area
    document.getElementById('current-table-badge').innerText = '';
    document.getElementById('current-order-id').innerText = '';
    document.getElementById('btn-checkout').disabled = true;
    document.getElementById('subtotal').innerText = '0 ₫';
    document.getElementById('total-amount').innerText = '0 ₫';
    const syncBtn = document.getElementById('btn-sync');
    if (syncBtn) syncBtn.style.display = 'none';
    
    document.getElementById('cart-items-container').innerHTML = `
        <div class="empty-cart">
            <i class="ri-settings-4-line"></i>
            <p>${tDict()['settings-hint'] || 'Tùy chỉnh hệ thống bên trái'}</p>
        </div>
    `;
    
    const langSelect = document.getElementById('lang-select');
    if (langSelect) langSelect.value = currentLang;
    
    const tzSelect = document.getElementById('tz-select');
    if (tzSelect) tzSelect.value = currentTimezone;
}

function resetAllData() {
    showConfirmModal(
        tDict()['alert-reset-title'] || "Khôi phục gốc",
        tDict()['alert-reset-msg'] || "Bạn có chắc chắn muốn xóa toàn bộ dữ liệu? (Hành động này không thể hoàn tác)",
        tDict()['btn-reset-ok'] || "Xóa tất cả",
        () => {
            localStorage.removeItem('pos_tables');
            localStorage.removeItem('pos_orders');
            location.reload();
        }
    );
}

const translations = {
    'vi': {
        'nav-tables': 'Bàn',
        'nav-reports': 'Báo cáo',
        'nav-settings': 'Cài đặt',
        'page-title-tables': 'Sơ đồ bàn',
        'page-title-reports': 'Báo cáo doanh thu',
        'page-title-settings': 'Cài đặt hệ thống',
        'empty-table': 'TRỐNG',
        'open-table': 'ĐANG PHỤC VỤ',
        'btn-checkout': 'Thanh toán',
        'btn-sync': 'Chưa thêm vào hệ thống',
        'btn-sync-synced': 'Đã thêm vào hệ thống',
        'subtotal': 'Tạm tính',
        'total': 'Tổng cộng',
        'alert-wait': 'Khoan đã!',
        'alert-unsynced': 'Bạn có món <b>CHƯA GỬI BẾP!</b><br>Bạn vẫn muốn tiếp tục thanh toán chứ?',
        'btn-continue': 'Vẫn tiếp tục',
        'alert-reset-title': 'Khôi phục gốc',
        'alert-reset-msg': 'Bạn có chắc chắn muốn xóa toàn bộ dữ liệu? (Hành động này không thể hoàn tác)',
        'btn-reset-ok': 'Xóa tất cả',
        'settings-hint': 'Tùy chỉnh hệ thống bên trái',
        'cart-empty-init': 'Vui lòng chọn bàn để gọi món',
        'legend-empty': 'Trống',
        'legend-open': 'Đang phục vụ',
        'page-title-reports-header': 'Báo cáo Doanh thu',
        'reports-date': 'Tổng thời gian',
        'cart-title': 'Hóa Đơn',
        'reports-history': 'Lịch sử giao dịch',
        'reports-total-revenue': 'Tổng Doanh Thu',
        'reports-total-orders': 'Đơn Hoàn Tất',
        'no-table-selected': 'Chưa chọn bàn',
        'menu-all': 'Tất cả',
        'menu-donhau': 'Đồ nhậu',
        'menu-ruoubia': 'Rượu bia',
        'menu-nuocngot': 'Nước ngọt',
        'menu-goithem': 'Gọi thêm',
        'settings-lang-title': 'Ngôn ngữ / Language',
        'settings-lang-desc': 'Chọn ngôn ngữ hiển thị cho phần mềm',
        'settings-reset-title': 'Xóa dữ liệu (Hard Reset)',
        'settings-reset-desc': 'Xóa toàn bộ bàn, hóa đơn và lịch sử. Không thể hoàn tác.',
        'btn-reset': 'Khôi phục gốc',
        'invoice': 'Hóa đơn',
        'table': 'Bàn',
        'items': 'món',
        'view-details': 'Xem chi tiết',
        'collapse': 'Thu gọn',
        'no-transactions': 'Chưa có giao dịch nào hoàn tất.',
        'btn-back': 'Quay lại',
        'payment-title': 'Thanh toán',
        'payment-cash': 'Tiền mặt',
        'payment-qr': 'Chuyển khoản QR',
        'btn-cancel': 'Hủy',
        'btn-finish': 'Hoàn tất',
        'payment-total': 'Tổng tiền cần thanh toán',
        'alert-success-title': 'Thành công',
        'alert-checkout-success': 'Thanh toán thành công!<br>Bàn đã được dọn dẹp sạch sẽ.',
        'btn-close': 'Đóng',
        'reports-hint': 'Xem báo cáo doanh thu bên trái',
        'order-title': 'Gọi món - Bàn',
        'item-new': 'Mới',
        'item-new-title': 'Món chưa gửi bếp',
        'order-id-label': 'Mã',
        'cart-empty-msg': 'Bàn đang trống. Hãy chọn món từ Menu!',
        'payment-cash-desc': 'Nhận tiền mặt từ khách hàng và thối lại tiền thừa (nếu có).',
        'payment-qr-desc': 'Sử dụng App Ngân hàng để quét mã VietQR',
        'settings-tz-title': 'Múi giờ / Timezone',
        'settings-tz-desc': 'Chọn múi giờ hiển thị đồng hồ'
    },
    'en': {
        'nav-tables': 'Tables',
        'nav-reports': 'Reports',
        'nav-settings': 'Settings',
        'page-title-tables': 'Table Layout',
        'page-title-reports': 'Revenue Reports',
        'page-title-settings': 'System Settings',
        'empty-table': 'EMPTY',
        'open-table': 'OCCUPIED',
        'btn-checkout': 'Checkout',
        'btn-sync': 'Not added to system',
        'btn-sync-synced': 'Added to system',
        'subtotal': 'Subtotal',
        'total': 'Total',
        'alert-wait': 'Wait!',
        'alert-unsynced': 'You have <b>UNSENT</b> items!<br>Do you still want to checkout?',
        'btn-continue': 'Continue anyway',
        'alert-reset-title': 'Hard Reset',
        'alert-reset-msg': 'Are you sure you want to delete all data? (This action cannot be undone)',
        'btn-reset-ok': 'Delete All',
        'settings-hint': 'System settings on the left',
        'cart-empty-init': 'Please select a table to order',
        'legend-empty': 'Empty',
        'legend-open': 'Occupied',
        'page-title-reports-header': 'Revenue Reports',
        'reports-date': 'All time',
        'cart-title': 'Invoice',
        'reports-history': 'Transaction History',
        'reports-total-revenue': 'Total Revenue',
        'reports-total-orders': 'Completed Orders',
        'no-table-selected': 'No table selected',
        'menu-all': 'All',
        'menu-donhau': 'Snacks',
        'menu-ruoubia': 'Alcohol',
        'menu-nuocngot': 'Soft Drinks',
        'menu-goithem': 'Extras',
        'settings-lang-title': 'Language',
        'settings-lang-desc': 'Select the display language for the software',
        'settings-reset-title': 'Hard Reset',
        'settings-reset-desc': 'Delete all tables, invoices, and history. Cannot be undone.',
        'btn-reset': 'Factory Reset',
        'invoice': 'Invoice',
        'table': 'Table',
        'items': 'items',
        'view-details': 'View details',
        'collapse': 'Collapse',
        'no-transactions': 'No completed transactions yet.',
        'btn-back': 'Back',
        'payment-title': 'Checkout',
        'payment-cash': 'Cash',
        'payment-qr': 'QR Transfer',
        'btn-cancel': 'Cancel',
        'btn-finish': 'Finish',
        'payment-total': 'Total amount to pay',
        'alert-success-title': 'Success',
        'alert-checkout-success': 'Checkout successful!<br>The table has been cleared.',
        'btn-close': 'Close',
        'reports-hint': 'View revenue reports on the left',
        'order-title': 'Order - Table',
        'item-new': 'New',
        'item-new-title': 'Unsent item',
        'order-id-label': 'ID',
        'cart-empty-msg': 'Table is empty. Please select items from Menu!',
        'payment-cash-desc': 'Receive cash from customer and return change (if any).',
        'payment-qr-desc': 'Use Banking App to scan VietQR code',
        'settings-tz-title': 'Timezone',
        'settings-tz-desc': 'Select the timezone for the clock display'
    },
    'ko': {
        'nav-tables': '테이블',
        'nav-reports': '보고서',
        'nav-settings': '설정',
        'page-title-tables': '테이블 배치',
        'page-title-reports': '매출 보고서',
        'page-title-settings': '시스템 설정',
        'empty-table': '빈 자리',
        'open-table': '사용 중',
        'btn-checkout': '결제',
        'btn-sync': '주방에 추가 안 됨',
        'btn-sync-synced': '시스템에 추가됨',
        'subtotal': '소계',
        'total': '총액',
        'alert-wait': '잠시만요!',
        'alert-unsynced': '<b>전송되지 않은</b> 항목이 있습니다!<br>그래도 결제하시겠습니까?',
        'btn-continue': '계속',
        'alert-reset-title': '초기화',
        'alert-reset-msg': '모든 데이터를 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)',
        'btn-reset-ok': '모두 삭제',
        'settings-hint': '왼쪽의 시스템 설정',
        'cart-empty-init': '주문할 테이블을 선택하세요',
        'legend-empty': '빈 자리',
        'legend-open': '사용 중',
        'page-title-reports-header': '매출 보고서',
        'reports-date': '전체 시간',
        'cart-title': '청구서',
        'reports-history': '거래 내역',
        'reports-total-revenue': '총 매출',
        'reports-total-orders': '완료된 주문',
        'no-table-selected': '선택된 테이블 없음',
        'menu-all': '전체',
        'menu-donhau': '안주',
        'menu-ruoubia': '주류',
        'menu-nuocngot': '음료',
        'menu-goithem': '추가',
        'settings-lang-title': '언어 / Language',
        'settings-lang-desc': '소프트웨어 표시 언어 선택',
        'settings-reset-title': '데이터 삭제 (Hard Reset)',
        'settings-reset-desc': '모든 테이블, 청구서 및 내역을 삭제합니다. 되돌릴 수 없습니다.',
        'btn-reset': '초기화',
        'invoice': '청구서',
        'table': '테이블',
        'items': '항목',
        'view-details': '세부 정보 보기',
        'collapse': '접기',
        'no-transactions': '완료된 거래가 없습니다.',
        'btn-back': '뒤로',
        'payment-title': '결제',
        'payment-cash': '현금',
        'payment-qr': 'QR 송금',
        'btn-cancel': '취소',
        'btn-finish': '완료',
        'payment-total': '결제할 총 금액',
        'alert-success-title': '성공',
        'alert-checkout-success': '결제 성공!<br>테이블이 정리되었습니다.',
        'btn-close': '닫기',
        'reports-hint': '왼쪽의 매출 보고서 보기',
        'order-title': '주문 - 테이블',
        'item-new': '신규',
        'item-new-title': '주방에 전송되지 않은 항목',
        'order-id-label': '번호',
        'cart-empty-msg': '테이블이 비어 있습니다. 메뉴에서 항목을 선택하세요!',
        'payment-cash-desc': '고객으로부터 현금을 받고 잔돈을 거슬러 줍니다.',
        'payment-qr-desc': '은행 앱을 사용하여 VietQR 코드를 스캔하세요',
        'settings-tz-title': '시간대 / Timezone',
        'settings-tz-desc': '시계 표시 시간대 선택'
    }
};

// currentLang is declared at the top of the file

function tDict() {
    return translations[currentLang] || translations['vi'];
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('pos_lang', lang);
    applyLanguage();
}

function applyLanguage() {
    const t = tDict();
    
    // Auto-translate HTML attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            el.innerHTML = t[key];
        }
    });
    
    // Update Nav
    document.querySelector('#nav-tables').innerHTML = `<i class="ri-layout-grid-line"></i> ${t['nav-tables']}`;
    const navReports = document.querySelector('#nav-reports');
    if (navReports) navReports.innerHTML = `<i class="ri-bar-chart-box-line"></i> ${t['nav-reports']}`;
    const navSettings = document.querySelector('#nav-settings');
    if (navSettings) navSettings.innerHTML = `<i class="ri-settings-4-line"></i> ${t['nav-settings']}`;
    
    // Update Cart texts
    const summaryRow = document.querySelector('.summary-row:nth-child(1) span:first-child');
    if (summaryRow) summaryRow.innerText = t['subtotal'];
    const totalRow = document.querySelector('.total-row span:first-child');
    if (totalRow) totalRow.innerText = t['total'];
    const btnCheckoutSpan = document.querySelector('#btn-checkout span');
    if (btnCheckoutSpan) btnCheckoutSpan.innerText = t['btn-checkout'];
    
    // Refresh current view title
    if (document.getElementById('tables-view').classList.contains('active-view')) {
        document.getElementById('page-title').innerText = t['page-title-tables'];
    } else if (document.getElementById('reports-view')?.classList.contains('active-view')) {
        document.getElementById('page-title').innerText = t['page-title-reports'];
    } else if (document.getElementById('settings-view')?.classList.contains('active-view')) {
        document.getElementById('page-title').innerText = t['page-title-settings'];
    }
    
    // Update Tables text
    renderTables();
    renderCart(); // to refresh sync button text
    renderReports(); // refresh transaction history language
    
    // Refresh menu to update prices format
    const activeBtn = document.querySelector('.category-btn.active');
    if (activeBtn) {
        const key = activeBtn.getAttribute('data-i18n');
        let rawCat = 'Tất cả';
        if (key === 'menu-donhau') rawCat = 'Đồ nhậu';
        else if (key === 'menu-ruoubia') rawCat = 'Rượu bia';
        else if (key === 'menu-nuocngot') rawCat = 'Nước ngọt';
        else if (key === 'menu-goithem') rawCat = 'Gọi thêm';
        renderMenu(rawCat);
    } else {
        renderMenu();
    }
}

// Ensure language applies on startup (delayed slightly to wait for DOM)
setTimeout(() => {
    applyLanguage();
}, 100);

function renderCart() {
    if (!currentActiveTable) return;
    const table = tables.find(t => t.id === currentActiveTable);
    const order = orders.find(o => o.id === table.currentOrderId);
    const container = document.getElementById('cart-items-container');
    const checkoutBtn = document.getElementById('btn-checkout');
    const syncBtn = document.getElementById('btn-sync');
    
    if (!order || order.items.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="ri-restaurant-2-line"></i>
                <p>${tDict()['cart-empty-msg'] || 'Bàn đang trống. Hãy chọn món từ Menu!'}</p>
            </div>
        `;
        document.getElementById('subtotal').innerText = '0 ₫';
        document.getElementById('total-amount').innerText = '0 ₫';
        checkoutBtn.disabled = true;
        if(syncBtn) syncBtn.style.display = 'none';
        document.getElementById('mobile-cart-count').innerText = '0';
        return;
    }
    
    container.innerHTML = '';
    let total = 0;
    let totalItems = 0;
    
    order.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const syncBadge = item.isSynced === false 
            ? `<span style="color: var(--danger); font-size: 0.7rem; margin-left: 6px; padding: 2px 6px; background: #ffe4e6; border-radius: 12px; font-weight: 600;" title="${tDict()['item-new-title'] || 'Món chưa gửi bếp'}"><i class="ri-error-warning-fill"></i> ${tDict()['item-new'] || 'Mới'}</span>` 
            : '';
        
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <h4 style="display: flex; align-items: center;">${item.name} ${syncBadge}</h4>
                <div class="price">${formatPrice(item.price)}</div>
            </div>
            <div class="qty-controls">
                <button class="qty-btn ${item.quantity === 1 ? 'danger' : ''}" onclick="updateQuantity('${item.id}', -1)">
                    <i class="ri-${item.quantity === 1 ? 'delete-bin-line' : 'subtract-line'}"></i>
                </button>
                <span class="qty-value">${item.quantity}</span>
                <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">
                    <i class="ri-add-line"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
        totalItems += item.quantity;
    });
    
    document.getElementById('subtotal').innerText = formatPrice(total);
    document.getElementById('total-amount').innerText = formatPrice(total);
    checkoutBtn.disabled = false;
    document.getElementById('mobile-cart-count').innerText = totalItems;
    
    if (syncBtn) {
        syncBtn.style.display = 'flex';
        if (order.isSynced) {
            syncBtn.className = 'btn btn-block btn-sync synced';
            syncBtn.innerHTML = `<i class="ri-check-double-line"></i> <span>${tDict()['btn-sync-synced'] || 'Đã thêm vào hệ thống'}</span>`;
        } else {
            syncBtn.className = 'btn btn-block btn-sync unsynced';
            syncBtn.innerHTML = `<i class="ri-send-plane-fill"></i> <span>${tDict()['btn-sync'] || 'Chưa thêm vào hệ thống'}</span>`;
        }
    }
}

document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const key = e.currentTarget.getAttribute('data-i18n');
        let rawCat = 'Tất cả';
        if (key === 'menu-donhau') rawCat = 'Đồ nhậu';
        else if (key === 'menu-ruoubia') rawCat = 'Rượu bia';
        else if (key === 'menu-nuocngot') rawCat = 'Nước ngọt';
        else if (key === 'menu-goithem') rawCat = 'Gọi thêm';
        
        renderMenu(rawCat);
    });
});

initData();
