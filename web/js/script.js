document.addEventListener('DOMContentLoaded', () => {
    let currentFilePath = null;
    let monacoEditor = null;
    let autoBackupFiles = new Set(); 
    
    let dirFlags = {}; 
    let customColors = {};  
    let colorNames = {};    

    let fcsDecorations = [];
    let blockColorDecorations = [];
    let activeFcsBlock = null; 
    let isApplyingFcs = false;

    let scannedPlugins = [];
    let iconCropQueue = [];

    const treeContainer = document.getElementById('file-tree-container');
    const cmdInput = document.getElementById('cmd-input');
    const terminalOutputEl = document.getElementById('terminal-output');
    const settingsModal = document.getElementById('settings-modal');

    // 右侧辅助面板
    const tabBrowser = document.getElementById('tab-browser');
    const tabMusic = document.getElementById('tab-music');
    const tabPlugins = document.getElementById('tab-plugins');
    const panelBrowser = document.getElementById('panel-browser');
    const panelMusic = document.getElementById('panel-music');
    const panelPlugins = document.getElementById('panel-plugins');
    const pluginMatrixGrid = document.getElementById('plugin-matrix-grid');

    const browserUrlInput = document.getElementById('browser-url');
    const browserIframe = document.getElementById('browser-iframe');
    const browserPlaceholder = document.getElementById('browser-placeholder');
    const browserGo = document.getElementById('browser-go');
    const chromeBookmarksSelect = document.getElementById('chrome-bookmarks-select');

    const musicIdInput = document.getElementById('music-id');
    const musicTypeSelect = document.getElementById('music-type');
    const musicPlayBtn = document.getElementById('music-play');
    const musicIframe = document.getElementById('music-iframe');

    // 截图与搜索 DOM 元素
    const screenshotOverlay = document.getElementById('screenshot-overlay');
    const countdownTimer = document.getElementById('countdown-timer');
    const searchModal = document.getElementById('search-modal');
    const searchPluginInput = document.getElementById('search-plugin-input');
    const searchResultsList = document.getElementById('search-results-list');

    const showToast = (msg, type = 'info') => {
        const c = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast ${type}`; t.textContent = msg;
        c.appendChild(t); setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
    };

    const printTerminal = (text) => {
        terminalOutputEl.textContent += text + "\n";
        terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight;
    };

    // --- 迷你世界插件加载并渲染方阵 ---
    const loadMiniWorldPlugins = async () => {
        const res = await eel.scan_mini_world_plugins()();
        if (res.error) {
            printTerminal(`[插件扫描] ${res.error}`);
            return;
        }
        scannedPlugins = res.plugins;
        printTerminal(`[插件扫描] 成功捕获到 ${scannedPlugins.length} 个迷你世界插件数据`);
        renderPluginMatrix();
    };

const renderPluginMatrix = () => {
        pluginMatrixGrid.innerHTML = '';
        
        let globalTooltip = document.getElementById('global-plugin-tooltip');
        if (!globalTooltip) {
            globalTooltip = document.createElement('div');
            globalTooltip.id = 'global-plugin-tooltip';
            globalTooltip.className = 'plugin-hover-tooltip';
            document.body.appendChild(globalTooltip);
        }

        scannedPlugins.forEach(p => {
            const card = document.createElement('div');
            card.className = 'plugin-card';
            
            // 核心：使用一致的正则表达式，过滤非主流/非法字符作为安全的本地文件名检索
            const safeIconName = p.icon.replace(/[^a-zA-Z0-9_\-]/g, '_');
            const imgPath = `icons/${safeIconName}.png?t=${new Date().getTime()}`;
            
            card.innerHTML = `
                <div class="plugin-icon-frame">
                    <img class="plugin-img" src="${imgPath}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <!-- fallback 区域依然保留显示最原始的 ID 名称，方便无图时人工核对 -->
                    <div class="plugin-icon-fallback" style="display:none; width:100%; height:100%; justify-content:center; align-items:center; background:#e5e5ea; color:#8e8e93; font-size:10px; font-weight:normal;">${p.icon}</div>
                </div>
                <div class="plugin-info">
                    <div class="plugin-name">${p.name}</div>
                    <div class="plugin-type-badge">${p.type}</div>
                </div>
            `;
            
            card.addEventListener('mouseenter', () => {
                globalTooltip.innerHTML = `
                    <div><strong>ID:</strong> ${p.id}</div>
                    <div><strong>名称:</strong> ${p.name}</div>
                    <div><strong>分类:</strong> ${p.type}</div>
                    <div class="tooltip-desc"><strong>描述:</strong> ${p.describe}</div>
                `;
                globalTooltip.classList.add('show');
                
                // 动态计算位置以防溢出
                const rect = card.getBoundingClientRect();
                
                // 给 globalTooltip 稍微定位到屏幕外以获取真实的宽度和高度 (防止初始宽高异常)
                let tooltipRect = globalTooltip.getBoundingClientRect();
                
                let top = rect.top - tooltipRect.height - 10;
                let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                
                // 上边缘溢出处理：如果上方空间不够，则显示在卡片下方
                if (top < 10) {
                    top = rect.bottom + 10;
                }
                
                // 左右边缘溢出处理
                if (left < 10) {
                    left = 10;
                } else if (left + tooltipRect.width > window.innerWidth - 10) {
                    left = window.innerWidth - tooltipRect.width - 10;
                }
                
                globalTooltip.style.top = top + 'px';
                globalTooltip.style.left = left + 'px';
            });
            
            card.addEventListener('mouseleave', () => {
                globalTooltip.classList.remove('show');
            });
            
            card.addEventListener('click', () => {
                insertTextToEditor(p.id);
                showToast(`已插入 ID: ${p.id}`, 'success');
            });
            pluginMatrixGrid.appendChild(card);
        });
    };

    // 暴露刷新方阵的命令给 Python 端，裁剪保存后即时同步刷新
    eel.expose(trigger_frontend_matrix_reload);
    function trigger_frontend_matrix_reload() {
        loadMiniWorldPlugins();
    }

    // 暴露终端打印接口，把 Python 原生悬浮胶囊的状态传回终端
    eel.expose(print_terminal_from_py);
    function print_terminal_from_py(msg) {
        printTerminal(msg);
    }

    // --- Ctrl+I 检索面板 ---
    let selectedSearchIndex = 0;
    const showSearchModal = () => {
        searchModal.classList.remove('hidden');
        searchPluginInput.value = '';
        filterSearchResults();
        setTimeout(() => {
            searchModal.classList.add('visible');
            searchPluginInput.focus();
        }, 50);
    };

    const filterSearchResults = () => {
        const query = searchPluginInput.value.toLowerCase().trim();
        const filtered = scannedPlugins.filter(p => 
            p.id.toString().includes(query) || p.name.toLowerCase().includes(query)
        );

        searchResultsList.innerHTML = '';
        selectedSearchIndex = 0;

        filtered.slice(0, 10).forEach((p, idx) => {
            const li = document.createElement('li');
            li.className = 'search-item';
            if (idx === 0) li.classList.add('selected');
            
            li.innerHTML = `
                <div class="search-item-title">
                    <span class="search-item-name">${p.name}</span>
                    <span class="search-item-id">ID: ${p.id}</span>
                </div>
                <span class="search-item-type">${p.type}</span>
            `;
            
            li.addEventListener('click', () => {
                insertTextToEditor(p.id);
                toggleSearchModal(false);
            });
            searchResultsList.appendChild(li);
        });
    };

    searchPluginInput.addEventListener('input', filterSearchResults);

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            if (searchModal.classList.contains('hidden')) showSearchModal();
            else toggleSearchModal(false);
        }

        if (searchModal.classList.contains('visible')) {
            const items = searchResultsList.querySelectorAll('.search-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                items[selectedSearchIndex].classList.remove('selected');
                selectedSearchIndex = (selectedSearchIndex + 1) % items.length;
                items[selectedSearchIndex].classList.add('selected');
                items[selectedSearchIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                items[selectedSearchIndex].classList.remove('selected');
                selectedSearchIndex = (selectedSearchIndex - 1 + items.length) % items.length;
                items[selectedSearchIndex].classList.add('selected');
                items[selectedSearchIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const activeItem = items[selectedSearchIndex];
                if (activeItem) {
                    const idText = activeItem.querySelector('.search-item-id').textContent.replace('ID: ', '');
                    insertTextToEditor(idText);
                    toggleSearchModal(false);
                }
            }
        }
        
        if (searchModal.classList.contains('visible') && e.key === 'Escape') {
            e.preventDefault();
            toggleSearchModal(false);
        }
    });

    const toggleSearchModal = (show) => {
        if (show) {
            searchModal.classList.remove('hidden');
            setTimeout(() => searchModal.classList.add('visible'), 10);
        } else {
            searchModal.classList.remove('visible');
            setTimeout(() => searchModal.classList.add('hidden'), 300);
            if(monacoEditor) monacoEditor.focus();
        }
    };

    const insertTextToEditor = (text) => {
        if (!monacoEditor) return;
        const selection = monacoEditor.getSelection();
        const range = new monaco.Range(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn);
        monacoEditor.executeEdits("insert", [{ range: range, text: text.toString(), forceMoveMarkers: true }]);
    };

    // --- 一键截图分配系统 (倒计时仅执行一次) ---
    const startIconMappingSession = () => {
        // 1. 自动聚合每一个 ICON ID 下所有对应的具体插件名称
        const iconsMap = {}; // icon_id -> Array of plugin names
        scannedPlugins.forEach(p => {
            if (p.icon && p.icon !== 'default') {
                if (!iconsMap[p.icon]) {
                    iconsMap[p.icon] = [];
                }
                // 收集对应此 icon 的所有插件名
                iconsMap[p.icon].push(p.name);
            }
        });

        iconCropQueue = [];
        for (let icon in iconsMap) {
            iconCropQueue.push({
                icon: icon,
                // 挑选前 3 个插件名字作为截图参考样本
                samples: iconsMap[icon].slice(0, 3).join(' | ') 
            });
        }
        
        if (!iconCropQueue.length) {
            printTerminal(`[截图标记] 当前没有需要抓取配对的 icon 标识`);
            return;
        }
        
        printTerminal(`[截图标记] 一键截图裁剪启动，共需处理 ${iconCropQueue.length} 个目标图标`);
        
        // 5s 前置倒计时：只在这里执行一次，留出时间切到游戏窗口
        screenshotOverlay.classList.remove('hidden');
        countdownTimer.style.display = 'block';
        
        let count = 5;
        countdownTimer.textContent = count;
        
        let timer = setInterval(async () => {
            count--;
            countdownTimer.textContent = count;
            if (count <= 0) {
                clearInterval(timer);
                screenshotOverlay.classList.add('hidden');
                countdownTimer.style.display = 'none';
                
                // 唤醒后台 Python 原生悬浮胶囊窗，并传入带有示例样本名称的数据
                eel.start_icon_session_py(iconCropQueue)();
            }
        }, 1000);
    };

    // --- 圈复杂度计算算法 ---
    const calculateCyclomaticComplexity = (text) => {
        let clean = text.replace(/--\[\[[\s\S]*?\]\]/g, '');
        clean = clean.replace(/--.*?\n/g, '\n');
        clean = clean.replace(/".*?"/g, '""');
        clean = clean.replace(/'.*?'/g, "''");
        clean = clean.replace(/\[\[[\s\S]*?\]\]/g, '[[]]');

        const branchKeywords = [
            /\bif\b/g, /\belseif\b/g, /\bwhile\b/g, 
            /\bfor\b/g, /\band\b/g, /\bor\b/g, /\buntil\b/g
        ];
        
        let complexity = 1; 
        branchKeywords.forEach(kw => {
            let matches = clean.match(kw);
            if (matches) complexity += matches.length;
        });
        return complexity;
    };

    // --- 一键 Tab 缩进算法 ---
    const indentLuaCode = (text) => {
        let lines = text.split('\n');
        let formatted = [];
        let indentLevel = 0;
        
        const increasePatterns = /\b(then|do|repeat|function)\b|\{/;
        const decreasePatterns = /\b(end|until)\b|\}/;
        const middlePatterns = /\b(else|elseif)\b/;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) {
                formatted.push('');
                continue;
            }

            let middleCurrent = false;
            if (decreasePatterns.test(line)) {
                indentLevel = Math.max(0, indentLevel - 1);
            } else if (middlePatterns.test(line)) {
                indentLevel = Math.max(0, indentLevel - 1);
                middleCurrent = true;
            }

            let tabString = '\t'.repeat(indentLevel);
            formatted.push(tabString + line);

            if (increasePatterns.test(line)) {
                if (!(line.startsWith('end') || line.endsWith('end'))) {
                    indentLevel++;
                }
            } else if (middleCurrent) {
                indentLevel++; 
            }
        }
        return formatted.join('\n');
    };

    const hexToRgba = (hex, alpha) => {
        let h = colorNames[hex] || hex;
        h = h.trim().replace('#', '');
        let r = 0, g = 0, b = 0;
        if (h.length === 3) {
            r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16);
        } else if (h.length === 6) {
            r = parseInt(h.substring(0, 2), 16); g = parseInt(h.substring(2, 4), 16); b = parseInt(h.substring(4, 6), 16);
        } else { return hex; }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const getGreenChannel = (color) => {
        let hex = colorNames[color] || color;
        hex = hex.trim();
        if (hex.startsWith('#')) {
            if (hex.length === 4) {
                let g = hex.charAt(2); return parseInt(g + g, 16);
            } else if (hex.length === 7) {
                return parseInt(hex.substring(3, 5), 16);
            }
        } else if (hex.startsWith('rgb')) {
            let match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) return parseInt(match[2]);
        }
        return 0;
    };

    const lightenColor = (color, percent = 30) => {
        let hex = colorNames[color] || color;
        hex = hex.trim().replace("#", "");
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        let num = parseInt(hex, 16),
            amt = Math.round(2.55 * percent),
            R = (num >> 16) + amt,
            G = (num >> 8 & 0x00FF) + amt,
            B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
    };

    const resolveColor = (color) => {
        return colorNames[color] || color;
    };

    const ensureDynamicStyle = (blockName, color) => {
        let style = document.getElementById('dynamic-editor-styles');
        if (!style) {
            style = document.createElement('style');
            style.id = 'dynamic-editor-styles';
            document.head.appendChild(style);
        }
        let bgClassName = `block-bg-line-${blockName}`;
        let textClassName = `block-text-line-${blockName}`;

        if (!style.textContent.includes(`.${bgClassName}`)) {
            let bgClr = hexToRgba(color, 0.08);
            style.textContent += `
                .${bgClassName} { 
                    border-left: 4px solid ${color} !important; 
                    background-color: ${bgClr} !important;
                }
                .${textClassName}, .${textClassName} * { 
                    color: ${color} !important; 
                }
            `;
        }
    };

    // --- 初始化 Monaco Editor ---
    const initMonaco = () => {
        require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
        require(['vs/editor/editor.main'], function() {
            monaco.languages.registerCompletionItemProvider('lua', {
                provideCompletionItems: function(model, position) {
                    let suggestions = [];
                    const defaults = currentSettings.default_completions || [];
                    defaults.forEach(item => {
                        let kind = monaco.languages.CompletionItemKind.Field;
                        if (item.type === 'API') kind = monaco.languages.CompletionItemKind.Method;
                        else if (item.type === '保留关键字') kind = monaco.languages.CompletionItemKind.Keyword;
                        else if (item.type === '非保留关键字') kind = monaco.languages.CompletionItemKind.Field;
                        else if (item.type === '变量') kind = monaco.languages.CompletionItemKind.Variable;
                        else if (item.type === '函数') kind = monaco.languages.CompletionItemKind.Function;
                        else if (item.type === '常数') kind = monaco.languages.CompletionItemKind.Constant;

                        suggestions.push({
                            label: item.label,
                            kind: kind,
                            insertText: item.label,
                            detail: `[${item.type}] ${item.detail || ''}`
                        });
                    });

                    const currentText = model.getValue();
                    const lines = currentText.split('\n');
                    const localVars = new Set();
                    const localFuncs = new Set();

                    lines.forEach(line => {
                        let varMatch = line.match(/^\s*local\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
                        if (varMatch) localVars.add(varMatch[1]);

                        let funcMatch = line.match(/^\s*(local\s+)?function\s+([a-zA-Z0-9_.:]+)/);
                        if (funcMatch) localFuncs.add(funcMatch[2]);
                    });

                    localVars.forEach(v => {
                        suggestions.push({
                            label: v,
                            kind: monaco.languages.CompletionItemKind.Variable,
                            insertText: v,
                            detail: '[变量] 局部上下文自动抓取'
                        });
                    });

                    localFuncs.forEach(f => {
                        suggestions.push({
                            label: f,
                            kind: monaco.languages.CompletionItemKind.Function,
                            insertText: f,
                            detail: '[函数] 动态上下文自动抓取'
                        });
                    });

                    const baseKeywords = ["and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while"];
                    baseKeywords.forEach(kw => {
                        suggestions.push({
                            label: kw,
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: kw,
                            detail: '[保留关键字]'
                        });
                    });

                    return { suggestions: suggestions };
                }
            });

            monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
                value: '',
                language: 'lua',
                theme: 'vs', 
                fontFamily: "'JetBrains Mono', monospace",
                fontLigatures: true, 
                fontSize: 15,
                cursorBlinking: 'smooth', 
                cursorSmoothCaretAnimation: 'on', 
                cursorWidth: 3,
                smoothScrolling: true,
                minimap: { enabled: false },
                automaticLayout: true
            });

            // 强行覆盖 Monaco 内部默认的 Ctrl+I 按键行为
            monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, function() {
                showSearchModal();
            });
            monacoEditor.onDidChangeCursorPosition((e) => {
                if (activeFcsBlock && !isApplyingFcs) {
                    const line = e.position.lineNumber;
                    if (line < activeFcsBlock.startLine || line > activeFcsBlock.endLine) {
                        clearFcs();
                    }
                }
            });

            monacoEditor.onDidChangeModelContent(() => {
                applyBlockColorDecorations();
            });
        });
    };

    const parseBlocks = () => {
        const text = monacoEditor.getValue();
        const lines = text.split('\n');
        let root = { name: 'root', startLine: 1, endLine: lines.length, children: [], parent: null };
        let current = root;
        let blocks = { 'root': root };

        for(let i=0; i<lines.length; i++) {
            const line = lines[i].trim();
            const startMatch = line.match(/^--\s*#region\s+(.+)$/);
            const endMatch = line.match(/^--\s*#endregion/);

            if (startMatch) {
                let node = { name: startMatch[1].trim(), startLine: i+1, endLine: -1, children: [], parent: current };
                current.children.push(node);
                blocks[node.name] = node;
                current = node;
            } else if (endMatch && current !== root) {
                current.endLine = i+1;
                current = current.parent;
            }
        }
        for (let name in blocks) {
            if (blocks[name].endLine === -1) {
                blocks[name].endLine = lines.length;
            }
        }
        return blocks;
    };

    const getDeepestBlockForLine = (lineNum, blocks) => {
        let deepest = null;
        let minSpan = Infinity;
        for (let name in blocks) {
            let b = blocks[name];
            if (lineNum >= b.startLine && lineNum <= b.endLine) {
                let span = b.endLine - b.startLine;
                if (span < minSpan) {
                    minSpan = span;
                    deepest = b;
                }
            }
        }
        return deepest;
    };

    const applyBlockColorDecorations = () => {
        if (!monacoEditor) return;
        const model = monacoEditor.getModel();
        if (!model) return;
        const totalLines = model.getLineCount();
        const blocks = parseBlocks();
        let decorations = [];

        let currentBlockName = null;
        let currentColor = null;
        let startLine = -1;

        const pushDecorationRange = (start, end, blockName, color) => {
            let gVal = getGreenChannel(color);
            let finalColor = color;
            if (gVal > 128) {
                finalColor = '#007acc'; 
            } else {
                finalColor = lightenColor(color, 25); 
            }
            
            ensureDynamicStyle(blockName, finalColor);

            decorations.push({
                range: new monaco.Range(start, 1, end, 1),
                options: { isWholeLine: true, className: `block-bg-line-${blockName}` }
            });

            let endLineLength = model.getLineLength(end) + 1;
            decorations.push({
                range: new monaco.Range(start, 1, end, endLineLength),
                options: { inlineClassName: `block-text-line-${blockName}` }
            });
        };

        for (let i = 1; i <= totalLines; i++) {
            let deepestBlock = getDeepestBlockForLine(i, blocks);
            let color = null;
            let coloredBlockName = null;
            let curr = deepestBlock;
            while (curr && curr.name !== 'root') {
                let c = customColors['block:' + curr.name];
                if (c) {
                    color = c;
                    coloredBlockName = curr.name;
                    break;
                }
                curr = curr.parent;
            }

            if (coloredBlockName !== currentBlockName) {
                if (currentBlockName && currentColor) {
                    pushDecorationRange(startLine, i - 1, currentBlockName, currentColor);
                }
                currentBlockName = coloredBlockName;
                currentColor = color;
                startLine = i;
            }
        }
        if (currentBlockName && currentColor) {
            pushDecorationRange(startLine, totalLines, currentBlockName, currentColor);
        }

        blockColorDecorations = monacoEditor.deltaDecorations(blockColorDecorations, decorations);
    };

    const loadFileTree = async () => {
        const res = await eel.get_file_tree()();
        if (res.error) { treeContainer.innerHTML = `<div style="padding:15px;color:#aaa;">${res.error}</div>`; return; }
        
        const renderTree = (nodes, container) => {
            const ul = document.createElement('ul');
            ul.className = 'file-tree';
            nodes.forEach(node => {
                const li = document.createElement('li');
                const title = document.createElement('div');
                title.className = 'tree-node';
                
                let displayName = dirFlags[node.path] || node.name;
                title.textContent = (node.type === 'dir' ? '[+] ' : '    ') + displayName;
                
                let nodeColor = customColors[node.path];
                if (nodeColor) {
                    let finalClr = resolveColor(nodeColor);
                    title.style.color = finalClr;
                    title.style.borderLeft = `3px solid ${finalClr}`;
                    title.style.paddingLeft = '5px';
                }

                if (node.path === currentFilePath) title.classList.add('active');

                title.addEventListener('click', () => {
                    if (node.type === 'dir') {
                        const childUl = li.querySelector('ul');
                        if (childUl) {
                            childUl.style.display = childUl.style.display === 'none' ? 'block' : 'none';
                            title.textContent = (childUl.style.display === 'none' ? '[+] ' : '[-] ') + displayName;
                        }
                    } else {
                        document.querySelectorAll('.tree-node').forEach(el => el.classList.remove('active'));
                        title.classList.add('active');
                        loadItemDetails(node.path);
                    }
                });
                li.appendChild(title);
                if (node.type === 'dir' && node.children) renderTree(node.children, li);
                ul.appendChild(li);
            });
            container.appendChild(ul);
        };
        treeContainer.innerHTML = '';
        renderTree(res.tree, treeContainer);
    };

    const loadItemDetails = async (relPath) => {
        if (currentFilePath === relPath) return;
        
        if (currentFilePath) {
            await saveChanges();
            printTerminal(`[系统] 切换文件，已静默保存 ${currentFilePath}`);
        }

        currentFilePath = relPath;
        const code = await eel.get_item_data(relPath)();
        if (code.error) return showToast(code.error, 'error');
        
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('editor-screen').classList.remove('hidden');
        document.getElementById('item-name-display').textContent = relPath;
        
        if(monacoEditor) monacoEditor.setValue(code);
        terminalOutputEl.textContent = '';
        
        applyBlockColorDecorations();
        loadFileTree(); 
    };

    const saveChanges = async () => {
        if (!currentFilePath || !monacoEditor) return;
        if (autoBackupFiles.has(currentFilePath)) {
            await eel.execute_file_cmd("back", currentFilePath)();
            printTerminal(`[系统] 自动备份完成: ${currentFilePath}.bak`);
        }
        const code = monacoEditor.getValue();
        const res = await eel.save_item_data(currentFilePath, code)();
        if (res.success) showToast("保存成功", "success");
        else showToast(res.error, "error");
    };

    // --- 双向键盘焦点循环调度 ---
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            const active = document.activeElement;
            if (active === cmdInput) {
                if (monacoEditor) monacoEditor.focus();
            } else if (active === browserUrlInput) {
                cmdInput.focus();
                cmdInput.select();
            } else {
                browserUrlInput.focus();
                browserUrlInput.select();
            }
        }
    });

    const handleFcsCommand = (blockName, flag) => {
        if (!monacoEditor) return;
        const blocks = parseBlocks();
        const target = blocks[blockName];
        if (!target) return printTerminal(`[fcs] 找不到代码块: ${blockName}`);

        const model = monacoEditor.getModel();
        const totalLines = model.getLineCount();

        let activeBlockNodes = new Set();
        activeBlockNodes.add(target);

        if (flag === '-s') {
            if (target.parent) {
                target.parent.children.forEach(sib => activeBlockNodes.add(sib));
            }
        } else if (flag === '-l') {
            target.children.forEach(child => activeBlockNodes.add(child));
        }

        let isDimmed = new Array(totalLines + 1).fill(true);
        for (let i = 1; i <= totalLines; i++) {
            let deepest = getDeepestBlockForLine(i, blocks);
            if (deepest && activeBlockNodes.has(deepest)) {
                isDimmed[i] = false;
            }
        }

        let decorations = [];
        let startDim = -1;
        for (let i = 1; i <= totalLines; i++) {
            if (isDimmed[i]) {
                if (startDim === -1) startDim = i;
            } else {
                if (startDim !== -1) {
                    let endLineLength = model.getLineLength(i - 1) + 1;
                    decorations.push({
                        range: new monaco.Range(startDim, 1, i - 1, endLineLength),
                        options: { inlineClassName: 'fcs-dimmed' }
                    });
                    startDim = -1;
                }
            }
        }
        if (startDim !== -1) {
            let endLineLength = model.getLineLength(totalLines) + 1;
            decorations.push({
                range: new monaco.Range(startDim, 1, totalLines, endLineLength),
                options: { inlineClassName: 'fcs-dimmed' }
            });
        }

        isApplyingFcs = true;
        fcsDecorations = monacoEditor.deltaDecorations(fcsDecorations, decorations);
        activeFcsBlock = { name: blockName, startLine: target.startLine, endLine: target.endLine };

        monacoEditor.revealLinesInCenter(target.startLine, target.endLine);
        monacoEditor.setSelection(new monaco.Range(target.startLine, 1, target.endLine, 1));
        
        setTimeout(() => { isApplyingFcs = false; }, 50);
        printTerminal(`[fcs] 已聚焦到块: ${blockName}`);
    };

    const clearFcs = () => {
        if (activeFcsBlock) {
            activeFcsBlock = null;
            fcsDecorations = monacoEditor.deltaDecorations(fcsDecorations, []);
            printTerminal(`[fcs] 光标移出，恢复视野。`);
        }
    };

    tabBrowser.addEventListener('click', () => {
        tabBrowser.classList.add('active'); tabMusic.classList.remove('active'); tabPlugins.classList.remove('active');
        panelBrowser.classList.remove('hidden'); panelMusic.classList.add('hidden'); panelPlugins.classList.add('hidden');
    });

    tabMusic.addEventListener('click', () => {
        tabMusic.classList.add('active'); tabBrowser.classList.remove('active'); tabPlugins.classList.remove('active');
        panelMusic.classList.remove('hidden'); panelBrowser.classList.add('hidden'); panelPlugins.classList.add('hidden');
    });

    tabPlugins.addEventListener('click', () => {
        tabPlugins.classList.add('active'); tabBrowser.classList.remove('active'); tabMusic.classList.remove('active');
        panelPlugins.classList.remove('hidden'); panelBrowser.classList.add('hidden'); panelMusic.classList.add('hidden');
    });

    const navigateBrowser = (url) => {
        let targetUrl = url.trim();
        if (!targetUrl) return;
        browserPlaceholder.classList.add('hidden');
        browserIframe.classList.remove('hidden');

        if (!targetUrl.match(/^https?:\/\//i)) {
            if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
                targetUrl = 'https://' + targetUrl;
            } else {
                targetUrl = 'https://cn.bing.com/search?q=' + encodeURIComponent(targetUrl);
            }
        }
        browserIframe.src = targetUrl;
        browserUrlInput.value = targetUrl;
    };

    browserGo.addEventListener('click', () => navigateBrowser(browserUrlInput.value));
    browserUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigateBrowser(browserUrlInput.value);
    });

    const loadChromeBookmarks = async () => {
        const res = await eel.get_chrome_bookmarks()();
        chromeBookmarksSelect.innerHTML = '';
        if (res.error) {
            let opt = document.createElement('option'); opt.textContent = res.error;
            chromeBookmarksSelect.appendChild(opt); return;
        }
        let defaultOpt = document.createElement('option');
        defaultOpt.value = ""; defaultOpt.textContent = "选择 Chrome 书签进行跳转...";
        chromeBookmarksSelect.appendChild(defaultOpt);
        res.bookmarks.forEach(bk => {
            let opt = document.createElement('option'); opt.value = bk.url;
            opt.textContent = bk.name.length > 30 ? bk.name.substring(0, 30) + '...' : bk.name;
            chromeBookmarksSelect.appendChild(opt);
        });
    };

    chromeBookmarksSelect.addEventListener('change', (e) => {
        if (e.target.value) navigateBrowser(e.target.value);
    });

    const playNeteaseMusic = (id, typeVal) => {
        const musicId = id || musicIdInput.value.trim() || "3778678";
        const type = typeVal || musicTypeSelect.value;
        let iframeHeight = 450; let playerHeight = 430;
        if (type === '2') { iframeHeight = 110; playerHeight = 90; }

        const musicPlaceholder = document.getElementById('music-placeholder');
        if (musicPlaceholder) musicPlaceholder.classList.add('hidden');
        musicIframe.classList.remove('hidden');
        musicIframe.height = iframeHeight;

        const outchainUrl = `https://music.163.com/outchain/player?type=${type}&id=${musicId}&auto=1&height=${playerHeight}`;
        musicIframe.src = outchainUrl;
        printTerminal(`[音乐] 正在播放网易云音频, 资源 ID: ${musicId}`);
    };

    musicPlayBtn.addEventListener('click', () => playNeteaseMusic());
    musicIdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') playNeteaseMusic();
    });

    // --- Vim 指令系统 (新增 Tab 一键格式化) ---
    cmdInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const val = cmdInput.value.trim();
            cmdInput.value = '';
            if (!val) return;
            
            const parts = val.split(' ').filter(p => p);
            const cmd = parts[0];
            const target = parts[1];
            const extra = parts[2];

            printTerminal(`: ${val}`);

            // 标志截图一键标记命令： icon
            if (cmd === 'icon') {
                startIconMappingSession();
                return;
            }

            // 新增指令：tab [file/block/dir]
            if (cmd === 'tab' && target) {
                printTerminal(`[格式化] 正在启动一键缩进格式化: ${target}`);
                const blocks = parseBlocks();
                const matchedBlock = blocks[target];

                if (matchedBlock) { 
                    const model = monacoEditor.getModel();
                    const range = new monaco.Range(matchedBlock.startLine, 1, matchedBlock.endLine, 1000);
                    const text = model.getValueInRange(range);
                    const formatted = indentLuaCode(text);
                    
                    monacoEditor.executeEdits("beautifier", [{
                        range: range,
                        text: formatted,
                        forceMoveMarkers: true
                    }]);
                    printTerminal(`[格式化] 代码块 '${target}' 已完成 Tab 缩进整理`);
                } else {
                    if (target === currentFilePath) {
                        const model = monacoEditor.getModel();
                        const range = model.getFullModelRange();
                        const text = model.getValue();
                        const formatted = indentLuaCode(text);
                        
                        monacoEditor.executeEdits("beautifier", [{
                            range: range,
                            text: formatted,
                            forceMoveMarkers: true
                        }]);
                        printTerminal(`[格式化] 当前活跃脚本 ${target} 已完成 Tab 缩进整理`);
                    } else {
                        const res = await eel.format_lua_path(target)();
                        if (res.success) {
                            printTerminal(`[格式化] ${res.msg}`);
                            if (currentFilePath && target.includes(currentFilePath)) {
                                const code = await eel.get_item_data(currentFilePath)();
                                monacoEditor.setValue(code);
                            }
                            loadFileTree();
                        } else {
                            printTerminal(`[错误] ${res.error}`);
                        }
                    }
                }
                return;
            }

            if (cmd === 'makelua' && target && extra) {
                printTerminal(`[编译器] 正在启动打包合并流程...`);
                const res = await eel.makelua_files(target, extra)();
                if (res.success) {
                    printTerminal(`[编译器] ${res.msg}`);
                    loadFileTree();
                } else {
                    printTerminal(`[错误] ${res.error}`);
                }
                return;
            }

            if (cmd === 'cal' && target) {
                const blocks = parseBlocks();
                const matchedBlock = blocks[target];
                if (matchedBlock) {
                    const model = monacoEditor.getModel();
                    const text = model.getValueInRange(new monaco.Range(matchedBlock.startLine, 1, matchedBlock.endLine, 1000));
                    const complexity = calculateCyclomaticComplexity(text);
                    printTerminal(`[复杂度] 代码块 '${target}' (第${matchedBlock.startLine}行 至 第${matchedBlock.endLine}行) 的圈复杂度为: ${complexity}`);
                } else {
                    const code = await eel.get_item_data(target)();
                    if (code.error) {
                        printTerminal(`[错误] 获取文件 ${target} 失败: ${code.error}`);
                    } else {
                        const complexity = calculateCyclomaticComplexity(code);
                        printTerminal(`[复杂度] 脚本文件 '${target}' 的圈复杂度为: ${complexity}`);
                    }
                }
                return;
            }

            if (cmd === 'edit' && target) {
                loadItemDetails(target);
                return;
            }

            if (cmd === 'flag' && target && extra) {
                dirFlags[target] = extra;
                printTerminal(`[flag] 标记文件夹: ${target} -> ${extra}`);
                loadFileTree();
                return;
            }

            if (cmd === 'dflag' && target) {
                delete dirFlags[target];
                printTerminal(`[flag] 还原标记: ${target}`);
                loadFileTree();
                return;
            }

            if (cmd === 'fclr' && target && extra) {
                colorNames[extra] = target; 
                printTerminal(`[fclr] 新增别名: ${extra} -> ${target}`);
                await eel.save_settings({ ...currentSettings, color_names: colorNames })();
                return;
            }

            if (cmd === 'clr' && target && extra) {
                if (extra === 'none') {
                    delete customColors[target];
                    delete customColors['block:' + target];
                    printTerminal(`[clr] 还原 ${target} 染色`);
                } else {
                    const matchedBlock = parseBlocks()[target];
                    if (matchedBlock) {
                        customColors['block:' + target] = extra;
                    } else {
                        customColors[target] = extra;
                    }
                    printTerminal(`[clr] 染色成功: ${target} -> ${extra}`);
                }
                await eel.save_settings({ ...currentSettings, custom_colors: customColors })();
                applyBlockColorDecorations();
                loadFileTree();
                return;
            }

            if (cmd === 'fcs' && target) {
                handleFcsCommand(target, extra);
                return;
            }

            if (cmd === 'aback' && target) {
                const isEnable = extra === '1';
                if (isEnable) autoBackupFiles.add(target);
                else autoBackupFiles.delete(target);
                printTerminal(`[系统] ${target} 自动备份已${isEnable?'开启':'关闭'}`);
                return;
            }

            if (['new', 'del', 'back', 're'].includes(cmd)) {
                if (!target) return printTerminal(`[系统] 缺少目标参数`);
                let actExtra = null;
                if (cmd === 'new') actExtra = target.includes('.') ? 'file' : 'dir';
                if (cmd === 're') actExtra = extra;

                const res = await eel.execute_file_cmd(cmd, target, actExtra)();
                if (res.success) {
                    printTerminal(`[系统] ${res.msg}`);
                    loadFileTree();
                } else {
                    printTerminal(`[错误] ${res.error}`);
                }
            } else {
                printTerminal(`[错误] 未知指令: ${cmd}`);
            }
        }
    });

    document.getElementById('settings-toggle-button').addEventListener('click', () => {
        settingsModal.classList.remove('hidden'); setTimeout(() => settingsModal.classList.add('visible'), 10);
    });
    
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            settingsModal.classList.remove('visible'); setTimeout(() => settingsModal.classList.add('hidden'), 300);
        });
    });

    document.getElementById('settings-save-button').addEventListener('click', async () => {
        await eel.save_settings({ data_path: document.getElementById('settings-data-path').value })();
        settingsModal.querySelector('.modal-close-btn').click();
        loadFileTree();
    });

    document.getElementById('save-button').addEventListener('click', saveChanges);
    document.getElementById('run-button').addEventListener('click', async () => {
        if (!currentFilePath) return;
        await saveChanges();
        printTerminal(`\n--- 运行 ${currentFilePath} ---`);
        const res = await eel.run_lua_script(currentFilePath)();
        printTerminal(res.output || res.error);
    });

    initMonaco();
    eel.get_settings()().then(s => {
        currentSettings = s;
        customColors = s.custom_colors || {};
        colorNames = s.color_names || {};
        document.getElementById('settings-data-path').value = s.data_path || '';
        loadFileTree();
        loadChromeBookmarks(); 
        loadMiniWorldPlugins();
    });
});