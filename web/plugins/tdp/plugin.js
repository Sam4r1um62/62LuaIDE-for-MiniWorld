/**
 * =================================================================
 * SMWE 统一插件加载文件
 * GM2H Developer Mode - Refactored Version
 * 
 * 此文件包含 DataPlus, Directory Switcher, DPS Rank, 和 Sidecar 插件。
 * 所有插件逻辑均被安全地封装在 'smwe:ready' 事件监听器中，
 * 以确保在执行任何插件代码前，主应用程序的 API 均已就绪。
 * =================================================================
 */

document.addEventListener('smwe:ready', (event) => {
    // API 代理，确保可以从 event.detail 或全局 window 对象获取
    const api = new Proxy({}, {
        get: function(target, prop) {
            // 优先使用事件传递的 API，其次是全局 API
            return (event.detail.api || window.SMWE_API)[prop];
        }
    });

    if (!api || !api.plugins) {
        console.error('SMWE Plugins: Critical error - API is not available even after smwe:ready event.');
        return;
    }

    api.log('INFO', 'SMWE is ready. Initializing all plugins...');

    // =================================================================
    // Plugin: DataPlus (v2) - COMPLETE & UNABRIDGED
    // =================================================================
    (() => {
        api.log('INFO', 'Initializing DataPlus Plugin...');
 
        // --- 状态与配置 ---
        const state = {
            itemDataCache: {},
            compareList: [], // 最多8个
            linkedFiles: {},
            currentFilename: null
        };
        const MAX_COMPARE_ITEMS = 8;
        const COLOR_SCALE = ['#343a40', '#198754', '#20c997', '#0d6efd', '#6f42c1', '#ffc107', '#fd7e14', '#dc3545'];
        const NUMERIC_KEYS = [
            'attack', 'attackFire', 'attackIce', 'attackMagic', 'attackPoison', 'attackWither',
            'tool_duration', 'tool_efficient', 'gun_attack', 'fire_interval', 'magazines', 'weight',
            'projectile_attack', 'speed_init', 'gravity', 'EquipArmorPhysical', 'EquipArmorBurn',
            'EquipArmorChaos', 'EquipArmorExplosion', 'EquipArmorMagic', 'EquipArmorPunch',
            'EquipArmorRange', 'EquipArmorToxin', 'EquipRepelRes', 'heal_actor', 'life', 'speed', 'dps'
        ];
 
        // --- UI 元素 ---
        let tooltipTimeout = null;
        let tooltipElement, contextMenuElement, compareOverlayElement;
 
        // --- 功能一：快速预览 ---
        function initializeTooltip() { if (!tooltipElement) { tooltipElement = document.createElement('div'); tooltipElement.id = 'dp-tooltip'; document.body.appendChild(tooltipElement); } }
        function bindPreviewEvents() { const el = document.getElementById('item-list-container'); if(el){ el.addEventListener('mouseenter', handleMouseEnter, true); el.addEventListener('mouseleave', handleMouseLeave, true); } }
        function handleMouseEnter(e) { const li = e.target.closest('li'); if (!li) return; if (li.closest('.item-group')?.dataset.groupName?.toLowerCase().includes('crafting')) return; clearTimeout(tooltipTimeout); const fn = li.dataset.filename; if (!fn) return; tooltipTimeout = setTimeout(() => showTooltip(fn, e.clientX, e.clientY), 300); }
        function handleMouseLeave(e) { const li = e.target.closest('li'); if (li) { clearTimeout(tooltipTimeout); hideTooltip(); } }
        async function showTooltip(filename, x, y) { try { let data = state.itemDataCache[filename]; if (!data) { data = await api.eel.get_item_data(filename)(); if (data.error) throw new Error(data.error); state.itemDataCache[filename] = data; } const html = await generateTooltipHTML(data); if (!html) return; tooltipElement.innerHTML = html; positionTooltip(x, y); tooltipElement.classList.add('visible'); } catch (err) { api.log('ERROR', `DP Preview Error (${filename}):`, err); } }
        function hideTooltip() { if (tooltipElement) tooltipElement.classList.remove('visible'); }
        function positionTooltip(x, y) { requestAnimationFrame(() => { const rect = tooltipElement.getBoundingClientRect(); let top = y + 20, left = x + 20; if (top + rect.height > window.innerHeight) top = y - rect.height - 20; if (left + rect.width > window.innerWidth) left = x - rect.width - 20; tooltipElement.style.top = `${top}px`; tooltipElement.style.left = `${left}px`; }); }
        async function getProjectileData(orignid) { const key = `proj_${orignid}`; if (state.itemDataCache[key]) return state.itemDataCache[key]; try { const data = await api.eel.get_item_data_by_orignid(orignid)(); if (data && !data.error) { state.itemDataCache[key] = data; return data; } } catch (e) { api.log('ERROR', `DP getProjectileData Error (${orignid}):`, e); } return null; }
        async function generateTooltipHTML(data) { const prop = data.property || data.item_property || {}; const trans = api.getTranslations(); let content = `<h4>${prop.name || '未知物品'}</h4>`; let props = []; if (prop.orignid) props.push({ k: 'orignid', v: prop.orignid }); if (prop.gun_attack) { ['fire_interval', 'weight', 'magazines', 'gun_attack', 'bullet_id'].forEach(k => { if (prop[k] !== undefined) props.push({ k, v: prop[k] }); }); if (prop.fire_interval > 0 && prop.bullet_id) { const pData = await getProjectileData(prop.bullet_id); const pAtk = pData?.property?.projectile_attack || 0; const dps = ((prop.gun_attack || 0) + pAtk) * (1000 / prop.fire_interval); props.push({ k: 'dps', v: dps.toFixed(2), c: 'dps' }); } } if (prop.aiconfig_type) ['attack', 'speed', 'life'].forEach(k => { if (prop[k] !== undefined) props.push({ k, v: prop[k] }); }); Object.keys(prop).forEach(k => { if ((k.startsWith('attack') && k !== 'gun_attack' && prop[k] > 0) || (k.startsWith('EquipArmor') && prop[k] > 0)) { if (!props.some(p => p.k === k)) props.push({ k, v: prop[k] }); } }); if (props.length === 0) return null; props.forEach(p => { content += `<div class="dp-prop"><span class="dp-prop-name">${trans[p.k] || p.k}</span><span class="dp-prop-value ${p.c || ''}">${p.v}</span></div>`; }); let desc = prop.describe; if (prop.multilangdesc) { try { desc = Object.values(JSON.parse(prop.multilangdesc).textList)[0]; } catch (e) {} } if (desc) content += `<div class="dp-describe">${desc.split('\n')[0]}</div>`; return content; }
 
        // --- 功能二：多物品对比 ---
        function initializeCompareWindow() {
            if (document.getElementById('dp-compare-overlay')) return;
            const windowHTML = `<div id="dp-compare-overlay" style="display:none;"><div id="dp-compare-window"><div id="dp-compare-header"><h3>DataPlus 物品对比</h3><div id="dp-compare-controls"><button id="dp-clear-compare-btn" title="清空对比">✖</button><button id="dp-close-compare-btn" title="关闭窗口">&times;</button></div></div><div id="dp-compare-content"></div></div></div>`;
            document.body.insertAdjacentHTML('beforeend', windowHTML);
            compareOverlayElement = document.getElementById('dp-compare-overlay');
            const compareWindow = document.getElementById('dp-compare-window');
            const header = document.getElementById('dp-compare-header');
            document.getElementById('dp-close-compare-btn').addEventListener('click', hideCompareWindow);
            document.getElementById('dp-clear-compare-btn').addEventListener('click', clearCompare);
            let isDragging = false, offsetX, offsetY;
            header.addEventListener('mousedown', (e) => { isDragging = true; offsetX = e.clientX - compareWindow.offsetLeft; offsetY = e.clientY - compareWindow.offsetTop; document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); });
            function onMouseMove(e) { if (!isDragging) return; compareWindow.style.left = `${e.clientX - offsetX}px`; compareWindow.style.top = `${e.clientY - offsetY}px`; }
            function onMouseUp() { isDragging = false; document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
        }
        function showCompareWindow() { compareOverlayElement.style.display = 'flex'; }
        function hideCompareWindow() { compareOverlayElement.style.display = 'none'; }
        function initializeContextMenu() {
            if (document.getElementById('dp-context-menu')) return;
            const menuHTML = `<div id="dp-context-menu"><ul><li id="dp-add-to-compare">添加到对比</li><li id="dp-clear-compare-ctx">清空对比列表</li></ul></div>`;
            document.body.insertAdjacentHTML('beforeend', menuHTML);
            contextMenuElement = document.getElementById('dp-context-menu');
            document.getElementById('item-list-container').addEventListener('contextmenu', showContextMenu);
            document.addEventListener('click', () => contextMenuElement.style.display = 'none');
            document.getElementById('dp-add-to-compare').addEventListener('click', handleAddToCompare);
            document.getElementById('dp-clear-compare-ctx').addEventListener('click', clearCompare);
        }
        function showContextMenu(e) { const li = e.target.closest('li'); if (!li) return; e.preventDefault(); contextMenuElement.style.display = 'block'; contextMenuElement.style.top = `${e.clientY}px`; contextMenuElement.style.left = `${e.clientX}px`; contextMenuElement.dataset.filename = li.dataset.filename; }
        async function handleAddToCompare() {
            const filename = contextMenuElement.dataset.filename;
            if (!filename || state.compareList.includes(filename)) return;
            if (state.compareList.length >= MAX_COMPARE_ITEMS) { api.showToast(`对比列表已满 (最多${MAX_COMPARE_ITEMS}个)，请先清空。`, 'warn'); return; }
            state.compareList.push(filename);
            api.showToast(`“${filename}”已添加到对比列表 (${state.compareList.length}/${MAX_COMPARE_ITEMS})。`, 'info');
            renderComparePanel();
        }
        function clearCompare() { state.compareList = []; api.showToast('对比列表已清空。', 'info'); hideCompareWindow(); }
        
        async function renderComparePanel() {
            if (state.compareList.length === 0) {
                hideCompareWindow();
                return;
            }
            showCompareWindow();
            const content = document.getElementById('dp-compare-content');
            content.innerHTML = '正在加载对比数据...';
 
            const sidecarPlugin = api.plugins.get('sidecar');
 
            const itemObjects = await Promise.all(state.compareList.map(async (filename) => {
                let data = state.itemDataCache[filename];
                if (!data) {
                    data = await api.eel.get_item_data(filename)();
                    state.itemDataCache[filename] = data;
                }
                return { filename, data };
            }));
 
            const translations = api.getTranslations();
            const allProps = {};
            const allSidecarProps = {}; // 新增：用于存储所有附属属性
 
            // 收集所有属性并计算DPS
            for (const item of itemObjects) {
                const prop = item.data.property || item.data.item_property || {};
                
                if (prop.gun_attack && prop.fire_interval > 0 && prop.bullet_id) {
                    const pData = await getProjectileData(prop.bullet_id);
                    const pAtk = pData?.property?.projectile_attack || 0;
                    prop.dps = ((prop.gun_attack || 0) + pAtk) * (1000 / prop.fire_interval);
                }
 
                item.props = prop;
                Object.keys(prop).forEach(key => {
                    if (!allProps[key]) allProps[key] = [];
                    allProps[key].push(prop[key]);
                });
 
                // 获取并存储附属属性
                if (sidecarPlugin) {
                    const sidecarData = await sidecarPlugin.getSidecarDataFor(item.filename);
                    item.sidecarProps = sidecarData || {};
                    if (sidecarData) {
                        Object.keys(sidecarData).forEach(key => {
                            if (!allSidecarProps[key]) allSidecarProps[key] = [];
                            allSidecarProps[key].push(sidecarData[key]);
                        });
                    }
                }
            }
            
            let tableHTML = '<table id="dp-compare-table"><thead><tr><th>属性</th>';
            for (const item of itemObjects) {
                const name = item.props.name || item.filename;
                tableHTML += `<th>${name}</th>`;
            }
            tableHTML += '</tr></thead><tbody>';
 
            // 构建主属性表格内容
            const sortedKeys = Object.keys(allProps).sort();
            for (const key of sortedKeys) {
                const translatedKey = translations[key] || key;
                tableHTML += `<tr><th>${translatedKey}</th>`;
                
                let values = itemObjects.map(item => item.props[key]);
                let colorClasses = '';
 
                if (NUMERIC_KEYS.includes(key) && state.compareList.length > 1) {
                    const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
                    if (numericValues.length > 1) {
                        const min = Math.min(...numericValues);
                        const max = Math.max(...numericValues);
                        colorClasses = values.map(v => {
                            const numV = parseFloat(v);
                            if (isNaN(numV)) return '';
                            if (max === min) return 'dp-color-0 dp-color-text';
                            const ratio = (numV - min) / (max - min);
                            const colorIndex = Math.round(ratio * (COLOR_SCALE.length - 1));
                            return `dp-color-${colorIndex} dp-color-text`;
                        });
                    }
                }
 
                for (let i = 0; i < itemObjects.length; i++) {
                    const value = itemObjects[i].props[key];
                    const displayValue = value !== undefined ? (typeof value === 'object' ? JSON.stringify(value) : value) : '—';
                    const className = colorClasses[i] || '';
                    tableHTML += `<td class="${className}">${displayValue}</td>`;
                }
                tableHTML += '</tr>';
            }
 
            // 构建附属属性表格内容
            const sortedSidecarKeys = Object.keys(allSidecarProps).sort();
            if (sortedSidecarKeys.length > 0) {
                tableHTML += `<tr class="sidecar-prop"><th colspan="${itemObjects.length + 1}">附属属性</th></tr>`;
                
                for (const key of sortedSidecarKeys) {
                    tableHTML += `<tr class="sidecar-prop"><th>${key}</th>`;
                    for (let i = 0; i < itemObjects.length; i++) {
                        const value = itemObjects[i].sidecarProps ? itemObjects[i].sidecarProps[key] : undefined;
                        const displayValue = value !== undefined ? value : '—';
                        tableHTML += `<td>${displayValue}</td>`;
                    }
                    tableHTML += '</tr>';
                }
            }
 
            tableHTML += '</tbody></table>';
            content.innerHTML = tableHTML;
        }
 
        // --- 初始化与注册 ---
        initializeTooltip();
        initializeCompareWindow();
        initializeContextMenu();
        bindPreviewEvents();
        api.plugins.register('data_plus', {
            addToCompare: (filename) => {
                if (!filename || state.compareList.includes(filename)) return;
                if (state.compareList.length >= MAX_COMPARE_ITEMS) {
                    api.showToast(`对比列表已满。`, 'warn');
                    return;
                }
                state.compareList.push(filename);
                renderComparePanel();
            }
        });
        api.log('SUCCESS', 'DataPlus Plugin (Compare v2) initialized successfully.');
    })();

    // =================================================================
    // Plugin: Directory Switcher
    // =================================================================
    (() => {
        api.log('INFO', 'Initializing Directory Switcher Plugin...');

        const DIRS = ['item', 'block', 'actor', 'crafting','status'];
        let parentPath = null;
        let currentIdMap = {};

        function getParentPath(fullPath) {
            if (!fullPath) return null;
            const normalizedPath = fullPath.replace(/\\/g, '/');
            for (const dir of DIRS) {
                if (normalizedPath.toLowerCase().endsWith(`/${dir.toLowerCase()}`)) {
                    return normalizedPath.substring(0, normalizedPath.length - dir.length - 1);
                }
            }
            return null;
        }

        async function updateActiveButtonState() {
            const settings = await api.eel.get_settings()();
            const currentPath = settings.data_path;
            parentPath = getParentPath(currentPath);
            const buttons = document.querySelectorAll('.dir-switcher-btn');
            buttons.forEach(btn => {
                const btnDir = btn.dataset.dir;
                const expectedPath = parentPath ? `${parentPath}/${btnDir}`.toLowerCase() : '';
                const currentNormalizedPath = currentPath ? currentPath.replace(/\\/g, '/').toLowerCase() : '';
                btn.classList.toggle('active', parentPath && currentNormalizedPath === expectedPath);
            });
        }

        async function handleSwitchDirectory(dirName) {
            if (!parentPath) { api.showToast('无法确定父目录！', 'error'); return; }
            const newPath = `${parentPath}/${dirName}`;
            const dataPathInput = document.getElementById('settings-data-path');
            if (dataPathInput) dataPathInput.value = newPath;
            if (window.globalSaveSettings) await window.globalSaveSettings();
        }

        function initializeUI() {
            const sidebar = document.querySelector('.sidebar');
            if (!sidebar) { api.log('ERROR', 'Directory Switcher: .sidebar 元素未找到！'); return; }
            const pluginContainer = document.createElement('div');
            pluginContainer.id = 'directory-switcher-container';
            const topRow = document.createElement('div');
            topRow.id = 'ds-top-row';
            pluginContainer.appendChild(topRow);
            const dirSwitcher = document.createElement('div');
            dirSwitcher.id = 'ds-dir-switcher';
            DIRS.forEach(dir => {
                const button = document.createElement('button');
                button.className = 'btn btn-sm dir-switcher-btn';
                button.dataset.dir = dir;
                button.textContent = dir.charAt(0).toUpperCase() + dir.slice(1);
                button.addEventListener('click', () => handleSwitchDirectory(dir));
                dirSwitcher.appendChild(button);
            });
            pluginContainer.appendChild(dirSwitcher);
            sidebar.prepend(pluginContainer);
            updateActiveButtonState();
            const itemListContainer = document.getElementById('item-list-container');
            if (itemListContainer) {
                new MutationObserver(updateActiveButtonState).observe(itemListContainer, { childList: true });
            }
        }

        const pluginAPI = {
            addAnalysisButton(buttonElement) {
                const topRow = document.querySelector('#ds-top-row');
                if (topRow) { topRow.prepend(buttonElement); return true; }
                return false;
            }
        };

        initializeUI();
        api.plugins.register('directory_switcher', pluginAPI);
        
        // 异步发出 ready 事件，确保其他插件可以监听到
        setTimeout(() => {
            api.eventBus.emit('directory_switcher:ready', {});
            api.log('INFO', 'Directory Switcher has emitted its ready event.');
        }, 0);

        api.log('SUCCESS', 'Directory Switcher Plugin initialized successfully.');
    })();

    // =================================================================
    // Plugin: DPS Rank
    // =================================================================
    (() => {
        api.log('INFO', 'Initializing DPS Rank Plugin...');

        let dpsDataCache = null;
        let currentSort = { key: 'dps', order: 'desc' };

        function initializeWindow() {
            if (document.getElementById('dps-rank-window-overlay')) return;
            const windowHTML = `<div id="dps-rank-window-overlay" style="display:none;"><div id="dps-rank-window"><div id="dps-rank-header"><h3>枪械DPS排行榜</h3><div id="dps-rank-controls"><button id="dps-refresh-btn" title="强制刷新" class="btn btn-sm">Re</button><button id="dps-close-btn" title="关闭窗口">&times;</button></div></div><div id="dps-rank-content"><div id="dps-rank-status">点击“Re”按钮开始扫描...</div><table id="dps-rank-table" style="display:none;"><thead><tr><th data-key="rank">#</th><th data-key="name">名称</th><th data-key="gun_attack">枪械伤害</th><th data-key="projectile_attack">子弹伤害</th><th data-key="fire_rate">射速(发/秒)</th><th data-key="dps">DPS</th></tr></thead><tbody></tbody></table></div></div></div>`;
            document.body.insertAdjacentHTML('beforeend', windowHTML);
            setupWindowInteractions();
        }
        
        function setupWindowInteractions() {
            const overlay = document.getElementById('dps-rank-window-overlay');
            const windowEl = document.getElementById('dps-rank-window');
            const header = document.getElementById('dps-rank-header');
            document.getElementById('dps-close-btn').addEventListener('click', () => overlay.style.display = 'none');
            document.getElementById('dps-refresh-btn').addEventListener('click', () => calculateAndShowDps(true));
            document.querySelectorAll('#dps-rank-table thead th').forEach(th => {
                th.addEventListener('click', () => {
                    const key = th.dataset.key;
                    if (key) {
                        if (currentSort.key === key) {
                            currentSort.order = currentSort.order === 'desc' ? 'asc' : 'desc';
                        } else {
                            currentSort.key = key;
                            currentSort.order = 'desc';
                        }
                        renderTable(dpsDataCache);
                    }
                });
            });
            let isDragging = false, offsetX, offsetY;
            header.onmousedown = (e) => { isDragging = true; offsetX = e.clientX - windowEl.offsetLeft; offsetY = e.clientY - windowEl.offsetTop; document.onmousemove = (ev) => { if (isDragging) { windowEl.style.left = `${ev.clientX - offsetX}px`; windowEl.style.top = `${ev.clientY - offsetY}px`; } }; document.onmouseup = () => { isDragging = false; document.onmousemove = document.onmouseup = null; }; };
        }

        function toggleDpsWindow() {
            const overlay = document.getElementById('dps-rank-window-overlay');
            const isHidden = overlay.style.display === 'none';
            overlay.style.display = isHidden ? 'flex' : 'none';
            if (isHidden && !dpsDataCache) calculateAndShowDps();
        }

        async function calculateAndShowDps(forceRefresh = false) {
            if (dpsDataCache && !forceRefresh) { renderTable(dpsDataCache); return; }
            if (typeof api.eel.get_all_items_data !== 'function') { updateStatus('错误：后端缺少 get_all_items_data 函数支持。'); return; }
            updateStatus('正在扫描所有物品文件...');
            api.showToast('正在扫描计算DPS...', 'info');
            try {
                const allData = await api.eel.get_all_items_data()();
                if (allData.error) { updateStatus(`错误: ${allData.error}`); return; }
                updateStatus(`扫描完成！发现 ${allData.length} 个文件，正在计算...`);
                const gunPromises = allData
                    .filter(item => item.data && (item.data.property?.gun_attack || item.data.item_property?.gun_attack))
                    .map(item => {
                        const prop = item.data.property || item.data.item_property;
                        const fireInterval = prop.fire_interval || 0;
                        if (fireInterval > 0) {
                            let projectileAttack = 0;
                            if (prop.bullet_id) {
                                const projectile = allData.find(p => (p.data.property?.orignid || p.data.item_property?.orignid) == prop.bullet_id);
                                if (projectile) projectileAttack = (projectile.data.property || projectile.data.item_property)?.projectile_attack || 0;
                            }
                            let finalFireInterval = fireInterval;
                            if (prop.continuous_fire === 2) finalFireInterval += 500; // 栓动惩罚
                            const dps = finalFireInterval > 0 ? (((prop.gun_attack || 0) + projectileAttack) * (1000 / finalFireInterval)) : 0;
                            return { filename: item.filename, name: prop.name || item.filename, gun_attack: prop.gun_attack || 0, projectile_attack: projectileAttack, fire_rate: (finalFireInterval > 0 ? (1000 / finalFireInterval) : 0), dps: dps, continuous_fire: prop.continuous_fire };
                        }
                        return null;
                    });
                const results = (await Promise.all(gunPromises)).filter(Boolean);
                dpsDataCache = results;
                api.showToast(`DPS计算完成，共找到 ${results.length} 把枪械。`, 'success');
                renderTable(results);
            } catch (err) {
                 api.showToast(`DPS计算出错: ${err.message}`, 'error');
                 updateStatus(`计算出错: ${err.message}`);
            }
        }

        function renderTable(data) {
            const tbody = document.querySelector('#dps-rank-table tbody');
            const table = document.getElementById('dps-rank-table');
            if (!data || data.length === 0) { updateStatus('未找到任何可计算DPS的枪械。'); return; }
            data.sort((a, b) => {
                const valA = a[currentSort.key];
                const valB = b[currentSort.key];
                const order = currentSort.order === 'asc' ? 1 : -1;
                if (typeof valA === 'string') return valA.localeCompare(valB) * order;
                return (valA - valB) * order;
            });
            tbody.innerHTML = '';
            data.forEach((gun, index) => {
                const row = document.createElement('tr');
                row.dataset.filename = gun.filename;
                let nameHtml = gun.name;
                if (gun.continuous_fire === 0) nameHtml += ' <span style="color: #0d6efd; font-size: 0.8em; font-weight: normal;">[半自动]</span>';
                else if (gun.continuous_fire === 2) nameHtml += ' <span style="color: #6c757d; font-size: 0.8em; font-weight: normal;">[栓动]</span>';
                row.innerHTML = `<td class="col-rank">${index + 1}</td><td>${nameHtml}</td><td>${gun.gun_attack}</td><td>${gun.projectile_attack}</td><td>${gun.fire_rate.toFixed(2)}</td><td class="col-dps">${gun.dps.toFixed(2)}</td>`;
                row.addEventListener('click', () => { const li = document.querySelector(`.item-list-container li[data-filename="${gun.filename}"]`); if (li) { li.click(); li.scrollIntoView({ behavior: 'smooth', block: 'center' }); toggleDpsWindow(); } else api.showToast(`错误：列表中找不到 ${gun.filename}。`, 'error'); });
                tbody.appendChild(row);
            });
            table.style.display = '';
            document.getElementById('dps-rank-status').style.display = 'none';
        }
        
        function updateStatus(text) { const statusEl = document.getElementById('dps-rank-status'); statusEl.textContent = text; statusEl.style.display = 'block'; document.getElementById('dps-rank-table').style.display = 'none'; }
        
        function createAndAddButton() {
            if (document.getElementById('dps-rank-btn')) return;
            const dpsButton = document.createElement('button');
            dpsButton.id = 'dps-rank-btn';
            dpsButton.className = 'btn btn-sm';
            dpsButton.textContent = 'DPS排行';
            dpsButton.title = '打开枪械DPS排行榜';
            dpsButton.addEventListener('click', toggleDpsWindow);
            
            const switcherPlugin = api.plugins.get('directory_switcher');
            if (switcherPlugin && typeof switcherPlugin.addAnalysisButton === 'function') {
                switcherPlugin.addAnalysisButton(dpsButton);
                api.log('INFO', 'DPS Rank button attached via Directory Switcher API.');
            } else {
                api.log('WARN', 'DPS Rank plugin could not find Directory Switcher API, using fallback UI injection.');
                const headerButtons = document.querySelector('.sidebar-header .header-buttons');
                if (headerButtons) headerButtons.prepend(dpsButton);
            }
        }
        
        initializeWindow();
        api.plugins.register('dps_rank', { openWindow: toggleDpsWindow });

        // 监听 Directory Switcher 的 ready 事件来添加按钮
        api.eventBus.on('directory_switcher:ready', createAndAddButton);
        
        // 设置一个备用超时，以防事件因任何原因被错过
        setTimeout(() => {
            if (!document.getElementById('dps-rank-btn')) {
                api.log('WARN', 'DPS Rank did not receive ready event, attempting to add button via timeout.');
                createAndAddButton();
            }
        }, 200);

        api.log('SUCCESS', 'DPS Rank Plugin initialized and is waiting for signals.');
    })();

    // =================================================================
    // Plugin: Sidecar
    // =================================================================
    (() => {
        api.log('INFO', 'Initializing Sidecar Plugin...');

        let sidecarLinks = {};
        let currentMainFile = null;

        const editorHook = document.getElementById('plugin-hooks-area');
        if (!editorHook) {
            api.log('ERROR', 'Sidecar: #plugin-hooks-area not found. Cannot inject UI.');
            return;
        }

        const container = document.createElement('div');
        container.id = 'sidecar-container';
        editorHook.appendChild(container);

        async function initialize() {
            sidecarLinks = await api.eel.get_sidecar_links()();
            api.eventBus.on('item:loaded', handleItemLoaded);
            api.log('SUCCESS', 'Sidecar Plugin initialized successfully.');
        }

        async function renderUI() {
            if (!currentMainFile) {
                container.innerHTML = '';
                return;
            }
            
            const manualLink = sidecarLinks[currentMainFile];
            let finalPath = manualLink;
            let isAutoLink = false;
 
            // 如果没有手动链接，才去检查自动链接
            if (!manualLink) {
                const autoPath = await api.eel.get_autolink_for_file(currentMainFile)();
                if (autoPath) {
                    finalPath = autoPath;
                    isAutoLink = true;
                }
            }
            
            const hasLink = !!finalPath;
            const filePathForDisplay = hasLink ? finalPath : '未关联附属文件';
            const linkStatusText = isAutoLink ? ' <span style="color: var(--text-muted); font-style: italic;">(自动关联)</span>' : '';
 
            container.innerHTML = `
                <div id="sidecar-header">
                    <h4>★ 附属文件属性${linkStatusText}</h4>
                    <div id="sidecar-controls">
                        ${!isAutoLink ? `<button id="sidecar-link-btn" class="btn btn-sm">${manualLink ? '更改' : '关联'}文件</button>` : ''}
                        ${manualLink ? '<button id="sidecar-unlink-btn" class="btn btn-sm btn-danger">解除关联</button>' : ''}
                    </div>
                </div>
                <div id="sidecar-path-display" title="点击可尝试在系统中打开">${filePathForDisplay}</div>
                <div id="sidecar-content"><div class="placeholder">${hasLink ? '正在加载...' : '请先关联一个文件。'}</div></div>
            `;
 
            // 绑定事件
            const linkBtn = document.getElementById('sidecar-link-btn');
            const unlinkBtn = document.getElementById('sidecar-unlink-btn');
            const pathDisplay = document.getElementById('sidecar-path-display');
 
            if (linkBtn) linkBtn.addEventListener('click', linkFile);
            if (unlinkBtn) unlinkBtn.addEventListener('click', unlinkFile);
            if (hasLink && pathDisplay) pathDisplay.addEventListener('click', () => api.eel.open_external_file(finalPath)());
            
            if (hasLink) {
                // 决定传递给后端的标识符
                const identifierForBackend = manualLink ? manualLink : currentMainFile;
                loadAndDisplaySidecarContent(identifierForBackend);
            }
        }
        
        async function handleItemLoaded(itemData) {
            currentMainFile = itemData.filename;
            await renderUI();
        }

        async function linkFile() {
            const newPath = prompt("请输入附属文件的完整路径:", sidecarLinks[currentMainFile] || '');
            if (newPath && newPath.trim()) {
                sidecarLinks[currentMainFile] = newPath.trim();
                await api.eel.save_sidecar_links(sidecarLinks)();
                api.showToast('附属文件已关联。', 'success');
                renderUI();
            }
        }

        async function unlinkFile() {
            if (confirm(`确定要解除对 "${currentMainFile}" 的附属文件关联吗？`)) {
                delete sidecarLinks[currentMainFile];
                await api.eel.save_sidecar_links(sidecarLinks)();
                api.showToast('关联已解除。', 'info');
                renderUI();
            }
        }

        async function loadAndDisplaySidecarContent(identifier) {
            const contentEl = document.getElementById('sidecar-content');
            if (!contentEl) return; // 防御性编程
            contentEl.innerHTML = '正在加载附属文件...';
            
            try {
                const result = await api.eel.read_sidecar_file_content(identifier)();
 
                if (result.error) {
                    contentEl.innerHTML = `<div class="placeholder" style="color: red;">加载失败: ${result.error}</div>`;
                    return;
                }
 
                contentEl.innerHTML = '';
                if (result.type === '.json') {
                    try {
                        const data = JSON.parse(result.content);
                        Object.entries(data).forEach(([key, value]) => {
                            const formGroup = document.createElement('div');
                            formGroup.className = 'form-group';
                            formGroup.innerHTML = `<label>${key}</label><span>${value}</span>`;
                            contentEl.appendChild(formGroup);
                        });
                    } catch (e) {
                        contentEl.innerHTML = `<div class="placeholder" style="color: red;">JSON 解析失败: ${e.message}</div>`;
                    }
                } else {
                    const textarea = document.createElement('textarea');
                    textarea.readOnly = true;
                    textarea.value = result.content;
                    contentEl.appendChild(textarea);
                }
            } catch (error) {
                api.log('ERROR', 'Sidecar: read_sidecar_file_content call failed.', error);
                contentEl.innerHTML = `<div class="placeholder" style="color: red;">与后端通信失败，请查看日志。</div>`;
            }
        }

        // 插件 API 暴露
        const pluginAPI = {
            async getSidecarDataFor(filename) {
                const manualLink = sidecarLinks[filename];
                const identifier = manualLink ? manualLink : filename;
 
                // 我们不能直接调用后端的 read_sidecar_file_content，因为它可能因为找不到文件而报错
                // 所以我们先判断文件是否存在
                let filePath = manualLink;
                if (!filePath) {
                    filePath = await api.eel.get_autolink_for_file(filename)();
                }
 
                if (!filePath) return null;
 
                const result = await api.eel.read_sidecar_file_content(filePath)(); // 使用真实路径调用
                if (result.success && result.type === '.json') {
                    try {
                        return JSON.parse(result.content);
                    } catch { return null; }
                } else if (result.success) {
                    return { notes: result.content };
                }
                return null;
            }
        };

        api.plugins.register('sidecar', pluginAPI);
        initialize();
    })();

    api.log('SUCCESS', 'All plugins have been initialized.');
});
