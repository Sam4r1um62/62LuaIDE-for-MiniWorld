playerTasks ={}







	function itemNum(player,id)



		local result,num1,arr=Backpack:getItemNumByBackpackBar(player,1,id)



		local result,num2,arr=Backpack:getItemNumByBackpackBar(player,2,id)



		local result,num3,arr=Backpack:getItemNumByBackpackBar(player,3,id)



		return (num1 or 0)+(num2 or 0)+(num3 or 0)



	end







	-- 将函数添加到 string 库中（扩展标准库）



	function string.split(input, delimiter)



		input = tostring(input)



		delimiter = tostring(delimiter)



	if (delimiter == "") then return {} end











local pos, arr = 1, {}







	-- 这里的 true 表示使用纯文本匹配，不使用正则模式



	local start_pos, end_pos = string.find(input, delimiter, pos, true)







	while start_pos do



		-- 截取分隔符前面的部分



		table.insert(arr, string.sub(input, pos, start_pos - 1))







		-- 更新下一次查找的起始位置



		pos = end_pos + 1







		-- 查找下一个分隔符



		start_pos, end_pos = string.find(input, delimiter, pos, true)



	end







	-- 将最后一个分隔符之后的内容加入表



	table.insert(arr, string.sub(input, pos))







	return arr











end







local function getTime()



	local code, _time = World:getServerDate(6)



	if code \~= ErrorCode.OK then



		return 1000



	end



	return _time



end







--    local data = {id=id,state="NO",time=gtime}







	-- id%pstate%ptime%qid%p……







	local QSP = "%q" -- 任务间的分隔符



	local PSP = "%p" -- 属性间的分隔符







	function sdq_saveData(player)



		local data = playerTasks[player]



		if not data or #data == 0 then



			return 1000 -- 或者这里应该清空存档？视业务逻辑而定



		end











		-- 使用 table 来缓存字符串，比字符串拼接性能好100倍



	local strList = {}







		for i, task in ipairs(data) do



			-- 确保数据不为nil，防止拼接报错



			local id = task.id or "0"



			local state = task.state or "0"



			local time = tostring(task.time or "0")







			-- 组合单个任务字符串: id%pstate%ptime



			table.insert(strList, id .. PSP .. state .. PSP .. time)



		end







		-- 用 %q 将所有任务连接起来



		-- 结果类似: task1%qtask2%qtask3



		-- table.concat 会自动处理分隔符，不会多也不会少



		local writeIn = table.concat(strList, QSP)







		-- 注意：这里我加上了 player 参数，防止多玩家数据冲突



		-- 如果你的 saveVar 真的不需要 player，请自行去掉



		sdq_saveVar("task", writeIn, player)







		return 0











	end







	function sdq_readData(player)



		if player == nil then



			return 1000



		end











		-- 读取数据



		local task_data = sdq_readVar("task", player)







		-- 判空，防止空字符串导致报错



		if task_data == nil or task_data == "" or task_data == 1000 then



		playerTasks[player] = {}



			return 0



		end







		local tasks = string.split(task_data, QSP)



	local loadedTasks = {} -- 创建一个临时表来存所有任务







		for i, v in ipairs(tasks) do



			-- 这里的 v 是单个任务的字符串，例如 "101%p1%p123456"



			-- 即使 v 是空字符串，split 也可能返回空表，要注意判断



			if v and v ~= "" then



				-- ！！！修正点：这里 split 的是 v，不是 tasks ！！！



				local props = string.split(v, PSP)







				-- 简单校验一下长度，防止数据损坏导致 nil 报错



				if #props >= 3 then



					local id = props[1]



					local state = props[2]



					local time = tonumber(props[3]) or 0







					-- 插入到临时表



					table.insert(loadedTasks, {



						id = id,



						state = state,



						time = time



					})



				end



			end



		end







		-- 循环结束后，一次性赋值给玩家数据



		playerTasks[player] = loadedTasks







		return 0











	end







	local function sdq_dataInit()







	end







	local function anyTaskInPlayerData(player,tarid)



		local data = playerTasks[player]







		for _,task in ipairs(data) do



			if task.id == tarid then



				return true



			end







		end



		return false



	end







	local function anyTaskCanBeGet(player,tarid)



		if not(anyTaskInPlayerData(player,tarid)) then



			return false



		end











		local _,data = ipairs(playerTasks[player])



		for i=1,#data do



			if data[i].id ==tarid then



				if (data[i].state == "OKNONE" or data[i].state == "NONE") then



					return true



				end



				return false



			end



		end



		return false











	end







	local function getQuestDataIndex(player,theid)



		local _,data = ipairs(playerTasks[player])



		for i=1,#data do



			if data[i].id == theid then



				return i



			end



		end



		return 1000



	end







	function sdq_getQuest(player,id)



		if anyTaskInPlayerData(player,id) then



			return 1000



		end











		local gtime = getTime()



		if gtime == 1000 then



			return 1000



		end







	local data = {id=id,state="NO",time=gtime}



		table.insert(playerTasks[player],data)







		sdq_quest[id].whenGet(player,id,sdq_quest[id],gtime)



		if sdq_saveData(player) == 1000 then



			return 1000



		end



	if sdq_saveData(player) == 1000 then return 1000 end



	return 0











