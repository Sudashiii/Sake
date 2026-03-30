local base_logger = require("logger")

local Log = {}

local LOG_PREFIX_PATTERN = "^%[Sake%]%s*"
local DEVICE_LOG_SOURCE = "sake"
local shipper_module = nil

local function getShipper()
    if shipper_module == nil then
        local ok, module_or_err = pcall(require, "adapters/log_shipper")
        shipper_module = ok and module_or_err or false
    end

    if shipper_module == false then
        return nil
    end

    return shipper_module
end

local function stringify(message)
    local text = tostring(message or "")
    if text == "" then
        return "Log entry"
    end
    return text
end

local function shippedMessage(message)
    local stripped = message:gsub(LOG_PREFIX_PATTERN, "")
    if stripped == "" then
        return message
    end
    return stripped
end

local function write(method, level, message)
    local text = stringify(message)
    local writer = base_logger[method] or base_logger.info
    writer(text)

    local shipper = getShipper()
    if shipper then
        shipper.enqueue({
            deviceId = tostring(Log.settings and Log.settings.device_name or ""),
            timestamp = os.date("!%Y-%m-%dT%H:%M:%SZ"),
            level = level,
            message = shippedMessage(text),
            source = DEVICE_LOG_SOURCE,
        })
    end
end

function Log.configure(settings)
    Log.settings = settings

    local shipper = getShipper()
    if shipper then
        shipper.setSettings(settings)
    end
end

function Log.clearPendingRemoteLogs()
    local shipper = getShipper()
    if shipper then
        shipper.clearPending()
    end
end

function Log.info(message)
    write("info", "info", message)
end

function Log.warn(message)
    write("warn", "warn", message)
end

function Log.error(message)
    write("error", "error", message)
end

function Log.debug(message)
    write("dbg", "debug", message)
end

function Log.dbg(message)
    write("dbg", "debug", message)
end

function Log.trace(message)
    write("dbg", "trace", message)
end

return Log
