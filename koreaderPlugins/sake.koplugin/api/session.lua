local json = require("json")
local ltn12 = require("ltn12")
local socket = require("socket.url")

local Client = require("api/client")

local Session = {}
Session.__index = Session

local API_PREFIX = "/api/library"

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

function Session:escape(value)
    return socket.escape(tostring(value or ""))
end

function Session:request(opts)
    local response_chunks = opts.response_chunks or {}
    local headers = copyTable(opts.headers)
    headers["Authorization"] = Client.authHeader(self.settings.api_user, self.settings.api_pass)

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

    return true, response
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
