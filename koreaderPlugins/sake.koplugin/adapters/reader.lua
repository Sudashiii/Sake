local Reader = {}
Reader.__index = Reader

local function safeCall(obj, method, ...)
    if not obj then
        return false, nil
    end

    local fn = obj[method]
    if type(fn) ~= "function" then
        return false, nil
    end

    local ok, value = pcall(fn, obj, ...)
    if not ok then
        return false, nil
    end

    return true, value
end

local function asPercent(value)
    local n = tonumber(value)
    if not n then
        return nil
    end
    if n >= 0 and n <= 1 then
        return n
    end
    if n > 1 and n <= 100 then
        return n / 100
    end
    return nil
end

function Reader:new(ui, storage)
    return setmetatable({
        ui = ui,
        storage = storage,
    }, self)
end

function Reader:hasOpenDocument()
    local ui = self.ui
    return ui and ui.document and ui.document.file and ui.document.file ~= ""
end

function Reader:getCurrentDocumentInfo()
    local ui = self.ui
    if not ui or not ui.document then
        return false, "No document open"
    end

    local doc_path = ui.document.file
    if not doc_path or doc_path == "" then
        return false, "Could not determine document path"
    end

    return self.storage:documentPaths(doc_path)
end

function Reader:getLivePercentFinished(paths)
    local ui = self.ui

    if ui and ui.document then
        local ok_cur, current_page = safeCall(ui.document, "getCurrentPage")
        local ok_total, total_pages = safeCall(ui.document, "getPageCount")
        if ok_cur and ok_total and tonumber(total_pages) and tonumber(total_pages) > 0 then
            return asPercent(tonumber(current_page) / tonumber(total_pages))
        end
    end

    if ui and ui.doc_settings then
        local ok_summary, summary = safeCall(ui.doc_settings, "readSetting", "summary")
        if ok_summary and type(summary) == "table" then
            local percent = asPercent(summary.percent_finished)
            if percent then
                return percent
            end
        end

        local ok_percent, percent_finished = safeCall(ui.doc_settings, "readSetting", "percent_finished")
        if ok_percent then
            local percent = asPercent(percent_finished)
            if percent then
                return percent
            end
        end
    end

    local ok_require, DocSettings = pcall(require, "docsettings")
    if ok_require and DocSettings and paths and paths.doc_path then
        local opened = nil
        local ok_open, instance = pcall(function()
            if type(DocSettings.open) == "function" then
                return DocSettings:open(paths.doc_path)
            end
            return nil
        end)
        if ok_open then
            opened = instance
        end
        if opened then
            local ok_summary, summary = safeCall(opened, "readSetting", "summary")
            if ok_summary and type(summary) == "table" then
                local percent = asPercent(summary.percent_finished)
                if percent then
                    safeCall(opened, "close")
                    return percent
                end
            end

            local ok_percent, percent_finished = safeCall(opened, "readSetting", "percent_finished")
            if ok_percent then
                local percent = asPercent(percent_finished)
                if percent then
                    safeCall(opened, "close")
                    return percent
                end
            end

            safeCall(opened, "close")
        end
    end

    return nil
end

return Reader
