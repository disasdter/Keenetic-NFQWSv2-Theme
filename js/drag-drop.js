class DragDrop {
    constructor(ui) {
        this.ui = ui;
        this.tabsContainer = null;
        this.draggedTab = null;
        this.dragStartX = 0;
        this.dragOffsetX = 0;
        this.dragImage = null;
        this.isDragging = false;
        this.dragThreshold = 5;
        this.placeholder = null;
        setTimeout(() => this.init(), 100);
    }

    init() {
        this.tabsContainer = document.querySelector('nav');
        if (!this.tabsContainer) {
            setTimeout(() => {
                this.tabsContainer = document.querySelector('nav');
                if (this.tabsContainer) {
                    this.setupEventListeners();
                    this.loadTabsOrder();
                }
            }, 200);
            return;
        }
        
        this.setupEventListeners();
        this.loadTabsOrder();
    }

    setupEventListeners() {
        this.tabsContainer.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.tabsContainer.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    }

    loadTabsOrder() {
        const savedOrder = localStorage.getItem('tabsOrder');
        if (!savedOrder) return;

        try {
            const order = JSON.parse(savedOrder);
            const tabs = Array.from(this.tabsContainer.querySelectorAll('.nav-tab'));
            
            if (tabs.length === 0 || order.length === 0) return;
            
            const currentFilenames = tabs.map(tab => tab.dataset.filename);
            
            if (this.arraysEqual(currentFilenames, order)) {
                return;
            }
            
            const tabsMap = {};
            tabs.forEach(tab => {
                tabsMap[tab.dataset.filename] = tab;
            });
            
            const orderedTabs = [];
            
            order.forEach(filename => {
                if (tabsMap[filename]) {
                    orderedTabs.push(tabsMap[filename]);
                    delete tabsMap[filename];
                }
            });
            
            Object.values(tabsMap).forEach(tab => {
                orderedTabs.push(tab);
            });
            
            this.tabsContainer.innerHTML = '';
            orderedTabs.forEach(tab => {
                this.tabsContainer.appendChild(tab);
            });
            
            console.log('Tabs order loaded from localStorage');
        } catch (error) {
            console.error('Error loading tabs order:', error);
        }
    }

    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    saveTabsOrder() {
        const tabs = Array.from(this.tabsContainer.querySelectorAll('.nav-tab'));
        if (tabs.length === 0) return;
        
        const order = tabs.map(tab => tab.dataset.filename);
        localStorage.setItem('tabsOrder', JSON.stringify(order));
        console.log('Tabs order saved to localStorage:', order);
    }

    onMouseDown(e) {
        const tab = e.target.closest('.nav-tab');
        if (!tab || !this.ui.isAuthenticated) return;

        if (e.target.closest('.nav-trash') || e.target.closest('.nav-clear')) {
            return;
        }

        e.preventDefault();
        
        this.draggedTab = tab;
        this.dragStartX = e.clientX;
        
        const rect = tab.getBoundingClientRect();
        this.dragOffsetX = e.clientX - rect.left;

        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
    }

    onTouchStart(e) {
        const tab = e.target.closest('.nav-tab');
        if (!tab || !this.ui.isAuthenticated) return;

        if (e.target.closest('.nav-trash') || e.target.closest('.nav-clear')) {
            return;
        }

        e.preventDefault();

        const touch = e.touches[0];
        this.draggedTab = tab;
        this.dragStartX = touch.clientX;
        
        const rect = tab.getBoundingClientRect();
        this.dragOffsetX = touch.clientX - rect.left;

        document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onTouchEnd.bind(this));
    }

    onMouseMove(e) {
        if (!this.draggedTab) return;

        const deltaX = Math.abs(e.clientX - this.dragStartX);
        
        if (!this.isDragging && deltaX > this.dragThreshold) {
            this.startDrag(e.clientX);
        }

        if (this.isDragging && this.dragImage) {
            const x = e.clientX - this.dragOffsetX;
            this.dragImage.style.left = `${x}px`;
            this.dragImage.style.transition = 'none';
            this.updateTabPosition(e.clientX);
        }
    }

    onTouchMove(e) {
        if (!this.draggedTab) return;

        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - this.dragStartX);
        
        if (!this.isDragging && deltaX > this.dragThreshold) {
            this.startDrag(touch.clientX);
        }

        if (this.isDragging && this.dragImage) {
            const x = touch.clientX - this.dragOffsetX;
            this.dragImage.style.left = `${x}px`;
            this.dragImage.style.transition = 'none';
            this.updateTabPosition(touch.clientX);
        }
        
        e.preventDefault();
    }

    startDrag(clientX) {
        if (!this.draggedTab || this.isDragging) return;
        
        this.isDragging = true;
        this.createDragImage(this.draggedTab);
        
        this.createPlaceholder();
        
        this.draggedTab.classList.add('dragging');
        this.draggedTab.style.opacity = '0.3';
        
        const x = clientX - this.dragOffsetX;
        this.dragImage.style.left = `${x}px`;
        this.dragImage.style.transition = 'none';
        
        this.updateTabPosition(clientX);
    }

    createDragImage(tab) {
        this.dragImage = tab.cloneNode(true);
        this.dragImage.style.position = 'fixed';
        this.dragImage.style.top = `${tab.getBoundingClientRect().top}px`;
        this.dragImage.style.left = '0';
        this.dragImage.style.width = `${tab.offsetWidth}px`;
        this.dragImage.style.height = `${tab.offsetHeight}px`;
        this.dragImage.style.zIndex = '10000';
        this.dragImage.style.opacity = '0.9';
        this.dragImage.style.pointerEvents = 'none';
        this.dragImage.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        this.dragImage.classList.add('dragging');
        
        // УБИРАЕМ класс active и ВОССТАНАВЛИВАЕМ нормальные цвета
        this.dragImage.classList.remove('active');
        
        // Восстанавливаем нормальные цвета текста
        const tabText = this.dragImage.querySelector('.nav-tab-text');
        if (tabText) {
            tabText.style.color = '';
        }
        
        // Восстанавливаем нормальные цвета иконок
        const isConf = tab.dataset.filename.endsWith('.conf') || tab.dataset.filename.includes('.conf-');
        const isList = tab.dataset.filename.endsWith('.list') || tab.dataset.filename.includes('.list-');
        const isLog = tab.dataset.filename.endsWith('.log');
        
        // Убираем фильтр invert для иконок в драг-изображении
        if (isConf || isList || isLog) {
            const pseudoElement = window.getComputedStyle(tab, '::before');
            const bgImage = pseudoElement.backgroundImage;
            
            // Создаем новый элемент для иконки
            const icon = document.createElement('span');
            icon.style.position = 'absolute';
            icon.style.left = '8px';
            icon.style.top = '50%';
            icon.style.transform = 'translateY(-50%)';
            icon.style.width = '14px';
            icon.style.height = '14px';
            icon.style.backgroundImage = bgImage;
            icon.style.backgroundSize = 'contain';
            icon.style.backgroundRepeat = 'no-repeat';
            icon.style.backgroundPosition = 'center';
            
            // Применяем соответствующий фильтр в зависимости от типа файла
            if (isConf) {
                icon.style.filter = 'invert(43%) sepia(98%) saturate(2294%) hue-rotate(191deg) brightness(101%) contrast(101%)';
            } else if (isList) {
                icon.style.filter = 'invert(53%) sepia(91%) saturate(392%) hue-rotate(88deg) brightness(97%) contrast(86%)';
            } else if (isLog) {
                icon.style.filter = 'invert(58%) sepia(89%) saturate(576%) hue-rotate(1deg) brightness(102%) contrast(101%)';
            }
            
            // Удаляем псевдоэлемент и добавляем реальный элемент
            this.dragImage.style.paddingLeft = '32px';
            
            const existingIcon = this.dragImage.querySelector('.drag-icon');
            if (existingIcon) existingIcon.remove();
            
            icon.className = 'drag-icon';
            this.dragImage.appendChild(icon);
        }
        
        // Восстанавливаем иконки удаления/очистки
        const trashIcon = this.dragImage.querySelector('.nav-trash img');
        if (trashIcon) {
            trashIcon.style.filter = 'invert(16%) sepia(99%) saturate(2554%) hue-rotate(0deg) brightness(100%) contrast(114%)';
        }
        
        const clearIcon = this.dragImage.querySelector('.nav-clear img');
        if (clearIcon) {
            clearIcon.style.filter = 'invert(58%) sepia(89%) saturate(576%) hue-rotate(1deg) brightness(102%) contrast(101%)';
        }
        
        // Убираем иконки действий
        const trash = this.dragImage.querySelector('.nav-trash');
        const clear = this.dragImage.querySelector('.nav-clear');
        if (trash) trash.remove();
        if (clear) clear.remove();
        
        document.body.appendChild(this.dragImage);
    }

    createPlaceholder() {
        this.placeholder = document.createElement('div');
        this.placeholder.style.width = `${this.draggedTab.offsetWidth}px`;
        this.placeholder.style.height = `${this.draggedTab.offsetHeight}px`;
        this.placeholder.style.flexShrink = '0';
        this.placeholder.style.margin = '0 4px';
        this.tabsContainer.insertBefore(this.placeholder, this.draggedTab);
    }

    updateTabPosition(clientX) {
        if (!this.isDragging || !this.draggedTab || !this.placeholder) return;
        
        const tabs = Array.from(this.tabsContainer.querySelectorAll('.nav-tab:not(.dragging)'));
        
        tabs.forEach(tab => tab.classList.remove('drag-hover'));
        
        let insertIndex = -1;
        
        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i];
            const rect = tab.getBoundingClientRect();
            
            if (clientX < rect.left + rect.width / 2) {
                insertIndex = i;
                tab.classList.add('drag-hover');
                break;
            }
        }
        
        if (insertIndex === -1 && tabs.length > 0) {
            insertIndex = tabs.length;
            const lastTab = tabs[tabs.length - 1];
            lastTab.classList.add('drag-hover');
        }
        
        const referenceTab = tabs[insertIndex];
        if (referenceTab) {
            this.tabsContainer.insertBefore(this.placeholder, referenceTab);
        } else {
            this.tabsContainer.appendChild(this.placeholder);
        }
    }

    onMouseUp() {
        if (this.isDragging) {
            this.finishDrag();
        } else {
            if (this.draggedTab && this.ui && this.ui.loadFile) {
                this.ui.loadFile(this.draggedTab.dataset.filename);
            }
        }
        
        this.cleanup();
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }

    onTouchEnd() {
        if (this.isDragging) {
            this.finishDrag();
        } else {
            if (this.draggedTab && this.ui && this.ui.loadFile) {
                this.ui.loadFile(this.draggedTab.dataset.filename);
            }
        }
        
        this.cleanup();
        document.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('touchend', this.onTouchEnd);
    }

    finishDrag() {
        if (this.placeholder && this.draggedTab) {
            this.placeholder.parentNode.insertBefore(this.draggedTab, this.placeholder);
            this.saveTabsOrder();
        }
    }

    cleanup() {
        if (this.draggedTab) {
            this.draggedTab.classList.remove('dragging');
            this.draggedTab.style.opacity = '';
        }
        
        const tabs = this.tabsContainer.querySelectorAll('.nav-tab');
        tabs.forEach(tab => tab.classList.remove('drag-hover'));
        
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.remove();
        }
        
        if (this.dragImage && this.dragImage.parentNode) {
            this.dragImage.remove();
        }
        
        this.draggedTab = null;
        this.dragImage = null;
        this.placeholder = null;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragOffsetX = 0;
    }
}