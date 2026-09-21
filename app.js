/**
 * 智光商工115學年度新生繡學號管理系統 - 核心邏輯腳本
 * 提供 31 位學生名冊、行動版卡片檢視 / 試算表格雙模切換、
 * 自動算費、即時搜尋與催繳篩選、資料自動儲存與 CSV 匯出匯入
 */

// 品項單價與中英文對照 (依據 03 PDF 規範)
const ITEM_PRICES = {
  item1: 55, // 夏季短袖制服上衣
  item2: 55, // 冬季長袖制服上衣
  item3: 55, // 夏季短袖運動上衣
  item4: 55, // 冬季長袖運動上衣
  item5: 55, // 各科實習服
  item6: 55, // 帽子
  item7: 65  // 冬季棒球運動外套
};

const ITEM_NAMES = {
  item1: "夏季短袖制服上衣",
  item2: "冬季長袖制服上衣",
  item3: "夏季短袖運動上衣",
  item4: "冬季長袖運動上衣",
  item5: "各科實習服",
  item6: "帽子",
  item7: "冬季棒球運動外套"
};

// 行動端友善之短品名與圖標定義
const ITEM_META = {
  item1: { short: "短袖制服", full: "夏季短袖制服上衣", price: 55, icon: "👕" },
  item2: { short: "長袖制服", full: "冬季長袖制服上衣", price: 55, icon: "👔" },
  item3: { short: "短袖運動", full: "夏季短袖運動上衣", price: 55, icon: "🎽" },
  item4: { short: "長袖運動", full: "冬季長袖運動上衣", price: 55, icon: "🏃" },
  item5: { short: "實習服", full: "各科實習服", price: 55, icon: "🥼" },
  item6: { short: "帽子", full: "帽子", price: 55, icon: "🧢" },
  item7: { short: "棒球外套", full: "冬季棒球運動外套", price: 65, icon: "🧥", highlight: true }
};

const TOTAL_STUDENTS = 31; // 03 收費表固定 31 人

// 系統核心狀態
let appData = {
  className: "資處一仁",
  leaderSign: "",
  affairsSign: "",
  tutorSign: "",
  students: []
};

// 檢視與篩選狀態
let currentViewMode = "card"; // 'card' 或 'table'
let searchKeyword = "";
let statusFilter = "all";     // 'all' | 'unpaid' | 'paid'

// 初始化預設 31 位學生名單
function initDefaultStudents() {
  const students = [];
  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    students.push({
      seat: i,
      name: "",
      studentId: "",
      item1: 0,
      item2: 0,
      item3: 0,
      item4: 0,
      item5: 0,
      item6: 0,
      item7: 0,
      paid: false,
      sign: ""
    });
  }
  return students;
}

// 載入 LocalStorage 儲存之資料
function loadSavedData() {
  try {
    const saved = localStorage.getItem("ck_embroidery_data_v1");
    if (saved) {
      const parsed = JSON.parse(saved);
      appData = parsed;
      if (!appData.className || appData.className === "資處一甲") {
        appData.className = "資處一仁";
      }
      // 確保長度至少為 31 人
      while (appData.students.length < TOTAL_STUDENTS) {
        const nextSeat = appData.students.length + 1;
        appData.students.push({
          seat: nextSeat,
          name: "",
          studentId: "",
          item1: 0,
          item2: 0,
          item3: 0,
          item4: 0,
          item5: 0,
          item6: 0,
          item7: 0,
          paid: false,
          sign: ""
        });
      }
    } else {
      appData.students = initDefaultStudents();
    }
  } catch (e) {
    console.error("載入本機儲存失敗，使用預設值", e);
    appData.students = initDefaultStudents();
  }
}

// 儲存至 LocalStorage
function saveData() {
  try {
    localStorage.setItem("ck_embroidery_data_v1", JSON.stringify(appData));
    showToast("💾 資料已自動同步儲存！");
  } catch (e) {
    console.error("儲存失敗", e);
  }
}

