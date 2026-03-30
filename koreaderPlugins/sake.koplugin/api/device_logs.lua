local json = require("json")
local ltn12 = require("ltn12")

local DeviceLogsApi = {}

local DEVICE_LOGS_ROUTE = "/api/devices/logs"

function DeviceLogsApi.postLog(session, payload)
    local body = json.encode(payload)

    local ok, response = session:requestIfAuthenticated{
        url = session:authUrl(DEVICE_LOGS_ROUTE),
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = tostring(#body),
        },
        source = ltn12.source.string(body),
    }

    if not ok then
        return false, tostring(response.request_error or "Request failed")
    end

    if response.status_code ~= 204 then
        local api_error = session:errorFromResponse(response)
        if api_error then
            return false, api_error
        end
        return false, "HTTP Error " .. tostring(response.status_code)
    end

    return true
end

return DeviceLogsApi
