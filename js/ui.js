class UI {
    constructor() {
        this.currentLang = localStorage.getItem('lang') || 'en';
        this.translations = {};
        this.editor = null;
        this.originalContent = '';
        this.currentFilename = '';
        this.isAuthenticated = localStorage.getItem('hasSession') === 'true';
        this.nfqws2 = false;
        
        this.historyManager = new HistoryManager();
        this.keyboardShortcuts = new KeyboardShortcuts(this);
        this.dragDrop = new DragDrop(this);
        this.domChecker = new DomChecker(this);
        
        this.init();
    }

    async init() {
        await this.loadTranslations();
        this.initCodeMirror();
        this.initUIComponents();
        this.applyTranslations();
        
        if (this.isAuthenticated) {
            await this.checkAuth();
        } else {
            this.showLoginForm();
        }
        
        if (this.editor) {
            this.historyManager.init(this.editor);
        }
    }

    async loadTranslations() {
        try {
            const response = await fetch(`lang/${this.currentLang}.json`);
            this.translations = await response.json();
        } catch (error) {
            console.error('Error loading translations:', error);
            this.translations = {
                save: "Save",
                restart: "Restart",
                reload: "Reload",
                stop: "Stop",
                start: "Start",
                update: "Update",
                login: "Login",
                logout: "Logout",
                confirmSave: "Save changes?",
                confirmRestart: "Restart service?",
                confirmReload: "Reload service?",
                confirmStop: "Stop service?",
                confirmStart: "Start service?",
                confirmUpdate: "Update nfqws-keenetic?",
                confirmClose: "File has unsaved changes. Close anyway?",
                confirmDelete: "Delete this file?",
                confirmClear: "Clear log file?",
                yes: "Yes",
                no: "No",
                close: "Close",
                cancel: "Cancel",
                confirm: "Confirm",
                fileSaved: "File saved successfully",
                fileDeleted: "File deleted successfully",
                logCleared: "Log cleared successfully",
                serviceRestarted: "Service restarted successfully",
                serviceReloaded: "Service reloaded successfully",
                serviceStopped: "Service stopped successfully",
                serviceStarted: "Service started successfully",
                upgradeCompleted: "Upgrade completed",
                error: "Error",
                success: "Success",
                processing: "Processing...",
                statusRunning: "Running",
                statusStopped: "Stopped",
                themeLight: "Switch to light theme",
                themeDark: "Switch to dark theme",
                language: "Language",
                placeholder: "# Configuration file\n# Edit and save...",
                noFileSelected: "No file selected",
                fullscreen: "Toggle fullscreen",
                exitFullscreen: "Exit fullscreen",
                newFile: "New File",
                createFile: "Create New File",
                filenameLabel: "File name (without extension)",
                filenameHint: "Enter file name without extension",
                extensionLabel: "File type",
                listFile: ".list file",
                configFile: ".conf file",
                fileCreated: "File created successfully",
                fileCreationFailed: "Failed to create file",
                fileExists: "File already exists",
                protectedFile: "This file is protected and cannot be deleted",
                checkAvailability: "Check Availability",
                checkingDomains: "Checking domain availability...",
                domainCheckComplete: "Domain check completed",
                domainCheckCompleted: "Domain check completed: {accessible} accessible, {blocked} blocked",
                totalDomains: "Total domains:",
                accessibleDomains: "Accessible:",
                blockedDomains: "Blocked:",
                progress: "Progress:",
                domainAccessible: "✓ Accessible",
                domainBlocked: "✗ Blocked",
                noDomainsFound: "No domains found in the file",
                selectListFile: "Select a .list file to check domains",
                pending: "Waiting...",
                checkingDomain: "Checking...",
                invalidFilename: "Invalid file name. Use only letters, numbers, dots, hyphens and underscores",
                enterCredentials: "Please enter login and password",
                loginFailed: "Login failed",
                loginError: "Login error",
                executing: "Executing",
                authCheckError: "Auth check error",
                failedToLoadFile: "Failed to load file",
                failedToSaveFile: "Failed to save file",
                failedToDeleteFile: "Failed to delete file",
                clearLog: "Clear log",
                deleteFile: "Delete file",
                editFile: "Edit file",
                retryCheck: "Retry Check"
            };
        }
    }

    initCodeMirror() {
        const textarea = document.getElementById('config');
        const theme = localStorage.getItem('theme') === 'dark' ? 'dracula' : 'default';
        
        this.editor = CodeMirror.fromTextArea(textarea, {
            lineNumbers: true,
            mode: 'shell',
            theme: theme,
            lineWrapping: true,
            autofocus: false,
            placeholder: this.translations.placeholder,
            viewportMargin: Infinity,
            readOnly: !this.isAuthenticated,
            lineHeight: 1.6, // КРИТИЧЕСКОЕ: Установка точной высоты строки
            inputStyle: 'contenteditable', // КРИТИЧЕСКОЕ: Используем contenteditable для лучшей производительности
            scrollbarStyle: 'native', // КРИТИЧЕСКОЕ: Нативные скроллбары для производительности
            extraKeys: {
                "Ctrl-S": (cm) => {
                    this.saveCurrentFile();
                    return false;
                },
                "Cmd-S": (cm) => {
                    this.saveCurrentFile();
                    return false;
                },
                "Ctrl-Z": (cm) => {
                    return CodeMirror.Pass;
                },
                "Cmd-Z": (cm) => {
                    return CodeMirror.Pass;
                },
                "Ctrl-Y": (cm) => {
                    return CodeMirror.Pass;
                },
                "Cmd-Y": (cm) => {
                    return CodeMirror.Pass;
                },
                "Ctrl-Shift-Z": (cm) => {
                    return CodeMirror.Pass;
                },
                "Cmd-Shift-Z": (cm) => {
                    return CodeMirror.Pass;
                }
            }
        });

        this.editor.on('change', () => {
            this.checkForChanges();
        });
        
        this.editor.on('focus', () => {
            document.activeEditor = this.editor;
        });
        
        // КРИТИЧЕСКОЕ: Периодическое обновление позиционирования для больших файлов
        this.editor.on('scroll', () => {
            setTimeout(() => {
                this.editor.refresh();
            }, 100);
        });
    }

    checkForChanges() {
        if (!this.isAuthenticated) return;
        
        const currentContent = this.editor.getValue();
        const hasChanges = currentContent !== this.originalContent;
        
        // Обновляем состояние только если есть изменения
        if (hasChanges !== document.body.classList.contains('changed')) {
            document.body.classList.toggle('changed', hasChanges);
        }
        
        const saveButton = document.getElementById('save');
        const saveFsButton = document.getElementById('save-fullscreen');
        
        // Всегда управляем обеими кнопками на основе наличия изменений
        if (hasChanges) {
            saveButton.style.display = 'inline-flex';
            
            // Кнопка в fullscreen появляется только если есть изменения
            if (document.querySelector('.editor-container').classList.contains('fullscreen')) {
                saveFsButton.style.display = 'inline-flex';
            }
        } else {
            saveButton.style.display = 'none';
            saveFsButton.style.display = 'none';
        }
    }

    initUIComponents() {
        this.$tabs = document.querySelector('nav');
        this.initButtons();
        this.tabs = this.initTabs();
        this.initPopups();
        this.initLanguageSwitcher();
        this.initThemeSwitcher();
        this.initLoginForm();
        this.initCreateFilePopup();
        this.initAvailabilityPopup();
    }

    initButtons() {
        document.getElementById('save').addEventListener('click', () => this.saveCurrentFile());
        document.getElementById('create-file').addEventListener('click', () => this.showCreateFilePopup());
        document.getElementById('check-availability').addEventListener('click', () => this.domChecker.checkDomainsAvailability());
        document.getElementById('restart').addEventListener('click', () => this.confirmServiceAction('restart'));
        
        document.getElementById('dropdown').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isAuthenticated) return;
            document.getElementById('dropdown-menu').classList.toggle('hidden');
        });
        
        document.getElementById('reload').addEventListener('click', () => {
            document.getElementById('dropdown-menu').classList.add('hidden');
            this.confirmServiceAction('reload');
        });
        
        document.getElementById('stop').addEventListener('click', () => {
            document.getElementById('dropdown-menu').classList.add('hidden');
            this.confirmServiceAction('stop');
        });
        
        document.getElementById('start').addEventListener('click', () => {
            document.getElementById('dropdown-menu').classList.add('hidden');
            this.confirmServiceAction('start');
        });
        
        document.getElementById('upgrade').addEventListener('click', () => {
            document.getElementById('dropdown-menu').classList.add('hidden');
            this.confirmServiceAction('upgrade');
        });
        
        document.getElementById('logout').addEventListener('click', async () => {
            const result = await this.postData({ cmd: 'logout' });
            if (result && result.status === 0) {
                localStorage.removeItem('hasSession');
                window.location.reload();
            }
        });
        
        document.getElementById('editor-fullscreen').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('save-fullscreen').addEventListener('click', () => this.saveCurrentFile());
        
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('dropdown-menu');
            const dropdownBtn = document.getElementById('dropdown');
            
            if (!dropdown.classList.contains('hidden') && 
                !dropdown.contains(e.target) && 
                !dropdownBtn.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    initTabs() {
        const tabs = {};
        let currentFile = '';

        const add = (filename) => {
            const tab = document.createElement('div');
            tab.classList.add('nav-tab');
            tab.dataset.filename = filename;
            
            // Добавляем текст во вкладку
            const tabText = document.createElement('span');
            tabText.className = 'nav-tab-text';
            tabText.textContent = filename;
            tab.appendChild(tabText);

            const isLog = filename.endsWith('.log');
            const isConfig = filename.endsWith('.conf') || filename.includes('.conf-');
            const isList = filename.endsWith('.list') || filename.includes('.list-');

            const protectedFiles = [
                'nfqws2.conf',
                'nfqws.conf',
                'user.list',
                'exclude.list',
                'auto.list',
                'ipset.list',
                'ipset_exclude.list',
                'nfqws2.log',
                'nfqws.log',
                'nfqws2-debug.log',
                'nfqws-debug.log'
            ];
            
            const isProtected = protectedFiles.includes(filename);
            
            if (!isLog && !isProtected) {
                const trash = document.createElement('div');
                trash.classList.add('nav-trash');
                
                const trashSvg = document.createElement('div');
                trashSvg.style.cssText = 'width: 15px; height: 15px;';
                trashSvg.innerHTML = `<img src="img/Musor.svg" alt="Delete" style="width: 100%; height: 100%;">`;
                
                trash.appendChild(trashSvg);
                trash.title = this.translations.deleteFile || "Delete file";

                trash.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!this.isAuthenticated) return;
                    if (await this.showConfirm(this.translations.confirmDelete)) {
                        const result = await this.removeFile(filename);
                        if (result && result.status === 0) {
                            if (tabs[filename]) {
                                tabs[filename].remove();
                                delete tabs[filename];
                            }
                            
                            if (filename === currentFile) {
                                const remainingFiles = Object.keys(tabs);
                                if (remainingFiles.length > 0) {
                                    await this.loadFile(remainingFiles[0]);
                                } else {
                                    this.editor.setValue('');
                                    this.originalContent = '';
                                    this.currentFilename = '';
                                    document.getElementById('current-filename').textContent = this.translations.noFileSelected;
                                    this.checkForChanges();
                                }
                            }
                            
                            this.showNotification(this.translations.fileDeleted, 'success');
                        } else {
                            this.showNotification(this.translations.error + ': ' + this.translations.failedToDeleteFile, 'error');
                        }
                    }
                });

                tab.appendChild(trash);
            }

            if (isLog) {
                const clear = document.createElement('div');
                clear.classList.add('nav-clear');
                
                const clearSvg = document.createElement('div');
                clearSvg.style.cssText = 'width: 15px; height: 15px;';
                clearSvg.innerHTML = `<img src="img/Venik.svg" alt="Clear" style="width: 100%; height: 100%;">`;
                
                clear.appendChild(clearSvg);
                clear.title = this.translations.clearLog || "Clear log";

                clear.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (!this.isAuthenticated) return;
                    if (await this.showConfirm(this.translations.confirmClear)) {
                        const result = await this.saveFile(filename, '');
                        if (!result.status) {
                            if (filename === currentFile) {
                                this.editor.setValue('');
                                this.originalContent = '';
                                this.checkForChanges();
                            }
                            this.showNotification(this.translations.logCleared, 'success');
                        }
                    }
                });

                tab.appendChild(clear);
            }

            // Для обычных кликов (без перетаскивания)
            tab.addEventListener('click', (e) => {
                // Если был drag (перетаскивание), не обрабатываем клик
                if (this.dragDrop && this.dragDrop.isDragging) return;
                if (!this.isAuthenticated) return;
                
                this.loadFile(filename);
            });

            this.$tabs.appendChild(tab);
            tabs[filename] = tab;
        };

        const removeTab = (filename) => {
            const tab = tabs[filename];
            if (tab) {
                tab.remove();
                delete tabs[filename];
            }
        };

        const activate = (filename) => {
            Object.values(tabs).forEach(tab => {
                tab.classList.toggle('active', tab.dataset.filename === filename);
            });
            currentFile = filename;
            document.getElementById('current-filename').textContent = filename;
            
            this.updateCheckAvailabilityButton(filename);
            
            if (this.historyManager) {
                this.historyManager.updateCurrentFile(filename);
            }
        };

        return {
            add,
            remove: removeTab,
            activate,
            get currentFileName() {
                return currentFile;
            }
        };
    }

    updateCheckAvailabilityButton(filename) {
        const checkButton = document.getElementById('check-availability');
        const isListFile = filename.endsWith('.list') || filename.includes('.list-');
        
        if (isListFile) {
            checkButton.style.display = 'inline-flex';
        } else {
            checkButton.style.display = 'none';
        }
    }

    initCreateFilePopup() {
        const popup = document.getElementById('create-file-popup');
        const cancelBtn = document.getElementById('create-file-cancel');
        const confirmBtn = document.getElementById('create-file-confirm');
        const closeBtn = popup.querySelector('.popup-close-btn');
        const filenameInput = document.getElementById('new-filename');
        
        document.getElementById('create-file').addEventListener('click', () => {
            this.showCreateFilePopup();
        });
        
        cancelBtn.addEventListener('click', () => {
            this.closeCreateFilePopup();
        });
        
        closeBtn.addEventListener('click', () => {
            this.closeCreateFilePopup();
        });
        
        confirmBtn.addEventListener('click', async () => {
            await this.createNewFile();
        });
        
        filenameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });
    }

    showCreateFilePopup() {
        if (!this.isAuthenticated) return;
        
        const popup = document.getElementById('create-file-popup');
        const title = document.getElementById('create-file-title');
        const filenameLabel = document.getElementById('filename-label');
        const filenameHint = document.getElementById('filename-hint');
        const extensionLabel = document.getElementById('extension-label');
        const cancelBtn = document.getElementById('create-file-cancel');
        const confirmBtn = document.getElementById('create-file-confirm');
        
        title.textContent = this.translations.createFile || 'Create New File';
        filenameLabel.textContent = this.translations.filenameLabel || 'File name (without extension)';
        filenameHint.textContent = this.translations.filenameHint || 'Enter file name without extension';
        extensionLabel.textContent = this.translations.extensionLabel || 'File type';
        cancelBtn.textContent = this.translations.cancel || 'Cancel';
        confirmBtn.textContent = this.translations.confirm || 'Confirm';
        
        const listFileText = document.querySelector('.radio-text:nth-child(1)');
        const configFileText = document.querySelector('.radio-text:nth-child(2)');
        if (listFileText) listFileText.textContent = this.translations.listFile || '.list file';
        if (configFileText) configFileText.textContent = this.translations.configFile || '.conf file';
        
        document.getElementById('new-filename').value = '';
        document.querySelector('input[name="filetype"][value=".list"]').checked = true;
        
        popup.classList.remove('hidden');
        document.body.classList.add('disabled');
        
        setTimeout(() => {
            document.getElementById('new-filename').focus();
        }, 100);
    }

    closeCreateFilePopup() {
        const popup = document.getElementById('create-file-popup');
        popup.classList.add('hidden');
        document.body.classList.remove('disabled');
    }

    async createNewFile() {
        const filenameInput = document.getElementById('new-filename');
        const filename = filenameInput.value.trim();
        
        if (!filename) {
            this.showNotification(this.translations.error + ': ' + (this.translations.enterCredentials || 'Please enter login and password'), 'error');
            return;
        }
        
        if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
            this.showNotification(this.translations.error + ': ' + (this.translations.invalidFilename || 'Invalid file name. Use only letters, numbers, dots, hyphens and underscores'), 'error');
            return;
        }
        
        const fileType = document.querySelector('input[name="filetype"]:checked').value;
        const fullFilename = filename + fileType;
        
        try {
            const existingFiles = await this.getFiles();
            if (existingFiles.files && existingFiles.files.includes(fullFilename)) {
                this.showNotification(this.translations.fileExists || 'File already exists', 'error');
                return;
            }
            
            const result = await this.saveFile(fullFilename, '');
            
            if (result && result.status === 0) {
                this.tabs.add(fullFilename);
                await this.loadFile(fullFilename);
                this.closeCreateFilePopup();
                this.showNotification(this.translations.fileCreated || 'File created successfully', 'success');
            } else {
                this.showNotification(this.translations.fileCreationFailed || 'Failed to create file', 'error');
            }
        } catch (error) {
            console.error('Error creating file:', error);
            this.showNotification(this.translations.fileCreationFailed || 'Failed to create file', 'error');
        }
    }

    initAvailabilityPopup() {
        const popup = document.getElementById('availability-results');
        const closeBtn = document.getElementById('availability-close');
        const startBtn = document.getElementById('availability-start');
        const headerCloseBtn = popup.querySelector('.popup-close-btn');
        
        closeBtn.addEventListener('click', () => {
            popup.classList.add('hidden');
            document.body.classList.remove('disabled');
            this.domChecker.stopDomainCheck();
            this.domChecker.resetAvailabilityUI();
        });
        
        startBtn.addEventListener('click', () => {
            this.domChecker.startDomainCheck();
        });
        
        headerCloseBtn.addEventListener('click', () => {
            popup.classList.add('hidden');
            document.body.classList.remove('disabled');
            this.domChecker.stopDomainCheck();
            this.domChecker.resetAvailabilityUI();
        });
    }

    initLoginForm() {
        const loginForm = document.getElementById('login-form');
        const loginInput = document.getElementById('login');
        const passwordInput = document.getElementById('password');
        const loginButton = document.getElementById('login-button');
        const closeButton = loginForm.querySelector('.popup-close-btn');
        const loginTitle = document.getElementById('login-title');
        
        loginTitle.textContent = this.translations.login || 'Login';
        loginButton.textContent = this.translations.login || 'Login';
        
        loginButton.addEventListener('click', async () => {
            const user = loginInput.value.trim();
            const password = passwordInput.value;
            
            if (!user || !password) {
                this.showNotification(this.translations.error + ': ' + (this.translations.enterCredentials || 'Please enter login and password'), 'error');
                return;
            }
            
            try {
                const result = await this.postData({
                    cmd: 'login',
                    user: user,
                    password: password
                });
                
                if (result && result.status === 0) {
                    this.isAuthenticated = true;
                    localStorage.setItem('hasSession', 'true');
                    document.body.classList.add('authenticated');
                    loginForm.classList.add('hidden');
                    document.body.classList.remove('disabled');
                    
                    await this.loadFiles();
                } else {
                    this.showNotification(this.translations.error + ': ' + (this.translations.loginFailed || 'Login failed'), 'error');
                    passwordInput.value = '';
                }
            } catch (error) {
                this.showNotification(this.translations.error + ': ' + (this.translations.loginError || 'Login error'), 'error');
            }
        });
        
        closeButton.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            document.body.classList.remove('disabled');
        });
        
        loginInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                passwordInput.focus();
            }
        });
        
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loginButton.click();
            }
        });
    }

    showLoginForm() {
        const loginForm = document.getElementById('login-form');
        const loginInput = document.getElementById('login');
        const loginButton = document.getElementById('login-button');
        const loginTitle = document.getElementById('login-title');
        
        loginTitle.textContent = this.translations.login || 'Login';
        loginButton.textContent = this.translations.login || 'Login';
        loginForm.classList.remove('hidden');
        document.body.classList.add('disabled');
        loginInput.focus();
        loginInput.value = '';
        document.getElementById('password').value = '';
    }

    initPopups() {
        const popup = document.getElementById('alert');
        const content = document.getElementById('popup-content');
        const buttonClose = document.getElementById('popup-close');
        const buttonYes = document.getElementById('popup-yes');
        const buttonNo = document.getElementById('popup-no');
        const popupTitle = document.getElementById('popup-title');
        const closeButton = popup.querySelector('.popup-close-btn');
        
        this.resolveCallback = null;
        let isProcessing = false;

        buttonClose.addEventListener('click', () => {
            this.closePopup(popup, false);
        });

        closeButton.addEventListener('click', () => {
            this.closePopup(popup, false);
        });

        buttonYes.addEventListener('click', () => {
            if (!isProcessing) {
                this.closePopup(popup, true);
            }
        });

        buttonNo.addEventListener('click', () => {
            if (!isProcessing) {
                this.closePopup(popup, false);
            }
        });

        this.showAlert = (message, title = '') => {
            return new Promise((resolve) => {
                content.textContent = message;
                popupTitle.textContent = title || '';
                popup.classList.remove('hidden');
                popup.classList.add('alert');
                popup.classList.remove('confirm');
                document.body.classList.add('disabled');
                this.resolveCallback = resolve;
            });
        };

        this.showConfirm = (message, title = '') => {
            return new Promise((resolve) => {
                content.textContent = message;
                popupTitle.textContent = title || '';
                popup.classList.remove('hidden');
                popup.classList.add('confirm');
                popup.classList.remove('alert');
                document.body.classList.add('disabled');
                this.resolveCallback = resolve;
            });
        };

        this.showProcessing = async (message, action, title = '') => {
            return new Promise(async (resolve) => {
                if (!this.isAuthenticated) {
                    resolve(false);
                    return;
                }
                
                content.textContent = `${message}\n\n${this.translations.processing || 'Processing...'}`;
                popupTitle.textContent = title || '';
                popup.classList.remove('hidden');
                popup.classList.add('alert', 'locked');
                document.body.classList.add('disabled');
                isProcessing = true;
                
                try {
                    const result = await action();
                    if (result && !result.status) {
                        content.textContent = `${message}\n\n✅ ${this.translations.success || 'Success'}!`;
                        if (result.output) {
                            content.textContent += `\n${result.output.join('\n')}`;
                        }
                        resolve(true);
                    } else {
                        content.textContent = `${message}\n\n❌ ${this.translations.error || 'Error'}: ${result ? result.status : 'Unknown error'}`;
                        if (result && result.output) {
                            content.textContent += `\n${result.output.join('\n')}`;
                        }
                        resolve(false);
                    }
                } catch (error) {
                    content.textContent = `${message}\n\n❌ ${this.translations.error || 'Error'}: ${error.message}`;
                    resolve(false);
                } finally {
                    popup.classList.remove('locked');
                    isProcessing = false;
                }
            });
        };
    }

    closePopup(popup, result) {
        popup.classList.add('hidden');
        document.body.classList.remove('disabled');
        if (this.resolveCallback) {
            this.resolveCallback(result);
            this.resolveCallback = null;
        }
    }

    initLanguageSwitcher() {
        const switcher = document.getElementById('language-switcher');
        
        this.updateLanguageSwitcher();
        
        switcher.addEventListener('click', (e) => {
            if (e.target.classList.contains('language-option')) {
                const lang = e.target.dataset.lang;
                this.switchLanguage(lang);
            }
        });
    }
    
    updateLanguageSwitcher() {
        document.querySelectorAll('.language-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.lang === this.currentLang) {
                option.classList.add('active');
            }
        });
    }

    initThemeSwitcher() {
        document.getElementById('theme').addEventListener('click', () => this.toggleTheme());
    }

    async switchLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('lang', lang);
        document.documentElement.lang = lang;
        
        await this.loadTranslations();
        this.applyTranslations();
        this.updateLanguageSwitcher();
    }

 applyTranslations() {
    document.getElementById('save-text').textContent = this.translations.save;
    document.getElementById('restart-text').textContent = this.translations.restart;
    document.getElementById('reload-text').textContent = this.translations.reload;
    document.getElementById('stop-text').textContent = this.translations.stop;
    document.getElementById('start-text').textContent = this.translations.start;
    document.getElementById('update-text').textContent = this.translations.update;
    document.getElementById('save-fs-text').textContent = this.translations.save;
    document.getElementById('create-file-text').textContent = this.translations.newFile || 'New File';
    document.getElementById('check-availability-text').textContent = this.translations.checkAvailability || 'Check Availability';
    
    document.getElementById('popup-yes').textContent = this.translations.yes;
    document.getElementById('popup-no').textContent = this.translations.no;
    document.getElementById('popup-close').textContent = this.translations.close;
    
    document.getElementById('availability-close').textContent = this.translations.close || 'Close';
    document.getElementById('availability-start').textContent = this.translations.checkAvailability || 'Start Check';
    
    document.getElementById('login-title').textContent = this.translations.login;
    document.getElementById('login-button').textContent = this.translations.login;
    
    const createTitle = document.getElementById('create-file-title');
    const filenameLabel = document.getElementById('filename-label');
    const filenameHint = document.getElementById('filename-hint');
    const extensionLabel = document.getElementById('extension-label');
    
    // Находим элементы внутри popup для перевода типов файлов
    const createFilePopup = document.getElementById('create-file-popup');
    if (createFilePopup) {
        const listFileText = createFilePopup.querySelector('.radio-label:nth-child(1) .radio-text');
        const configFileText = createFilePopup.querySelector('.radio-label:nth-child(2) .radio-text');
        
        if (listFileText) listFileText.textContent = this.translations.listFile || '.list file';
        if (configFileText) configFileText.textContent = this.translations.configFile || '.conf file';
    }
    
    const cancelBtn = document.getElementById('create-file-cancel');
    const confirmBtn = document.getElementById('create-file-confirm');
    
    if (createTitle) createTitle.textContent = this.translations.createFile || 'Create New File';
    if (filenameLabel) filenameLabel.textContent = this.translations.filenameLabel || 'File name (without extension)';
    if (filenameHint) filenameHint.textContent = this.translations.filenameHint || 'Enter file name without extension';
    if (extensionLabel) extensionLabel.textContent = this.translations.extensionLabel || 'File type';
    if (cancelBtn) cancelBtn.textContent = this.translations.cancel || 'Cancel';
    if (confirmBtn) confirmBtn.textContent = this.translations.confirm || 'Confirm';
    
    const availabilityTitle = document.getElementById('availability-title');
    const totalLabel = document.querySelector('.info-row:nth-child(1) .info-label');
    const accessibleLabel = document.querySelector('.info-row:nth-child(2) .info-label');
    const blockedLabel = document.querySelector('.info-row:nth-child(3) .info-label');
    const progressLabel = document.querySelector('.info-row:nth-child(4) .info-label');
    
    if (availabilityTitle) availabilityTitle.textContent = this.translations.checkAvailability || 'Domain Availability Check';
    if (totalLabel) totalLabel.textContent = this.translations.totalDomains || 'Total domains:';
    if (accessibleLabel) accessibleLabel.textContent = this.translations.accessibleDomains || 'Accessible:';
    if (blockedLabel) blockedLabel.textContent = this.translations.blockedDomains || 'Blocked:';
    if (progressLabel) progressLabel.textContent = this.translations.progress || 'Progress:';
    
    if (this.editor) {
        this.editor.setOption("placeholder", this.translations.placeholder);
    }
    
    document.getElementById('current-filename').textContent = 
        this.currentFilename || this.translations.noFileSelected;
    
    document.getElementById('editor-fullscreen').title = this.translations.fullscreen;
    document.getElementById('theme').title = this.translations.themeLight;
    document.getElementById('logout').title = this.translations.logout;
    document.getElementById('language-switcher').title = this.translations.language;
    document.getElementById('create-file').title = this.translations.newFile || 'Create new file';
    document.getElementById('check-availability').title = this.translations.checkAvailability || 'Check domain availability';
}

    toggleTheme() {
        const root = document.querySelector(':root');
        const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
        root.dataset.theme = theme;
        
        const themeButton = document.getElementById('theme');
        themeButton.title = theme === 'dark' ? this.translations.themeLight : this.translations.themeDark;
        
        if (this.editor) {
            this.editor.setOption('theme', theme === 'dark' ? 'dracula' : 'default');
        }
    }

    toggleFullscreen() {
        const editorContainer = document.querySelector('.editor-container');
        const fsButton = document.getElementById('editor-fullscreen');
        const saveFsButton = document.getElementById('save-fullscreen');
        
        if (editorContainer.classList.contains('fullscreen')) {
            editorContainer.classList.add('closing');
            fsButton.title = this.translations.fullscreen;
            
            setTimeout(() => {
                editorContainer.classList.remove('fullscreen', 'closing');
                document.body.classList.remove('fullscreen-active');
                
                fsButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>';
                
                // Скрываем кнопку сохранения при выходе из полноэкранного режима
                saveFsButton.style.display = 'none';
            }, 500);
        } else {
            editorContainer.classList.add('fullscreen');
            document.body.classList.add('fullscreen-active');
            fsButton.title = this.translations.exitFullscreen;
            
            fsButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>';
            
            // Показываем кнопку сохранения только если есть изменения
            if (document.body.classList.contains('changed')) {
                saveFsButton.style.display = 'inline-flex';
            }
        }
        
        if (this.editor) {
            setTimeout(() => {
                this.editor.refresh();
                this.editor.focus();
            }, 100);
        }
    }

    async checkAuth() {
        try {
            const response = await this.postData({ cmd: 'filenames' });
            
            if (response && response.status === 0) {
                this.isAuthenticated = true;
                this.nfqws2 = response.nfqws2 || false;
                document.body.classList.add('authenticated');
                localStorage.setItem('hasSession', 'true');
                this.setStatus(response.service);
                this.setTitle(this.nfqws2 ? 'Keenetic NFQWS 2' : 'Keenetic NFQWS');
                
                // Обновляем версию
                if (response.version) {
                    document.getElementById('version').textContent = `v${response.version}`;
                }
                
                await this.loadFiles();
            } else if (response && response.status === 401) {
                this.isAuthenticated = false;
                localStorage.removeItem('hasSession');
                document.body.classList.remove('authenticated');
                this.showLoginForm();
            } else {
                console.error('Auth check error:', response);
                this.showLoginForm();
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this.showLoginForm();
        }
    }

    setTitle(title) {
        const logoElement = document.querySelector('.logo');
        let nfqwsText = logoElement.querySelector('#nfqws');
        
        if (!nfqwsText) {
            nfqwsText = document.createElement('span');
            nfqwsText.id = 'nfqws';
            const statusSpan = logoElement.querySelector('#status');
            if (statusSpan) {
                logoElement.insertBefore(nfqwsText, statusSpan);
            } else {
                logoElement.appendChild(nfqwsText);
            }
        }
        
        nfqwsText.textContent = title;
    }

async loadFiles() {
    try {
        const response = await this.getFiles();
        this.setStatus(response.service);

        if (response.files?.length) {
            for (const filename of response.files) {
                this.tabs.add(filename);
            }
            
            // Подождем, пока DOM обновится, затем загрузим порядок
            setTimeout(() => {
                if (this.dragDrop && this.dragDrop.loadTabsOrder) {
                    this.dragDrop.loadTabsOrder();
                }
            }, 300);
            
            const firstFile = response.files[0];
            if (firstFile) {
                await this.loadFile(firstFile);
            }
        }
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

    async loadFile(filename) {
        if (!this.isAuthenticated) return;
        
        // Проверяем изменения только если есть активный файл и он отличается от загружаемого
        if (this.currentFilename && this.currentFilename !== filename && document.body.classList.contains('changed')) {
            const confirm = await this.showConfirm(
                this.translations.confirmClose,
                this.translations.confirm || 'Confirm'
            );
            if (!confirm) return;
        }

        try {
            this.tabs.activate(filename);
            this.currentFilename = filename;
            
            const content = await this.getFileContent(filename);
            this.editor.setValue(content);
            this.originalContent = content;
            
            // Сбрасываем состояние изменений при успешной загрузке
            document.body.classList.remove('changed');
            
            const isConfigFile = filename.includes('.conf') || filename.includes('.conf-');
            this.editor.setOption('mode', isConfigFile ? 'shell' : 'text/plain');
            this.editor.setOption('readOnly', filename.endsWith('.log'));
            
            if (this.historyManager) {
                this.historyManager.clear();
                this.historyManager.updateCurrentFile(filename);
            }
            
            this.editor.focus();
        } catch (error) {
            console.error('Error loading file:', error);
            this.showNotification(this.translations.error + ': ' + (this.translations.failedToLoadFile || 'Failed to load file'), 'error');
        }
    }

    async saveCurrentFile() {
        if (!this.isAuthenticated) return;
        
        const filename = this.tabs.currentFileName;
        if (!filename) return;

        try {
            const result = await this.saveFile(filename, this.editor.getValue());
            if (!result.status) {
                this.originalContent = this.editor.getValue();
                document.body.classList.remove('changed');
                
                this.showNotification(this.translations.fileSaved, 'success');
                
                if (this.historyManager) {
                    this.historyManager.updateCurrentFile(filename);
                }
            }
        } catch (error) {
            console.error('Error saving file:', error);
            this.showNotification(this.translations.error + ': ' + (this.translations.failedToSaveFile || 'Failed to save file'), 'error');
        }
    }

    async confirmServiceAction(action) {
        if (!this.isAuthenticated) return;
        
        const confirmTexts = {
            'restart': this.translations.confirmRestart,
            'reload': this.translations.confirmReload,
            'stop': this.translations.confirmStop,
            'start': this.translations.confirmStart,
            'upgrade': this.translations.confirmUpdate
        };

        const successMessages = {
            'restart': this.translations.serviceRestarted,
            'reload': this.translations.serviceReloaded,
            'stop': this.translations.serviceStopped,
            'start': this.translations.serviceStarted,
            'upgrade': this.translations.upgradeCompleted
        };

        const confirmText = confirmTexts[action];
        if (!confirmText) return;

        const confirm = await this.showConfirm(
            confirmText,
            this.translations.confirm || 'Confirm'
        );
        if (!confirm) return;

        const success = await this.showProcessing(
            `${this.translations.executing || 'Executing'} ${this.nfqws2 ? 'Keenetic NFQWS 2' : 'Keenetic NFQWS'} ${action}`,
            () => this.serviceActionRequest(action),
            this.translations.processing || 'Processing'
        );

        if (success) {
            if (action === 'stop') {
                this.setStatus(false);
            } else if (action === 'start' || action === 'restart') {
                this.setStatus(true);
            }
            
            const successMessage = successMessages[action];
            if (successMessage) {
                this.showNotification(successMessage, 'success');
            }
            
            if (action === 'upgrade') {
                const result = await this.postData({ cmd: 'getversion' });
                if (result && result.status === 0) {
                    let versionText = 'vunknown';
                    if (result.version) {
                        versionText = `v${result.version}`;
                    }
                    document.getElementById('version').textContent = versionText;
                    
                    this.nfqws2 = result.nfqws2 || false;
                    this.setTitle(this.nfqws2 ? 'Keenetic NFQWS 2' : 'Keenetic NFQWS');
                }
                
                setTimeout(() => window.location.reload(), 2000);
            }
        }
    }

    setStatus(status) {
        document.body.classList.toggle('running', status);
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 96px;
            right: 30px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#34c759' : '#ff3b30'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 99999999;
            animation: notificationSlideIn 0.3s ease;
            max-width: 300px;
            word-break: break-word;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'notificationSlideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    async postData(data) {
        const formData = new FormData();
        for (const [key, value] of Object.entries(data)) {
            formData.append(key, value);
        }

        try {
            const response = await fetch('index.php', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                return await response.json();
            }

            if (response.status === 401) {
                this.isAuthenticated = false;
                localStorage.removeItem('hasSession');
                document.body.classList.remove('authenticated');
                this.showLoginForm();
                return { status: 401 };
            }
            
            return { status: response.status };
        } catch (e) {
            console.error('API Error:', e);
            return { status: 500 };
        }
    }

    async getFiles() {
        return this.postData({ cmd: 'filenames' });
    }

    async getFileContent(filename) {
        const data = await this.postData({ cmd: 'filecontent', filename });
        return data.content || '';
    }

    async saveFile(filename, content) {
        return this.postData({ cmd: 'filesave', filename, content });
    }

    async removeFile(filename) {
        return this.postData({ cmd: 'fileremove', filename });
    }

    async serviceActionRequest(action) {
        return this.postData({ cmd: action });
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.ui = new UI();
});