// 計算單一學生費用與總件數
function calculateStudentTotal(student) {
  let total = 0;
  let count = 0;
  for (let key in ITEM_PRICES) {
    const qty = parseInt(student[key] || 0, 10);
    total += qty * ITEM_PRICES[key];
    count += qty;
  }
  return { total, count };
}

// -------------------------------------------------------------
// 檢視模式切換 (手機卡片模式 / 試算表格模式)
// -------------------------------------------------------------
function initViewMode() {
  const saved = localStorage.getItem("ck_view_mode");
  if (saved === "card" || saved === "table") {
    currentViewMode = saved;
  } else {
    // 螢幕寬度小於 820px 自動預設卡片模式
    currentViewMode = window.innerWidth <= 820 ? "card" : "table";
  }
  applyViewModeUI();
}

function switchViewMode(mode) {
  currentViewMode = mode;
  try {
    localStorage.setItem("ck_view_mode", mode);
  } catch(e) {}
  applyViewModeUI();
}

function quickToggleViewMode() {
  switchViewMode(currentViewMode === "card" ? "table" : "card");
}

function applyViewModeUI() {
  const btnCard = document.getElementById("btnViewCard");
  const btnTable = document.getElementById("btnViewTable");
  const cardsContainer = document.getElementById("studentCardsContainer");
  const tableCard = document.getElementById("tableViewCard");
  const mobileToggleBtn = document.getElementById("mobileToggleModeBtn");

  if (currentViewMode === "card") {
    if (btnCard) btnCard.classList.add("active");
    if (btnTable) btnTable.classList.remove("active");
    if (cardsContainer) cardsContainer.style.display = "grid";
    if (tableCard) tableCard.classList.add("view-hidden");
    if (mobileToggleBtn) mobileToggleBtn.innerHTML = "📊 轉表格";
  } else {
    if (btnCard) btnCard.classList.remove("active");
    if (btnTable) btnTable.classList.add("active");
    if (cardsContainer) cardsContainer.style.display = "none";
    if (tableCard) tableCard.classList.remove("view-hidden");
    if (mobileToggleBtn) mobileToggleBtn.innerHTML = "📱 轉卡片";
  }
}

// -------------------------------------------------------------
// 搜尋與催繳狀態篩選邏輯
// -------------------------------------------------------------
function handleStudentSearch(val) {
  searchKeyword = (val || "").trim().toLowerCase();
  const clearBtn = document.getElementById("clearSearchBtn");
  if (clearBtn) clearBtn.style.display = searchKeyword ? "flex" : "none";
  renderAll();
}

function clearSearch() {
  const input = document.getElementById("studentSearchInput");
  if (input) input.value = "";
  handleStudentSearch("");
}

function setStatusFilter(filter) {
  statusFilter = filter;
  document.querySelectorAll(".status-filter-chip").forEach(chip => {
    if (chip.getAttribute("data-filter") === filter) {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });
  renderAll();
}

function checkStudentFilterMatch(student) {
  // 繳費狀態過濾
  if (statusFilter === "unpaid" && student.paid) return false;
  if (statusFilter === "paid" && !student.paid) return false;

  // 搜尋關鍵字過濾 (座號、座號補零、姓名、學號)
  if (searchKeyword) {
    const seatStr = String(student.seat);
    const seatPad = student.seat < 10 ? `0${student.seat}` : `${student.seat}`;
    const nameStr = (student.name || "").toLowerCase();
    const idStr = (student.studentId || "").toLowerCase();

    if (!seatStr.includes(searchKeyword) &&
        !seatPad.includes(searchKeyword) &&
        !nameStr.includes(searchKeyword) &&
        !idStr.includes(searchKeyword)) {
      return false;
    }
  }
  return true;
}

// -------------------------------------------------------------
// 快速座號跳轉膠囊列
// -------------------------------------------------------------
function renderSeatJumpBar() {
  const container = document.getElementById("seatJumpScroller");
  if (!container) return;
  container.innerHTML = "";

  appData.students.forEach(s => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `seat-jump-pill ${s.paid ? 'paid' : ''}`;
    btn.textContent = s.seat;
    btn.title = `座號 ${s.seat} - ${s.name || '未填姓名'} (${s.paid ? '已繳費' : '未繳費'})`;
    btn.onclick = () => scrollToStudent(s.seat);
    container.appendChild(btn);
  });
}

