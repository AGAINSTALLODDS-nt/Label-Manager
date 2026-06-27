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
        }
    };

    // ==================== УТИЛИТЫ ====================
    const Utils = {
        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        },
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
            div.textContent = text;
            return div.innerHTML;
        },
        copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Скопировано');
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.showToast('Скопировано');
            });
        },
        showToast(message) {
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#111827;color:white;padding:12px 24px;border-radius:8px;z-index:10000;';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        },
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
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
            document.getElementById('btn-logout').addEventListener('click', () => this.logout());
        },
        login() {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            const users = Storage.getUsers();
            const user = users.find(u => u.username === username && u.password === password);
            if (user) {
                Storage.setCurrentUser(user);
                App.showMainApp();
            } else {
                alert('Неверный логин или пароль');
            }
        },
        register() {
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value;
            const passwordConfirm = document.getElementById('reg-password-confirm').value;
            if (password !== passwordConfirm) {
                alert('Пароли не совпадают');
                return;
            }
            const users = Storage.getUsers();
            if (users.find(u => u.username === username)) {
                alert('Пользователь уже существует');
                return;
            }
            const newUser = { id: Utils.generateId(), username, password, createdAt: new Date().toISOString() };
            users.push(newUser);
            Storage.saveUsers(users);
            Storage.setCurrentUser(newUser);
            App.showMainApp();
        },
        logout() {
            localStorage.removeItem('lm_current_user');
            location.reload();
        }
    };

    // ==================== ГЕНЕРАЦИЯ PDF ====================
    const PDFGenerator = {
        async generateLabelsPDF(labels, settings) {
            const { jsPDF } = window.jspdf;
            const printType = settings.printType || 'thermal';
            const labelSize = settings.labelSize || '58x38.6';
            const [labelWidth, labelHeight] = labelSize.split('x').map(Number);
            
            // Создаем PDF
            const pdf = new jsPDF({
                orientation: labelWidth > labelHeight ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [labelWidth, labelHeight],
                compress: true
            });

            for (let i = 0; i < labels.length; i++) {
                if (i > 0) {
                    pdf.addPage([labelWidth, labelHeight]);
                }
                this.drawSingleLabel(pdf, labels[i], settings, labelWidth, labelHeight);
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            pdf.save(`labels_${timestamp}.pdf`);
        },

        drawSingleLabel(pdf, label, settings, width, height) {
            const fontSize = parseInt(settings.textSize) || 8;
            const centerText = settings.centerText !== false;
            const barcodeOnly = settings.barcodeOnly || false;
            const noBarcode = settings.noBarcode || false;
            const colorSizeRow = settings.colorSizeRow || false;
            const align = centerText ? 'center' : 'left';
            
            pdf.setFontSize(fontSize);
            pdf.setTextColor(0, 0, 0);
            
            let currentY = 2;
            const lineHeight = fontSize * 0.35;
            const textX = centerText ? width / 2 : 2;
            const maxWidth = width - 4;

            // Штрихкод
            if (!barcodeOnly && !noBarcode) {
                try {
                    const canvas = document.createElement('canvas');
                    const format = settings.barcodeFormat === 'auto' ? Utils.detectBarcodeFormat(label.barcode) : settings.barcodeFormat;
                    JsBarcode(canvas, label.barcode, {
                        format: format === 'EAN13' ? 'EAN13' : 'CODE128',
                        width: 1.2,
                        height: 15,
                        displayValue: false,
                        margin: 0
                    });
                    const imgData = canvas.toDataURL('image/png');
                    const barcodeWidth = Math.min(maxWidth, width - 4);
                    const barcodeX = centerText ? (width - barcodeWidth) / 2 : 2;
                    pdf.addImage(imgData, 'PNG', barcodeX, currentY, barcodeWidth, 15);
                    currentY += 16;
                    
                    // Текст штрихкода
                    pdf.setFontSize(6);
                    pdf.text(label.barcode, textX, currentY, { align });
                    currentY += 2;
                    pdf.setFontSize(fontSize);
                } catch (e) {
                    console.error('Barcode error:', e);
                }
            }

            if (!barcodeOnly) {
                // Артикул
                pdf.setFont(undefined, 'bold');
                const articleText = `Артикул: ${label.article}`;
                const wrappedArticle = this.wrapText(pdf, articleText, maxWidth);
                wrappedArticle.forEach(line => {
                    pdf.text(line, textX, currentY, { align });
                    currentY += lineHeight;
                });
                pdf.setFont(undefined, 'normal');

                // Название товара
                if (label.name) {
                    const wrappedName = this.wrapText(pdf, label.name, maxWidth);
                    wrappedName.forEach(line => {
                        pdf.text(line, textX, currentY, { align });
                        currentY += lineHeight;
                    });
                }

                // Цвет и размер
                if (colorSizeRow) {
                    let colorSizeText = '';
                    if (label.color) colorSizeText += `Цвет: ${label.color}`;
                    if (label.color && label.size) colorSizeText += ' / ';
                    if (label.size) colorSizeText += `Разм.: ${label.size}`;
                    if (colorSizeText) {
                        const wrapped = this.wrapText(pdf, colorSizeText, maxWidth);
                        wrapped.forEach(line => {
                            pdf.text(line, textX, currentY, { align });
                            currentY += lineHeight;
                        });
                    }
                } else {
                    if (label.color) {
                        pdf.text(`Цвет: ${label.color}`, textX, currentY, { align });
                        currentY += lineHeight;
                    }
                    if (label.size) {
                        pdf.text(`Размер: ${label.size}`, textX, currentY, { align });
                        currentY += lineHeight;
                    }
                }

                // Продавец
                if (label.seller) {
                    const wrappedSeller = this.wrapText(pdf, label.seller, maxWidth);
                    wrappedSeller.forEach(line => {
                        pdf.text(line, textX, currentY, { align });
                        currentY += lineHeight;
                    });
                }

                // Бренд
                if (label.brand) {
                    pdf.setFont(undefined, 'bold');
                    pdf.text(`Бренд: ${label.brand}`, textX, currentY, { align });
                    pdf.setFont(undefined, 'normal');
                    currentY += lineHeight;
                }

                // Срок годности
                if (label.expiry) {
                    pdf.text(`Срок годности: ${label.expiry}`, textX, currentY, { align });
                }
            }
        },

        wrapText(pdf, text, maxWidth) {
            if (!text) return [];
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            const fontSize = pdf.internal.getFontSize();
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
            if (currentLine) lines.push(currentLine);
            return lines;
        }
    };

    // ==================== ПРИЛОЖЕНИЕ ====================
    const App = {
        currentUser: null,
        labels: [],
        selectedLabels: new Set(),
        currentPage: 'labels',
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
                    this.navigate(item.dataset.page);
                });
            });

            document.getElementById('btn-add-label').addEventListener('click', () => this.navigate('create'));
            document.getElementById('btn-cancel-create').addEventListener('click', () => this.navigate('labels'));
            
            document.getElementById('create-label-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.createLabel();
            });

            document.getElementById('btn-generate-barcode').addEventListener('click', () => {
                const input = document.querySelector('#create-label-form input[name="barcode"]');
                input.value = Math.floor(Math.random() * 1000000000000).toString().padStart(13, '0');
            });

            document.getElementById('btn-import-excel').addEventListener('click', () => this.navigate('import'));
            document.getElementById('btn-export-excel').addEventListener('click', () => this.exportToExcel());
            
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
                document.querySelectorAll('.label-checkbox').forEach(cb => {
                    cb.checked = e.target.checked;
                    if (e.target.checked) this.selectedLabels.add(cb.dataset.id);
                    else this.selectedLabels.delete(cb.dataset.id);
                });
                this.updateBulkActions();
            });

            document.getElementById('btn-bulk-duplicate').addEventListener('click', () => this.duplicateSelected());
            document.getElementById('btn-bulk-delete').addEventListener('click', () => this.deleteSelected());
            document.getElementById('btn-bulk-set-quantity').addEventListener('click', () => this.showQuantityImportModal());
            document.getElementById('btn-bulk-print').addEventListener('click', () => this.navigateToPrint());

            document.getElementById('modal-close').addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));
            document.getElementById('btn-cancel-edit').addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));
            document.getElementById('edit-form').addEventListener('submit', (e) => { e.preventDefault(); this.saveEdit(); });

            document.getElementById('btn-back-to-labels').addEventListener('click', () => this.navigate('labels'));
            document.getElementById('btn-print').addEventListener('click', () => this.printLabels());

            ['print-barcode-format', 'print-text-size', 'print-center-text', 'print-barcode-only', 
             'print-no-barcode', 'print-color-size-row', 'print-label-size', 'print-type'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('change', () => this.updatePrintPreview());
            });

            this.initImport();
            this.initQuantityImport();
        },

        navigate(page) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.getElementById(`page-${page}`).classList.add('active');
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
            
            let filtered = this.labels;
            if (this.currentFilter) {
                filtered = this.labels.filter(l => Object.values(l).some(v => String(v).toLowerCase().includes(this.currentFilter)));
            }

            filtered.forEach(label => {
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
                    <td style="font-size:11px"><div>Создана: ${Utils.formatDate(label.createdAt)}</div><div>Изменена: ${Utils.formatDate(label.updatedAt || label.createdAt)}</div></td>
                    <td><div class="action-buttons">
                        <button class="action-btn btn-edit" data-id="${label.id}">✏️</button>
                        <button class="action-btn btn-duplicate" data-id="${label.id}">📑</button>
                        <button class="action-btn delete btn-delete" data-id="${label.id}">🗑️</button>
                    </div></td>
                `;
                tbody.appendChild(tr);
            });

            // Event listeners
            document.querySelectorAll('.label-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    if (e.target.checked) this.selectedLabels.add(e.target.dataset.id);
                    else this.selectedLabels.delete(e.target.dataset.id);
                    this.updateBulkActions();
                });
            });

            document.querySelectorAll('.btn-decrease').forEach(btn => {
                btn.addEventListener('click', (e) => this.changeQuantity(e.target.dataset.id, -1));
            });
            document.querySelectorAll('.btn-increase').forEach(btn => {
                btn.addEventListener('click', (e) => this.changeQuantity(e.target.dataset.id, 1));
            });
            document.querySelectorAll('.quantity-input').forEach(input => {
                input.addEventListener('change', (e) => this.updateQuantity(e.target.dataset.id, parseInt(e.target.value) || 0));
            });
            document.querySelectorAll('.btn-copy').forEach(btn => {
                btn.addEventListener('click', (e) => Utils.copyToClipboard(e.target.dataset.barcode));
            });
            document.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => this.openEditModal(e.target.dataset.id));
            });
            document.querySelectorAll('.btn-duplicate').forEach(btn => {
                btn.addEventListener('click', (e) => this.duplicateLabelWithEdit(e.target.dataset.id));
            });
            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => this.deleteLabel(e.target.dataset.id));
            });
        },

        updateBulkActions() {
            const bulk = document.getElementById('bulk-actions');
            const count = this.selectedLabels.size;
            if (count > 0) {
                bulk.classList.remove('hidden');
                document.getElementById('selected-count').textContent = `Выбрано: ${count}`;
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
            const label = {
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
            document.getElementById('edit-modal').classList.remove('hidden');
        },

        saveEdit() {
            const form = document.getElementById('edit-form');
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
            document.getElementById('edit-modal').classList.add('hidden');
            Utils.showToast('Сохранено');
        },

        duplicateLabelWithEdit(id) {
            this.openEditModal(id);
            document.querySelector('#edit-modal .modal-header h2').textContent = 'Дублировать этикетку';
            this.duplicateOriginalId = id;
            const form = document.getElementById('edit-form');
            const origSubmit = form.onsubmit;
            form.onsubmit = (e) => { e.preventDefault(); this.duplicateFromEdit(); };
            const restore = () => {
                document.querySelector('#edit-modal .modal-header h2').textContent = 'Редактировать этикетку';
                form.onsubmit = origSubmit;
                this.duplicateOriginalId = null;
            };
            document.getElementById('modal-close').onclick = restore;
            document.getElementById('btn-cancel-edit').onclick = restore;
        },

        duplicateFromEdit() {
            if (!this.duplicateOriginalId) return;
            const orig = this.labels.find(l => l.id === this.duplicateOriginalId);
            if (!orig) return;
            const form = document.getElementById('edit-form');
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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.labels.push(newLabel);
            this.saveLabels();
            this.renderLabels();
            document.getElementById('edit-modal').classList.add('hidden');
            Utils.showToast('Дублировано');
        },

        duplicateSelected() {
            const newLabels = [];
            this.selectedLabels.forEach(id => {
                const label = this.labels.find(l => l.id === id);
                if (label) {
                    newLabels.push({ ...label, id: Utils.generateId(), quantity: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
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
            if (!confirm('Удалить?')) return;
            this.labels = this.labels.filter(l => l.id !== id);
            this.selectedLabels.delete(id);
            this.saveLabels();
            this.renderLabels();
            this.updateBulkActions();
            Utils.showToast('Удалено');
        },

        deleteSelected() {
            if (!confirm(`Удалить ${this.selectedLabels.size} этикеток?`)) return;
            this.labels = this.labels.filter(l => !this.selectedLabels.has(l.id));
            this.selectedLabels.clear();
            this.saveLabels();
            this.renderLabels();
            this.updateBulkActions();
            Utils.showToast('Удалено');
        },

        showQuantityImportModal() {
            document.getElementById('quantity-import-modal').classList.remove('hidden');
        },

        initQuantityImport() {
            const dropZone = document.getElementById('quantity-drop-zone');
            const fileInput = document.getElementById('quantity-file-input');
            document.getElementById('quantity-btn-select-file').addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => { if (e.target.files[0]) this.handleQuantityFile(e.target.files[0]); });
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files[0]) this.handleQuantityFile(e.dataTransfer.files[0]);
            });
            document.getElementById('quantity-btn-cancel').addEventListener('click', () => {
                document.getElementById('quantity-import-modal').classList.add('hidden');
                this.importQuantityData = null;
            });
            document.getElementById('quantity-btn-confirm').addEventListener('click', () => this.applyQuantityImport());
        },

        handleQuantityFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    this.importQuantityData = jsonData;
                    this.showQuantityImportPreview(jsonData);
                } catch (err) {
                    Utils.showToast('Ошибка: ' + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
        },

        showQuantityImportPreview(data) {
            document.getElementById('quantity-drop-zone').classList.add('hidden');
            document.getElementById('quantity-import-preview').classList.remove('hidden');
            document.getElementById('quantity-import-count').textContent = `Найдено: ${data.length}`;
            const thead = document.getElementById('quantity-preview-thead');
            const tbody = document.getElementById('quantity-preview-tbody');
            if (data.length === 0) return;
            const headers = Object.keys(data[0]);
            thead.innerHTML = '<tr>' + headers.map(h => `<th>${Utils.escapeHtml(h)}</th>`).join('') + '</tr>';
            tbody.innerHTML = data.slice(0, 10).map(row => '<tr>' + headers.map(h => `<td>${Utils.escapeHtml(String(row[h] || ''))}</td>`).join('') + '</tr>').join('');
        },

        applyQuantityImport() {
            if (!this.importQuantityData) return;
            let count = 0;
            this.importQuantityData.forEach(row => {
                const article = row['Артикул'] || row['article'];
                const quantity = parseInt(row['Количество'] || row['quantity'] || 0);
                const label = this.labels.find(l => l.article === article);
                if (label) {
                    label.quantity = quantity;
                    label.updatedAt = new Date().toISOString();
                    count++;
                }
            });
            this.saveLabels();
            this.renderLabels();
            document.getElementById('quantity-import-modal').classList.add('hidden');
            Utils.showToast(`Обновлено: ${count}`);
        },

        updatePrintPreview() {
            // Simplified preview
            const preview = document.getElementById('label-preview');
            preview.innerHTML = '<div style="text-align:center;padding:20px">Предпросмотр этикетки</div>';
        },

        async printLabels() {
            const settings = {
                printType: document.getElementById('print-type').value,
                labelSize: document.getElementById('print-label-size').value,
                barcodeFormat: document.getElementById('print-barcode-format').value,
                textSize: document.getElementById('print-text-size').value,
                centerText: document.getElementById('print-center-text').checked,
                barcodeOnly: document.getElementById('print-barcode-only').checked,
                noBarcode: document.getElementById('print-no-barcode').checked,
                colorSizeRow: document.getElementById('print-color-size-row').checked
            };

            let labelsToPrint = [];
            if (this.labelsForPrint && this.labelsForPrint.length > 0) {
                labelsToPrint = this.labels.filter(l => this.labelsForPrint.includes(l.id));
            } else if (this.selectedLabels.size > 0) {
                labelsToPrint = this.labels.filter(l => this.selectedLabels.has(l.id));
            } else {
                labelsToPrint = this.labels;
            }

            if (labelsToPrint.length === 0) {
                Utils.showToast('Нет этикеток');
                return;
            }

            // Expand by quantity
            const expanded = [];
            labelsToPrint.forEach(label => {
                const qty = label.quantity || 1;
                for (let i = 0; i < qty; i++) expanded.push({ ...label });
            });

            if (expanded.length === 0) {
                Utils.showToast('Установите количество > 0');
                return;
            }

            Utils.showToast('Генерация PDF...');
            await PDFGenerator.generateLabelsPDF(expanded, settings);
        },

        initImport() {
            const dropZone = document.getElementById('drop-zone');
            const fileInput = document.getElementById('file-input');
            document.getElementById('btn-select-file').addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => { if (e.target.files[0]) this.handleFile(e.target.files[0]); });
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]);
            });
            document.getElementById('btn-cancel-import').addEventListener('click', () => {
                document.getElementById('import-preview').classList.add('hidden');
                document.getElementById('drop-zone').classList.remove('hidden');
                fileInput.value = '';
            });
            document.getElementById('btn-confirm-import').addEventListener('click', () => this.confirmImport());
            document.getElementById('btn-download-template').addEventListener('click', () => this.downloadTemplate());
        },

        handleFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    this.importData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                    this.showImportPreview(this.importData);
                } catch (err) {
                    Utils.showToast('Ошибка: ' + err.message);
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
            tbody.innerHTML = data.slice(0, 10).map(row => '<tr>' + headers.map(h => `<td>${Utils.escapeHtml(String(row[h] || ''))}</td>`).join('') + '</tr>').join('');
        },

        confirmImport() {
            if (!this.importData) return;
            const newLabels = this.importData.map(row => ({
                id: Utils.generateId(),
                article: String(row['Артикул'] || row['article'] || ''),
                barcode: String(row['Штрихкод'] || row['barcode'] || ''),
                color: String(row['Цвет'] || row['color'] || ''),
                size: String(row['Размер'] || row['size'] || ''),
                name: String(row['Название товара'] || row['name'] || ''),
                seller: String(row['Наименование продавца'] || row['Наименование поставщика'] || row['seller'] || ''),
                gtin: String(row['GTIN'] || row['gtin'] || ''),
                brand: String(row['Бренд'] || row['brand'] || ''),
                expiry: String(row['Срок годности'] || row['expiry'] || ''),
                country: String(row['Страна производства'] || row['country'] || ''),
                composition: String(row['Состав'] || row['composition'] || ''),
                manufacturer: String(row['Производитель'] || row['manufacturer'] || ''),
                quantity: parseInt(row['Количество'] || row['quantity'] || 0),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })).filter(l => l.article && l.barcode);

            this.labels.push(...newLabels);
            this.saveLabels();
            this.renderLabels();
            Utils.showToast(`Импортировано: ${newLabels.length}`);
            document.getElementById('import-preview').classList.add('hidden');
            document.getElementById('drop-zone').classList.remove('hidden');
            document.getElementById('file-input').value = '';
            this.navigate('labels');
        },

        downloadTemplate() {
            const template = [{
                'Артикул': 'ART001', 'Штрихкод': '4601234567890', 'Цвет': 'белый', 'Размер': 'XL',
                'Название товара': 'Футболка', 'Наименование продавца': 'ООО Пример', 'GTIN': '',
                'Количество': 10, 'Бренд': 'Brand', 'Срок годности': '', 'Страна производства': 'Россия'
            }];
            const ws = XLSX.utils.json_to_sheet(template);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Этикетки');
            XLSX.writeFile(wb, 'template.xlsx');
        },

        exportToExcel() {
            if (this.labels.length === 0) {
                Utils.showToast('Нет данных');
                return;
            }
            const data = this.labels.map(l => ({
                'Артикул': l.article, 'Штрихкод': l.barcode, 'Цвет': l.color || '', 'Размер': l.size || '',
                'Название товара': l.name || '', 'Наименование продавца': l.seller || '', 'GTIN': l.gtin || '',
                'Количество': l.quantity || 0, 'Бренд': l.brand || '', 'Срок годности': l.expiry || '',
                'Создана': l.createdAt, 'Изменена': l.updatedAt || l.createdAt
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Этикетки');
            XLSX.writeFile(wb, `labels_${new Date().toISOString().split('T')[0]}.xlsx`);
            Utils.showToast('Экспорт завершен');
        }
    };

    document.addEventListener('DOMContentLoaded', () => App.init());
})();

