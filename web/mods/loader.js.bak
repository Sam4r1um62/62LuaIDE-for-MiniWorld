(function() {
    console.log("%c[Mod: VisualId] 插件可视化标记模组注入成功！", "color: #0071e3; font-weight: bold; font-size: 14px;");

    let pluginMap = {};
    let existingIcons = new Set();
    let idDecorations = [];
    let isApplyingIdDecorations = false;
    let activeEditor = null; // 全局缓存我们绕过闭包拿到的编辑器实例

    // 1. 动态生成图片 CSS 样式的辅助函数 (带优雅的圆角与超细描边)
    const ensureIconStyle = (safeName, url) => {
        let style = document.getElementById('dynamic-mod-icon-styles');
        if (!style) {
            style = document.createElement('style');
            style.id = 'dynamic-mod-icon-styles';
            document.head.appendChild(style);
        }
        const className = `inline-plugin-icon-${safeName}`;
        if (!style.textContent.includes(`.${className}`)) {
            style.textContent += `
                .${className} {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    background-image: url('${url}');
                    background-size: cover;
                    background-position: center;
                    vertical-align: middle;
                    margin-left: 4px;
                    border-radius: 3px;
                    border: 1px solid rgba(0, 0, 0, 0.12);
                }
            `;
        }
    };

    // 2. 双引擎并行扫描、排他去重与字符串防漏判算法
    const getMatchesFromLine = (line) => {
        let results = [];
        let match;
        const seenIndices = new Set();
        
        // 奇偶校验：分析指定字符位置在当前行内是否处于单/双引号或 Lua 长括号字符串内部
        const isInsideString = (text, index) => {
            const beforeText = text.substring(0, index);
            const doubleQuotesCount = (beforeText.match(/"/g) || []).length;
            const singleQuotesCount = (beforeText.match(/'/g) || []).length;
            const longBracketsCount = (beforeText.match(/\[\[/g) || []).length - (beforeText.match(/\]\]/g) || []).length;
            
            // 如果单引号、双引号为奇数，或者长括号未闭合，说明处于字符串内
            return (doubleQuotesCount % 2 !== 0) || (singleQuotesCount % 2 !== 0) || (longBracketsCount > 0);
        };

        // 引擎 A (高优先级)：匹配 i_somenum 格式 (允许任何地方，包括字符串/引号内)
        const regex1 = /i_(\d+)/g;
        while ((match = regex1.exec(line)) !== null) {
            results.push({
                fullStr: match[0],
                idStr: match[1],
                index: match.index
            });
            // 标记该区间，防止被引擎 B 重新扫到
            for (let k = match.index; k < match.index + match[0].length; k++) {
                seenIndices.add(k);
            }
        }
        
        // 引擎 B (低优先级)：匹配普通独立数字 (如 10103)
        const regex2 = /\b\d+\b/g;
        while ((match = regex2.exec(line)) !== null) {
            const index = match.index;
            // 规则：
            // 1. 不能与 i_ 引擎冲突
            // 2. 普通独立数字绝对不能在单引号、双引号、长括号字符串内部！
            if (!seenIndices.has(index) && !isInsideString(line, index)) {
                results.push({
                    fullStr: match[0],
                    idStr: match[0],
                    index: index
                });
            }
        }
        return results;
    };

    // 3. 扫描当前编辑器，绑定行内图标
    const updateIdDecorations = () => {
        if (!activeEditor || isApplyingIdDecorations) return;
        const model = activeEditor.getModel();
        if (!model) return;

        isApplyingIdDecorations = true;
        const text = model.getValue();
        const lines = text.split('\n');
        let decorations = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const matches = getMatchesFromLine(line);
            
            matches.forEach(match => {
                const plugin = pluginMap[match.idStr];
                if (plugin) {
                    const safeIconName = plugin.icon.replace(/[^a-zA-Z0-9_\-]/g, '_');
                    
                    // 只有本地存在这个图标的物理 PNG 时才予以显示
                    if (existingIcons.has(safeIconName)) {
                        const startCol = match.index + 1;
                        const endCol = startCol + match.fullStr.length;
                        const iconUrl = `icons/${safeIconName}.png`;
                        
                        ensureIconStyle(safeIconName, iconUrl);
                        
                        decorations.push({
                            range: new monaco.Range(i + 1, startCol, i + 1, endCol),
                            options: {
                                afterContentClassName: `inline-plugin-icon-${safeIconName}`
                            }
                        });
                    }
                }
            });
        }

        idDecorations = activeEditor.deltaDecorations(idDecorations, decorations);
        isApplyingIdDecorations = false;
    };

    // 4. 异步拉取后台数据并建立映射
    const loadModData = async () => {
        try {
            const [pluginRes, iconsRes] = await Promise.all([
                eel.scan_mini_world_plugins()(),
                eel.get_existing_icons()()
            ]);

            if (pluginRes.success) {
                pluginMap = {};
                pluginRes.plugins.forEach(p => {
                    pluginMap[p.id.toString()] = p;
                });
            }
            if (Array.isArray(iconsRes)) {
                existingIcons = new Set(iconsRes);
            }
            
            updateIdDecorations();
        } catch (e) {
            console.error("[Mod: VisualId] 数据同步异常", e);
        }
    };

    // 5. 定期检索 Monaco 准备就绪状态
    const checkEditorTimer = setInterval(() => {
        if (window.monaco && window.monaco.editor && typeof window.monaco.editor.getEditors === 'function') {
            const editors = window.monaco.editor.getEditors();
            if (editors.length > 0) {
                clearInterval(checkEditorTimer);
                activeEditor = editors[0]; 
                initFrontendMods(activeEditor, window.monaco);
            }
        }
    }, 100);

    function initFrontendMods(editor, monacoInstance) {
        console.log("[Mod: VisualId] 成功绕过闭包限制，成功捕获 Monaco 实例并注入模组功能。");

        // A. 监听内容变更实时刷新行内小图标
        editor.onDidChangeModelContent(() => {
            updateIdDecorations();
        });

        // B. 注册悬停提示 (双引擎过滤对齐：字符串内的普通数字已被彻底拦截，不触发任何高亮或悬浮浮窗)
        monacoInstance.languages.registerHoverProvider('lua', {
            provideHover: function(model, position) {
                const lineContent = model.getLineContent(position.lineNumber);
                const matches = getMatchesFromLine(lineContent);
                
                for (let i = 0; i < matches.length; i++) {
                    const match = matches[i];
                    const startCol = match.index + 1;
                    const endCol = startCol + match.fullStr.length;
                    
                    if (position.column >= startCol && position.column <= endCol) {
                        const plugin = pluginMap[match.idStr];
                        if (plugin) {
                            const safeIconName = plugin.icon.replace(/[^a-zA-Z0-9_\-]/g, '_');
                            if (existingIcons.has(safeIconName)) {
                                return {
                                    range: new monaco.Range(position.lineNumber, startCol, position.lineNumber, endCol),
                                    contents: [
                                        { value: `**[迷你插件] ${plugin.name} (ID: ${plugin.id})**` },
                                        { value: `**分类:** ${plugin.type}` },
                                        { value: `**[描述]** ${plugin.describe}` },
                                        { value: `![图标](http://localhost:8981/icons/${safeIconName}.png?t=${new Date().getTime()})` }
                                    ]
                                };
                            }
                        }
                    }
                }
                return null;
            }
        });

        // C. 劫持主程序的方阵刷新通知，自动同步本地最新的裁剪状态
        const originalReload = window.trigger_frontend_matrix_reload;
        window.trigger_frontend_matrix_reload = function() {
            if (originalReload) originalReload();
            loadModData(); 
        };

        // 执行首次数据载入与绘制
        loadModData();
    }
})();