local has_network_mgr, NetworkMgr = pcall(require, "ui/network/manager")

local Network = {}
Network.__index = Network

function Network:new()
    return setmetatable({}, self)
end

function Network:isAvailable()
    return has_network_mgr and NetworkMgr ~= nil
end

function Network:willRerunWhenOnline(callback)
    if not self:isAvailable() or type(callback) ~= "function" then
        return false
    end

    if type(NetworkMgr.willRerunWhenOnline) ~= "function" then
        return false
    end

    return NetworkMgr:willRerunWhenOnline(callback) == true
end

return Network