end







function sdq_delQuest(player,theid)



	if getQuestDataIndex(player,theid) == 1000 then



		return 1000



	end











	table.remove(playerTasks[player],getQuestDataIndex(player,theid))



	sdq_saveData(player)



	return 0











end







---







local optionsToNumber ={



	[">="]=-1,["<="]=1,["<"]=1,[">"]=-1,



	["="]=0,["\~="] = 0



}







local OKOptions = {">=","<=","<",">","=","\~="}







local frontAdds = {"i","n","b","t","e","et"}







	--i means ITEM which player have and use



	--n means VAR which type is num



	--b means VAR which type is bool



	--t means TIME(HH:MM)



	--e means count of EVENT which will not (be 0 when player finish a task) auto



	--et means count of EVENT which will (be 0 when player finish a task) auto







local bools = {"false","true"}







	--false:不行



	--1000：炸裂错误



	local function isExprOK(expr)



		local parts = string.split(expr, " ")



		local len = #parts











		-- 【炸裂 1000】基础长度校验



	if len ~= 3 and len ~= 5 then return 1000 end







	-- === 辅助检查函数 === --







	-- 检查是否为布尔字符串（支持 true/false）



	local function isBoolFormat(str)



		return str == "true" or str == "false"



	end







	-- 检查是否为时间格式 HH:MM



	local function isTimeFormat(str)



	if type(str) ~= "string" then return false end



	local h, m = string.match(str, "^(%d%d?):(%d%d)$")



if not h then return false end



h, m = tonumber(h), tonumber(m)



return h >= 0 and h <= 23 and m >= 0 and m <= 59



end







-- 检查符号是否允许用于布尔值 (仅限 ==, ~=, !=)



local function isBoolOp(op)



	return op == "==" or op == "~=" or op == "!="



end







-- === 核心逻辑 === --







-- 提取关键部位



local p1 = parts[1]



local op1 = parts[2]



local p3 = parts[3]







-- 预先检查所有符号是否在合法列表中



if not OKOptions[op1] then return 1000 end



if len == 5 and not OKOptions[parts[4]] then return 1000 end







-- ------------------------------------------------------



-- 分支 A: 布尔值模式 (Boolean)



-- 规则：只能3项，符号限制等于/不等于



-- ------------------------------------------------------



if isBoolFormat(p1) or (len == 3 and isBoolFormat(p3)) then



	-- 【炸裂 1000】布尔值不支持5项连写 (例如 true == i_1 == false 是非法的)



if len == 5 then return 1000 end







-- 【炸裂 1000】符号必须是判定相等的



if not isBoolOp(op1) then return 1000 end







-- 确定谁是变量，谁是常数



local varStr = isBoolFormat(p1) and p3 or p1







-- 检查变量合法性 (直接复用 isItemVar)



local res = isItemVar(varStr)



if res ~= true then return res end







