// LabelManager Application
(function() {
    'use strict';

    // ==================== ХРАНИЛИЩЕ ====================
    const Storage = {
        getUsers() { return JSON.parse(localStorage.getItem('lm_users') || '[]'); },
        saveUsers(users) { localStorage.setItem('lm_users', JSON.stringify(users)); },
        getCurrentUser() { return JSON.parse(localStorage.getItem('lm_current_user') || 'null'); },
        setCurrentUser(user) { localStorage.setItem('lm_current_user', JSON.stringify(user)); },
        getLabels(userId) {
            const all = JSON.parse(localStorage.getItem('lm_labels') || '{}');
            return all[userId] || [];
        },
        saveLabels(userId, labels) {
            const all = JSON.parse(localStorage.getItem('lm_labels') || '{}');
            all[userId] = labels;
            localStorage.setItem('lm_labels', JSON.stringify(all));
        },
        getGroups(userId) {
            const all = JSON.parse(localStorage.getItem('lm_groups') || '{}');
            return all[userId] || [];
        },
        saveGroups(userId, groups) {
            const all = JSON.parse(localStorage.getItem('lm_groups') || '{}');
            all[userId] = groups;
            localStorage.setItem('lm_groups', JSON.stringify(all));
        }
    };

    // ==================== УТИЛИТЫ ====================
    const Utils = {
        generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); },
        detectBarcodeFormat(barcode) {
            if (!barcode) return 'CODE128';
            const clean = barcode.replace(/\D/g, '');
            if (clean.length === 13) return 'EAN13';
            if (clean.length === 8) return 'EAN8';
            if (clean.length === 12) return 'UPC';
            return 'CODE128';
        },
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        },
        copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Скопировано в буфер обмена');
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                this.showToast('Скопировано в буфер обмена');
            });
        },
        showToast(message) {
            const oldToast = document.getElementById('lm-toast');
            if (oldToast) oldToast.remove();
            
            const toast = document.createElement('div');
            toast.id = 'lm-toast';
            toast.textContent = message;
            toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#111827;color:white;padding:12px 24px;border-radius:8px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-family:sans-serif;font-size:14px;';
            document.body.appendChild(toast);
            setTimeout(() => { if(toast.parentNode) toast.remove(); }, 3000);
        },
        formatDate(dateString) {
            if (!dateString) return '';
            return new Date(dateString).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', year: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        }
    };

    // ==================== АВТОРИЗАЦИЯ ====================
    const Auth = {
        init() {
            const currentUser = Storage.getCurrentUser();
            if (currentUser) {
                App.showMainApp();
            } else {
                const authScreen = document.getElementById('auth-screen');
                if (authScreen) authScreen.classList.remove('hidden');
            }
            document.querySelectorAll('.auth-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const loginForm = document.getElementById('login-form');
                    const registerForm = document.getElementById('register-form');
                    if (loginForm) loginForm.classList.toggle('hidden', tab.dataset.tab !== 'login');
                    if (registerForm) registerForm.classList.toggle('hidden', tab.dataset.tab !== 'register');
                });
            });
            
            const loginForm = document.getElementById('login-form');
            if (loginForm) loginForm.addEventListener('submit', (e) => { e.preventDefault(); Auth.login(); });
            
            const registerForm = document.getElementById('register-form');
            if (registerForm) registerForm.addEventListener('submit', (e) => { e.preventDefault(); Auth.register(); });
            
            const btnLogout = document.getElementById('btn-logout');
            if (btnLogout) btnLogout.addEventListener('click', () => Auth.logout());
        },
        login() {
            const usernameEl = document.getElementById('login-username');
            const passwordEl = document.getElementById('login-password');
            if (!usernameEl || !passwordEl) return;
            
            const username = usernameEl.value.trim();
            const password = passwordEl.value;
            const user = Storage.getUsers().find(u => u.username === username && u.password === password);
            if (user) { 
                Storage.setCurrentUser(user); 
                App.showMainApp(); 
            } else { 
                alert('Неверный логин или пароль'); 
            }
        },
        register() {
            const usernameEl = document.getElementById('reg-username');
            const passwordEl = document.getElementById('reg-password');
            const passwordConfirmEl = document.getElementById('reg-password-confirm');
            if (!usernameEl || !passwordEl || !passwordConfirmEl) return;

            const username = usernameEl.value.trim();
            const password = passwordEl.value;
            if (!username || !password) { alert('Заполните все поля'); return; }
            if (password !== passwordConfirmEl.value) { alert('Пароли не совпадают'); return; }
            
            const users = Storage.getUsers();
            if (users.find(u => u.username === username)) { alert('Пользователь уже существует'); return; }
            
            const newUser = { id: Utils.generateId(), username, password, createdAt: new Date().toISOString() };
            users.push(newUser);
            Storage.saveUsers(users);
            Storage.setCurrentUser(newUser);
            App.showMainApp();
        },
        logout() { localStorage.removeItem('lm_current_user'); location.reload(); }
    };

    // ==================== ГЕНЕРАТОР PDF ====================
    const PDFGenerator = {
        MM_TO_PX: 3.7795,
        SAFE_MARGIN: 1.5,

        measureTextLines(text, fontSizePt, maxWidthMm) {
            if (!text) return 0;
            const charsPerMm = fontSizePt * 0.6 * 0.264583;
            const maxCharsPerLine = Math.max(1, Math.floor(maxWidthMm / charsPerMm));
            const words = text.split(' ');
            let lines = 1;
            let currentLine = '';
            words.forEach(word => {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                if (testLine.length > maxCharsPerLine && currentLine) { lines++; currentLine = word; }
                else { currentLine = testLine; }
            });
            return lines;
        },

        calculateOptimalFontSize(text, maxWidthMm, maxHeightMm, minSize = 5, maxSize = 7.5) {
            if (!text) return maxSize;
            let fontSize = maxSize;
            while (fontSize >= minSize) {
                const lineHeight = fontSize * 0.35;
                const lines = this.measureTextLines(text, fontSize, maxWidthMm);
                if (lines * lineHeight <= maxHeightMm) return fontSize;
                fontSize -= 0.5;
            }
            return minSize;
        },

        createLabelElement(label, settings, widthMm, heightMm) {
            const centerText = settings.centerText !== false;
            const barcodeOnly = settings.barcodeOnly || false;
            const noBarcode = settings.noBarcode || false;
            const colorSizeRow = settings.colorSizeRow || false;
            const align = centerText ? 'center' : 'left';
            const availableWidth = widthMm - (this.SAFE_MARGIN * 2);
            const availableHeight = heightMm - (this.SAFE_MARGIN * 2);
            const barcodeHeight = (!barcodeOnly && !noBarcode) ? availableHeight * 0.35 : 0;
            const barcodeNumberHeight = 3;
            const textAvailableHeight = availableHeight - barcodeHeight - barcodeNumberHeight - 2;

            const div = document.createElement('div');
            div.className = 'pdf-label';
            div.style.cssText = `
                width: ${widthMm}mm;
                height: ${heightMm}mm;
                padding: ${this.SAFE_MARGIN}mm;
                box-sizing: border-box;
                font-family: Arial, Helvetica, sans-serif;
                text-align: ${align};
                background: white;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                line-height: 1.15;
            `;

            let html = '';
            if (!noBarcode && label.barcode) {
                const bcId = 'bc_' + label.id + '_' + Math.random().toString(36).substr(2, 5);
                const bcH = barcodeOnly ? availableHeight * 0.7 : barcodeHeight;
                html += `<div style="margin-bottom:${barcodeOnly ? '2mm' : '1mm'};text-align:center;">
                    <svg id="${bcId}" style="width:100%;height:${bcH}mm;"></svg>
                    <div style="font-size:${barcodeOnly ? '6pt' : '5pt'};margin-top:0.5mm;word-break:break-all;line-height:1.1;">${Utils.escapeHtml(label.barcode)}</div>
                </div>`;
            }

            if (!barcodeOnly) {
                const elements = [];
                if (label.article) elements.push({ text: `Артикул: ${label.article}`, bold: true, maxSize: 7.5, minSize: 5, priority: 1 });
                if (label.name) elements.push({ text: label.name, bold: false, maxSize: 7, minSize: 5, priority: 2 });
                if (colorSizeRow) {
                    let cs = '';
                    if (label.color) cs += `Цвет: ${label.color}`;
                    if (label.color && label.size) cs += ' / ';
                    if (label.size) cs += `Разм.: ${label.size}`;
                    if (cs) elements.push({ text: cs, bold: false, maxSize: 6.5, minSize: 5, priority: 3 });
                } else {
                    if (label.color) elements.push({ text: `Цвет: ${label.color}`, bold: false, maxSize: 6.5, minSize: 5, priority: 3 });
                    if (label.size) elements.push({ text: `Размер: ${label.size}`, bold: false, maxSize: 6.5, minSize: 5, priority: 3 });
                }
                if (label.seller) elements.push({ text: label.seller, bold: false, maxSize: 6.5, minSize: 5, priority: 4 });
                if (label.brand) elements.push({ text: `Бренд: ${label.brand}`, bold: true, maxSize: 7, minSize: 5, priority: 5 });
                if (label.expiry) elements.push({ text: `Срок годности: ${label.expiry}`, bold: false, maxSize: 6, minSize: 5, priority: 6 });

                const totalPriority = elements.reduce((sum, el) => sum + el.priority, 0);
                const elementHeights = elements.map(el => {
                    const share = totalPriority > 0 ? (el.priority / totalPriority) * textAvailableHeight : textAvailableHeight;
                    const fontSize = this.calculateOptimalFontSize(el.text, availableWidth, share, el.minSize, el.maxSize);
                    return { ...el, fontSize, share };
                });

                elementHeights.forEach(el => {
                    const lineHeight = el.fontSize * 0.35;
                    const charsPerMm = el.fontSize * 0.6 * 0.264583;
                    const maxCharsPerLine = Math.max(1, Math.floor(availableWidth / charsPerMm));
                    const words = el.text.split(' ');
                    let currentLine = '';
                    const lines = [];
                    words.forEach(word => {
                        const testLine = currentLine + (currentLine ? ' ' : '') + word;
                        if (testLine.length > maxCharsPerLine && currentLine) { lines.push(currentLine); currentLine = word; }
                        else { currentLine = testLine; }
                    });
                    if (currentLine) lines.push(currentLine);
                    lines.forEach(line => {
                        html += `<div style="font-size:${el.fontSize}pt;line-height:${lineHeight}mm;margin:0.3mm 0;font-weight:${el.bold ? 'bold' : 'normal'};word-break:break-word;">${Utils.escapeHtml(line)}</div>`;
                    });
                });
            }

            div.innerHTML = html;
            setTimeout(() => {
                try {
                    const svg = div.querySelector('svg');
                    if (svg && window.JsBarcode) {
                        const format = settings.barcodeFormat === 'auto'
                            ? Utils.detectBarcodeFormat(label.barcode)
                            : settings.barcodeFormat;
                        window.JsBarcode(svg, label.barcode, {
                            format: format === 'EAN13' ? 'EAN13' : 'CODE128',
                            width: 1.2, height: 40, displayValue: false, margin: 0
                        });
                    }
                } catch (e) { console.error('Barcode error:', e); }
            }, 10);
            return div;
        },

        async generateLabelsPDF(labels, settings, onProgress) {
            if (!window.jspdf) throw new Error('jsPDF не загружен');
            if (!window.html2canvas) throw new Error('html2canvas не загружен');
            
            const { jsPDF } = window.jspdf;
            const printType = settings.printType || 'thermal';
            const labelSize = settings.labelSize || '58x38.6';
            const [labelWidth, labelHeight] = labelSize.split('x').map(Number);
            const orientation = settings.orientation || 'portrait';
            const gap = parseInt(settings.gap) || 3;

            const container = document.createElement('div');
            container.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;';
            document.body.appendChild(container);

            try {
                if (printType === 'thermal') {
                    const pdf = new jsPDF({
                        orientation: labelWidth > labelHeight ? 'landscape' : 'portrait',
                        unit: 'mm', format: [labelWidth, labelHeight], compress: true
                    });
                    for (let i = 0; i < labels.length; i++) {
                        if (i > 0) pdf.addPage([labelWidth, labelHeight]);
                        const labelEl = this.createLabelElement(labels[i], settings, labelWidth, labelHeight);
                        container.appendChild(labelEl);
                        await new Promise(r => setTimeout(r, 50));
                        const canvas = await window.html2canvas(labelEl, {
                            scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff',
                            width: Math.round(labelWidth * this.MM_TO_PX),
                            height: Math.round(labelHeight * this.MM_TO_PX)
                        });
                        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, labelWidth, labelHeight);
                        container.removeChild(labelEl);
                        if (onProgress) onProgress(i + 1, labels.length);
                    }
                    pdf.save(`labels_${new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]}.pdf`);
                } else {
                    const pageWidth = orientation === 'landscape' ? 297 : 210;
                    const pageHeight = orientation === 'landscape' ? 210 : 297;
                    const margin = 5;
                    const usableWidth = pageWidth - margin * 2;
                    const usableHeight = pageHeight - margin * 2;
                    const cols = Math.max(1, Math.floor((usableWidth + gap) / (labelWidth + gap)));
                    const rows = Math.max(1, Math.floor((usableHeight + gap) / (labelHeight + gap)));
                    const labelsPerPage = cols * rows;
                    const gridWidth = cols * labelWidth + (cols - 1) * gap;
                    const gridHeight = rows * labelHeight + (rows - 1) * gap;
                    const offsetX = margin + (usableWidth - gridWidth) / 2;
                    const offsetY = margin + (usableHeight - gridHeight) / 2;

                    const pdf = new jsPDF({
                        orientation: orientation, unit: 'mm', format: [pageWidth, pageHeight], compress: true
                    });
                    let pageIndex = 0;
                    for (let startIdx = 0; startIdx < labels.length; startIdx += labelsPerPage) {
                        if (pageIndex > 0) pdf.addPage([pageWidth, pageHeight]);
                        const pageLabels = labels.slice(startIdx, startIdx + labelsPerPage);
                        const pageContainer = document.createElement('div');
                        pageContainer.style.cssText = `width:${pageWidth}mm;height:${pageHeight}mm;position:relative;background:white;box-sizing:border-box;`;
                        pageLabels.forEach((label, idx) => {
                            const col = idx % cols;
                            const row = Math.floor(idx / cols);
                            const x = offsetX + col * (labelWidth + gap);
                            const y = offsetY + row * (labelHeight + gap);
                            const labelEl = this.createLabelElement(label, settings, labelWidth, labelHeight);
                            labelEl.style.position = 'absolute';
                            labelEl.style.left = x + 'mm';
                            labelEl.style.top = y + 'mm';
                            pageContainer.appendChild(labelEl);
                        });
                        container.appendChild(pageContainer);
                        await new Promise(r => setTimeout(r, 100));
                        const canvas = await window.html2canvas(pageContainer, {
                            scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff',
                            width: Math.round(pageWidth * this.MM_TO_PX),
                            height: Math.round(pageHeight * this.MM_TO_PX)
                        });
                        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight);
                        container.removeChild(pageContainer);
                        pageIndex++;
                        if (onProgress) onProgress(Math.min(startIdx + labelsPerPage, labels.length), labels.length);
                    }
                    pdf.save(`labels_A4_${new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]}.pdf`);
                }
            } finally {
                if (container.parentNode) document.body.removeChild(container);
            }
        }
    };

    // ==================== ПРИЛОЖЕНИЕ ====================
    const App = {
        currentUser: null,
        labels: [],
        groups: [],
        selectedLabels: new Set(),
        currentGroupId: 'all',
        currentPage: 'labels',
        currentFilter: '',
        importQuantityData: null,
        isDuplicating: false,
        duplicateOriginalId: null,

        init() { Auth.init(); this.bindEvents(); },

        showMainApp() {
            this.currentUser = Storage.getCurrentUser();
            const authScreen = document.getElementById('auth-screen');
            const appScreen = document.getElementById('app');
            const userNameEl = document.getElementById('user-name');
            
            if (authScreen) authScreen.classList.add('hidden');
            if (appScreen) appScreen.classList.remove('hidden');
            if (userNameEl && this.currentUser) userNameEl.textContent = this.currentUser.username;
            
            this.loadLabels();
            this.loadGroups();
            this.renderGroupsSelector();
            this.renderLabels();
            this.updateLabelsCount();
        },

        bindEvents() {
            const self = this;
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', (e) => { e.preventDefault(); self.navigate(item.dataset.page); });
            });
            
            const btnAddLabel = document.getElementById('btn-add-label');
            if (btnAddLabel) btnAddLabel.addEventListener('click', () => self.navigate('create'));
            
            const btnCancelCreate = document.getElementById('btn-cancel-create');
            if (btnCancelCreate) btnCancelCreate.addEventListener('click', () => self.navigate('labels'));
            
            const createLabelForm = document.getElementById('create-label-form');
            if (createLabelForm) createLabelForm.addEventListener('submit', (e) => { e.preventDefault(); self.createLabel(); });
            
            const btnGenerateBarcode = document.getElementById('btn-generate-barcode');
            if (btnGenerateBarcode) {
                btnGenerateBarcode.addEventListener('click', () => {
                    const barcodeInput = document.querySelector('#create-label-form input[name="barcode"]');
                    if (barcodeInput) barcodeInput.value = Math.floor(Math.random() * 1000000000000).toString().padStart(13, '0');
                });
            }
            
            const btnImportExcel = document.getElementById('btn-import-excel');
            if (btnImportExcel) btnImportExcel.addEventListener('click', () => self.navigate('import'));
            
            const btnExportExcel = document.getElementById('btn-export-excel');
            if (btnExportExcel) btnExportExcel.addEventListener('click', () => self.exportToExcel());
            
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => { self.currentFilter = e.target.value.toLowerCase(); self.renderLabels(); });
            }
            
            const btnClearFilters = document.getElementById('btn-clear-filters');
            if (btnClearFilters) {
                btnClearFilters.addEventListener('click', () => { 
                    const sInput = document.getElementById('search-input');
                    if (sInput) sInput.value = ''; 
                    self.currentFilter = ''; 
                    self.renderLabels(); 
                });
            }
            
            const selectAll = document.getElementById('select-all');
            if (selectAll) {
                selectAll.addEventListener('change', (e) => {
                    document.querySelectorAll('.label-checkbox').forEach(cb => {
                        cb.checked = e.target.checked;
                        if (e.target.checked) self.selectedLabels.add(cb.dataset.id);
                        else self.selectedLabels.delete(cb.dataset.id);
                    });
                    self.updateBulkActions();
                });
            }
            
            const btnBulkDelete = document.getElementById('btn-bulk-delete');
            if (btnBulkDelete) btnBulkDelete.addEventListener('click', () => self.deleteSelected());
            
            const btnBulkSetQuantity = document.getElementById('btn-bulk-set-quantity');
            if (btnBulkSetQuantity) btnBulkSetQuantity.addEventListener('click', () => self.showQuantityImportModal());
            
            const btnBulkPrint = document.getElementById('btn-bulk-print');
            if (btnBulkPrint) btnBulkPrint.addEventListener('click', () => self.navigateToPrint());
            
            const btnBulkDuplicate = document.getElementById('btn-bulk-duplicate');
            if (btnBulkDuplicate) btnBulkDuplicate.addEventListener('click', () => self.showDuplicateGroupModal());
            
            const btnBulkAddToGroup = document.getElementById('btn-bulk-add-to-group');
            if (btnBulkAddToGroup) btnBulkAddToGroup.addEventListener('click', () => self.showAddToGroupModal());
            
            const groupSelector = document.getElementById('group-selector');
            if (groupSelector) {
                groupSelector.addEventListener('change', (e) => {
                    self.currentGroupId = e.target.value;
                    self.selectedLabels.clear();
                    const sAll = document.getElementById('select-all');
                    if (sAll) sAll.checked = false;
                    self.renderLabels();
                    self.updateBulkActions();
                    self.updateGroupButtons();
                });
            }
            
            const btnCreateGroup = document.getElementById('btn-create-group');
            if (btnCreateGroup) btnCreateGroup.addEventListener('click', () => self.showCreateGroupModal());
            
            const btnRenameGroup = document.getElementById('btn-rename-group');
            if (btnRenameGroup) btnRenameGroup.addEventListener('click', () => self.renameCurrentGroup());
            
            const btnDeleteGroup = document.getElementById('btn-delete-group');
            if (btnDeleteGroup) btnDeleteGroup.addEventListener('click', () => self.deleteCurrentGroup());
            
            const createGroupClose = document.getElementById('create-group-close');
            if (createGroupClose) createGroupClose.addEventListener('click', () => {
                const modal = document.getElementById('create-group-modal');
                if (modal) modal.classList.add('hidden');
            });
            
            const btnCancelCreateGroup = document.getElementById('btn-cancel-create-group');
            if (btnCancelCreateGroup) btnCancelCreateGroup.addEventListener('click', () => {
                const modal = document.getElementById('create-group-modal');
                if (modal) modal.classList.add('hidden');
            });
            
            const btnConfirmCreateGroup = document.getElementById('btn-confirm-create-group');
            if (btnConfirmCreateGroup) btnConfirmCreateGroup.addEventListener('click', () => self.confirmCreateGroup());
            
            const duplicateGroupClose = document.getElementById('duplicate-group-close');
            if (duplicateGroupClose) duplicateGroupClose.addEventListener('click', () => {
                const modal = document.getElementById('duplicate-group-modal');
                if (modal) modal.classList.add('hidden');
            });
            
            const btnCancelDuplicateGroup = document.getElementById('btn-cancel-duplicate-group');
            if (btnCancelDuplicateGroup) btnCancelDuplicateGroup.addEventListener('click', () => {
                const modal = document.getElementById('duplicate-group-modal');
                if (modal) modal.classList.add('hidden');
            });
            
            const btnConfirmDuplicateGroup = document.getElementById('btn-confirm-duplicate-group');
            if (btnConfirmDuplicateGroup) btnConfirmDuplicateGroup.addEventListener('click', () => self.confirmDuplicateWithGroup());
            
            document.querySelectorAll('input[name="duplicate-target"]').forEach(radio => {
                radio.addEventListener('change', (e) => self.onDuplicateTargetChange(e.target.value));
            });
            
            const addToGroupClose = document.getElementById('add-to-group-close');
            if (addToGroupClose) addToGroupClose.addEventListener('click', () => {
                const modal = document.getElementById('add-to-group-modal');
                if (modal) modal.classList.add('hidden');
            });
            
            const btnCancelAddToGroup = document.getElementById('btn-cancel-add-to-group');
            if (btnCancelAddToGroup) btnCancelAddToGroup.addEventListener('click', () => {
                const modal = document.getElementById('add-to-group-modal');
                if (modal) modal.classList.add('hidden');
            });
            
            const btnConfirmAddToGroup = document.getElementById('btn-confirm-add-to-group');
            if (btnConfirmAddToGroup) btnConfirmAddToGroup.addEventListener('click', () => self.confirmAddToGroup());
            
            const modalClose = document.getElementById('modal-close');
            if (modalClose) modalClose.addEventListener('click', () => {
                const modal = document.getElementById('edit-modal');
                if (modal) modal.classList.add('hidden');
                self.resetDuplicateMode();
            });
            
            const btnCancelEdit = document.getElementById('btn-cancel-edit');
            if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => {
                const modal = document.getElementById('edit-modal');
                if (modal) modal.classList.add('hidden');
                self.resetDuplicateMode();
            });
            
            const editForm = document.getElementById('edit-form');
            if (editForm) {
                editForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    if (self.isDuplicating) self.duplicateFromEdit();
                    else self.saveEdit();
                });
            }
            
            const btnBackToLabels = document.getElementById('btn-back-to-labels');
            if (btnBackToLabels) btnBackToLabels.addEventListener('click', () => self.navigate('labels'));
            
            const btnPrint = document.getElementById('btn-print');
            if (btnPrint) btnPrint.addEventListener('click', () => self.printLabels());
            
            const quantityImportModalClose = document.getElementById('quantity-import-modal-close');
            if (quantityImportModalClose) quantityImportModalClose.addEventListener('click', () => {
                const modal = document.getElementById('quantity-import-modal');
                if (modal) modal.classList.add('hidden');
                self.importQuantityData = null;
            });

            ['print-barcode-format', 'print-text-size', 'print-center-text', 'print-barcode-only',
             'print-no-barcode', 'print-color-size-row', 'print-label-size', 'print-type', 'print-gap', 'print-orientation'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('change', () => self.updatePrintPreview());
            });

            this.initImport();
            this.initQuantityImport();
        },

        navigate(page) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            
            const targetPage = document.getElementById(`page-${page}`);
            if (targetPage) targetPage.classList.add('active');
            
            const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
            if (navItem) navItem.classList.add('active');
            
            this.currentPage = page;
            if (page === 'labels') this.renderLabels();
            else if (page === 'print') this.updatePrintPreview();
        },

        navigateToPrint() {
            this.labelsForPrint = Array.from(this.selectedLabels);
            this.navigate('print');
        },

        loadLabels() { this.labels = Storage.getLabels(this.currentUser?.id || ''); },
        saveLabels() { Storage.saveLabels(this.currentUser?.id || '', this.labels); this.updateLabelsCount(); },
        updateLabelsCount() { 
            const countEl = document.getElementById('labels-count');
            if (countEl) countEl.textContent = this.labels.length; 
        },

        loadGroups() { this.groups = Storage.getGroups(this.currentUser?.id || ''); },
        saveGroups() { Storage.saveGroups(this.currentUser?.id || '', this.groups); },

        renderGroupsSelector() {
            const selector = document.getElementById('group-selector');
            if (!selector) return;
            selector.innerHTML = '<option value="all">📋 Все этикетки</option>';
            this.groups.forEach(group => {
                const count = this.labels.filter(l => l.groupId === group.id).length;
                const opt = document.createElement('option');
                opt.value = group.id;
                opt.textContent = `📁 ${group.name} (${count})`;
                if (group.id === this.currentGroupId) opt.selected = true;
                selector.appendChild(opt);
            });
            this.updateGroupButtons();
            this.updateGroupStats();
        },

        updateGroupButtons() {
            const isGroupSelected = this.currentGroupId !== 'all';
            const btnRename = document.getElementById('btn-rename-group');
            const btnDelete = document.getElementById('btn-delete-group');
            if (btnRename) btnRename.style.display = isGroupSelected ? '' : 'none';
            if (btnDelete) btnDelete.style.display = isGroupSelected ? '' : 'none';
        },

        updateGroupStats() {
            const stats = document.getElementById('group-stats');
            if (!stats) return;
            const total = this.labels.length;
            const inGroup = this.currentGroupId === 'all' ? total : this.labels.filter(l => l.groupId === this.currentGroupId).length;
            stats.textContent = `Показано: ${inGroup} из ${total}`;
        },

        showCreateGroupModal() {
            const nameInput = document.getElementById('new-group-name');
            const modal = document.getElementById('create-group-modal');
            if (nameInput) nameInput.value = '';
            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(() => nameInput.focus(), 100);
            }
        },

        confirmCreateGroup() {
            const nameInput = document.getElementById('new-group-name');
            if (!nameInput) return;
            const name = nameInput.value.trim();
            if (!name) { alert('Введите название группы'); return; }
            const group = { id: Utils.generateId(), name: name, createdAt: new Date().toISOString() };
            this.groups.push(group);
            this.saveGroups();
            this.currentGroupId = group.id;
            this.renderGroupsSelector();
            document.getElementById('group-selector').value = group.id;
            
            const modal = document.getElementById('create-group-modal');
            if (modal) modal.classList.add('hidden');
            Utils.showToast(`Группа "${name}" создана`);
        },

        renameCurrentGroup() {
            const group = this.groups.find(g => g.id === this.currentGroupId);
            if (!group) return;
            const newName = prompt('Новое название группы:', group.name);
            if (newName && newName.trim()) {
                group.name = newName.trim();
                this.saveGroups();
                this.renderGroupsSelector();
                const selector = document.getElementById('group-selector');
                if (selector) selector.value = group.id;
                Utils.showToast('Группа переименована');
            }
        },

        deleteCurrentGroup() {
            const group = this.groups.find(g => g.id === this.currentGroupId);
            if (!group) return;
            const count = this.labels.filter(l => l.groupId === group.id).length;
            if (!confirm(`Удалить группу "${group.name}"?\n\nЭтикетки (${count} шт.) останутся, но без группы.`)) return;
            this.labels.forEach(l => { if (l.groupId === group.id) l.groupId = null; });
            this.groups = this.groups.filter(g => g.id !== group.id);
            this.saveGroups();
            this.saveLabels();
            this.currentGroupId = 'all';
            this.renderGroupsSelector();
            const selector = document.getElementById('group-selector');
            if (selector) selector.value = 'all';
            this.renderLabels();
            Utils.showToast('Группа удалена');
        },

        showAddToGroupModal() {
            if (this.selectedLabels.size === 0) { Utils.showToast('Выберите этикетки'); return; }
            const select = document.getElementById('add-to-group-select');
            if (!select) return;
            select.innerHTML = '<option value="">-- Выберите группу --</option>';
            this.groups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name;
                select.appendChild(opt);
            });
            const newGroupNameInput = document.getElementById('add-to-new-group-name');
            if (newGroupNameInput) newGroupNameInput.value = '';
            
            const modal = document.getElementById('add-to-group-modal');
            if (modal) modal.classList.remove('hidden');
        },

        confirmAddToGroup() {
            const select = document.getElementById('add-to-group-select');
            const newGroupNameInput = document.getElementById('add-to-new-group-name');
            if (!select || !newGroupNameInput) return;
            
            const existingGroupId = select.value;
            const newGroupName = newGroupNameInput.value.trim();
            let targetGroupId = existingGroupId;
            if (!targetGroupId && newGroupName) {
                const group = { id: Utils.generateId(), name: newGroupName, createdAt: new Date().toISOString() };
                this.groups.push(group);
                this.saveGroups();
                targetGroupId = group.id;
            }
            if (!targetGroupId) { alert('Выберите или создайте группу'); return; }
            let count = 0;
            this.selectedLabels.forEach(id => {
                const label = this.labels.find(l => l.id === id);
                if (label) { label.groupId = targetGroupId; label.updatedAt = new Date().toISOString(); count++; }
            });
            this.saveLabels();
            this.renderGroupsSelector();
            const selector = document.getElementById('group-selector');
            if (selector) selector.value = targetGroupId;
            this.currentGroupId = targetGroupId;
            this.renderLabels();
            this.selectedLabels.clear();
            const sAll = document.getElementById('select-all');
            if (sAll) sAll.checked = false;
            this.updateBulkActions();
            
            const modal = document.getElementById('add-to-group-modal');
            if (modal) modal.classList.add('hidden');
            Utils.showToast(`Добавлено в группу: ${count}`);
        },

        showDuplicateGroupModal() {
            if (this.selectedLabels.size === 0) { Utils.showToast('Выберите этикетки'); return; }
            const currentRadio = document.querySelector('input[name="duplicate-target"][value="current"]');
            if (currentRadio) currentRadio.checked = true;
            
            const existingGroupsList = document.getElementById('existing-groups-list');
            const newGroupForDuplicate = document.getElementById('new-group-for-duplicate');
            const duplicateNewGroupName = document.getElementById('duplicate-new-group-name');
            
            if (existingGroupsList) existingGroupsList.style.display = 'none';
            if (newGroupForDuplicate) newGroupForDuplicate.style.display = 'none';
            if (duplicateNewGroupName) duplicateNewGroupName.value = '';
            
            const list = document.getElementById('existing-groups-list');
            if (list) {
                list.innerHTML = '';
                if (this.groups.length === 0) {
                    list.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;padding:8px;">Групп пока нет. Создайте первую!</p>';
                } else {
                    this.groups.forEach(g => {
                        const item = document.createElement('div');
                        item.className = 'group-select-item';
                        item.dataset.groupId = g.id;
                        item.textContent = g.name;
                        item.addEventListener('click', () => {
                            list.querySelectorAll('.group-select-item').forEach(i => i.classList.remove('selected'));
                            item.classList.add('selected');
                        });
                        list.appendChild(item);
                    });
                }
            }
            const modal = document.getElementById('duplicate-group-modal');
            if (modal) modal.classList.remove('hidden');
        },

        onDuplicateTargetChange(value) {
            const existingGroupsList = document.getElementById('existing-groups-list');
            const newGroupForDuplicate = document.getElementById('new-group-for-duplicate');
            if (existingGroupsList) existingGroupsList.style.display = value === 'existing' ? '' : 'none';
            if (newGroupForDuplicate) newGroupForDuplicate.style.display = value === 'new' ? '' : 'none';
        },

        confirmDuplicateWithGroup() {
            const targetRadio = document.querySelector('input[name="duplicate-target"]:checked');
            if (!targetRadio) return;
            const target = targetRadio.value;
            let targetGroupId = null;
            if (target === 'current') {
                targetGroupId = this.currentGroupId === 'all' ? null : this.currentGroupId;
            } else if (target === 'existing') {
                const selected = document.querySelector('#existing-groups-list .group-select-item.selected');
                if (!selected) { alert('Выберите группу'); return; }
                targetGroupId = selected.dataset.groupId;
            } else if (target === 'new') {
                const duplicateNewGroupName = document.getElementById('duplicate-new-group-name');
                if (!duplicateNewGroupName) return;
                const name = duplicateNewGroupName.value.trim();
                if (!name) { alert('Введите название новой группы'); return; }
                const group = { id: Utils.generateId(), name: name, createdAt: new Date().toISOString() };
                this.groups.push(group);
                this.saveGroups();
                targetGroupId = group.id;
            }
            const newLabels = [];
            this.selectedLabels.forEach(id => {
                const label = this.labels.find(l => l.id === id);
                if (label) {
                    newLabels.push({
                        ...label,
                        id: Utils.generateId(),
                        groupId: targetGroupId,
                        quantity: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            });
            this.labels.push(...newLabels);
            this.saveLabels();
            this.selectedLabels.clear();
            const sAll = document.getElementById('select-all');
            if (sAll) sAll.checked = false;
            
            if (target === 'new') {
                this.currentGroupId = targetGroupId;
                const selector = document.getElementById('group-selector');
                if (selector) selector.value = targetGroupId;
            }
            this.renderGroupsSelector();
            this.renderLabels();
            this.updateBulkActions();
            
            const modal = document.getElementById('duplicate-group-modal');
            if (modal) modal.classList.add('hidden');
            Utils.showToast(`Дублировано: ${newLabels.length}`);
        },

        renderLabels() {
            const tbody = document.getElementById('labels-tbody');
            if (!tbody) return;
            tbody.innerHTML = '';
            let filtered = this.labels;
            if (this.currentGroupId !== 'all') {
                filtered = filtered.filter(l => l.groupId === this.currentGroupId);
            }
            if (this.currentFilter) {
                filtered = filtered.filter(l =>
                    Object.values(l).some(v => String(v).toLowerCase().includes(this.currentFilter))
                );
            }

            filtered.forEach(label => {
                const group = label.groupId ? this.groups.find(g => g.id === label.groupId) : null;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="checkbox" class="label-checkbox" data-id="${label.id}" ${this.selectedLabels.has(label.id) ? 'checked' : ''}></td>
                    <td><div class="quantity-control">
                        <button class="btn-decrease" data-id="${label.id}">−</button>
                        <input type="number" class="quantity-input" data-id="${label.id}" value="${label.quantity || 0}" min="0">
                        <button class="btn-increase" data-id="${label.id}">+</button>
                    </div></td>
                    <td><div>${Utils.escapeHtml(label.barcode)} <button class="action-btn btn-copy" data-barcode="${Utils.escapeHtml(label.barcode)}">📋</button></div>
                        <span class="barcode-format-badge">${Utils.detectBarcodeFormat(label.barcode)}</span></td>
                    <td>${Utils.escapeHtml(label.article)}</td>
                    <td>${Utils.escapeHtml(label.color || '')}</td>
                    <td>${Utils.escapeHtml(label.size || '')}</td>
                    <td>${Utils.escapeHtml(label.name || '')}</td>
                    <td>${Utils.escapeHtml(label.seller || '')}</td>
                    <td>${Utils.escapeHtml(label.gtin || '')}</td>
                    <td style="font-size:11px">
                        <div>Создана: ${Utils.formatDate(label.createdAt)}</div>
                        <div>Изменена: ${Utils.formatDate(label.updatedAt || label.createdAt)}</div>
                        ${group ? `<div class="group-badge">📁 ${Utils.escapeHtml(group.name)}</div>` : ''}
                    </td>
                    <td><div class="action-buttons">
                        <button class="action-btn btn-edit" data-id="${label.id}">✏️</button>
                        <button class="action-btn btn-duplicate" data-id="${label.id}">📑</button>
                        <button class="action-btn delete btn-delete" data-id="${label.id}">🗑️</button>
                    </div></td>
                `;
                tbody.appendChild(tr);
            });

            const self = this;
            document.querySelectorAll('.label-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    if (e.target.checked) self.selectedLabels.add(e.target.dataset.id);
                    else self.selectedLabels.delete(e.target.dataset.id);
                    self.updateBulkActions();
                });
            });
            document.querySelectorAll('.btn-decrease').forEach(btn => btn.addEventListener('click', (e) => self.changeQuantity(e.target.dataset.id, -1)));
            document.querySelectorAll('.btn-increase').forEach(btn => btn.addEventListener('click', (e) => self.changeQuantity(e.target.dataset.id, 1)));
            document.querySelectorAll('.quantity-input').forEach(input => input.addEventListener('change', (e) => self.updateQuantity(e.target.dataset.id, parseInt(e.target.value) || 0)));
            document.querySelectorAll('.btn-copy').forEach(btn => btn.addEventListener('click', (e) => Utils.copyToClipboard(e.target.dataset.barcode)));
            document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => self.openEditModal(e.target.dataset.id)));
            document.querySelectorAll('.btn-duplicate').forEach(btn => btn.addEventListener('click', (e) => self.duplicateLabelWithEdit(e.target.dataset.id)));
            document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', (e) => self.deleteLabel(e.target.dataset.id)));
            this.updateGroupStats();
        },

        updateBulkActions() {
            const bulk = document.getElementById('bulk-actions');
            if (!bulk) return;
            const count = this.selectedLabels.size;
            if (count > 0) { 
                bulk.classList.remove('hidden'); 
                const countEl = document.getElementById('selected-count');
                if (countEl) countEl.textContent = `Выбрано: ${count}`; 
            } else { 
                bulk.classList.add('hidden'); 
            }
        },

        changeQuantity(id, delta) {
            const label = this.labels.find(l => l.id === id);
            if (label) { 
                label.quantity = Math.max(0, (label.quantity || 0) + delta); 
                label.updatedAt = new Date().toISOString(); 
                this.saveLabels(); 
                this.renderLabels(); 
                this.renderGroupsSelector();
            }
        },
        updateQuantity(id, quantity) {
            const label = this.labels.find(l => l.id === id);
            if (label) { 
                label.quantity = quantity; 
                label.updatedAt = new Date().toISOString(); 
                this.saveLabels(); 
                this.renderGroupsSelector();
            }
        },

        createLabel() {
            const form = document.getElementById('create-label-form');
            if (!form) return;
            const formData = new FormData(form);
            const article = formData.get('article');
            const barcode = formData.get('barcode');
            if (!article || !barcode) { alert('Артикул и Штрихкод обязательны'); return; }

            const label = {
                id: Utils.generateId(),
                article: article,
                barcode: barcode,
                color: formData.get('color'),
                size: formData.get('size'),
                name: formData.get('name'),
                seller: formData.get('seller'),
                gtin: formData.get('gtin'),
                brand: formData.get('brand'),
                expiry: formData.get('expiry'),
                country: formData.get('country'),
                composition: formData.get('composition'),
                manufacturer: formData.get('manufacturer'),
                quantity: parseInt(formData.get('quantity')) || 0,
                groupId: this.currentGroupId === 'all' ? null : this.currentGroupId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.labels.push(label);
            this.saveLabels();
            form.reset();
            this.renderGroupsSelector();
            Utils.showToast('Этикетка создана');
            this.navigate('labels');
        },

        openEditModal(id) {
            const label = this.labels.find(l => l.id === id);
            if (!label) return;
            const form = document.getElementById('edit-form');
            if (!form) return;
            form.querySelector('input[name="id"]').value = label.id;
            form.querySelector('input[name="article"]').value = label.article || '';
            form.querySelector('input[name="barcode"]').value = label.barcode || '';
            form.querySelector('input[name="color"]').value = label.color || '';
            form.querySelector('input[name="size"]').value = label.size || '';
            form.querySelector('input[name="name"]').value = label.name || '';
            form.querySelector('input[name="seller"]').value = label.seller || '';
            form.querySelector('input[name="gtin"]').value = label.gtin || '';
            form.querySelector('input[name="brand"]').value = label.brand || '';
            form.querySelector('input[name="expiry"]').value = label.expiry || '';
            form.querySelector('input[name="country"]').value = label.country || '';
            form.querySelector('input[name="composition"]').value = label.composition || '';
            form.querySelector('input[name="manufacturer"]').value = label.manufacturer || '';
            form.querySelector('input[name="quantity"]').value = label.quantity || 0;
            
            const modal = document.getElementById('edit-modal');
            if (modal) modal.classList.remove('hidden');
        },

        saveEdit() {
            const form = document.getElementById('edit-form');
            if (!form) return;
            const formData = new FormData(form);
            const id = formData.get('id');
            const idx = this.labels.findIndex(l => l.id === id);
            if (idx === -1) return;
            this.labels[idx] = {
                ...this.labels[idx],
                article: formData.get('article'),
                barcode: formData.get('barcode'),
                color: formData.get('color'),
                size: formData.get('size'),
                name: formData.get('name'),
                seller: formData.get('seller'),
                gtin: formData.get('gtin'),
                brand: formData.get('brand'),
                expiry: formData.get('expiry'),
                country: formData.get('country'),
                composition: formData.get('composition'),
                manufacturer: formData.get('manufacturer'),
                quantity: parseInt(formData.get('quantity')) || 0,
                updatedAt: new Date().toISOString()
            };
            this.saveLabels();
            this.renderLabels();
            this.renderGroupsSelector();
            
            const modal = document.getElementById('edit-modal');
            if (modal) modal.classList.add('hidden');
            this.resetDuplicateMode();
            Utils.showToast('Сохранено');
        },

        duplicateLabelWithEdit(id) {
            this.openEditModal(id);
            const headerTitle = document.querySelector('#edit-modal .modal-header h2');
            if (headerTitle) headerTitle.textContent = 'Дублировать этикетку';
            this.isDuplicating = true;
            this.duplicateOriginalId = id;
            const self = this;
            const restore = () => {
                const hTitle = document.querySelector('#edit-modal .modal-header h2');
                if (hTitle) hTitle.textContent = 'Редактировать этикетку';
                self.isDuplicating = false;
                self.duplicateOriginalId = null;
            };
            const modalClose = document.getElementById('modal-close');
            const btnCancelEdit = document.getElementById('btn-cancel-edit');
            if (modalClose) modalClose.onclick = restore;
            if (btnCancelEdit) btnCancelEdit.onclick = restore;
        },

        duplicateFromEdit() {
            if (!this.duplicateOriginalId) return;
            const form = document.getElementById('edit-form');
            if (!form) return;
            const formData = new FormData(form);
            const newLabel = {
                id: Utils.generateId(),
                article: formData.get('article'),
                barcode: formData.get('barcode'),
                color: formData.get('color'),
                size: formData.get('size'),
                name: formData.get('name'),
                seller: formData.get('seller'),
                gtin: formData.get('gtin'),
                brand: formData.get('brand'),
                expiry: formData.get('expiry'),
                country: formData.get('country'),
                composition: formData.get('composition'),
                manufacturer: formData.get('manufacturer'),
                quantity: parseInt(formData.get('quantity')) || 0,
                groupId: this.currentGroupId === 'all' ? null : this.currentGroupId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.labels.push(newLabel);
            this.saveLabels();
            this.renderLabels();
            this.renderGroupsSelector();
            
            const modal = document.getElementById('edit-modal');
            if (modal) modal.classList.add('hidden');
            this.resetDuplicateMode();
            Utils.showToast('Этикетка дублирована');
        },

        resetDuplicateMode() {
            this.isDuplicating = false;
            this.duplicateOriginalId = null;
            const hTitle = document.querySelector('#edit-modal .modal-header h2');
            if (hTitle) hTitle.textContent = 'Редактировать этикетку';
        },

        duplicateSelected() {
            const newLabels = [];
            this.selectedLabels.forEach(id => {
                const label = this.labels.find(l => l.id === id);
                if (label) newLabels.push({ ...label, id: Utils.generateId(), quantity: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            });
            this.labels.push(...newLabels);
            this.saveLabels();
            this.selectedLabels.clear();
            const sAll = document.getElementById('select-all');
            if (sAll) sAll.checked = false;
            this.renderLabels();
            this.renderGroupsSelector();
            this.updateBulkActions();
            Utils.showToast(`Дублировано: ${newLabels.length}`);
        },

        deleteLabel(id) {
            if (!confirm('Удалить?')) return;
            this.labels = this.labels.filter(l => l.id !== id);
            this.selectedLabels.delete(id);
            this.saveLabels();
            this.renderGroupsSelector();
            this.renderLabels();
            this.updateBulkActions();
            Utils.showToast('Удалено');
        },

        deleteSelected() {
            if (!confirm(`Удалить ${this.selectedLabels.size} этикеток?`)) return;
            this.labels = this.labels.filter(l => !this.selectedLabels.has(l.id));
            this.selectedLabels.clear();
            const sAll = document.getElementById('select-all');
            if (sAll) sAll.checked = false;
            this.saveLabels();
            this.renderGroupsSelector();
            this.renderLabels();
            this.updateBulkActions();
            Utils.showToast('Удалено');
        },

        showQuantityImportModal() { 
            const modal = document.getElementById('quantity-import-modal');
            if (modal) modal.classList.remove('hidden'); 
        },

        initQuantityImport() {
            const dropZone = document.getElementById('quantity-drop-zone');
            const fileInput = document.getElementById('quantity-file-input');
            if (!dropZone || !fileInput) return;
            
            const self = this;
            const btnSelect = document.getElementById('quantity-btn-select-file');
            if (btnSelect) btnSelect.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', (e) => { if (e.target.files[0]) self.handleQuantityFile(e.target.files[0]); });
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
            dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) self.handleQuantityFile(e.dataTransfer.files[0]); });
            
            const btnCancel = document.getElementById('quantity-btn-cancel');
            if (btnCancel) btnCancel.addEventListener('click', () => { 
                const modal = document.getElementById('quantity-import-modal');
                if (modal) modal.classList.add('hidden'); 
                self.importQuantityData = null; 
            });
            
            const btnConfirm = document.getElementById('quantity-btn-confirm');
            if (btnConfirm) btnConfirm.addEventListener('click', () => self.applyQuantityImport());
        },

        handleQuantityFile(file) {
            if (!window.XLSX) { Utils.showToast('Библиотека XLSX не загружена'); return; }
            const reader = new FileReader();
            const self = this;
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    self.importQuantityData = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    self.showQuantityImportPreview(self.importQuantityData);
                } catch (err) { Utils.showToast('Ошибка: ' + err.message); }
            };
            reader.readAsArrayBuffer(file);
        },

        showQuantityImportPreview(data) {
            const dropZone = document.getElementById('quantity-drop-zone');
            const preview = document.getElementById('quantity-import-preview');
            const countEl = document.getElementById('quantity-import-count');
            if (dropZone) dropZone.classList.add('hidden');
            if (preview) preview.classList.remove('hidden');
            if (countEl) countEl.textContent = `Найдено: ${data.length}`;
            
            const thead = document.getElementById('quantity-preview-thead');
            const tbody = document.getElementById('quantity-preview-tbody');
            if (!thead || !tbody || data.length === 0) return;
            const headers = Object.keys(data[0]);
            thead.innerHTML = '<tr>' + headers.map(h => `<th>${Utils.escapeHtml(h)}</th>`).join('') + '</tr>';
            tbody.innerHTML = data.slice(0, 10).map(row => '<tr>' + headers.map(h => `<td>${Utils.escapeHtml(String(row[h] ?? ''))}</td>`).join('') + '</tr>').join('');
        },

        applyQuantityImport() {
            if (!this.importQuantityData) return;
            let count = 0;
            this.importQuantityData.forEach(row => {
                const article = row['Артикул'] ?? row['article'];
                const quantity = parseInt(row['Количество'] ?? row['quantity'] ?? 0);
                if (article) {
                    const label = this.labels.find(l => l.article === String(article));
                    if (label) { label.quantity = quantity; label.updatedAt = new Date().toISOString(); count++; }
                }
            });
            this.saveLabels();
            this.renderLabels();
            this.renderGroupsSelector();
            
            const modal = document.getElementById('quantity-import-modal');
            if (modal) modal.classList.add('hidden');
            Utils.showToast(`Обновлено количество для: ${count} этикеток`);
        },

        updatePrintPreview() {
            const preview = document.getElementById('label-preview');
            if (!preview) return;
            
            const printTypeEl = document.getElementById('print-type');
            const labelSizeEl = document.getElementById('print-label-size');
            const orientationEl = document.getElementById('print-orientation');
            const gapEl = document.getElementById('print-gap');
            
            if (!printTypeEl || !labelSizeEl || !orientationEl || !gapEl) return;
            
            const printType = printTypeEl.value;
            const labelSize = labelSizeEl.value;
            const orientation = orientationEl.value;
            const [labelWidth, labelHeight] = labelSize.split('x').map(Number);
            const gap = parseInt(gapEl.value) || 3;
            const settings = this.getPrintSettings();
            settings.orientation = orientation;

            const firstSelectedId = this.labelsForPrint && this.labelsForPrint.length > 0
                ? this.labelsForPrint[0]
                : (this.selectedLabels.size > 0 ? Array.from(this.selectedLabels)[0] : null);
            const label = firstSelectedId ? this.labels.find(l => l.id === firstSelectedId) : this.labels[0];

            if (!label) {
                preview.innerHTML = '<p style="text-align:center;padding:40px;color:#999;font-family:sans-serif;">Нет данных для предпросмотра</p>';
                return;
            }

            preview.innerHTML = '';
            preview.style.cssText = `border:2px dashed #E5E7EB;border-radius:12px;padding:20px;background:#F9FAFB;display:flex;flex-direction:column;align-items:center;overflow:auto;`;

            if (printType === 'thermal') {
                const info = document.createElement('div');
                info.style.cssText = 'margin-bottom:12px;font-size:13px;color:#6B7280;font-family:sans-serif;';
                const orientText = orientation === 'landscape' ? 'альбомная' : 'книжная';
                info.textContent = `🏷️ Термоэтикетка: ${labelWidth}×${labelHeight} мм (${orientText}, 1 этикетка = 1 страница)`;
                preview.appendChild(info);
                const labelEl = PDFGenerator.createLabelElement(label, settings, labelWidth, labelHeight);
                labelEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                preview.appendChild(labelEl);
            } else {
                const pageWidth = orientation === 'landscape' ? 297 : 210;
                const pageHeight = orientation === 'landscape' ? 210 : 297;
                const margin = 5;
                const usableWidth = pageWidth - margin * 2;
                const usableHeight = pageHeight - margin * 2;
                const cols = Math.max(1, Math.floor((usableWidth + gap) / (labelWidth + gap)));
                const rows = Math.max(1, Math.floor((usableHeight + gap) / (labelHeight + gap)));
                const labelsPerPage = cols * rows;
                const info = document.createElement('div');
                info.style.cssText = 'margin-bottom:12px;font-size:13px;color:#6B7280;font-family:sans-serif;';
                const orientText = orientation === 'landscape' ? 'альбомная' : 'книжная';
                info.textContent = `📄 A4: ${cols}×${rows} = ${labelsPerPage} этикеток на листе (зазор ${gap} мм, ${orientText})`;
                preview.appendChild(info);
                const scale = Math.min(280 / pageWidth, 400 / pageHeight);
                const a4Div = document.createElement('div');
                a4Div.style.cssText = `width:${pageWidth * scale}px;height:${pageHeight * scale}px;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.1);position:relative;overflow:hidden;`;
                const gridWidth = cols * labelWidth + (cols - 1) * gap;
                const gridHeight = rows * labelHeight + (rows - 1) * gap;
                const offsetX = margin + (usableWidth - gridWidth) / 2;
                const offsetY = margin + (usableHeight - gridHeight) / 2;
                const previewCount = Math.min(labelsPerPage, 12);
                for (let i = 0; i < previewCount; i++) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const x = offsetX + col * (labelWidth + gap);
                    const y = offsetY + row * (labelHeight + gap);
                    const labelEl = PDFGenerator.createLabelElement(label, settings, labelWidth, labelHeight);
                    labelEl.style.position = 'absolute';
                    labelEl.style.left = (x * scale) + 'px';
                    labelEl.style.top = (y * scale) + 'px';
                    labelEl.style.transform = `scale(${scale})`;
                    labelEl.style.transformOrigin = 'top left';
                    labelEl.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                    a4Div.appendChild(labelEl);
                }
                preview.appendChild(a4Div);
            }
        },

        getPrintSettings() {
            const getValue = (id, fallback) => {
                const el = document.getElementById(id);
                return el ? el.value : fallback;
            };
            const getChecked = (id) => {
                const el = document.getElementById(id);
                return el ? el.checked : false;
            };
            return {
                printType: getValue('print-type', 'thermal'),
                labelSize: getValue('print-label-size', '58x38.6'),
                orientation: getValue('print-orientation', 'portrait'),
                barcodeFormat: getValue('print-barcode-format', 'auto'),
                textSize: getValue('print-text-size', 'normal'),
                centerText: getChecked('print-center-text'),
                barcodeOnly: getChecked('print-barcode-only'),
                noBarcode: getChecked('print-no-barcode'),
                colorSizeRow: getChecked('print-color-size-row'),
                gap: getValue('print-gap', '3')
            };
        },

        async printLabels() {
            const settings = this.getPrintSettings();
            let labelsToPrint = [];
            if (this.labelsForPrint && this.labelsForPrint.length > 0) {
                labelsToPrint = this.labels.filter(l => this.labelsForPrint.includes(l.id));
            } else if (this.selectedLabels.size > 0) {
                labelsToPrint = this.labels.filter(l => this.selectedLabels.has(l.id));
            } else { labelsToPrint = this.labels; }
            if (labelsToPrint.length === 0) { Utils.showToast('Нет этикеток для печати'); return; }
            const expanded = [];
            labelsToPrint.forEach(label => {
                const qty = label.quantity || 1;
                for (let i = 0; i < qty; i++) expanded.push({ ...label });
            });
            if (expanded.length === 0) { Utils.showToast('Установите количество больше 0'); return; }

            const progressToast = document.createElement('div');
            progressToast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#111827;color:white;padding:16px 24px;border-radius:8px;z-index:10000;min-width:250px;font-family:sans-serif;';
            progressToast.innerHTML = '<div style="margin-bottom:8px;">Генерация PDF...</div><div style="height:4px;background:#374151;border-radius:2px;overflow:hidden;"><div id="pdf-progress-fill" style="height:100%;background:#4F46E5;width:0%;transition:width 0.3s;"></div></div><div id="pdf-progress-text" style="margin-top:6px;font-size:12px;color:#9CA3AF;">0 / ' + expanded.length + '</div>';
            document.body.appendChild(progressToast);

            try {
                await PDFGenerator.generateLabelsPDF(expanded, settings, (done, total) => {
                    const fill = document.getElementById('pdf-progress-fill');
                    const text = document.getElementById('pdf-progress-text');
                    if (fill) fill.style.width = ((done / total) * 100) + '%';
                    if (text) text.textContent = done + ' / ' + total;
                });
                progressToast.remove();
                Utils.showToast('✅ PDF успешно создан!');
            } catch (error) {
                console.error('Ошибка:', error);
                progressToast.remove();
                alert('Ошибка генерации PDF: ' + error.message);
            }
        },

        initImport() {
            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('file-input');
            if (!dropZone || !fileInput) return;
            
            const self = this;
            const btnSelect = document.getElementById('btn-select-file');
            if (btnSelect) btnSelect.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', (e) => { if (e.target.files[0]) self.handleFile(e.target.files[0]); });
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
            dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) self.handleFile(e.dataTransfer.files[0]); });
            
            const btnCancel = document.getElementById('btn-cancel-import');
            if (btnCancel) {
                btnCancel.addEventListener('click', () => { 
                    const preview = document.getElementById('import-preview');
                    const dZone = document.getElementById('drop-zone');
                    if (preview) preview.classList.add('hidden'); 
                    if (dZone) dZone.classList.remove('hidden'); 
                    fileInput.value = ''; 
                });
            }
            const btnConfirm = document.getElementById('btn-confirm-import');
            if (btnConfirm) btnConfirm.addEventListener('click', () => self.confirmImport());
            
            const btnDownload = document.getElementById('btn-download-template');
            if (btnDownload) btnDownload.addEventListener('click', () => self.downloadTemplate());
        },

        handleFile(file) {
            if (!window.XLSX) { Utils.showToast('Библиотека XLSX не загружена'); return; }
            const reader = new FileReader();
            const self = this;
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    self.importData = window.XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    self.showImportPreview(self.importData);
                } catch (err) { Utils.showToast('Ошибка: ' + err.message); }
            };
            reader.readAsArrayBuffer(file);
        },

        showImportPreview(data) {
            const dropZone = document.getElementById('drop-zone');
            const preview = document.getElementById('import-preview');
            if (dropZone) dropZone.classList.add('hidden');
            if (preview) preview.classList.remove('hidden');
            
            const thead = document.getElementById('preview-thead');
            const tbody = document.getElementById('preview-tbody');
            if (!thead || !tbody || data.length === 0) return;
            const headers = Object.keys(data[0]);
            thead.innerHTML = '<tr>' + headers.map(h => `<th>${Utils.escapeHtml(h)}</th>`).join('') + '</tr>';
            tbody.innerHTML = data.slice(0, 10).map(row => '<tr>' + headers.map(h => `<td>${Utils.escapeHtml(String(row[h] ?? ''))}</td>`).join('') + '</tr>').join('');
        },

        confirmImport() {
            if (!this.importData) return;
            const newLabels = this.importData.map(row => ({
                id: Utils.generateId(),
                article: String(row['Артикул'] ?? row['article'] ?? ''),
                barcode: String(row['Штрихкод'] ?? row['barcode'] ?? ''),
                color: String(row['Цвет'] ?? row['color'] ?? ''),
                size: String(row['Размер'] ?? row['size'] ?? ''),
                name: String(row['Название товара'] ?? row['name'] ?? ''),
                seller: String(row['Наименование продавца'] ?? row['Наименование поставщика'] ?? row['seller'] ?? ''),
                gtin: String(row['GTIN'] ?? row['gtin'] ?? ''),
                brand: String(row['Бренд'] ?? row['brand'] ?? ''),
                expiry: String(row['Срок годности'] ?? row['expiry'] ?? ''),
                country: String(row['Страна производства'] ?? row['country'] ?? ''),
                composition: String(row['Состав'] ?? row['composition'] ?? ''),
                manufacturer: String(row['Производитель'] ?? row['manufacturer'] ?? ''),
                quantity: parseInt(row['Количество'] ?? row['quantity'] ?? 0),
                groupId: this.currentGroupId === 'all' ? null : this.currentGroupId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })).filter(l => l.article && l.barcode);

            this.labels.push(...newLabels);
            this.saveLabels();
            this.renderGroupsSelector();
            this.renderLabels();
            Utils.showToast(`Импортировано этикеток: ${newLabels.length}`);
            
            const preview = document.getElementById('import-preview');
            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('file-input');
            
            if (preview) preview.classList.add('hidden');
            if (dropZone) dropZone.classList.remove('hidden');
            if (fileInput) fileInput.value = '';
            this.navigate('labels');
        },

        downloadTemplate() {
            if (!window.XLSX) { Utils.showToast('Библиотека XLSX не загружена'); return; }
            const template = [{
                'Артикул': 'ART001', 'Штрихкод': '4601234567890', 'Цвет': 'белый', 'Размер': 'XL',
                'Название товара': 'Футболка', 'Наименование продавца': 'ООО Пример', 'GTIN': '',
                'Количество': 10, 'Бренд': 'Brand', 'Срок годности': '', 'Страна производства': 'Россия'
            }];
            const ws = window.XLSX.utils.json_to_sheet(template);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, 'Этикетки');
            window.XLSX.writeFile(wb, 'template.xlsx');
        },

        exportToExcel() {
            if (!window.XLSX) { Utils.showToast('Библиотека XLSX не загружена'); return; }
            if (this.labels.length === 0) { Utils.showToast('Нет данных для экспорта'); return; }
            const data = this.labels.map(l => {
                const group = l.groupId ? this.groups.find(g => g.id === l.groupId) : null;
                return {
                    'Артикул': l.article, 'Штрихкод': l.barcode, 'Цвет': l.color || '', 'Размер': l.size || '',
                    'Название товара': l.name || '', 'Наименование продавца': l.seller || '', 'GTIN': l.gtin || '',
                    'Количество': l.quantity || 0, 'Бренд': l.brand || '', 'Срок годности': l.expiry || '',
                    'Группа': group ? group.name : '',
                    'Создана': l.createdAt, 'Изменена': l.updatedAt || l.createdAt
                };
            });
            const ws = window.XLSX.utils.json_to_sheet(data);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, 'Этикетки');
            window.XLSX.writeFile(wb, `labels_${new Date().toISOString().split('T')[0]}.xlsx`);
            Utils.showToast('Экспорт завершен');
        }
    };

    document.addEventListener('DOMContentLoaded', () => App.init());
})();
