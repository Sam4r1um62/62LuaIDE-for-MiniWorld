import eel
import os
import json
import datetime
import shutil
import platform
import subprocess
import re
import threading
import time
from PIL import Image, ImageGrab
import tkinter as tk

# --- 应用程序配置 ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".lua_ide_config")
if not os.path.exists(APP_CONFIG_DIR):
    os.makedirs(APP_CONFIG_DIR)

CONFIG_FILE = os.path.join(APP_CONFIG_DIR, 'config.json')

DEFAULT_SETTINGS = {
    "data_path": "",
    "background": "cloth",
    "custom_colors": {},
    "color_names": {},
    "default_completions": [
        {"label": "print", "type": "非保留关键字", "detail": "输出文本到控制台"},
        {"label": "pairs", "type": "非保留关键字", "detail": "迭代键值对 (不保证顺序)"},
        {"label": "ipairs", "type": "非保留关键字", "detail": "迭代连续数组"},
        {"label": "player:get_pos", "type": "API", "detail": "获取当前玩家的三维坐标"},
        {"label": "player:set_pos", "type": "API", "detail": "将玩家移动至指定三维坐标"},
        {"label": "GLOBAL_MAX_LIMIT", "type": "常数", "detail": "最大包数据包大小限制"},
        {"label": "local", "type": "保留关键字", "detail": "定义局部变量或函数"}
    ]
}

def load_json_file(path, default_data):
    if not os.path.exists(path):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(default_data, f, indent=4)
        return default_data
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for k, v in default_data.items():
                data.setdefault(k, v)
            return data
    except Exception:
        return default_data

app_settings = load_json_file(CONFIG_FILE, DEFAULT_SETTINGS)
DATA_PATH = app_settings.get("data_path")

MINI_WORLD_BEHAVIOR_DIR = "C:/Users/26474/AppData/Roaming/miniworddata110/data/w97071836895758/mods/mapdefault_0.1_2b96d66d-509b-475b-96fe-7fc131bc2b90/behavior/"
ICONS_SAVE_DIR = os.path.join(BASE_DIR, "web", "icons")
if not os.path.exists(ICONS_SAVE_DIR):
    os.makedirs(ICONS_SAVE_DIR)

@eel.expose
def get_settings(): return app_settings

@eel.expose
def save_settings(new_settings):
    global app_settings, DATA_PATH
    app_settings.update(new_settings)
    DATA_PATH = app_settings.get("data_path")
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f: json.dump(app_settings, f, indent=4)
    return {"success": True, "message": "设置已保存"}


# ==========================================
# --- Python Tkinter 原生截图与高级裁剪 ---
# ==========================================