return true



end







-- ------------------------------------------------------



-- 分支 B: 时间模式 (Time HH:MM)



-- 规则：支持3项和5项，格式必须正确



-- ------------------------------------------------------



-- 判断依据：3项时首尾有时间串，或5项时首尾都是时间串



local isTimeMode = false



if len == 3 then



if isTimeFormat(p1) or isTimeFormat(p3) then isTimeMode = true end



elseif len == 5 then



if isTimeFormat(p1) and isTimeFormat(parts[5]) then isTimeMode = true end



end







if isTimeMode then



	-- 3项模式: "12:00 > i_1" 或 "i_1 < 14:00"



	if len == 3 then



		local isP1Time = isTimeFormat(p1)



		local isP3Time = isTimeFormat(p3)







		-- 【炸裂 1000】不能两个都是时间，也不能都不是时间(逻辑死锁防范)



	if isP1Time and isP3Time then return 1000 end



if (not isP1Time) and (not isP3Time) then return 1000 end







local varStr = isP1Time and p3 or p1



local res = isItemVar(varStr)



if res ~= true then return res end







return true







-- 5项模式: "10:00 < i_1 < 12:00"



elseif len == 5 then



	-- 此时 p1 和 parts[5] 肯定是时间（上面判断过了），检查中间的变量



	local varStr = parts[3]



	local op2 = parts[4]







	-- 【逻辑 false】检查不等式方向是否冲突



	if optionsToNumber[op1] * optionsToNumber[op2] < 1 then



		return false



	end







	local res = isItemVar(varStr)



if res ~= true then return res end







return true



end



end







-- ------------------------------------------------------



-- 分支 C: 数字模式 (Number)



-- 规则：原有的数字逻辑



-- ------------------------------------------------------



local n1 = tonumber(p1)







-- 3项模式



if len == 3 then



	local n3 = tonumber(p3)







	-- 情况: 变量 op 常数



	if n1 == nil and n3 ~= nil then



		local res = isItemVar(p1)



	if res ~= true then return res end



	return true







	-- 情况: 常数 op 变量



elseif n1 ~= nil and n3 == nil then



	local res = isItemVar(p3)



if res ~= true then return res end



return true







-- 两个都是数，或者都不是数 -> 炸裂



else



	return 1000



end







-- 5项模式



elseif len == 5 then



	local n5 = tonumber(parts[5])



	local op2 = parts[4]



	local varStr = parts[3]







	-- 首尾必须是数字



if n1 == nil or n5 == nil then return 1000 end







-- 检查原来的 bools 表限制 (如果存在这个全局表)



if bools and (bools[p1] or bools[parts[5]]) then return 1000 end







-- 【逻辑 false】方向冲突



if optionsToNumber[op1] * optionsToNumber[op2] < 1 then



	return false



end







-- 检查中间变量



local res = isItemVar(varStr)



if res ~= true then return res end







return true



end







-- 如果什么模式都匹配不上 (例如: "abc > def")



return 1000











end





-- #region isItemVar

local function isItemVar(item)



	-- 防御性编程：如果是nil或者不是字符串，直接炸



	if type(item) \~= "string" then



		return 1000



	end

	-- #endregion isItemVar









	local parts = string.split(item, "_")







	-- 【炸裂 1000】格式必须是 "前缀_ID"，分割后必须是2部分



	if #parts ~= 2 then



		return 1000



	end







	local prefix = parts[1]



	local idStr = parts[2]







	-- 【炸裂 1000】前缀必须在允许的列表中 (frontAdds)



	if not frontAdds[prefix] then



		return 1000



	end







	-- 针对物品 "i" 的特殊检查



	if prefix == "i" then



		local id = tonumber(idStr)







		-- 【炸裂 1000】如果是物品，后缀必须是数字



		if id == nil then



			return 1000



		end







		-- 【不行 false】格式完美，但游戏里没这个物品ID



		local _, _name = Item:getItemName(id)



		if _name == nil then



			return false



		end



	end







	-- 如果是其他前缀（如 time, event 等）或者物品检查通过



	return true











