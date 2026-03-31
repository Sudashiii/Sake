local json = require("json")
local ltn12 = require("ltn12")
local logger = require("core/log")

local ProgressApi = {}
local LOG_PREFIX = "[Sake] "

function ProgressApi.uploadProgress(session, filename, content, device_id, percent_finished)
    local boundary = "SakeBoundary" .. os.time()
    local body_parts = {}

    table.insert(body_parts, "--" .. boundary)
    table.insert(body_parts, 'Content-Disposition: form-data; name="fileName"')
    table.insert(body_parts, "")
    table.insert(body_parts, filename)

    if device_id and device_id ~= "" then
        table.insert(body_parts, "--" .. boundary)
        table.insert(body_parts, 'Content-Disposition: form-data; name="deviceId"')
        table.insert(body_parts, "")
        table.insert(body_parts, tostring(device_id))
    end

    if percent_finished ~= nil then
        table.insert(body_parts, "--" .. boundary)
        table.insert(body_parts, 'Content-Disposition: form-data; name="percentFinished"')
        table.insert(body_parts, "")
        table.insert(body_parts, tostring(percent_finished))
    end

    table.insert(body_parts, "--" .. boundary)
    table.insert(body_parts, 'Content-Disposition: form-data; name="file"; filename="' .. filename .. '"')
    table.insert(body_parts, "Content-Type: application/octet-stream")
    table.insert(body_parts, "")
    table.insert(body_parts, content)

    table.insert(body_parts, "--" .. boundary .. "--")
    table.insert(body_parts, "")

    local request_body = table.concat(body_parts, "\r\n")

    logger.info(LOG_PREFIX .. "PUT progress for file: " .. tostring(filename))

    local ok, response = session:request{
        path = "/progress",
        method = "PUT",
        headers = {
            ["Content-Type"] = "multipart/form-data; boundary=" .. boundary,
            ["Content-Length"] = tostring(#request_body),
        },
        source = ltn12.source.string(request_body),
    }

    local function parseError()
        local api_error = session:errorFromResponse(response)
        if api_error then
            return api_error
        end

        local body = response.body
        if body == "" then
            return "Empty response"
        end

        local ok, data = pcall(json.decode, body)
        if ok and data and data.error then
            return data.error
        elseif not ok then
            return "Invalid JSON response: " .. body
        end
        return body
    end

    if not ok then
        logger.warn(LOG_PREFIX .. "PUT progress request failed: " .. tostring(response.request_error))
        return false, "Request failed: " .. tostring(response.request_error)
    elseif response.status_code == 200 or response.status_code == 201 or response.status_code == 204 then
        logger.info(LOG_PREFIX .. "PUT progress success. HTTP " .. tostring(response.status_code))
        return true, "Success"
    elseif response.status_code == 409 then
        local err_msg = parseError()
        logger.warn(LOG_PREFIX .. "PUT progress conflict: " .. tostring(err_msg))
        return false, "Conflict: " .. err_msg
    else
        local err_msg = parseError()
        logger.warn(LOG_PREFIX .. "PUT progress failed. HTTP " .. tostring(response.status_code) .. " - " .. tostring(err_msg))
        return false, "HTTP " .. tostring(response.status_code) .. ": " .. err_msg
    end
end

function ProgressApi.downloadProgress(session, filename)
    logger.info(LOG_PREFIX .. "GET progress for file: " .. tostring(filename))

    local ok, response = session:request{
        path = "/progress",
        method = "GET",
        query = {
            fileName = filename,
        },
    }

    if not ok then
        logger.warn(LOG_PREFIX .. "GET progress request failed: " .. tostring(response.request_error))
        return false, "Request failed: " .. tostring(response.request_error)
    elseif response.status_code == 200 then
        local content = response.body
        logger.info(LOG_PREFIX .. "GET progress success. Bytes: " .. tostring(#content))
        return true, content
    elseif response.status_code == 404 then
        local api_error = session:errorFromResponse(response)
        logger.info(LOG_PREFIX .. "GET progress not found for file: " .. tostring(filename))
        return false, api_error or "No progress found on server"
    else
        local api_error = session:errorFromResponse(response)
        if api_error then
            logger.warn(LOG_PREFIX .. "GET progress failed with API error: " .. tostring(api_error))
            return false, api_error
        end
        logger.warn(LOG_PREFIX .. "GET progress failed. HTTP " .. tostring(response.status_code))
        return false, "HTTP Error " .. tostring(response.status_code)
    end
end

function ProgressApi.getNewProgressForDevice(session, device_id)
    logger.info(LOG_PREFIX .. "GET new progress queue for device: " .. tostring(device_id))

    local ok, response = session:request{
        path = "/progress/new",
        method = "GET",
        query = {
            deviceId = device_id or "",
        },
    }

    if not ok then
        logger.warn(LOG_PREFIX .. "GET new progress queue request failed: " .. tostring(response.request_error))
        return false, "Request failed: " .. tostring(response.request_error)
    end

    if response.status_code ~= 200 then
        local api_error = session:errorFromResponse(response)
        if api_error then
            logger.warn(LOG_PREFIX .. "GET new progress queue failed with API error: " .. tostring(api_error))
            return false, api_error
        end
        logger.warn(LOG_PREFIX .. "GET new progress queue failed. HTTP " .. tostring(response.status_code))
        return false, "HTTP Error " .. tostring(response.status_code)
    end

    local ok_json, decoded_or_err = session:decodeJsonResponse(response)
    if not ok_json or type(decoded_or_err) ~= "table" then
        logger.warn(LOG_PREFIX .. "GET new progress queue returned invalid JSON.")
        return false, decoded_or_err or "Invalid JSON response"
    end
    logger.info(LOG_PREFIX .. "GET new progress queue success. Items: " .. tostring(#decoded_or_err))

    return true, decoded_or_err
end

function ProgressApi.confirmProgressDownload(session, device_id, book_id)
    local body = json.encode({
        deviceId = device_id,
        bookId = book_id,
    })

    logger.info(LOG_PREFIX .. "POST progress confirm. Device: " .. tostring(device_id) .. " | Book: " .. tostring(book_id))

    local ok, response = session:request{
        path = "/progress/confirm",
        method = "POST",
        headers = {
            ["Content-Type"] = "application/json",
            ["Content-Length"] = tostring(#body),
        },
        source = ltn12.source.string(body),
    }

    if not ok then
        logger.warn(LOG_PREFIX .. "POST progress confirm request failed: " .. tostring(response.request_error))
        return false, "Request failed: " .. tostring(response.request_error)
    end

    if response.status_code ~= 200 and response.status_code ~= 201 and response.status_code ~= 204 then
        local api_error = session:errorFromResponse(response)
        if api_error then
            logger.warn(LOG_PREFIX .. "POST progress confirm failed with API error: " .. tostring(api_error))
            return false, api_error
        end
        logger.warn(LOG_PREFIX .. "POST progress confirm failed. HTTP " .. tostring(response.status_code))
        return false, "HTTP Error " .. tostring(response.status_code)
    end
    logger.info(LOG_PREFIX .. "POST progress confirm success. HTTP " .. tostring(response.status_code))

    return true
end

return ProgressApi