class Snipper:
    def __init__(self, icon_name, on_complete):
        self.icon_name = icon_name
        self.on_complete = on_complete
        
        # 1. 抓取屏幕快照
        self.image = ImageGrab.grab()
        
        # 2. 降下置顶高透半透明灰色交互遮罩
        self.root = tk.Tk()
        self.root.attributes("-fullscreen", True)
        self.root.attributes("-topmost", True)
        self.root.attributes("-alpha", 0.3)  # 半透明
        self.root.config(cursor="cross")
        
        self.canvas = tk.Canvas(self.root, cursor="cross", bg="grey11", highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=tk.YES)
        
        self.canvas.bind("<ButtonPress-1>", self.on_button_press)
        self.canvas.bind("<B1-Motion>", self.on_move_press)
        self.canvas.bind("<ButtonRelease-1>", self.on_button_release)
        
        self.rect = None
        self.start_x = None
        self.start_y = None
        
        self.root.mainloop()

    def on_button_press(self, event):
        self.start_x = event.x
        self.start_y = event.y
        self.rect = self.canvas.create_rectangle(self.start_x, self.start_y, 1, 1, outline="red", width=3)

    def on_move_press(self, event):
        cur_x, cur_y = event.x, event.y
        self.canvas.coords(self.rect, self.start_x, self.start_y, cur_x, cur_y)

    def on_button_release(self, event):
        cur_x, cur_y = event.x, event.y
        
        # 1. 抓取逻辑屏幕大小 (必须在窗口 withdraw 前获取)
        screen_w = self.canvas.winfo_screenwidth()
        screen_h = self.canvas.winfo_screenheight()
        
        # 2. 隐藏全屏遮罩窗口
        self.root.withdraw()
        self.root.update()
        
        # 使用 try...finally 确保不论发生何种异常，窗口都必须被销毁，防止界面卡死
        try:
            # 3. 物理坐标转换 (适配高 DPI 屏幕)
            x1 = int(min(self.start_x, cur_x) * (self.image.width / screen_w))
            y1 = int(min(self.start_y, cur_y) * (self.image.height / screen_h))
            x2 = int(max(self.start_x, cur_x) * (self.image.width / screen_w))
            y2 = int(max(self.start_y, cur_y) * (self.image.height / screen_h))
            
            if (x2 - x1) > 5 and (y2 - y1) > 5:
                cropped = self.image.crop((x1, y1, x2, y2))
                
                # 核心过滤：将所有非法字符替换为安全的下划线
                safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', self.icon_name)
                
                save_path = os.path.join(ICONS_SAVE_DIR, f"{safe_name}.png")
                cropped.save(save_path, "PNG")
                self.on_complete(True, f"已保存图标: {self.icon_name} (物理文件名: {safe_name}.png)")
            else:
                self.on_complete(False, "裁剪区域过小，已取消")
        except Exception as e:
            print(f"[裁剪错误] {str(e)}")
            self.on_complete(False, f"裁剪失败: {str(e)}")
        finally:
            # 4. 无论如何，强制销毁全屏置顶窗口并退出 Tkinter 循环
            self.root.destroy()


class FloatingPill:
    def __init__(self, icon_list):
        self.icon_list = icon_list
        self.current_idx = 0
        
        self.root = tk.Tk()
        self.root.title("迷你世界插件图标标记")
        self.root.overrideredirect(True) # 无边框
        self.root.attributes("-topmost", True) # 始终置顶
        self.root.attributes("-alpha", 0.95)
        
        # 拓宽并加高悬浮窗，为示例物品留出极佳的双行呈现排版空间
        sw = self.root.winfo_screenwidth()
        self.root.geometry(f"580x75+{int((sw-580)/2)}+30")
        self.root.configure(bg="#f5f5f7")
        
        # 左侧两行文本容器 (采用苹果风深灰配淡蓝)
        text_frame = tk.Frame(self.root, bg="#f5f5f7")
        text_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=15, pady=8)
        
        self.lbl_title = tk.Label(text_frame, text="", bg="#f5f5f7", fg="#1d1d1f", font=("JetBrains Mono", 10, "bold"), anchor="w")
        self.lbl_title.pack(fill=tk.X)
        
        self.lbl_samples = tk.Label(text_frame, text="", bg="#f5f5f7", fg="#0066cc", font=("JetBrains Mono", 9), anchor="w")
        self.lbl_samples.pack(fill=tk.X)
        
        # 右侧操作按钮容器
        btn_frame = tk.Frame(self.root, bg="#f5f5f7")
        btn_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=10, pady=8)
        
        self.btn_capture = tk.Button(btn_frame, text="截图并裁剪", command=self.trigger_capture, bg="#0071e3", fg="white", font=("JetBrains Mono", 9, "bold"), relief=tk.FLAT, bd=0, padx=10)
        self.btn_capture.pack(side=tk.LEFT, padx=5, fill=tk.Y)
        
        self.btn_skip = tk.Button(btn_frame, text="跳过 (N)", command=self.skip_icon, bg="#e5e5ea", fg="#1d1d1f", font=("JetBrains Mono", 9), relief=tk.FLAT, bd=0, padx=8)
        self.btn_skip.pack(side=tk.LEFT, padx=5, fill=tk.Y)
        
        self.root.bind("<Key>", self.on_key)
        
        self.update_ui()
        self.root.mainloop()

    def on_key(self, event):
        if event.char.lower() == 'n':
            self.skip_icon()
            
    def update_ui(self):
        if self.current_idx >= len(self.icon_list):
            self.root.destroy()
            eel.print_terminal_from_py("[截图标记] 所有图标裁剪流程已结束")()
            return
        
        icon_data = self.icon_list[self.current_idx]
        icon_name = icon_data["icon"]
        samples = icon_data["samples"]
        
        # 实时检测该图标在本地是否存在
        safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', icon_name)
        image_exists = os.path.exists(os.path.join(ICONS_SAVE_DIR, f"{safe_name}.png"))
        
        self.lbl_title.config(text=f"ICON: {icon_name}")
        if image_exists:
            self.lbl_samples.config(text=f"示例: {samples if samples else '暂无示例'} [已有图片 - 可跳过或覆盖]", fg="#d97706")
        else:
            self.lbl_samples.config(text=f"示例: {samples if samples else '暂无示例'}", fg="#0066cc")
        
    def trigger_capture(self):
        self.root.withdraw()
        self.root.update()
        time.sleep(0.15)
        
        icon_data = self.icon_list[self.current_idx]
        icon_name = icon_data["icon"]
        
        def on_snipping_complete(success, msg):
            self.root.deiconify()
            self.root.update()
            if success:
                try:
                    eel.print_terminal_from_py(f"[截图标记] {msg}")()
                    eel.trigger_frontend_matrix_reload()()
                except Exception as e:
                    print(f"[Eel 通信异常] 无法同步前端状态: {str(e)}")
                self.current_idx += 1
            else:
                try:
                    eel.print_terminal_from_py(f"[截图标记] {msg}")()
                except Exception as e:
                    print(f"[Eel 通信异常] 无法同步前端状态: {str(e)}")
            self.update_ui()
            
        Snipper(icon_name, on_snipping_complete)
        
    def skip_icon(self):
        icon_data = self.icon_list[self.current_idx]
        icon_name = icon_data["icon"]
        eel.print_terminal_from_py(f"[截图标记] 已跳过图标: {icon_name}")()
        self.current_idx += 1
        self.update_ui()