end







-- 比较两个值的辅助函数



local function doCompare(val1, op, val2)



if op == "==" or op == "=" then return val1 == val2 end



if op == "\~=" or op == "!=" then return val1 \~= val2 end











-- 对于不等号，确保两边都是数字或时间字符串



if type(val1) ~= type(val2) then return false end







if op == ">" then return val1 > val2 end



if op == "<" then return val1 < val2 end



if op == ">=" then return val1 >= val2 end



if op == "<=" then return val1 <= val2 end







return false











end







-- 获取格式化时间 HH:MM



local function getCurrentTimeStr()



	local ts = getTime()



if ts == 0 or ts == 1000 then return "00:00" end -- 获取失败兜底



	-- MiniWorld Lua 中 os.date 可以格式化时间戳



	return os.date("%H:%M", math.floor(ts))



end







-- =======================================================



-- 核心函数：sdq_isOKByExpr



-- =======================================================







function sdq_isOKByExpr(expr, player)



	-- 1. 先进行语法静态检查



	local syntaxCheck = isExprOK(expr)



	if syntaxCheck \~= true then



		-- 如果返回 1000 (错误) 或 false (物品不存在等逻辑错误)，直接透传



		return syntaxCheck



	end











	local parts = string.split(expr, " ")



	local len = #parts







	-- 2. 解析表达式结构，找出 变量串(varStr) 和 常数位置



	-- 我们需要复用 isExprOK 的判断逻辑来确定谁是变量



	local varStr = ""



	local valPosition = 0 -- 1: 变量在左(3项), 2: 变量在右(3项), 3: 变量在中间(5项)







	-- 辅助判断函数（必须与 isExprOK 逻辑一致）



local function isBool(s) return s == "true" or s == "false" end



local function isTime(s) return type(s)=="string" and string.match(s, "^%d%d?:%d%d$") end



local function isNum(s) return tonumber(s) ~= nil end







-- ---------------------------------------------------



-- 定位变量



-- ---------------------------------------------------



if len == 5 then



	varStr = parts[3]



	valPosition = 3



else -- len == 3



	local p1, p3 = parts[1], parts[3]







	-- 布尔模式



	if isBool(p1) then varStr, valPosition = p3, 2



	elseif isBool(p3) then varStr, valPosition = p1, 1







		-- 时间模式



	elseif isTime(p1) and not isTime(p3) then varStr, valPosition = p3, 2



	elseif not isTime(p1) and isTime(p3) then varStr, valPosition = p1, 1







		-- 数字模式



	elseif isNum(p1) and not isNum(p3) then varStr, valPosition = p3, 2



	elseif not isNum(p1) and isNum(p3) then varStr, valPosition = p1, 1







	-- 这里的 else 理论上不会走到，因为 isExprOK 已经拦截了



	else return 1000 end



end







-- 3. 解析变量前缀并获取实际值 (Real Value)



local vParts = string.split(varStr, "_")



local pre = vParts[1]



local id = vParts[2]







local realVal = nil







-- === 变量获取逻辑 ===



if pre == "i" then



	-- [i] 物品: 获取背包数量







	local num = itemNum(player, tonumber(id))



if num == nil then return 1000 end



realVal = num







elseif pre == "n" or pre == "b" then



	-- [n/b] 变量: 读取 sdq_vars



	-- sdq_readVar 内部已经处理了 global/player 的区分，我们只需要传入 player 对象即可



	local val, code = sdq_readVar(id, player)



if code ~= 0 then return 1000 end -- 变量未注册或读取失败



	realVal = val







elseif pre == "t" then



	-- [t] 时间: 获取当前服务器时间字符串 HH:MM



	realVal = getCurrentTimeStr()







elseif pre == "e" or pre == "et" then



	-- [e/et] 事件: 调用补充的函数



	realVal = getEventCount(id,pre, player)







else



	return 1000 -- 未知前缀



end







-- 4. 执行比较逻辑



-- ---------------------------------------------------







