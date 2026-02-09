class DomChecker {
    constructor(ui) {
        this.ui = ui;
        this.checkInProgress = false;
        this.currentDomains = [];
        this.concurrentLimit = 50;
        this.checkTimeout = 2000;
        this.checkCache = new Map();
        this.abortController = null;
        this.activeRequests = new Set();
    }

    async checkDomainsAvailability() {
        if (!this.ui.isAuthenticated || this.checkInProgress) return;
        
        const filename = this.ui.tabs.currentFileName;
        if (!filename || (!filename.endsWith('.list') && !filename.includes('.list-'))) {
            this.ui.showNotification(this.ui.translations.selectListFile || 'Select a .list file to check domains', 'error');
            return;
        }
        
        try {
            const content = this.ui.editor.getValue();
            const domains = this.extractDomainsFromContent(content);
            
            if (domains.length === 0) {
                this.ui.showNotification(this.ui.translations.noDomainsFound || 'No domains found in the file', 'error');
                return;
            }
            
            this.currentDomains = domains;
            this.showAvailabilityPopup(domains);
            
        } catch (error) {
            console.error('Error checking domains:', error);
            this.ui.showNotification(this.ui.translations.error + ': ' + error.message, 'error');
        }
    }

    async startDomainCheck() {
        if (this.checkInProgress || this.currentDomains.length === 0) return;
        
        this.checkInProgress = true;
        this.abortController = new AbortController();
        
        try {
            document.getElementById('availability-title').textContent = 
                this.ui.translations.checkingDomains || 'Checking domain availability...';
            
            await this.checkDomains(this.currentDomains);
            
        } catch (error) {
            console.error('Error checking domains:', error);
            this.ui.showNotification(this.ui.translations.error + ': ' + error.message, 'error');
            this.checkInProgress = false;
        }
    }

    stopDomainCheck() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        
        this.activeRequests.forEach(controller => controller.abort());
        this.activeRequests.clear();
        this.checkInProgress = false;
        
        const checkButton = document.getElementById('check-availability');
        const originalText = this.ui.translations.checkAvailability || 'Check Availability';
        checkButton.disabled = false;
        checkButton.classList.remove('disabled');
        checkButton.querySelector('span').textContent = originalText;
    }

    extractDomainsFromContent(content) {
        const lines = content.split('\n');
        const domains = new Set();
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
                continue;
            }
            
            let domain = trimmedLine;
            domain = domain.replace(/^(https?:\/\/)/, '');
            domain = domain.replace(/^www\./, '');
            domain = domain.split('#')[0].trim();
            domain = domain.split('/')[0];
            domain = domain.split(':')[0];
            domain = domain.trim();
            
            if (domain && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
                domains.add(domain.toLowerCase());
            }
        }
        
        return Array.from(domains);
    }

    showAvailabilityPopup(domains) {
        const popup = document.getElementById('availability-results');
        const title = document.getElementById('availability-title');
        const totalDomains = document.getElementById('total-domains');
        const accessibleDomains = document.getElementById('accessible-domains');
        const blockedDomains = document.getElementById('blocked-domains');
        const progress = document.getElementById('progress');
        const progressBar = document.getElementById('progress-bar');
        const resultsContainer = document.getElementById('results-container');
        const startButton = document.getElementById('availability-start');
        
        title.textContent = this.ui.translations.checkAvailability || 'Domain Availability Check';
        totalDomains.textContent = domains.length;
        accessibleDomains.textContent = '0';
        blockedDomains.textContent = '0';
        progress.textContent = '0%';
        progressBar.style.width = '0%';
        resultsContainer.innerHTML = '';
        startButton.textContent = this.ui.translations.checkAvailability || 'Start Check';
        
        // Создаем DOM-элементы для ВСЕХ доменов
        domains.forEach(domain => {
            const domainItem = document.createElement('div');
            domainItem.className = 'domain-result pending';
            domainItem.dataset.domain = domain;
            domainItem.innerHTML = `
                <span class="domain-name">${domain}</span>
                <span class="domain-status"></span>
            `;
            resultsContainer.appendChild(domainItem);
        });
        
        popup.classList.remove('hidden');
        document.body.classList.add('disabled');
    }

    async checkDomains(domains) {
        const total = domains.length;
        let checked = 0;
        let accessible = 0;
        let blocked = 0;
        
        this.checkCache.clear();
        this.activeRequests.clear();
        
        const checkButton = document.getElementById('check-availability');
        const originalText = checkButton.querySelector('span').textContent;
        checkButton.disabled = true;
        checkButton.classList.add('disabled');
        checkButton.querySelector('span').textContent = '⏳ ' + (this.ui.translations.checkingDomains || 'Checking...');
        
        const startButton = document.getElementById('availability-start');
        startButton.disabled = true;
        startButton.textContent = '⏳ ' + (this.ui.translations.checkingDomains || 'Checking...');
        
        // Обновляем статусы всех доменов на "Проверяется"
        domains.forEach(domain => {
            const domainItem = document.querySelector(`.domain-result[data-domain="${domain}"]`);
            if (domainItem) {
                domainItem.classList.remove('pending');
                domainItem.classList.add('checking');
                domainItem.innerHTML = `
                    <span class="domain-name">${domain}</span>
                    <span class="domain-status">${this.ui.translations.checkingDomain || 'Checking...'}</span>
                `;
            }
        });
        
        const chunks = this.chunkArray(domains, this.concurrentLimit);
        
        try {
            for (let i = 0; i < chunks.length; i++) {
                if (!this.checkInProgress) break;
                
                const chunk = chunks[i];
                
                const promises = chunk.map(domain => 
                    this.checkSingleDomain(domain).then(result => {
                        checked++;
                        if (result) {
                            accessible++;
                        } else {
                            blocked++;
                        }
                        this.updateAvailabilityUI(domain, result, checked, total, accessible, blocked);
                        return result;
                    }).catch(() => {
                        checked++;
                        blocked++;
                        this.updateAvailabilityUI(domain, false, checked, total, accessible, blocked);
                        return false;
                    })
                );
                
                await Promise.allSettled(promises);
                
                if (i < chunks.length - 1 && this.checkInProgress) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            
            const message = this.ui.translations.domainCheckCompleted 
                ? this.ui.translations.domainCheckCompleted
                    .replace('{accessible}', accessible)
                    .replace('{blocked}', blocked)
                : `${this.ui.translations.domainCheckComplete || 'Domain check completed'}: ${accessible} accessible, ${blocked} blocked`;
            
            this.ui.showNotification(message, 'success');
            
            document.getElementById('availability-title').textContent = 
                this.ui.translations.domainCheckComplete || 'Domain check completed';
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Domain check error:', error);
                this.ui.showNotification(this.translations.error + ': ' + error.message, 'error');
            }
        } finally {
            this.checkInProgress = false;
            
            checkButton.disabled = false;
            checkButton.classList.remove('disabled');
            checkButton.querySelector('span').textContent = originalText;
            
            startButton.disabled = false;
            startButton.textContent = this.ui.translations.retryCheck || 'Retry Check';
            
            this.activeRequests.clear();
        }
    }

    async checkSingleDomain(domain) {
        if (this.checkCache.has(domain)) {
            return this.checkCache.get(domain);
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.checkTimeout);
            
            this.activeRequests.add(controller);
            
            const result = await this.checkWithFetch(domain, controller.signal);
            
            clearTimeout(timeoutId);
            this.activeRequests.delete(controller);
            
            this.checkCache.set(domain, result);
            return result;
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error(`Error checking domain ${domain}:`, error.message);
            }
            this.checkCache.set(domain, false);
            return false;
        }
    }

    async checkWithFetch(domain, signal) {
        try {
            const response = await fetch(`https://${domain}/favicon.ico`, {
                method: 'HEAD',
                mode: 'no-cors',
                signal,
                cache: 'no-cache',
                referrerPolicy: 'no-referrer'
            });
            
            return true;
        } catch {
            try {
                const response = await fetch(`http://${domain}/favicon.ico`, {
                    method: 'HEAD',
                    mode: 'no-cors',
                    signal,
                    cache: 'no-cache',
                    referrerPolicy: 'no-referrer'
                });
                return true;
            } catch {
                return false;
            }
        }
    }

    updateAvailabilityUI(domain, isAccessible, checked, total, accessible, blocked) {
        document.getElementById('total-domains').textContent = total;
        document.getElementById('accessible-domains').textContent = accessible;
        document.getElementById('blocked-domains').textContent = blocked;
        
        const progressPercent = Math.round((checked / total) * 100);
        document.getElementById('progress').textContent = `${progressPercent}%`;
        document.getElementById('progress-bar').style.width = `${progressPercent}%`;
        
        const domainItem = document.querySelector(`.domain-result[data-domain="${domain}"]`);
        if (domainItem) {
            domainItem.classList.remove('checking');
            domainItem.classList.add(isAccessible ? 'accessible' : 'blocked');
            domainItem.innerHTML = `
                <span class="domain-name">${domain}</span>
                <span class="domain-status">${isAccessible ? 
                    (this.ui.translations.domainAccessible || '✓ Accessible') : 
                    (this.ui.translations.domainBlocked || '✗ Blocked')}</span>
            `;
        }
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    resetAvailabilityUI() {
        this.checkInProgress = false;
        const checkButton = document.getElementById('check-availability');
        checkButton.disabled = false;
        checkButton.classList.remove('disabled');
        
        const originalText = this.ui.translations.checkAvailability || 'Check Availability';
        checkButton.querySelector('span').textContent = originalText;
    }
}