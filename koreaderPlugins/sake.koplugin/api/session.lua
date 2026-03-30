local json = require("json")
local ltn12 = require("ltn12")
local socket = require("socket.url")
local logger = require("core/log")

local Client = require("api/client")
local Settings = require("core/settings")
local PluginMeta = require("_meta")

local Session = {}
Session.__index = Session

local API_PREFIX = "/api/library"
local DEVICE_KEY_ROUTE = "/api/auth/device-key"
local API_KEY_HEADER = "x-api-key"
local SAKE_VERSION_HEADER = "Sake-Version"
local LOG_PREFIX = "[Sake] "

local function copyTable(value)
    local copy = {}
    for key, item in pairs(value or {}) do
        copy[key] = item
    end
    return copy
end

local function queryString(query)
    local parts = {}
    for key, value in pairs(query or {}) do
        if value ~= nil then
            table.insert(parts, socket.escape(tostring(key)) .. "=" .. socket.escape(tostring(value)))
        end
    end
    table.sort(parts)
    return table.concat(parts, "&")
end

function Session:new(settings)
    return setmetatable({
        settings = settings or {},
    }, self)
end

function Session:pluginVersion()
    local version = PluginMeta and PluginMeta.version or "unknown"
    version = tostring(version or ""):gsub("^%s+", ""):gsub("%s+$", "")
    if version == "" then
        return "unknown"
    end
    return version
end

function Session:normalizedBaseUrl()
    local url = tostring(self.settings.api_url or "")
    url = url:gsub("^%s+", ""):gsub("%s+$", "")
    url = url:gsub("/+$", "")
    url = url:gsub("/api/library/?$", "")
    return url
end

function Session:libraryUrl(path, query)
    local url = self:normalizedBaseUrl() .. API_PREFIX .. tostring(path or "")
    local qs = queryString(query)
    if qs ~= "" then
        url = url .. "?" .. qs
    end
    return url
end

function Session:authUrl(path)
    return self:normalizedBaseUrl() .. tostring(path or "")
end

function Session:escape(value)
    return socket.escape(tostring(value or ""))
end

function Session:storedApiKey()
    local api_key = tostring(self.settings.api_key or "")
    return api_key:gsub("^%s+", ""):gsub("%s+$", "")
end

function Session:hasPairingCredentials()
    return tostring(self.settings.api_user or "") ~= ""
        and tostring(self.settings.api_pass or "") ~= ""
        and tostring(self.settings.device_name or "") ~= ""
end

function Session:storeApiKey(api_key)
    Settings.saveField(self.settings, "api_key", tostring(api_key or ""))
end

function Session:clearStoredApiKey()
    Settings.saveField(self.settings, "api_key", "")
end

function Session:clearPairingCredentials()
    Settings.saveField(self.settings, "api_pass", "")
end

function Session:pairDevice()
    if not self:hasPairingCredentials() then
        return false, "Missing API key and pairing credentials"
    end

    local request_body = json.encode({
        username = tostring(self.settings.api_user or ""),
        password = tostring(self.settings.api_pass or ""),
        deviceId = tostring(self.settings.device_name or ""),
    })

    local response_chunks = {}
    local headers = {
        ["Content-Type"] = "application/json",
        ["Content-Length"] = tostring(#request_body),
        [SAKE_VERSION_HEADER] = self:pluginVersion(),
    }
    local ok, status_code, response_headers, request_err = Client.request{
        url = self:authUrl(DEVICE_KEY_ROUTE),
        method = "POST",
        headers = headers,
        source = ltn12.source.string(request_body),
        sink = ltn12.sink.table(response_chunks),
        sink_table = response_chunks,
    }

    local response = {
        status_code = status_code,
        headers = response_headers,
        request_error = tostring(request_err or "Request failed"),
        body_chunks = response_chunks,
        body = table.concat(response_chunks),
    }

    if not ok then
        return false, response
    end

    if status_code ~= 201 then
        return false, response
    end

    local ok_json, payload_or_err = self:decodeJsonResponse(response)
    if not ok_json or type(payload_or_err) ~= "table" or not payload_or_err.apiKey then
        return false, "Invalid device-key response"
    end

    local api_key = tostring(payload_or_err.apiKey)
    self:storeApiKey(api_key)
    self:clearPairingCredentials()
    logger.info(LOG_PREFIX .. "Stored device API key for " .. tostring(self.settings.device_name))
    return true, api_key
end

function Session:fetchDeviceKey()
    local previous_api_key = self:storedApiKey()
    if previous_api_key ~= "" then
        self:clearStoredApiKey()
    end

    local ok, result = self:pairDevice()
    if not ok and previous_api_key ~= "" then
        self:storeApiKey(previous_api_key)
    end

    return ok, result
end

function Session:requestWithStoredKey(opts, api_key, allow_retry_auth)
    local response_chunks = opts.response_chunks or {}
    local headers = copyTable(opts.headers)

    headers[API_KEY_HEADER] = api_key
    headers[SAKE_VERSION_HEADER] = self:pluginVersion()

    local ok, status_code, response_headers, request_err = Client.request{
        url = opts.url or self:libraryUrl(opts.path, opts.query),
        method = opts.method or "GET",
        headers = headers,
        source = opts.source,
        sink = opts.sink or ltn12.sink.table(response_chunks),
        redirect = opts.redirect,
        timeout = opts.timeout,
        sink_table = response_chunks,
    }

    local response = {
        status_code = status_code,
        headers = response_headers,
        request_error = tostring(request_err or "Request failed"),
        body_chunks = response_chunks,
        body = table.concat(response_chunks),
    }

    if not ok then
        return false, response
    end

    if allow_retry_auth and response.status_code == 401 and not opts._retry_auth and self:hasPairingCredentials() then
        self:clearStoredApiKey()
        local retry_opts = copyTable(opts)
        retry_opts._retry_auth = true
        return self:request(retry_opts)
    end

    return true, response
end

function Session:request(opts)
    local api_key = self:storedApiKey()

    if api_key == "" then
        local paired, api_key_or_err = self:pairDevice()
        if not paired then
            if type(api_key_or_err) == "table" and api_key_or_err.status_code then
                return true, api_key_or_err
            end
            return false, {
                status_code = nil,
                headers = nil,
                request_error = tostring(api_key_or_err or "Request failed"),
                body_chunks = {},
                body = "",
            }
        end

        api_key = tostring(api_key_or_err)
    end

    return self:requestWithStoredKey(opts, api_key, true)
end

function Session:requestIfAuthenticated(opts)
    local api_key = self:storedApiKey()
    if api_key == "" then
        return false, {
            status_code = nil,
            headers = nil,
            request_error = "Missing API key",
            body_chunks = {},
            body = "",
        }
    end

    return self:requestWithStoredKey(opts, api_key, false)
end

function Session:errorFromResponse(response)
    return Client.errorFromBody(response and response.body_chunks or nil)
end

function Session:decodeJsonResponse(response)
    local ok, decoded = pcall(function()
        return json.decode(response and response.body or "")
    end)
    if not ok or decoded == nil then
        return false, "Invalid JSON response"
    end
    return true, decoded
end

return Session
