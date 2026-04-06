local logger = require("core/log")

local Settings = {}

local KEY_MAP = {
    api_url = "sake_api_url",
    api_user = "sake_api_user",
    api_pass = "sake_api_pass",
    api_key = "sake_api_key",
    device_name = "sake_device_name",
    log_shipping_enabled = "sake_log_shipping_enabled",
    disable_automatic_book_sync_wakeup = "sake_disable_automatic_book_sync_wakeup",
    disable_automatic_progress_download_wakeup = "sake_disable_automatic_progress_download_wakeup",
    disable_automatic_progress_download_reader_ready = "sake_disable_automatic_progress_download_reader_ready",
    disable_automatic_progress_sync_sleep = "sake_disable_automatic_progress_sync_sleep",
    disable_automatic_progress_sync_close = "sake_disable_automatic_progress_sync_close",
    home_dir = "home_dir",
}

local function readBooleanSetting(key, default_value)
    local value = G_reader_settings:readSetting(key)
    if value == nil then
        return default_value == true
    end
    return value == true or value == "true"
end

function Settings.load()
    return {
        api_url = G_reader_settings:readSetting(KEY_MAP.api_url) or "",
        api_user = G_reader_settings:readSetting(KEY_MAP.api_user) or "",
        api_pass = G_reader_settings:readSetting(KEY_MAP.api_pass) or "",
        api_key = G_reader_settings:readSetting(KEY_MAP.api_key) or "",
        device_name = G_reader_settings:readSetting(KEY_MAP.device_name),
        log_shipping_enabled = readBooleanSetting(KEY_MAP.log_shipping_enabled),
        disable_automatic_book_sync_wakeup = readBooleanSetting(KEY_MAP.disable_automatic_book_sync_wakeup, false),
        disable_automatic_progress_download_wakeup = readBooleanSetting(KEY_MAP.disable_automatic_progress_download_wakeup, false),
        disable_automatic_progress_download_reader_ready = readBooleanSetting(KEY_MAP.disable_automatic_progress_download_reader_ready, false),
        disable_automatic_progress_sync_sleep = readBooleanSetting(KEY_MAP.disable_automatic_progress_sync_sleep, false),
        disable_automatic_progress_sync_close = readBooleanSetting(KEY_MAP.disable_automatic_progress_sync_close, false),
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
    if not settings.api_url or settings.api_url == "" then table.insert(missing, "Server URL") end
    if not settings.device_name or settings.device_name == "" then table.insert(missing, "Device Name") end
    local has_api_key = settings.api_key and settings.api_key ~= ""
    local has_pairing_credentials = settings.api_user and settings.api_user ~= ""
        and settings.api_pass and settings.api_pass ~= ""
    if not has_api_key and not has_pairing_credentials then
        table.insert(missing, "Device Key")
    end
    if #missing > 0 then
        return false, table.concat(missing, ", ")
    end
    return true
end

function Settings.validatePairingSetup(settings)
    local missing = {}
    if not settings.api_url or settings.api_url == "" then table.insert(missing, "Server URL") end
    if not settings.device_name or settings.device_name == "" then table.insert(missing, "Device Name") end
    if #missing > 0 then
        return false, table.concat(missing, ", ")
    end
    return true
end

function Settings.validatePairingRequired(settings)
    local missing = {}
    if not settings.api_url or settings.api_url == "" then table.insert(missing, "Server URL") end
    if not settings.api_user or settings.api_user == "" then table.insert(missing, "Login Username") end
    if not settings.api_pass or settings.api_pass == "" then table.insert(missing, "Login Password") end
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
