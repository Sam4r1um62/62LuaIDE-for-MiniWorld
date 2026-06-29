
sdq_eventTemp = {
    
    
}

--[player]={[id]={id=id(str),type=type(bool),count=count(num)}}
function addEvent(e,_type,player,num)
    if type(e)~="string" or type(_type) ~="boolean" or type(player) ~= "number" or type(num) ~= "number" then
        return 1000
    end
    
    local count = getEventCount(e,_type,player)
    sdq_eventTemp[player][e]={id=e,type=_type,count=count+num}
    sdq_saveEventVar(player)
    return 0
end

function setEtZero(e,player)
    if not(sdq_eventTemp[player][e]) then
        return 1000
    end
    
    sdq_eventTemp[player][e] = {id=e,type=true,count=0}
    sdq_saveEventVar(player)
    return 0 
end

function getEventCount(evtId,evtType, player)
    if type(evtId)~="string" or type(evtType) ~="str" or type(player) ~= "number" then
        return nil,1000
    end
    
    if not(sdq_eventTemp[player][evtId]) then
        return nil,1000
    end
    
    return sdq_eventTemp[player][evtId].count
end



local QSP = "%q" -- 事件之间的分隔符
local PSP = "%p" -- 属性之间的分隔符 (id, type, count)

function sdq_saveEventVar(player)
    -- 1. 安全检查：如果这个玩家甚至没有数据表，直接返回
    local pData = sdq_eventTemp[player]
    if not pData then
        return 1000
    end
    
    local strList = {}
    
    for k, v in pairs(pData) do
        local id = v.id
        local eType = tostring(v.type) 
        local count = v.count
        
        -- 格式：id%ptype%pcount
        table.insert(strList, id..PSP..eType..PSP..count)
    end
    

    local writeIn = table.concat(strList, QSP)
    

    sdq_saveVar("event", writeIn, player)
    
    return 0
end

function sdq_readEventVar(player)
    if player == nil then return 1000 end
    
    -- 1. 读取字符串
    local event_str = sdq_readVar("event", player)
    
    -- 2. 初始化玩家数据表 (非常重要！否则后面 addEvent 会报 nil index)
    sdq_eventTemp[player] = {}
    
    if event_str == nil or event_str == "" then
        return 0 -- 没有存档也是正常的，只要初始化了表就行
    end
    
    -- 3. 分割
    local eventList = string.split(event_str, QSP)
    
    for _, v in ipairs(eventList) do
        if v and v ~= "" then
            local props = string.split(v, PSP)
            
            if #props >= 3 then
                local id = props[1]
                -- 处理布尔值转换：字符串 "true" 转为 boolean true
                local eType = (props[2] == "true") 
                local count = tonumber(props[3]) or 0
                
                -- 4. 恢复数据结构
                -- 注意：你的结构 key 是 id，value 是 table
                sdq_eventTemp[player][id] = {
                    id = id,
                    type = eType,
                    count = count
                }
            end
        end
    end
    
    return 0
end