@eel.expose
def start_icon_session_py(icon_list):
    # 用独立的线程运行，彻底防止阻塞 Eel 与编辑器的通讯连接
    def run():
        FloatingPill(icon_list)
    threading.Thread(target=run, daemon=True).start()

# ==========================================


# --- 递归解析嵌套的插件 JSON 参数 ---
def recursive_extract_keys(data, target_keys, out_dict=None):
    if out_dict is None:
        out_dict = {}
    if isinstance(data, dict):
        for k, v in data.items():
            if k in target_keys:
                out_dict[k] = v
            if isinstance(v, (dict, list)):
                recursive_extract_keys(v, target_keys, out_dict)
    elif isinstance(data, list):
        for item in data:
            recursive_extract_keys(item, target_keys, out_dict)
    return out_dict

# --- 迷你世界插件扫描 API ---
@eel.expose
def scan_mini_world_plugins():
    if not os.path.exists(MINI_WORLD_BEHAVIOR_DIR):
        return {"error": f"未检测到本地迷你世界插件目录: {MINI_WORLD_BEHAVIOR_DIR}"}
    
    target_keys = [
        "name", "describe", "id", "orignid", "copyid", "stack_max", "author", "filename", "uuid", 
        "version", "multilangname", "multilangdesc", "fullycustommodel", "icon", "model", "weight", 
        "attack", "attackFire", "attackIce", "attackMagic", "attackPoison", "attackWither", "attack_consume", 
        "collect_consume", "tool_duration", "tool_efficient", "tool_level", "tool_type", "tool_repareid1", 
        "tool_repare_amount1", "gun_attack", "gun_speed_add", "gun_type", "fire_interval", "magazines", 
        "bullet_id", "continuous_fire", "need_bullet", "projectile_attack", "speed_init", "speed_decay", 
        "gravity", "break", "can_throw", "pickable", "EquipArmorPhysical", "EquipArmorBurn", "EquipArmorChaos", 
        "EquipArmorExplosion", "EquipArmorMagic", "EquipArmorPunch", "EquipArmorRange", "EquipArmorToxin", 
        "EquipRepelRes", "heal_actor", "heal_stamina", "use_time", "add_food", "add_foodstate", 
        "trigger_condition", "consume_count", "consume_itemid", "accumulate_time", "speed_add", "custommodel"
    ]
    
    plugins_list = []
    subdirs = ["item", "block", "actor", "status"]
    
    for folder in subdirs:
        folder_path = os.path.join(MINI_WORLD_BEHAVIOR_DIR, folder)
        if not os.path.exists(folder_path):
            continue
        
        for filename in os.listdir(folder_path):
            if filename.endswith(".json"):
                file_path = os.path.join(folder_path, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        raw_data = json.load(f)
                    
                    extracted = recursive_extract_keys(raw_data, target_keys)
                    
                    base_filename = filename.replace(".json", "")
                    is_pure_english_filename = re.match(r'^[a-zA-Z0-9_\-]+$', base_filename) is not None
                    
                    icon_val = extracted.get("icon")
                    model_val = extracted.get("fullycustommodel") or extracted.get("custommodel")
                    
                    resolved_icon = "default"
                    if icon_val and str(icon_val).strip() != "" and str(icon_val).lower() != "default":
                        resolved_icon = str(icon_val).strip()
                    elif model_val and str(model_val).strip() != "":
                        resolved_icon = str(model_val).strip()
                    elif is_pure_english_filename:
                        resolved_icon = base_filename
                    
                    extracted["icon"] = resolved_icon
                    
                    plugin_type = "其他"
                    if folder == "block": plugin_type = "方块"
                    elif folder == "actor": plugin_type = "生物"
                    elif folder == "status": plugin_type = "状态"
                    elif folder == "item":
                        gun_type = str(extracted.get("gun_type", ""))
                        if gun_type == "10107": plugin_type = "狙击枪"
                        elif gun_type == "10106": plugin_type = "冲锋枪"
                        elif gun_type == "10105": plugin_type = "手枪"
                        elif extracted.get("attack", 0) > 0 or extracted.get("attackWither", 0) > 0:
                            plugin_type = "近战武器"
                        elif any(extracted.get(k, 0) > 0 for k in ["add_food", "add_foodstate", "heal_stamina"]):
                            plugin_type = "食物"
                        elif extracted.get("can_throw") or extracted.get("projectile_attack", 0) > 0:
                            plugin_type = "投掷物"
                        elif any(extracted.get(k, 0) > 0 for k in ["EquipArmorPhysical", "EquipArmorBurn", "EquipArmorChaos", "EquipArmorExplosion", "EquipArmorMagic"]):
                            plugin_type = "装备"
                        else:
                            plugin_type = "物品"
                    
                    name_val = extracted.get("name", "未命名")
                    if "multilangname" in extracted and isinstance(extracted["multilangname"], str):
                        try:
                            m_name = json.loads(extracted["multilangname"])
                            if "textList" in m_name and m_name["textList"]:
                                name_val = list(m_name["textList"].values())[0]
                        except: pass
                        
                    desc_val = extracted.get("describe", "无描述")
                    if "multilangdesc" in extracted and isinstance(extracted["multilangdesc"], str):
                        try:
                            m_desc = json.loads(extracted["multilangdesc"])
                            if "textList" in m_desc and m_desc["textList"]:
                                desc_val = list(m_desc["textList"].values())[0]
                        except: pass
                    
                    plugins_list.append({
                        "id": extracted.get("id", base_filename),
                        "name": name_val,
                        "describe": desc_val,
                        "icon": resolved_icon,
                        "type": plugin_type,
                        "all_params": extracted
                    })
                except Exception as e:
                    print(f"[读取失败] {filename}: {str(e)}")
                    
    return {"success": True, "plugins": plugins_list}

# --- 文件树系统 API ---
@eel.expose
def get_file_tree():
    if not DATA_PATH or not os.path.isdir(DATA_PATH): return {"error": "未设置有效的工作区目录"}
    def build_tree(dir_path):
        tree = []
        try:
            for entry in sorted(os.scandir(dir_path), key=lambda e: (not e.is_dir(), e.name)):
                rel_path = os.path.relpath(entry.path, DATA_PATH).replace('\\', '/')
                if entry.is_dir():
                    tree.append({"name": entry.name, "type": "dir", "path": rel_path, "children": build_tree(entry.path)})
                elif entry.name.endswith('.lua'):
                    tree.append({"name": entry.name, "type": "file", "path": rel_path})
        except Exception: pass
        return tree
    return {"success": True, "tree": build_tree(DATA_PATH)}

@eel.expose
def get_item_data(rel_path):
    if not DATA_PATH: return {"error": "目录未设置"}
    try:
        with open(os.path.join(DATA_PATH, rel_path), 'r', encoding='utf-8') as f: return f.read()
    except Exception as e: return {"error": str(e)}

@eel.expose
def save_item_data(rel_path, content):
    if not DATA_PATH: return {"error": "目录未设置"}
    try:
        with open(os.path.join(DATA_PATH, rel_path), 'w', encoding='utf-8') as f: f.write(content)
        return {"success": True}
    except Exception as e: return {"error": str(e)}

@eel.expose
def execute_file_cmd(action, target, extra=None):
    if not DATA_PATH: return {"error": "目录未设置"}
    target_path = os.path.join(DATA_PATH, target)
    try:
        if action == "new":
            if extra == "dir": os.makedirs(target_path, exist_ok=True)
            else:
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                open(target_path, 'a', encoding='utf-8').close()
            return {"success": True, "msg": f"已创建 {target}"}
        elif action == "del":
            if os.path.isdir(target_path): shutil.rmtree(target_path)
            else: os.remove(target_path)
            return {"success": True, "msg": f"已删除 {target}"}
        elif action == "back":
            bak_path = target_path + ".bak"
            if os.path.isdir(target_path): shutil.copytree(target_path, bak_path)
            else: shutil.copy2(target_path, bak_path)
            return {"success": True, "msg": f"已备份至 {target}.bak"}
        elif action == "re":
            new_path = os.path.join(DATA_PATH, extra)
            shutil.move(target_path, new_path)
            return {"success": True, "msg": f"已重命名为 {extra}"}
    except Exception as e: return {"error": f"指令执行失败: {str(e)}"}
    return {"error": "未知指令"}

@eel.expose
def run_lua_script(rel_path):
    if not DATA_PATH: return {"error": "目录未设置"}
    file_path = os.path.join(DATA_PATH, rel_path)
    try:
        result = subprocess.run(['lua54', file_path], capture_output=True, text=True, timeout=10)
        output = result.stdout
        if result.stderr: output += f"\n[错误]\n{result.stderr}"
        return {"success": True, "output": output or "[执行完毕，无输出]"}
    except FileNotFoundError: return {"error": "未找到 lua54 解释器"}
    except subprocess.TimeoutExpired: return {"error": "执行超时"}
    except Exception as e: return {"error": str(e)}

@eel.expose
def get_chrome_bookmarks():
    system = platform.system()
    home = os.path.expanduser("~")
    if system == "Windows": path = os.path.join(home, "AppData", "Local", "Google", "Chrome", "User Data", "Default", "Bookmarks")
    elif system == "Darwin": path = os.path.join(home, "Library", "Application Support", "Google", "Chrome", "Default", "Bookmarks")
    else: path = os.path.join(home, ".config", "google-chrome", "Default", "Bookmarks")
    if not os.path.exists(path): return {"error": "未找到本地 Chrome 书签"}
    try:
        with open(path, 'r', encoding='utf-8') as f: data = json.load(f)
        bookmarks = []
        def parse_node(node):
            if node.get("type") == "url": bookmarks.append({"name": node.get("name"), "url": node.get("url")})
            elif node.get("type") == "folder" and "children" in node:
                for child in node["children"]: parse_node(child)
        roots = data.get("roots", {})
        for key in ["bookmark_bar", "other", "synced"]:
            if key in roots: parse_node(roots[key])
        return {"success": True, "bookmarks": bookmarks[:100]}
    except Exception as e: return {"error": f"读取书签失败: {str(e)}"}

@eel.expose
def get_existing_icons():
    try:
        return [os.path.splitext(f)[0] for f in os.listdir(ICONS_SAVE_DIR) if f.endswith('.png')]
    except Exception:
        return []


# ==========================================
# --- 核心打包编译逻辑 (拓扑排序与无损分块) ---
# ==========================================

# 1. 块级词法扫描机
def parse_lua_into_blocks(content):
    lines = content.split('\n')
    blocks = []
    
    in_block = False
    block_buffer = []
    depth = 0
    block_type = None 
    defined_name = None
    
    def clean_line(l):
        # 移除行内注释与双重字符串，排除干扰
        l = re.sub(r'--.*$', '', l)
        l = re.sub(r'".*?"', '""', l)
        l = re.sub(r"'.*?'", "''", l)
        return l

    def get_depth_change(l):
        clean = clean_line(l)
        # 获取深度增加的关键字
        opens = len(re.findall(r'\b(then|do|repeat|function)\b|\{', clean))
        # 获取深度减少的关键字
        closes = len(re.findall(r'\b(end|until)\b|\}', clean))
        return opens - closes

    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            if in_block:
                block_buffer.append(line)
            continue
        
        if not in_block:
            block_buffer = [line]
            in_block = True
            
            # A. 顶层函数声明起步
            func_match = re.match(r'^\s*(local\s+)?function\s+([a-zA-Z0-9_.:]+)', line)
            if func_match:
                block_type = 'function'
                defined_name = func_match.group(2)
                # 处理单行闭合边缘情况
                depth = 1 + get_depth_change(line) - 1
                if depth <= 0:
                    blocks.append({"type": "function", "name": defined_name, "code": '\n'.join(block_buffer)})
                    in_block = False
                continue
            
            # B. 顶层全局或局部赋值起步 (保留完整表格声明不被腰斩)
            assign_match = re.match(r'^\s*(local\s+)?([a-zA-Z0-9_.,\s\[\]"\'\(\)]+)\s*=\s*', line)
            if assign_match:
                block_type = 'global' if not assign_match.group(1) else 'local'
                raw_names = assign_match.group(2)
                name_match = re.search(r'([a-zA-Z_][a-zA-Z0-9_]*)', raw_names)
                defined_name = name_match.group(1) if name_match else None
                
                depth = get_depth_change(line)
                if depth <= 0:
                    blocks.append({"type": block_type, "name": defined_name, "code": '\n'.join(block_buffer)})
                    in_block = False
                continue
            
            # C. 其他边缘顶层执行逻辑
            block_type = 'other'
            defined_name = None
            depth = get_depth_change(line)
            if depth <= 0:
                blocks.append({"type": "other", "name": None, "code": '\n'.join(block_buffer)})
                in_block = False
            continue
            
        else:
            block_buffer.append(line)
            depth += get_depth_change(line)
            if depth <= 0:
                blocks.append({"type": block_type, "name": defined_name, "code": '\n'.join(block_buffer)})
                in_block = False
                
    return blocks

# 2. 拓扑排序解析逻辑
def topological_sort(blocks):
    block_by_name = {}
    for b in blocks:
        if b['name']:
            block_by_name[b['name']] = b
            
    keywords = {"and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while"}
    dependencies = {id(b): set() for b in blocks}
    
    # 构建依赖关系映射
    for b in blocks:
        words = set(re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', b['code']))
        refs = words - keywords
        for ref in refs:
            if ref in block_by_name:
                dep_block = block_by_name[ref]
                if id(dep_block) != id(b):
                    dependencies[id(b)].add(id(dep_block))
                    
    visited = {}
    sorted_blocks = []
    
    def visit(b):
        b_id = id(b)
        if visited.get(b_id, 0) == 1:
            return # 存在环形依赖时跳过
        if visited.get(b_id, 0) == 2:
            return
            
        visited[b_id] = 1
        for dep_id in sorted(dependencies[b_id], key=lambda x: x):
            dep_block = next((x for x in blocks if id(x) == dep_id), None)
            if dep_block:
                visit(dep_block)
                
        visited[b_id] = 2
        sorted_blocks.append(b)
        
    # 强制将全局变量（global）类型排在最前检索，以实现最头部聚集
    ordered_for_visit = sorted(blocks, key=lambda x: (x['type'] != 'global', x['type'] != 'local'))
    for b in ordered_for_visit:
        visit(b)
        
    return sorted_blocks

@eel.expose
def makelua_files(dir_name, output_name):
    if not DATA_PATH: return {"error": "目录未设置"}
    src_dir = os.path.join(DATA_PATH, dir_name)
    if not os.path.isdir(src_dir): return {"error": f"找不到源文件夹: {dir_name}"}
    
    all_blocks = []
    try:
        # 按字母排序遍历工作区合并目录
        for filename in sorted(os.listdir(src_dir)):
            if filename.endswith('.lua'):
                filepath = os.path.join(src_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                file_blocks = parse_lua_into_blocks(content)
                all_blocks.extend(file_blocks)
        
        # 运行依赖性拓扑排序
        sorted_blocks = topological_sort(all_blocks)
        
        # 提取前置声明，以防万一
        func_names = []
        for b in sorted_blocks:
            if b['type'] == 'function' and b['name']:
                name = b['name']
                if '.' not in name and ':' not in name:
                    func_names.append(name)
        
        compiled_lines = [
            "-- ==========================================",
            f"-- Compiled by Lua Studio - {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "-- ==========================================\n"
        ]
        
        # A. 提取出无外界依赖的顶级全局变量块，强行合并至文件最顶端
        globals_list = [b for b in sorted_blocks if b['type'] == 'global']
        others_list = [b for b in sorted_blocks if b['type'] != 'global']
        
        if globals_list:
            compiled_lines.append("-- [全局变量声明置于此处]")
            for g in globals_list:
                compiled_lines.append(g['code'])
                compiled_lines.append("")
            compiled_lines.append("")
            
        # B. 函数前置局部声明防止深度依赖
        if func_names:
            compiled_lines.append("-- [前置定义解决超前引用]")
            for i in range(0, len(func_names), 5):
                chunk = func_names[i:i+5]
                compiled_lines.append(f"local {', '.join(chunk)}")
            compiled_lines.append("")
            
        # C. 按照依赖先后拓扑排序输出所有余下的函数实现与逻辑块
        if others_list:
            for o in others_list:
                compiled_lines.append(o['code'])
                compiled_lines.append("")
                
        out_filepath = os.path.join(DATA_PATH, f"{output_name}.lua")
        with open(out_filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(compiled_lines))
            
        return {"success": True, "msg": f"拓扑依赖合并成功，文件输出至 {output_name}.lua"}
    except Exception as e:
        return {"error": f"编译失败: {str(e)}"}

# --- 辅助函数：智能解析单个 Lua 文件 ---
def parse_lua_file_logic(content):
    lines = content.split('\n')
    functions = []
    globals_vars = []
    locals_vars = []
    main_lines = []
    
    in_multiline_comment = False
    in_function = False
    func_buffer = []
    depth = 0
    
    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue
        if trimmed.startswith('--[['):
            in_multiline_comment = True
        if in_multiline_comment:
            if ']]' in trimmed:
                in_multiline_comment = False
            continue
        if trimmed.startswith('--'):
            continue
        
        # 捕捉独立的顶层函数体
        if not in_function and re.match(r'^\s*(local\s+)?function\s+', line):
            in_function = True
            func_buffer = [line]
            depth = 1
            continue
            
        if in_function:
            func_buffer.append(line)
            # 基础深度计算
            inc = len(re.findall(r'\b(then|do|repeat|function)\b|\{', trimmed))
            dec = len(re.findall(r'\b(end|until)\b|\}', trimmed))
            depth += inc - dec
            if depth <= 0:
                functions.append('\n'.join(func_buffer))
                in_function = False
            continue
        
        # 提取全局和局部变量声明
        if '=' in trimmed and not trimmed.startswith('local '):
            globals_vars.append(line)
        elif trimmed.startswith('local ') and '=' in trimmed:
            locals_vars.append(line)
        else:
            main_lines.append(line)
            
    return globals_vars, locals_vars, functions, main_lines

def main():
    eel.init('web')
    eel.start('index.html', size=(1440, 850), port=8981)

if __name__ == '__main__':
    main()