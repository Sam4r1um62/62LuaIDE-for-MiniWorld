

sdq_quest ={

}



sdq_quest["test"]={

    name = "测试任务",

    desc = "用来测试",

    type= 'once',

    {condtype='item',expression="i_4111 >= 5"},

    {prizetype='item',item=4111,value=10},

    whenGet = function(player, questId, questData,  gTime) print('get_test') end,

    whenFinish = function(player, questId, questData, fTime) print('finish_test') end,

}



sdq_quest["wt1_pve"] = {

    name = "世界等级1-PVE总任务",

    type = "daily",

    {expression = "e_WT1PVE >= 50"},

    {prizetype = "var", item = "score", value = 25},

    whenGet = function(player, questId, questData, gTime) print("接取了"..questId) end,

    whenFinish = function(player, questId, questData, fTime) print("完成了"..questId) end,

}



sdq_quest["wt1pvp"] = {

    name = "世界等级1-PVP总任务",

    type = "daily",

    {expression = "e_wt1pvp >= 4"},

    {prizetype = "var", item = "score", value = 25},

    whenGet = function(player, questId, questData, gTime) print("接取了"..questId) end,

    whenFinish = function(player, questId, questData, fTime) print("完成了"..questId) end,

}



sdq_quest["pas_out"] = {

    name = "帕斯湾撤离",

    type = "daily",

    {expression = "e_pas_out >= 2"},

    {prizetype = "var", item = "score", value = 1},

    whenGet = function(player, questId, questData, gTime) print("接取了"..questId) end,

    whenFinish = function(player, questId, questData, fTime) print("完成了"..questId) end,

}



sdq_quest["out_combo5"] = {

    name = "连续撤离五次",

    type = "daily",

    {expression = "e_pas_out_combo >= 5"},

    {prizetype = "var", item = "score", value = 3},

    whenGet = function(player, questId, questData, gTime) print("接取了"..questId) end,

    whenFinish = function(player, questId, questData, fTime) print("完成了"..questId) end,

}



sdq_quest["make"] = {

    name = "使用合成机",

    type = "daily",

    {expression = "e_make >= 1"},

    {prizetype = "var", item = "score", value = 1},

    whenGet = function(player, questId, questData, gTime) print("接取了"..questId) end,

    whenFinish = function(player, questId, questData, fTime) print("完成了"..questId) end,

}



sdq_quest["move500"] = {

    name = "移动",

    type = "daily",

    {expression = "e_move >= 500"},

    {prizetype = "var", item = "score", value = 2},

    whenGet = function(player, questId, questData, gTime) print("接取了"..questId) end,

    whenFinish = function(player, questId, questData, fTime) print("完成了"..questId) end,

}



sdq_quest["collecter_1"] = {

    name = "收集者_1",

    type = "daily",

    {expression = "i_4260 >= 15"},

    {expression = "i_4266 >= 1"},

    {prizetype = "var", item = "score", value = 3},

    {prizetype = "item", item = 4267, value = 1},

    whenGet = function(player, questId, questData, gTime) print("接取了"..questId) end,

    whenFinish = collecter_1,

}



collecter_1 =function(player,questId,questData,gTime)

    local result,num=Backpack:removeGridItemByItemID(player,4260,15)

    local result,num=Backpack:removeGridItemByItemID(player,4266,1)

end



sdq_quest["collecter_2"] = {

    name = "收集者_2",

    type = "daily",

    {expression = "i_4272 >= 2"},

    {expression = "i_4273 >= 2"},

    {expression = "i_4266 >= 1"},

    {prizetype = "var", item = "score", value = 5},

    {prizetype = "item", item = 4267, value = 1},

    whenGet = function(player, questId, questData, gTime) print("接取了"..questId) end,

    whenFinish = collecter_2,

}



collecter_2 =function(player,questId,questData,gTime)

    local result,num=Backpack:removeGridItemByItemID(player,4272,2)

    local result,num=Backpack:removeGridItemByItemID(player,4273,2)

    local result,num=Backpack:removeGridItemByItemID(player,4266,1)

end



sdq_quest["collecter_3"] = {

    name = "收集者_3",

    type = "daily",

    {expression = "i_4272 >= 2"},

    {expression = "i_4273 >= 5"},

    {expression = "i_4266 >= 1"},

    {prizetype = "var", item = "score", value = 5},

    {prizetype = "item", item = 4267, value = 1},

    {prizetype = "item", item = 11204, value = 15},

    whenGet = function(player, questId, questData, gTime) print("接取了"..questId) end,

    whenFinish = collecter_3,

}



collecter_3 =function(player,questId,questData,gTime)

    local result,num=Backpack:removeGridItemByItemID(player,4272,2)

    local result,num=Backpack:removeGridItemByItemID(player,4273,5)

    local result,num=Backpack:removeGridItemByItemID(player,4266,1)

end