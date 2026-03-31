local UIManager = require("ui/uimanager")

local Network = require("adapters/network")

local LogShipper = {}

local MAX_PENDING_LOGS = 100
local FLUSH_DELAY_SECONDS = 0.05

local settings_ref = nil
local pending_logs = {}
local flush_scheduled = false
local flush_in_progress = false
local retry_when_online_registered = false
local network = Network:new()

local function trim(value)
    return tostring(value or ""):gsub("^%s+", ""):gsub("%s+$", "")
end

local function isEnabled()
    return settings_ref ~= nil and settings_ref.log_shipping_enabled == true
end

local function hasShippingPrerequisites()
    if not settings_ref then
        return false
    end

    return trim(settings_ref.api_url) ~= ""
        and trim(settings_ref.device_name) ~= ""
        and trim(settings_ref.api_key) ~= ""
end

local function scheduleFlush()
    if flush_scheduled then
        return
    end

    flush_scheduled = true
    UIManager:scheduleIn(FLUSH_DELAY_SECONDS, function()
        flush_scheduled = false
        LogShipper.flushNext()
    end)
end

local function registerRetryWhenOnline()
    if retry_when_online_registered then
        return
    end

    retry_when_online_registered = network:willRerunWhenOnline(function()
        retry_when_online_registered = false
        scheduleFlush()
    end) == true
end

function LogShipper.setSettings(settings)
    settings_ref = settings
end

function LogShipper.clearPending()
    pending_logs = {}
    flush_scheduled = false
end

function LogShipper.enqueue(payload)
    if not isEnabled() or not hasShippingPrerequisites() then
        return false
    end

    if #pending_logs >= MAX_PENDING_LOGS then
        table.remove(pending_logs, 1)
    end

    table.insert(pending_logs, payload)
    scheduleFlush()
    return true
end

function LogShipper.flushNext()
    if flush_in_progress then
        return
    end

    if not isEnabled() or not hasShippingPrerequisites() or #pending_logs == 0 then
        return
    end

    flush_in_progress = true

    local payload = pending_logs[1]
    local call_ok, ok = pcall(function()
        local Session = require("api/session")
        local DeviceLogsApi = require("api/device_logs")
        local session = Session:new(settings_ref)
        return DeviceLogsApi.postLog(session, payload)
    end)

    flush_in_progress = false

    if not call_ok then
        registerRetryWhenOnline()
        return
    end

    if ok then
        table.remove(pending_logs, 1)
        if #pending_logs > 0 then
            scheduleFlush()
        end
        return
    end

    registerRetryWhenOnline()
end

return LogShipper
