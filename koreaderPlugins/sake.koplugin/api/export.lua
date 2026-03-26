local json = require("json")
local ltn12 = require("ltn12")
local logger = require("logger")

local ExportApi = {}
local LOG_PREFIX = "[Sake] "

local function parseError(session, response)
    local api_error = session:errorFromResponse(response)
    if api_error then
        return api_error
    end

    local body = response and response.body or ""
    if body == "" then
        return "Empty response"
    end

    local ok, data = pcall(json.decode, body)
    if ok and data and data.error then
        return data.error
    end

    if not ok then
        return "Invalid JSON response: " .. tostring(body)
    end

    return tostring(body)
end

function ExportApi.exportBook(session, device_id, file_name, file_content, sidecar_name, sidecar_content)
    local boundary = "SakeBoundary" .. os.time()
    local body_parts = {}

    table.insert(body_parts, "--" .. boundary)
    table.insert(body_parts, 'Content-Disposition: form-data; name="deviceId"')
    table.insert(body_parts, "")
    table.insert(body_parts, tostring(device_id or ""))

    table.insert(body_parts, "--" .. boundary)
    table.insert(body_parts, 'Content-Disposition: form-data; name="fileName"')
    table.insert(body_parts, "")
    table.insert(body_parts, tostring(file_name or ""))

    table.insert(body_parts, "--" .. boundary)
    table.insert(body_parts, 'Content-Disposition: form-data; name="file"; filename="' .. tostring(file_name or "book.bin") .. '"')
    table.insert(body_parts, "Content-Type: application/octet-stream")
    table.insert(body_parts, "")
    table.insert(body_parts, file_content or "")

    if sidecar_content and sidecar_content ~= "" then
        table.insert(body_parts, "--" .. boundary)
        table.insert(body_parts, 'Content-Disposition: form-data; name="sidecarFile"; filename="' .. tostring(sidecar_name or "metadata.lua") .. '"')
        table.insert(body_parts, "Content-Type: text/x-lua; charset=utf-8")
        table.insert(body_parts, "")
        table.insert(body_parts, sidecar_content)
    end

    table.insert(body_parts, "--" .. boundary .. "--")
    table.insert(body_parts, "")

    local request_body = table.concat(body_parts, "\r\n")

    logger.info(LOG_PREFIX .. "POST export for file: " .. tostring(file_name))

    local ok, response = session:request{
        path = "/export",
        method = "POST",
        headers = {
            ["Content-Type"] = "multipart/form-data; boundary=" .. boundary,
            ["Content-Length"] = tostring(#request_body),
        },
        source = ltn12.source.string(request_body),
    }

    if not ok then
        logger.warn(LOG_PREFIX .. "POST export request failed: " .. tostring(response.request_error))
        return false, "Request failed: " .. tostring(response.request_error)
    end

    if response.status_code ~= 200 and response.status_code ~= 201 then
        local err_msg = parseError(session, response)
        logger.warn(LOG_PREFIX .. "POST export failed. HTTP " .. tostring(response.status_code) .. " - " .. tostring(err_msg))
        return false, "HTTP " .. tostring(response.status_code) .. ": " .. tostring(err_msg)
    end

    local ok_json, payload_or_err = session:decodeJsonResponse(response)
    if not ok_json or type(payload_or_err) ~= "table" or payload_or_err.success ~= true then
        logger.warn(LOG_PREFIX .. "POST export returned invalid JSON.")
        return false, payload_or_err or "Invalid JSON response"
    end

    logger.info(
        LOG_PREFIX
            .. "POST export success. Book outcome: "
            .. tostring(payload_or_err.bookOutcome)
            .. " | Sidecar outcome: "
            .. tostring(payload_or_err.sidecarOutcome)
    )

    return true, payload_or_err
end

return ExportApi