if len == 3 then



	local p1, op, p3 = parts[1], parts[2], parts[3]



	local checkVal = nil







	-- 如果变量在左边 (i_1 > 10)，比较 realVal > 10



	if valPosition == 1 then



		-- p3 是常数，需要根据 realVal 类型进行转换



		if type(realVal) == "number" then checkVal = tonumber(p3)



		elseif type(realVal) == "boolean" then checkVal = (p3 == "true")



		else checkVal = p3 end -- string/time







		return doCompare(realVal, op, checkVal)







		-- 如果变量在右边 (10 < i_1)，比较 10 < realVal



	else







		-- p1 是常数



		if type(realVal) == "number" then checkVal = tonumber(p1)



		elseif type(realVal) == "boolean" then checkVal = (p1 == "true")



		else checkVal = p1 end







		return doCompare(checkVal, op, realVal)



	end







elseif len == 5 then



	-- 结构: const1 op1 var op2 const2



	-- 例如: 10 < i_1 < 20



	local c1Str, op1, op2, c2Str = parts[1], parts[2], parts[4], parts[5]



	local c1, c2







	-- 类型转换



	if type(realVal) == "number" then



		c1 = tonumber(c1Str)



		c2 = tonumber(c2Str)



	else



		-- 时间字符串比较可以直接用字符串



		c1 = c1Str



		c2 = c2Str



	end







	-- 必须同时满足两个条件



	-- 比如 10 < i_1  AND  i_1 < 20



	-- 这里巧妙利用 doCompare，注意参数顺序



	-- 表达式: C1 OP1 VAR OP2 C2



	-- 拆解为: (C1 OP1 RealVal) AND (RealVal OP2 C2)



	-- 注意：如果 OP1 是 ">" (10 > i_1)，逻辑是一样的







	local res1 = doCompare(c1, op1, realVal)



if not res1 then return false end







local res2 = doCompare(realVal, op2, c2)



return res2



end







return 1000 -- 异常兜底











end







local function findCond(questId)



	-- 【修复】nil 检查



if not sdq_quest[questId] then return {} end



local conds = {}



	for i,v in ipairs(sdq_quest[questId]) do



		-- 【修复】v.expr 可能为 nil



		if v.expr then



			table.insert(conds, v.expr)



		end



	end



	return conds



end







local function isItem(v)



if v == nil then return 1000 end











if v.prizetype == 'item' and type(v.item) == "number" then



return {id=v.item,num=v.value}



end











end







local function isVar(v)



if v == nil then return 1000 end











if v.prizetype =='var' and (string.split(v.item,"_")[1]=="n" or string.split(v.item,"_")[1]=="b") then



	local _,res = sdq_readVar(string.split(v.item,"_")[2])



if res == 1000 then return 1000 end



return {id=string.split(v.item,"_")[2],num=v.value}



end



return 1000











end







local function isEvent(v)



if v == nil then return 1000 end



if v.prizetype == "event" and string.split(v.item,"_")[1]=="e" then



return {id=v.item,num=v.value}



end











return 1000











end







local function canPlayerGet(i,p)



	for _,v in ipairs(i) do



		local result=Backpack:enoughSpaceForItem(p,v.id,v.num)



	if result \~= 0 then return false end



end











return true











end







local function makeFunction(itemList, varList, eventList)











	-- 1. 构造执行函数 (给予奖励)



	local function executeFunc(p)



		-- 给物品



		for _, v in ipairs(itemList) do



			-- 【修正】使用 v.id, v.num



			Player:gainItems(p, v.id, v.num, 1)



		end







		-- 给变量



		for _, v in ipairs(varList) do



			sdq_addVar(v.id, v.num, p)



		end







		-- 给事件



		for _, v in ipairs(eventList) do



			sdq_addEvent(v.id, "e", p, v.num)



		end



	end







	-- 2. 构造检查函数 (在发放前调用)



	local function checkFunc(p)



		-- 目前只检查了物品空间，如有需要也可以加其他检查



		return canPlayerGet(itemList, p)



	end







	return executeFunc, checkFunc







end







local function findPrize(questId)



	if questId == nil or sdq_quest[questId] == nil then



		return nil, nil



	end











