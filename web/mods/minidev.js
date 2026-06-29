(function() {
    console.log("%c[Mod: MiniDev] 迷你世界 API 挂载扩展模组注入成功！", "color: #ff9500; font-weight: bold; font-size: 14px;");

    let apiData = { classes: {} }; 

    // --- 高级无侵入 Toast 样式注入与实现 (替代 alert) ---
    const injectToastStyle = () => {
        let style = document.getElementById('minidev-toast-styles');
        if (!style) {
            style = document.createElement('style');
            style.id = 'minidev-toast-styles';
            style.textContent = `
                .minidev-toast-container {
                    position: fixed;
                    bottom: 30px;
                    right: 30px;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    pointer-events: none;
                }
                .minidev-toast {
                    min-width: 250px;
                    padding: 12px 18px;
                    background: rgba(30, 30, 30, 0.95);
                    color: #ffffff;
                    border-left: 4px solid #ff9500;
                    border-radius: 4px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 13px;
                    opacity: 0;
                    transform: translateY(20px);
                    transition: opacity 0.3s, transform 0.3s;
                    pointer-events: auto;
                }
                .minidev-toast.show {
                    opacity: 1;
                    transform: translateY(0);
                }
                .minidev-toast.success {
                    border-left-color: #34c759;
                }
                .minidev-toast.error {
                    border-left-color: #ff3b30;
                }
            `;
            document.head.appendChild(style);
        }
    };

    const showModToast = (msg, type = 'info') => {
        injectToastStyle();
        let container = document.getElementById('minidev-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'minidev-toast-container';
            container.className = 'minidev-toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `minidev-toast ${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    // --- 同步加载 API 数据 ---
    const syncApiData = async () => {
        try {
            const res = await eel.minidev_get_all_apis()();
            if (res) {
                apiData = res;
                console.log("[Mod: MiniDev] 成功同步挂载的 API 数据类别：", Object.keys(apiData.classes));
            }
        } catch (e) {
            console.error("[Mod: MiniDev] 同步 API 数据异常", e);
        }
    };

    // --- 根据原生 Monaco 运行时获取活跃编辑器的公用方法 (防闭包穿透) ---
    const getActiveEditor = () => {
        if (window.monaco && window.monaco.editor && typeof window.monaco.editor.getEditors === 'function') {
            const editors = window.monaco.editor.getEditors();
            if (editors.length > 0) {
                return editors[0];
            }
        }
        return null;
    };

    // --- 对指令输入框 id="cmd-input" 实施捕获拦截 ---
    const registerCommandInterception = () => {
        const cmdInput = document.getElementById('cmd-input');
        if (cmdInput) {
            cmdInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    const val = cmdInput.value.trim();
                    const parts = val.split(' ').filter(p => p);
                    
                    if (parts[0]) {
                        const rawCmd = parts[0];
                        if (rawCmd.startsWith('minidev_') || rawCmd.startsWith(':minidev_')) {
                            
                            e.stopImmediatePropagation();
                            e.preventDefault();

                            const cmd = rawCmd.replace(/^:/, ''); 
                            const args = parts.slice(1);
                            
                            cmdInput.value = ''; 

                            console.log(`[Mod: MiniDev] 成功拦截 cmd-input 指令: ${cmd} 参数:`, args);

                            try {
                                if (cmd === "minidev_mount") {
                                    const url = args[0];
                                    if (!url) {
                                        showModToast("请提供要挂载的 Wiki URL", "error");
                                    } else {
                                        const res = await eel.minidev_mount(url)();
                                        if (res.success) {
                                            showModToast(res.message, "success");
                                        } else {
                                            showModToast(res.message, "error");
                                        }
                                        await syncApiData();
                                    }
                                } else if (cmd === "minidev_unmount") {
                                    const url = args[0];
                                    if (!url) {
                                        showModToast("请提供要解除挂载的 Wiki URL", "error");
                                    } else {
                                        const res = await eel.minidev_unmount(url)();
                                        if (res.success) {
                                            showModToast(res.message, "success");
                                        } else {
                                            showModToast(res.message, "error");
                                        }
                                        await syncApiData();
                                    }
                                } else if (cmd === "minidev_mountauto") {
                                    const res = await eel.minidev_mount_auto()();
                                    if (res.success) {
                                        showModToast(`${res.message} 成功自动关联！`, "success");
                                    } else {
                                        showModToast(res.message, "error");
                                    }
                                    await syncApiData();
                                } else if (cmd === "minidev_list") {
                                    const className = args[0];
                                    const flag = args[1];
                                    if (!className) {
                                        showModToast("请指定类名。格式：minidev_list [类名] [-p]", "error");
                                    } else {
                                        const res = await eel.minidev_list(className, flag)();
                                        if (res.success) {
                                            const editor = getActiveEditor();
                                            if (editor) {
                                                const model = editor.getModel();
                                                const position = editor.getPosition();
                                                if (model && position) {
                                                    const textToInsert = res.apis.join("\n") + "\n";
                                                    editor.executeEdits("minidev", [{
                                                        range: new window.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
                                                        text: textToInsert
                                                    }]);
                                                    showModToast(`已将类 ${className} 下的所有 API 代码自动写入编辑器`, "success");
                                                }
                                            } else {
                                                console.log(res.apis.join("\n"));
                                            }
                                        } else {
                                            showModToast(res.message, "error");
                                        }
                                    }
                                } else if (cmd === "minidev_mountlist") {
                                    const res = await eel.minidev_mountlist()();
                                    if (res.success) {
                                        showModToast(`共挂载了 ${res.count} 个类，详情请查看终端输出`, "success");
                                    } else {
                                        showModToast("获取挂载列表失败", "error");
                                    }
                                } else if (cmd === "minidev_reclass") {
                                    if (args.length < 2) {
                                        showModToast("参数不足。用法: minidev_reclass [原类名] [新类名]", "error");
                                    } else {
                                        const res = await eel.minidev_reclass(args[0], args[1])();
                                        if (res.success) {
                                            showModToast(res.message, "success");
                                            await syncApiData();
                                        } else {
                                            showModToast(res.message, "error");
                                        }
                                    }
                                } else if (cmd === "minidev_reurl") {
                                    if (args.length < 2) {
                                        showModToast("参数不足。用法: minidev_reurl [类名] [新URL]", "error");
                                    } else {
                                        const res = await eel.minidev_reurl(args[0], args[1])();
                                        if (res.success) {
                                            showModToast(res.message, "success");
                                            await syncApiData();
                                        } else {
                                            showModToast(res.message, "error");
                                        }
                                    }
                                } else if (cmd === "minidev_help") {
                                    const helpText = `[Mod: MiniDev] 指令帮助:
- minidev_mount [URL] : 挂载指定 URL 的接口文档
- minidev_unmount [URL] : 解除挂载指定 URL
- minidev_mountauto : 自动扫描并挂载所有接口文档
- minidev_mountlist : 列出所有已挂载的类及 URL
- minidev_list [类名] [-p] : 列出某类的所有 API 并写入编辑器
- minidev_reclass [原名] [新名] : 重命名已挂载的类
- minidev_reurl [类名] [URL] : 修改类的关联 URL
- minidev_help : 查看此帮助信息`;
                                    const terminalEl = document.getElementById('terminal-output');
                                    if (terminalEl) {
                                        terminalEl.textContent += helpText + "\n";
                                        terminalEl.scrollTop = terminalEl.scrollHeight;
                                    } else {
                                        console.log(helpText);
                                    }
                                    showModToast("已在终端输出帮助信息", "success");
                                } else {
                                    showModToast(`未知模组指令: ${cmd}`, "error");
                                }
                            } catch (err) {
                                console.error(err);
                                showModToast(`执行异常: ${err.message}`, "error");
                            }
                        }
                    }
                }
            }, true); 
        }
    };

    // --- 注册悬浮卡片提示器 (Hover Provider) ---
    const registerHoverProvider = (monacoInstance) => {
        monacoInstance.languages.registerHoverProvider('lua', {
            provideHover: function(model, position) {
                const wordInfo = model.getWordAtPosition(position);
                if (!wordInfo) return null;

                const lineContent = model.getLineContent(position.lineNumber);
                const word = wordInfo.word;

                const beforeWordText = lineContent.substring(0, wordInfo.startColumn - 1);
                const classMatch = beforeWordText.match(/([\w_]+)[:.]$/);
                
                let detectedClass = null;
                if (classMatch) {
                    detectedClass = classMatch[1];
                }

                if (detectedClass && apiData.classes[detectedClass]) {
                    const api = apiData.classes[detectedClass].apis[word];
                    if (api) {
                        return renderHoverMarkdown(detectedClass, word, api, monacoInstance, position);
                    }
                } else {
                    for (const clsName in apiData.classes) {
                        const api = apiData.classes[clsName].apis[word];
                        if (api) {
                            return renderHoverMarkdown(clsName, word, api, monacoInstance, position);
                        }
                    }
                }
                return null;
            }
        });
    };

    const renderHoverMarkdown = (className, apiName, api, monacoInstance, position) => {
        const paramsStr = api.params.map(p => `* \`${p.name}\` *(type: ${p.type})* - ${p.desc}`).join("\n");
        const returnsStr = api.returns.map(r => `* \`${r.name}\` *(type: ${r.type})* - ${r.desc}`).join("\n");

        return {
            contents: [
                { value: `**[迷你世界 LUA 接口] ${className}:${apiName}**` },
                { value: `**描述:** ${api.desc}` },
                { value: `**参数:**\n${paramsStr || "无"}` },
                { value: `**返回值:**\n${returnsStr || "无"}` }
            ]
        };
    };

    // --- 注册联想补全 (Autocomplete Provider) ---
    const registerAutocompleteProvider = (monacoInstance) => {
        monacoInstance.languages.registerCompletionItemProvider('lua', {
            triggerCharacters: [':', '.'],
            provideCompletionItems: function(model, position) {
                const lineContent = model.getLineContent(position.lineNumber);
                const beforeWordText = lineContent.substring(0, position.column - 1);
                
                const classMatch = beforeWordText.match(/([\w_]+)[:.]$/);
                if (classMatch) {
                    const clsName = classMatch[1];
                    let realClsName = null;
                    for (const k in apiData.classes) {
                        if (k.toLowerCase() === clsName.toLowerCase()) {
                            realClsName = k;
                            break;
                        }
                    }

                    if (realClsName) {
                        const apis = apiData.classes[realClsName].apis;
                        const suggestions = [];
                        for (const apiName in apis) {
                            const api = apis[apiName];
                            
                            const snippetParts = [];
                            let tabStop = 1;
                            api.params.forEach(p => {
                                snippetParts.push(`\${${tabStop}:${p.name}}`);
                                tabStop++;
                            });
                            const pStr = snippetParts.join(", ");
                            const snippetText = `${apiName}(${pStr})`;

                            suggestions.push({
                                label: apiName,
                                kind: monacoInstance.languages.CompletionItemKind.Method,
                                detail: api.desc,
                                documentation: `参数: ${api.params.map(p => `${p.name}:${p.type}`).join(", ") || '无'}\n返回值: ${api.returns.map(r => `${r.name}:${r.type}`).join(", ") || '无'}`,
                                insertText: snippetText,
                                insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet
                            });
                        }
                        return { suggestions: suggestions };
                    }
                }

                const currentWord = model.getWordUntilPosition(position).word;
                if (currentWord.length >= 1) {
                    const suggestions = [];
                    for (const clsName in apiData.classes) {
                        const apis = apiData.classes[clsName].apis;
                        for (const apiName in apis) {
                            const api = apis[clsName].apis[apiName];
                            if (apiName.toLowerCase().includes(currentWord.toLowerCase()) || 
                                api.desc.includes(currentWord)) {
                                
                                const snippetParts = [];
                                let tabStop = 1;
                                api.params.forEach(p => {
                                    snippetParts.push(`\${${tabStop}:${p.name}}`);
                                    tabStop++;
                                });
                                const pStr = snippetParts.join(", ");
                                const rStr = api.returns.map(r => r.name).join(", ");
                                
                                const snippetText = rStr ? `local ${rStr} = ${clsName}:${apiName}(${pStr})` : `${clsName}:${apiName}(${pStr})`;

                                suggestions.push({
                                    label: `${clsName}:${apiName}`,
                                    kind: monacoInstance.languages.CompletionItemKind.Function,
                                    detail: api.desc,
                                    documentation: `[已挂载API]\n用法: ${clsName}:${apiName}(${api.params.map(p => p.name).join(", ")})\n描述: ${api.desc}`,
                                    insertText: snippetText,
                                    insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet
                                });
                            }
                        }
                    }
                    return { suggestions: suggestions };
                }

                return { suggestions: [] };
            }
        });
    };

    const extendMonaco = (editor, monacoInstance) => {
        console.log("[Mod: MiniDev] Monaco 运行时捕获成功，开始注册挂载联想与悬浮卡片模组...");
        registerHoverProvider(monacoInstance);
        registerAutocompleteProvider(monacoInstance);
        
        syncApiData();
    };

    // --- 升级初始化检测机制：调用 Monaco 的 getEditors 检索当前实例，绕开局部闭包限制 ---
    const checkEditorTimer = setInterval(() => {
        if (window.monaco && window.monaco.editor && typeof window.monaco.editor.getEditors === 'function') {
            const editors = window.monaco.editor.getEditors();
            if (editors.length > 0) {
                clearInterval(checkEditorTimer);
                extendMonaco(editors[0], window.monaco);
            }
        }
    }, 100);

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        registerCommandInterception();
    } else {
        document.addEventListener('DOMContentLoaded', registerCommandInterception);
    }

})();