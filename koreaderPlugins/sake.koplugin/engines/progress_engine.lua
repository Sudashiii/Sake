local ProgressApi = require("api/progress")
local Session = require("api/session")
local Storage = require("adapters/storage")
local Reader = require("adapters/reader")
local Settings = require("core/settings")

local ProgressEngine = {}
ProgressEngine.__index = ProgressEngine

function ProgressEngine:new(ctx)
    local settings = ctx.settings
    local storage = Storage:new(settings)

    return setmetatable({
        settings = settings,
        session = Session:new(settings),
        storage = storage,
        reader = Reader:new(ctx.ui, storage),
    }, self)
end

function ProgressEngine:validateSettings()
    local ok, missing = Settings.validateRequired(self.settings)
    if not ok then
        return false, "Please configure: " .. tostring(missing)
    end
    return true
end

function ProgressEngine:hasOpenDocument()
    return self.reader:hasOpenDocument()
end

function ProgressEngine:isLikelyValidLuaMetadata(content)
    return content and content ~= "" and content:find("return%s*{", 1) ~= nil
end

function ProgressEngine:uploadCurrentDocumentProgress()
    local valid, settings_err = self:validateSettings()
    if not valid then
        return false, settings_err
    end

    local ok_doc, doc_or_err = self.reader:getCurrentDocumentInfo()
    if not ok_doc then
        return false, doc_or_err
    end

    local paths = doc_or_err
    local live_percent_finished = self.reader:getLivePercentFinished(paths)

    local ok_file, content_or_err = self.storage:readText(paths.sdr_path)
    if not ok_file then
        return false, content_or_err
    end

    local success, msg = ProgressApi.uploadProgress(
        self.session,
        paths.filename,
        content_or_err,
        self.settings.device_name,
        live_percent_finished
    )
    if not success then
        return false, msg
    end

    return true, live_percent_finished
end

function ProgressEngine:applyRemoteProgress(book)
    local storage_key = tostring(book and book.s3_storage_key or "")
    if storage_key == "" then
        return false, "Book is missing storage key"
    end

    local exists, local_paths = self.storage:bookExists(storage_key)
    if not exists then
        return false, "Local file not found for progress apply: " .. tostring(local_paths.local_filename)
    end

    local ok_download, content_or_err = ProgressApi.downloadProgress(self.session, storage_key)
    if not ok_download then
        return false, "Download failed for " .. tostring(storage_key) .. ": " .. tostring(content_or_err)
    end

    if not self:isLikelyValidLuaMetadata(content_or_err) then
        return false, "Downloaded invalid Lua metadata for " .. tostring(storage_key)
    end

    local ok_write, write_err = self.storage:writeText(local_paths.sdr_path, content_or_err)
    if not ok_write then
        return false, write_err
    end

    local ok_confirm, confirm_err = ProgressApi.confirmProgressDownload(self.session, self.settings.device_name, book.id)
    if not ok_confirm then
        return false, "Applied locally but confirm failed for book " .. tostring(book.id) .. ": " .. tostring(confirm_err)
    end

    return true
end

function ProgressEngine:syncRemoteQueue()
    local valid, settings_err = self:validateSettings()
    if not valid then
        return false, settings_err
    end

    local ok_list, books_or_err = ProgressApi.getNewProgressForDevice(self.session, self.settings.device_name)
    if not ok_list then
        return false, books_or_err
    end

    local books = books_or_err
    if #books == 0 then
        return true, {
            total = 0,
            applied = 0,
            failed = 0,
            errors = {},
        }
    end

    if self:hasOpenDocument() then
        return true, {
            total = #books,
            applied = 0,
            failed = 0,
            errors = {},
            deferred = true,
        }
    end

    local applied = 0
    local failed = 0
    local errors = {}

    for _, book in ipairs(books) do
        local ok_apply, err_apply = self:applyRemoteProgress(book)
        if ok_apply then
            applied = applied + 1
        else
            failed = failed + 1
            table.insert(errors, tostring(err_apply))
        end
    end

    return true, {
        total = #books,
        applied = applied,
        failed = failed,
        errors = errors,
    }
end

return ProgressEngine