local itemP = {}



local varP = {}



local eventP = {}







	for _, v in ipairs(sdq_quest[questId]) do



		if v.prizetype ~= nil then



			-- 【修正】先获取结果，只有结果不为 nil 才插入



			-- 这样避免了插入 1000 导致后续遍历报错



			local itemData = isItem(v)



		if itemData then table.insert(itemP, itemData) end







		local varData = isVar(v)



	if varData then table.insert(varP, varData) end







	local eventData = isEvent(v)



if eventData then table.insert(eventP, eventData) end



end



end







return makeFunction(itemP, varP, eventP)











end







function sdq_prize(player, questId)



if player == nil or questId == nil then return 1000 end











-- 获取 "给予函数" 和 "检查函数"



local doPrize, checkPrize = findPrize(questId)







if doPrize and checkPrize then



	-- 先检查条件（例如背包是否已满）



	if checkPrize(player) then



		-- 条件满足，发放奖励



		doPrize(player)



		return 0 -- 成功



	else



		return 1000 -- 错误码：背包满或条件不足



	end



else



	return 1000 -- 错误码：任务不存在或数据错误



end











end







-- 此函数通常位于主逻辑文件中

-- #region check 

function sdq_checkTaskOne(player, questId)



	local idx = getQuestDataIndex(player, questId)



    if idx == 1000 then return end











    local taskData = playerTasks[player][idx]



    if taskData.state ~= "NO" then return end -- 已经完成或未接取







        local conf = sdq_quest[questId]



    if not conf then return end







    local isAllMet = true







    -- 1. 遍历配置中的所有条件项进行检查



    for _, item in ipairs(conf) do



        if item.expression then



            local result = sdq_isOKByExpr(item.expression, player)



            if result ~= true then



                isAllMet = false



                break



            end



        end



end

-- #endregion check





-- 2. 如果所有条件都满足



if isAllMet then



	-- === [新增逻辑开始] et类型事件自动归零 ===



	for _, item in ipairs(conf) do



		if item.expression then



			-- 将表达式拆分，寻找含有 et_ 前缀的字符串



			local parts = string.split(item.expression, " ")







			for _, part in ipairs(parts) do



				-- 简单的字符串检查：长度大于3且前缀为 "et_"



				if type(part) == "string" and string.len(part) > 3 and string.sub(part, 1, 3) == "et_" then







				-- 再次拆分以获取 ID，例如 "et_killMob" -> {"et", "killMob"}



					local vParts = string.split(part, "_")







					-- 确保格式正确：前缀是et，且有对应的ID



					if #vParts == 2 and vParts[1] == "et" then



						local eventId = vParts[2]







						-- 调用第三个文件中定义的清零函数



						-- 注意：这里假设 setEtZero 已经加载并可用



						if setEtZero then



							setEtZero(eventId, player)



						end



					end



				end



			end



		end



	end



	-- === [新增逻辑结束] ===







	-- 状态流转：NO -> OK



	taskData.state = "OK"







	-- 发放奖励



	sdq_prize(player, questId)







	-- 执行完成回调



	if conf.whenFinish then



		conf.whenFinish(player, questId, conf, getTime())



	end







	-- 保存数据（保存任务状态变更 + 可能的事件归零变更）



	sdq_saveData(player)



	-- 建议：如果事件归零是存在另一个单独的存储里的，这里可能还需要调用 sdq_saveEventVar(player)



	if sdq_saveEventVar then



		sdq_saveEventVar(player)



	end



end











end







local function GameStart()



	sdq_regVar("task","str",true,"任务")



	sdq_regVar("event","str",true,"事件")



	sdq_regVar("score","num",true,"日常任务分数")



end



ScriptSupportEvent:registerEvent([=[Game.Start]=], GameStart)







local function EnterGame(e)



	sdq_readData(e.eventobjid)



	sdq_readEventVar(e.eventobjid)



end







ScriptSupportEvent:registerEvent([=[Game.AnyPlayer.EnterGame]=],EnterGame)--任一玩家进入游戏eventobjid, toobjid