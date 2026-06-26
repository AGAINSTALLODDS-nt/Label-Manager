// LabelManager Application
(function() {
    'use strict';

    // ==================== ХРАНИЛИЩЕ ДАННЫХ ====================
    const Storage = {
        getUsers() {
            return JSON.parse(localStorage.getItem('lm_users') || '[]');
        },
        
        saveUsers(users) {
            localStorage.setItem('lm_users', JSON.stringify(users));
        },
        
        getCurrentUser() {
            return JSON.parse(localStorage.getItem('lm_current_user') || 'null');
        },
        
        setCurrentUser(user) {
            localStorage.setItem('lm_current_user', JSON.stringify(user));
        },
        
        getLabels(userId) {
            const allLabels = JSON.parse(localStorage.getItem('lm_labels') || '{}');
            return allLabels[userId] || [];
        },
        
        saveLabels(userId, labels) {
            const allLabels = JSON.parse(localStorage.getItem('lm_labels') || '{}');
            allLabels[userId] = labels;
            localStorage.setItem('lm_labels', JSON.stringify(allLabels));
        },
        
        getPrintSettings(userId) {
            const allSettings = JSON.parse(localStorage.getItem('lm_print_settings') || '{}');
            return allSettings[userId] || {};
        },
        
        savePrintSettings(userId, settings) {
            const allSettings = JSON.parse(localStorage.getItem('lm_print_settings') || '{}');
            allSettings[userId] = settings;
            localStorage.setItem('lm_print_settings', JSON.stringify(allSettings));
        }
    };

    // ==================== УТИЛИТЫ ====================
    const Utils = {
        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        },
        
        generateBarcode(format = 'EAN13') {
            if (format === 'EAN13') {
                let code = '';
                for (let i = 0; i < 12; i++) {
                    code += Math.floor(Math.random() * 10);
                }
                let sum = 0;
                for (let i = 0; i < 12; i++) {
                    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
                }
                const checkDigit = (10 - (sum % 10)) % 10;
                return code + checkDigit;
            } else {
                let code = '';
                for (let i = 0; i < 12; i++) {
                    code += Math.floor(Math.random() * 10);
                }
                return code;
            }
        },
        
        detectBarcodeFormat(barcode) {
            const cleanBarcode = barcode.replace(/\D/g, '');
            
            if (cleanBarcode.length === 13) {
                return 'EAN13';
            } else if (cleanBarcode.length === 8) {
                return 'EAN8';
            } else if (cleanBarcode.length === 12) {
                return 'UPC';
            } else if (barcode.startsWith('*') && barcode.endsWith('*') && barcode.length > 2) {
                return 'CODE39';
            } else {
                return 'CODE128';
            }
        },
        
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Скопировано в буфер обмена');
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.showToast('Скопировано в буфер обмена');
            });
        },
        
        showToast(message) {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                background: var(--text);
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                box-shadow: var(--shadow-lg);
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },
        
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
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
                document.getElementById('auth-screen').classList.remove('hidden');
            }
            
            document.querySelectorAll('.auth-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    const tabName = tab.dataset.tab;
                    document.getElementById('login-form').classList.toggle('hidden', tabName !== 'login');
                    document.getElementById('register-form').classList.toggle('hidden', tabName !== 'register');
                    document.getElementById('auth-error').classList.add('hidden');
                });
            });
            
            document.getElementById('login-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.login();
            });
            
            document.getElementById('register-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.register();
            });
            
            document.getElementById('btn-logout').addEventListener('click', () => {
                this.logout();
            });
        },
        
        login() {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('auth-error');
            
            const users = Storage.getUsers();
            const user = users.find(u => u.username === username && u.password === password);
            
            if (user) {
                Storage.setCurrentUser(user);
                errorEl.classList.add('hidden');
                App.showMainApp();
            } else {
                errorEl.textContent = 'Неверный логин или пароль';
                errorEl.classList.remove('hidden');
            }
        },
        
        register() {
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value;
            const passwordConfirm = document.getElementById('reg-password-confirm').value;
            const errorEl = document.getElementById('auth-error');
            
            if (password !== passwordConfirm) {
                errorEl.textContent = 'Пароли не совпадают';
                errorEl.classList.remove('hidden');
                return;
            }
            
            const users = Storage.getUsers();
            if (users.find(u => u.username === username)) {
                errorEl.textContent = 'Пользователь с таким логином уже существует';
                errorEl.classList.remove('hidden');
                return;
            }
            
            const newUser = {
                id: Utils.generateId(),
                username,
                password,
                createdAt: new Date().toISOString()
            };
            
            users.push(newUser);
            Storage.saveUsers(users);
            Storage.setCurrentUser(newUser);
            
            errorEl.classList.add('hidden');
            App.showMainApp();
        },
        
        logout() {
            localStorage.removeItem('lm_current_user');
            document.getElementById('app').classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('login-form').reset();
            document.getElementById('register-form').reset();
        }
    };

    // ==================== ГЕНЕРАЦИЯ PDF ====================
    const PDFGenerator = {
        async generateLabelsPDF(labels, settings) {
            const { jsPDF } = window.jspdf;
            
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
                compress: true
            });
            
            // Загружаем шрифт с поддержкой кириллицы
            try {
                const fontData = await this.loadCyrillicFont();
                pdf.addFileToVFS('Arial Cyr.ttf', fontData);
                pdf.addFont('Arial Cyr.ttf', 'Arial Cyr', 'normal');
                pdf.setFont('Arial Cyr');
            } catch (error) {
                console.error('Ошибка загрузки шрифта:', error);
                Utils.showToast('Внимание: могут быть проблемы с отображением кириллицы');
            }
            
            const printType = settings.printType || 'thermal';
            const labelSize = settings.labelSize || '58x38.6';
            const [labelWidth, labelHeight] = labelSize.split('x').map(Number);
            const gap = parseInt(settings.gap) || 5;
            
            if (printType === 'thermal') {
                for (let i = 0; i < labels.length; i++) {
                    if (i > 0) {
                        pdf.addPage([labelWidth, labelHeight]);
                    }
                    this.drawLabelOnPDF(pdf, labels[i], settings, 0, 0, labelWidth, labelHeight);
                }
            } else {
                const pageWidth = 210;
                const pageHeight = 297;
                
                const cols = Math.floor((pageWidth - gap) / (labelWidth + gap));
                const rows = Math.floor((pageHeight - gap) / (labelHeight + gap));
                
                let currentPage = 0;
                let labelIndex = 0;
                
                while (labelIndex < labels.length) {
                    if (currentPage > 0) {
                        pdf.addPage('a4');
                    }
                    
                    for (let row = 0; row < rows && labelIndex < labels.length; row++) {
                        for (let col = 0; col < cols && labelIndex < labels.length; col++) {
                            const x = col * (labelWidth + gap) + gap / 2;
                            const y = row * (labelHeight + gap) + gap / 2;
                            this.drawLabelOnPDF(pdf, labels[labelIndex], settings, x, y, labelWidth, labelHeight);
                            labelIndex++;
                        }
                    }
                    currentPage++;
                }
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            pdf.save(`labels_${timestamp}.pdf`);
        },
        
        async loadCyrillicFont() {
            // Используем base64 закодированный шрифт Arial с поддержкой кириллицы
            // Это упрощенная версия - в продакшене лучше загрузить реальный шрифт
            const response = await fetch('https://raw.githubusercontent.com/SheetJS/js-xlsx/master/misc/font/arial.ttf');
            const buffer = await response.arrayBuffer();
            return this.arrayBufferToBase64(buffer);
        },
        
        arrayBufferToBase64(buffer) {
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        },
        
        drawLabelOnPDF(pdf, label, settings, x, y, width, height) {
            const fontSize = parseInt(settings.textSize) || 10;
            const centerText = settings.centerText !== false;
            const barcodeOnly = settings.barcodeOnly || false;
            const noBarcode = settings.noBarcode || false;
            const colorSizeRow = settings.colorSizeRow || false;
            const barcodeFormat = settings.barcodeFormat || 'auto';
            
            let format = barcodeFormat;
            if (barcodeFormat === 'auto') {
                format = Utils.detectBarcodeFormat(label.barcode);
            }
            
            pdf.setFontSize(fontSize);
            pdf.setTextColor(0, 0, 0);
            
            let currentY = y + 2;
            const lineHeight = fontSize * 0.35;
            
            if (!barcodeOnly && !noBarcode) {
                const canvas = document.createElement('canvas');
                try {
                    JsBarcode(canvas, label.barcode, {
                        format: format === 'EAN13' ? 'EAN13' : 'CODE128',
                        width: 1.5,
                        height: 20,
                        displayValue: false,
                        margin: 0
                    });
                    
                    const imgData = canvas.toDataURL('image/png');
                    const barcodeWidth = width - 4;
                    pdf.addImage(imgData, 'PNG', x + 2, currentY, barcodeWidth, 20);
                    currentY += 22;
                    
                    pdf.setFontSize(7);
                    const barcodeTextX = centerText ? x + width / 2 : x + 2;
                    pdf.text(label.barcode, barcodeTextX, currentY, centerText ? { align: 'center' } : {});
                    currentY += 3;
                    pdf.setFontSize(fontSize);
                } catch (e) {
                    console.error('Ошибка генерации штрихкода:', e);
                }
            }
            
            if (!barcodeOnly) {
                pdf.setFont('Arial Cyr', 'bold');
                const articleText = `Артикул: ${label.article}`;
                const articleX = centerText ? x + width / 2 : x + 2;
                pdf.text(articleText, articleX, currentY, centerText ? { align: 'center' } : {});
                currentY += lineHeight + 1;
                pdf.setFont('Arial Cyr', 'normal');
                
                if (label.name) {
                    const wrappedName = this.wrapText(label.name, width - 4, fontSize);
                    const nameX = centerText ? x + width / 2 : x + 2;
                    wrappedName.forEach(line => {
                        pdf.text(line, nameX, currentY, centerText ? { align: 'center' } : {});
                        currentY += lineHeight + 1;
                    });
                }
                
                if (colorSizeRow) {
                    let colorSizeText = '';
                    if (label.color) colorSizeText += `Цвет: ${label.color}`;
                    if (label.color && label.size) colorSizeText += ' / ';
                    if (label.size) colorSizeText += `Разм.: ${label.size}`;
                    
                    if (colorSizeText) {
                        const csX = centerText ? x + width / 2 : x + 2;
                        pdf.text(colorSizeText, csX, currentY, centerText ? { align: 'center' } : {});
                        currentY += lineHeight + 1;
                    }
                } else {
                    if (label.color) {
                        const colorX = centerText ? x + width / 2 : x + 2;
                        pdf.text(`Цвет: ${label.color}`, colorX, currentY, centerText ? { align: 'center' } : {});
                        currentY += lineHeight + 1;
                    }
                    if (label.size) {
                        const sizeX = centerText ? x + width / 2 : x + 2;
                        pdf.text(`Размер: ${label.size}`, sizeX, currentY, centerText ? { align: 'center' } : {});
                        currentY += lineHeight + 1;
                    }
                }
                
                if (label.seller) {
                    const sellerX = centerText ? x + width / 2 : x + 2;
                    pdf.text(label.seller, sellerX, currentY, centerText ? { align: 'center' } : {});
                    currentY += lineHeight + 1;
                }
                
                if (label.gtin) {
                    const gtinX = centerText ? x + width / 2 : x + 2;
                    pdf.text(`GTIN: ${label.gtin}`, gtinX, currentY, centerText ? { align: 'center' } : {});
                    currentY += lineHeight + 1;
                }
                
                if (label.brand) {
                    pdf.setFont('Arial Cyr', 'bold');
                    const brandX = centerText ? x + width / 2 : x + 2;
                    pdf.text(`Бренд: ${label.brand}`, brandX, currentY, centerText ? { align: 'center' } : {});
                    pdf.setFont('Arial Cyr', 'normal');
                    currentY += lineHeight + 1;
                }
                
                if (label.expiry) {
                    const expiryX = centerText ? x + width / 2 : x + 2;
                    pdf.text(`Срок годности: ${label.expiry}`, expiryX, currentY, centerText ? { align: 'center' } : {});
                }
            }
        },
        
        wrapText(text, maxWidth, fontSize) {
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            const charWidth = fontSize * 0.6 * 0.264583;
            
            for (let word of words) {
                const testLine = currentLine + (currentLine ? ' ' : '') + word;
                const testWidth = testLine.length * charWidth;
                
                if (testWidth > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            
            if (currentLine) {
                lines.push(currentLine);
            }
            
            return lines;
        }
    };

    // ==================== ПРИЛОЖЕНИЕ ====================
    const App = {
        currentUser: null,
        labels: [],
        selectedLabels: new Set(),
        currentPage: 'labels',
        itemsPerPage: 15,
        currentFilter: '',
        importQuantityData: null,
        
        init() {
            Auth.init();
            this.bindEvents();
        },
        
        showMainApp() {
            this.currentUser = Storage.getCurrentUser();
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            document.getElementById('user-name').textContent = this.currentUser.username;
            
            this.loadLabels();
            this.renderLabels();
            this.updateLabelsCount();
        },
        
        bindEvents() {
            document.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const page = item.dataset.page;
                    this.navigate(page);
                });
            });
            
            document.getElementById('btn-add-label').addEventListener('click', () => {
                this.navigate('create');
            });
            
            document.getElementById('btn-cancel-create').addEventListener('click', () => {
                this.navigate('labels');
            });
            
            document.getElementById('create-label-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.createLabel();
            });
            
            document.getElementById('btn-generate-barcode').addEventListener('click', () => {
                const barcodeInput = document.querySelector('#create-label-form input[name="barcode"]');
                const formatSelect = document.getElementById('create-barcode-format');
                const format = formatSelect ? formatSelect.value : 'EAN13';
                barcodeInput.value = Utils.generateBarcode(format);
                
                const detectedFormat = Utils.detectBarcodeFormat(barcodeInput.value);
                const formatDisplay = document.getElementById('create-barcode-format-display');
                if (formatDisplay) {
                    formatDisplay.textContent = detectedFormat;
                }
            });
            
            document.getElementById('btn-import-excel').addEventListener('click', () => {
                this.navigate('import');
            });
            
            document.getElementById('btn-export-excel').addEventListener('click', () => {
                this.exportToExcel();
            });
            
            document.getElementById('search-input').addEventListener('input', (e) => {
                this.currentFilter = e.target.value.toLowerCase();
                this.renderLabels();
            });
            
            document.getElementById('btn-clear-filters').addEventListener('click', () => {
                document.getElementById('search-input').value = '';
                this.currentFilter = '';
                this.renderLabels();
            });
            
            document.getElementById('select-all').addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.label-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    const id = cb.dataset.id;
                    if (e.target.checked) {
                        this.selectedLabels.add(id);
                    } else {
                        this.selectedLabels.delete(id);
                    }
                });
                this.updateBulkActions();
            });
            
            document.getElementById('btn-bulk-duplicate').addEventListener('click', () => {
                this.duplicateSelected();
            });
            
            document.getElementById('btn-bulk-delete').addEventListener('click', () => {
                this.deleteSelected();
            });
            
            document.getElementById('btn-bulk-set-quantity').addEventListener('click', () => {
                this.showQuantityImportModal();
            });
            
            document.getElementById('btn-bulk-print').addEventListener('click', () => {
                this.navigateToPrint();
            });
            
            document.getElementById('modal-close').addEventListener('click', () => {
                document.getElementById('edit-modal').classList.add('hidden');
            });
            
            document.getElementById('btn-cancel-edit').addEventListener('click', () => {
                document.getElementById('edit-modal').classList.add('hidden');
            });
            
            document.getElementById('edit-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveEdit();
            });
            
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-copy-barcode')) {
                    const barcodeInput = e.target.closest('.input-with-btn').querySelector('input');
                    Utils.copyToClipboard(barcodeInput.value);
                }
            });
            
            document.getElementById('btn-back-to-labels').addEventListener('click', () => {
                this.navigate('labels');
            });
            
            document.getElementById('btn-print').addEventListener('click', () => {
                this.printLabels();
            });
            
            document.querySelectorAll('.template-card').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                });
            });
            
            ['print-barcode-format', 'print-text-size', 'print-center-text', 'print-barcode-only', 
             'print-no-barcode', 'print-color-size-row', 'print-label-size', 'print-type'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('change', () => this.updatePrintPreview());
                }
            });
            
            this.initImport();
            this.initQuantityImport();
        },
        
        navigate(page) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            
            document.getElementById(`page-${page}`).classList.add('active');
            const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
            if (navItem) {
                navItem.classList.add('active');
            }
            
            this.currentPage = page;
            
            if (page === 'labels') {
                this.renderLabels();
            } else if (page === 'print') {
                this.updatePrintPreview();
            }
        },
        
        navigateToPrint() {
            this.labelsForPrint = Array.from(this.selectedLabels);
            this.navigate('print');
        },
        
        loadLabels() {
            this.labels = Storage.getLabels(this.currentUser.id);
        },
        
        saveLabels() {
            Storage.saveLabels(this.currentUser.id, this.labels);
            this.updateLabelsCount();
        },
        
        updateLabelsCount() {
            document.getElementById('labels-count').textContent = this.labels.length;
        },
        
        renderLabels() {
            const tbody = document.getElementById('labels-tbody');
            tbody.innerHTML = '';
            
            let filteredLabels = this.labels;
            if (this.currentFilter) {
                filteredLabels = this.labels.filter(label => {
                    return Object.values(label).some(value => 
                        String(value).toLowerCase().includes(this.currentFilter)
                    );
                });
            }
            
            filteredLabels.forEach(label => {
                const barcodeFormat = Utils.detectBarcodeFormat(label.barcode);
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="col-checkbox">
                        <input type="checkbox" class="label-checkbox" data-id="${label.id}" 
                            ${this.selectedLabels.has(label.id) ? 'checked' : ''}>
                    </td>
                    <td class="col-quantity">
                        <div class="quantity-control">
                            <button class="btn-decrease" data-id="${label.id}">−</button>
                            <input type="number" class="quantity-input" data-id="${label.id}" 
                                value="${label.quantity || 0}" min="0">
                            <button class="btn-increase" data-id="${label.id}">+</button>
                        </div>
                    </td>
                    <td class="col-barcode">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span class="barcode-text">${Utils.escapeHtml(label.barcode)}</span>
                            <button class="action-btn btn-copy" data-barcode="${Utils.escapeHtml(label.barcode)}" title="Копировать">📋</button>
                        </div>
                        <span class="barcode-format-badge">${barcodeFormat}</span>
                    </td>
                    <td class="col-article">${Utils.escapeHtml(label.article)}</td>
                    <td class="col-color">${Utils.escapeHtml(label.color || '')}</td>
                    <td class="col-size">${Utils.escapeHtml(label.size || '')}</td>
                    <td class="col-name">${Utils.escapeHtml(label.name || '')}</td>
                    <td class="col-seller">${Utils.escapeHtml(label.seller || '')}</td>
                    <td class="col-gtin">${Utils.escapeHtml(label.gtin || '')}</td>
                    <td class="col-dates">
                        <div style="font-size: 11px;">
                            <div>Создана: ${Utils.formatDate(label.createdAt)}</div>
                            <div>Изменена: ${Utils.formatDate(label.updatedAt || label.createdAt)}</div>
                        </div>
                    </td>
                    <td class="col-actions">
                        <div class="action-buttons">
                            <button class="action-btn btn-edit" data-id="${label.id}" title="Редактировать">✏️</button>
                            <button class="action-btn btn-duplicate" data-id="${label.id}" title="Дублировать">📑</button>
                            <button class="action-btn delete btn-delete" data-id="${label.id}" title="Удалить">🗑️</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            
            document.querySelectorAll('.label-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const id = e.target.dataset.id;
                    if (e.target.checked) {
                        this.selectedLabels.add(id);
                    } else {
                        this.selectedLabels.delete(id);
                    }
                    this.updateBulkActions();
                });
            });
            
            document.querySelectorAll('.btn-decrease').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    this.changeQuantity(id, -1);
                });
            });
            
            document.querySelectorAll('.btn-increase').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    this.changeQuantity(id, 1);
                });
            });
            
            document.querySelectorAll('.quantity-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const id = e.target.dataset.id;
                    const quantity = parseInt(e.target.value) || 0;
                    this.updateQuantity(id, quantity);
                });
            });
            
            document.querySelectorAll('.btn-copy').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const barcode = e.target.dataset.barcode;
                    Utils.copyToClipboard(barcode);
                });
            });
            
            document.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    this.openEditModal(id);
                });
            });
            
            document.querySelectorAll('.btn-duplicate').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    this.duplicateLabelWithEdit(id);
                });
            });
            
            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    this.deleteLabel(id);
                });
            });
        },
        
        updateBulkActions() {
            const bulkActions = document.getElementById('bulk-actions');
            const count = this.selectedLabels.size;
            
            if (count > 0) {
                bulkActions.classList.remove('hidden');
                document.getElementById('selected-count').textContent = `Выбрано: ${count}`;
            } else {
                bulkActions.classList.add('hidden');
            }
        },
        
        changeQuantity(id, delta) {
            const label = this.labels.find(l => l.id === id);
            if (label) {
                label.quantity = Math.max(0, (label.quantity || 0) + delta);
                label.updatedAt = new Date().toISOString();
                this.saveLabels();
                this.renderLabels();
            }
        },
        
        updateQuantity(id, quantity) {
            const label = this.labels.find(l => l.id === id);
            if (label) {
                label.quantity = quantity;
                label.updatedAt = new Date().toISOString();
                this.saveLabels();
            }
        },
        
        createLabel() {
            const form = document.getElementById('create-label-form');
            const formData = new FormData(form);
            
            const barcode = formData.get('barcode');
            const barcodeFormat = Utils.detectBarcodeFormat(barcode);
            
            const label = {
                id: Utils.generateId(),
                article: formData.get('article'),
                barcode: barcode,
                barcodeFormat: barcodeFormat,
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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.labels.push(label);
            this.saveLabels();
            
            form.reset();
            Utils.showToast('Этикетка создана');
            this.navigate('labels');
        },
        
        openEditModal(id) {
            const label = this.labels.find(l => l.id === id);
            if (!label) return;
            
            const form = document.getElementById('edit-form');
            form.querySelector('input[name="id"]').value = label.id;
            form.querySelector('input[name="article"]').value = label.article;
            form.querySelector('input[name="barcode"]').value = label.barcode;
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
            
            const format = Utils.detectBarcodeFormat(label.barcode);
            const formatDisplay = document.getElementById('edit-barcode-format-display');
            if (formatDisplay) {
                formatDisplay.textContent = format;
            }
            
            document.getElementById('edit-modal').classList.remove('hidden');
        },
        
        saveEdit() {
            const form = document.getElementById('edit-form');
            const formData = new FormData(form);
            const id = formData.get('id');
            
            const labelIndex = this.labels.findIndex(l => l.id === id);
            if (labelIndex === -1) return;
            
            const barcode = formData.get('barcode');
            const barcodeFormat = Utils.detectBarcodeFormat(barcode);
            
            this.labels[labelIndex] = {
                ...this.labels[labelIndex],
                article: formData.get('article'),
                barcode: barcode,
                barcodeFormat: barcodeFormat,
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
            document.getElementById('edit-modal').classList.add('hidden');
            Utils.showToast('Изменения сохранены');
        },
        
        duplicateLabelWithEdit(id) {
            const label = this.labels.find(l => l.id === id);
            if (!label) return;
            
            this.openEditModal(id);
            
            const modalTitle = document.querySelector('#edit-modal .modal-header h2');
            
            if (modalTitle) modalTitle.textContent = 'Дублировать этикетку (внесите изменения при необходимости)';
            
            this.duplicateOriginalId = id;
            
            const form = document.getElementById('edit-form');
            const originalSubmit = form.onsubmit;
            
            form.onsubmit = (e) => {
                e.preventDefault();
                this.duplicateLabelFromEdit();
            };
            
            const originalClose = document.getElementById('modal-close').onclick;
            const closeBtn = document.getElementById('modal-close');
            const cancelBtn = document.getElementById('btn-cancel-edit');
            
            const restoreHandler = () => {
                if (modalTitle) modalTitle.textContent = 'Редактировать этикетку';
                form.onsubmit = originalSubmit;
                closeBtn.onclick = originalClose;
                cancelBtn.onclick = null;
                this.duplicateOriginalId = null;
            };
            
            closeBtn.onclick = restoreHandler;
            cancelBtn.onclick = restoreHandler;
        },
        
        duplicateLabelFromEdit() {
            const form = document.getElementById('edit-form');
            const formData = new FormData(form);
            
            if (!this.duplicateOriginalId) return;
            
            const originalLabel = this.labels.find(l => l.id === this.duplicateOriginalId);
            if (!originalLabel) return;
            
            const barcode = formData.get('barcode');
            const barcodeFormat = Utils.detectBarcodeFormat(barcode);
            
            const newLabel = {
                id: Utils.generateId(),
                article: formData.get('article'),
                barcode: barcode,
                barcodeFormat: barcodeFormat,
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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.labels.push(newLabel);
            this.saveLabels();
            this.renderLabels();
            
            document.getElementById('edit-modal').classList.add('hidden');
            Utils.showToast('Этикетка дублирована');
            
            const modalTitle = document.querySelector('#edit-modal .modal-header h2');
            if (modalTitle) modalTitle.textContent = 'Редактировать этикетку';
        },
        
        duplicateLabel(id) {
            const label = this.labels.find(l => l.id === id);
            if (!label) return;
            
            const newLabel = {
                ...label,
                id: Utils.generateId(),
                quantity: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.labels.push(newLabel);
            this.saveLabels();
            this.renderLabels();
            Utils.showToast('Этикетка дублирована');
        },
        
        duplicateSelected() {
            const newLabels = [];
            this.selectedLabels.forEach(id => {
                const label = this.labels.find(l => l.id === id);
                if (label) {
                    newLabels.push({
                        ...label,
                        id: Utils.generateId(),
                        quantity: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            });
            
            this.labels.push(...newLabels);
            this.saveLabels();
            this.selectedLabels.clear();
            this.renderLabels();
            this.updateBulkActions();
            Utils.showToast(`Дублировано: ${newLabels.length}`);
        },
        
        deleteLabel(id) {
            if (!confirm('Удалить эту этикетку?')) return;
            
            this.labels = this.labels.filter(l => l.id !== id);
            this.selectedLabels.delete(id);
            this.saveLabels();
            this.renderLabels();
            this.updateBulkActions();
            Utils.showToast('Этикетка удалена');
        },
        
        deleteSelected() {
            if (!confirm(`Удалить выбранные этикетки (${this.selectedLabels.size})?`)) return;
            
            this.labels = this.labels.filter(l => !this.selectedLabels.has(l.id));
            this.selectedLabels.clear();
            this.saveLabels();
            this.renderLabels();
            this.updateBulkActions();
            Utils.showToast('Этикетки удалены');
        },
        
        showQuantityImportModal() {
            document.getElementById('quantity-import-modal').classList.remove('hidden');
        },
        
        initQuantityImport() {
            const dropZone = document.getElementById('quantity-drop-zone');
            const fileInput = document.getElementById('quantity-file-input');
            const btnSelectFile = document.getElementById('quantity-btn-select-file');
            const btnCancel = document.getElementById('quantity-btn-cancel');
            const btnConfirm = document.getElementById('quantity-btn-confirm');
            
            btnSelectFile.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleQuantityFile(e.target.files[0]);
                }
            });
            
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    this.handleQuantityFile(e.dataTransfer.files[0]);
                }
            });
            
            btnCancel.addEventListener('click', () => {
                document.getElementById('quantity-import-modal').classList.add('hidden');
                this.importQuantityData = null;
            });
            
            btnConfirm.addEventListener('click', () => {
                this.applyQuantityImport();
            });
        },
        
        handleQuantityFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                    
                    const hasArticle = jsonData.some(row => 
                        row.hasOwnProperty('Артикул') || row.hasOwnProperty('article') || row.hasOwnProperty('Article')
                    );
                    const hasQuantity = jsonData.some(row => 
                        row.hasOwnProperty('Количество') || row.hasOwnProperty('quantity') || row.hasOwnProperty('Quantity')
                    );
                    
                    if (!hasArticle || !hasQuantity) {
                        Utils.showToast('Файл должен содержать колонки "Артикул" и "Количество"');
                        return;
                    }
                    
                    this.importQuantityData = jsonData;
                    this.showQuantityImportPreview(jsonData);
                } catch (error) {
                    Utils.showToast('Ошибка чтения файла: ' + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        },
        
        showQuantityImportPreview(data) {
            document.getElementById('quantity-drop-zone').classList.add('hidden');
            document.getElementById('quantity-import-preview').classList.remove('hidden');
            
            const thead = document.getElementById('quantity-preview-thead');
            const tbody = document.getElementById('quantity-preview-tbody');
            
            if (data.length === 0) return;
            
            const headers = Object.keys(data[0]);
            thead.innerHTML = '<tr>' + headers.map(h => `<th>${Utils.escapeHtml(h)}</th>`).join('') + '</tr>';
            
            tbody.innerHTML = data.slice(0, 10).map(row => {
                return '<tr>' + headers.map(h => `<td>${Utils.escapeHtml(String(row[h] || ''))}</td>`).join('') + '</tr>';
            }).join('');
            
            const count = data.length;
            document.getElementById('quantity-import-count').textContent = `Найдено записей: ${count}`;
        },
        
        applyQuantityImport() {
            if (!this.importQuantityData || this.importQuantityData.length === 0) {
                Utils.showToast('Нет данных для импорта');
                return;
            }
            
            let updatedCount = 0;
            
            this.importQuantityData.forEach(row => {
                const article = row['Артикул'] || row['article'] || row['Article'];
                const quantity = parseInt(row['Количество'] || row['quantity'] || row['Quantity'] || 0);
                
                if (article) {
                    const label = this.labels.find(l => l.article === article);
                    if (label) {
                        label.quantity = quantity;
                        label.updatedAt = new Date().toISOString();
                        updatedCount++;
                    }
                }
            });
            
            this.saveLabels();
            this.renderLabels();
            
            document.getElementById('quantity-import-modal').classList.add('hidden');
            this.importQuantityData = null;
            
            Utils.showToast(`Обновлено количество у ${updatedCount} этикеток`);
        },
        
        updatePrintPreview() {
            const preview = document.getElementById('label-preview');
            const format = document.getElementById('print-barcode-format').value;
            const textSize = document.getElementById('print-text-size').value;
            const centerText = document.getElementById('print-center-text').checked;
            const barcodeOnly = document.getElementById('print-barcode-only').checked;
            const noBarcode = document.getElementById('print-no-barcode').checked;
            const printType = document.getElementById('print-type').value;
            
            const firstSelectedId = this.labelsForPrint && this.labelsForPrint.length > 0 
                ? this.labelsForPrint[0] 
                : (this.selectedLabels.size > 0 ? Array.from(this.selectedLabels)[0] : null);
            const label = firstSelectedId ? this.labels.find(l => l.id === firstSelectedId) : this.labels[0];
            
            if (!label) {
                preview.innerHTML = '<p>Нет данных для предпросмотра</p>';
                return;
            }
            
            let html = '<div class="preview-label" style="';
            html += `font-size: ${textSize}pt; `;
            html += centerText ? 'text-align: center;' : 'text-align: left;';
            html += `border: 1px solid #ddd; padding: 10px; max-width: 300px;`;
            html += '">';
            
            if (!barcodeOnly && !noBarcode) {
                html += `<div class="preview-barcode" id="preview-barcode-svg"></div>`;
                html += `<div class="preview-barcode-text">${Utils.escapeHtml(label.barcode)}</div>`;
            }
            
            if (!barcodeOnly) {
                html += `<div class="preview-article"><strong>Артикул:</strong> ${Utils.escapeHtml(label.article)}</div>`;
                
                if (label.name) {
                    html += `<div class="preview-name">${Utils.escapeHtml(label.name)}</div>`;
                }
                
                const colorSizeRow = document.getElementById('print-color-size-row').checked;
                if (colorSizeRow) {
                    if (label.color || label.size) {
                        html += `<div class="preview-color-size">`;
                        if (label.color) html += `Цвет: ${Utils.escapeHtml(label.color)}`;
                        if (label.color && label.size) html += ' | ';
                        if (label.size) html += `Размер: ${Utils.escapeHtml(label.size)}`;
                        html += `</div>`;
                    }
                } else {
                    if (label.color) html += `<div class="preview-color">Цвет: ${Utils.escapeHtml(label.color)}</div>`;
                    if (label.size) html += `<div class="preview-size">Размер: ${Utils.escapeHtml(label.size)}</div>`;
                }
                
                if (label.seller) html += `<div class="preview-seller">${Utils.escapeHtml(label.seller)}</div>`;
                if (label.gtin) html += `<div class="preview-gtin">GTIN: ${Utils.escapeHtml(label.gtin)}</div>`;
                if (label.brand) html += `<div class="preview-brand"><strong>Бренд:</strong> ${Utils.escapeHtml(label.brand)}</div>`;
            }
            
            html += '</div>';
            
            if (printType === 'a4') {
                html += '<div style="margin-top: 10px; font-size: 12px; color: #666;">📄 Формат: A4 (несколько этикеток на листе)</div>';
            } else {
                html += '<div style="margin-top: 10px; font-size: 12px; color: #666;">🏷️ Формат: Термоэтикетка (1 этикетка = 1 страница)</div>';
            }
            
            preview.innerHTML = html;
            
            if (!barcodeOnly && !noBarcode) {
                setTimeout(() => {
                    try {
                        JsBarcode("#preview-barcode-svg", label.barcode, {
                            format: format,
                            width: 1.5,
                            height: 40,
                            displayValue: false,
                            margin: 0
                        });
                    } catch (e) {
                        console.error('Ошибка генерации штрихкода:', e);
                    }
                }, 100);
            }
        },
        
        async printLabels() {
            const printType = document.getElementById('print-type').value;
            const labelSize = document.getElementById('print-label-size').value;
            const barcodeFormat = document.getElementById('print-barcode-format').value;
            const textSize = document.getElementById('print-text-size').value;
            const centerText = document.getElementById('print-center-text').checked;
            const barcodeOnly = document.getElementById('print-barcode-only').checked;
            const noBarcode = document.getElementById('print-no-barcode').checked;
            const colorSizeRow = document.getElementById('print-color-size-row').checked;
            
            let labelsToPrint = [];
            if (this.labelsForPrint && this.labelsForPrint.length > 0) {
                labelsToPrint = this.labels.filter(l => this.labelsForPrint.includes(l.id));
            } else if (this.selectedLabels.size > 0) {
                labelsToPrint = this.labels.filter(l => this.selectedLabels.has(l.id));
            } else {
                labelsToPrint = this.labels;
            }
            
            if (labelsToPrint.length === 0) {
                Utils.showToast('Нет этикеток для печати');
                return;
            }
            
            const expandedLabels = [];
            labelsToPrint.forEach(label => {
                const qty = label.quantity || 1;
                for (let i = 0; i < qty; i++) {
                    expandedLabels.push(label);
                }
            });
            
            if (expandedLabels.length === 0) {
                Utils.showToast('Нет этикеток для печати (установите количество > 0)');
                return;
            }
            
            const settings = {
                printType,
                labelSize,
                barcodeFormat,
                textSize,
                centerText,
                barcodeOnly,
                noBarcode,
                colorSizeRow
            };
            
            Utils.showToast('Генерация PDF...');
            await PDFGenerator.generateLabelsPDF(expandedLabels, settings);
        },
        
        initImport() {
            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('file-input');
            const btnSelectFile = document.getElementById('btn-select-file');
            const btnCancelImport = document.getElementById('btn-cancel-import');
            const btnConfirmImport = document.getElementById('btn-confirm-import');
            const btnDownloadTemplate = document.getElementById('btn-download-template');
            
            btnSelectFile.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFile(e.target.files[0]);
                }
            });
            
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFile(e.dataTransfer.files[0]);
                }
            });
            
            btnCancelImport.addEventListener('click', () => {
                document.getElementById('import-preview').classList.add('hidden');
                document.getElementById('drop-zone').classList.remove('hidden');
                fileInput.value = '';
            });
            
            btnConfirmImport.addEventListener('click', () => {
                this.confirmImport();
            });
            
            btnDownloadTemplate.addEventListener('click', () => {
                this.downloadTemplate();
            });
        },
        
        handleFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                    
                    this.importData = jsonData;
                    this.showImportPreview(jsonData);
                } catch (error) {
                    Utils.showToast('Ошибка чтения файла: ' + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        },
        
        showImportPreview(data) {
            document.getElementById('drop-zone').classList.add('hidden');
            document.getElementById('import-preview').classList.remove('hidden');
            
            const thead = document.getElementById('preview-thead');
            const tbody = document.getElementById('preview-tbody');
            
            if (data.length === 0) return;
            
            const headers = Object.keys(data[0]);
            thead.innerHTML = '<tr>' + headers.map(h => `<th>${Utils.escapeHtml(h)}</th>`).join('') + '</tr>';
            
            tbody.innerHTML = data.slice(0, 10).map(row => {
                return '<tr>' + headers.map(h => `<td>${Utils.escapeHtml(String(row[h] || ''))}</td>`).join('') + '</tr>';
            }).join('');
        },
        
        confirmImport() {
            if (!this.importData || this.importData.length === 0) return;
            
            const newLabels = this.importData.map(row => {
                const barcode = String(row['Штрихкод'] || row['barcode'] || row['Баркод'] || '');
                const barcodeFormat = Utils.detectBarcodeFormat(barcode);
                
                return {
                    id: Utils.generateId(),
                    article: String(row['Артикул'] || row['article'] || ''),
                    barcode: barcode,
                    barcodeFormat: barcodeFormat,
                    color: String(row['Цвет'] || row['color'] || ''),
                    size: String(row['Размер'] || row['size'] || ''),
                    name: String(row['Название товара'] || row['name'] || ''),
                    seller: String(row['Наименование продавца'] || row['Наименование поставщика'] || row['seller'] || row['Продавец'] || row['Поставщик'] || ''),
                    gtin: String(row['GTIN'] || row['gtin'] || ''),
                    brand: String(row['Бренд'] || row['brand'] || ''),
                    expiry: String(row['Срок годности'] || row['expiry'] || ''),
                    country: String(row['Страна производства'] || row['country'] || ''),
                    composition: String(row['Состав'] || row['composition'] || ''),
                    manufacturer: String(row['Производитель'] || row['manufacturer'] || ''),
                    quantity: parseInt(row['Количество'] || row['quantity'] || 0),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }).filter(label => label.article && label.barcode);
            
            this.labels.push(...newLabels);
            this.saveLabels();
            this.renderLabels();
            
            Utils.showToast(`Импортировано: ${newLabels.length} этикеток`);
            
            document.getElementById('import-preview').classList.add('hidden');
            document.getElementById('drop-zone').classList.remove('hidden');
            document.getElementById('file-input').value = '';
            this.importData = null;
            
            this.navigate('labels');
        },
        
        downloadTemplate() {
            const template = [{
                'Артикул': 'ART001',
                'Штрихкод': '4601234567890',
                'Цвет': 'белый',
                'Размер': 'XL',
                'Название товара': 'Футболка мужская',
                'Наименование продавца': 'ООО "Пример"',
                'GTIN': '04601234567890',
                'Количество': 10,
                'Бренд': 'Brand',
                'Срок годности': '',
                'Страна производства': 'Россия',
                'Состав': '100% хлопок',
                'Производитель': 'ООО "Производитель"'
            }];
            
            const ws = XLSX.utils.json_to_sheet(template);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Этикетки');
            XLSX.writeFile(wb, 'template_labels.xlsx');
        },
        
        exportToExcel() {
            if (this.labels.length === 0) {
                Utils.showToast('Нет данных для экспорта');
                return;
            }
            
            const exportData = this.labels.map(label => ({
                'Артикул': label.article,
                'Штрихкод': label.barcode,
                'Цвет': label.color || '',
                'Размер': label.size || '',
                'Название товара': label.name || '',
                'Наименование продавца': label.seller || '',
                'GTIN': label.gtin || '',
                'Количество': label.quantity || 0,
                'Бренд': label.brand || '',
                'Срок годности': label.expiry || '',
                'Страна производства': label.country || '',
                'Состав': label.composition || '',
                'Производитель': label.manufacturer || '',
                'Создана': label.createdAt,
                'Изменена': label.updatedAt || label.createdAt
            }));
            
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Этикетки');
            XLSX.writeFile(wb, `labels_export_${new Date().toISOString().split('T')[0]}.xlsx`);
            
            Utils.showToast('Экспорт завершен');
        }
    };

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
})();
