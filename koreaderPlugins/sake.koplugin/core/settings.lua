local logger = require("logger")

local Settings = {}

local KEY_MAP = {
    api_url = "sake_api_url",
    api_user = "sake_api_user",
    api_pass = "sake_api_pass",
    device_name = "sake_device_name",
    home_dir = "home_dir",
}

function Settings.load()
    return {
        api_url = G_reader_settings:readSetting(KEY_MAP.api_url) or "",
        api_user = G_reader_settings:readSetting(KEY_MAP.api_user) or "",
        api_pass = G_reader_settings:readSetting(KEY_MAP.api_pass) or "",
        device_name = G_reader_settings:readSetting(KEY_MAP.device_name),
        home_dir = G_reader_settings:readSetting(KEY_MAP.home_dir) or ".",
    }
end

function Settings.saveKey(setting_key, value)
    G_reader_settings:saveSetting(setting_key, value)
end

function Settings.saveField(settings, field, value)
    local key = KEY_MAP[field]
    if not key then
        logger.warn("[Sake] Unknown settings field: " .. tostring(field))
        return
    end
    settings[field] = value
    Settings.saveKey(key, value)
end

function Settings.validateRequired(settings)
    local missing = {}
    if not settings.api_url or settings.api_url == "" then table.insert(missing, "API URL") end
    if not settings.api_user or settings.api_user == "" then table.insert(missing, "API Username") end
    if not settings.api_pass or settings.api_pass == "" then table.insert(missing, "API Password") end
    if not settings.device_name or settings.device_name == "" then table.insert(missing, "Device Name") end
    if #missing > 0 then
        return false, table.concat(missing, ", ")
    end
    return true
end

function Settings.keyFor(field)
    return KEY_MAP[field]
end

return Settings
