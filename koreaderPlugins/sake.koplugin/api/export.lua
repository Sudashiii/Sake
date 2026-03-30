local json = require("json")
local ltn12 = require("ltn12")
local logger = require("core/log")

local ExportApi = {}
local LOG_PREFIX = "[Sake] "
local unpack_fn = table.unpack or unpack

local function sanitizeHeaderValue(value)
    return tostring(value or ""):gsub('[\r\n"]', "_")
end

local function buildFormField(boundary, name, value)
    return table.concat({
        "--" .. boundary,
        'Content-Disposition: form-data; name="' .. sanitizeHeaderValue(name) .. '"',
        "",
        tostring(value or ""),
        "",
    }, "\r\n")
end

local function buildFileHeader(boundary, field_name, file_name, content_type)
    return table.concat({
        "--" .. boundary,
        'Content-Disposition: form-data; name="' .. sanitizeHeaderValue(field_name) .. '"; filename="' .. sanitizeHeaderValue(file_name) .. '"',
        "Content-Type: " .. tostring(content_type or "application/octet-stream"),
        "",
        "",
    }, "\r\n")
end

local function openFileSource(path)
    local handle, open_err = io.open(path, "rb")
    if not handle then
        return nil, "Cannot open file: " .. tostring(open_err)
    end

    return ltn12.source.file(handle)
end

local function getFileSize(path)
    local handle, open_err = io.open(path, "rb")
    if not handle then
        return nil, "Cannot open file: " .. tostring(open_err)
    end

    local size, seek_err = handle:seek("end")
    handle:close()
    if not size then
        return nil, "Cannot determine file size: " .. tostring(seek_err or path)
    end

    return size
end

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

function ExportApi.exportBook(session, device_id, file_name, file_path, sidecar_name, sidecar_path)
    local boundary = "SakeBoundary" .. os.time()
    local sources = {}
    local content_length = 0
    local metadata_size = nil

    local function appendStringPart(content)
        content_length = content_length + #content
        table.insert(sources, ltn12.source.string(content))
    end

    local file_size, file_size_err = getFileSize(file_path)
    if not file_size then
        return false, file_size_err
    end

    if sidecar_path then
        metadata_size, file_size_err = getFileSize(sidecar_path)
        if not metadata_size then
            return false, file_size_err
        end
    end

    appendStringPart(buildFormField(boundary, "deviceId", device_id))
    appendStringPart(buildFormField(boundary, "fileName", file_name))
    appendStringPart(buildFileHeader(boundary, "file", file_name or "book.bin", "application/octet-stream"))

    local file_source, file_source_err = openFileSource(file_path)
    if not file_source then
        return false, file_source_err
    end
    content_length = content_length + file_size
    table.insert(sources, file_source)
    appendStringPart("\r\n")

    if sidecar_path and metadata_size then
        appendStringPart(buildFileHeader(boundary, "sidecarFile", sidecar_name or "metadata.lua", "text/x-lua; charset=utf-8"))

        local metadata_source, metadata_source_err = openFileSource(sidecar_path)
        if not metadata_source then
            return false, metadata_source_err
        end
        content_length = content_length + metadata_size
        table.insert(sources, metadata_source)
        appendStringPart("\r\n")
    end

    appendStringPart("--" .. boundary .. "--\r\n")

    logger.info(LOG_PREFIX .. "POST export for file: " .. tostring(file_name))

    local ok, response = session:request{
        path = "/export",
        method = "POST",
        headers = {
            ["Content-Type"] = "multipart/form-data; boundary=" .. boundary,
            ["Content-Length"] = tostring(content_length),
        },
        source = ltn12.source.cat(unpack_fn(sources)),
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
