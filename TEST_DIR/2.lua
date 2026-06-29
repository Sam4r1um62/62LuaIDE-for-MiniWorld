tte = { 
    ["pos"]=1,
    ["ara"]=2,
    ["num"]=3,
    ["str"] = 4,
    ["bol"]=5,
    ["plr"]=6,
    ["plrs"]=7,
    ["blk"]=8,
    ["itm"]=9,
    ["mob"]=10
}




sdq_vars = {
    
}

--[name]={type=enum,player=isPlayer,truename="truename"}

function sdq_regVar(name,stype,splayer,struename)
    if sdq_vars[name] then
        return 1000
    end
    sdq_vars[name] = {type=tte[stype],player=splayer,truename=struename}
    return 0
end

function sdq_readVar(name,plr)
    if not(sdq_vars[name]) then
        return nil,1000
    end
    local enum = tte[sdq_vars[name].type]
    local plr = sdq_vars[name].player
    local tn = sdq_vars[name].truename
    local v = 0
    local code = 0
    
    if plr == false then
        code,v = VarLib2:getGlobalVarByName(enum,tn)
    end

    if plr == true then
        code,v = VarLib2:getPlayerVarByName(enum,tn,plr)
    end
    
    if v == nil then
        return nil,1000
    end
    
    return v,0

end

function sdq_saveVar(name,value,plr)
    if not(sdq_vars[name]) then
        return 1000
    end
    local enum = tte[sdq_vars[name].type]
    local plr = sdq_vars[name].player
    local tn = sdq_vars[name].truename
    
    local code = 0
    
    if plr == false then
        code = VarLib2:setGlobalVarByName(enum,tn,value)
    end

    if plr == true then
        code = VarLib2:setPlayerVarByName(enum,tn,plr,value)
    end
    
    if code == ErrorCode.FAILED then
        return 1000
    end
    
    return 0

end

function sdq_addVar(name,value,plr)
   local ov,code = sdq_readVar(name,plr)
   local isSvOK = sdq_saveVar(name,ov+value,plr)
   
   if not(code==0) or not(isSvOK == 0) then
       return 1000
   end
   
   return 0
end

