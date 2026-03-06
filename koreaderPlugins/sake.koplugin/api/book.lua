local json = require("json")
local ltn12 = require("ltn12")

local BookApi = {}

function BookApi.fetchBookList(session, device_id)
    local ok, response = session:request{
        path = "/new",
        query = {
            deviceId = device_id or "",
        },
        method = "GET",
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

    return session:decodeJsonResponse(response)
end

function BookApi.fetchBookContent(session, book)
    local s3Key = book and book.s3_storage_key
    if not s3Key or s3Key == "" then
        return false, nil, "Missing book storage key"
    end

    local ok, response = session:request{
        path = "/" .. session:escape(s3Key),
        method = "GET",
        redirect = true,
    }

    if not ok then
        return false, nil, "Request failed: " .. tostring(response.request_error)
    end
    if response.status_code ~= 200 then
        local api_error = session:errorFromResponse(response)
        if api_error then
            return false, nil, api_error
        end
        return false, nil, "HTTP Error " .. tostring(response.status_code)
    end

    return true, {
        storage_key = s3Key,
        content = response.body,
    }
end

function BookApi.confirmDownload(session, device_id, book_id)
    local body = json.encode({ deviceId = device_id, bookId = book_id })
    local ok, response = session:request{
        path = "/confirmDownload",
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
    if response.status_code ~= 200 and response.status_code ~= 201 and response.status_code ~= 204 then
        local api_error = session:errorFromResponse(response)
        if api_error then
            return false, api_error
        end
        return false, "HTTP Error " .. tostring(response.status_code)
    end

    return true
end

return BookApi
