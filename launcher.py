import os
import atexit
import shutil
import json
import importlib
import sys

# 配置路径
HTML_PATH = "web/index.html"
HTML_BAK_PATH = "web/index.html.bak"
MODS_CONFIG_PATH = "mods/mod_config.json"

# ==========================================
# --- 统一模组加载系统 (Unified Mod Loader) ---
# ==========================================

def load_mod_config():
    if not os.path.exists(MODS_CONFIG_PATH):
        # 自动生成默认配置
        default_config = {
            "enabled_mods": ["loader", "minidev"]
        }
        os.makedirs(os.path.dirname(MODS_CONFIG_PATH), exist_ok=True)
        with open(MODS_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(default_config, f, indent=4)
        return default_config
        
    try:
        with open(MODS_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[Mod Loader Error] 读取配置失败: {e}")
        return {"enabled_mods": []}

def inject_mod_loader(enabled_mods):
    with open(HTML_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    
    changed = False
    for mod_name in enabled_mods:
        # 约定前端模组文件位于 web/mods/<mod_name>.js
        mod_script = f'<script src="mods/{mod_name}.js"></script>'
        # 如果对应的 js 文件确实存在，才注入
        js_path = os.path.join("web", "mods", f"{mod_name}.js")
        if os.path.exists(js_path):
            if mod_script not in content:
                content = content.replace("</body>", f"{mod_script}\n</body>")
                changed = True
                print(f"[Mod Loader] 注入前端模组: {mod_name}.js")
        else:
            print(f"[Mod Loader] 提示: 未找到 {mod_name} 的前端资源 ({js_path})，跳过前端注入。")
        
    if changed:
        with open(HTML_PATH, "w", encoding="utf-8") as f:
            f.write(content)
        print("[Mod Loader] 前端模组注入完成")

def restore_html():
    if os.path.exists(HTML_BAK_PATH):
        shutil.copy2(HTML_BAK_PATH, HTML_PATH)
        os.remove(HTML_BAK_PATH)
        print("[Mod Loader] 模组引导已安全卸载，IDE 源码恢复纯净")

if __name__ == '__main__':
    # 1. 备份并注入前端 HTML
    if os.path.exists(HTML_PATH) and not os.path.exists(HTML_BAK_PATH):
        shutil.copy2(HTML_PATH, HTML_BAK_PATH)
    
    config = load_mod_config()
    enabled_mods = config.get("enabled_mods", [])
    
    atexit.register(restore_html)
    inject_mod_loader(enabled_mods)
    
    # 2. 导入 app 源码
    import app
    
    # 3. 动态加载后端 Python 模组
    # 将 mods 目录加入 sys.path 以便 importlib 能找到
    if os.path.abspath("mods") not in sys.path:
        sys.path.insert(0, os.path.abspath("mods"))
        
    for mod_name in enabled_mods:
        mod_py_path = os.path.join("mods", f"{mod_name}.py")
        mod_pkg_path = os.path.join("mods", mod_name, "__init__.py")
        
        if os.path.exists(mod_py_path) or os.path.exists(mod_pkg_path):
            try:
                mod_module = importlib.import_module(mod_name)
                if hasattr(mod_module, "setup"):
                    mod_module.setup(app)
                    print(f"[Mod Loader] 后端模组挂载成功: {mod_name}")
            except Exception as e:
                print(f"[Mod Loader Error] 后端模组 {mod_name} 加载失败: {e}")
        else:
             print(f"[Mod Loader] 提示: 未找到 {mod_name} 的后端资源 ({mod_py_path})，跳过加载。")

    # 4. 启动 IDE
    app.main()