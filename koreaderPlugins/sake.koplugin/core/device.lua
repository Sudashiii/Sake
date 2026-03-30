local logger = require("core/log")
local Settings = require("core/settings")

local SakeDevice = {}

function SakeDevice.ensure(settings)
    settings = settings or {}
    local stored_name = settings.device_name
    if not stored_name or stored_name == "" then
        logger.info("[Sake] No device name found. Generating new ID...")
        local now = tostring(os.time() or 0)
        local addr = tostring({}):gsub("^table:%s*", "")
        stored_name = "device_" .. now .. "_" .. addr
        stored_name = stored_name:gsub("[^%w_%-]", "")
        Settings.saveField(settings, "device_name", stored_name)
    end
    settings.device_name = stored_name
    return stored_name
end

return SakeDevice