function scrollToStudent(seat) {
  let targetEl;
  if (currentViewMode === "card") {
    targetEl = document.getElementById(`card-student-${seat}`);
  } else {
    targetEl = document.getElementById(`row-student-${seat}`);
  }

  if (targetEl) {
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    targetEl.classList.add("jump-highlight");
    setTimeout(() => {
      targetEl.classList.remove("jump-highlight");
    }, 1600);
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// -------------------------------------------------------------
// 全域渲染器：同步統計、卡片檢視與試算表格
// -------------------------------------------------------------
function renderAll() {
  let classItemTotals = { item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0, item7: 0 };
  let grandTotalAmount = 0;
  let grandTotalItems = 0;
  let paidCount = 0;
  let paidAmount = 0;

  // 1. 計算全域數據
  appData.students.forEach(student => {
    const calc = calculateStudentTotal(student);
    grandTotalAmount += calc.total;
    grandTotalItems += calc.count;
    if (student.paid) {
      paidCount++;
      paidAmount += calc.total;
    }
    for (let key in classItemTotals) {
      classItemTotals[key] += parseInt(student[key] || 0, 10);
    }
  });

  const unpaidCount = TOTAL_STUDENTS - paidCount;

  // 2. 更新頂部儀表板統計
  updateSummaryStats(grandTotalAmount, grandTotalItems, paidCount, paidAmount);

  // 3. 更新篩選標籤數字
  const filterCountAll = document.getElementById("filterCountAll");
  const filterCountUnpaid = document.getElementById("filterCountUnpaid");
  const filterCountPaid = document.getElementById("filterCountPaid");
  if (filterCountAll) filterCountAll.textContent = TOTAL_STUDENTS;
  if (filterCountUnpaid) filterCountUnpaid.textContent = unpaidCount;
  if (filterCountPaid) filterCountPaid.textContent = paidCount;

  // 4. 更新手機版底部懸浮條
  const mobileGrandTotal = document.getElementById("mobileSumGrandTotal");
  const mobilePaid = document.getElementById("mobileSumPaid");
  const mobilePaidCount = document.getElementById("mobileSumPaidCount");
  if (mobileGrandTotal) mobileGrandTotal.textContent = `$${grandTotalAmount.toLocaleString()}`;
  if (mobilePaid) mobilePaid.textContent = `$${paidAmount.toLocaleString()}`;
  if (mobilePaidCount) mobilePaidCount.textContent = `(${paidCount}/${TOTAL_STUDENTS}人)`;

  // 5. 更新對帳機預期應收金額
  const expTotalEl = document.getElementById("expectedClassTotal");
  if (expTotalEl) expTotalEl.textContent = `$${grandTotalAmount.toLocaleString()}`;

  // 6. 渲染卡片與表格
  renderStudentCards();
  renderTableRows(classItemTotals, grandTotalAmount);
  renderSeatJumpBar();
}

// -------------------------------------------------------------
// 📱 渲染行動版卡片檢視 (Mobile Card View)
// -------------------------------------------------------------
function renderStudentCards() {
  const container = document.getElementById("studentCardsContainer");
  if (!container) return;

  container.innerHTML = "";
  let matchedCount = 0;

  appData.students.forEach((student, index) => {
    const isMatch = checkStudentFilterMatch(student);
    if (!isMatch) return;

    matchedCount++;
    const calc = calculateStudentTotal(student);
    const card = document.createElement("div");
    card.className = `student-card ${student.paid ? 'card-paid' : 'card-unpaid'}`;
    card.id = `card-student-${student.seat}`;

    // 產生品項步進器 HTML
    let itemsHtml = "";
    for (let key in ITEM_META) {
      const meta = ITEM_META[key];
      const qty = parseInt(student[key] || 0, 10);
      const isHigh = meta.highlight ? "highlight-jacket" : "";
      itemsHtml += `
        <div class="card-item-row ${qty > 0 ? 'active-row' : ''}">
          <div class="card-item-label">
            <span class="card-item-icon">${meta.icon}</span>
            <div class="card-item-names">
              <span class="card-item-title">${meta.short}</span>
              <span class="card-item-price-tag ${isHigh}">$${meta.price}</span>
            </div>
          </div>
          <div class="card-stepper">
            <button type="button" class="card-step-btn" onclick="stepQty(${index}, '${key}', -1)" aria-label="減一">-</button>
            <input type="number" min="0" max="20" class="card-step-input ${qty > 0 ? 'has-value' : ''}" value="${qty}" onchange="setQty(${index}, '${key}', this.value)">
            <button type="button" class="card-step-btn" onclick="stepQty(${index}, '${key}', 1)" aria-label="加一">+</button>
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-header">
        <div class="card-identity">
          <div class="card-seat-pill">#${student.seat < 10 ? '0' + student.seat : student.seat}</div>
          <div class="card-inputs-box">
            <input type="text" class="card-input-field card-input-name" placeholder="姓名" value="${escapeHtml(student.name)}" onchange="updateStudentInfo(${index}, 'name', this.value)">
            <input type="text" class="card-input-field card-input-id" placeholder="學號" value="${escapeHtml(student.studentId)}" onchange="updateStudentInfo(${index}, 'studentId', this.value)">
          </div>
        </div>
        <div class="card-status-col">
          <div class="card-amount-badge" id="card-total-${student.seat}">$${calc.total}</div>
          <button type="button" class="card-paid-toggle ${student.paid ? 'paid' : 'unpaid'}" onclick="togglePaid(${index}, ${!student.paid})">
            ${student.paid ? '✅ 已繳費' : '⬜ 點擊繳費'}
          </button>
        </div>
      </div>

      <div class="card-body">
        <div class="card-items-grid">
          ${itemsHtml}
        </div>
      </div>

      <div class="card-footer">
        <span class="card-summary-txt">送繡合計：<b>${calc.count} 件</b></span>
        <div class="card-actions-row">
          <button type="button" class="card-mini-btn" onclick="applyStandardSetToStudent(${index})">⭐ 標準全套(7件)</button>
          <button type="button" class="card-mini-btn danger" onclick="clearStudentQuantities(${index})">清空</button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  if (matchedCount === 0) {
    container.innerHTML = `
      <div class="empty-search-state">
        <div class="empty-icon">🔍</div>
        <h3>查無符合條件的學生</h3>
        <p>找不到符合「${escapeHtml(searchKeyword || '篩選條件')}」的名單，請嘗試更換關鍵字或點選「全部」。</p>
        <button type="button" class="btn btn-secondary btn-sm" onclick="clearSearch(); setStatusFilter('all');">重設搜尋條件</button>
      </div>
    `;
  }
}

// -------------------------------------------------------------
// 📊 渲染試算表格 (Table View)
// -------------------------------------------------------------
function renderTableRows(classItemTotals, grandTotalAmount) {
  const tbody = document.getElementById("studentTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  appData.students.forEach((student, index) => {
    const isMatch = checkStudentFilterMatch(student);
    const calc = calculateStudentTotal(student);

    const tr = document.createElement("tr");
    tr.id = `row-student-${student.seat}`;
    if (!isMatch) {
      tr.style.display = "none";
    }

    tr.innerHTML = `
      <td class="seat-col sticky-col-seat">${student.seat}</td>
      <td class="sticky-col-name">
        <input type="text" class="cell-input-text" placeholder="姓名" value="${escapeHtml(student.name)}" onchange="updateStudentInfo(${index}, 'name', this.value)">
      </td>
      <td>
        <input type="text" class="cell-input-text" placeholder="學號" value="${escapeHtml(student.studentId)}" onchange="updateStudentInfo(${index}, 'studentId', this.value)">
      </td>
      ${renderQtyCell(index, 'item1', student.item1)}
      ${renderQtyCell(index, 'item2', student.item2)}
      ${renderQtyCell(index, 'item3', student.item3)}
      ${renderQtyCell(index, 'item4', student.item4)}
      ${renderQtyCell(index, 'item5', student.item5)}
      ${renderQtyCell(index, 'item6', student.item6)}
      ${renderQtyCell(index, 'item7', student.item7)}
      <td class="col-total" id="student-total-${student.seat}">$${calc.total}</td>
      <td>
        <label class="status-paid">
          <input type="checkbox" ${student.paid ? 'checked' : ''} onchange="togglePaid(${index}, this.checked)">
          <span>${student.paid ? '已繳' : '未繳'}</span>
        </label>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // 更新頁底品項加總
  for (let key in classItemTotals) {
    const el = document.getElementById(`footer-${key}`);
    if (el) el.textContent = classItemTotals[key];
  }
  const footerGrandTotal = document.getElementById("footer-grand-total");
  if (footerGrandTotal) footerGrandTotal.textContent = `$${grandTotalAmount.toLocaleString()}`;
}

// 產生表格數量單元格
function renderQtyCell(studentIndex, itemKey, value) {
  const numVal = parseInt(value || 0, 10);
  const hasValClass = numVal > 0 ? 'has-value' : '';
  return `
    <td>
      <div class="qty-control">
        <button type="button" class="qty-btn" onclick="stepQty(${studentIndex}, '${itemKey}', -1)">-</button>
        <input type="number" min="0" max="20" class="qty-input ${hasValClass}" value="${numVal}" onchange="setQty(${studentIndex}, '${itemKey}', this.value)">
        <button type="button" class="qty-btn" onclick="stepQty(${studentIndex}, '${itemKey}', 1)">+</button>
      </div>
    </td>
  `;
}

// -------------------------------------------------------------
// 資料更新操作
// -------------------------------------------------------------
function updateStudentInfo(index, field, value) {
  appData.students[index][field] = value.trim();
  saveData();
  renderSeatJumpBar();
}

function stepQty(index, itemKey, delta) {
  let current = parseInt(appData.students[index][itemKey] || 0, 10);
  current = Math.max(0, current + delta);
  appData.students[index][itemKey] = current;
  saveData();
  renderAll();
}

function setQty(index, itemKey, val) {
  let num = parseInt(val, 10);
  if (isNaN(num) || num < 0) num = 0;
  appData.students[index][itemKey] = num;
  saveData();
  renderAll();
}

function togglePaid(index, isPaid) {
  appData.students[index].paid = isPaid;
  saveData();
  renderAll();
}

// 單一學生快速套用全套
function applyStandardSetToStudent(index) {
  const s = appData.students[index];
  s.item1 = 1;
  s.item2 = 1;
  s.item3 = 1;
  s.item4 = 1;
  s.item5 = 1;
  s.item6 = 1;
  s.item7 = 1;
  saveData();
  renderAll();
  showToast(`✅ 座號 ${s.seat} 號已套用標準全套 7 件 ($395)！`);
}

// 單一學生件數清空
function clearStudentQuantities(index) {
  const s = appData.students[index];
  s.item1 = 0;
  s.item2 = 0;
  s.item3 = 0;
  s.item4 = 0;
  s.item5 = 0;
  s.item6 = 0;
  s.item7 = 0;
  s.paid = false;
  saveData();
  renderAll();
  showToast(`🧹 座號 ${s.seat} 號送繡件數已歸零！`);
}

// 更新儀表板統計顯示
function updateSummaryStats(totalAmount, totalItems, paidCount, paidAmount) {
  const statAmount = document.getElementById("statGrandTotal");
  const statItems = document.getElementById("statTotalItems");
  const statPaidStudents = document.getElementById("statPaidStudents");
  const statPaidAmount = document.getElementById("statPaidAmount");

  if (statAmount) statAmount.textContent = `$${totalAmount.toLocaleString()}`;
  if (statItems) statItems.textContent = `${totalItems} 件`;
  if (statPaidStudents) statPaidStudents.textContent = `${paidCount} / ${TOTAL_STUDENTS} 人`;
  if (statPaidAmount) statPaidAmount.textContent = `$${paidAmount.toLocaleString()}`;

  // 同步列印表頭資料
  const printClass = document.getElementById("printClassHeader");
  if (printClass) printClass.textContent = appData.className || "______";
}

// -------------------------------------------------------------
// 全班批次快捷操作
// -------------------------------------------------------------
function applyStandardSetToAll() {
  if (!confirm("確定要為全班 31 位同學一鍵套用【標準全套7件組 (各1件)】嗎？\n(包含短制、長制、短運、長運、實習服、帽子、外套，每人 $395 元)")) {
    return;
  }
  appData.students.forEach(s => {
    s.item1 = 1;
    s.item2 = 1;
    s.item3 = 1;
    s.item4 = 1;
    s.item5 = 1;
    s.item6 = 1;
    s.item7 = 1;
  });
  saveData();
  renderAll();
  showToast("✅ 已成功套用全班標準全套 7 件！");
}

function fillSampleRoster() {
  if (!confirm("要自動產生 31 位同學的示範學號與姓名嗎？\n(學號將從 115001 ~ 115031)")) {
    return;
  }
  const surnames = ["陳", "林", "黃", "張", "李", "王", "吳", "劉", "蔡", "楊", "許", "鄭", "謝", "郭", "洪", "曾", "邱", "廖", "賴", "周", "徐", "蘇", "葉", "莊", "呂", "江", "何", "蕭", "羅", "高", "潘"];
  const names = ["冠宇", "柏翰", "宇軒", "品睿", "宥廷", "彥廷", "柏宇", "奕辰", "家豪", "冠廷", "品妍", "子晴", "詠晴", "羽彤", "詩涵", "恩綺", "佳穎", "語彤", "雨萱", "晴雅", "明勳", "俊諺", "志偉", "建霖", "思妤", "欣宜", "宜芳", "雅筑", "佩辰", "郁婷", "凱文"];

  appData.students.forEach((s, idx) => {
    s.name = surnames[idx % surnames.length] + names[idx % names.length];
    s.studentId = `1150${(idx + 1).toString().padStart(2, '0')}`;
    if (s.item1 === 0 && s.item3 === 0) {
      s.item1 = 1;
      s.item3 = 1;
      s.item2 = 1;
      s.item4 = 1;
      s.item5 = 1;
      s.item6 = 1;
      s.item7 = 1;
    }
  });

  saveData();
  renderAll();
  showToast("🎉 已成功建立 31 位學生示範名單與送繡件數！");
}

function clearAllQuantities() {
  if (!confirm("確定要將全班 31 位同學的送繡件數全部歸零 (清空) 嗎？")) {
    return;
  }
  appData.students.forEach(s => {
    s.item1 = 0;
    s.item2 = 0;
    s.item3 = 0;
    s.item4 = 0;
    s.item5 = 0;
    s.item6 = 0;
    s.item7 = 0;
    s.paid = false;
  });
  saveData();
  renderAll();
  showToast("🧹 已清空所有送繡數量！");
}

// -------------------------------------------------------------
// CSV 匯出與匯入
// -------------------------------------------------------------
function exportToCSV() {
  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += `"智光商工115學年度新生繡學號各班收費明細表",,,,,,,,,,\n`;
  csvContent += `"班級: ${appData.className}","","班長簽章: ${appData.leaderSign}","","總務股長簽章: ${appData.affairsSign}","","導師簽章: ${appData.tutorSign}",,,,\n`;
  csvContent += `"座號","姓名","學號","夏季短袖制服上衣 ($55)","冬季長袖制服上衣 ($55)","夏季短袖運動上衣 ($55)","冬季長袖運動上衣 ($55)","各科實習服 ($55)","帽子 ($55)","冬季棒球運動外套 ($65)","合計 (元)","繳費狀態"\n`;

  let totalSum = 0;
  let itemSums = { item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0, item7: 0 };

  appData.students.forEach(s => {
    const calc = calculateStudentTotal(s);
    totalSum += calc.total;
    for (let k in itemSums) itemSums[k] += parseInt(s[k] || 0, 10);

    csvContent += `"${s.seat}","${escapeCsv(s.name)}","${escapeCsv(s.studentId)}","${s.item1}","${s.item2}","${s.item3}","${s.item4}","${s.item5}","${s.item6}","${s.item7}","${calc.total}","${s.paid ? '已繳費' : '未繳費'}"\n`;
  });

  csvContent += `"全班統計","全班總計","","${itemSums.item1}","${itemSums.item2}","${itemSums.item3}","${itemSums.item4}","${itemSums.item5}","${itemSums.item6}","${itemSums.item7}","總額: ${totalSum}元",""\n`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `03_智光商工115學年度新生繡學號各班收費明細表_${appData.className || '各班'}_31人.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("📥 已成功匯出 31 人收費明細表 CSV！");
}

function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split(/\r\n|\n/);
    let parsedCount = 0;

    for (let line of lines) {
      const cols = line.split(",").map(c => c.replace(/^"|"$/g, '').trim());
      const seatNum = parseInt(cols[0], 10);
      if (!isNaN(seatNum) && seatNum >= 1 && seatNum <= TOTAL_STUDENTS) {
        const student = appData.students[seatNum - 1];
        if (cols[1] !== undefined) student.name = cols[1];
        if (cols[2] !== undefined) student.studentId = cols[2];
        if (cols[3] !== undefined) student.item1 = parseInt(cols[3], 10) || 0;
        if (cols[4] !== undefined) student.item2 = parseInt(cols[4], 10) || 0;
        if (cols[5] !== undefined) student.item3 = parseInt(cols[5], 10) || 0;
        if (cols[6] !== undefined) student.item4 = parseInt(cols[6], 10) || 0;
        if (cols[7] !== undefined) student.item5 = parseInt(cols[7], 10) || 0;
        if (cols[8] !== undefined) student.item6 = parseInt(cols[8], 10) || 0;
        if (cols[9] !== undefined) student.item7 = parseInt(cols[9], 10) || 0;
        parsedCount++;
      }
    }

    saveData();
    renderAll();
    showToast(`✅ 成功自 CSV 匯入 ${parsedCount} 位學生資料！`);
  };
  reader.readAsText(file, "UTF-8");
}

// -------------------------------------------------------------
// 總務現金對帳機
// -------------------------------------------------------------
function calcCashTotal() {
  const denominations = [
    { id: "cash-1000", subId: "sub-1000", val: 1000 },
    { id: "cash-500", subId: "sub-500", val: 500 },
    { id: "cash-100", subId: "sub-100", val: 100 },
    { id: "cash-50", subId: "sub-50", val: 50 },
    { id: "cash-10", subId: "sub-10", val: 10 },
    { id: "cash-5", subId: "sub-5", val: 5 },
    { id: "cash-1", subId: "sub-1", val: 1 }
  ];

  let actualCash = 0;
  denominations.forEach(d => {
    const el = document.getElementById(d.id);
    const count = el ? parseInt(el.value || 0, 10) : 0;
    const sub = count * d.val;
    actualCash += sub;
    const subEl = document.getElementById(d.subId);
    if (subEl) subEl.textContent = `$${sub.toLocaleString()}`;
  });

  const actualEl = document.getElementById("actualCashTotal");
  if (actualEl) actualEl.textContent = `$${actualCash.toLocaleString()}`;

  let expectedAmount = 0;
  appData.students.forEach(s => {
    expectedAmount += calculateStudentTotal(s).total;
  });

  const diffEl = document.getElementById("cashDiffAlert");
  if (diffEl) {
    const diff = actualCash - expectedAmount;
    if (actualCash === 0 && expectedAmount > 0) {
      diffEl.className = "diff-alert info";
      diffEl.innerHTML = "💡 請輸入各面額實際收到的張數或枚數進行對帳";
    } else if (diff === 0) {
      diffEl.className = "diff-alert match";
      diffEl.innerHTML = `🎉 現金實收金額 ($${actualCash.toLocaleString()}) 與應收總額 ($${expectedAmount.toLocaleString()}) 完全相符！無差額！`;
    } else if (diff > 0) {
      diffEl.className = "diff-alert mismatch";
      diffEl.innerHTML = `⚠️ 現金實收多了 $${diff.toLocaleString()} 元 (實收: $${actualCash.toLocaleString()}，應收: $${expectedAmount.toLocaleString()})`;
    } else {
      diffEl.className = "diff-alert mismatch";
      diffEl.innerHTML = `⚠️ 現金實收短少 $${Math.abs(diff).toLocaleString()} 元 (實收: $${actualCash.toLocaleString()}，應收: $${expectedAmount.toLocaleString()})`;
    }
  }
}

// -------------------------------------------------------------
// 分頁切換與系統工具
// -------------------------------------------------------------
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  const targetBtn = document.querySelector(`[data-tab="${tabId}"]`);
  const targetContent = document.getElementById(tabId);

  if (targetBtn) targetBtn.classList.add("active");
  if (targetContent) targetContent.classList.add("active");

  // 若切換到非明細表，隱藏手機底部懸浮條以免干擾閱讀
  const mobileBar = document.getElementById("mobileSummaryBar");
  if (mobileBar) {
    mobileBar.style.display = tabId === "tab-fee-detail" ? "flex" : "none";
  }

  if (tabId === "tab-cash") {
    calcCashTotal();
  }
}

function triggerPrint() {
  switchTab("tab-fee-detail");
  window.print();
}

function showToast(msg) {
  let toast = document.getElementById("sysToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "sysToast";
    toast.className = "sys-toast-notification";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function escapeCsv(str) {
  if (!str) return "";
  return String(str).replace(/"/g, '""');
}

// -------------------------------------------------------------
// 初始化綁定
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadSavedData();
  initViewMode();

  // 綁定班級與幹部簽署輸入欄
  const classInput = document.getElementById("classInput");
  if (classInput) {
    classInput.value = appData.className || "資處一仁";
    classInput.addEventListener("input", (e) => {
      appData.className = e.target.value;
      const p = document.getElementById("printClassHeader");
      if (p) p.textContent = e.target.value || "______";
      saveData();
    });
  }

  const leaderInput = document.getElementById("leaderInput");
  if (leaderInput) {
    leaderInput.value = appData.leaderSign || "";
    leaderInput.addEventListener("input", (e) => {
      appData.leaderSign = e.target.value;
      const p = document.getElementById("printLeaderHeader");
      if (p) p.textContent = e.target.value ? ` ${e.target.value}` : "";
      saveData();
    });
    const p = document.getElementById("printLeaderHeader");
    if (p && appData.leaderSign) p.textContent = ` ${appData.leaderSign}`;
  }

  const affairsInput = document.getElementById("affairsInput");
  if (affairsInput) {
    affairsInput.value = appData.affairsSign || "";
    affairsInput.addEventListener("input", (e) => {
      appData.affairsSign = e.target.value;
      const p = document.getElementById("printAffairsHeader");
      if (p) p.textContent = e.target.value ? ` ${e.target.value}` : "";
      saveData();
    });
    const p = document.getElementById("printAffairsHeader");
    if (p && appData.affairsSign) p.textContent = ` ${appData.affairsSign}`;
  }

  const tutorInput = document.getElementById("tutorInput");
  if (tutorInput) {
    tutorInput.value = appData.tutorSign || "";
    tutorInput.addEventListener("input", (e) => {
      appData.tutorSign = e.target.value;
      const p = document.getElementById("printTutorHeader");
      if (p) p.textContent = e.target.value ? ` ${e.target.value}` : "";
      saveData();
    });
    const p = document.getElementById("printTutorHeader");
    if (p && appData.tutorSign) p.textContent = ` ${appData.tutorSign}`;
  }

  // 初始渲染
  renderAll();

  // Tab 標籤切換監聽
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchTab(tabId);
    });
  });
});
