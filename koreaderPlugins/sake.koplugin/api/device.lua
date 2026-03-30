local json = require("json")
local ltn12 = require("ltn12")
local logger = require("core/log")

local DeviceApi = {}

local LOG_PREFIX = "[Sake] "
local DEVICE_VERSION_ROUTE = "/api/devices/version"

function DeviceApi.reportVersion(session, device_id, version)
    logger.info(LOG_PREFIX .. "POST device version. Device: " .. tostring(device_id) .. " | Version: " .. tostring(version))

    local body = json.encode({
        deviceId = device_id,
        version = version,
    })

    local ok, response = session:request{
        url = session:authUrl(DEVICE_VERSION_ROUTE),
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = tostring(#body),
        },
        source = ltn12.source.string(body),
    }

    if not ok then
        return false, "Request failed: " .. tostring(response.request_error)
    end

    if response.status_code ~= 200 then
        local api_error = session:errorFromResponse(response)
        if api_error then
            return false, api_error
        end
        return false, "HTTP Error " .. tostring(response.status_code)
    end

    return true
end

return DeviceApi
