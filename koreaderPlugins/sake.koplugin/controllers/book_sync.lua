local InfoMessage = require("ui/widget/infomessage")
local UIManager = require("ui/uimanager")
local logger = require("logger")
local _ = require("gettext")

local BookEngine = require("engines/book_engine")
local Utils = require("core/utils")

local BookSync = {}
BookSync.__index = BookSync

function BookSync:new(ctx)
    return setmetatable({
        popup = nil,
        engine = BookEngine:new(ctx),
    }, self)
end

local function closePopup(self)
    if self.popup then
        UIManager:close(self.popup)
        self.popup = nil
    end
end

function BookSync:showError(message)
    local text = _("Error: ") .. tostring(message)
    logger.warn("[Sake] " .. text)
    UIManager:show(InfoMessage:new{ text = text, timeout = 6 })
end

function BookSync:syncNow()
    logger.info("[Sake] Manual sync started.")

    self.popup = InfoMessage:new{ text = _("Checking for new books..."), timeout = nil }
    UIManager:show(self.popup)

    UIManager:scheduleIn(0.05, function()
        local success, result_or_err = self.engine:fetchPendingBooks()

        closePopup(self)

        if not success then
            self:showError(result_or_err)
            return
        end

        local result = result_or_err
        local books = result.books
        if result.total == 0 then
            UIManager:show(InfoMessage:new{ text = _("No new books found.") })
            return
        end

        logger.info("[Sake] Found " .. result.total .. " new books. Starting download queue.")
        self:startDownloadQueue(books, 1)
    end)
end

function BookSync:startDownloadQueue(books, index)
    local total = #books

    closePopup(self)

    if index > total then
        local summary_text = Utils.downloadSummaryText(_("Success! Downloaded"), total, Utils.bookTitles(books), ".")
        UIManager:show(InfoMessage:new{
            text = summary_text,
        })
        return
    end

    local book = books[index]
    local size_mb = Utils.formatSize(book.filesize)
    local title = tostring(book.title or "Unknown")

    logger.info("[Sake] Downloading " .. index .. "/" .. total .. ": " .. title .. " (" .. size_mb .. ")")

    local msg = string.format("Downloading %d of %d\n\n%s\nSize: %s", index, total, title, size_mb)
    self.popup = InfoMessage:new{
        text = msg,
        timeout = nil,
    }
    UIManager:show(self.popup)

    UIManager:scheduleIn(0.1, function()
        local success, output_path_or_err = self.engine:downloadBook(book)
        if not success then
            closePopup(self)
            self:showError("Failed on book " .. tostring(index) .. ": " .. tostring(output_path_or_err))
            return
        end

        logger.info("[Sake] Download success: " .. title .. " -> " .. tostring(output_path_or_err))
        self:startDownloadQueue(books, index + 1)
    end)
end

function BookSync:performSilentSync()
    local success, result_or_err = self.engine:fetchPendingBooks()
    if not success then
        return 0, result_or_err, {}
    end

    local result = result_or_err
    if result.total == 0 then
        return 0, nil, {}
    end

    local count = 0
    local downloaded_titles = {}
    for _, book in ipairs(result.books) do
        local ok_book, err_book = self.engine:downloadBook(book)
        if ok_book then
            count = count + 1
            table.insert(downloaded_titles, tostring(book.title or "Unknown"))
        else
            return count, err_book, downloaded_titles
        end
    end

    return count, nil, downloaded_titles
end

return BookSync
