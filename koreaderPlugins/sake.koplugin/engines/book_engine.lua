local BookApi = require("api/book")
local Session = require("api/session")
local Storage = require("adapters/storage")
local Settings = require("core/settings")

local BookEngine = {}
BookEngine.__index = BookEngine

function BookEngine:new(ctx)
    local settings = ctx.settings
    return setmetatable({
        settings = settings,
        session = Session:new(settings),
        storage = Storage:new(settings),
    }, self)
end

function BookEngine:validateSettings()
    local ok, missing = Settings.validateRequired(self.settings)
    if not ok then
        return false, "Please configure: " .. tostring(missing)
    end
    return true
end

function BookEngine:fetchPendingBooks()
    local valid, err = self:validateSettings()
    if not valid then
        return false, err
    end

    local success, books_or_err = BookApi.fetchBookList(self.session, self.settings.device_name)
    if not success then
        return false, books_or_err
    end

    return true, {
        books = books_or_err,
        total = #books_or_err,
    }
end

function BookEngine:downloadBook(book)
    local ok_content, payload_or_err, content_err = BookApi.fetchBookContent(self.session, book)
    if not ok_content then
        return false, content_err or payload_or_err
    end

    local payload = payload_or_err
    local ok_save, output_or_err = self.storage:saveBook(payload.storage_key, payload.content)
    if not ok_save then
        return false, output_or_err
    end

    local ok_confirm, confirm_err = BookApi.confirmDownload(self.session, self.settings.device_name, book.id)
    if not ok_confirm then
        return false, "Saved locally but failed to confirm download: " .. tostring(confirm_err)
    end

    return true, output_or_err
end

return BookEngine
